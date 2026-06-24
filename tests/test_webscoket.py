def test_websocket_receives_initial_snapshot(client, auth_headers):
    poll = client.post(
        "/polls", json={"question": "WS test", "options": ["A", "B"]}, headers=auth_headers
    ).json()

    with client.websocket_connect(f"/ws/polls/{poll['id']}") as websocket:
        data = websocket.receive_json()
        assert data["id"] == poll["id"]
        assert data["options"][0]["vote_count"] == 0


def test_websocket_receives_broadcast_on_vote(client, auth_headers):
    poll = client.post(
        "/polls", json={"question": "Broadcast test", "options": ["A", "B"]}, headers=auth_headers
    ).json()
    option_id = poll["options"][0]["id"]

    with client.websocket_connect(f"/ws/polls/{poll['id']}") as websocket:
        websocket.receive_json()  # discard initial snapshot

        client.post(
            f"/polls/{poll['id']}/votes", json={"option_id": option_id}, headers=auth_headers
        )

        update = websocket.receive_json()
        voted_option = next(o for o in update["options"] if o["id"] == option_id)
        assert voted_option["vote_count"] == 1