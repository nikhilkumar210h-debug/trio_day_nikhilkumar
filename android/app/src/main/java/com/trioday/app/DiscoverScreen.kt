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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/*
 * DiscoverScreen — port of all-users.html + search.html: the member
 * directory with live search, a streak leaderboard tab, and member
 * profile cards that open a detail sheet with follow / message actions.
 */

@Composable
fun DiscoverScreen(
    socialApi: TrioSocialApi,
    myUid: String?,
    me: UserProfile? = null,
    onBack: (() -> Unit)? = null,
    onOpenChat: (TrioUser) -> Unit
) {
    val scope = rememberCoroutineScope()
    val c = TrioTheme.colors
    var mode by remember { mutableStateOf("People") }        // People | Streaks
    var search by remember { mutableStateOf("") }
    var people by remember { mutableStateOf<List<TrioUser>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var selected by remember { mutableStateOf<TrioUser?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun load(query: String = search, kind: String = mode) {
        scope.launch {
            loading = true; error = null
            try {
                people = if (kind == "Streaks") socialApi.leaderboard("Streak")
                else socialApi.searchPeople(query)
            } catch (e: Exception) {
                error = e.message ?: "Could not load people."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(myUid) {
        if (myUid != null) load()
        else loading = false
    }

    val person = selected
    if (person != null) {
        MemberDetailScreen(
            socialApi = socialApi,
            myUid = myUid,
            person = person,
            onBack = { selected = null },
            onMessage = onOpenChat
        )
        return
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(
            "Discover",
            onBack = onBack,
            avatarName = me?.name,
            avatarUrl = me?.photoUrl
        )

        if (myUid == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Sign in to meet the Trio Day community.", color = c.inkMuted)
            }
            return
        }

        Column(Modifier.padding(horizontal = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    TrioInput(
                        label = "",
                        value = search,
                        onValueChange = { search = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = "Search by name or Trio ID",
                        maxLength = 60
                    )
                }
                Spacer(Modifier.width(8.dp))
                TrioButton("Search", { load(search, mode) }, height = 50.dp, fontSize = 13.sp)
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("People", "Streaks").forEach { option ->
                    val active = option == mode
                    Text(
                        option,
                        color = if (active) androidx.compose.ui.graphics.Color.White else c.inkMuted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(
                                if (active) Brush.horizontalGradient(listOf(Primary, PrimaryStrong))
                                else Brush.horizontalGradient(listOf(c.glass, c.glass))
                            )
                            .border(1.dp, if (active) androidx.compose.ui.graphics.Color.Transparent else c.border, RoundedCornerShape(50))
                            .clickable {
                                mode = option
                                load(search, option)
                            }
                            .padding(horizontal = 18.dp, vertical = 8.dp)
                    )
                }
            }
        }

        ErrorBanner(error)

        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
        ) {
            if (loading) items(6) { ActivitySkeletonRow() }
            else {
                items(people, key = { it.uid }) { user ->
                    MemberRow(
                        user = user,
                        rank = if (mode == "Streaks") people.indexOf(user) + 1 else null,
                        isMe = user.uid == myUid,
                        onClick = { selected = user }
                    )
                }
                if (people.isEmpty() && error == null) {
                    item {
                        StateBox(
                            icon = "🧭",
                            title = if (search.isBlank()) "No members found" else "No one matches “$search”",
                            body = "Try a different name or Trio ID.",
                            actionLabel = T.t("retry", "EN"), onAction = { load() }
                        )
                    }
                }
                item { Spacer(Modifier.height(12.dp)) }
            }
        }
    }
}

@Composable
fun MemberRow(
    user: TrioUser,
    rank: Int?,
    isMe: Boolean,
    onClick: () -> Unit
) {
    val c = TrioTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (isMe) c.primary.copy(alpha = 0.1f) else c.surface)
            .border(1.dp, if (isMe) Primary.copy(alpha = 0.35f) else c.border, RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        rank?.let {
            Text("#$it", color = c.warm, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.width(36.dp))
        }
        TrioAvatar(user.name, user.photoUrl, 44.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                user.name.ifBlank { "Trio Member" },
                color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
            Text(
                "@${user.userId.ifBlank { "trio-member" }} · ${categoryIcon(user.category)} ${user.category.ifBlank { "Starter" }}",
                color = c.inkDim, fontSize = 11.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("${user.xp} XP", color = c.primaryText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            if (user.streak > 0) Text("🔥 ${user.streak}", color = c.warm, fontSize = 11.sp)
        }
    }
}

/*
 * MemberDetailScreen — shared member profile sheet used by Discover,
 * Leaderboard and Chat: avatar, stats, follow / message actions.
 */
@Composable
fun MemberDetailScreen(
    socialApi: TrioSocialApi,
    myUid: String?,
    person: TrioUser,
    onBack: () -> Unit,
    onMessage: (TrioUser) -> Unit
) {
    val scope = rememberCoroutineScope()
    val c = TrioTheme.colors
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    var follows by remember { mutableStateOf(false) }

    LaunchedEffect(person.uid, myUid) {
        if (myUid == null) return@LaunchedEffect
        try {
            follows = socialApi.listConnections(myUid, true).any { it.uid == person.uid }
        } catch (_: Exception) {
            follows = false
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(person.name.ifBlank { "Member" }, onBack = onBack)
        ErrorBanner(error)
        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(20.dp)
        ) {
            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
                        .background(Brush.verticalGradient(listOf(c.primary.copy(alpha = 0.12f), c.surface)))
                        .border(1.dp, c.border, RoundedCornerShape(22.dp))
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    TrioAvatar(person.name, person.photoUrl, 76.dp)
                    Spacer(Modifier.height(10.dp))
                    Text(person.name.ifBlank { "Trio Member" }, color = c.ink, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold)
                    Text("@${person.userId.ifBlank { "trio-member" }}", color = c.primaryText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    if (person.bio.isNotBlank()) {
                        Text(person.bio, color = c.inkMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp, start = 8.dp, end = 8.dp))
                    }
                    Spacer(Modifier.height(14.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        StatTile("XP", "${person.xp}", c.ink)
                        StatTile("Level", "${person.level}", c.primaryText)
                        StatTile("Streak", "🔥 ${person.streak}", c.warm)
                        StatTile("Weekly", "${person.weeklyXp}")
                    }
                    Spacer(Modifier.height(6.dp))
                    Text("${categoryIcon(person.category)} ${person.category.ifBlank { "Starter" }}", color = c.inkMuted, fontSize = 12.sp)
                }
            }
            if (person.uid != myUid) {
                item {
                    Column {
                        TrioButton(
                            label = if (follows) "Following · tap to unfollow" else "＋ Follow",
                            onClick = {
                                scope.launch {
                                    working = true; error = null
                                    try {
                                        if (follows) socialApi.unfollow(person.uid)
                                        else socialApi.follow(person.uid)
                                        follows = !follows
                                    } catch (e: Exception) {
                                        error = e.message ?: "Could not update the connection."
                                    } finally {
                                        working = false
                                    }
                                }
                            },
                            style = if (follows) TrioButtonStyle.Secondary else TrioButtonStyle.Primary,
                            enabled = !working,
                            loading = working,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(10.dp))
                        TrioButton(
                            label = "💬 Message",
                            onClick = { onMessage(person) },
                            style = TrioButtonStyle.Secondary,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
            item { Spacer(Modifier.height(14.dp)) }
        }
    }
}

// ── Connections (followers / following) — profile.html connections panel ───
@Composable
fun ConnectionsScreen(
    socialApi: TrioSocialApi,
    myUid: String?,
    me: UserProfile? = null,
    onBack: () -> Unit
) {
    val c = TrioTheme.colors
    var mode by remember { mutableStateOf("Following") }
    var following by remember { mutableStateOf<List<TrioUser>>(emptyList()) }
    var followers by remember { mutableStateOf<List<TrioUser>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(myUid) {
        if (myUid == null) return@LaunchedEffect
        loading = true
        try {
            following = socialApi.listConnections(myUid, true)
            followers = socialApi.listConnections(myUid, false)
        } catch (e: Exception) {
            error = e.message ?: "Could not load connections."
        } finally {
            loading = false
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar("Connections", onBack = onBack, avatarName = me?.name, avatarUrl = me?.photoUrl)
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            listOf("Following", "Followers").forEach { option ->
                val active = option == mode
                val count = if (option == "Following") following.size else followers.size
                Text(
                    "$option · $count",
                    color = if (active) androidx.compose.ui.graphics.Color.White else c.inkMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(50))
                        .background(
                            if (active) Brush.horizontalGradient(listOf(Primary, PrimaryStrong))
                            else Brush.horizontalGradient(listOf(c.glass, c.glass))
                        )
                        .border(1.dp, if (active) androidx.compose.ui.graphics.Color.Transparent else c.border, RoundedCornerShape(50))
                        .clickable { mode = option }
                        .padding(vertical = 8.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }
        ErrorBanner(error)
        val rows = if (mode == "Following") following else followers
        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
        ) {
            if (loading) items(4) { ActivitySkeletonRow() }
            else {
                items(rows, key = { it.uid }) { user -> MemberRow(user, null, isMe = false, onClick = {}) }
                if (rows.isEmpty() && error == null) {
                    item {
                        StateBox(
                            icon = "🤝",
                            title = "No ${mode.lowercase()} yet",
                            body = "Discover people and grow your network.",
                            actionLabel = "Okay", onAction = onBack
                        )
                    }
                }
            }
        }
    }
}
