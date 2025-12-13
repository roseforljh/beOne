import secrets
import json
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, TokenResponse, DevLoginRequest
from app.services.auth_service import AuthService
from app.utils.security import get_current_user

router = APIRouter()


def _require_oauth_config(provider: str):
    if provider == "github":
        if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GitHub OAuth is not configured",
            )
    elif provider == "google":
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google OAuth is not configured",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported OAuth provider",
        )


def _callback_url(provider: str) -> str:
    return f"{settings.BACKEND_PUBLIC_URL}{settings.API_V1_PREFIX}/auth/oauth/{provider}/callback"


def _frontend_redirect(token: str, provider: str) -> str:
    query = urlencode({"token": token, "provider": provider})
    return f"{settings.FRONTEND_PUBLIC_URL}/login?{query}"


def _mobile_redirect(token: str, provider: str, redirect_to: str) -> str:
    query = urlencode({"token": token, "provider": provider})
    if "?" in redirect_to:
        return f"{redirect_to}&{query}"
    return f"{redirect_to}?{query}"


def _validate_redirect_to(redirect_to: str) -> str:
    # Prevent open redirect: only allow our app deep link.
    # Example: synchub://oauth
    if redirect_to != "synchub://oauth":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid redirect_to",
        )
    return redirect_to


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(
    request: DevLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    开发环境登录接口，绕过 OAuth 认证
    生产环境应禁用此接口
    """
    auth_service = AuthService(db)
    
    # 查找或创建开发用户
    result = await db.execute(
        select(User).where(
            User.auth_provider == "dev",
            User.provider_id == request.username
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(
            username=request.username,
            email=request.email,
            auth_provider="dev",
            provider_id=request.username,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    # 生成 JWT Token
    token = auth_service.create_access_token(user_id=user.id)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """获取当前用户信息"""
    return UserResponse.model_validate(current_user)


@router.get("/oauth/{provider}/login")
async def oauth_login(provider: str, request: Request, redirect_to: str | None = None):
    _require_oauth_config(provider)

    state = secrets.token_urlsafe(32)
    redis = request.app.state.redis
    payload = {"provider": provider}
    if redirect_to:
        payload["redirect_to"] = _validate_redirect_to(redirect_to)
    await redis.setex(f"oauth_state:{state}", 600, json.dumps(payload))

    redirect_uri = _callback_url(provider)

    if provider == "github":
        params = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "scope": "read:user user:email",
            "state": state,
        }
        url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
        return RedirectResponse(url=url)

    if provider == "google":
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return RedirectResponse(url=url)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported OAuth provider")


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    _require_oauth_config(provider)

    redis = request.app.state.redis
    saved_state_raw = await redis.get(f"oauth_state:{state}")
    saved_state: dict | None = None
    if saved_state_raw:
        try:
            saved_state = json.loads(saved_state_raw)
        except Exception:
            saved_state = None
    if not saved_state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")
    if saved_state.get("provider") != provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")
    redirect_to = saved_state.get("redirect_to")
    await redis.delete(f"oauth_state:{state}")

    redirect_uri = _callback_url(provider)

    async with httpx.AsyncClient(timeout=20) as client:
        if provider == "github":
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "state": state,
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to get access token")

            user_resp = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            user_json = user_resp.json()

            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            emails_json = emails_resp.json() if emails_resp.status_code < 400 else []
            primary_email = None
            if isinstance(emails_json, list):
                for e in emails_json:
                    if e.get("primary") and e.get("verified"):
                        primary_email = e.get("email")
                        break
                if not primary_email and emails_json:
                    primary_email = emails_json[0].get("email")

            provider_id = str(user_json.get("id"))
            username = user_json.get("login")
            avatar_url = user_json.get("avatar_url")

            if not provider_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch GitHub user")

            auth_service = AuthService(db)
            user = await auth_service.get_or_create_user(
                auth_provider="github",
                provider_id=provider_id,
                username=username,
                email=primary_email,
                avatar_url=avatar_url,
            )
            token = auth_service.create_access_token(user_id=user.id)
            if redirect_to:
                return RedirectResponse(url=_mobile_redirect(token, provider, redirect_to))
            return RedirectResponse(url=_frontend_redirect(token, provider))

        if provider == "google":
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to get access token")

            info_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            info = info_resp.json()
            provider_id = str(info.get("id") or info.get("sub"))
            email = info.get("email")
            username = info.get("name") or (email.split("@")[0] if email else None)
            avatar_url = info.get("picture")

            if not provider_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch Google user")

            auth_service = AuthService(db)
            user = await auth_service.get_or_create_user(
                auth_provider="google",
                provider_id=provider_id,
                username=username,
                email=email,
                avatar_url=avatar_url,
            )
            token = auth_service.create_access_token(user_id=user.id)
            if redirect_to:
                return RedirectResponse(url=_mobile_redirect(token, provider, redirect_to))
            return RedirectResponse(url=_frontend_redirect(token, provider))

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported OAuth provider")


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback(
    code: str,
    db: AsyncSession = Depends(get_db)
):
    """兼容旧接口：请改用 /oauth/google/callback"""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Use GET /api/v1/auth/oauth/google/login instead",
    )


@router.post("/qq/callback", response_model=TokenResponse)
async def qq_callback(
    code: str,
    db: AsyncSession = Depends(get_db)
):
    """QQ OAuth 回调（未实现）"""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="QQ OAuth not implemented yet",
    )
