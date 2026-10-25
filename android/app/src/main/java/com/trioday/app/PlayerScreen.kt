package com.trioday.app

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.io.IOException

/*
 * PlayerScreen — port of activity-player.html: fetches the activity's tasks
 * from Supabase, walks the user through them with a progress bar, verifies
 * completions through the gamification Worker (AI check + XP + leaderboards),
 * supports skips and the 3-task guest trial with post-login claiming.
 */
@Composable
fun PlayerScreen(
    api: TrioApi,
    activity: ActivityItem,
    session: AuthSession?,
    language: String,
    onExit: () -> Unit,
    onProfileChanged: () -> Unit,
    onRequireSignIn: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val c = TrioTheme.colors

    var tasks by remember { mutableStateOf<List<TaskItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var index by remember { mutableStateOf(0) }
    var proof by remember(activity.id, index) { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var finished by remember { mutableStateOf(false) }
    var earnedXp by remember { mutableStateOf(0) }
    val taskStartedAt = remember(activity.id, index) { mutableStateOf(System.currentTimeMillis()) }

    LaunchedEffect(activity.id) {
        loading = true
        try {
            tasks = api.loadTasks(activity.id)
        } catch (e: Exception) {
            error = e.message ?: "Could not load tasks."
        } finally {
            loading = false
        }
    }

    if (finished) {
        CompletionScreen(earnedXp, activity, language, onExit)
        return
    }

    Column(Modifier.fillMaxSize().background(c.bg).imePadding()) {
        ScreenTopBar(activity.titleFor(language), onBack = onExit)

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                androidx.compose.material3.CircularProgressIndicator(color = Primary)
            }
            return
        }
        if (tasks.isEmpty()) {
            StateBox("🚧", "No tasks yet", "This activity has no published tasks.", "Back to Today", onAction = onExit)
            return
        }

        ErrorBanner(error)

        val task = tasks.getOrNull(index.coerceIn(tasks.indices))
        if (task == null) {
            onExit()
            return
        }
        val advanceOrFinish: () -> Unit = {
            if (index < tasks.lastIndex) {
                index += 1
                taskStartedAt.value = System.currentTimeMillis()
            } else {
                finished = true
            }
        }

        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp)
        ) {
            item {
                // Progress bar
                val progress = (index + 1f) / tasks.size
                Column {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            "Task ${task.number} of ${tasks.size}",
                            color = c.primaryText, fontSize = 13.sp, fontWeight = FontWeight.Bold
                        )
                        Text("⚡ ${task.xp} XP", color = c.warm, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                    Box(
                        Modifier.fillMaxWidth().height(8.dp)
                            .clip(RoundedCornerShape(50))
                            .background(c.glassStrong)
                    ) {
                        Box(
                            Modifier.fillMaxWidth(progress).height(8.dp)
                                .clip(RoundedCornerShape(50))
                                .background(Brush.horizontalGradient(listOf(Primary, PrimaryStrong)))
                        )
                    }
                }
            }

            item {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(18.dp)
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TagPill("🧩 ${task.type.ifBlank { "Task" }}", c.primaryText, c.primary.copy(alpha = 0.12f))
                        if (task.minTimeSeconds > 0) {
                            TagPill(
                                if (task.minTimeSeconds >= 60) "⏱ ${task.minTimeSeconds / 60} min" else "⏱ ${task.minTimeSeconds}s",
                                c.inkMuted, c.glassStrong
                            )
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        task.titleFor(language),
                        color = c.ink, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold
                    )
                    if (task.instructionsFor(language).isNotBlank()) {
                        Text(
                            task.instructionsFor(language),
                            color = c.inkMuted, fontSize = 14.sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }

            item {
                Column {
                    TrioInput(
                        label = "Your reflection / proof",
                        value = proof,
                        onValueChange = { proof = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = "Describe what you did and what happened (15+ characters)",
                        singleLine = false,
                        minLines = 5,
                        maxLines = 8,
                        maxLength = 2000
                    )
                    Text(
                        "${proof.length}/2000",
                        color = c.inkDim, fontSize = 11.sp,
                        modifier = Modifier.align(Alignment.End).padding(top = 4.dp)
                    )
                }
            }

            item {
                if (session == null && api.guestTasksPlayed() >= GUEST_TASK_LIMIT) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        Text("🔒 You've used all $GUEST_TASK_LIMIT free tasks.", color = c.inkMuted, fontSize = 13.sp)
                        Spacer(Modifier.height(8.dp))
                        TrioButton("🔑 Sign in to continue", onRequireSignIn, Modifier.fillMaxWidth())
                    }
                } else {
                    TrioButton(
                        label = if (busy) "Verifying…" else "Complete task & claim ${task.xp} XP",
                        onClick = {
                            val currentTask = task
                            val text = proof
                            val spent = (System.currentTimeMillis() - taskStartedAt.value) / 1000
                            scope.launch {
                                busy = true; error = null
                                try {
                                    if (session == null) {
                                        if (!activity.guestAllowed) throw IOException("Sign in to save progress for this activity.")
                                        require(text.trim().length >= 15) { "Write at least 15 characters about what you did." }
                                        api.recordGuestCompletion(activity, currentTask, language)
                                        earnedXp += currentTask.xp
                                        advanceOrFinish()
                                    } else {
                                        val result = api.completeTask(activity.id, currentTask, text, spent)
                                        if (!result.optBoolean("ok", true)) {
                                            throw IOException(result.optString("error", "Task verification failed."))
                                        }
                                        val awarded = result.optInt("awarded", currentTask.xp)
                                        earnedXp += awarded
                                        onProfileChanged()
                                        advanceOrFinish()
                                    }
                                    proof = ""
                                } catch (e: Exception) {
                                    error = e.message ?: "Could not complete this task."
                                } finally {
                                    busy = false
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy && proof.trim().length >= 15,
                        loading = busy
                    )
                }
            }

            item {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (index < tasks.lastIndex) {
                        TextButton(enabled = !busy, onClick = {
                            val currentTask = task
                            scope.launch {
                                try {
                                    if (session != null) api.skipTask(activity.id, currentTask)
                                } catch (e: Exception) {
                                    error = "Skipped locally — the skip could not be saved: ${e.message}"
                                }
                                advanceOrFinish()
                                proof = ""
                            }
                        }) { Text("Skip task (0 XP)", color = c.inkDim, fontSize = 13.sp) }
                    } else {
                        Text("🏁 Final task", color = c.inkDim, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

// ── Completion celebration (activity-player.js completion screen) ────────────
@Composable
private fun CompletionScreen(
    earnedXp: Int,
    activity: ActivityItem,
    language: String,
    onExit: () -> Unit
) {
    val c = TrioTheme.colors
    Column(
        Modifier.fillMaxSize().background(c.bg).padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("🎉", fontSize = 56.sp)
        Spacer(Modifier.height(14.dp))
        Text("Activity complete!", color = c.ink, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
        Text(activity.titleFor(language), color = c.inkMuted, fontSize = 15.sp, modifier = Modifier.padding(top = 4.dp))
        Spacer(Modifier.height(24.dp))
        Box(
            Modifier
                .clip(RoundedCornerShape(24.dp))
                .background(Brush.linearGradient(listOf(Primary.copy(alpha = 0.22f), PrimaryStrong.copy(alpha = 0.16f))))
                .border(1.dp, Primary.copy(alpha = 0.35f), RoundedCornerShape(24.dp))
                .padding(horizontal = 34.dp, vertical = 22.dp)
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("+$earnedXp", color = c.primaryText, fontSize = 40.sp, fontWeight = FontWeight.ExtraBold)
                Text("XP EARNED", color = c.inkMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            }
        }
        Spacer(Modifier.height(28.dp))
        TrioButton("Back to Today", onExit, Modifier.fillMaxWidth())
        if (earnedXp == 0) {
            Text(
                "Skipped tasks award no XP — try the next activity!",
                color = c.inkDim, fontSize = 12.sp, modifier = Modifier.padding(top = 12.dp)
            )
        }
    }
}
