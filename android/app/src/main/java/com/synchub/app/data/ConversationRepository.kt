package com.synchub.app.data

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import com.synchub.app.network.ConversationApi
import com.synchub.app.network.ConversationCreateRequest
import com.synchub.app.network.ConversationMessageRequest
import com.synchub.app.network.ConversationMessageResponse
import com.synchub.app.network.ConversationResponse
import com.synchub.app.service.WSMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class ConversationRepository(
    context: Context,
    private val conversationApi: ConversationApi
) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(Dispatchers.IO)
    
    private val _conversations = MutableStateFlow<List<Conversation>>(emptyList())
    val conversations = _conversations.asStateFlow()
    
    private val _currentConversation = MutableStateFlow<Conversation?>(null)
    val currentConversation = _currentConversation.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)

    init {
        fetchConversations()
    }

    fun fetchConversations() {
        scope.launch {
            _isLoading.value = true
            try {
                val list = conversationApi.listConversations()
                val convs = list.map { apiConvToLocal(it) }
                _conversations.value = convs
                
                // Select first or keep current
                if (_currentConversation.value == null && convs.isNotEmpty()) {
                    selectConversation(convs.first().id)
                } else if (_currentConversation.value != null) {
                    // Refresh current conversation messages
                    val currentId = _currentConversation.value?.id
                    if (currentId != null) {
                        val detail = conversationApi.getConversation(currentId)
                        _currentConversation.value = apiConvToLocal(detail)
                    }
                }
            } catch (e: Exception) {
                Log.e("ConversationRepo", "Failed to fetch conversations", e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    suspend fun createNewConversationAsync(): Conversation? {
        return try {
            val response = conversationApi.createConversation(ConversationCreateRequest("新会话"))
            val newConv = apiConvToLocal(response)
            _conversations.value = listOf(newConv) + _conversations.value
            _currentConversation.value = newConv
            newConv
        } catch (e: Exception) {
            Log.e("ConversationRepo", "Failed to create conversation", e)
            null
        }
    }

    fun createNewConversation(): Conversation {
        // Fire and forget - create on backend
        val tempConv = Conversation()
        _conversations.value = listOf(tempConv) + _conversations.value
        _currentConversation.value = tempConv
        
        scope.launch {
            try {
                val response = conversationApi.createConversation(ConversationCreateRequest("新会话"))
                val newConv = apiConvToLocal(response)
                // Replace temp with real
                _conversations.value = _conversations.value.map { 
                    if (it.id == tempConv.id) newConv else it 
                }
                if (_currentConversation.value?.id == tempConv.id) {
                    _currentConversation.value = newConv
                }
            } catch (e: Exception) {
                Log.e("ConversationRepo", "Failed to create conversation on backend", e)
            }
        }
        return tempConv
    }

    fun selectConversation(conversationId: String) {
        _currentConversation.value = _conversations.value.find { it.id == conversationId }
        
        // Fetch messages from backend
        scope.launch {
            try {
                val detail = conversationApi.getConversation(conversationId)
                val conv = apiConvToLocal(detail)
                _conversations.value = _conversations.value.map {
                    if (it.id == conversationId) conv else it
                }
                _currentConversation.value = conv
            } catch (e: Exception) {
                Log.e("ConversationRepo", "Failed to fetch conversation detail", e)
            }
        }
    }

    fun addMessageToCurrentConversation(message: WSMessage) {
        Log.d("ConversationRepo", "addMessageToCurrentConversation: type=${message.type}, content=${message.content}")

        // Handle conversations_event from backend WebSocket
        if (message.type == "conversations_event") {
            Log.d("ConversationRepo", "Processing conversations_event: ${message.content}")
            when (message.content) {
                "created" -> {
                    fetchConversations()
                    showToast("其他设备已创建新会话")
                }
                "cleared" -> {
                    val targetId = message.fileId
                    if (targetId.isNotEmpty()) {
                        clearConversationLocally(targetId)
                        showToast("会话已被其他设备清空")
                    }
                }
                "deleted" -> {
                    val targetId = message.fileId
                    if (targetId.isNotEmpty()) {
                        deleteConversationLocally(targetId)
                        showToast("会话已被其他设备删除")
                    }
                }
                "message_added" -> {
                    // Skip if message is from Android (same device) - already added locally
                    if (message.deviceName == "Android") return
                    
                    // Refetch current conversation if it's the target
                    val targetId = message.fileId
                    if (targetId == _currentConversation.value?.id) {
                        scope.launch {
                            try {
                                val detail = conversationApi.getConversation(targetId)
                                _currentConversation.value = apiConvToLocal(detail)
                            } catch (e: Exception) {
                                Log.e("ConversationRepo", "Failed to refresh conversation", e)
                            }
                        }
                    }
                }
            }
            return
        }

        // Handle old chat_event format (backward compatibility)
        if (message.type == "chat_event") {
            when (message.content) {
                "clear_conversation" -> {
                    val targetId = message.fileId
                    if (targetId.isNotEmpty()) {
                        clearConversationLocally(targetId)
                        showToast("会话已被其他设备清空")
                    }
                }
                "new_conversation" -> {
                    fetchConversations()
                    showToast("其他设备已创建新会话")
                }
            }
            return
        }

        // Regular message - add locally
        val current = _currentConversation.value ?: return
        val updatedConversation = current.copy(
            messages = current.messages + message,
            updatedAt = System.currentTimeMillis(),
            title = if (current.messages.isEmpty() && message.type == "text") {
                message.content.take(20).let { if (it.length == 20) "$it..." else it }
            } else current.title
        )
        updateConversationLocally(updatedConversation)

        // Only save to backend if this is our own message (isOwn=true)
        // Received messages (isOwn=false) are already saved by the sender
        if (message.isOwn) {
            scope.launch {
                try {
                    conversationApi.addMessage(
                        current.id,
                        ConversationMessageRequest(
                            type = message.type,
                            content = if (message.type == "text") message.content else null,
                            filename = message.filename.ifEmpty { null },
                            file_id = message.fileId.ifEmpty { null },
                            mime_type = message.mimeType.ifEmpty { null },
                            device_name = message.deviceName
                        )
                    )
                } catch (e: Exception) {
                    Log.e("ConversationRepo", "Failed to add message to backend", e)
                }
            }
        }
    }

    fun getCurrentMessages(): List<WSMessage> {
        return _currentConversation.value?.messages ?: emptyList()
    }

    fun clearCurrentConversation() {
        val current = _currentConversation.value ?: return
        clearConversationLocally(current.id)
        
        scope.launch {
            try {
                conversationApi.clearConversation(current.id)
            } catch (e: Exception) {
                Log.e("ConversationRepo", "Failed to clear conversation on backend", e)
            }
        }
    }

    private fun clearConversationLocally(conversationId: String) {
        val target = _conversations.value.find { it.id == conversationId } ?: return
        val updated = target.copy(messages = emptyList(), updatedAt = System.currentTimeMillis())
        updateConversationLocally(updated)
    }

    fun deleteConversation(conversationId: String) {
        // Prevent deleting the last conversation
        if (_conversations.value.size <= 1) {
            showToast("无法删除最后一个会话")
            return
        }
        
        deleteConversationLocally(conversationId)
        
        scope.launch {
            try {
                conversationApi.deleteConversation(conversationId)
            } catch (e: Exception) {
                Log.e("ConversationRepo", "Failed to delete conversation on backend", e)
            }
        }
    }

    private fun deleteConversationLocally(conversationId: String) {
        val updatedList = _conversations.value.filter { it.id != conversationId }
        _conversations.value = updatedList

        if (_currentConversation.value?.id == conversationId) {
            _currentConversation.value = updatedList.firstOrNull()
        }
    }

    private fun updateConversationLocally(conversation: Conversation) {
        val updatedList = _conversations.value.map {
            if (it.id == conversation.id) conversation else it
        }.sortedByDescending { it.updatedAt }
        _conversations.value = updatedList
        if (_currentConversation.value?.id == conversation.id) {
            _currentConversation.value = conversation
        }
    }

    private fun showToast(message: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(appContext, message, Toast.LENGTH_SHORT).show()
        }
    }

    private fun apiConvToLocal(response: ConversationResponse): Conversation {
        val messages = response.messages?.map { apiMsgToLocal(it) } ?: emptyList()
        return Conversation(
            id = response.id,
            title = response.title,
            messages = messages,
            createdAt = parseTimestamp(response.created_at),
            updatedAt = parseTimestamp(response.updated_at)
        )
    }

    private fun apiMsgToLocal(msg: ConversationMessageResponse): WSMessage {
        return WSMessage(
            type = msg.type,
            content = msg.content ?: msg.filename ?: "",
            filename = msg.filename ?: "",
            fileId = msg.file_id ?: "",
            mimeType = msg.mime_type ?: "",
            deviceName = msg.device_name,
            timestamp = parseTimestamp(msg.created_at),
            isOwn = false
        )
    }

    private fun parseTimestamp(dateStr: String): Long {
        return try {
            dateFormat.parse(dateStr)?.time ?: System.currentTimeMillis()
        } catch (e: Exception) {
            System.currentTimeMillis()
        }
    }
}
