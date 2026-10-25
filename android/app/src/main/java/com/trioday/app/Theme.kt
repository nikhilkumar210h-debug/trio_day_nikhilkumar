package com.trioday.app

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/*
 * TrioTheme — native port of the Trio Day web design tokens
 * (public/styles/tokens.css). Both themes are first-class: dark is the
 * "Deep Obsidian" default, light mirrors the webapp's #F8F7FF surfaces.
 */

// ── Brand primitives (identical to tokens.css) ─────────────────────────────
val Primary = Color(0xFF8B5CF6)        // --color-primary
val PrimaryStrong = Color(0xFF6366F1)   // --color-primary-strong
val Secondary = Color(0xFFA78BFA)       // --color-secondary
val Accent = Color(0xFF10B981)          // --color-accent
val Warm = Color(0xFFF59E0B)            // --color-warm / streak
val Danger = Color(0xFFEF4444)           // --color-danger

// Tricolor strip (signature webapp detail)
val TricolorSaffron = Color(0xFFFF9933)
val TricolorWhite = Color(0xFFF0F0F0)
val TricolorGreen = Color(0xFF128807)

// Podium medals (leaderboard.html)
val Gold = Color(0xFFFCCB48)
val Silver = Color(0xFFB9C2D0)
val Bronze = Color(0xFFD2915C)

@Immutable
data class TrioColors(
    // Surfaces
    val bg: Color,
    val bgElevated: Color,
    val bgHover: Color,
    val surface: Color,
    val surfaceStrong: Color,
    val surfaceHover: Color,
    // Glass
    val glass: Color,
    val glassStrong: Color,
    // Ink
    val ink: Color,
    val inkMuted: Color,
    val inkDim: Color,
    // Borders
    val border: Color,
    val borderStrong: Color,
    // Brand (foreground-safe variants)
    val primary: Color,
    val primaryStrong: Color,
    val primaryText: Color,
    val secondary: Color,
    val accent: Color,
    val warm: Color,
    val danger: Color,
    // Convenience derived
    val isLight: Boolean
)

private val DarkColors = TrioColors(
    bg = Color(0xFF090A0F),
    bgElevated = Color(0xFF12141D),
    bgHover = Color(0xFF1A1D2A),
    surface = Color(0xFF12141D),
    surfaceStrong = Color(0xFF1A1D2A),
    surfaceHover = Color(0xFF222632),
    glass = Color(0x0AFFFFFF),
    glassStrong = Color(0x14FFFFFF),
    ink = Color(0xFFF1F5F9),
    inkMuted = Color(0xFF94A3B8),
    inkDim = Color(0xFF64748B),
    border = Color(0x14FFFFFF),
    borderStrong = Color(0x24FFFFFF),
    primary = Primary,
    primaryStrong = PrimaryStrong,
    primaryText = Color(0xFFC4B5FD),
    secondary = Secondary,
    accent = Accent,
    warm = Warm,
    danger = Danger,
    isLight = false
)

private val LightColors = TrioColors(
    bg = Color(0xFFF8F7FF),
    bgElevated = Color(0xFFFFFFFF),
    bgHover = Color(0xFFEDE9FE),
    surface = Color(0xFFFFFFFF),
    surfaceStrong = Color(0xFFF8F7FF),
    surfaceHover = Color(0xFFEDE9FE),
    glass = Color(0x140F172A),
    glassStrong = Color(0x1F0F172A),
    ink = Color(0xFF0F172A),
    inkMuted = Color(0xFF334155),
    inkDim = Color(0xFF64748B),
    border = Color(0x246366F1),
    borderStrong = Color(0x386366F1),
    primary = Primary,
    primaryStrong = PrimaryStrong,
    primaryText = Color(0xFF6366F1),
    secondary = Secondary,
    accent = Accent,
    warm = Color(0xFFD97706),
    danger = Danger,
    isLight = true
)

val LocalTrioColors = staticCompositionLocalOf { DarkColors }

object TrioTheme {
    val colors: TrioColors
        @Composable get() = LocalTrioColors.current
}

@Composable
fun TrioTheme(
    lightTheme: Boolean,
    content: @Composable () -> Unit
) {
    val trio = if (lightTheme) LightColors else DarkColors
    val scheme: ColorScheme = if (lightTheme) {
        lightColorScheme(
            primary = Primary,
            onPrimary = Color.White,
            primaryContainer = Color(0xFFEDE9FE),
            secondary = PrimaryStrong,
            background = trio.bg,
            onBackground = trio.ink,
            surface = trio.surface,
            onSurface = trio.ink,
            surfaceVariant = trio.surfaceStrong,
            onSurfaceVariant = trio.inkMuted,
            outline = trio.borderStrong
        )
    } else {
        darkColorScheme(
            primary = Primary,
            onPrimary = Color.White,
            primaryContainer = Color(0xFF221C3A),
            secondary = Secondary,
            background = trio.bg,
            onBackground = trio.ink,
            surface = trio.surface,
            onSurface = trio.ink,
            surfaceVariant = trio.surfaceStrong,
            onSurfaceVariant = trio.inkMuted,
            outline = trio.borderStrong
        )
    }
    CompositionLocalProvider(LocalTrioColors provides trio) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}
