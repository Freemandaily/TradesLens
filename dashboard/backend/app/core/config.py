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
    ENVIO_PG_PUBLIC_SCHEMA: str = "envio_v2"
    
    # DATABASE_URL derived or passed directly
    DATABASE_URL: str

    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
