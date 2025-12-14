package com.synchub.app.ui.gallery

import android.net.Uri
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
import com.synchub.app.network.NetworkModule
import com.synchub.app.utils.FileUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody

private enum class UploadStatus { PENDING, UPLOADING, SUCCESS, ERROR }

private data class UploadTask(
    val uri: Uri,
    val name: String,
    val progress: Int = 0,
    val status: UploadStatus = UploadStatus.PENDING,
    val error: String? = null
)

@Composable
fun GalleryScreen(
    fileApi: FileApi,
    clientId: String,
    tokenManager: TokenManager,
    bottomNavHeight: androidx.compose.ui.unit.Dp = 0.dp
) {
    var images by remember { mutableStateOf<List<FileItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isUploading by remember { mutableStateOf(false) }
    var deleteFileId by remember { mutableStateOf<String?>(null) }
    var isDeleting by remember { mutableStateOf(false) }
    var uploadTasks by remember { mutableStateOf<List<UploadTask>>(emptyList()) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val fetchImages: suspend () -> Unit = {
        try {
            val allFiles = fileApi.listFiles(source = "gallery")
            images = allFiles.filter { it.mime_type?.startsWith("image/") == true }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    val deleteImage: suspend (String) -> Unit = { fileId ->
        isDeleting = true
        try {
            fileApi.deleteFile(fileId)
            images = images.filter { it.id != fileId }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isDeleting = false
            deleteFileId = null
        }
    }

    fun startUpload(tasks: List<UploadTask>) {
        if (tasks.isEmpty()) return
        uploadTasks = tasks
        scope.launch {
            isUploading = true
            try {
                val isPublic = "true".toRequestBody("text/plain".toMediaTypeOrNull())
                val notifyWs = "false".toRequestBody("text/plain".toMediaTypeOrNull())
                val source = "gallery".toRequestBody("text/plain".toMediaTypeOrNull())
                val deviceName = "Android".toRequestBody("text/plain".toMediaTypeOrNull())
                val clientIdPart = clientId.toRequestBody("text/plain".toMediaTypeOrNull())

                for (t in tasks) {
                    uploadTasks = uploadTasks.map { if (it.uri == t.uri) it.copy(status = UploadStatus.UPLOADING, progress = 0, error = null) else it }
                    try {
                        val part = withContext(Dispatchers.IO) {
                            FileUtil.getMultipartBodyWithProgress(context, t.uri) { written, total ->
                                val percent = if (total <= 0L) 0 else ((written * 100f) / total).toInt().coerceIn(0, 100)
                                uploadTasks = uploadTasks.map { task ->
                                    if (task.uri == t.uri) task.copy(progress = percent) else task
                                }
                            }
                        }

                        if (part == null) {
                            uploadTasks = uploadTasks.map { task ->
                                if (task.uri == t.uri) task.copy(status = UploadStatus.ERROR, error = "无法读取文件") else task
                            }
                            continue
                        }

                        withContext(Dispatchers.IO) {
                            fileApi.uploadFile(part, isPublic, notifyWs, source, deviceName, clientIdPart)
                        }
                        uploadTasks = uploadTasks.map { task ->
                            if (task.uri == t.uri) task.copy(status = UploadStatus.SUCCESS, progress = 100) else task
                        }
                    } catch (e: Exception) {
                        uploadTasks = uploadTasks.map { task ->
                            if (task.uri == t.uri) task.copy(status = UploadStatus.ERROR, error = (e.message ?: "上传失败")) else task
                        }
                    }
                }
                fetchImages()
                if (uploadTasks.isNotEmpty() && uploadTasks.all { it.status == UploadStatus.SUCCESS }) {
                    uploadTasks = emptyList()
                }
            } finally {
                isUploading = false
            }
        }
    }

    fun retryUpload(uri: Uri) {
        val t = uploadTasks.find { it.uri == uri } ?: return
        startUpload(listOf(t.copy(status = UploadStatus.PENDING, progress = 0, error = null)))
    }

    val launcher = rememberLauncherForActivityResult(contract = ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNullOrEmpty()) return@rememberLauncherForActivityResult

        val tasks = uris.map { uri ->
            UploadTask(uri = uri, name = FileUtil.getFileDisplayName(context, uri))
        }
        startUpload(tasks)
    }

    // 删除确认对话框
    if (deleteFileId != null) {
        AlertDialog(
            onDismissRequest = { deleteFileId = null },
            title = { Text("删除图片") },
            text = { Text("确定要删除这张图片吗？此操作不可恢复。") },
            confirmButton = {
                TextButton(
                    onClick = { scope.launch { deleteImage(deleteFileId!!) } },
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

    LaunchedEffect(Unit) {
        fetchImages()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0.dp),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { launcher.launch("image/*") },
                containerColor = Color(0xFFE91E63),
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(bottom = bottomNavHeight)
            ) {
                if (isUploading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Filled.Add, contentDescription = "上传图片")
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // Header
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "图床",
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    IconButton(onClick = { scope.launch { fetchImages() } }, enabled = !isLoading) {
                        Icon(Icons.Filled.Refresh, contentDescription = "刷新")
                    }
                }
                Text(
                    text = "上传图片，一键复制Markdown链接",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (uploadTasks.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .padding(horizontal = 24.dp)
                        .fillMaxWidth()
                        .heightIn(max = 220.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "上传队列 ${uploadTasks.count { it.status == UploadStatus.SUCCESS }}/${uploadTasks.size}",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        TextButton(onClick = { uploadTasks = emptyList() }) {
                            Text("关闭")
                        }
                    }
                    uploadTasks.forEach { t ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            tonalElevation = 1.dp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(t.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        val sub = when (t.status) {
                                            UploadStatus.PENDING -> "等待中"
                                            UploadStatus.UPLOADING -> "上传中"
                                            UploadStatus.SUCCESS -> "完成"
                                            UploadStatus.ERROR -> t.error ?: "失败"
                                        }
                                        Text(sub, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    if (t.status == UploadStatus.ERROR) {
                                        TextButton(onClick = { retryUpload(t.uri) }) {
                                            Text("重试")
                                        }
                                    } else {
                                        Text(
                                            text = "${t.progress}%",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                LinearProgressIndicator(
                                    progress = (t.progress / 100f).coerceIn(0f, 1f),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 8.dp),
                                    color = when (t.status) {
                                        UploadStatus.ERROR -> MaterialTheme.colorScheme.error
                                        UploadStatus.SUCCESS -> Color(0xFF2E7D32)
                                        else -> Color(0xFFE91E63)
                                    }
                                )
                            }
                        }
                    }
                }
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFFE91E63))
                }
            } else if (images.isEmpty()) {
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
                                imageVector = Icons.Default.Image,
                                contentDescription = null,
                                modifier = Modifier.size(40.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "暂无图片",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "上传图片开始使用图床功能",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        top = 8.dp,
                        bottom = 80.dp + bottomNavHeight
                    ),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(images, key = { it.id }) { image ->
                        GalleryImageCard(
                            image = image,
                            tokenManager = tokenManager,
                            onCopyMarkdown = {
                                val publicUrl = if (image.public_url != null) {
                                    if (image.public_url.startsWith("http")) image.public_url else "${NetworkModule.SERVER_URL}${image.public_url}"
                                } else {
                                    "${NetworkModule.SERVER_URL}/p/${image.share_token}"
                                }
                                val markdown = "![${image.filename}]($publicUrl)"
                                copyToClipboard(context, markdown)
                                Toast.makeText(context, "Markdown已复制", Toast.LENGTH_SHORT).show()
                            },
                            onCopyLink = {
                                val publicUrl = if (image.public_url != null) {
                                    if (image.public_url.startsWith("http")) image.public_url else "${NetworkModule.SERVER_URL}${image.public_url}"
                                } else {
                                    "${NetworkModule.SERVER_URL}/p/${image.share_token}"
                                }
                                copyToClipboard(context, publicUrl)
                                Toast.makeText(context, "链接已复制", Toast.LENGTH_SHORT).show()
                            },
                            onDelete = { deleteFileId = image.id }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun GalleryImageCard(
    image: FileItem,
    tokenManager: TokenManager,
    onCopyMarkdown: () -> Unit,
    onCopyLink: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            // 图片预览
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                // 使用缩略图接口优化网络性能
                val thumbUrl = if (image.public_url != null) {
                    val base = if (image.public_url.startsWith("http")) image.public_url else "${NetworkModule.SERVER_URL}${image.public_url}"
                    "${base}/thumb?size=300"
                } else {
                    "${NetworkModule.SERVER_URL}/api/v1/files/${image.id}/thumb?size=300"
                }
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(thumbUrl)
                        .addHeader("Authorization", "Bearer ${tokenManager.getToken()}")
                        .crossfade(true)
                        .memoryCacheKey("thumb_${image.id}")
                        .diskCacheKey("thumb_${image.id}")
                        .build(),
                    contentDescription = image.filename,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                
                // 删除按钮
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                        .size(28.dp)
                        .background(
                            color = Color.Black.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(6.dp)
                        )
                ) {
                    Icon(
                        imageVector = Icons.Filled.Delete,
                        contentDescription = "删除",
                        modifier = Modifier.size(16.dp),
                        tint = Color.White
                    )
                }
                
                // 公开状态指示
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = if (image.is_public) Color(0xFF10B981).copy(alpha = 0.9f) else Color.Gray.copy(alpha = 0.9f),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                ) {
                    Text(
                        text = if (image.is_public) "公开" else "私密",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            // 底部操作区
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = image.filename,
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // 复制MD按钮
                    Surface(
                        onClick = onCopyMarkdown,
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFFE91E63),
                        modifier = Modifier.weight(1f)
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Filled.ContentCopy,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = Color.White
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                "MD",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color.White
                            )
                        }
                    }
                    
                    // 复制链接按钮
                    Surface(
                        onClick = onCopyLink,
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.weight(1f)
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Filled.Link,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                "链接",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("text", text)
    clipboard.setPrimaryClip(clip)
}
