from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True, index=True)
    auth_provider = Column(String(20), nullable=False)  # 'google', 'qq', 'dev'
    provider_id = Column(String(100), nullable=False)
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    files = relationship("File", back_populates="owner", lazy="selectin")
    clipboard_history = relationship("ClipboardHistory", back_populates="user", lazy="selectin")
