import re
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import select

from app.config import Settings, get_settings
from app.main import app
from app.models import Goal, User
from app.security import ALGORITHM, create_session
from tests.conftest import TEST_PASSWORD, TEST_SETTINGS, client_for

PUBLIC_ROUTES = {"/api/health", "/api/auth/login", "/api/auth/register"}
NEW_ACCOUNT = {
    "name": " Eduardo ",
    "email": " Eduardo@Exemplo.PT ",
    "password": "uma-password-longa",
    "inviteCode": TEST_SETTINGS.invite_code,
}


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(anon_client, **fields):
    return anon_client.post("/api/auth/register", json=NEW_ACCOUNT | fields)


def login(anon_client, email="teste@edupath.pt", password=TEST_PASSWORD):
    return anon_client.post("/api/auth/login", json={"email": email, "password": password})


def use_settings(**fields) -> None:
    settings = Settings(_env_file=None, **fields)
    app.dependency_overrides[get_settings] = lambda: settings


def test_every_data_route_requires_login(anon_client):
    """Uma rota nova fica protegida, a não ser que seja acrescentada a PUBLIC_ROUTES."""
    paths = anon_client.get("/api/openapi.json").json()["paths"]
    protected = {path: ops for path, ops in paths.items() if path not in PUBLIC_ROUTES}
    assert "/api/goals" in protected
    for path, operations in protected.items():
        for method in operations:
            response = anon_client.request(method, re.sub(r"\{\w+\}", "1", path))
            assert response.status_code == 401, f"{method} {path}"
            assert response.headers["www-authenticate"] == "Bearer"


def test_public_routes_work_without_login(anon_client):
    assert anon_client.get("/api/health").status_code == 200
    assert anon_client.get("/api/docs").status_code == 200
    assert anon_client.get("/api/openapi.json").status_code == 200


# Registo


def test_register_creates_account_and_signs_in(anon_client, session_factory):
    response = register(anon_client)

    assert response.status_code == 201
    session = response.json()
    assert session["user"] == {
        "id": session["user"]["id"],
        "name": "Eduardo",
        "email": "eduardo@exemplo.pt",
        "isAdmin": True,  # a primeira conta fica administradora
    }
    me = anon_client.get("/api/auth/me", headers=bearer(session["token"]))
    assert me.json() == session["user"]
    with session_factory() as db:
        password_hash = db.scalar(select(User.password_hash))
    assert password_hash.startswith("$argon2id$")
    assert NEW_ACCOUNT["password"] not in password_hash


def test_register_needs_the_invite_code(anon_client):
    response = register(anon_client, inviteCode="outro-código")
    assert response.status_code == 403
    assert response.json()["detail"] == "O código de convite está errado."

    use_settings(session_secret="s" * 32)  # sem INVITE_CODE, só servem os convites do site
    response = register(anon_client)
    assert response.status_code == 403
    assert response.json()["detail"] == "O código de convite está errado."
    assert register(anon_client, inviteCode="").status_code == 403


def test_old_app_password_works_as_invite_code(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "password-antiga")
    assert Settings(_env_file=None).invite_code == "password-antiga"

    monkeypatch.setenv("INVITE_CODE", "código-novo")
    assert Settings(_env_file=None).invite_code == "código-novo"


def test_config_invite_code_only_creates_the_first_account(anon_client, user):
    """Depois da primeira conta, só se entra com um convite do administrador."""
    response = register(anon_client)
    assert response.status_code == 403
    assert response.json()["detail"] == "O código de convite está errado."


def test_register_rejects_an_email_that_already_has_an_account(anon_client, admin_client, user):
    code = admin_client.post("/api/invites").json()["code"]
    response = register(anon_client, email="  TESTE@edupath.pt", inviteCode=code)
    assert response.status_code == 409
    assert response.json()["detail"] == "Já existe uma conta com este email."


@pytest.mark.parametrize(
    ("fields", "message"),
    [
        ({"password": "curta"}, "A password tem de ter pelo menos 10 caracteres."),
        ({"email": "sem-arroba.pt"}, "O email não é válido."),
        ({"email": "eu@exemplo"}, "O email não é válido."),
        ({"name": "   "}, None),
    ],
)
def test_register_validates_the_fields(anon_client, fields, message):
    response = register(anon_client, **fields)
    assert response.status_code == 422
    if message:
        assert message in response.text


def test_first_account_gets_the_goals_from_before_accounts(anon_client, session_factory):
    with session_factory() as db:
        db.add(
            Goal(
                title="Antigo",
                category="saude",
                start_date=datetime(2026, 1, 1).date(),
                target_date=datetime(2026, 12, 1).date(),
                progress=10,
            )
        )
        db.commit()

    first = register(anon_client).json()
    code = anon_client.post("/api/invites", headers=bearer(first["token"])).json()["code"]
    second = register(anon_client, email="outra@exemplo.pt", inviteCode=code).json()

    assert (first["user"]["isAdmin"], second["user"]["isAdmin"]) == (True, False)

    first_goals = anon_client.get("/api/goals", headers=bearer(first["token"])).json()
    assert [goal["title"] for goal in first_goals] == ["Antigo"]
    assert anon_client.get("/api/goals", headers=bearer(second["token"])).json() == []


# Entrar


def test_login_with_email_and_password(anon_client, user):
    response = login(anon_client, email="  Teste@EduPath.pt ")
    assert response.status_code == 200
    session = response.json()
    assert session["user"]["email"] == "teste@edupath.pt"
    expires_at = datetime.fromisoformat(session["expiresAt"])
    assert timedelta(days=29) < expires_at - datetime.now(UTC) <= timedelta(days=30)
    assert anon_client.get("/api/goals", headers=bearer(session["token"])).status_code == 200


@pytest.mark.parametrize(
    ("email", "password"),
    [("teste@edupath.pt", "outra-password"), ("ninguem@edupath.pt", TEST_PASSWORD)],
)
def test_wrong_password_and_unknown_email_get_the_same_answer(anon_client, user, email, password):
    response = login(anon_client, email, password)
    assert response.status_code == 401
    assert response.json()["detail"] == "Email ou password errados."


def test_accounts_need_a_long_session_secret(anon_client, user):
    token = create_session(user, TEST_SETTINGS, datetime.now(UTC)).token
    use_settings(session_secret="curto", invite_code="convite-de-teste")

    response = login(anon_client)
    assert response.status_code == 503
    assert "SESSION_SECRET" in response.json()["detail"]
    assert register(anon_client).status_code == 503
    assert anon_client.get("/api/goals", headers=bearer(token)).status_code == 401


# Tokens


def test_expired_token_is_rejected(anon_client, user):
    started = datetime.now(UTC) - timedelta(days=TEST_SETTINGS.session_days, seconds=1)
    token = create_session(user, TEST_SETTINGS, started).token
    assert anon_client.get("/api/goals", headers=bearer(token)).status_code == 401


@pytest.mark.parametrize("token", ["", "abc", "a.b.c"])
def test_malformed_token_is_rejected(anon_client, token):
    assert anon_client.get("/api/goals", headers=bearer(token)).status_code == 401


@pytest.mark.parametrize(
    "claims",
    [
        {"sub": "1", "pwd": "x"},  # sem validade
        {"pwd": "x", "exp": 9999999999},  # sem conta
        {"sub": "abc", "pwd": "x", "exp": 9999999999},
    ],
)
def test_token_with_missing_or_bad_claims_is_rejected(anon_client, user, claims):
    token = jwt.encode(claims, TEST_SETTINGS.session_secret, ALGORITHM)
    assert anon_client.get("/api/goals", headers=bearer(token)).status_code == 401


def test_token_signed_with_another_secret_is_rejected(anon_client, user):
    other = TEST_SETTINGS.model_copy(update={"session_secret": "n" * 32})
    token = create_session(user, other, datetime.now(UTC)).token
    assert anon_client.get("/api/goals", headers=bearer(token)).status_code == 401


def test_token_of_a_deleted_account_is_rejected(anon_client, user, session_factory):
    token = create_session(user, TEST_SETTINGS, datetime.now(UTC)).token
    with session_factory() as db:
        db.delete(db.get(User, user.id))
        db.commit()
    assert anon_client.get("/api/goals", headers=bearer(token)).status_code == 401


def test_refresh_returns_a_later_token(anon_client, user):
    old = create_session(user, TEST_SETTINGS, datetime.now(UTC) - timedelta(days=10))

    response = anon_client.post("/api/auth/refresh", headers=bearer(old.token))
    assert response.status_code == 200
    new = response.json()
    assert datetime.fromisoformat(new["expiresAt"]) > old.expires_at
    assert new["user"]["id"] == user.id
    assert anon_client.get("/api/goals", headers=bearer(new["token"])).status_code == 200


# Perfil e password


def test_change_name(client):
    response = client.patch("/api/auth/me", json={"name": "  Novo nome "})
    assert response.status_code == 200
    assert response.json()["name"] == "Novo nome"
    assert client.get("/api/auth/me").json()["name"] == "Novo nome"
    assert client.patch("/api/auth/me", json={"name": " "}).status_code == 422


def test_change_password_ends_the_other_sessions(anon_client, user):
    this_device, other_device = client_for(user), client_for(user)

    response = this_device.post(
        "/api/auth/password",
        json={"currentPassword": TEST_PASSWORD, "newPassword": "password-nova-123"},
    )

    assert response.status_code == 200
    new_token = response.json()["token"]
    assert other_device.get("/api/goals").status_code == 401
    assert this_device.get("/api/goals").status_code == 401  # o token antigo também
    assert anon_client.get("/api/goals", headers=bearer(new_token)).status_code == 200
    assert login(anon_client, password=TEST_PASSWORD).status_code == 401
    assert login(anon_client, password="password-nova-123").status_code == 200


def test_change_password_checks_the_current_one(client):
    response = client.post(
        "/api/auth/password",
        json={"currentPassword": "errada", "newPassword": "password-nova-123"},
    )
    # 403 e não 401, para o frontend não terminar a sessão.
    assert response.status_code == 403
    assert response.json()["detail"] == "A password atual está errada."
    short = {"currentPassword": TEST_PASSWORD, "newPassword": "curta"}
    assert client.post("/api/auth/password", json=short).status_code == 422
    assert client.get("/api/goals").status_code == 200


# Apagar a própria conta


def test_delete_own_account_with_everything_in_it(
    client, user, create_goal, admin_client, session_factory
):
    create_goal(plan=[{"title": "Passo"}])
    other_device = client_for(user)

    response = client.request("DELETE", "/api/auth/me", json={"password": TEST_PASSWORD})

    assert response.status_code == 204
    assert client.get("/api/goals").status_code == 401
    assert other_device.get("/api/goals").status_code == 401
    assert [a["name"] for a in admin_client.get("/api/admin/users").json()] == ["Admin"]
    with session_factory() as db:
        assert db.scalars(select(Goal)).all() == []  # os passos vão com os objetivos (CASCADE)
    # O email fica livre: dá para voltar a criar uma conta com ele (com um convite novo).
    code = admin_client.post("/api/invites").json()["code"]
    again = {"name": "Outra vez", "email": user.email, "password": "uma-password-longa"}
    assert client.post("/api/auth/register", json=again | {"inviteCode": code}).status_code == 201


def test_delete_own_account_needs_the_password(client, create_goal):
    create_goal()

    response = client.request("DELETE", "/api/auth/me", json={"password": "errada"})

    # 403 e não 401, para o frontend não terminar a sessão.
    assert response.status_code == 403
    assert response.json()["detail"] == "A password está errada."
    assert client.request("DELETE", "/api/auth/me").status_code == 422
    assert len(client.get("/api/goals").json()) == 1


def test_admin_cannot_delete_own_account(admin_client):
    response = admin_client.request("DELETE", "/api/auth/me", json={"password": TEST_PASSWORD})

    assert response.status_code == 409
    assert response.json()["detail"] == "A conta do administrador não pode ser apagada."
    assert admin_client.get("/api/auth/me").status_code == 200


# Cada conta só vê os seus objetivos


def test_accounts_only_see_their_own_goals(client, create_goal, make_user):
    goal = create_goal(plan=[{"title": "Passo"}])
    step_id = goal["plan"][0]["id"]
    intruder = client_for(make_user(email="outra@edupath.pt"))
    url = f"/api/goals/{goal['id']}"

    assert intruder.get("/api/goals").json() == []
    assert intruder.get(url).status_code == 404
    assert intruder.patch(url, json={"progress": 99}).status_code == 404
    assert intruder.post(f"{url}/evaluation", json={"outcome": "sucedido"}).status_code == 404
    assert intruder.delete(f"{url}/evaluation").status_code == 404
    assert intruder.post(f"{url}/steps", json={"title": "Intruso"}).status_code == 404
    assert intruder.patch(f"{url}/steps/{step_id}", json={"done": True}).status_code == 404
    assert intruder.delete(f"{url}/steps/{step_id}").status_code == 404
    assert intruder.delete(url).status_code == 404

    assert client.get(url).json() == goal


def test_plan_cannot_take_steps_from_another_account(client, create_goal, make_user):
    mine = create_goal(plan=[{"title": "Meu"}])
    intruder = client_for(make_user(email="outra@edupath.pt"))
    theirs = intruder.post(
        "/api/goals",
        json={
            "title": "Dele",
            "category": "saude",
            "targetDate": "2026-09-01",
            "plan": [{"title": "Dele"}],
        },
    ).json()

    plan = [{"id": theirs["plan"][0]["id"], "title": "Roubado"}]
    assert client.patch(f"/api/goals/{mine['id']}", json={"plan": plan}).status_code == 422
    assert intruder.get(f"/api/goals/{theirs['id']}").json() == theirs
