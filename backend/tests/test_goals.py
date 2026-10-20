import pytest

from app.seed import build_sample_goals
from tests.conftest import TODAY


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_create_goal_with_plan(client, create_goal):
    goal = create_goal(
        title="  Ler 12 livros  ",
        category="aprendizagem",
        startDate="2026-01-01",
        targetDate="2026-12-31",
        progress=25,
        plan=[{"title": "Fazer lista"}, {"title": "Ler 1 livro", "done": True}],
    )

    assert goal["title"] == "Ler 12 livros"
    assert goal["startDate"] == "2026-01-01"
    assert goal["targetDate"] == "2026-12-31"
    assert goal["progress"] == 25
    assert goal["status"] == "em_curso"
    assert goal["outcome"] is None
    assert [(s["title"], s["done"], s["position"]) for s in goal["plan"]] == [
        ("Fazer lista", False, 0),
        ("Ler 1 livro", True, 1),
    ]
    assert client.get(f"/api/goals/{goal['id']}").json() == goal


def test_start_date_defaults_to_today(create_goal):
    assert create_goal()["startDate"] == TODAY.isoformat()


def test_accepts_snake_case_input(client):
    payload = {"title": "Correr", "category": "saude", "target_date": "2026-07-01"}
    response = client.post("/api/goals", json=payload)
    assert response.status_code == 201
    assert response.json()["targetDate"] == "2026-07-01"


@pytest.mark.parametrize(
    "fields",
    [
        {"title": "   "},
        {"title": "x" * 201},
        {"category": "desporto"},
        {"progress": 101},
        {"progress": -1},
        {"startDate": "2026-09-02", "targetDate": "2026-09-01"},
        {"targetDate": "2026-06-14"},  # antes de hoje, que é a data de início por omissão
    ],
)
def test_create_rejects_invalid_data(client, fields):
    payload = {"title": "Correr 10 km", "category": "saude", "targetDate": "2026-09-01"} | fields
    assert client.post("/api/goals", json=payload).status_code == 422


def test_status_depends_on_target_date_and_outcome(client, create_goal):
    ends_today = create_goal(targetDate=TODAY.isoformat())
    overdue = create_goal(startDate="2026-01-01", targetDate="2026-06-14")
    evaluated = create_goal(startDate="2026-01-01", targetDate="2026-06-01")
    client.post(f"/api/goals/{evaluated['id']}/evaluation", json={"outcome": "sucedido"})

    statuses = {g["id"]: g["status"] for g in client.get("/api/goals").json()}
    assert statuses == {
        ends_today["id"]: "em_curso",
        overdue["id"]: "por_avaliar",
        evaluated["id"]: "sucedido",
    }


def test_list_filters_and_orders_by_target_date(client, create_goal):
    later = create_goal(title="Mais tarde", targetDate="2026-12-01")
    sooner = create_goal(title="Mais cedo", targetDate="2026-07-01", category="carreira")
    overdue = create_goal(title="Atrasado", startDate="2026-01-01", targetDate="2026-06-01")

    def ids(**params):
        return [g["id"] for g in client.get("/api/goals", params=params).json()]

    assert ids() == [overdue["id"], sooner["id"], later["id"]]
    assert ids(status="em_curso") == [sooner["id"], later["id"]]
    assert ids(status="por_avaliar") == [overdue["id"]]
    assert ids(status="sucedido") == []
    assert ids(category="carreira") == [sooner["id"]]
    assert ids(status="em_curso", category="saude") == [later["id"]]
    assert client.get("/api/goals", params={"status": "outro"}).status_code == 422


def test_get_missing_goal_returns_404(client):
    response = client.get("/api/goals/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Objetivo não encontrado."


def test_update_changes_only_sent_fields(client, create_goal):
    goal = create_goal(description="Treino leve")

    response = client.patch(f"/api/goals/{goal['id']}", json={"progress": 60, "description": None})

    assert response.status_code == 200
    updated = response.json()
    assert updated["progress"] == 60
    assert updated["description"] is None
    assert updated["title"] == goal["title"]
    assert updated["targetDate"] == goal["targetDate"]


def test_update_dates(client, create_goal):
    goal = create_goal()
    url = f"/api/goals/{goal['id']}"

    updated = client.patch(url, json={"startDate": "2026-05-01", "targetDate": "2026-10-01"}).json()

    assert (updated["startDate"], updated["targetDate"]) == ("2026-05-01", "2026-10-01")
    assert client.get(url).json()["targetDate"] == "2026-10-01"


def plan_of(goal: dict) -> list[tuple]:
    return [(s["id"], s["title"], s["done"], s["position"]) for s in goal["plan"]]


def test_update_replaces_plan(client, create_goal):
    goal = create_goal(plan=[{"title": "A"}, {"title": "B"}, {"title": "C"}])
    a, b, c = (step["id"] for step in goal["plan"])
    url = f"/api/goals/{goal['id']}"

    plan = [
        {"id": c, "title": " C feito ", "done": True},
        {"title": "Novo"},
        {"id": a, "title": "A"},
    ]
    response = client.patch(url, json={"plan": plan})

    assert response.status_code == 200
    updated = response.json()
    new_id = updated["plan"][1]["id"]
    assert new_id not in (a, b, c)
    assert plan_of(updated) == [
        (c, "C feito", True, 0),
        (new_id, "Novo", False, 1),
        (a, "A", False, 2),
    ]
    assert client.get(url).json()["plan"] == updated["plan"]
    # O passo B saiu do plano, por isso foi apagado.
    assert client.patch(f"{url}/steps/{b}", json={"done": True}).status_code == 404


def test_update_with_empty_plan_removes_every_step(client, create_goal):
    goal = create_goal(plan=[{"title": "A"}, {"title": "B"}])
    assert client.patch(f"/api/goals/{goal['id']}", json={"plan": []}).json()["plan"] == []


def test_update_without_plan_keeps_it(client, create_goal):
    goal = create_goal(plan=[{"title": "A"}])
    updated = client.patch(f"/api/goals/{goal['id']}", json={"progress": 10}).json()
    assert updated["plan"] == goal["plan"]


@pytest.mark.parametrize("problem", ["other_goal", "repeated", "null", "empty_title"])
def test_update_rejects_invalid_plan_and_changes_nothing(client, create_goal, problem):
    goal = create_goal(plan=[{"title": "A"}])
    other = create_goal(plan=[{"title": "Outro"}])
    step_id, other_step_id = goal["plan"][0]["id"], other["plan"][0]["id"]
    plan = {
        "other_goal": [{"id": other_step_id, "title": "Outro"}],
        "repeated": [{"id": step_id, "title": "A"}, {"id": step_id, "title": "A outra vez"}],
        "null": None,
        "empty_title": [{"title": "  "}],
    }[problem]

    response = client.patch(f"/api/goals/{goal['id']}", json={"progress": 50, "plan": plan})

    assert response.status_code == 422
    assert client.get(f"/api/goals/{goal['id']}").json() == goal
    assert client.get(f"/api/goals/{other['id']}").json() == other


@pytest.mark.parametrize(
    "fields",
    [
        {"title": None},
        {"progress": None},
        {"progress": 150},
        {"progressFromSteps": None},
        {"targetDate": "2026-06-01"},
    ],
)
def test_update_rejects_invalid_data(client, create_goal, fields):
    goal = create_goal()
    response = client.patch(f"/api/goals/{goal['id']}", json=fields)
    assert response.status_code == 422
    assert client.get(f"/api/goals/{goal['id']}").json()["progress"] == goal["progress"]


# Progresso calculado pelos passos


def test_progress_from_steps_is_the_share_of_steps_done(client, create_goal):
    goal = create_goal(
        progress=40,
        progressFromSteps=True,
        plan=[{"title": "A", "done": True}, {"title": "B"}, {"title": "C"}],
    )

    assert goal["progressFromSteps"] is True
    assert goal["progress"] == 33
    assert client.get("/api/goals").json()[0]["progress"] == 33


def test_progress_from_steps_follows_the_steps(client, create_goal):
    goal = create_goal(progressFromSteps=True, plan=[{"title": "A"}, {"title": "B"}])
    url = f"/api/goals/{goal['id']}"
    a, b = (step["id"] for step in goal["plan"])
    assert goal["progress"] == 0

    client.patch(f"{url}/steps/{a}", json={"done": True})
    assert client.get(url).json()["progress"] == 50

    client.post(f"{url}/steps", json={"title": "C", "done": True})
    assert client.get(url).json()["progress"] == 67

    client.delete(f"{url}/steps/{b}")
    assert client.get(url).json()["progress"] == 100

    # Sem passos, fica em 0.
    assert client.patch(url, json={"plan": []}).json()["progress"] == 0


def test_progress_from_steps_rounds_half_up(create_goal):
    # 1 de 8 é 12,5%: dá 13, como o Math.round do site (o round do Python dava 12).
    plan = [{"title": f"Passo {n}", "done": n == 1} for n in range(1, 9)]
    assert create_goal(progressFromSteps=True, plan=plan)["progress"] == 13


def test_turning_off_progress_from_steps_brings_back_the_chosen_progress(client, create_goal):
    goal = create_goal(progress=40, plan=[{"title": "A", "done": True}])
    url = f"/api/goals/{goal['id']}"
    assert (goal["progressFromSteps"], goal["progress"]) == (False, 40)

    on = client.patch(url, json={"progressFromSteps": True}).json()
    assert (on["progressFromSteps"], on["progress"]) == (True, 100)
    # A percentagem enviada fica guardada, mas não aparece enquanto vier dos passos.
    assert client.patch(url, json={"progress": 70}).json()["progress"] == 100

    off = client.patch(url, json={"progressFromSteps": False}).json()
    assert (off["progressFromSteps"], off["progress"]) == (False, 70)


def test_delete_goal_also_deletes_its_plan(client, create_goal):
    goal = create_goal(plan=[{"title": "Passo"}])
    step_id = goal["plan"][0]["id"]

    assert client.delete(f"/api/goals/{goal['id']}").status_code == 204
    assert client.get(f"/api/goals/{goal['id']}").status_code == 404
    assert client.patch(f"/api/goals/{goal['id']}/steps/{step_id}", json={}).status_code == 404
    assert client.delete(f"/api/goals/{goal['id']}").status_code == 404


def test_evaluate_goal_keeps_it_in_history(client, create_goal):
    goal = create_goal(startDate="2026-01-01", targetDate="2026-06-10")

    response = client.post(
        f"/api/goals/{goal['id']}/evaluation",
        json={"outcome": "nao_sucedido", "note": "Lesão no joelho."},
    )

    assert response.status_code == 200
    evaluated = response.json()
    assert evaluated["status"] == "nao_sucedido"
    assert evaluated["outcome"] == "nao_sucedido"
    assert evaluated["outcomeNote"] == "Lesão no joelho."
    assert evaluated["closedAt"] == TODAY.isoformat()
    history = client.get("/api/goals", params={"status": "nao_sucedido"}).json()
    assert [g["id"] for g in history] == [goal["id"]]


def test_goal_can_only_be_evaluated_once(client, create_goal):
    goal = create_goal()
    url = f"/api/goals/{goal['id']}/evaluation"

    assert client.post(url, json={"outcome": "sucedido"}).status_code == 200
    response = client.post(url, json={"outcome": "nao_sucedido"})
    assert response.status_code == 409
    assert client.get(f"/api/goals/{goal['id']}").json()["outcome"] == "sucedido"


def test_evaluation_requires_valid_outcome(client, create_goal):
    goal = create_goal()
    url = f"/api/goals/{goal['id']}/evaluation"
    assert client.post(url, json={"outcome": "talvez"}).status_code == 422
    assert client.post(url, json={}).status_code == 422


def test_reopen_clears_evaluation(client, create_goal):
    goal = create_goal()
    client.post(f"/api/goals/{goal['id']}/evaluation", json={"outcome": "sucedido", "note": "Ok"})

    reopened = client.delete(f"/api/goals/{goal['id']}/evaluation").json()

    assert reopened["status"] == "em_curso"
    assert reopened["outcome"] is None
    assert reopened["outcomeNote"] is None
    assert reopened["closedAt"] is None


def test_update_changes_the_evaluation_note(client, create_goal):
    goal = create_goal()
    url = f"/api/goals/{goal['id']}"
    evaluated = client.post(f"{url}/evaluation", json={"outcome": "sucedido", "note": "Ok"}).json()

    updated = client.patch(url, json={"outcomeNote": "  Correu melhor do que esperava.  "}).json()

    assert updated["outcomeNote"] == "Correu melhor do que esperava."
    unchanged = ("outcome", "status", "closedAt", "title", "plan")
    assert {k: updated[k] for k in unchanged} == {k: evaluated[k] for k in unchanged}
    # Sem outcomeNote no pedido, a nota fica como está.
    assert client.patch(url, json={"progress": 80}).json()["outcomeNote"] == (
        "Correu melhor do que esperava."
    )


@pytest.mark.parametrize("note", [None, "", "   "])
def test_update_clears_the_evaluation_note(client, create_goal, note):
    goal = create_goal()
    url = f"/api/goals/{goal['id']}"
    client.post(f"{url}/evaluation", json={"outcome": "nao_sucedido", "note": "Ok"})

    updated = client.patch(url, json={"outcomeNote": note}).json()

    assert updated["outcomeNote"] is None
    assert updated["outcome"] == "nao_sucedido"


def test_only_evaluated_goals_have_a_note(client, create_goal):
    goal = create_goal()
    url = f"/api/goals/{goal['id']}"

    response = client.patch(url, json={"progress": 50, "outcomeNote": "Ainda não acabou."})

    assert response.status_code == 409
    assert client.get(url).json() == goal


def test_evaluation_note_has_a_maximum_length(client, create_goal):
    goal = create_goal()
    url = f"/api/goals/{goal['id']}"
    client.post(f"{url}/evaluation", json={"outcome": "sucedido", "note": "Ok"})

    assert client.patch(url, json={"outcomeNote": "x" * 2001}).status_code == 422
    assert client.get(url).json()["outcomeNote"] == "Ok"


def test_sample_goals_cover_every_status(client, user, session_factory):
    with session_factory() as session:
        session.add_all(build_sample_goals(TODAY, user.id))
        session.commit()

    statuses = {goal["status"] for goal in client.get("/api/goals").json()}
    assert statuses == {"em_curso", "por_avaliar", "sucedido", "nao_sucedido"}
