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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/*
 * NotificationsScreen — port of notifications.html: the notification center
 * backed by users/{uid}/notifications with unread highlighting, mark-read
 * and mark-all-read, plus a "back" target for the header bell.
 */
@Composable
fun NotificationsScreen(
    socialApi: TrioSocialApi,
    myUid: String?,
    me: UserProfile? = null,
    onBack: () -> Unit,
    onNotice: (String?) -> Unit
) {
    val scope = rememberCoroutineScope()
    val c = TrioTheme.colors
    var alerts by remember { mutableStateOf<List<TrioNotification>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    fun load() {
        scope.launch {
            loading = true; error = null
            try {
                alerts = socialApi.notifications()
            } catch (e: Exception) {
                error = e.message ?: "Could not load notifications."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(myUid) {
        if (myUid != null) load() else loading = false
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(
            "Notifications",
            onBack = onBack,
            avatarName = me?.name,
            avatarUrl = me?.photoUrl,
            trailing = {
                TextButton(
                    enabled = alerts.any { !it.read } && !loading,
                    onClick = {
                        scope.launch {
                            try {
                                socialApi.markAllNotificationsRead(alerts)
                                onNotice("All notifications marked as read.")
                            } catch (e: Exception) {
                                error = e.message
                            } finally { load() }
                        }
                    }
                ) { Text("Mark all read", color = c.primaryText, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
            }
        )
        ErrorBanner(error)

        if (myUid == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Sign in to see your notifications.", color = c.inkMuted)
            }
            return
        }

        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
        ) {
            if (loading) items(5) { ActivitySkeletonRow() }
            else {
                itemsIndexed(alerts, key = { index, alert -> alert.id.ifBlank { "notif-$index" } }) { _, alert ->
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(
                                if (alert.read) c.surface else c.primary.copy(alpha = 0.12f)
                            )
                            .border(
                                1.dp,
                                if (alert.read) c.border else Primary.copy(alpha = 0.35f),
                                RoundedCornerShape(16.dp)
                            )
                            .clickable(enabled = !alert.read) {
                                scope.launch {
                                    try {
                                        socialApi.markNotificationRead(alert.id)
                                    } catch (e: Exception) {
                                        error = e.message
                                    } finally { load() }
                                }
                            }
                            .padding(14.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(alert.icon(), fontSize = 20.sp)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    alert.actorName.ifBlank { "Trio Day" },
                                    color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold
                                )
                                Text(alert.text.ifBlank { alert.type }, color = c.inkMuted, fontSize = 13.sp)
                            }
                            if (!alert.read) {
                                Box(
                                    Modifier
                                        .clip(RoundedCornerShape(50))
                                        .background(Primary)
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text("NEW", color = androidx.compose.ui.graphics.Color.White, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
                                }
                            }
                        }
                    }
                }
                if (alerts.isEmpty() && error == null) {
                    item {
                        StateBox(
                            icon = "🔔", title = "No notifications yet",
                            body = "Follows, messages and badges land here.",
                            actionLabel = "Okay", onAction = onBack
                        )
                    }
                }
            }
        }
    }
}
