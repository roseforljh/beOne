package com.synchub.app.ui.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.synchub.app.data.TokenManager

@Composable
fun SettingsScreen(
    tokenManager: TokenManager,
    onLogout: () -> Unit,
    bottomNavHeight: Dp = 0.dp
) {
    val context = LocalContext.current
    val username = tokenManager.getUsername() ?: "用户"
    val userId = tokenManager.getUserId()
    
    var showProfileDialog by remember { mutableStateOf(false) }
    var showPreferencesDialog by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }
    var showLogoutConfirmDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(start = 24.dp, end = 24.dp, top = 24.dp)
            .statusBarsPadding()
    ) {
        Text(
            text = "设置",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
        ) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .padding(16.dp)
                        .fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                        modifier = Modifier.size(64.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = username.take(1).uppercase(),
                                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Column {
                        Text(
                            text = username,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "ID: $userId",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            SettingsSectionTitle("账户")
            SettingsItem(
                icon = Icons.Filled.Person,
                title = "个人信息",
                subtitle = "查看账户信息",
                onClick = { showProfileDialog = true }
            )
            
            Spacer(modifier = Modifier.height(24.dp))

            SettingsSectionTitle("应用")
            SettingsItem(
                icon = Icons.Default.Settings,
                title = "偏好设置",
                subtitle = "主题、通知等设置",
                onClick = { showPreferencesDialog = true }
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            SettingsItem(
                icon = Icons.Default.DeleteSweep,
                title = "清除缓存",
                subtitle = "清理应用缓存数据",
                onClick = {
                    clearAppCache(context)
                    Toast.makeText(context, "缓存已清除", Toast.LENGTH_SHORT).show()
                }
            )
            
            Spacer(modifier = Modifier.height(24.dp))

            SettingsSectionTitle("关于")
            SettingsItem(
                icon = Icons.Default.Info,
                title = "关于应用",
                subtitle = "版本信息与帮助",
                onClick = { showAboutDialog = true }
            )

            Spacer(modifier = Modifier.height(32.dp))
        }

        Button(
            onClick = { showLogoutConfirmDialog = true },
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.error
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = bottomNavHeight + 16.dp)
                .height(50.dp)
        ) {
            Icon(Icons.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("退出登录")
        }
    }
    
    if (showProfileDialog) {
        ProfileDialog(
            username = username,
            userId = userId.toString(),
            onDismiss = { showProfileDialog = false },
            onCopyId = {
                copyToClipboard(context, userId.toString())
                Toast.makeText(context, "已复制用户ID", Toast.LENGTH_SHORT).show()
            }
        )
    }
    
    if (showPreferencesDialog) {
        PreferencesDialog(onDismiss = { showPreferencesDialog = false })
    }
    
    if (showAboutDialog) {
        AboutDialog(
            onDismiss = { showAboutDialog = false },
            onOpenGithub = {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com"))
                context.startActivity(intent)
            }
        )
    }
    
    if (showLogoutConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirmDialog = false },
            icon = { Icon(Icons.Default.ExitToApp, contentDescription = null) },
            title = { Text("确认退出") },
            text = { Text("确定要退出登录吗？") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showLogoutConfirmDialog = false
                        tokenManager.clearToken()
                        onLogout()
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) { Text("退出") }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirmDialog = false }) { Text("取消") }
            }
        )
    }
}

@Composable
fun ProfileDialog(username: String, userId: String, onDismiss: () -> Unit, onCopyId: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Person, contentDescription = null) },
        title = { Text("个人信息") },
        text = {
            Column {
                ProfileInfoRow("用户名", username)
                Spacer(modifier = Modifier.height(12.dp))
                ProfileInfoRow("用户ID", userId)
            }
        },
        confirmButton = { TextButton(onClick = onCopyId) { Text("复制ID") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("关闭") } }
    )
}

@Composable
fun ProfileInfoRow(label: String, value: String) {
    Column {
        Text(text = label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text = value, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
fun PreferencesDialog(onDismiss: () -> Unit) {
    var notificationsEnabled by remember { mutableStateOf(true) }
    var autoDownload by remember { mutableStateOf(false) }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Settings, contentDescription = null) },
        title = { Text("偏好设置") },
        text = {
            Column {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "消息通知", style = MaterialTheme.typography.bodyMedium)
                        Text(text = "接收新消息提醒", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = notificationsEnabled, onCheckedChange = { notificationsEnabled = it })
                }
                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "自动下载", style = MaterialTheme.typography.bodyMedium)
                        Text(text = "在Wi-Fi下自动下载文件", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = autoDownload, onCheckedChange = { autoDownload = it })
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("完成") } }
    )
}

@Composable
fun AboutDialog(onDismiss: () -> Unit, onOpenGithub: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Info, contentDescription = null) },
        title = { Text("关于 SyncHub") },
        text = {
            Column {
                Text(text = "版本: 1.0.0", style = MaterialTheme.typography.bodyMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "SyncHub 是一款跨设备同步工具，支持文本和文件的快速传输与同步。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(16.dp))
                Text(text = "功能特点：", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                Text(text = " 实时消息同步\n 文件上传与下载\n 跨平台支持\n 安全可靠", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        confirmButton = {
            TextButton(onClick = onOpenGithub) {
                Icon(Icons.Default.Link, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("访问主页")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("关闭") } }
    )
}

@Composable
fun SettingsSectionTitle(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
        modifier = Modifier.padding(bottom = 12.dp)
    )
}

@Composable
fun SettingsItem(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit = {}) {
    Surface(onClick = onClick, shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(imageVector = icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), color = MaterialTheme.colorScheme.onSurface)
                Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(imageVector = Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), modifier = Modifier.size(20.dp))
        }
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("User ID", text)
    clipboard.setPrimaryClip(clip)
}

private fun clearAppCache(context: Context) {
    try { context.cacheDir.deleteRecursively() } catch (e: Exception) { e.printStackTrace() }
}