"""Ambiente do Alembic: usa os modelos da app e o DATABASE_URL da configuração."""

from alembic import context
from sqlalchemy import Connection

import app.models  # noqa: F401  (regista as tabelas em Base.metadata)
from app.config import get_settings
from app.database import Base, create_db_engine


def run_migrations(connection: Connection) -> None:
    # render_as_batch: no SQLite, alterar uma tabela obriga a recriá-la.
    context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    raise SystemExit("Gerar SQL sem ligação (--sql) não é suportado.")

connection = context.config.attributes.get("connection")
if connection is not None:
    # Chamado pela API (app/migrate.py), que já abriu a ligação e a transação.
    run_migrations(connection)
else:
    # Chamado pela linha de comandos: liga-se ao DATABASE_URL.
    engine = create_db_engine(get_settings().database_url)
    with engine.begin() as connection:
        run_migrations(connection)
    engine.dispose()
