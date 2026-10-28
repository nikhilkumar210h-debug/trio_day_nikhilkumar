package com.trioday.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/*
 * SettingsScreen — port of settings.html + the webapp's preference surfaces:
 * appearance (dark / light theme), language (EN / HI), the daily growth goal,
 * the sideload update checker and app info.
 */
@Composable
fun SettingsScreen(
    api: TrioApi,
    profile: UserProfile?,
    theme: String,
    language: String,
    versionName: String,
    onThemeChange: (String) -> Unit,
    onLanguageChange: (String) -> Unit,
    onProfileChanged: () -> Unit,
    onNotice: (String?) -> Unit,
    onBack: () -> Unit,
    onOpenPrivacy: () -> Unit,
    onCheckUpdates: () -> Unit,
    busy: Boolean
) {
    val scope = rememberCoroutineScope()
    val c = TrioTheme.colors
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var category by remember(profile?.selectedCategory) {
        mutableStateOf(profile?.selectedCategory?.takeIf { it.isNotBlank() } ?: "Starter")
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar("Settings", onBack = onBack, avatarName = profile?.name, avatarUrl = profile?.photoUrl)
        ErrorBanner(error)
        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp)
        ) {
            // ── Appearance ──────────────────────────────────────────────
            item { SectionLabel("APPEARANCE") }
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (theme == "dark") "🌙" else "☀️", fontSize = 20.sp)
                        Spacer(Modifier.padding(horizontal = 3.dp))
                        Column(Modifier.weight(1f).padding(start = 8.dp)) {
                            Text(
                                if (theme == "dark") "Dark theme" else "Light theme",
                                color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold
                            )
                            Text("Matches the Trio Day web experience.", color = c.inkMuted, fontSize = 12.sp)
                        }
                        TrioButton("Switch", { onThemeChange(if (theme == "dark") "light" else "dark") }, style = TrioButtonStyle.Secondary, height = 40.dp, fontSize = 13.sp)
                    }
                }
            }

            // ── Language ───────────────────────────────────────────────
            item { SectionLabel("LANGUAGE · भाषा") }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("EN" to "English", "HI" to "हिन्दी").forEach { (code, label) ->
                        val active = language == code
                        Text(
                            label,
                            color = if (active) Color.White else c.inkMuted,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(
                                    if (active) Brush.horizontalGradient(listOf(Primary, PrimaryStrong))
                                    else Brush.horizontalGradient(listOf(c.glass, c.glass))
                                )
                                .border(1.dp, if (active) Color.Transparent else c.border, RoundedCornerShape(14.dp))
                                .clickable { onLanguageChange(code) }
                                .padding(vertical = 12.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }

            // ── Daily goal ─────────────────────────────────────────────
            item { SectionLabel("YOUR DAILY GOAL") }
            items(GoalCategories, key = { it.key }) { goal ->
                val active = category == goal.key
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (active) c.primary.copy(alpha = 0.12f) else c.surface)
                        .border(1.dp, if (active) Primary.copy(alpha = 0.4f) else c.border, RoundedCornerShape(14.dp))
                        .clickable(enabled = !saving) {
                            category = goal.key
                            saving = true
                            scope.launch {
                                try {
                                    api.saveCategory(goal.key)
                                    onProfileChanged()
                                    onNotice("Goal switched to ${goal.title}.")
                                } catch (e: Exception) {
                                    error = e.message ?: "Could not save your goal."
                                } finally {
                                    saving = false
                                }
                            }
                        }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(goal.icon, fontSize = 18.sp)
                    Spacer(Modifier.padding(horizontal = 3.dp))
                    Text(
                        goal.title,
                        color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f).padding(start = 10.dp)
                    )
                    if (active) Text("✓", color = c.primaryText, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                }
            }

            // ── Legal ────────────────────────────────────────────────────
            item { SectionLabel("LEGAL") }
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(vertical = 6.dp)
                ) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onOpenPrivacy() }
                            .padding(horizontal = 16.dp, vertical = 13.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("🔒", fontSize = 16.sp)
                        Spacer(Modifier.padding(horizontal = 3.dp))
                        Text(
                            "Privacy Policy",
                            color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f).padding(start = 10.dp)
                        )
                        Text("›", color = c.inkDim, fontSize = 16.sp)
                    }
                }
            }

            // ── App updates ────────────────────────────────────────────
            item { SectionLabel("APP UPDATES") }
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Trio Day v$versionName", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                            Text("Check GitHub for a newer APK.", color = c.inkMuted, fontSize = 12.sp)
                        }
                        TrioButton("Check", onCheckUpdates, style = TrioButtonStyle.Secondary, height = 40.dp, fontSize = 13.sp, enabled = !busy, loading = busy)
                    }
                }
            }
            item { Spacer(Modifier.padding(vertical = 2.dp)) }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        color = TrioTheme.colors.primaryText,
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 2.sp
    )
}
