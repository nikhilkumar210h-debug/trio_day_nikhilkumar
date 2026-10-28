package com.trioday.app

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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * LeaderboardScreen — port of leaderboard.html: Top-3 podium with
 * gold/silver/bronze cards (1st centered, elevated), the four ranking
 * tabs (Weekly XP, Global XP, Monthly, Streak) and the full ranked list
 * with the current user highlighted.
 */

private val LeaderboardKinds = listOf("Weekly XP", "Global XP", "Monthly", "Streak")

@Composable
fun LeaderboardScreen(
    socialApi: TrioSocialApi,
    myUid: String?,
    me: UserProfile? = null,
    onOpenProfile: (TrioUser) -> Unit
) {
    val c = TrioTheme.colors
    var kind by remember { mutableStateOf("Weekly XP") }
    var people by remember { mutableStateOf<List<TrioUser>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var retryToken by remember { mutableStateOf(0) }

    LaunchedEffect(kind, myUid, retryToken) {
        if (myUid == null) return@LaunchedEffect
        loading = true; error = null
        try {
            people = socialApi.leaderboard(kind)
        } catch (e: Exception) {
            error = e.message ?: "Could not load the leaderboard."
        } finally {
            loading = false
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(
            "Leaderboard",
            avatarName = me?.name,
            avatarUrl = me?.photoUrl
        )

        // Tabs
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            LeaderboardKinds.forEach { option ->
                val active = option == kind
                Text(
                    option,
                    color = if (active) Color.White else c.inkMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(50))
                        .background(
                            if (active) Brush.horizontalGradient(listOf(Primary, PrimaryStrong))
                            else Brush.horizontalGradient(listOf(c.glass, c.glass))
                        )
                        .border(1.dp, if (active) Color.Transparent else c.border, RoundedCornerShape(50))
                        .clickable { kind = option }
                        .padding(vertical = 8.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }

        ErrorBanner(error)

        if (myUid == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Sign in to view rankings.", color = c.inkMuted)
            }
            return
        }

        val podium = people.take(3)
        val rest = people.drop(3)

        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
        ) {
            if (loading) {
                items(6) { ActivitySkeletonRow() }
            } else {
                // ── Podium (1st center, 2nd left, 3rd right) ─────────────
                if (podium.isNotEmpty()) {
                    item {
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            podium.getOrNull(1)?.let { PodiumCard(it, 2, Silver, onOpenProfile, Modifier.weight(1f)) }
                            Spacer(Modifier.width(8.dp))
                            podium.getOrNull(0)?.let { PodiumCard(it, 1, Gold, onOpenProfile, Modifier.weight(1.15f)) }
                            Spacer(Modifier.width(8.dp))
                            podium.getOrNull(2)?.let { PodiumCard(it, 3, Bronze, onOpenProfile, Modifier.weight(1f)) }
                        }
                    }
                    item { Spacer(Modifier.height(6.dp)) }
                }

                items(rest, key = { it.uid }) { user ->
                    val rank = people.indexOf(user) + 1
                    RankRow(user, rank, kind, isMe = user.uid == myUid, onClick = { onOpenProfile(user) })
                }

                if (people.isEmpty() && !loading) {
                    item {
                        StateBox(
                            icon = "🏆", title = "No rankings yet",
                            body = "Complete activities to earn XP and appear here.",
                            actionLabel = T.t("retry", "EN"), onAction = { retryToken++ }
                        )
                    }
                }
                item { Spacer(Modifier.height(14.dp)) }
            }
        }
    }
}

@Composable
private fun PodiumCard(
    user: TrioUser,
    rank: Int,
    medal: Color,
    onOpenProfile: (TrioUser) -> Unit,
    modifier: Modifier = Modifier
) {
    val c = TrioTheme.colors
    val isFirst = rank == 1
    Column(
        modifier
            .clip(RoundedCornerShape(if (isFirst) 22.dp else 18.dp))
            .background(
                Brush.verticalGradient(
                    listOf(medal.copy(alpha = 0.18f), c.surface)
                )
            )
            .border(1.dp, medal.copy(alpha = 0.4f), RoundedCornerShape(if (isFirst) 22.dp else 18.dp))
            .clickable { onOpenProfile(user) }
            .padding(vertical = 14.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(if (isFirst) "👑" else when (rank) { 2 -> "🥈"; else -> "🥉" }, fontSize = if (isFirst) 20.sp else 15.sp)
        Spacer(Modifier.height(6.dp))
        TrioAvatar(user.name, user.photoUrl, size = if (isFirst) 56.dp else 44.dp)
        Spacer(Modifier.height(7.dp))
        Text(
            user.name.ifBlank { "Trio Member" },
            color = c.ink, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            maxLines = 1, overflow = TextOverflow.Ellipsis
        )
        Text(
            metricFor(user, "Weekly XP").let { "⚡ $it" },
            color = medal, fontSize = if (isFirst) 14.sp else 12.sp, fontWeight = FontWeight.ExtraBold
        )
    }
}

@Composable
private fun RankRow(
    user: TrioUser,
    rank: Int,
    kind: String,
    isMe: Boolean,
    onClick: () -> Unit
) {
    val c = TrioTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (isMe) c.primary.copy(alpha = 0.12f) else c.surface)
            .border(1.dp, if (isMe) Primary.copy(alpha = 0.4f) else c.border, RoundedCornerShape(14.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            "#$rank",
            color = if (rank <= 3) c.primaryText else c.inkDim,
            fontSize = 13.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.width(40.dp)
        )
        TrioAvatar(user.name, user.photoUrl, size = 36.dp)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                (if (isMe) "You · " else "") + user.name.ifBlank { "Trio Member" },
                color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
            Text(
                categoryIcon(user.category) + " " + (user.category.ifBlank { "Starter" }),
                color = c.inkDim, fontSize = 11.sp
            )
        }
        Text(
            metricFor(user, kind),
            color = c.primaryText, fontSize = 13.sp, fontWeight = FontWeight.Bold
        )
    }
}

private fun metricFor(user: TrioUser, kind: String): String = when (kind) {
    "Global XP" -> "${user.xp} XP"
    "Monthly" -> "${user.monthlyXp} XP"
    "Streak" -> "🔥 ${user.streak}"
    else -> "${user.weeklyXp} XP"
}
