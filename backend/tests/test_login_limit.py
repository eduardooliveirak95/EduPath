from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.config import get_now
from app.main import app
from app.models import LoginFailure
from tests.conftest import TEST_PASSWORD

TOO_MANY = "Demasiadas tentativas falhadas. Espera 15 minutos e tenta outra vez."


class Clock:
    """Relógio dos testes: começa numa hora fixa e só anda quando se pede."""

    def __init__(self) -> None:
        self.now = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)

    def advance(self, **delta) -> None:
        self.now += timedelta(**delta)


@pytest.fixture
def clock(anon_client) -> Clock:
    clock = Clock()
    app.dependency_overrides[get_now] = lambda: clock.now
    return clock


def login(anon_client, email="teste@edupath.pt", password=TEST_PASSWORD):
    return anon_client.post("/api/auth/login", json={"email": email, "password": password})


def fail(anon_client, times, email="teste@edupath.pt"):
    for _ in range(times):
        assert login(anon_client, email, "password-errada").status_code == 401


def test_five_wrong_passwords_block_the_email(anon_client, user, clock):
    fail(anon_client, 5)

    # Bloqueado, nem a password certa entra.
    response = login(anon_client)
    assert response.status_code == 429
    assert response.json()["detail"] == TOO_MANY
    assert response.headers["Retry-After"] == "900"
    assert login(anon_client, password="password-errada").status_code == 429


def test_block_ends_when_the_oldest_failure_leaves_the_window(anon_client, user, clock):
    fail(anon_client, 1)
    clock.advance(minutes=5)
    fail(anon_client, 4)

    clock.advance(minutes=9)
    response = login(anon_client)
    assert (
        response.json()["detail"]
        == "Demasiadas tentativas falhadas. Espera 1 minuto e tenta outra vez."
    )
    assert response.headers["Retry-After"] == "60"

    clock.advance(minutes=1)
    assert login(anon_client).status_code == 200


def test_blocked_attempts_do_not_extend_the_block(anon_client, user, clock):
    fail(anon_client, 5)
    for _ in range(10):
        clock.advance(minutes=1)
        assert login(anon_client, password="password-errada").status_code == 429

    clock.advance(minutes=5)
    assert login(anon_client).status_code == 200


def test_signing_in_clears_the_failures(anon_client, user, clock):
    fail(anon_client, 4)
    assert login(anon_client).status_code == 200

    fail(anon_client, 4)
    assert login(anon_client).status_code == 200


def test_unknown_email_is_limited_the_same_way(anon_client, user, clock):
    """O limite não revela que emails têm conta: as respostas são iguais."""
    fail(anon_client, 5, email="ninguem@edupath.pt")

    response = login(anon_client, email="ninguem@edupath.pt")
    assert response.status_code == 429
    assert response.json()["detail"] == TOO_MANY


def test_limit_is_per_email(anon_client, user, make_user, clock):
    make_user(email="outra@edupath.pt")
    fail(anon_client, 5, email="outra@edupath.pt")

    assert login(anon_client, email="outra@edupath.pt").status_code == 429
    assert login(anon_client).status_code == 200


def test_email_is_counted_the_way_it_is_stored(anon_client, user, clock):
    for email in ["Teste@EduPath.pt", " teste@edupath.pt ", "TESTE@EDUPATH.PT", "teste@edupath.pt"]:
        fail(anon_client, 1, email=email)
    fail(anon_client, 1)

    assert login(anon_client, email="  Teste@EduPath.PT ").status_code == 429


def test_old_failures_are_deleted(anon_client, user, clock, session_factory):
    fail(anon_client, 3, email="a@edupath.pt")
    clock.advance(minutes=16)
    fail(anon_client, 1, email="b@edupath.pt")

    with session_factory() as session:
        emails = session.scalars(select(LoginFailure.email)).all()
        assert emails == ["b@edupath.pt"]
        assert session.scalar(select(func.count()).select_from(LoginFailure)) == 1
