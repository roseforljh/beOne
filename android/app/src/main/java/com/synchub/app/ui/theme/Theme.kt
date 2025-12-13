package com.synchub.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Zinc Palette (Neutral)
val Zinc50 = Color(0xFFFAFAFA)
val Zinc100 = Color(0xFFF4F4F5)
val Zinc200 = Color(0xFFE4E4E7)
val Zinc300 = Color(0xFFD4D4D8)
val Zinc400 = Color(0xFFA1A1AA)
val Zinc500 = Color(0xFF71717A)
val Zinc600 = Color(0xFF52525B)
val Zinc700 = Color(0xFF3F3F46)
val Zinc800 = Color(0xFF27272A)
val Zinc900 = Color(0xFF18181B)
val Zinc950 = Color(0xFF09090B)

// Primary (Black/White high contrast)
val PrimaryLight = Color(0xFF18181B) // Zinc900
val PrimaryDark = Color(0xFFFAFAFA)  // Zinc50

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryDark,
    onPrimary = Zinc900,
    secondary = Zinc700,
    onSecondary = Zinc50,
    tertiary = Zinc800,
    background = Zinc950,
    onBackground = Zinc50,
    surface = Zinc900,
    onSurface = Zinc50,
    surfaceVariant = Zinc800,
    onSurfaceVariant = Zinc400,
    outline = Zinc700
)

private val LightColorScheme = lightColorScheme(
    primary = PrimaryLight,
    onPrimary = Zinc50,
    secondary = Zinc200,
    onSecondary = Zinc900,
    tertiary = Zinc100,
    background = Color.White,
    onBackground = Zinc900,
    surface = Color.White,
    onSurface = Zinc900,
    surfaceVariant = Zinc100,
    onSurfaceVariant = Zinc600,
    outline = Zinc300
)

@Composable
fun SyncHubTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Always false to enforce brand consistency
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Enable edge-to-edge
            WindowCompat.setDecorFitsSystemWindows(window, false)
            // Transparent status bar and navigation bar
            window.statusBarColor = android.graphics.Color.TRANSPARENT
            window.navigationBarColor = android.graphics.Color.TRANSPARENT
            // Set light/dark icons based on theme
            val insetsController = WindowCompat.getInsetsController(window, view)
            insetsController.isAppearanceLightStatusBars = !darkTheme
            insetsController.isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = MaterialTheme.typography,
        content = content
    )
}
