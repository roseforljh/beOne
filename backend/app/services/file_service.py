import os
import secrets
import aiofiles
import hashlib
from io import BytesIO
from pathlib import Path
from datetime import datetime
from typing import Optional
from fastapi import UploadFile
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image
import magic

from app.config import settings
from app.models.file import File
from app.schemas.file import FileUpdate


class FileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def _generate_share_token(self) -> str:
        """生成唯一的分享 Token"""
        return secrets.token_urlsafe(32)
    
    def _get_storage_path(self, user_id: int, filename: str) -> Path:
        """生成存储路径：uploads/{user_id}/{timestamp}_{filename}"""
        user_dir = self.upload_dir / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{filename}"
        return user_dir / safe_filename
    
    async def save_file(
        self,
        file: UploadFile,
        user_id: int,
        is_public: bool = False,
        source: str = "drive"
    ) -> File:
        """保存上传的文件"""
        # 检查文件大小
        content = await file.read()
        file_size = len(content)
        
        if file_size > settings.MAX_FILE_SIZE:
            raise ValueError(f"File too large. Max size: {settings.MAX_FILE_SIZE} bytes")
        
        # 生成存储路径
        storage_path = self._get_storage_path(user_id, file.filename)
        
        # 写入文件
        async with aiofiles.open(storage_path, "wb") as f:
            await f.write(content)
        
        # 创建数据库记录
        share_token = self._generate_share_token() if is_public else None

        detected_mime_type: Optional[str] = None
        try:
            detected_mime_type = magic.from_buffer(content, mime=True)
        except Exception:
            detected_mime_type = None

        # 优先使用内容探测的 mime_type，避免客户端上报不准导致浏览器解码失败
        mime_type = detected_mime_type or file.content_type
        if not mime_type or mime_type == "application/octet-stream":
            name = (file.filename or "").lower()
            if name.endswith(".png"):
                mime_type = "image/png"
            elif name.endswith(".jpg") or name.endswith(".jpeg"):
                mime_type = "image/jpeg"
            elif name.endswith(".webp"):
                mime_type = "image/webp"
            elif name.endswith(".gif"):
                mime_type = "image/gif"

        file_record = File(
            user_id=user_id,
            filename=file.filename,
            file_path=str(storage_path),
            size=file_size,
            mime_type=mime_type,
            is_public=is_public,
            source=source,
            share_token=share_token,
        )
        
        self.db.add(file_record)
        await self.db.commit()
        await self.db.refresh(file_record)
        
        return file_record
    
    async def stream_file(self, file_record: File, inline: bool = False) -> StreamingResponse:
        """流式返回文件内容"""
        file_path = Path(file_record.file_path)
        
        if not file_path.exists():
            raise FileNotFoundError("File not found on disk")
        
        async def file_iterator():
            async with aiofiles.open(file_path, "rb") as f:
                while chunk := await f.read(8192):
                    yield chunk
        
        disposition = "inline" if inline else "attachment"
        return StreamingResponse(
            file_iterator(),
            media_type=file_record.mime_type or "application/octet-stream",
            headers={
                "Content-Disposition": f'{disposition}; filename="{file_record.filename}"',
                "Content-Length": str(file_record.size),
            }
        )
    
    async def update_file(self, file_record: File, update_data: FileUpdate) -> File:
        """更新文件属性"""
        if update_data.filename is not None:
            file_record.filename = update_data.filename
        
        if update_data.is_public is not None:
            file_record.is_public = update_data.is_public
            
            # 如果设为公开且没有 share_token，生成一个
            if update_data.is_public and not file_record.share_token:
                file_record.share_token = self._generate_share_token()
            # 如果设为私有，可以选择保留或清除 share_token
            # 这里选择保留，方便用户再次公开时使用相同链接
        
        await self.db.commit()
        await self.db.refresh(file_record)
        return file_record
    
    async def soft_delete(self, file_record: File) -> None:
        """软删除文件"""
        file_record.deleted_at = datetime.utcnow()
        await self.db.commit()
    
    async def hard_delete(self, file_record: File) -> None:
        """硬删除文件（包括磁盘文件）"""
        # 删除磁盘文件
        file_path = Path(file_record.file_path)
        if file_path.exists():
            os.remove(file_path)
        
        # 删除数据库记录
        await self.db.delete(file_record)
        await self.db.commit()

    def _get_thumb_path(self, file_record: File, size: int) -> Path:
        """获取缩略图缓存路径"""
        thumb_dir = self.upload_dir / "thumbs"
        thumb_dir.mkdir(parents=True, exist_ok=True)
        # 使用文件ID和尺寸生成缩略图文件名
        thumb_name = f"{file_record.id}_{size}.webp"
        return thumb_dir / thumb_name

    async def get_thumbnail(self, file_record: File, size: int = 300) -> Response:
        """生成或返回缓存的缩略图"""
        # 限制尺寸范围
        size = max(50, min(800, size))
        
        thumb_path = self._get_thumb_path(file_record, size)
        
        # 如果缩略图已存在，直接返回
        if thumb_path.exists():
            async with aiofiles.open(thumb_path, "rb") as f:
                thumb_data = await f.read()
            return Response(
                content=thumb_data,
                media_type="image/webp",
                headers={
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Content-Length": str(len(thumb_data)),
                }
            )
        
        # 生成缩略图
        file_path = Path(file_record.file_path)
        if not file_path.exists():
            raise FileNotFoundError("File not found on disk")
        
        try:
            async with aiofiles.open(file_path, "rb") as f:
                img_data = await f.read()
            
            img = Image.open(BytesIO(img_data))
            img.thumbnail((size, size), Image.Resampling.LANCZOS)
            
            # 转换为 RGB（处理 RGBA/P 模式）
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # 保存为 WebP 格式（更小体积）
            buffer = BytesIO()
            img.save(buffer, format="WEBP", quality=80, optimize=True)
            thumb_data = buffer.getvalue()
            
            # 缓存到磁盘
            async with aiofiles.open(thumb_path, "wb") as f:
                await f.write(thumb_data)
            
            return Response(
                content=thumb_data,
                media_type="image/webp",
                headers={
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Content-Length": str(len(thumb_data)),
                }
            )
        except Exception:
            # 如果生成失败，返回原图
            return await self.stream_file(file_record, inline=True)
