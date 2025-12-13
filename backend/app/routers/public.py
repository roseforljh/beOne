from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.file import File as FileModel
from app.services.file_service import FileService

router = APIRouter()


@router.get("/p/{share_token}")
async def get_public_file(
    share_token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    公开文件访问接口
    无需登录，通过 share_token 访问公开文件
    """
    result = await db.execute(
        select(FileModel)
        .where(FileModel.share_token == share_token)
        .where(FileModel.is_public == True)
        .where(FileModel.deleted_at.is_(None))
    )
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or not public"
        )
    
    file_service = FileService(db)
    inline = (file_record.mime_type or "").startswith("image/")
    return await file_service.stream_file(file_record, inline=inline)
