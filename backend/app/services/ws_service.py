import json
from typing import Dict, Set
from fastapi import WebSocket


class WebSocketManager:
    """
    WebSocket 连接管理器
    管理用户的多设备连接
    """
    
    def __init__(self):
        # user_id -> {client_id -> WebSocket}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str, client_id: str):
        """接受新的 WebSocket 连接"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}
        
        self.active_connections[user_id][client_id] = websocket
        print(f"User {user_id} connected from {client_id}")
    
    def disconnect(self, user_id: str, client_id: str):
        """断开 WebSocket 连接"""
        if user_id in self.active_connections:
            if client_id in self.active_connections[user_id]:
                del self.active_connections[user_id][client_id]
                print(f"User {user_id} disconnected from {client_id}")
            
            # 如果用户没有活跃连接了，清理
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def send_personal_message(self, message: str, user_id: str, client_id: str):
        """发送消息给指定用户的指定设备"""
        if user_id in self.active_connections:
            if client_id in self.active_connections[user_id]:
                websocket = self.active_connections[user_id][client_id]
                await websocket.send_text(message)
    
    async def broadcast_to_user(
        self,
        user_id: str,
        message: str,
        exclude_client: str = None
    ):
        """
        广播消息给用户的所有设备
        exclude_client: 排除某个客户端（通常是消息发送者）
        """
        if user_id in self.active_connections:
            for client_id, websocket in self.active_connections[user_id].items():
                if client_id != exclude_client:
                    try:
                        await websocket.send_text(message)
                    except Exception as e:
                        print(f"Error sending to {client_id}: {e}")
    
    def get_user_clients(self, user_id: str) -> Set[str]:
        """获取用户的所有在线客户端 ID"""
        if user_id in self.active_connections:
            return set(self.active_connections[user_id].keys())
        return set()
    
    def is_user_online(self, user_id: str) -> bool:
        """检查用户是否在线"""
        return user_id in self.active_connections and bool(self.active_connections[user_id])
