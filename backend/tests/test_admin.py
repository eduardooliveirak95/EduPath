import re
from datetime import datetime

from sqlalchemy import text

from tests.conftest import TEST_PASSWORD


def test_admin_sees_the_accounts_and_nothing_of_their_goals(admin_client, client, create_goal):
    create_goal(title="Privado")  # objetivo da conta `user`

    response = admin_client.get("/api/admin/users")

    assert response.status_code == 200
    accounts = response.json()
    assert [(a["name"], a["email"], a["isAdmin"]) for a in accounts] == [
        ("Admin", "admin@edupath.pt", True),
        ("Teste", "teste@edupath.pt", False),
    ]
    # Só os dados da conta: nada sobre os objetivos (nem quantos são).
    assert set(accounts[0]) == {"id", "name", "email", "isAdmin", "createdAt"}
    assert "Privado" not in response.text
    datetime.fromisoformat(accounts[0]["createdAt"])


def test_other_accounts_cannot_see_the_admin_page(client):
    response = client.get("/api/admin/users")
    assert response.status_code == 403
    assert response.json()["detail"] == "Só o administrador pode fazer isto."


def test_session_says_whether_the_account_is_admin(admin_client, client):
    assert admin_client.get("/api/auth/me").json()["isAdmin"] is True
    assert client.get("/api/auth/me").json()["isAdmin"] is False


def test_admin_removes_an_account_and_everything_in_it(
    admin_client, client, user, create_goal, anon_client, session_factory
):
    create_goal(plan=[{"title": "Passo"}])
    code = admin_client.post("/api/invites").json()["code"]
    anon_client.post(
        "/api/auth/register",
        json={
            "name": "Ana",
            "email": "ana@x.pt",
            "password": "uma-password-longa",
            "inviteCode": code,
        },
    )
    ana = next(a for a in admin_client.get("/api/admin/users").json() if a["name"] == "Ana")

    assert admin_client.delete(f"/api/admin/users/{user.id}").status_code == 204
    assert admin_client.delete(f"/api/admin/users/{ana['id']}").status_code == 204

    assert [a["name"] for a in admin_client.get("/api/admin/users").json()] == ["Admin"]
    assert client.get("/api/goals").status_code == 401  # a sessão da conta apagada terminou
    with session_factory() as db:
        for table in ("goals", "plan_steps"):
            assert db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar() == 0
    # O convite que a Ana usou fica na lista, sem o nome.
    [invite] = admin_client.get("/api/invites").json()
    assert (invite["status"], invite["usedBy"]) == ("usado", None)


def test_admin_account_cannot_be_removed(admin_client, admin, make_user):
    other_admin = make_user(email="outro@edupath.pt", is_admin=True)
    for account in (admin, other_admin):
        response = admin_client.delete(f"/api/admin/users/{account.id}")
        assert response.status_code == 409
        assert response.json()["detail"] == "Não dá para remover a conta de um administrador."
    assert admin_client.delete("/api/admin/users/999").status_code == 404


def test_other_accounts_cannot_remove_accounts(client, admin):
    response = client.delete(f"/api/admin/users/{admin.id}")
    assert response.status_code == 403


def login(anon_client, password, email="teste@edupath.pt"):
    return anon_client.post("/api/auth/login", json={"email": email, "password": password})


def test_admin_gives_an_account_a_new_password(admin_client, client, user, anon_client):
    response = admin_client.post(f"/api/admin/users/{user.id}/password")

    assert response.status_code == 200
    password = response.json()["password"]
    assert re.fullmatch(r"[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}", password)
    assert login(anon_client, TEST_PASSWORD).status_code == 401  # a antiga deixou de servir
    assert login(anon_client, password).status_code == 200
    assert client.get("/api/goals").status_code == 401  # a sessão que estava aberta terminou


def test_each_new_password_is_different(admin_client, user):
    url = f"/api/admin/users/{user.id}/password"
    passwords = {admin_client.post(url).json()["password"] for _ in range(5)}
    assert len(passwords) == 5


def test_new_password_unblocks_the_login(admin_client, user, anon_client):
    for _ in range(5):
        login(anon_client, "password-errada")
    assert login(anon_client, TEST_PASSWORD).status_code == 429

    password = admin_client.post(f"/api/admin/users/{user.id}/password").json()["password"]

    assert login(anon_client, password).status_code == 200


def test_new_password_only_for_accounts_that_are_not_admin(admin_client, admin, anon_client):
    response = admin_client.post(f"/api/admin/users/{admin.id}/password")
    assert response.status_code == 409
    assert login(anon_client, TEST_PASSWORD, email="admin@edupath.pt").status_code == 200
    assert admin_client.post("/api/admin/users/999/password").status_code == 404


def test_only_the_admin_gives_new_passwords(client, make_user, anon_client):
    other = make_user(email="outra@edupath.pt")
    assert client.post(f"/api/admin/users/{other.id}/password").status_code == 403
    assert login(anon_client, TEST_PASSWORD, email="outra@edupath.pt").status_code == 200
