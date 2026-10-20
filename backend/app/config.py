from collections.abc import Mapping
from datetime import UTC, date, datetime
from functools import lru_cache
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import AliasChoices, Field, StringConstraints
from pydantic_settings import BaseSettings, SettingsConfigDict

# Sem espaços nem quebras de linha nas pontas, que vêm muitas vezes ao copiar e colar.
Secret = Annotated[str, StringConstraints(strip_whitespace=True)]


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente (ou do ficheiro .env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./edupath.db"
    cors_origins: str = "http://localhost:5173"
    timezone: str = "Europe/Lisbon"

    # Contas: SESSION_SECRET assina as sessões; sem ele, ninguém entra e a API fica fechada.
    session_secret: Secret = ""
    session_days: int = 30
    # Código pedido para criar uma conta. Sem ele, o registo está fechado.
    # Sem INVITE_CODE, serve APP_PASSWORD: a password do login antigo passou a ser o código.
    invite_code: Secret = Field("", validation_alias=AliasChoices("invite_code", "app_password"))

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def ensure_persistent_database(settings: Settings, environ: Mapping[str, str]) -> None:
    """No Vercel o disco é temporário: um ficheiro SQLite perderia os dados sem avisar."""
    if environ.get("VERCEL") and settings.database_url.startswith("sqlite"):
        raise RuntimeError(
            "No Vercel é preciso definir DATABASE_URL com uma base de dados Postgres (ex.: Neon)."
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_today() -> date:
    """Data de hoje no fuso horário configurado (dependência do FastAPI)."""
    return datetime.now(ZoneInfo(get_settings().timezone)).date()


def get_now() -> datetime:
    """Agora, em UTC (dependência do FastAPI, para os testes poderem avançar o relógio)."""
    return datetime.now(UTC)
