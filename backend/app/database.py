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

    # Helpful diagnostics and validation
    try:
        parsed = urlparse(db_url)
        hostname = (parsed.hostname or "").strip()
        username = (parsed.username or "")
        password = parsed.password
        if "@" in hostname:
            raise RuntimeError(
                "Database URL is malformed: hostname contains '@' (got %r). "
                "This usually means a space after the colon in postgres:PASSWORD. "
                "Use no space: postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres"
                % (hostname,)
            )
        if "supabase.co" in hostname and not password:
            raise RuntimeError(
                "Database URL has no password. Supabase requires a password. "
                "In .env set SUPABASE_URL (or DATABASE_URL) to the full connection string, e.g.:\n"
                "  postgresql://postgres:YOUR_DATABASE_PASSWORD@db.xxxx.supabase.co:5432/postgres?sslmode=require\n"
                "Get the password from Supabase: Project Settings → Database → Connection string (URI)."
            )
        if "pooler.supabase.com" in hostname and "." not in username:
            logger.warning(
                "⚠️ Supabase pooled host detected (%s) but username '%s' has no project ref.\n"
                "Use the pooled connection string from Supabase exactly (username like 'postgres.<project-ref>' or 'service_role.<project-ref>').",
                hostname,
                username,
            )
    except RuntimeError:
        raise
    except Exception:
        # Non-fatal; continue
        pass

    return db_url


_database_url = None
_engine = None
_SessionLocal = None


def _get_engine():
    global _engine, _SessionLocal, _database_url
    if _engine is None:
        _database_url = _resolve_database_url()
        _engine = create_engine(
            _database_url,
            poolclass=NullPool,
            pool_pre_ping=True,
        )
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_db():
    if _SessionLocal is None:
        _get_engine()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()