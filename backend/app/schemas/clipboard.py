from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ClipboardBase(BaseModel):
    content: str
    device_name: Optional[str] = None


class ClipboardCreate(ClipboardBase):
    pass


class ClipboardResponse(ClipboardBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
