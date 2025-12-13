package com.synchub.app.utils

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import com.synchub.app.data.TokenManager
import com.synchub.app.network.NetworkModule

object DownloadUtil {
    fun downloadFile(context: Context, tokenManager: TokenManager, fileId: String, filename: String, mimeType: String?) {
        val token = tokenManager.getToken()
        if (token == null) {
            Toast.makeText(context, "Authentication required", Toast.LENGTH_SHORT).show()
            return
        }

        val url = "${NetworkModule.SERVER_URL}/api/v1/files/$fileId"
        
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(filename)
            .setDescription("Downloading $filename")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)
            .addRequestHeader("Authorization", "Bearer $token")
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)

        if (mimeType != null) {
            request.setMimeType(mimeType)
        }

        val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        try {
            downloadManager.enqueue(request)
            Toast.makeText(context, "Download started...", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(context, "Download failed: ${e.message}", Toast.LENGTH_SHORT).show()
            e.printStackTrace()
        }
    }
}
