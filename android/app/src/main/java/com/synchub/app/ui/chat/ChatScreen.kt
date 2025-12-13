package com.synchub.app.ui.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.synchub.app.data.TokenManager
import com.synchub.app.data.Conversation
import com.synchub.app.data.ConversationRepository
import com.synchub.app.network.NetworkModule
import com.synchub.app.service.WebSocketService
import com.synchub.app.service.WSMessage
import com.synchub.app.service.ConnectionState
import kotlinx.coroutines.launch
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    webSocketService: WebSocketService,
    tokenManager: TokenManager,
    conversationRepository: ConversationRepository,
    onDownload: (WSMessage) -> Unit,
    bottomNavHeight: androidx.compose.ui.unit.Dp = 0.dp
) {
    var input by remember { mutableStateOf("") }
    val messages by webSocketService.messages.collectAsState()
    val connectionState by webSocketService.connectionState.collectAsState()
    val conversations by conversationRepository.conversations.collectAsState()
    val currentConversation by conversationRepository.currentConversation.collectAsState()
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var showClearDialog by remember { mutableStateOf(false) }
    var showHistorySheet by remember { mutableStateOf(false) }
    val inputBarReservedHeight = 80.dp
    val density = LocalDensity.current
    val systemNavBarHeightDp = with(density) { WindowInsets.navigationBars.getBottom(density).toDp() }
    val imeBottomDp = with(density) { WindowInsets.ime.getBottom(density).toDp() }
    val effectiveBottomNavPad = (bottomNavHeight - minOf(bottomNavHeight, imeBottomDp)).coerceAtLeast(0.dp)

    LaunchedEffect(Unit) {
        webSocketService.connect()
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            webSocketService.disconnect()
        }
    }

    // Clear Conversation Dialog
    if (showClearDialog) {
        AlertDialog(
            onDismissRequest = { showClearDialog = false },
            title = { Text("清空会话") },
            text = { Text("确定要清空所有聊天记录吗？此操作不可恢复。") },
            confirmButton = {
                TextButton(
                    onClick = {
                        // Backend API handles broadcasting
                        conversationRepository.clearCurrentConversation()
                        webSocketService.clearMessages()
                        showClearDialog = false
                    }
                ) {
                    Text("确定", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = bottomNavHeight)
        ) {
            // Top Bar
            Surface(
                color = MaterialTheme.colorScheme.background,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "实时聊天",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(onClick = {
                            // Backend API handles broadcasting
                            conversationRepository.createNewConversation()
                            webSocketService.clearMessages()
                        }) {
                            Icon(Icons.Filled.Add, "新建会话", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        IconButton(onClick = { showHistorySheet = true }) {
                            Icon(Icons.Filled.History, "历史会话", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        IconButton(onClick = { showClearDialog = true }) {
                            Icon(Icons.Filled.Delete, "清空会话", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            // Connection Status Indicator
            AnimatedVisibility(visible = connectionState != ConnectionState.CONNECTED) {
                Surface(
                    color = when (connectionState) {
                        ConnectionState.CONNECTING -> MaterialTheme.colorScheme.primaryContainer
                        ConnectionState.FAILED -> MaterialTheme.colorScheme.errorContainer
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val (statusText, statusColor) = when (connectionState) {
                            ConnectionState.CONNECTING -> "正在连接..." to MaterialTheme.colorScheme.onPrimaryContainer
                            ConnectionState.FAILED -> "连接失败，点击重试" to MaterialTheme.colorScheme.onErrorContainer
                            else -> "已断开连接" to MaterialTheme.colorScheme.onSurfaceVariant
                        }
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.bodySmall,
                            color = statusColor,
                            modifier = if (connectionState == ConnectionState.FAILED) {
                                Modifier.clickable { webSocketService.reconnect() }
                            } else Modifier
                        )
                    }
                }
            }

            // Content
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (messages.isEmpty()) {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            modifier = Modifier.size(80.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Filled.Send,
                                    null,
                                    Modifier.size(40.dp),
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                                )
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        Text(
                            "暂无消息",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            "发送消息开始聊天",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(
                            start = 16.dp,
                            end = 16.dp,
                            top = 16.dp,
                            bottom = inputBarReservedHeight + bottomNavHeight + systemNavBarHeightDp
                        ),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(messages) { msg -> MessageBubble(msg, tokenManager, onDownload) }
                    }
                }
            }
        }

        // Input Bar - overlay at bottom, follow IME with continuous insets (no flicker)
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .windowInsetsPadding(WindowInsets.ime)
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(bottom = effectiveBottomNavPad)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { /* TODO */ },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(Icons.Filled.AttachFile, "附件", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }

                // Input Field
                Box(
                    contentAlignment = Alignment.CenterStart,
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 40.dp)
                        .padding(vertical = 8.dp)
                ) {
                    if (input.isEmpty()) {
                        Text(
                            "输入消息...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                    }
                    androidx.compose.foundation.text.BasicTextField(
                        value = input,
                        onValueChange = { input = it },
                        textStyle = MaterialTheme.typography.bodyMedium.copy(
                            color = MaterialTheme.colorScheme.onSurface
                        ),
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.primary),
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Send Button - 始终显示，通过透明度和缩放动画
                val sendButtonAlpha by animateFloatAsState(
                    targetValue = if (input.isNotBlank()) 1f else 0.3f,
                    animationSpec = tween(150),
                    label = "sendAlpha"
                )
                val sendButtonScale by animateFloatAsState(
                    targetValue = if (input.isNotBlank()) 1f else 0.8f,
                    animationSpec = tween(150),
                    label = "sendScale"
                )

                Box(
                    modifier = Modifier
                        .padding(end = 4.dp)
                        .size(40.dp)
                        .scale(sendButtonScale)
                        .alpha(sendButtonAlpha)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                        .clickable(enabled = input.isNotBlank()) {
                            if (input.isNotBlank()) {
                                webSocketService.sendText(input)
                                input = ""
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Filled.ArrowUpward,
                        "发送",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }

    // History Sheet
    if (showHistorySheet) {
        ConversationHistorySheet(
            conversations = conversations,
            currentConversationId = currentConversation?.id,
            onSelectConversation = { conversationId ->
                conversationRepository.selectConversation(conversationId)
                val selectedConv = conversations.find { it.id == conversationId }
                webSocketService.setMessages(selectedConv?.messages ?: emptyList())
            },
            onNewConversation = {
                conversationRepository.createNewConversation()
                webSocketService.clearMessages()
            },
            onDeleteConversation = { conversationId ->
                conversationRepository.deleteConversation(conversationId)
                val current = conversationRepository.currentConversation.value
                webSocketService.setMessages(current?.messages ?: emptyList())
            },
            onDismiss = { showHistorySheet = false }
        )
    }
}

@Composable
fun MessageBubble(message: WSMessage, tokenManager: TokenManager, onDownload: (WSMessage) -> Unit) {
    val isOwn = message.isOwn
    
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isOwn) Alignment.End else Alignment.Start
    ) {
        if (!isOwn) {
            Text(
                text = message.deviceName,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                modifier = Modifier.padding(start = 12.dp, bottom = 4.dp)
            )
        }

        Surface(
            color = if (isOwn) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
            shape = if (isOwn) 
                RoundedCornerShape(20.dp, 20.dp, 4.dp, 20.dp) 
            else 
                RoundedCornerShape(20.dp, 20.dp, 20.dp, 4.dp),
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clickable(enabled = message.type == "file") {
                    if (message.type == "file") onDownload(message)
                },
            shadowElevation = 1.dp
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                if (message.type == "file") {
                    if (message.mimeType.startsWith("image/") && message.fileId.isNotEmpty()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color.Black.copy(alpha = 0.1f),
                            modifier = Modifier.padding(bottom = 8.dp)
                        ) {
                            AsyncImage(
                                model = ImageRequest.Builder(LocalContext.current)
                                    .data("${NetworkModule.SERVER_URL}/api/v1/files/${message.fileId}")
                                    .addHeader("Authorization", "Bearer ${tokenManager.getToken()}")
                                    .crossfade(true)
                                    .build(),
                                contentDescription = message.filename,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .width(200.dp)
                                    .heightIn(max = 200.dp)
                            )
                        }
                    }
                    
                    // File Attachment UI
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isOwn) Color.White.copy(alpha = 0.2f) else MaterialTheme.colorScheme.background.copy(alpha = 0.5f),
                            modifier = Modifier.size(32.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = message.filename.extension().uppercase().take(3),
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Bold
                                    ),
                                    color = if (isOwn) Color.White else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                        
                        Column {
                            Text(
                                text = message.filename,
                                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                                color = if (isOwn) Color.White else MaterialTheme.colorScheme.onSurface,
                                maxLines = 1
                            )
                            Text(
                                text = "点击下载",
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                color = if (isOwn) Color.White.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isOwn) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

private fun String.extension(): String = substringAfterLast('.', "")