from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def normalize_database_url(url: str) -> str:
    """Usa o driver psycopg 3 com URLs Postgres simples (como as que o Neon fornece)."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


def create_db_engine(url: str, **kwargs) -> Engine:
    url = normalize_database_url(url)
    if not url.startswith("sqlite"):
        # Sem prepared statements no servidor: compatível com poolers como o do Neon.
        return create_engine(
            url, pool_pre_ping=True, connect_args={"prepare_threshold": None}, **kwargs
        )

    engine = create_engine(url, connect_args={"check_same_thread": False}, **kwargs)

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    return engine


@contextmanager
def foreign_keys_off(connection: Connection) -> Iterator[None]:
    """No SQLite, desliga as chaves estrangeiras enquanto as migrações correm.

    Para mudar uma tabela, o SQLite recria-a (o "batch" do Alembic), e o DROP da antiga
    apagaria em cascata as linhas que dependem dela: mudar a tabela goals apagava os passos e a
    evolução do progresso. Tem de ser fora de uma transação (dentro, o PRAGMA não faz nada).
    No Postgres não é preciso: as tabelas mudam-se sem ser recriadas.
    """
    if connection.dialect.name != "sqlite":
        yield
        return
    connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
    connection.commit()
    try:
        yield
    finally:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()


engine = create_db_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
