package com.synchub.app.ui.files

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.synchub.app.data.TokenManager
import com.synchub.app.network.FileApi
import com.synchub.app.network.FileItem
import com.synchub.app.network.FileUpdateRequest
import com.synchub.app.network.NetworkModule
import com.synchub.app.utils.FileUtil
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody

@Composable
fun FilesScreen(
    fileApi: FileApi,
    clientId: String,
    tokenManager: TokenManager,
    onDownload: (FileItem) -> Unit,
    bottomNavHeight: androidx.compose.ui.unit.Dp = 0.dp
) {
    var files by remember { mutableStateOf<List<FileItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isUploading by remember { mutableStateOf(false) }
    var deleteFileId by remember { mutableStateOf<String?>(null) }
    var isDeleting by remember { mutableStateOf(false) }
    var previewFile by remember { mutableStateOf<FileItem?>(null) }
    var isUpdatingVisibility by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val fetchFiles: suspend () -> Unit = {
        try {
            files = fileApi.listFiles(source = "drive")
        } catch (e: Exception) {
            // Handle error
        } finally {
            isLoading = false
        }
    }

    val launcher = rememberLauncherForActivityResult(contract = ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            scope.launch {
                isUploading = true
                try {
                    val part = FileUtil.getMultipartBody(context, it)
                    if (part != null) {
                        val isPublic = "false".toRequestBody("text/plain".toMediaTypeOrNull())
                        val notifyWs = "false".toRequestBody("text/plain".toMediaTypeOrNull())
                        val source = "drive".toRequestBody("text/plain".toMediaTypeOrNull())
                        val deviceName = "Android".toRequestBody("text/plain".toMediaTypeOrNull())
                        val clientIdPart = clientId.toRequestBody("text/plain".toMediaTypeOrNull())
                        fileApi.uploadFile(part, isPublic, notifyWs, source, deviceName, clientIdPart)
                        fetchFiles()
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                } finally {
                    isUploading = false
                }
            }
        }
    }

    val togglePublic: suspend (FileItem) -> Unit = { file ->
        isUpdatingVisibility = true
        try {
            val updated = fileApi.updateFile(file.id, FileUpdateRequest(is_public = !file.is_public))
            files = files.map { if (it.id == file.id) updated else it }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isUpdatingVisibility = false
        }
    }

    val isImage: (FileItem) -> Boolean = { f -> f.mime_type?.startsWith("image/") == true }

    val deleteFile: suspend (String) -> Unit = { fileId ->
        isDeleting = true
        try {
            fileApi.deleteFile(fileId)
            files = files.filter { it.id != fileId }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isDeleting = false
            deleteFileId = null
        }
    }

    // 删除确认对话框
    if (deleteFileId != null) {
        AlertDialog(
            onDismissRequest = { deleteFileId = null },
            title = { Text("删除文件") },
            text = { Text("确定要删除这个文件吗？此操作不可恢复。") },
            confirmButton = {
                TextButton(
                    onClick = { scope.launch { deleteFile(deleteFileId!!) } },
                    enabled = !isDeleting
                ) {
                    if (isDeleting) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Text("删除", color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteFileId = null }) {
                    Text("取消")
                }
            }
        )
    }

    // 图片预览弹窗
    if (previewFile != null) {
        AlertDialog(
            onDismissRequest = { previewFile = null },
            title = { Text(previewFile!!.filename) },
            text = {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data("${NetworkModule.SERVER_URL}${previewFile!!.download_url}")
                            .addHeader("Authorization", "Bearer ${tokenManager.getToken()}")
                            .crossfade(true)
                            .build(),
                        contentDescription = previewFile!!.filename,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        previewFile?.let { onDownload(it) }
                    }
                ) {
                    Text("下载")
                }
            },
            dismissButton = {
                TextButton(onClick = { previewFile = null }) {
                    Text("关闭")
                }
            }
        )
    }

    LaunchedEffect(Unit) {
        fetchFiles()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0.dp),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { launcher.launch("*/*") },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(bottom = bottomNavHeight)
            ) {
                if (isUploading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Filled.Add, contentDescription = "上传文件")
                }
            }
        }
    ) { padding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else if (files.isEmpty()) {
            // Empty State
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Surface(
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.size(80.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.InsertDriveFile,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "暂无文件",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "上传文件后将在此显示",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            Column(modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
            ) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "云盘",
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    IconButton(onClick = { scope.launch { fetchFiles() } }, enabled = !isLoading) {
                        Icon(Icons.Filled.Refresh, contentDescription = "刷新")
                    }
                }

                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 160.dp),
                    contentPadding = PaddingValues(
                        start = 24.dp,
                        end = 24.dp,
                        top = 8.dp,
                        bottom = 80.dp + bottomNavHeight
                    ),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(files, key = { it.id }) { file ->
                        FileCard(
                            file = file,
                            tokenManager = tokenManager,
                            onClick = {
                                if (isImage(file)) {
                                    previewFile = file
                                } else {
                                    onDownload(file)
                                }
                            },
                            onDelete = { deleteFileId = file.id },
                            onTogglePublic = { scope.launch { togglePublic(file) } },
                            updatingVisibility = isUpdatingVisibility
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileCard(
    file: FileItem,
    tokenManager: TokenManager,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onTogglePublic: () -> Unit,
    updatingVisibility: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            // Preview / Icon Area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1.5f)
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
                contentAlignment = Alignment.Center
            ) {
                if (file.mime_type?.startsWith("image/") == true && file.download_url != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data("${NetworkModule.SERVER_URL}${file.download_url}")
                            .addHeader("Authorization", "Bearer ${tokenManager.getToken()}")
                            .crossfade(true)
                            .build(),
                        contentDescription = file.filename,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        imageVector = if (file.mime_type?.startsWith("image") == true) Icons.Filled.Image else Icons.Filled.InsertDriveFile,
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                }

                // 删除按钮
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                        .size(28.dp)
                        .background(
                            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f),
                            shape = RoundedCornerShape(6.dp)
                        )
                ) {
                    Icon(
                        imageVector = Icons.Filled.Delete,
                        contentDescription = "删除",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }

            // File Info
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                Text(
                    text = file.filename,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = formatSize(file.size),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    TextButton(
                        onClick = onTogglePublic,
                        enabled = !updatingVisibility,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                    ) {
                        if (updatingVisibility) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(
                                imageVector = if (file.is_public) Icons.Filled.LockOpen else Icons.Filled.Lock,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (file.is_public) "公开" else "私密",
                                style = MaterialTheme.typography.labelSmall,
                                fontSize = 10.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

fun formatSize(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val exp = (Math.log(bytes.toDouble()) / Math.log(1024.0)).toInt()
    val pre = "KMGTPE"[exp - 1]
    return String.format("%.1f %sB", bytes / Math.pow(1024.0, exp.toDouble()), pre)
}