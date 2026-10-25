package com.trioday.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/*
 * ProfileScreen — the "You" tab, a full port of profile.html:
 * identity (avatar + upload, Trio UID copy, bio), the gamification journey
 * card (level, XP track, global rank, weekly/monthly, streaks, shields),
 * the 6-badge grid, connections and quick actions.
 */
@Composable
fun ProfileScreen(
    api: TrioApi,
    socialApi: TrioSocialApi,
    profile: UserProfile?,
    language: String,
    onNavigate: (String) -> Unit,
    onSignOut: () -> Unit,
    onProfileChanged: () -> Unit,
    onNotice: (String?) -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val c = TrioTheme.colors

    var name by remember(profile?.name) { mutableStateOf(profile?.name.orEmpty()) }
    var bio by remember(profile?.bio) { mutableStateOf(profile?.bio.orEmpty()) }
    var followersCount by remember { mutableStateOf<Int?>(null) }
    var followingCount by remember { mutableStateOf<Int?>(null) }
    var globalRank by remember { mutableStateOf("—") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            busy = true; error = null
            try {
                TrioMedia.uploadProfilePhoto(api, context, uri)
                onProfileChanged()
                onNotice("Profile photo updated!")
            } catch (e: Exception) {
                error = e.message ?: "Could not upload that photo."
            } finally {
                busy = false
            }
        }
    }

    androidx.compose.runtime.LaunchedEffect(profile?.uid) {
        val uid = profile?.uid ?: return@LaunchedEffect
        try {
            followersCount = socialApi.connectionsCount(uid, following = false)
            followingCount = socialApi.connectionsCount(uid, following = true)
            val top = socialApi.leaderboard("Global XP")
            val rank = top.indexOfFirst { it.uid == uid } + 1
            if (rank > 0) globalRank = "$rank"
        } catch (_: Exception) {
            // Non-fatal: the journey card simply shows "—".
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp)
        ) {
            // ── Identity card ─────────────────────────────────────────
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
                        .background(Brush.verticalGradient(listOf(c.primary.copy(alpha = 0.14f), c.surface)))
                        .border(1.dp, c.border, RoundedCornerShape(22.dp))
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box {
                        TrioAvatar(profile?.name.orEmpty().ifBlank { "You" }, profile?.photoUrl.orEmpty(), 84.dp)
                        Box(
                            Modifier
                                .align(Alignment.BottomEnd)
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(Primary, PrimaryStrong)))
                                .border(2.dp, c.surface, CircleShape)
                                .clickable(enabled = !busy) {
                                    photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                                },
                            contentAlignment = Alignment.Center
                        ) { Text("📷", fontSize = 13.sp) }
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        profile?.name.orEmpty().ifBlank { "Your profile" },
                        color = c.ink, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        "@${profile?.userId.orEmpty().ifBlank { "TRIO" }}",
                        color = c.primaryText, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable {
                            val uid = profile?.userId.orEmpty()
                            if (uid.isNotBlank()) {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                clipboard.setPrimaryClip(ClipData.newPlainText("Trio UID", uid))
                                Toast.makeText(context, "Trio UID copied", Toast.LENGTH_SHORT).show()
                            }
                        }
                    )
                    if (!profile?.bio.isNullOrBlank()) {
                        Text(
                            profile!!.bio,
                            color = c.inkMuted, fontSize = 13.sp,
                            modifier = Modifier.padding(top = 8.dp, start = 12.dp, end = 12.dp)
                        )
                    }
                    Spacer(Modifier.height(14.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onNavigate("Connections") }) {
                            Text("${followersCount ?: "…"}", color = c.ink, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                            Text("Followers", color = c.inkMuted, fontSize = 11.sp)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onNavigate("Connections") }) {
                            Text("${followingCount ?: "…"}", color = c.ink, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                            Text("Following", color = c.inkMuted, fontSize = 11.sp)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(globalRank, color = c.ink, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                            Text("Global rank", color = c.inkMuted, fontSize = 11.sp)
                        }
                    }
                }
            }

            // ── Journey card ───────────────────────────────────────────
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(22.dp))
                        .padding(20.dp)
                ) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("YOUR JOURNEY", color = c.inkMuted, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 2.sp)
                        TagPill("Level ${profile?.level ?: 1L}", c.primaryText, c.primary.copy(alpha = 0.12f))
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "${xpIntoLevel(profile?.xp ?: 0L)} / $XP_PER_LEVEL XP",
                        color = c.ink, fontSize = 17.sp, fontWeight = FontWeight.Bold
                    )
                    Text(
                        "Next: Level ${(profile?.level ?: 1L) + 1}",
                        color = c.inkMuted, fontSize = 11.sp
                    )
                    Spacer(Modifier.height(10.dp))
                    XpProgressTrack(xpIntoLevel(profile?.xp ?: 0L))
                    Spacer(Modifier.height(16.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        StatTile("Total XP", "${profile?.xp ?: 0L}", c.ink)
                        StatTile("Weekly XP", "${profile?.weeklyXp ?: 0L}", c.primaryText)
                        StatTile("Monthly XP", "${profile?.monthlyXp ?: 0L}", c.primaryText)
                        StatTile("Streak", "${profile?.streak ?: 0L}🔥", c.warm)
                    }
                    Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                        StatTile("Best streak", "${profile?.bestStreak ?: 0L}")
                        StatTile("Shields", "🛡 ${profile?.shields ?: 0L}")
                    }
                }
            }

            // ── Shield activation ──────────────────────────────────────
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.primary.copy(alpha = 0.08f))
                        .border(1.dp, c.primary.copy(alpha = 0.22f), RoundedCornerShape(18.dp))
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🛡", fontSize = 22.sp)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Streak shields", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(
                                if ((profile?.shields ?: 0L) > 0)
                                    "Activate to protect your streak for a missed day."
                                else "Earn shields by keeping a 3+ day streak.",
                                color = c.inkMuted, fontSize = 12.sp
                            )
                        }
                    }
                    if ((profile?.shields ?: 0L) > 0) {
                        Spacer(Modifier.height(12.dp))
                        TrioButton(
                            label = "Activate a shield",
                            onClick = {
                                scope.launch {
                                    busy = true; error = null
                                    try {
                                        api.useShield()
                                        onProfileChanged()
                                        onNotice("Shield activated — your streak is protected today.")
                                    } catch (e: Exception) {
                                        error = e.message ?: "Could not activate the shield."
                                    } finally {
                                        busy = false
                                    }
                                }
                            },
                            enabled = !busy,
                            loading = busy,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            // ── Badges grid ────────────────────────────────────────────
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(16.dp)
                ) {
                    Text("🏅 Badges", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    val earned = profile?.badges ?: emptyList()
                    SystemBadges.chunked(3).forEach { rowBadges ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                            rowBadges.forEach { badge ->
                                val has = earned.contains(badge.id)
                                Column(
                                    Modifier
                                        .weight(1f)
                                        .padding(vertical = 8.dp)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(if (has) c.primary.copy(alpha = 0.12f) else c.glass)
                                        .padding(vertical = 10.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(badge.icon, fontSize = 22.sp, modifier = Modifier.alpha(if (has) 1f else 0.35f))
                                    Spacer(Modifier.height(4.dp))
                                    Text(badge.name, color = if (has) c.primaryText else c.inkDim, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            if (rowBadges.size < 3) repeat(3 - rowBadges.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }

            // ── Edit profile ───────────────────────────────────────────
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(16.dp)
                ) {
                    Text("✏️ Edit profile", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    TrioInput("Display name", name, { name = it }, Modifier.fillMaxWidth(), singleLine = true, maxLength = 60)
                    Spacer(Modifier.height(10.dp))
                    TrioInput("Bio", bio, { bio = it }, Modifier.fillMaxWidth(), singleLine = false, minLines = 2, maxLines = 4, maxLength = 160)
                    Spacer(Modifier.height(12.dp))
                    TrioButton(
                        label = "Save profile",
                        onClick = {
                            scope.launch {
                                busy = true; error = null
                                try {
                                    socialApi.saveProfile(name, bio)
                                    onProfileChanged()
                                    onNotice("Profile saved.")
                                } catch (e: Exception) {
                                    error = e.message ?: "Could not save the profile."
                                } finally {
                                    busy = false
                                }
                            }
                        },
                        enabled = name.isNotBlank() && !busy,
                        loading = busy,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // ── Menu ───────────────────────────────────────────────────
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(vertical = 6.dp)
                ) {
                    MenuRow("🔍", "Discover people") { onNavigate("Discover") }
                    MenuRow("🔔", "Notifications") { onNavigate("Notifications") }
                    MenuRow("⚙️", "Settings") { onNavigate("Settings") }
                    MenuRow("❓", "Help & about") { onNavigate("Help") }
                    MenuRow("🚪", "Sign out", danger = true, onClick = onSignOut)
                }
            }
            item { Spacer(Modifier.height(14.dp)) }
        }
        ErrorBanner(error)
    }
}

@Composable
private fun MenuRow(icon: String, label: String, danger: Boolean = false, onClick: () -> Unit) {
    val c = TrioTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, fontSize = 16.sp)
        Spacer(Modifier.width(12.dp))
        Text(
            label,
            color = if (danger) c.danger else c.ink,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1, overflow = TextOverflow.Ellipsis
        )
        Spacer(Modifier.weight(1f))
        Text("›", color = c.inkDim, fontSize = 16.sp)
    }
}
