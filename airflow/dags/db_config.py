from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "TradesLens-API"
    
    # TimescaleDB / Postgres Connection (ENV vars from .env)
    ENVIO_PG_USER: str
    ENVIO_PG_PASSWORD: str
    ENVIO_PG_HOST: str
    ENVIO_PG_PORT: int
    ENVIO_PG_DATABASE: str
    ENVIO_PG_SSL_MODE: str = "require"
    
    # DATABASE_URL derived or passed directly
    DATABASE_URL: str


    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
