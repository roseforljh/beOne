package com.synchub.app.ui.navigation

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Home : Screen("home") {
        object Chat : Screen("home/chat")
        object Files : Screen("home/files")
        object Gallery : Screen("home/gallery")
        object Settings : Screen("home/settings")
    }
}
