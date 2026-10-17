def test_add_step_goes_to_the_end_of_the_plan(client, create_goal):
    goal = create_goal(plan=[{"title": "Primeiro"}, {"title": "Segundo"}])

    response = client.post(f"/api/goals/{goal['id']}/steps", json={"title": "Terceiro"})

    assert response.status_code == 201
    assert response.json()["position"] == 2
    assert response.json()["done"] is False
    plan = client.get(f"/api/goals/{goal['id']}").json()["plan"]
    assert [step["title"] for step in plan] == ["Primeiro", "Segundo", "Terceiro"]


def test_add_step_to_missing_goal_returns_404(client):
    assert client.post("/api/goals/999/steps", json={"title": "Passo"}).status_code == 404


def test_add_step_rejects_empty_title(client, create_goal):
    goal = create_goal()
    assert client.post(f"/api/goals/{goal['id']}/steps", json={"title": " "}).status_code == 422


def test_mark_step_as_done_and_rename(client, create_goal):
    goal = create_goal(plan=[{"title": "Comprar ténis"}])
    url = f"/api/goals/{goal['id']}/steps/{goal['plan'][0]['id']}"

    assert client.patch(url, json={"done": True}).json()["done"] is True
    renamed = client.patch(url, json={"title": "Comprar ténis de corrida"}).json()

    assert renamed == {**goal["plan"][0], "title": "Comprar ténis de corrida", "done": True}
    assert client.patch(url, json={"done": None}).status_code == 422


def test_delete_step(client, create_goal):
    goal = create_goal(plan=[{"title": "Fica"}, {"title": "Sai"}])
    url = f"/api/goals/{goal['id']}/steps/{goal['plan'][1]['id']}"

    assert client.delete(url).status_code == 204
    assert client.delete(url).status_code == 404
    plan = client.get(f"/api/goals/{goal['id']}").json()["plan"]
    assert [step["title"] for step in plan] == ["Fica"]


def test_step_must_belong_to_the_goal(client, create_goal):
    goal = create_goal(plan=[{"title": "Passo"}])
    other = create_goal(title="Outro")
    url = f"/api/goals/{other['id']}/steps/{goal['plan'][0]['id']}"

    assert client.patch(url, json={"done": True}).status_code == 404
    assert client.delete(url).status_code == 404
