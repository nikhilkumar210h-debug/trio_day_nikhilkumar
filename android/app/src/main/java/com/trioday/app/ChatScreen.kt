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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/*
 * ChatScreen — port of chat.html + private-chat.html: the inbox (recent
 * conversations with unread dots, sorted by latest message) and the 1:1
 * thread with bubbles, delete-own, seen ticks and live polling.
 */

@Composable
fun ChatScreen(
    socialApi: TrioSocialApi,
    myUid: String?,
    me: UserProfile? = null,
    language: String,
    onOpenProfile: (TrioUser) -> Unit,
    onFindPeople: () -> Unit,
    initialPeer: TrioUser? = null
) {
    val c = TrioTheme.colors
    var threads by remember { mutableStateOf<List<ChatThread>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var openPeer by remember { mutableStateOf<TrioUser?>(null) }

    // "Message" from a member profile opens the conversation immediately.
    LaunchedEffect(initialPeer?.uid) {
        initialPeer?.let { openPeer = it }
    }

    LaunchedEffect(myUid) {
        if (myUid == null) return@LaunchedEffect
        loading = true; error = null
        try {
            threads = socialApi.inbox()
        } catch (e: Exception) {
            error = e.message ?: "Could not load conversations."
        } finally {
            loading = false
        }
    }

    val peer = openPeer
    if (peer != null) {
        Conversation(socialApi, myUid ?: "", peer, onBack = { openPeer = null }, onOpenProfile = onOpenProfile)
        return
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(
            "Chat",
            avatarName = me?.name,
            avatarUrl = me?.photoUrl,
            trailing = {
                TextButton(onClick = onFindPeople) { Text("Find people", color = c.primaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            }
        )
        ErrorBanner(error)

        if (myUid == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Sign in to chat with your connections.", color = c.inkMuted)
            }
            return
        }

        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
        ) {
            if (loading) {
                items(5) { ActivitySkeletonRow() }
            } else {
                items(threads, key = { it.peer.uid }) { thread ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(c.surface)
                            .border(1.dp, c.border, RoundedCornerShape(16.dp))
                            .clickable { openPeer = thread.peer }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box {
                            TrioAvatar(thread.peer.name, thread.peer.photoUrl, 44.dp)
                            if (thread.unreadCount > 0) {
                                Box(
                                    Modifier.align(Alignment.TopEnd)
                                        .size(18.dp)
                                        .clip(CircleShape)
                                        .background(Danger),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        if (thread.unreadCount > 9) "9+" else "${thread.unreadCount}",
                                        color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                thread.peer.name.ifBlank { "Trio Member" },
                                color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                thread.lastMessage?.text.orEmpty().ifBlank { "Say hello 👋" },
                                color = c.inkMuted, fontSize = 13.sp,
                                maxLines = 1, overflow = TextOverflow.Ellipsis
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                chatTime(thread.lastMessage?.createdAtMs ?: 0L),
                                color = c.inkDim, fontSize = 11.sp
                            )
                        }
                    }
                }
                if (threads.isEmpty() && !loading) {
                    item {
                        StateBox(
                            icon = "💬",
                            title = "No conversations yet",
                            body = "Discover people to start a private conversation.",
                            actionLabel = "🔍 Discover people", onAction = onFindPeople
                        )
                    }
                }
                item { Spacer(Modifier.height(12.dp)) }
            }
        }
    }
}

@Composable
private fun Conversation(
    socialApi: TrioSocialApi,
    myUid: String,
    peer: TrioUser,
    onBack: () -> Unit,
    onOpenProfile: (TrioUser) -> Unit
) {
    val scope = rememberCoroutineScope()
    val c = TrioTheme.colors
    var messages by remember { mutableStateOf<List<TrioMessage>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var draft by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    fun refresh(markSeen: Boolean) {
        scope.launch {
            try {
                val fresh = socialApi.messages(peer.uid)
                messages = fresh
                if (markSeen) socialApi.markMessagesSeen(peer.uid, fresh)
            } catch (e: Exception) {
                error = e.message ?: "Could not load messages."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(peer.uid) {
        refresh(markSeen = true)
    }

    // Live poll for new messages while the thread is open (webapp realtime parity).
    LaunchedEffect(peer.uid) {
        while (true) {
            delay(10_000)
            refresh(markSeen = true)
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    Column(Modifier.fillMaxSize().background(c.bg).imePadding()) {
        ScreenTopBar(
            peer.name.ifBlank { "Chat" },
            onBack = onBack,
            avatarName = peer.name,
            avatarUrl = peer.photoUrl,
            trailing = {
                TextButton(onClick = { onOpenProfile(peer) }) { Text("Profile", color = c.primaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            }
        )
        ErrorBanner(error)

        LazyColumn(
            Modifier.fillMaxSize().weight(1f),
            state = listState,
            verticalArrangement = Arrangement.spacedBy(6.dp),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)
        ) {
            if (loading && messages.isEmpty()) {
                items(4) { ActivitySkeletonRow() }
            }
            items(messages, key = { it.id }) { message ->
                val mine = message.uid == myUid
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
                ) {
                    Column(
                        Modifier
                            .width(280.dp)
                            .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = if (mine) 16.dp else 4.dp, bottomEnd = if (mine) 4.dp else 16.dp))
                            .background(
                                if (mine) Brush.linearGradient(listOf(Primary.copy(alpha = 0.85f), PrimaryStrong.copy(alpha = 0.85f)))
                                else Brush.linearGradient(listOf(c.surfaceStrong, c.surfaceStrong))
                            )
                            .border(1.dp, if (mine) Color.Transparent else c.border, RoundedCornerShape(16.dp))
                            .padding(horizontal = 14.dp, vertical = 9.dp)
                    ) {
                        Text(message.text, color = if (mine) Color.White else c.ink, fontSize = 14.sp)
                        Row(
                            Modifier.fillMaxWidth().padding(top = 4.dp),
                            horizontalArrangement = Arrangement.End,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                chatTime(message.createdAtMs),
                                color = if (mine) Color.White.copy(alpha = 0.75f) else c.inkDim,
                                fontSize = 10.sp
                            )
                            if (mine) {
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    if (message.seen > 0L) "✓✓" else "✓",
                                    color = if (message.seen > 0L) Color(0xFF7DE3FF) else Color.White.copy(alpha = 0.75f),
                                    fontSize = 11.sp
                                )
                                TextButton(
                                    onClick = {
                                        scope.launch {
                                            try {
                                                socialApi.deleteMessage(peer.uid, message)
                                                messages = socialApi.messages(peer.uid)
                                            } catch (e: Exception) {
                                                error = e.message
                                            }
                                        }
                                    },
                                    contentPadding = PaddingValues(2.dp),
                                    modifier = Modifier.size(width = 42.dp, height = 20.dp)
                                ) { Text("🗑", fontSize = 10.sp) }
                            }
                        }
                    }
                }
            }
            if (messages.isEmpty() && !loading) {
                item {
                    Column(
                        Modifier.fillMaxWidth().padding(vertical = 30.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("👋", fontSize = 34.sp)
                        Text("Start a private conversation.", color = c.inkMuted, fontSize = 14.sp)
                    }
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TrioInput(
                label = "",
                value = draft,
                onValueChange = { draft = it.take(500) },
                modifier = Modifier.weight(1f),
                placeholder = "Write a message…",
                maxLines = 3
            )
            Spacer(Modifier.width(8.dp))
            TrioButton(
                label = "Send",
                onClick = {
                    val text = draft
                    draft = ""
                    scope.launch {
                        sending = true
                        try {
                            socialApi.sendMessage(peer, text)
                            val fresh = socialApi.messages(peer.uid)
                            messages = fresh
                        } catch (e: Exception) {
                            error = e.message ?: "Could not send the message."
                        } finally {
                            sending = false
                        }
                    }
                },
                enabled = draft.isNotBlank() && !sending,
                loading = sending,
                height = 52.dp,
                fontSize = 14.sp
            )
        }
    }
}

private fun chatTime(ms: Long): String {
    if (ms <= 0L) return ""
    return try {
        val now = System.currentTimeMillis()
        val fmt = if (now - ms < 86_400_000L) SimpleDateFormat("HH:mm", Locale.getDefault())
        else SimpleDateFormat("dd MMM", Locale.getDefault())
        fmt.format(Date(ms))
    } catch (_: Exception) {
        ""
    }
}
