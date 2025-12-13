import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional
import redis.asyncio as redis

from app.config import settings
from app.services.ws_service import WebSocketManager
from app.utils.security import decode_token

router = APIRouter()

# 全局 WebSocket 管理器
ws_manager = WebSocketManager()


@router.websocket("/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str,
    token: Optional[str] = Query(None)
):
    """
    WebSocket 连接端点
    client_id: 客户端唯一标识（如：web_xxx, android_xxx, pc_xxx）
    token: JWT Token 用于认证
    """
    # 验证 Token
    user_id = None
    if token:
        payload = decode_token(token)
        if payload:
            user_id = payload.get("sub")
    
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    # 接受连接
    await ws_manager.connect(websocket, user_id, client_id)
    
    # 获取 Redis 连接
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    
    try:
        # 订阅用户频道
        await pubsub.subscribe(f"user:{user_id}")
        
        # 发送连接成功消息
        await websocket.send_json({
            "type": "connected",
            "client_id": client_id,
            "message": "Connected to SyncHub"
        })
        
        # 创建两个并发任务
        async def listen_redis():
            """监听 Redis 消息"""
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data_str = message["data"]
                    try:
                        # 解析消息以检查发送者
                        data = json.loads(data_str)
                        sender_client_id = data.get("from_client")
                        
                        # 只有当消息不是来自当前客户端时才发送
                        # (或者消息没有 client_id，比如系统消息或来自 HTTP API 的上传通知，此时应发送)
                        if sender_client_id != client_id:
                            await websocket.send_text(data_str)
                    except json.JSONDecodeError:
                        # 如果不是 JSON，直接发送（虽然我们通常应该保证是 JSON）
                        await websocket.send_text(data_str)
                    except Exception as e:
                        print(f"Error sending redis message to {client_id}: {e}")
        
        async def listen_websocket():
            """监听 WebSocket 消息"""
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # 处理 ping
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
                
                # 发布到 Redis，让其他客户端收到
                message["from_client"] = client_id
                await redis_client.publish(f"user:{user_id}", json.dumps(message))
        
        # 并发运行两个监听任务
        await asyncio.gather(
            listen_redis(),
            listen_websocket()
        )
        
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, client_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        ws_manager.disconnect(user_id, client_id)
    finally:
        await pubsub.unsubscribe(f"user:{user_id}")
        await redis_client.close()
