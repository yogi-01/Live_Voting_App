from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, poll

app = FastAPI(title="Live Voting App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(poll.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}