package com.synchub.app.network

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Body
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface FileApi {
    @GET("files/")
    suspend fun listFiles(
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 50,
        @Query("source") source: String? = null
    ): List<FileItem>

    @Multipart
    @POST("files/upload")
    suspend fun uploadFile(
        @Part file: MultipartBody.Part,
        @Part("is_public") isPublic: RequestBody,
        @Part("notify_ws") notifyWs: RequestBody,
        @Part("source") source: RequestBody,
        @Part("device_name") deviceName: RequestBody,
        @Part("client_id") clientId: RequestBody
    ): FileUploadResponse
    
    @DELETE("files/{file_id}")
    suspend fun deleteFile(@Path("file_id") fileId: String): DeleteResponse

    @PATCH("files/{file_id}")
    suspend fun updateFile(@Path("file_id") fileId: String, @Body body: FileUpdateRequest): FileItem
}

data class DeleteResponse(
    val message: String
)

data class FileUpdateRequest(
    val is_public: Boolean? = null,
    val filename: String? = null
)

data class FileItem(
    val id: String,
    val filename: String,
    val size: Long,
    val mime_type: String?,
    val is_public: Boolean,
    val share_token: String?,
    val created_at: String,
    val download_url: String?,
    val public_url: String?
)

data class FileUploadResponse(
    val file: FileItem,
    val message: String
)
