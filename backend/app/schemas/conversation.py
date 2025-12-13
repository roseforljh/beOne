from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class MessageCreate(BaseModel):
    type: str  # 'text' or 'file'
    content: Optional[str] = None
    filename: Optional[str] = None
    file_id: Optional[UUID] = None
    mime_type: Optional[str] = None
    device_name: str = "Unknown"


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    type: str
    content: Optional[str] = None
    filename: Optional[str] = None
    file_id: Optional[UUID] = None
    mime_type: Optional[str] = None
    device_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    title: str = "新会话"


class ConversationUpdate(BaseModel):
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: UUID
    user_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message: Optional[MessageResponse] = None

    class Config:
        from_attributes = True


class ConversationDetailResponse(BaseModel):
    id: UUID
    user_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True
