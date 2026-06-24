from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class OptionCreate(BaseModel):
    text: str


class OptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    vote_count: int = 0


class PollCreate(BaseModel):
    question: str
    options: list[str]

    @field_validator("options")
    @classmethod
    def validate_option_count(cls, value):
        if not (2 <= len(value) <= 4):
            raise ValueError("A poll must have between 2 and 4 options.")
        return value


class PollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    creator_id: int
    created_at: datetime
    options: list[OptionResponse]


class VoteCreate(BaseModel):
    option_id: int


class VoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    poll_id: int
    option_id: int
    created_at: datetime