from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    auth_provider: str
    provider_id: str


class UserResponse(UserBase):
    id: int
    auth_provider: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class DevLoginRequest(BaseModel):
    username: str = "dev_user"
    email: Optional[str] = "dev@synchub.local"


class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str
