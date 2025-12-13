package com.synchub.app.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface AuthApi {
    @POST("auth/dev-login")
    suspend fun devLogin(@Body request: DevLoginRequest): TokenResponse

    @GET("auth/me")
    suspend fun getMe(): UserResponse
}

data class DevLoginRequest(
    val username: String,
    val email: String? = null
)

data class TokenResponse(
    val access_token: String,
    val token_type: String,
    val user: UserResponse
)

data class UserResponse(
    val id: Int,
    val username: String?,
    val email: String?,
    val avatar_url: String?,
    val auth_provider: String
)
