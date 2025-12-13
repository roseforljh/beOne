package com.synchub.app.utils

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream

object FileUtil {
    fun getMultipartBody(context: Context, uri: Uri): MultipartBody.Part? {
        val contentResolver = context.contentResolver
        val file = getFileFromUri(context, uri) ?: return null
        val requestFile = file.asRequestBody(contentResolver.getType(uri)?.toMediaTypeOrNull())
        return MultipartBody.Part.createFormData("file", file.name, requestFile)
    }

    private fun getFileFromUri(context: Context, uri: Uri): File? {
        val contentResolver = context.contentResolver
        val fileName = getFileName(contentResolver, uri) ?: "temp_file"
        val tempFile = File(context.cacheDir, fileName)
        
        try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val outputStream = FileOutputStream(tempFile)
            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.close()
            return tempFile
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    private fun getFileName(contentResolver: ContentResolver, uri: Uri): String? {
        var name: String? = null
        val cursor = contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index != -1) {
                    name = it.getString(index)
                }
            }
        }
        return name
    }
}
