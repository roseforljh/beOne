from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class WSMessageType(str, Enum):
    TEXT = "text"
    FILE = "file"
    CLIPBOARD = "clipboard"
    PING = "ping"
    PONG = "pong"
    CONNECTED = "connected"
    ERROR = "error"


class WSMessage(BaseModel):
    type: WSMessageType
    content: Optional[Any] = None
    device_name: Optional[str] = None
    timestamp: datetime = None
    
    def __init__(self, **data):
        if data.get("timestamp") is None:
            data["timestamp"] = datetime.utcnow()
        super().__init__(**data)


class WSTextMessage(BaseModel):
    type: WSMessageType = WSMessageType.TEXT
    content: str
    device_name: Optional[str] = None


class WSFileNotification(BaseModel):
    type: WSMessageType = WSMessageType.FILE
    file_id: str
    filename: str
    size: int
    mime_type: Optional[str] = None
    device_name: Optional[str] = None
