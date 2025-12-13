package com.synchub.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.compose.ui.unit.dp
import com.synchub.app.data.TokenManager
import com.synchub.app.data.ConversationRepository
import com.synchub.app.network.AuthApi
import com.synchub.app.network.FileApi
import com.synchub.app.network.NetworkModule
import com.synchub.app.service.WebSocketService
import com.synchub.app.ui.chat.ChatScreen
import com.synchub.app.ui.files.FilesScreen
import com.synchub.app.ui.gallery.GalleryScreen
import com.synchub.app.ui.login.LoginScreen
import com.synchub.app.ui.settings.SettingsScreen
import com.synchub.app.ui.navigation.Screen
import com.synchub.app.ui.theme.SyncHubTheme
import com.synchub.app.utils.FileUtil
import com.synchub.app.utils.DownloadUtil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import androidx.core.view.WindowCompat
import android.widget.Toast

class MainActivity : ComponentActivity() {
    private lateinit var webSocketService: WebSocketService
    private lateinit var fileApi: FileApi
    private lateinit var tokenManager: TokenManager
    private lateinit var conversationRepository: ConversationRepository

    private var hasToken by mutableStateOf(false)
    private var oauthJustSucceeded by mutableStateOf(false)

    private fun handleOAuthCallback(intent: Intent?): Boolean {
        val data = intent?.data ?: return false
        if (intent.action != Intent.ACTION_VIEW) return false
        if (data.scheme != "synchub" || data.host != "oauth") return false

        val token = data.getQueryParameter("token")
        if (!token.isNullOrBlank()) {
            tokenManager.saveToken(token)
            hasToken = true
            oauthJustSucceeded = true
            Toast.makeText(this, "OAuth 登录成功", Toast.LENGTH_SHORT).show()
            return true
        }

        Toast.makeText(this, "OAuth 回调无 token: ${data}", Toast.LENGTH_LONG).show()

        return false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // DI Injection (Manual for simplicity)
        tokenManager = TokenManager(applicationContext)
        hasToken = tokenManager.getToken() != null
        val okHttpClient = NetworkModule.provideOkHttpClient(tokenManager)
        val retrofit = NetworkModule.provideRetrofit(okHttpClient)
        val authApi = retrofit.create(AuthApi::class.java)

        fileApi = retrofit.create(FileApi::class.java)
        val conversationApi = retrofit.create(com.synchub.app.network.ConversationApi::class.java)
        conversationRepository = ConversationRepository(applicationContext, conversationApi)
        
        // WebSocket with message callback to save to conversation
        webSocketService = WebSocketService(okHttpClient, tokenManager) { message ->
            conversationRepository.addMessageToCurrentConversation(message)

            // Keep chat UI list in sync with backend conversation events
            if (message.type == "conversations_event" && message.content == "cleared") {
                val currentId = conversationRepository.currentConversation.value?.id
                if (currentId != null && currentId == message.fileId) {
                    webSocketService.clearMessages()
                }
            }
        }

        // If this launch is from OAuth deep link, save token before composing UI.
        val oauthSaved = handleOAuthCallback(intent)
        // Handle Share Intent if present
        handleIntent(intent)

        // Consume deep link intent so it won't retrigger on rotation/recreate.
        if (oauthSaved) {
            setIntent(Intent(this, MainActivity::class.java))
        }

        setContent {
            SyncHubTheme {
                val navController = rememberNavController()

                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route
                val density = LocalDensity.current
                // Use Compose WindowInsets (stateful) so first render already has correct values
                val isImeVisible = WindowInsets.ime.getBottom(density) > 0
                val navBarHeightDpNow = with(density) { WindowInsets.navigationBars.getBottom(density).toDp() }
                var navBarHeightDpStable by remember { mutableStateOf(0.dp) }
                LaunchedEffect(navBarHeightDpNow) {
                    if (navBarHeightDpNow > 0.dp) navBarHeightDpStable = navBarHeightDpNow
                }
                val bottomBarTotalHeight = 56.dp + navBarHeightDpStable
                val bottomNavHeightForScreens = bottomBarTotalHeight

                Scaffold(
                    contentWindowInsets = WindowInsets(0.dp),
                    bottomBar = {
                        if (currentRoute == Screen.Home.Chat.route || currentRoute == Screen.Home.Files.route || currentRoute == Screen.Home.Gallery.route || currentRoute == Screen.Home.Settings.route) {
                            Surface(
                                color = MaterialTheme.colorScheme.surface,
                                tonalElevation = 0.dp,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = navBarHeightDpStable)
                                        .height(56.dp)
                                        .padding(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.SpaceEvenly,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // 聊天
                                    AnimatedNavIcon(
                                        icon = Icons.Filled.ChatBubble,
                                        contentDescription = "聊天",
                                        selected = currentRoute == Screen.Home.Chat.route,
                                        onClick = {
                                            navController.navigate(Screen.Home.Chat.route) {
                                                popUpTo(Screen.Home.Chat.route) { saveState = true }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    )
                                    // 云盘
                                    AnimatedNavIcon(
                                        icon = Icons.Filled.Folder,
                                        contentDescription = "云盘",
                                        selected = currentRoute == Screen.Home.Files.route,
                                        onClick = {
                                            navController.navigate(Screen.Home.Files.route) {
                                                popUpTo(Screen.Home.Chat.route) { saveState = true }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    )
                                    // 图床
                                    AnimatedNavIcon(
                                        icon = Icons.Filled.Image,
                                        contentDescription = "图床",
                                        selected = currentRoute == Screen.Home.Gallery.route,
                                        onClick = {
                                            navController.navigate(Screen.Home.Gallery.route) {
                                                popUpTo(Screen.Home.Chat.route) { saveState = true }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    )
                                    // 设置
                                    AnimatedNavIcon(
                                        icon = Icons.Filled.Settings,
                                        contentDescription = "设置",
                                        selected = currentRoute == Screen.Home.Settings.route,
                                        onClick = {
                                            navController.navigate(Screen.Home.Settings.route) {
                                                popUpTo(Screen.Home.Chat.route) { saveState = true }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }
                ) { _ ->
                    // OAuth成功后主动导航到Chat页面
                    LaunchedEffect(oauthJustSucceeded) {
                        if (oauthJustSucceeded && hasToken) {
                            navController.navigate(Screen.Home.Chat.route) {
                                popUpTo(Screen.Login.route) { inclusive = true }
                            }
                            oauthJustSucceeded = false
                        }
                    }

                    NavHost(
                        navController = navController,
                        startDestination = if (hasToken) Screen.Home.Chat.route else Screen.Login.route,
                        modifier = Modifier.fillMaxSize()
                    ) {
                        composable(Screen.Login.route) {
                            LoginScreen(
                                authApi = authApi,
                                tokenManager = tokenManager,
                                onLoginSuccess = {
                                    navController.navigate(Screen.Home.Chat.route) {
                                        popUpTo(Screen.Login.route) { inclusive = true }
                                    }
                                }
                            )
                        }
                        
                        composable(Screen.Home.Chat.route) {
                            ChatScreen(
                                webSocketService = webSocketService,
                                tokenManager = tokenManager,
                                conversationRepository = conversationRepository,
                                onDownload = { msg ->
                                    if (msg.fileId.isNotEmpty()) {
                                        DownloadUtil.downloadFile(
                                            context = applicationContext,
                                            tokenManager = tokenManager,
                                            fileId = msg.fileId,
                                            filename = msg.filename,
                                            mimeType = msg.mimeType
                                        )
                                    }
                                },
                                bottomNavHeight = bottomNavHeightForScreens
                            )
                        }
                        
                        composable(Screen.Home.Files.route) {
                            FilesScreen(
                                fileApi = fileApi,
                                clientId = webSocketService.clientId,
                                tokenManager = tokenManager,
                                onDownload = { fileItem ->
                                    DownloadUtil.downloadFile(
                                        context = applicationContext,
                                        tokenManager = tokenManager,
                                        fileId = fileItem.id,
                                        filename = fileItem.filename,
                                        mimeType = fileItem.mime_type
                                    )
                                },
                                bottomNavHeight = bottomNavHeightForScreens
                            )
                        }
                        
                        composable(Screen.Home.Gallery.route) {
                            GalleryScreen(
                                fileApi = fileApi,
                                clientId = webSocketService.clientId,
                                tokenManager = tokenManager,
                                bottomNavHeight = bottomNavHeightForScreens
                            )
                        }

                        composable(Screen.Home.Settings.route) {
                            SettingsScreen(
                                tokenManager = tokenManager,
                                onLogout = {
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(Screen.Home.Chat.route) { inclusive = true }
                                    }
                                },
                                bottomNavHeight = bottomNavHeightForScreens
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val oauthSaved = handleOAuthCallback(intent)
        handleIntent(intent)

        if (oauthSaved) {
            // Consume deep link intent to avoid retrigger on rotation
            setIntent(Intent(this, MainActivity::class.java))
            // 不再调用recreate()，让LaunchedEffect处理导航
            // oauthJustSucceeded状态变化会触发Compose重组和导航
        }
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND) return
        if (tokenManager.getToken() == null) return

        when {
            intent.type?.startsWith("text/") == true -> {
                intent.getStringExtra(Intent.EXTRA_TEXT)?.let { text ->
                    // Make sure WS is connected
                    webSocketService.connect()
                    webSocketService.sendText(text)
                }
            }
            intent.type?.startsWith("image/") == true || intent.type?.startsWith("application/") == true -> {
                (intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))?.let { uri ->
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val part = FileUtil.getMultipartBody(applicationContext, uri)
                            if (part != null) {
                                val isPublic = "false".toRequestBody("text/plain".toMediaTypeOrNull())
                                val notifyWs = "true".toRequestBody("text/plain".toMediaTypeOrNull())
                                val source = "drive".toRequestBody("text/plain".toMediaTypeOrNull())
                                val deviceName = "Android".toRequestBody("text/plain".toMediaTypeOrNull())
                                val clientIdPart = webSocketService.clientId.toRequestBody("text/plain".toMediaTypeOrNull())
                                val response = fileApi.uploadFile(part, isPublic, notifyWs, source, deviceName, clientIdPart)
                                webSocketService.addLocalFileMessage(response.file)
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnimatedNavIcon(
    icon: ImageVector,
    contentDescription: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.3f else 1f,
        animationSpec = spring(
            dampingRatio = 0.6f,
            stiffness = 400f
        ),
        label = "iconScale"
    )
    
    Box(
        modifier = Modifier
            .size(48.dp)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() }
            ) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier
                .size(24.dp)
                .scale(scale),
            tint = if (selected) 
                MaterialTheme.colorScheme.primary 
            else 
                MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}