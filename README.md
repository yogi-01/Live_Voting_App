# Live Voting App

A real-time polling application where votes update instantly for every connected viewer — no refresh, no polling. Built with FastAPI (WebSockets), PostgreSQL, and a React/TypeScript frontend.

## Features

- **Authentication** — Email/password registration and login with JWT, bcrypt password hashing
- **Polls** — Create polls with 2–4 options
- **Voting** — One vote per user per poll, enforced at the database level via a unique constraint
- **Real-time results** — A WebSocket connection per poll broadcasts updated vote counts to every connected client the instant a vote is cast
- **Frontend** — React + TypeScript UI with a live connection indicator and an animated "pulse" on the option that just received a vote
- **Automated tests** — pytest suite covering REST behavior, vote constraints, and the WebSocket broadcast itself

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI |
| Real-time | FastAPI WebSockets |
| Database | PostgreSQL |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Auth | python-jose (JWT), passlib + bcrypt |
| Frontend | React, TypeScript, Vite |
| Testing | pytest, FastAPI TestClient (including WebSocket test client) |
| Local environment | Docker / Docker Compose |
| Dependency management | uv (backend), npm (frontend) |

## Why WebSockets

Standard REST APIs are request/response: a client asks, the server answers, the connection ends. That model can't show one user's vote to another user without the second user manually refreshing or the client polling on a timer.

WebSockets keep a connection open in both directions. The server can push data the moment something changes, without being asked. This project uses one WebSocket connection per poll; when a vote is cast through the REST `POST /polls/{id}/votes` endpoint, the server recalculates vote counts and broadcasts the result to every client currently connected to that poll's WebSocket — including clients that didn't cast the vote.

## Data Model

- **User** — account with hashed credentials
- **Poll** — a question, created by a user
- **Option** — one of 2–4 choices belonging to a poll
- **Vote** — links a user, a poll, and the option they chose; a unique constraint on `(user_id, poll_id)` makes double-voting on the same poll impossible at the database level, not just in application code

## Getting Started

### Prerequisites
- Python 3.11+, [uv](https://docs.astral.sh/uv/)
- Node.js + npm
- Docker Desktop

### Backend Setup

1. Install dependencies:
```bash
   uv sync
```

2. Start PostgreSQL:
```bash
   docker compose up -d
```

3. Create a `.env` file in the project root:
DATABASE_URL=postgresql://voting_user:voting_pass@localhost:5433/voting_app

SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=30

4. Run migrations and start the server:
```bash
   uv run alembic upgrade head
   uv run uvicorn app.main:app --reload
```

   API docs available at `http://127.0.0.1:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. To see the live-update behavior, open the same poll in two browser windows (e.g. one normal, one incognito, logged in as different users) and vote in one — the other updates instantly.

### Running Tests

Create a separate test database (one-time setup):
```bash
docker exec -it voting_app_db psql -U voting_user -d voting_app -c "CREATE DATABASE voting_app_test;"
```

```bash
uv run pytest -v
```

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create a new user |
| POST | `/auth/login` | Authenticate, receive a JWT |
| GET | `/auth/me` | Get the current authenticated user |
| POST | `/polls` | Create a poll with 2–4 options |
| GET | `/polls` | List all polls |
| GET | `/polls/{id}` | Get a single poll with current vote counts |
| POST | `/polls/{id}/votes` | Cast a vote (one per user per poll) |
| WS | `/ws/polls/{id}` | Subscribe to live results for a poll |

## Design Notes

- **One vote per user per poll** is enforced with a `UniqueConstraint(user_id, poll_id)` on the `Vote` table — a database-level guarantee, not just an application-level check.
- **`poll_id` is stored directly on `Vote`**, even though it's technically derivable through `Option`, to keep the unique constraint simple and to make "all votes for this poll" a direct, fast query rather than requiring a join.
- **The WebSocket layer is decoupled from the REST layer** — `cast_vote` is a normal REST endpoint; after committing the vote, it separately triggers a broadcast. The WebSocket endpoint itself only tracks connections and forwards messages; it has no voting logic of its own.