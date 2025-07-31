import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("SUPABASE_URL")

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # Good for scripts and dev; use a real pool in prod
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)