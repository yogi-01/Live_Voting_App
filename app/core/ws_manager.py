from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, poll_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(poll_id, []).append(websocket)

    def disconnect(self, poll_id: int, websocket: WebSocket):
        if poll_id in self.active_connections:
            self.active_connections[poll_id].remove(websocket)
            if not self.active_connections[poll_id]:
                del self.active_connections[poll_id]

    async def broadcast(self, poll_id: int, message: dict):
        for connection in self.active_connections.get(poll_id, []):
            await connection.send_json(message)


manager = ConnectionManager()