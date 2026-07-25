import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool


default_sqlite_url = "sqlite:////tmp/riskfusion.db" if os.getenv("VERCEL") else "sqlite:///./riskfusion.db"
DATABASE_URL = os.getenv("DATABASE_URL", default_sqlite_url)

is_sqlite = DATABASE_URL.startswith("sqlite")
engine_options = {"connect_args": {"check_same_thread": False}} if is_sqlite else {"poolclass": NullPool, "pool_pre_ping": True}
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
