package com.synchub.app.network

import retrofit2.http.*

data class ConversationMessageRequest(
    val type: String,
    val content: String? = null,
    val filename: String? = null,
    val file_id: String? = null,
    val mime_type: String? = null,
    val device_name: String = "Android"
)

data class ConversationMessageResponse(
    val id: String,
    val conversation_id: String,
    val type: String,
    val content: String?,
    val filename: String?,
    val file_id: String?,
    val mime_type: String?,
    val device_name: String,
    val created_at: String
)

data class ConversationResponse(
    val id: String,
    val user_id: Int,
    val title: String,
    val created_at: String,
    val updated_at: String,
    val message_count: Int = 0,
    val last_message: ConversationMessageResponse? = null,
    val messages: List<ConversationMessageResponse>? = null
)

data class ConversationCreateRequest(
    val title: String = "新会话"
)

data class ConversationUpdateRequest(
    val title: String? = null
)

interface ConversationApi {
    @GET("/api/v1/conversations")
    suspend fun listConversations(): List<ConversationResponse>

    @GET("/api/v1/conversations/{id}")
    suspend fun getConversation(@Path("id") id: String): ConversationResponse

    @POST("/api/v1/conversations")
    suspend fun createConversation(@Body request: ConversationCreateRequest): ConversationResponse

    @PATCH("/api/v1/conversations/{id}")
    suspend fun updateConversation(
        @Path("id") id: String,
        @Body request: ConversationUpdateRequest
    ): ConversationResponse

    @DELETE("/api/v1/conversations/{id}")
    suspend fun deleteConversation(@Path("id") id: String)

    @POST("/api/v1/conversations/{id}/clear")
    suspend fun clearConversation(@Path("id") id: String)

    @POST("/api/v1/conversations/{id}/messages")
    suspend fun addMessage(
        @Path("id") conversationId: String,
        @Body request: ConversationMessageRequest
    ): ConversationMessageResponse

    @GET("/api/v1/conversations/{id}/messages")
    suspend fun getMessages(@Path("id") conversationId: String): List<ConversationMessageResponse>
}
