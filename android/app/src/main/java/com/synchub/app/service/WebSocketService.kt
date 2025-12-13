package com.synchub.app.service

import android.util.Log
import com.synchub.app.BuildConfig
import com.synchub.app.data.TokenManager
import com.synchub.app.network.FileItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.UUID

class WebSocketService(
    private val client: OkHttpClient,
    private val tokenManager: TokenManager,
    private val onMessageReceived: ((WSMessage) -> Unit)? = null
) {
    private var webSocket: WebSocket? = null
    private val _messages = MutableStateFlow<List<WSMessage>>(emptyList())
    val messages = _messages.asStateFlow()
    
    // 消息回调，用于通知 ConversationRepository
    private var messageCallback: ((WSMessage) -> Unit)? = onMessageReceived
    
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState = _connectionState.asStateFlow()
    
    val clientId = "android_${UUID.randomUUID().toString().substring(0, 8)}"

    // 使用 BuildConfig 中配置的服务器地址
    private val serverHost = BuildConfig.SERVER_HOST
    private val serverPort = BuildConfig.SERVER_PORT
    private val WS_URL = "ws://$serverHost:$serverPort/ws/"
    
    // 重连配置
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 5
    private val reconnectDelayMs = 3000L
    private var reconnectJob: Job? = null
    
    // 心跳配置
    private var heartbeatJob: Job? = null
    private val heartbeatIntervalMs = 30000L // 30秒

    fun connect() {
        if (webSocket != null && _connectionState.value == ConnectionState.CONNECTED) return
        val token = tokenManager.getToken() ?: return
        
        _connectionState.value = ConnectionState.CONNECTING
        Log.d("WebSocket", "Connecting to: $WS_URL$clientId")
        
        val request = Request.Builder()
            .url("$WS_URL$clientId?token=$token")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                Log.d("WebSocket", "Connected to server")
                _connectionState.value = ConnectionState.CONNECTED
                reconnectAttempts = 0
                startHeartbeat()
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d("WebSocket", "Message received: $text")
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type", "unknown")
                    
                    // 处理 pong 响应（心跳）
                    if (type == "pong" || type == "connected") {
                        Log.d("WebSocket", "Heartbeat/connected response received")
                        return
                    }

                    // Handle conversations_event from backend (new API)
                    if (type == "conversations_event") {
                        val action = json.optString("action", "")
                        Log.d("WebSocket", "Conversations event received: action=$action")
                        val evt = WSMessage(
                            type = "conversations_event",
                            content = action,
                            filename = "",
                            fileId = json.optString("conversation_id", ""),
                            mimeType = "",
                            deviceName = json.optString("device_name", ""),
                            timestamp = System.currentTimeMillis(),
                            isOwn = false
                        )
                        messageCallback?.invoke(evt)
                        return
                    }

                    // Handle chat events (legacy, not displayed as bubbles)
                    if (type == "chat_event") {
                        val action = json.optString("action", "")
                        Log.d("WebSocket", "Chat event received: action=$action")
                        val evt = WSMessage(
                            type = "chat_event",
                            content = action,
                            filename = "",
                            fileId = json.optString("conversation_id", ""),
                            mimeType = "",
                            deviceName = json.optString("device_name", ""),
                            timestamp = System.currentTimeMillis(),
                            isOwn = false
                        )
                        messageCallback?.invoke(evt)
                        return
                    }

                    // Ignore non-chat events (e.g., files_event) to avoid blank bubbles in chat UI
                    if (type != "text" && type != "file") {
                        Log.d("WebSocket", "Non-chat event ignored: $type")
                        return
                    }
                    
                    val message = WSMessage(
                        type = type,
                        content = json.optString("content", ""),
                        filename = json.optString("filename", ""),
                        fileId = json.optString("file_id", ""),
                        mimeType = json.optString("mime_type", ""),
                        deviceName = json.optString("device_name", "Unknown"),
                        timestamp = System.currentTimeMillis(),
                        isOwn = false
                    )
                    val currentList = _messages.value.toMutableList()
                    currentList.add(message)
                    _messages.value = currentList
                    
                    // 通知回调
                    messageCallback?.invoke(message)
                } catch (e: Exception) {
                    Log.e("WebSocket", "Parse error", e)
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("WebSocket", "Connection closing: $code - $reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("WebSocket", "Connection closed: $code - $reason")
                handleDisconnection()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                Log.e("WebSocket", "Connection error: ${t.message}", t)
                handleDisconnection()
            }
        })
    }

    fun sendClearConversation(conversationId: String) {
        val json = JSONObject().apply {
            put("type", "chat_event")
            put("action", "clear_conversation")
            put("conversation_id", conversationId)
            put("device_name", "Android")
        }
        webSocket?.send(json.toString())
    }

    fun sendNewConversation(conversationId: String) {
        val json = JSONObject().apply {
            put("type", "chat_event")
            put("action", "new_conversation")
            put("conversation_id", conversationId)
            put("device_name", "Android")
        }
        webSocket?.send(json.toString())
    }
    
    private fun handleDisconnection() {
        _connectionState.value = ConnectionState.DISCONNECTED
        stopHeartbeat()
        webSocket = null
        scheduleReconnect()
    }
    
    private fun scheduleReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            Log.w("WebSocket", "Max reconnect attempts reached")
            _connectionState.value = ConnectionState.FAILED
            return
        }
        
        reconnectJob?.cancel()
        reconnectJob = CoroutineScope(Dispatchers.IO).launch {
            reconnectAttempts++
            Log.d("WebSocket", "Reconnecting in ${reconnectDelayMs}ms (attempt $reconnectAttempts)")
            delay(reconnectDelayMs)
            connect()
        }
    }
    
    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = CoroutineScope(Dispatchers.IO).launch {
            while (true) {
                delay(heartbeatIntervalMs)
                if (_connectionState.value == ConnectionState.CONNECTED) {
                    sendPing()
                }
            }
        }
    }
    
    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }
    
    private fun sendPing() {
        val json = JSONObject().apply {
            put("type", "ping")
        }
        webSocket?.send(json.toString())
    }

    fun sendText(text: String) {
        val json = JSONObject().apply {
            put("type", "text")
            put("content", text)
            put("device_name", "Android")
        }
        webSocket?.send(json.toString())
        
        // 发送后立即添加到本地消息列表（自己发送的消息）
        val message = WSMessage(
            type = "text",
            content = text,
            filename = "",
            fileId = "",
            mimeType = "",
            deviceName = "Android",
            timestamp = System.currentTimeMillis(),
            isOwn = true
        )
        val currentList = _messages.value.toMutableList()
        currentList.add(message)
        _messages.value = currentList
        
        // 通知回调
        messageCallback?.invoke(message)
    }

    fun disconnect() {
        reconnectJob?.cancel()
        stopHeartbeat()
        webSocket?.close(1000, "User logout")
        webSocket = null
        _connectionState.value = ConnectionState.DISCONNECTED
        reconnectAttempts = 0
    }
    
    fun clearMessages() {
        _messages.value = emptyList()
    }
    
    fun setMessages(messages: List<WSMessage>) {
        _messages.value = messages
    }
    
    fun addLocalFileMessage(fileItem: FileItem) {
        val message = WSMessage(
            type = "file",
            content = fileItem.filename,
            filename = fileItem.filename,
            fileId = fileItem.id,
            mimeType = fileItem.mime_type ?: "",
            deviceName = "Android",
            timestamp = System.currentTimeMillis(),
            isOwn = true
        )
        val currentList = _messages.value.toMutableList()
        currentList.add(message)
        _messages.value = currentList
        
        // 通知回调
        messageCallback?.invoke(message)
    }
    
    // 手动重连
    fun reconnect() {
        disconnect()
        reconnectAttempts = 0
        connect()
    }
}

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    FAILED
}

data class WSMessage(
    val type: String,
    val content: String,
    val filename: String = "",
    val fileId: String = "",
    val mimeType: String = "",
    val deviceName: String = "",
    val timestamp: Long = 0,
    val isOwn: Boolean = false
)
