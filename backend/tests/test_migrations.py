from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, inspect, text
from sqlalchemy.exc import IntegrityError

from app.database import Base, create_db_engine
from app.migrate import alembic_config, should_migrate, upgrade_database
from tests.conftest import TEST_DATABASE_URL

HEAD = ScriptDirectory.from_config(alembic_config()).get_current_head()


def drop_everything(engine: Engine) -> None:
    Base.metadata.drop_all(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))


@pytest.fixture
def engine(tmp_path: Path) -> Iterator[Engine]:
    """Base de dados vazia, sem tabelas (as migrações é que as criam)."""
    if TEST_DATABASE_URL.startswith("sqlite"):
        engine = create_db_engine(f"sqlite:///{tmp_path / 'migracoes.db'}")
    else:
        engine = create_db_engine(TEST_DATABASE_URL)
        drop_everything(engine)
    yield engine
    drop_everything(engine)
    engine.dispose()


def current_revision(engine: Engine) -> str | None:
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision()


def insert_goal(engine: Engine, progress: int = 10) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO goals (title, category, start_date, target_date, progress)"
                " VALUES ('Antigo', 'saude', '2026-01-01', '2026-12-01', :progress)"
            ),
            {"progress": progress},
        )


def test_migrations_create_the_same_schema_as_the_models(engine):
    upgrade_database(engine)

    assert current_revision(engine) == HEAD
    with engine.connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    assert differences == []


def test_upgrade_is_safe_to_run_again(engine):
    upgrade_database(engine)
    upgrade_database(engine)
    assert current_revision(engine) == HEAD


def test_database_from_before_migrations_is_upgraded_and_keeps_its_data(engine):
    # Uma BD criada com create_all antes do Alembic: o esquema da 0001, sem alembic_version.
    config = alembic_config()
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "0001")
        connection.execute(text("DROP TABLE alembic_version"))
    insert_goal(engine)

    upgrade_database(engine)

    assert current_revision(engine) == HEAD
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT title, user_id FROM goals")).all()
    assert [tuple(row) for row in rows] == [("Antigo", None)]
    assert "users" in inspect(engine).get_table_names()
    # A restrição do progresso continua lá (no SQLite, a tabela foi recriada).
    with pytest.raises(IntegrityError):
        insert_goal(engine, progress=150)


def test_first_account_becomes_admin_when_upgrading(engine):
    config = alembic_config()
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "0003")
        connection.execute(
            text(
                "INSERT INTO users (name, email, password_hash)"
                " VALUES ('Primeira', 'a@x.pt', 'h'), ('Segunda', 'b@x.pt', 'h')"
            )
        )

    upgrade_database(engine)

    with engine.connect() as connection:
        rows = connection.execute(text("SELECT name, is_admin FROM users ORDER BY id")).all()
    assert [(name, bool(is_admin)) for name, is_admin in rows] == [
        ("Primeira", True),
        ("Segunda", False),
    ]


@pytest.mark.parametrize(
    ("environ", "expected"),
    [({}, True), ({"VERCEL_ENV": "production"}, True), ({"VERCEL_ENV": "preview"}, False)],
)
def test_previews_do_not_migrate_the_shared_database(environ, expected):
    assert should_migrate(environ) is expected
