import os
from urllib.parse import urlparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger("imagenerve.database")


def _resolve_database_url() -> str:
    """Resolve and validate the database URL from environment variables.

    Priority:
    - DATABASE_URL
    - SUPABASE_DB_URL
    - SUPABASE_URL (must be a PostgreSQL DSN, not the REST URL)
    """
    candidates = [
        os.environ.get("DATABASE_URL"),
        os.environ.get("SUPABASE_DB_URL"),
        os.environ.get("SUPABASE_URL"),
    ]

    db_url = next((c for c in candidates if c), None)
    if not db_url:
        raise RuntimeError(
            "Database URL not configured. Set DATABASE_URL or SUPABASE_DB_URL in your environment."
        )

    # Basic validation of scheme
    if not db_url.startswith("postgres://") and not db_url.startswith("postgresql://"):
        raise RuntimeError(
            "Invalid database URL. Expected a PostgreSQL DSN (postgresql://...). "
            "You might have set the Supabase REST URL instead."
        )

    # Enforce SSL for Supabase if not present
    needs_ssl = any(h in db_url for h in ["supabase.co", "pooler.supabase.com"]) and "sslmode=" not in db_url
    if needs_ssl:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"
        logger.info("🔐 Enforcing sslmode=require for Supabase connection")

    # Helpful diagnostics for pooled connections
    try:
        parsed = urlparse(db_url)
        hostname = parsed.hostname or ""
        username = (parsed.username or "")
        if "pooler.supabase.com" in hostname and "." not in username:
            logger.warning(
                "⚠️ Supabase pooled host detected (%s) but username '%s' has no project ref.\n"
                "Use the pooled connection string from Supabase exactly (username like 'postgres.<project-ref>' or 'service_role.<project-ref>').",
                hostname,
                username,
            )
    except Exception:
        # Non-fatal; continue
        pass

    return db_url


DATABASE_URL = _resolve_database_url()

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # Good for scripts and dev; use a real pool in prod
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()