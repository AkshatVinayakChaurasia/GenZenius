"""Request authentication for the RiskFusion AI API.

Every data route requires a valid Supabase Auth (GoTrue) access token. Two
verification strategies are supported, in order of preference:

1. Local HS256 signature verification using ``SUPABASE_JWT_SECRET``. No network
   call, so it adds no latency to a serverless invocation.
2. Token introspection against ``GET /auth/v1/user`` when no JWT secret is
   configured. Correct for any signing algorithm, cached briefly so a burst of
   requests does not fan out to the auth service.

Only the standard library is used, keeping the serverless bundle small.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# Supabase issues access tokens with this audience for signed-in end users.
EXPECTED_AUDIENCE = "authenticated"
INTROSPECTION_TTL_SECONDS = 30
# Small clock-skew allowance between the auth service and this runtime.
LEEWAY_SECONDS = 10

bearer_scheme = HTTPBearer(auto_error=False, description="Supabase access token")

_introspection_cache: dict[str, tuple[float, dict]] = {}


class AuthenticatedUser:
    """The verified caller behind a request."""

    __slots__ = ("id", "email", "role")

    def __init__(self, user_id: str, email: str, role: str) -> None:
        self.id = user_id
        self.email = email
        self.role = role

    @property
    def label(self) -> str:
        """Human-readable actor name for audit entries."""
        return self.email or self.id


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    try:
        return base64.urlsafe_b64decode(segment + padding)
    except Exception as exc:  # noqa: BLE001 - any malformed segment is simply invalid
        raise _unauthorized("Malformed access token.") from exc


def _verify_locally(token: str) -> dict:
    """Verifies an HS256 Supabase token and returns its claims."""
    parts = token.split(".")
    if len(parts) != 3:
        raise _unauthorized("Malformed access token.")
    header_segment, payload_segment, signature_segment = parts

    try:
        header = json.loads(_b64url_decode(header_segment))
        claims = json.loads(_b64url_decode(payload_segment))
    except json.JSONDecodeError as exc:
        raise _unauthorized("Malformed access token.") from exc

    if header.get("alg") != "HS256":
        # Asymmetric project keys cannot be checked with the shared secret.
        raise _unauthorized("Unsupported token signing algorithm.")

    expected = hmac.new(
        SUPABASE_JWT_SECRET.encode(),
        f"{header_segment}.{payload_segment}".encode(),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(expected, _b64url_decode(signature_segment)):
        raise _unauthorized("Access token signature is invalid.")

    now = time.time()
    expires_at = claims.get("exp")
    if not isinstance(expires_at, (int, float)) or expires_at + LEEWAY_SECONDS < now:
        raise _unauthorized("Access token has expired.")

    issued_at = claims.get("iat")
    if isinstance(issued_at, (int, float)) and issued_at - LEEWAY_SECONDS > now:
        raise _unauthorized("Access token is not yet valid.")

    audience = claims.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    if EXPECTED_AUDIENCE not in audiences:
        raise _unauthorized("Access token was not issued for this application.")

    if SUPABASE_URL and not str(claims.get("iss", "")).startswith(SUPABASE_URL):
        raise _unauthorized("Access token was issued by an unexpected authority.")

    return claims


def _introspect(token: str) -> dict:
    """Asks the auth service who a token belongs to, with a short-lived cache."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on this deployment.",
        )

    cache_key = hashlib.sha256(token.encode()).hexdigest()
    cached = _introspection_cache.get(cache_key)
    now = time.monotonic()
    if cached and cached[0] > now:
        return cached[1]

    request = Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=6) as response:
            user = json.loads(response.read().decode() or "{}")
    except HTTPError as exc:
        if exc.code in {401, 403}:
            raise _unauthorized("Access token is invalid or has expired.") from exc
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify the access token.",
        ) from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach the authentication service.",
        ) from exc

    if not user.get("id"):
        raise _unauthorized("Access token is invalid or has expired.")

    # Normalise onto the same shape the JWT claims use.
    claims = {"sub": user["id"], "email": user.get("email", ""), "role": user.get("role", EXPECTED_AUDIENCE)}
    _introspection_cache[cache_key] = (now + INTROSPECTION_TTL_SECONDS, claims)
    if len(_introspection_cache) > 256:
        # Bound the cache; entries are cheap to rebuild.
        for stale_key in [key for key, (expiry, _) in _introspection_cache.items() if expiry <= now]:
            _introspection_cache.pop(stale_key, None)
    return claims


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    """FastAPI dependency that resolves and validates the calling user."""
    if credentials is None or not credentials.credentials:
        raise _unauthorized("This endpoint requires an authenticated request.")

    token = credentials.credentials.strip()
    claims = _verify_locally(token) if SUPABASE_JWT_SECRET else _introspect(token)

    user_id = claims.get("sub")
    if not user_id:
        raise _unauthorized("Access token does not identify a user.")
    return AuthenticatedUser(user_id, claims.get("email", "") or "", claims.get("role", EXPECTED_AUDIENCE))
