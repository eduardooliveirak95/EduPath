"""Migrações do esquema (Alembic), aplicadas quando a API arranca."""

from collections.abc import Mapping
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
# Revisão que corresponde às tabelas criadas antes do Alembic, com create_all.
BASELINE = "0001"
# Número fixo, sem significado: no Postgres, só uma instância da API migra de cada vez.
LOCK_ID = 7_301_955_202


def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    return config


def should_migrate(environ: Mapping[str, str]) -> bool:
    """As pré-visualizações do Vercel usam a BD de produção: não podem mudar o esquema."""
    return environ.get("VERCEL_ENV") != "preview"


def upgrade_database(engine: Engine) -> None:
    """Põe a base de dados na última revisão. Não faz nada se já estiver."""
    config = alembic_config()
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            # Duas instâncias a arrancar ao mesmo tempo: a segunda espera pela primeira.
            connection.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": LOCK_ID})
        tables = inspect(connection).get_table_names()
        config.attributes["connection"] = connection
        if "goals" in tables and "alembic_version" not in tables:
            # BD criada antes das migrações: já tem o esquema da primeira revisão.
            command.stamp(config, BASELINE)
        command.upgrade(config, "head")
