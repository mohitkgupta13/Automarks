"""
Database configuration and session management
PostgreSQL database setup for VTU Results System (Production-grade)
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from typing import Generator
import os
from dotenv import load_dotenv

load_dotenv()


def get_database_url() -> str:
    """
    Build PostgreSQL database URL from environment variables.
    Supports DATABASE_URL override for container / cloud deployments.
    """
    # Allow a full connection string override (Heroku, Render, Docker, etc.)
    full_url = os.getenv("DATABASE_URL")
    if full_url:
        # Heroku-style postgres:// needs to be postgresql://
        if full_url.startswith("postgres://"):
            full_url = full_url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif full_url.startswith("postgresql://"):
            full_url = full_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return full_url

    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "vtu_results")

    # If no specific postgres config is present, fallback to SQLite
    if not os.getenv("POSTGRES_HOST") and not os.getenv("DATABASE_URL"):
        return "sqlite:///./vtu_results.db"

    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"


# Database URL
DATABASE_URL = get_database_url()

# Mask password in log output
if "sqlite" in DATABASE_URL:
    _display_url = "SQLite (local file)"
    print(f"🔌 Database Type: SQLite")
else:
    _display_url = DATABASE_URL.split("@")[1] if "@" in DATABASE_URL else "database"
    print(f"🔌 Database Type: PostgreSQL")

print(f"🔗 Connecting to: {_display_url}")

# Create engine with production-grade pool settings
if "sqlite" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # Required for SQLite in FastAPI
        echo=os.getenv("DEBUG", "False").lower() == "true",
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,          # Verify connections before checkout
        pool_size=10,                # Baseline pool connections
        max_overflow=20,             # Additional connections under load
        pool_recycle=1800,           # Recycle connections every 30 min
        pool_timeout=30,             # Wait up to 30s for a connection
        echo=os.getenv("DEBUG", "False").lower() == "true",
    )

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()


def get_db() -> Generator:
    """
    FastAPI dependency to get a database session.
    Yields a session and ensures it is closed after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables from ORM models.
    """
    Base.metadata.create_all(bind=engine)
