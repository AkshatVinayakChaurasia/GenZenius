import math
from typing import Optional

# Approximate city centroids for the locations used across seeded/demo incidents.
# Unknown cities degrade gracefully in rules.py rather than raising.
CITY_COORDS: dict[str, tuple[float, float]] = {
    "mumbai": (19.0760, 72.8777),
    "moscow": (55.7558, 37.6173),
    "bengaluru": (12.9716, 77.5946),
    "delhi": (28.7041, 77.1025),
    "pune": (18.5204, 73.8567),
    "dubai": (25.2048, 55.2708),
    "frankfurt": (50.1109, 8.6821),
    "chennai": (13.0827, 80.2707),
    "sao paulo": (-23.5505, -46.6333),
    "new york": (40.7128, -74.0060),
    "beijing": (39.9042, 116.4074),
    "paris": (48.8566, 2.3522),
}

# Fastest plausible ground/air travel speed for a single traveller; a login
# pair implying a higher speed than this is physically impossible.
MAX_PLAUSIBLE_SPEED_KMH = 900


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def distance_km(city_a: str, city_b: str) -> Optional[float]:
    a = CITY_COORDS.get(city_a.strip().lower())
    b = CITY_COORDS.get(city_b.strip().lower())
    if not a or not b:
        return None
    return round(_haversine_km(a, b), 1)
