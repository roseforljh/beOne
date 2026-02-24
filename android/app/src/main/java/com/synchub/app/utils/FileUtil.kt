package com.synchub.app.utils

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okio.BufferedSink
import okio.Buffer
import okio.ForwardingSink
import okio.Sink
import okio.buffer
import java.io.File
import java.io.FileOutputStream

object FileUtil {
    fun getMultipartBody(context: Context, uri: Uri): MultipartBody.Part? {
        val contentResolver = context.contentResolver
        val file = getFileFromUri(context, uri) ?: return null
        val requestFile = file.asRequestBody(contentResolver.getType(uri)?.toMediaTypeOrNull())
        return MultipartBody.Part.createFormData("file", file.name, requestFile)
    }

    fun getMultipartBodyWithProgress(
        context: Context,
        uri: Uri,
        onProgress: (bytesWritten: Long, totalBytes: Long) -> Unit
    ): MultipartBody.Part? {
        val contentResolver = context.contentResolver
        val file = getFileFromUri(context, uri) ?: return null
        val raw = file.asRequestBody(contentResolver.getType(uri)?.toMediaTypeOrNull())
        val wrapped = ProgressRequestBody(raw, onProgress)
        return MultipartBody.Part.createFormData("file", file.name, wrapped)
    }

    fun getFileDisplayName(context: Context, uri: Uri): String {
        val contentResolver = context.contentResolver
        return getFileName(contentResolver, uri) ?: "temp_file"
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

    private class ProgressRequestBody(
        private val delegate: RequestBody,
        private val onProgress: (bytesWritten: Long, totalBytes: Long) -> Unit
    ) : RequestBody() {
        override fun contentType() = delegate.contentType()
        override fun contentLength() = delegate.contentLength()

        override fun writeTo(sink: BufferedSink) {
            val totalBytes = contentLength().coerceAtLeast(0L)
            var written = 0L
            val forwarding: Sink = object : ForwardingSink(sink) {
                override fun write(source: Buffer, byteCount: Long) {
                    super.write(source, byteCount)
                    written += byteCount
                    onProgress(written, totalBytes)
                }
            }
            val buffered = forwarding.buffer()
            delegate.writeTo(buffered)
            buffered.flush()
        }
    }
}
