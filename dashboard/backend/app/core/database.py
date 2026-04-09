from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

import logging

# Simple logging setup to see logs in Docker
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"options": f"-c search_path={settings.ENVIO_PG_PUBLIC_SCHEMA}"}
)

# Test connection on startup
try:
    with engine.connect() as conn:
        logger.info(f"Successfully connected to Database: {settings.ENVIO_PG_HOST}")
        logger.info(f"Active schema: {settings.ENVIO_PG_PUBLIC_SCHEMA}")
except Exception as e:
    logger.error(f"DATABASE CONNECTION ERROR: {str(e)}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
