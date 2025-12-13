import json
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation, ConversationMessage
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationDetailResponse,
    MessageCreate,
    MessageResponse,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])


@router.post("", response_model=ConversationDetailResponse)
async def create_conversation(
    request: Request,
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建新会话"""
    conversation = Conversation(
        user_id=current_user.id,
        title=data.title
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)

    # Broadcast event
    redis = request.app.state.redis
    await redis.publish(
        f"user:{current_user.id}",
        json.dumps({
            "type": "conversations_event",
            "action": "created",
            "conversation_id": str(conversation.id),
            "title": conversation.title
        })
    )

    return ConversationDetailResponse(
        id=conversation.id,
        user_id=conversation.user_id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[]
    )


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取用户所有会话列表"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .where(Conversation.deleted_at.is_(None))
        .order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()

    response = []
    for conv in conversations:
        # Get message count and last message
        msg_result = await db.execute(
            select(ConversationMessage)
            .where(ConversationMessage.conversation_id == conv.id)
            .order_by(ConversationMessage.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()

        count_result = await db.execute(
            select(func.count(ConversationMessage.id))
            .where(ConversationMessage.conversation_id == conv.id)
        )
        msg_count = count_result.scalar() or 0

        response.append(ConversationResponse(
            id=conv.id,
            user_id=conv.user_id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=msg_count,
            last_message=MessageResponse.model_validate(last_msg) if last_msg else None
        ))

    return response


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取会话详情（含所有消息）"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
        .where(Conversation.deleted_at.is_(None))
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return ConversationDetailResponse(
        id=conversation.id,
        user_id=conversation.user_id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[MessageResponse.model_validate(m) for m in conversation.messages]
    )


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: UUID,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新会话（如标题）"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
        .where(Conversation.deleted_at.is_(None))
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if data.title is not None:
        conversation.title = data.title

    await db.commit()
    await db.refresh(conversation)

    return ConversationResponse(
        id=conversation.id,
        user_id=conversation.user_id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=len(conversation.messages)
    )


@router.delete("/{conversation_id}")
async def delete_conversation(
    request: Request,
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除会话（软删除）"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
        .where(Conversation.deleted_at.is_(None))
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conversation.deleted_at = func.now()
    await db.commit()

    # Broadcast event
    redis = request.app.state.redis
    await redis.publish(
        f"user:{current_user.id}",
        json.dumps({
            "type": "conversations_event",
            "action": "deleted",
            "conversation_id": str(conversation_id)
        })
    )

    return {"message": "Conversation deleted"}


@router.post("/{conversation_id}/clear")
async def clear_conversation(
    request: Request,
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """清空会话消息"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
        .where(Conversation.deleted_at.is_(None))
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Delete all messages
    await db.execute(
        ConversationMessage.__table__.delete().where(
            ConversationMessage.conversation_id == conversation_id
        )
    )
    await db.commit()

    # Broadcast event
    redis = request.app.state.redis
    await redis.publish(
        f"user:{current_user.id}",
        json.dumps({
            "type": "conversations_event",
            "action": "cleared",
            "conversation_id": str(conversation_id)
        })
    )

    return {"message": "Conversation cleared"}


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def add_message(
    request: Request,
    conversation_id: UUID,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """添加消息到会话"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
        .where(Conversation.deleted_at.is_(None))
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    message = ConversationMessage(
        conversation_id=conversation_id,
        type=data.type,
        content=data.content,
        filename=data.filename,
        file_id=data.file_id,
        mime_type=data.mime_type,
        device_name=data.device_name
    )
    db.add(message)

    # Update conversation title if first message and it's text
    if len(conversation.messages) == 0 and data.type == "text" and data.content:
        conversation.title = data.content[:20] + ("..." if len(data.content) > 20 else "")

    await db.commit()
    await db.refresh(message)

    # Broadcast event
    redis = request.app.state.redis
    await redis.publish(
        f"user:{current_user.id}",
        json.dumps({
            "type": "conversations_event",
            "action": "message_added",
            "conversation_id": str(conversation_id),
            "message": {
                "id": str(message.id),
                "type": message.type,
                "content": message.content,
                "filename": message.filename,
                "file_id": str(message.file_id) if message.file_id else None,
                "mime_type": message.mime_type,
                "device_name": message.device_name,
                "created_at": message.created_at.isoformat()
            }
        })
    )

    return MessageResponse.model_validate(message)


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取会话的所有消息"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
        .where(Conversation.deleted_at.is_(None))
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return [MessageResponse.model_validate(m) for m in conversation.messages]
