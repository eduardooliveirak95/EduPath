import re
from datetime import timedelta

import pytest

from app.config import Settings, get_settings, get_today
from app.invite_codes import ALPHABET
from app.main import app
from app.models import Invite
from app.routers.invites import INVITE_DAYS, MAX_PENDING_INVITES
from tests.conftest import TEST_SETTINGS, TODAY

CODE_PATTERN = re.compile(rf"^[{ALPHABET}]{{4}}-[{ALPHABET}]{{4}}-[{ALPHABET}]{{4}}$")
NEW_ACCOUNT = {"name": "Ana", "email": "ana@exemplo.pt", "password": "uma-password-longa"}


def register(anon_client, code, **fields):
    account = NEW_ACCOUNT | {"inviteCode": code} | fields
    return anon_client.post("/api/auth/register", json=account)


def set_today(day) -> None:
    app.dependency_overrides[get_today] = lambda: day


@pytest.fixture
def invite(admin_client) -> dict:
    response = admin_client.post("/api/invites")
    assert response.status_code == 201, response.text
    return response.json()


def test_create_invite(admin_client, invite):
    assert CODE_PATTERN.match(invite["code"])
    assert invite == {
        "id": invite["id"],
        "code": invite["code"],
        "status": "por_usar",
        "expiresOn": (TODAY + timedelta(days=INVITE_DAYS)).isoformat(),
        "usedOn": None,
        "usedBy": None,
    }
    assert admin_client.get("/api/invites").json() == [invite]


def test_each_invite_has_its_own_code(admin_client, invite):
    other = admin_client.post("/api/invites").json()
    assert other["code"] != invite["code"]
    assert [item["id"] for item in admin_client.get("/api/invites").json()] == [
        other["id"],
        invite["id"],
    ]


def test_register_with_an_invite(admin_client, anon_client, invite):
    # Sem INVITE_CODE na configuração, os convites do site continuam a servir.
    settings = Settings(_env_file=None, session_secret=TEST_SETTINGS.session_secret)
    app.dependency_overrides[get_settings] = lambda: settings

    response = register(anon_client, invite["code"])

    assert response.status_code == 201, response.text
    assert response.json()["user"]["name"] == "Ana"
    [used] = admin_client.get("/api/invites").json()
    assert (used["status"], used["usedOn"], used["usedBy"]) == ("usado", TODAY.isoformat(), "Ana")


@pytest.mark.parametrize("variant", [str.lower, lambda code: code.replace("-", " "), str.strip])
def test_invite_code_is_accepted_however_it_is_typed(anon_client, invite, variant):
    code = variant(f"  {invite['code']} ")
    assert register(anon_client, code).status_code == 201


def test_invite_only_works_once(anon_client, invite):
    assert register(anon_client, invite["code"]).status_code == 201

    response = register(anon_client, invite["code"], email="outra@exemplo.pt")
    assert response.status_code == 403
    assert response.json()["detail"] == "Este convite já foi usado. Pede um convite novo."


def test_invite_expires_after_its_last_day(admin_client, anon_client, invite):
    set_today(TODAY + timedelta(days=INVITE_DAYS + 1))
    response = register(anon_client, invite["code"])
    assert response.status_code == 403
    assert response.json()["detail"] == "Este convite expirou. Pede um convite novo."
    assert admin_client.get("/api/invites").json()[0]["status"] == "expirado"

    set_today(TODAY + timedelta(days=INVITE_DAYS))  # o último dia ainda serve
    assert register(anon_client, invite["code"]).status_code == 201


def test_failed_registration_does_not_use_up_the_invite(admin_client, anon_client, invite):
    response = register(anon_client, invite["code"], email="admin@edupath.pt")  # já tem conta
    assert response.status_code == 409
    assert admin_client.get("/api/invites").json() == [invite]


def test_cancel_an_invite(admin_client, anon_client, invite):
    assert admin_client.delete(f"/api/invites/{invite['id']}").status_code == 204
    assert admin_client.get("/api/invites").json() == []
    assert register(anon_client, invite["code"]).status_code == 403


def test_only_the_admin_can_invite(admin, client):
    """As outras contas não veem, não criam nem cancelam convites."""
    for method, path in [
        ("GET", "/api/invites"),
        ("POST", "/api/invites"),
        ("DELETE", "/api/invites/1"),
    ]:
        response = client.request(method, path)
        assert response.status_code == 403, f"{method} {path}"
        assert response.json()["detail"] == "Só o administrador pode fazer isto."


def test_invite_created_by_another_account_no_longer_works(anon_client, user, session_factory):
    # Convite de uma conta que não é administradora (criado antes de só o administrador convidar).
    with session_factory() as db:
        db.add(Invite(code="ABCD2345EFGH", created_by_id=user.id, expires_on=TODAY))
        db.commit()

    response = register(anon_client, "ABCD-2345-EFGH")
    assert response.status_code == 403
    assert response.json()["detail"] == "Este convite já não é válido. Pede um convite novo."


def test_limit_of_invites_waiting_to_be_used(admin_client):
    for _ in range(MAX_PENDING_INVITES):
        assert admin_client.post("/api/invites").status_code == 201

    response = admin_client.post("/api/invites")
    assert response.status_code == 409
    assert "Cancela algum" in response.json()["detail"]

    # Os que expiraram já não contam.
    set_today(TODAY + timedelta(days=INVITE_DAYS + 1))
    assert admin_client.post("/api/invites").status_code == 201
