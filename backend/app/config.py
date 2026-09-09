"""
Application configuration management using Pydantic Settings.
"""
from typing import List, Optional
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8000
    PORT: Optional[int] = None
    DEBUG: bool = False
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/sih26011_dev"
    ANALYSIS_SRID: int = 32644
    FRONTEND_ORIGIN: Optional[str] = None
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    model_config = SettingsConfigDict(
        env_file=[str(ENV_FILE), ".env"],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    @property
    def database_url(self) -> str:
        """
        Normalizes database connection string for SQLAlchemy 2.0 + psycopg 3 driver.
        Translates 'postgres://' and 'postgresql://' to 'postgresql+psycopg://'.
        """
        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def allowed_cors_origins(self) -> List[str]:
        """Collects development and production origins allowed for CORS."""
        origins = list(self.CORS_ORIGINS)
        if self.FRONTEND_ORIGIN:
            for origin in self.FRONTEND_ORIGIN.split(","):
                cleaned = origin.strip().rstrip("/")
                if cleaned and cleaned not in origins:
                    origins.append(cleaned)
        return origins

    @property
    def debug(self) -> bool:
        return self.DEBUG

    @property
    def app_env(self) -> str:
        return self.APP_ENV

    @property
    def app_host(self) -> str:
        return self.APP_HOST

    @property
    def app_port(self) -> int:
        return self.PORT or self.APP_PORT

    @property
    def analysis_srid(self) -> int:
        return self.ANALYSIS_SRID


settings = Settings()
