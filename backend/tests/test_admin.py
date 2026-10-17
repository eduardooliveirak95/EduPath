from datetime import datetime


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
