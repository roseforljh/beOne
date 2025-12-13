from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(100), default="新会话")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    owner = relationship("User", backref="conversations")
    messages = relationship("ConversationMessage", back_populates="conversation", lazy="selectin", order_by="ConversationMessage.created_at")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # 'text', 'file'
    content = Column(Text, nullable=True)
    filename = Column(String(255), nullable=True)
    file_id = Column(UUID(as_uuid=True), nullable=True)
    mime_type = Column(String(100), nullable=True)
    device_name = Column(String(50), default="Unknown")
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
