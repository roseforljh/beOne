from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.user import User


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    def create_access_token(self, user_id: int, expires_delta: Optional[timedelta] = None) -> str:
        """创建 JWT Access Token"""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.utcnow(),
        }
        
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        return encoded_jwt
    
    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """通过 ID 获取用户"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_or_create_user(
        self,
        auth_provider: str,
        provider_id: str,
        username: Optional[str] = None,
        email: Optional[str] = None,
        avatar_url: Optional[str] = None
    ) -> User:
        """获取或创建用户（用于 OAuth 回调）"""
        result = await self.db.execute(
            select(User).where(
                User.auth_provider == auth_provider,
                User.provider_id == provider_id
            )
        )
        user = result.scalar_one_or_none()
        
        if user:
            # 更新用户信息
            if username:
                user.username = username
            if email:
                user.email = email
            if avatar_url:
                user.avatar_url = avatar_url
            await self.db.commit()
            await self.db.refresh(user)
        else:
            # 创建新用户
            user = User(
                username=username,
                email=email,
                auth_provider=auth_provider,
                provider_id=provider_id,
                avatar_url=avatar_url,
            )
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
        
        return user
