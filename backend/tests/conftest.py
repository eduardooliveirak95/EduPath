import os
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings, get_today
from app.database import Base, create_db_engine, get_session
from app.main import app
from app.models import User
from app.security import create_session, hash_password

TODAY = date(2026, 6, 15)

# Sem ler o .env local: os testes não dependem da configuração de quem os corre.
TEST_SETTINGS = Settings(_env_file=None, session_secret="s" * 32, invite_code="convite-de-teste")

# O hash Argon2 é lento de propósito: calcula-se uma vez para todas as contas de teste.
TEST_PASSWORD = "password-de-teste"
TEST_PASSWORD_HASH = hash_password(TEST_PASSWORD)


# Por omissão, SQLite em memória. Para testar com Postgres:
# TEST_DATABASE_URL=postgresql://utilizador@localhost/edupath_test uv run pytest
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite://")


@pytest.fixture
def session_factory() -> Iterator[sessionmaker[Session]]:
    """Base de dados vazia em cada teste."""
    if TEST_DATABASE_URL.startswith("sqlite"):
        engine = create_db_engine(TEST_DATABASE_URL, poolclass=StaticPool)
    else:
        engine = create_db_engine(TEST_DATABASE_URL)
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def anon_client(session_factory: sessionmaker[Session]) -> Iterator[TestClient]:
    """Cliente sem sessão iniciada."""

    def session_override() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_today] = lambda: TODAY
    app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
    # Sem `with`, o TestClient não corre o lifespan (que usaria a base de dados real).
    yield TestClient(app)
    app.dependency_overrides.clear()


def client_for(user: User) -> TestClient:
    """Cliente com sessão iniciada na conta (precisa da fixture anon_client ativa)."""
    token = create_session(user, TEST_SETTINGS, datetime.now(UTC)).token
    return TestClient(app, headers={"Authorization": f"Bearer {token}"})


@pytest.fixture
def make_user(session_factory: sessionmaker[Session]) -> Callable[..., User]:
    """Cria uma conta diretamente na BD, com a password TEST_PASSWORD."""

    def _make(email: str = "teste@edupath.pt", name: str = "Teste", is_admin: bool = False) -> User:
        with session_factory() as session:
            user = User(name=name, email=email, password_hash=TEST_PASSWORD_HASH, is_admin=is_admin)
            session.add(user)
            session.commit()
            return user

    return _make


@pytest.fixture
def user(make_user: Callable[..., User]) -> User:
    return make_user()


@pytest.fixture
def client(anon_client: TestClient, user: User) -> TestClient:
    """Cliente com sessão iniciada na conta `user` (o que a maioria dos testes precisa)."""
    return client_for(user)


@pytest.fixture
def admin(make_user: Callable[..., User]) -> User:
    """A conta do administrador (a única que cria convites)."""
    return make_user(email="admin@edupath.pt", name="Admin", is_admin=True)


@pytest.fixture
def admin_client(anon_client: TestClient, admin: User) -> TestClient:
    return client_for(admin)


@pytest.fixture
def create_goal(client: TestClient):
    def _create(**fields) -> dict:
        payload = {"title": "Correr 10 km", "category": "saude", "targetDate": "2026-09-01"}
        response = client.post("/api/goals", json=payload | fields)
        assert response.status_code == 201, response.text
        return response.json()

    return _create
