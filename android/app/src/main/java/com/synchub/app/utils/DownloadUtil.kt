package com.synchub.app.utils

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import com.synchub.app.data.TokenManager
import com.synchub.app.network.NetworkModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream

object DownloadUtil {
    private val client = OkHttpClient.Builder().build()
    
    fun downloadFile(context: Context, tokenManager: TokenManager, fileId: String, filename: String, mimeType: String?) {
        val token = tokenManager.getToken()
        if (token == null) {
            Toast.makeText(context, "Authentication required", Toast.LENGTH_SHORT).show()
            return
        }

        val url = "${NetworkModule.SERVER_URL}/api/v1/files/$fileId"
        Log.d("DownloadUtil", "Starting download: $url")
        
        Toast.makeText(context, "开始下载...", Toast.LENGTH_SHORT).show()
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = Request.Builder()
                    .url(url)
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                
                val response = client.newCall(request).execute()
                
                if (!response.isSuccessful) {
                    Log.e("DownloadUtil", "Download failed: ${response.code} ${response.message}")
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "下载失败: ${response.code}", Toast.LENGTH_SHORT).show()
                    }
                    return@launch
                }
                
                val body = response.body
                if (body == null) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "下载失败: 空响应", Toast.LENGTH_SHORT).show()
                    }
                    return@launch
                }
                
                // Save to Downloads folder
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Use MediaStore for Android 10+
                    val contentValues = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, filename)
                        put(MediaStore.Downloads.MIME_TYPE, mimeType ?: "application/octet-stream")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    
                    val resolver = context.contentResolver
                    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    
                    if (uri != null) {
                        resolver.openOutputStream(uri)?.use { outputStream ->
                            body.byteStream().use { inputStream ->
                                inputStream.copyTo(outputStream)
                            }
                        }
                        
                        contentValues.clear()
                        contentValues.put(MediaStore.Downloads.IS_PENDING, 0)
                        resolver.update(uri, contentValues, null, null)
                        
                        Log.d("DownloadUtil", "Download complete: $filename")
                        withContext(Dispatchers.Main) {
                            Toast.makeText(context, "下载完成: $filename", Toast.LENGTH_SHORT).show()
                        }
                    }
                } else {
                    // Legacy approach for older Android
                    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    val file = File(downloadsDir, filename)
                    
                    FileOutputStream(file).use { outputStream ->
                        body.byteStream().use { inputStream ->
                            inputStream.copyTo(outputStream)
                        }
                    }
                    
                    Log.d("DownloadUtil", "Download complete: $filename")
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "下载完成: $filename", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                Log.e("DownloadUtil", "Download error", e)
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "下载失败: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
