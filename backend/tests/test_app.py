import pytest

from app.config import Settings, ensure_persistent_database
from app.database import normalize_database_url


def test_root_redirects_to_docs(client):
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/api/docs"


def test_docs_live_under_api(client):
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/openapi.json").json()["info"]["title"] == "EduPath API"
    assert client.get("/docs").status_code == 404


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (
            "postgres://u:p@host/db?sslmode=require",
            "postgresql+psycopg://u:p@host/db?sslmode=require",
        ),
        ("postgresql://u@host/db", "postgresql+psycopg://u@host/db"),
        ("postgresql+psycopg://u@host/db", "postgresql+psycopg://u@host/db"),
        ("sqlite:///./edupath.db", "sqlite:///./edupath.db"),
    ],
)
def test_normalize_database_url(url, expected):
    assert normalize_database_url(url) == expected


def test_sqlite_is_rejected_on_vercel():
    sqlite = Settings(database_url="sqlite:///./edupath.db")
    postgres = Settings(database_url="postgresql://u@host/db")

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        ensure_persistent_database(sqlite, {"VERCEL": "1"})
    ensure_persistent_database(sqlite, {})
    ensure_persistent_database(postgres, {"VERCEL": "1"})
