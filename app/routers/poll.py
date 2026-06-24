from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import User, Poll, Option, Vote
from app.schemas.poll import PollCreate, PollResponse, OptionResponse, VoteCreate, VoteResponse
from app.core.deps import get_current_user
from app.core.ws_manager import manager

router = APIRouter(tags=["polls"])


def get_poll_or_404(poll_id: int, db: Session) -> Poll:
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found.")
    return poll


def build_poll_response(poll: Poll, db: Session) -> dict:
    options_with_counts = []
    for option in poll.options:
        count = db.query(func.count(Vote.id)).filter(Vote.option_id == option.id).scalar()
        options_with_counts.append(
            OptionResponse(id=option.id, text=option.text, vote_count=count)
        )
    return PollResponse(
        id=poll.id,
        question=poll.question,
        creator_id=poll.creator_id,
        created_at=poll.created_at,
        options=options_with_counts,
    )


@router.post("/polls", response_model=PollResponse, status_code=status.HTTP_201_CREATED)
def create_poll(
    poll_in: PollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_poll = Poll(question=poll_in.question, creator_id=current_user.id)
    db.add(new_poll)
    db.flush()

    for option_text in poll_in.options:
        db.add(Option(text=option_text, poll_id=new_poll.id))

    db.commit()
    db.refresh(new_poll)

    return build_poll_response(new_poll, db)


@router.get("/polls", response_model=list[PollResponse])
def list_polls(db: Session = Depends(get_db)):
    polls = db.query(Poll).order_by(Poll.created_at.desc()).all()
    return [build_poll_response(poll, db) for poll in polls]


@router.get("/polls/{poll_id}", response_model=PollResponse)
def get_poll(poll_id: int, db: Session = Depends(get_db)):
    poll = get_poll_or_404(poll_id, db)
    return build_poll_response(poll, db)


@router.post("/polls/{poll_id}/votes", response_model=VoteResponse, status_code=status.HTTP_201_CREATED)
async def cast_vote(
    poll_id: int,
    vote_in: VoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    poll = get_poll_or_404(poll_id, db)

    option = db.query(Option).filter(Option.id == vote_in.option_id, Option.poll_id == poll_id).first()
    if not option:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This option does not belong to this poll.",
        )

    existing_vote = (
        db.query(Vote)
        .filter(Vote.user_id == current_user.id, Vote.poll_id == poll_id)
        .first()
    )
    if existing_vote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already voted on this poll.",
        )

    new_vote = Vote(
        user_id=current_user.id,
        poll_id=poll_id,
        option_id=vote_in.option_id,
    )
    db.add(new_vote)
    db.commit()
    db.refresh(new_vote)

    updated_poll = get_poll_or_404(poll_id, db)
    results = build_poll_response(updated_poll, db)
    await manager.broadcast(poll_id, results.model_dump(mode="json"))

    return new_vote


@router.websocket("/ws/polls/{poll_id}")
async def poll_results_socket(websocket: WebSocket, poll_id: int, db: Session = Depends(get_db)):
    await manager.connect(poll_id, websocket)
    try:
        poll = db.query(Poll).filter(Poll.id == poll_id).first()
        if poll:
            results = build_poll_response(poll, db)
            await websocket.send_json(results.model_dump(mode="json"))

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(poll_id, websocket)