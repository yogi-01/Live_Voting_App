def test_create_poll_success(client, auth_headers):
    response = client.post(
        "/polls",
        json={"question": "Best season?", "options": ["Summer", "Winter"]},
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["question"] == "Best season?"
    assert len(data["options"]) == 2
    assert all(opt["vote_count"] == 0 for opt in data["options"])


def test_create_poll_requires_auth(client):
    response = client.post(
        "/polls", json={"question": "No auth", "options": ["A", "B"]}
    )
    assert response.status_code in (401, 403)


def test_poll_requires_at_least_two_options(client, auth_headers):
    response = client.post(
        "/polls", json={"question": "Only one?", "options": ["Solo"]}, headers=auth_headers
    )
    assert response.status_code == 422


def test_poll_rejects_more_than_four_options(client, auth_headers):
    response = client.post(
        "/polls",
        json={"question": "Too many", "options": ["A", "B", "C", "D", "E"]},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_cast_vote_success(client, auth_headers):
    poll = client.post(
        "/polls", json={"question": "Vote test", "options": ["A", "B"]}, headers=auth_headers
    ).json()
    option_id = poll["options"][0]["id"]

    response = client.post(
        f"/polls/{poll['id']}/votes", json={"option_id": option_id}, headers=auth_headers
    )

    assert response.status_code == 201

    updated = client.get(f"/polls/{poll['id']}").json()
    voted_option = next(o for o in updated["options"] if o["id"] == option_id)
    assert voted_option["vote_count"] == 1


def test_cannot_vote_twice_on_same_poll(client, auth_headers):
    poll = client.post(
        "/polls", json={"question": "Double vote?", "options": ["A", "B"]}, headers=auth_headers
    ).json()
    option_id = poll["options"][0]["id"]

    client.post(f"/polls/{poll['id']}/votes", json={"option_id": option_id}, headers=auth_headers)
    second_attempt = client.post(
        f"/polls/{poll['id']}/votes", json={"option_id": option_id}, headers=auth_headers
    )

    assert second_attempt.status_code == 400


def test_different_users_can_each_vote_once(client, auth_headers, other_auth_headers):
    poll = client.post(
        "/polls", json={"question": "Two voters", "options": ["A", "B"]}, headers=auth_headers
    ).json()
    option_id = poll["options"][0]["id"]

    r1 = client.post(f"/polls/{poll['id']}/votes", json={"option_id": option_id}, headers=auth_headers)
    r2 = client.post(f"/polls/{poll['id']}/votes", json={"option_id": option_id}, headers=other_auth_headers)

    assert r1.status_code == 201
    assert r2.status_code == 201

    updated = client.get(f"/polls/{poll['id']}").json()
    voted_option = next(o for o in updated["options"] if o["id"] == option_id)
    assert voted_option["vote_count"] == 2


def test_vote_for_option_from_different_poll_fails(client, auth_headers):
    poll1 = client.post(
        "/polls", json={"question": "Poll 1", "options": ["A", "B"]}, headers=auth_headers
    ).json()
    poll2 = client.post(
        "/polls", json={"question": "Poll 2", "options": ["C", "D"]}, headers=auth_headers
    ).json()

    wrong_option_id = poll2["options"][0]["id"]

    response = client.post(
        f"/polls/{poll1['id']}/votes", json={"option_id": wrong_option_id}, headers=auth_headers
    )

    assert response.status_code == 404