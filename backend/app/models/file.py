import uuid
from sqlalchemy import Column, Integer, String, BigInteger, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class File(Base):
    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=True)
    is_public = Column(Boolean, default=False)
    source = Column(String(20), nullable=False, default="drive", index=True)
    share_token = Column(String(64), nullable=True, unique=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    deleted_at = Column(DateTime, nullable=True)  # Soft delete

    # Relationships
    owner = relationship("User", back_populates="files")
