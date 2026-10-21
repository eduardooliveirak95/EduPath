import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.config import get_today
from app.main import app
from app.models import ProgressEntry
from tests.conftest import TEST_DATABASE_URL, TODAY, client_for


def set_today(day) -> None:
    app.dependency_overrides[get_today] = lambda: day


def history(client, goal: dict) -> list[tuple[str, int]]:
    response = client.get(f"/api/goals/{goal['id']}/progress")
    assert response.status_code == 200, response.text
    return [(point["day"], point["progress"]) for point in response.json()]


def day(offset: int) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


def test_new_goal_starts_with_its_progress(client, create_goal):
    goal = create_goal(progress=20)
    assert history(client, goal) == [(day(0), 20)]


def test_one_entry_per_day_with_the_last_value(client, create_goal):
    goal = create_goal(progress=20)
    url = f"/api/goals/{goal['id']}"

    client.patch(url, json={"progress": 30})
    client.patch(url, json={"progress": 40})
    assert history(client, goal) == [(day(0), 40)]

    set_today(TODAY + timedelta(days=3))
    client.patch(url, json={"progress": 55})
    client.patch(url, json={"title": "Outro título"})  # não mexe no progresso
    assert history(client, goal) == [(day(0), 40), (day(3), 55)]

    # Voltar no mesmo dia ao valor anterior tira o registo desse dia.
    client.patch(url, json={"progress": 40})
    assert history(client, goal) == [(day(0), 40)]


def test_unchanged_progress_is_not_recorded(client, create_goal):
    goal = create_goal(progress=20, plan=[{"title": "A"}])
    url = f"/api/goals/{goal['id']}"
    set_today(TODAY + timedelta(days=1))

    client.patch(url, json={"progress": 20, "description": "Igual"})
    client.patch(f"{url}/steps/{goal['plan'][0]['id']}", json={"done": True})  # progresso à mão
    client.post(f"{url}/steps", json={"title": "B"})

    assert history(client, goal) == [(day(0), 20)]


def test_steps_change_the_progress_from_steps(client, create_goal):
    goal = create_goal(progressFromSteps=True, plan=[{"title": "A"}, {"title": "B"}])
    url = f"/api/goals/{goal['id']}"
    a, b = (step["id"] for step in goal["plan"])

    set_today(TODAY + timedelta(days=1))
    client.patch(f"{url}/steps/{a}", json={"done": True})
    set_today(TODAY + timedelta(days=2))
    client.post(f"{url}/steps", json={"title": "C", "done": True})
    set_today(TODAY + timedelta(days=4))
    client.delete(f"{url}/steps/{b}")
    set_today(TODAY + timedelta(days=5))
    client.patch(url, json={"progressFromSteps": False, "progress": 30})

    assert history(client, goal) == [
        (day(0), 0),
        (day(1), 50),
        (day(2), 67),
        (day(4), 100),
        (day(5), 30),
    ]
    # O último registo é sempre o que o objetivo mostra.
    assert client.get(url).json()["progress"] == 30


def test_only_the_owner_sees_the_history(client, create_goal, make_user):
    goal = create_goal()
    intruder = client_for(make_user(email="outra@edupath.pt"))

    assert intruder.get(f"/api/goals/{goal['id']}/progress").status_code == 404
    assert client.get("/api/goals/999/progress").status_code == 404


def test_deleting_the_goal_deletes_its_history(client, create_goal, session_factory):
    goal = create_goal(progress=10)
    client.patch(f"/api/goals/{goal['id']}", json={"progress": 20})

    assert client.delete(f"/api/goals/{goal['id']}").status_code == 204

    with session_factory() as db:
        assert db.scalars(select(ProgressEntry)).all() == []


def mark_at_the_same_time(user, url: str, steps: list[dict]) -> list[int]:
    """Marca os passos como feitos, cada um num pedido, todos ao mesmo tempo."""
    barrier = threading.Barrier(len(steps))

    def mark(step: dict) -> int:
        device = client_for(user)
        barrier.wait()
        return device.patch(f"{url}/steps/{step['id']}", json={"done": True}).status_code

    with ThreadPoolExecutor(len(steps)) as pool:
        return list(pool.map(mark, steps))


@pytest.mark.skipif(
    TEST_DATABASE_URL.startswith("sqlite"), reason="só o Postgres corre os pedidos em paralelo"
)
def test_steps_marked_at_the_same_time_keep_the_history_right(client, user, create_goal):
    """Dois passos marcados ao mesmo tempo, num dia ainda sem registo: sem o bloqueio do
    objetivo, os dois pedidos tentavam criar o registo do dia (um falhava) ou o último a
    gravar deixava um valor que não contava com o passo do outro."""
    for attempt in range(10):
        set_today(TODAY)
        goal = create_goal(progressFromSteps=True, plan=[{"title": "A"}, {"title": "B"}])
        set_today(TODAY + timedelta(days=1))

        codes = mark_at_the_same_time(user, f"/api/goals/{goal['id']}", goal["plan"])

        assert codes == [200, 200], f"tentativa {attempt}"
        assert history(client, goal) == [(day(0), 0), (day(1), 100)], f"tentativa {attempt}"
