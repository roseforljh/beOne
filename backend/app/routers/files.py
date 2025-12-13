from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.models.file import File as FileModel
from app.schemas.file import FileResponse as FileSchemaResponse, FileUpdate, FileUploadResponse
from app.services.file_service import FileService
from app.utils.security import get_current_user

router = APIRouter()


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    is_public: bool = Form(False),
    notify_ws: bool = Form(True),
    source: str = Form("drive"),
    device_name: str = Form("Web"),
    client_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """上传文件"""
    file_service = FileService(db)
    
    try:
        file_record = await file_service.save_file(
            file=file,
            user_id=current_user.id,
            is_public=is_public,
            source=source,
        )
        
        # 构建响应
        response_data = FileSchemaResponse.model_validate(file_record)
        response_data.download_url = f"/api/v1/files/{file_record.id}"
        
        if file_record.is_public and file_record.share_token:
            response_data.public_url = f"/p/{file_record.share_token}"

        # Always publish a file event for drive/gallery panels to refresh (does NOT enter chat UI)
        redis = request.app.state.redis
        await redis.publish(
            f"user:{current_user.id}",
            (
                f'{{"type": "files_event", "action": "uploaded", "source": "{file_record.source}", '
                f'"file_id": "{file_record.id}", "filename": "{file_record.filename}", '
                f'"mime_type": "{file_record.mime_type}", "is_public": {str(file_record.is_public).lower()}}}'
            )
        )

        if notify_ws:
            # 发送 WebSocket 通知（chat file message）
            # If client_id is provided, use it as from_client so the sender doesn't get the echo
            from_client = client_id if client_id else device_name
            
            await redis.publish(
                f"user:{current_user.id}",
                f'{{"type": "file", "file_id": "{file_record.id}", "filename": "{file_record.filename}", "mime_type": "{file_record.mime_type}", "device_name": "{device_name}", "from_client": "{from_client}"}}'
            )
        
        return FileUploadResponse(file=response_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=List[FileSchemaResponse])
async def list_files(
    skip: int = 0,
    limit: int = 50,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取当前用户的文件列表"""
    stmt = (
        select(FileModel)
        .where(FileModel.user_id == current_user.id)
        .where(FileModel.deleted_at.is_(None))
    )
    if source:
        stmt = stmt.where(FileModel.source == source)
    stmt = (
        stmt
        .order_by(FileModel.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    files = result.scalars().all()
    
    response_files = []
    for f in files:
        file_response = FileSchemaResponse.model_validate(f)
        file_response.download_url = f"/api/v1/files/{f.id}"
        if f.is_public and f.share_token:
            file_response.public_url = f"/p/{f.share_token}"
        response_files.append(file_response)
    
    return response_files


@router.get("/{file_id}")
async def get_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """下载/获取文件（流式响应）"""
    result = await db.execute(
        select(FileModel)
        .where(FileModel.id == file_id)
        .where(FileModel.user_id == current_user.id)
        .where(FileModel.deleted_at.is_(None))
    )
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    file_service = FileService(db)
    return await file_service.stream_file(file_record)


@router.patch("/{file_id}", response_model=FileSchemaResponse)
async def update_file(
    file_id: UUID,
    update_data: FileUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新文件属性（如切换公开/私有）"""
    result = await db.execute(
        select(FileModel)
        .where(FileModel.id == file_id)
        .where(FileModel.user_id == current_user.id)
        .where(FileModel.deleted_at.is_(None))
    )
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    file_service = FileService(db)
    updated_file = await file_service.update_file(file_record, update_data)
    
    response = FileSchemaResponse.model_validate(updated_file)
    response.download_url = f"/api/v1/files/{updated_file.id}"
    if updated_file.is_public and updated_file.share_token:
        response.public_url = f"/p/{updated_file.share_token}"

    # Publish file updated event so panels can refresh
    redis = request.app.state.redis
    await redis.publish(
        f"user:{current_user.id}",
        (
            f'{{"type": "files_event", "action": "updated", "source": "{updated_file.source}", '
            f'"file_id": "{updated_file.id}", "filename": "{updated_file.filename}", '
            f'"mime_type": "{updated_file.mime_type}", "is_public": {str(updated_file.is_public).lower()}}}'
        )
    )
    
    return response


@router.delete("/{file_id}")
async def delete_file(
    request: Request,
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """软删除文件"""
    result = await db.execute(
        select(FileModel)
        .where(FileModel.id == file_id)
        .where(FileModel.user_id == current_user.id)
        .where(FileModel.deleted_at.is_(None))
    )
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    file_service = FileService(db)
    await file_service.soft_delete(file_record)

    # Publish file deleted event so panels can refresh
    redis = request.app.state.redis
    await redis.publish(
        f"user:{current_user.id}",
        f'{{"type": "files_event", "action": "deleted", "source": "{file_record.source}", "file_id": "{file_record.id}"}}'
    )
    
    return {"message": "File deleted successfully"}
