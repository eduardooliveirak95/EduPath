from datetime import date, timedelta

from app.config import get_today
from app.main import app
from app.models import weeks_summary
from tests.conftest import TODAY, client_for

# TODAY (15 de junho de 2026) é uma segunda-feira.
MONDAY = TODAY


def set_today(day: date) -> None:
    app.dependency_overrides[get_today] = lambda: day


def days(*offsets: int) -> list[date]:
    return [MONDAY + timedelta(days=offset) for offset in offsets]


def test_weeks_go_from_monday_to_sunday():
    # Três semanas inteiras, 2 vezes por semana: a 1.ª e a 3.ª cumpridas, 5 dos 6 dias feitos.
    start, target = MONDAY, MONDAY + timedelta(days=20)
    assert weeks_summary(start, target, 2, days(0, 6, 7, 15, 16)) == (2, 3, 5, 6)
    assert weeks_summary(start, target, 2, []) == (0, 3, 0, 6)


def test_extra_days_do_not_make_up_for_another_week():
    start, target = MONDAY, MONDAY + timedelta(days=13)
    assert weeks_summary(start, target, 2, days(0, 1, 2, 3)) == (1, 2, 2, 4)


def test_incomplete_weeks_ask_only_for_the_days_they_have():
    # Começa num sábado e acaba numa terça: a 1.ª semana tem 2 dias, a última também.
    start, target = MONDAY + timedelta(days=5), MONDAY + timedelta(days=15)
    assert weeks_summary(start, target, 3, days(5, 6)).met == 1
    assert weeks_summary(start, target, 3, days(5, 6, 14, 15)) == (2, 3, 4, 7)
    # Os dias fora do objetivo não contam.
    assert weeks_summary(start, target, 1, days(0, 16)).met == 0


def recurring_goal(create_goal, **fields) -> dict:
    """Quatro semanas inteiras (de segunda a domingo), 3 vezes por semana."""
    defaults = {
        "timesPerWeek": 3,
        "startDate": MONDAY.isoformat(),
        "targetDate": (MONDAY + timedelta(days=27)).isoformat(),
    }
    return create_goal(**defaults | fields)


def test_recurring_goal_progress_counts_each_day_done(client, create_goal):
    goal = recurring_goal(create_goal, progress=50, progressFromSteps=True)
    assert (goal["timesPerWeek"], goal["checkins"], goal["weeks"]) == (
        3,
        [],
        {"met": 0, "total": 4},
    )
    assert goal["progress"] == 0  # nem a escolhida nem a dos passos
    url = f"/api/goals/{goal['id']}/checkins"
    set_today(MONDAY + timedelta(days=2))  # quarta-feira

    # Cada dia feito conta logo, mesmo sem a semana estar cumprida: 1 dos 12 pedidos dá 8%.
    first = client.put(f"{url}/{MONDAY}")
    assert first.status_code == 200, first.text
    assert (first.json()["weeks"], first.json()["progress"]) == ({"met": 0, "total": 4}, 8)
    response = client.put(f"{url}/{MONDAY + timedelta(days=1)}")
    assert (response.json()["weeks"], response.json()["progress"]) == ({"met": 0, "total": 4}, 17)
    updated = client.put(f"{url}/{MONDAY}").json()  # o mesmo dia outra vez não muda nada
    assert updated["checkins"] == [day.isoformat() for day in days(0, 1)]

    updated = client.put(f"{url}/{MONDAY + timedelta(days=2)}").json()
    assert (updated["weeks"], updated["progress"]) == ({"met": 1, "total": 4}, 25)

    updated = client.delete(f"{url}/{MONDAY + timedelta(days=1)}").json()
    assert (updated["weeks"]["met"], updated["progress"]) == (0, 17)
    assert updated["checkins"] == [day.isoformat() for day in days(0, 2)]


def test_checkins_change_the_progress_history(client, create_goal):
    goal = recurring_goal(create_goal, timesPerWeek=1)
    client.put(f"/api/goals/{goal['id']}/checkins/{MONDAY}")

    history = client.get(f"/api/goals/{goal['id']}/progress").json()
    assert [(point["day"], point["progress"]) for point in history] == [(MONDAY.isoformat(), 25)]


def test_checkins_only_between_the_start_and_today(client, create_goal):
    goal = recurring_goal(create_goal, startDate=(MONDAY - timedelta(days=7)).isoformat())
    url = f"/api/goals/{goal['id']}/checkins"

    for day in (MONDAY - timedelta(days=8), MONDAY + timedelta(days=1)):
        response = client.put(f"{url}/{day}")
        assert response.status_code == 422
        assert response.json()["detail"].startswith("Só dá para registar dias")
    assert client.put(f"{url}/{MONDAY - timedelta(days=7)}").status_code == 200
    assert client.put(f"{url}/hoje").status_code == 422


def test_checkins_only_in_recurring_goals_not_yet_evaluated(client, create_goal):
    normal = create_goal()
    response = client.put(f"/api/goals/{normal['id']}/checkins/{MONDAY}")
    assert (response.status_code, response.json()["detail"]) == (
        409,
        "Este objetivo não é recorrente.",
    )

    goal = recurring_goal(create_goal)
    client.post(f"/api/goals/{goal['id']}/evaluation", json={"outcome": "sucedido"})
    response = client.put(f"/api/goals/{goal['id']}/checkins/{MONDAY}")
    assert (response.status_code, response.json()["detail"]) == (
        409,
        "Este objetivo já foi avaliado.",
    )


def test_turning_recurrence_on_and_off(client, create_goal):
    goal = create_goal(progress=40, startDate=MONDAY.isoformat(), targetDate="2026-07-12")
    url = f"/api/goals/{goal['id']}"

    on = client.patch(url, json={"timesPerWeek": 1}).json()
    assert (on["timesPerWeek"], on["weeks"], on["progress"]) == (1, {"met": 0, "total": 4}, 0)
    client.put(f"{url}/checkins/{MONDAY}")

    off = client.patch(url, json={"timesPerWeek": None}).json()
    assert (off["timesPerWeek"], off["weeks"], off["progress"]) == (None, None, 40)
    # Os dias registados ficam guardados, para o caso de voltar a ser recorrente.
    assert off["checkins"] == [MONDAY.isoformat()]

    assert client.patch(url, json={"timesPerWeek": 8}).status_code == 422
    assert client.patch(url, json={"timesPerWeek": 0}).status_code == 422


def test_only_the_owner_registers_days(client, create_goal, make_user):
    goal = recurring_goal(create_goal)
    intruder = client_for(make_user(email="outra@edupath.pt"))

    assert intruder.put(f"/api/goals/{goal['id']}/checkins/{MONDAY}").status_code == 404
    assert intruder.delete(f"/api/goals/{goal['id']}/checkins/{MONDAY}").status_code == 404
    assert client.get(f"/api/goals/{goal['id']}").json()["checkins"] == []
