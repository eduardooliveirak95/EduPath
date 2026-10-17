from datetime import datetime

from sqlalchemy import text


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
