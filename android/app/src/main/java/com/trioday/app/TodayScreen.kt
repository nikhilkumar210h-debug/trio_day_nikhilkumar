package com.trioday.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

/*
 * TodayScreen — full port of the webapp Today page (index.html +
 * today-activity.js): guest trial view, growth-path onboarding and the
 * category dashboard with switch-goal / show-all fallbacks.
 */

@Composable
fun TodayScreen(
    api: TrioApi,
    session: AuthSession?,
    profile: UserProfile?,
    language: String,
    notice: String?,
    onOpenActivity: (ActivityItem) -> Unit,
    onSignIn: () -> Unit,
    onSignOut: () -> Unit,
    onProfileChanged: () -> Unit,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val c = TrioTheme.colors

    var activities by remember { mutableStateOf<List<ActivityItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var showingAll by remember { mutableStateOf(false) }
    var savingCategory by remember { mutableStateOf(false) }
    var retryToken by remember { mutableStateOf(0) }

    val guestMode = session == null
    val needsOnboarding = session != null && profile != null &&
        (!profile.onboardingComplete || profile.selectedCategory.isBlank())
    val selectedCategory = profile?.selectedCategory?.takeIf { it.isNotBlank() }
    val guestRemaining = (GUEST_TASK_LIMIT - api.guestTasksPlayed()).coerceAtLeast(0)

    val activeCategory = if (showingAll) null else selectedCategory

    LaunchedEffect(session?.uid, selectedCategory, showingAll, guestMode, retryToken) {
        if (guestMode) {
            if (guestRemaining <= 0) { loading = false; return@LaunchedEffect }
            loading = true; loadError = null
            try {
                activities = api.loadActivities(guestAllowed = true, limit = GUEST_TASK_LIMIT)
            } catch (e: Exception) { loadError = e.message ?: "Could not load activities." }
            loading = false
        } else if (!needsOnboarding) {
            loading = true; loadError = null
            try {
                activities = api.loadActivities(category = activeCategory, limit = 12)
            } catch (e: Exception) { loadError = e.message ?: "Could not load activities." }
            loading = false
        } else {
            loading = false
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        // ── Header: brand · language · auth ────────────────────────────
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            BrandHeader()
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Theme toggle — mirrors the webapp header control (all users)
                Text(
                    if (TrioTheme.colors.isLight) "🌙" else "☀️",
                    fontSize = 13.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(c.glass)
                        .border(1.dp, c.border, RoundedCornerShape(50))
                        .clickable { onToggleTheme() }
                        .padding(horizontal = 9.dp, vertical = 5.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    language,
                    color = c.primaryText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(c.primary.copy(alpha = 0.12f))
                        .border(1.dp, c.primary.copy(alpha = 0.3f), RoundedCornerShape(50))
                        .clickable { onToggleLanguage() }
                        .padding(horizontal = 12.dp, vertical = 5.dp)
                )
                Spacer(Modifier.width(8.dp))
                TextButton(onClick = if (session != null) onSignOut else onSignIn) {
                    Text(if (session != null) "Sign out" else "Sign in", color = c.inkMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // ── Stat strip (signed-in header chip equivalent) ───────────────
        profile?.let { p ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(c.primary.copy(alpha = 0.14f), c.surface)))
                    .border(1.dp, c.border, RoundedCornerShape(18.dp))
                    .padding(vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatTile(T.t("weekly_xp", language), "${p.weeklyXp}", c.primaryText)
                StatTile(T.t("total_xp", language), "${p.xp}", c.ink)
                StatTile("Level", "${p.level}", c.primaryText)
                StatTile(T.t("streak", language), "${p.streak}", c.warm)
            }
            Spacer(Modifier.height(10.dp))
        }

        NoticeBanner(notice)
        ErrorBanner(loadError)

        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp)
        ) {
            when {
                // ── GUEST VIEW ────────────────────────────────────────────
                guestMode -> {
                    item {
                        Column(Modifier.padding(top = 4.dp)) {
                            Text(
                                "🔥 Featured Starter Activities",
                                color = c.ink, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold
                            )
                            Text(
                                "Try ${GUEST_TASK_LIMIT} free tasks — no login needed. Your progress saves locally.",
                                color = c.inkMuted, fontSize = 14.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                    if (guestRemaining > 0) {
                        if (loading) {
                            items(3) { ActivitySkeletonRow() }
                        } else if (loadError != null) {
                            item {
                                StateBox(
                                    icon = "📡", title = "Could not load activities",
                                    body = "Check your connection and try again.",
                                    actionLabel = T.t("retry", language), onAction = { retryToken++ }
                                )
                            }
                        } else {
                            items(activities, key = { it.id }) { activity ->
                                ActivityCard(activity, language, signedIn = false, onOpen = { onOpenActivity(activity) })
                            }
                            if (activities.isEmpty() && loadError == null) {
                                item {
                                    StateBox(
                                        icon = "🚧", title = T.t("no_activities", language),
                                        body = T.t("no_activities_hint", language),
                                        actionLabel = T.t("retry", language), onAction = { retryToken++ }
                                    )
                                }
                            }
                            item {
                                Box(Modifier.fillMaxWidth().padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
                                    Text(
                                        "🔓 $guestRemaining of $GUEST_TASK_LIMIT ${T.t("guest_trial", language)} left on this device",
                                        color = c.inkDim, fontSize = 12.sp, fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                            item {
                                TrioButton("🔑 Login / Create Account", onSignIn, Modifier.fillMaxWidth())
                            }
                        }
                    } else {
                        item {
                            Column(
                                Modifier.fillMaxWidth().padding(vertical = 40.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("🔒", fontSize = 44.sp)
                                Spacer(Modifier.height(12.dp))
                                Text(T.t("guest_limit", language), color = c.primaryText, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold)
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    T.t("guest_msg", language),
                                    color = c.inkMuted, fontSize = 14.sp,
                                    modifier = Modifier.padding(horizontal = 26.dp)
                                )
                                Spacer(Modifier.height(20.dp))
                                TrioButton("🔑 Login / Create Account", onSignIn)
                            }
                        }
                    }
                }

                // ── ONBOARDING (growth path cards) ────────────────────────
                needsOnboarding -> {
                    item {
                        Column(
                            Modifier.fillMaxWidth().padding(vertical = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("🎯 ${T.t("welcome", language)}", color = c.ink, fontSize = 27.sp, fontWeight = FontWeight.ExtraBold)
                            Text(
                                T.t("sub_welcome", language),
                                color = c.inkMuted, fontSize = 15.sp,
                                modifier = Modifier.padding(top = 8.dp, start = 24.dp, end = 24.dp)
                            )
                        }
                    }
                    items(GoalCategories, key = { it.key }) { goal ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(c.surface)
                                .border(1.dp, c.border, RoundedCornerShape(18.dp))
                                .clickable(enabled = !savingCategory) {
                                    savingCategory = true
                                    scope.launch {
                                        try {
                                            api.saveCategory(goal.key)
                                            onProfileChanged()
                                        } catch (e: Exception) {
                                            loadError = e.message
                                        } finally {
                                            savingCategory = false
                                        }
                                    }
                                }
                                .padding(18.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(goal.icon, fontSize = 30.sp)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(goal.title, color = c.ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                Text(goal.sub, color = c.inkMuted, fontSize = 13.sp)
                            }
                            Text("›", color = c.primaryText, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // ── DASHBOARD ─────────────────────────────────────────────
                else -> {
                    item {
                        Column {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        "${categoryIcon(activeCategory ?: "all")} ${
                                            if (showingAll) T.t("all_activities", language)
                                            else GoalCategories.firstOrNull { it.key == selectedCategory }?.title ?: selectedCategory.orEmpty()
                                        }",
                                        color = c.ink, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold
                                    )
                                    Text(
                                        if (showingAll) T.t("all_activities_sub", language) else T.t("banner_sub", language),
                                        color = c.inkMuted, fontSize = 14.sp,
                                        modifier = Modifier.padding(top = 4.dp)
                                    )
                                }
                                TextButton(onClick = { showingAll = false; onProfileChanged() }) {
                                    Text(T.t("change_goal", language), color = c.primaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    if (loading) {
                        items(3) { ActivitySkeletonRow() }
                    } else if (loadError != null) {
                        item {
                            StateBox(
                                icon = "📡", title = "Could not load activities",
                                body = "Check your connection and try again.",
                                actionLabel = T.t("retry", language), onAction = { retryToken++ }
                            )
                        }
                    } else {
                        items(activities, key = { it.id }) { activity ->
                            ActivityCard(activity, language, signedIn = true, onOpen = { onOpenActivity(activity) })
                        }
                        if (activities.isEmpty() && loadError == null) {
                            item {
                                StateBox(
                                    icon = categoryIcon(activeCategory ?: "") ,
                                    title = T.t("no_activities", language),
                                    body = "${T.t("no_activities_hint", language)} (${selectedCategory})",
                                    actionLabel = T.t("show_all", language), onAction = { showingAll = true },
                                    secondActionLabel = T.t("change_goal", language), onSecondAction = { showingAll = false }
                                )
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(14.dp)) }
        }
    }
}

// ── Activity card (renderActivityCard in today-activity.js) ────────────────
@Composable
fun ActivityCard(
    activity: ActivityItem,
    language: String,
    signedIn: Boolean,
    onOpen: () -> Unit
) {
    val c = TrioTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(c.surface)
            .border(1.dp, c.border, RoundedCornerShape(18.dp))
            .clickable { onOpen() }
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Number badge
        Column(Modifier.width(40.dp)) {
            Box(
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(c.primary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Text("⚡", fontSize = 16.sp)
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                activity.titleFor(language).ifBlank { "Activity" },
                color = c.ink, fontSize = 17.sp, fontWeight = FontWeight.Bold,
                maxLines = 2, overflow = TextOverflow.Ellipsis
            )
            if (activity.descriptionFor(language).isNotBlank()) {
                Text(
                    activity.descriptionFor(language),
                    color = c.inkMuted, fontSize = 13.sp,
                    maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 3.dp)
                )
            }
            // Wrapping pill row — prevents tags from being crushed against
            // the cover image on narrow screens (right-side squish fix).
            @OptIn(ExperimentalLayoutApi::class)
            FlowRow(
                modifier = Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                TagPill("🎯 ${activity.difficulty.ifBlank { "Mixed" }}", c.primaryText, c.primary.copy(alpha = 0.12f))
                if (activity.xp > 0) XpChip(activity.xp)
                if (!signedIn && activity.guestAllowed) TagPill("🔓 Free", Accent, Accent.copy(alpha = 0.12f))
            }
        }
        Spacer(Modifier.width(12.dp))
        if (activity.imageUrl.isNotBlank()) {
            AsyncImage(
                model = cloudinaryAutoUrl(activity.imageUrl),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(width = 88.dp, height = 76.dp)
                    .clip(RoundedCornerShape(14.dp))
            )
        } else {
            Box(
                Modifier
                    .size(width = 88.dp, height = 76.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Brush.linearGradient(listOf(c.primary.copy(alpha = 0.16f), c.primaryStrong.copy(alpha = 0.1f)))),
                contentAlignment = Alignment.Center
            ) { Text(categoryIcon(activity.category), fontSize = 26.sp) }
        }
    }
}
