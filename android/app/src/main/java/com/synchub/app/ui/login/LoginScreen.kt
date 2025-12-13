package com.synchub.app.ui.login

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.synchub.app.data.TokenManager
import com.synchub.app.network.AuthApi
import com.synchub.app.network.DevLoginRequest
import com.synchub.app.network.NetworkModule
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    authApi: AuthApi,
    tokenManager: TokenManager,
    onLoginSuccess: () -> Unit
) {
    var username by remember { mutableStateOf("dev_user") }
    var isLoading by remember { mutableStateOf(false) }
    var oauthLoading by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .widthIn(max = 350.dp)
                    .padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Cloud Icon
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(
                            color = MaterialTheme.colorScheme.primary,
                            shape = RoundedCornerShape(12.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Cloud,
                        contentDescription = "SyncHub",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(28.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Title
                Text(
                    text = "SyncHub",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.SemiBold
                    ),
                    color = MaterialTheme.colorScheme.onBackground
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Subtitle
                Text(
                    text = "输入用户名登录您的账户",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Username Label
                Text(
                    text = "用户名",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                )

                // Username Input
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    placeholder = { Text("dev_user") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(8.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Sign In Button
                Button(
                    onClick = {
                        scope.launch {
                            isLoading = true
                            try {
                                val response = authApi.devLogin(DevLoginRequest(username = username))
                                tokenManager.saveToken(response.access_token)
                                tokenManager.saveUser(response.user.id, response.user.username ?: "Unknown")
                                onLoginSuccess()
                            } catch (e: Exception) {
                                snackbarHostState.showSnackbar("登录失败: ${e.message}")
                            } finally {
                                isLoading = false
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    enabled = !isLoading && oauthLoading == null,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("开发者账户登录")
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Divider with "Or continue with"
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Divider(
                        modifier = Modifier.weight(1f),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                    )
                    Text(
                        text = "或者使用",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                    Divider(
                        modifier = Modifier.weight(1f),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // OAuth Buttons Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // GitHub Button
                    OutlinedButton(
                        onClick = {
                            oauthLoading = "github"
                            val authUrl = "${NetworkModule.SERVER_URL}/api/v1/auth/github/authorize"
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
                            context.startActivity(intent)
                            oauthLoading = null
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(8.dp),
                        enabled = !isLoading && oauthLoading == null
                    ) {
                        if (oauthLoading == "github") {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                // GitHub Icon (simplified)
                                Text(
                                    text = "⌘",
                                    fontSize = 16.sp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Github")
                            }
                        }
                    }

                    // Google Button
                    OutlinedButton(
                        onClick = {
                            oauthLoading = "google"
                            val authUrl = "${NetworkModule.SERVER_URL}/api/v1/auth/google/authorize"
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
                            context.startActivity(intent)
                            oauthLoading = null
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(8.dp),
                        enabled = !isLoading && oauthLoading == null
                    ) {
                        if (oauthLoading == "google") {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                // Google Icon (simplified G)
                                Text(
                                    text = "G",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Google")
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Terms and Privacy
                val annotatedText = buildAnnotatedString {
                    append("点击继续即表示您同意我们的")
                    pushStringAnnotation(tag = "terms", annotation = "terms")
                    withStyle(style = SpanStyle(
                        textDecoration = TextDecoration.Underline,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )) {
                        append("服务条款")
                    }
                    pop()
                    append("和")
                    pushStringAnnotation(tag = "privacy", annotation = "privacy")
                    withStyle(style = SpanStyle(
                        textDecoration = TextDecoration.Underline,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )) {
                        append("隐私政策")
                    }
                    pop()
                    append("。")
                }

                ClickableText(
                    text = annotatedText,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    ),
                    modifier = Modifier.padding(horizontal = 16.dp),
                    onClick = { offset ->
                        annotatedText.getStringAnnotations(tag = "terms", start = offset, end = offset)
                            .firstOrNull()?.let {
                                // Handle terms click
                            }
                        annotatedText.getStringAnnotations(tag = "privacy", start = offset, end = offset)
                            .firstOrNull()?.let {
                                // Handle privacy click
                            }
                    }
                )
            }
        }
    }
}
