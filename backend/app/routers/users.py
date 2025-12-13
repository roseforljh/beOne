from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.credential import UserCredential
from app.schemas.user import UserResponse, UserUpdateRequest, ChangePasswordRequest
from app.utils.security import get_current_user
from app.utils.password import hash_password, verify_password

router = APIRouter()


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.username is not None:
        current_user.username = payload.username
    if payload.email is not None:
        current_user.email = payload.email

    await db.commit()
    await db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserCredential).where(UserCredential.user_id == current_user.id)
    )
    cred = result.scalar_one_or_none()

    if cred is None:
        if current_user.auth_provider not in {"dev"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is not available for this account",
            )

        if payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No password is set yet; current_password must be empty",
            )

        cred = UserCredential(
            user_id=current_user.id,
            hashed_password=hash_password(payload.new_password),
        )
        db.add(cred)
        await db.commit()
        return {"message": "Password set successfully"}

    if not payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is required",
        )

    if not verify_password(payload.current_password, cred.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    cred.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}
