package com.synchub.app.data

import com.synchub.app.service.WSMessage
import java.util.UUID

data class Conversation(
    val id: String = UUID.randomUUID().toString(),
    val title: String = "新会话",
    val messages: List<WSMessage> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
) {
    fun getPreviewText(): String {
        val lastMessage = messages.lastOrNull()
        return when {
            lastMessage == null -> "暂无消息"
            lastMessage.type == "file" -> "[文件] ${lastMessage.filename}"
            else -> lastMessage.content.take(50)
        }
    }
    
    fun getLastMessageTime(): Long {
        return messages.lastOrNull()?.timestamp ?: createdAt
    }
}
