package com.synchub.app.data

import android.content.Context
import android.content.SharedPreferences

class TokenManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("auth_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USERNAME = "username"
        private const val KEY_EMAIL = "email"
        private const val KEY_AVATAR_URL = "avatar_url"
    }

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_ACCESS_TOKEN, token).commit()
    }

    fun getToken(): String? {
        return prefs.getString(KEY_ACCESS_TOKEN, null)
    }

    fun saveUser(id: Int, username: String) {
        saveUserProfile(id = id, username = username, email = null, avatarUrl = null)
    }

    fun saveUserProfile(id: Int, username: String, email: String?, avatarUrl: String?) {
        prefs.edit()
            .putInt(KEY_USER_ID, id)
            .putString(KEY_USERNAME, username)
            .putString(KEY_EMAIL, email)
            .putString(KEY_AVATAR_URL, avatarUrl)
            .apply()
    }

    fun getUsername(): String? {
        return prefs.getString(KEY_USERNAME, null)
    }

    fun getEmail(): String? {
        return prefs.getString(KEY_EMAIL, null)
    }

    fun getAvatarUrl(): String? {
        return prefs.getString(KEY_AVATAR_URL, null)
    }

    fun getUserId(): Int {
        return prefs.getInt(KEY_USER_ID, -1)
    }

    fun clearToken() {
        prefs.edit().clear().apply()
    }
}
