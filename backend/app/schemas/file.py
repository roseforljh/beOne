from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class FileBase(BaseModel):
    filename: str
    mime_type: Optional[str] = None


class FileCreate(FileBase):
    file_path: str
    size: int


class FileUpdate(BaseModel):
    is_public: Optional[bool] = None
    filename: Optional[str] = None


class FileResponse(BaseModel):
    id: UUID
    user_id: int
    filename: str
    size: int
    mime_type: Optional[str]
    is_public: bool
    source: str
    share_token: Optional[str]
    created_at: datetime
    download_url: Optional[str] = None
    public_url: Optional[str] = None

    class Config:
        from_attributes = True


class FileUploadResponse(BaseModel):
    file: FileResponse
    message: str = "File uploaded successfully"
