package com.trioday.app

import android.net.Uri
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/*
 * AdminScreen — native port of admin-activity.html: manage every activity
 * and task through the gamification Worker's admin endpoints (the same
 * ADMIN_EMAILS gate as the web). Lists drafts too, supports cover-image
 * uploads to Cloudinary via the Worker's signed flow.
 */
@Composable
fun AdminScreen(
    api: TrioApi,
    onNotice: (String?) -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val c = TrioTheme.colors
    val admin = remember { TrioAdminApi(api) }

    var activities by remember { mutableStateOf<List<ActivityItem>>(emptyList()) }
    var tasks by remember { mutableStateOf<List<TrioAdminApi.AdminTask>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Editor routing
    var editingActivity by remember { mutableStateOf<ActivityItem?>(null) }   // null = list
    var creatingActivity by remember { mutableStateOf(false) }
    var managingTasksFor by remember { mutableStateOf<ActivityItem?>(null) }
    var editingTask by remember { mutableStateOf<TrioAdminApi.AdminTask?>(null) }
    var creatingTask by remember { mutableStateOf(false) }

    fun reload() {
        scope.launch {
            loading = true; error = null
            try {
                activities = admin.loadAllActivities()
                tasks = admin.loadAllTasks()
            } catch (e: Exception) {
                error = e.message ?: "Could not load the admin data."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }

    // ── Task editor (create/edit) ────────────────────────────────────────
    if (managingTasksFor != null) {
        val activity = managingTasksFor!!
        if (editingTask != null || creatingTask) {
            TaskEditor(
                admin = admin,
                activity = activity,
                task = editingTask,
                existingNumbers = tasks.filter { it.activityId == activity.id && it.id != editingTask?.id }.map { it.number },
                busy = busy,
                error = error,
                onSave = { payload ->
                    scope.launch {
                        busy = true; error = null
                        try {
                            admin.saveTask(
                                action = if (editingTask != null) "update" else "create",
                                taskId = editingTask?.id.orEmpty(),
                                data = payload
                            )
                            onNotice(if (editingTask != null) "Task updated." else "Task created.")
                            editingTask = null; creatingTask = false
                            reload()
                        } catch (e: Exception) {
                            error = e.message ?: "Could not save the task."
                        } finally {
                            busy = false
                        }
                    }
                },
                onDelete = editingTask?.let { task ->
                    {
                        scope.launch {
                            busy = true; error = null
                            try {
                                admin.saveTask("delete", task.id, org.json.JSONObject())
                                onNotice("Task deleted.")
                                editingTask = null
                                reload()
                            } catch (e: Exception) {
                                error = e.message ?: "Could not delete the task."
                            } finally {
                                busy = false
                            }
                        }
                    }
                },
                onBack = { editingTask = null; creatingTask = false; error = null }
            )
            return
        }

        // Task list for the activity
        val activityTasks = tasks.filter { it.activityId == activity.id }.sortedBy { it.number }
        Column(Modifier.fillMaxSize().background(c.bg)) {
            ScreenTopBar(
                "📋 Tasks · ${activity.title.take(18)}",
                onBack = { managingTasksFor = null },
                trailing = {
                    TextButton(onClick = { creatingTask = true; error = null }) {
                        Text("＋ Task", color = c.primaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            )
            ErrorBanner(error)
            LazyColumn(
                Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
            ) {
                items(activityTasks, key = { it.id }) { task ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                            .background(c.surface)
                            .border(1.dp, c.border, RoundedCornerShape(14.dp))
                            .clickable { editingTask = task; error = null }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                "#${task.number} · ${task.title}",
                                color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                                maxLines = 1, overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                "${task.type} · ⚡ ${task.xp} XP${if (task.minTimeSeconds > 0) " · ⏱ ${task.minTimeSeconds / 60}m" else ""}",
                                color = c.inkDim, fontSize = 11.sp
                            )
                        }
                        Text("✎", color = c.primaryText, fontSize = 16.sp)
                    }
                }
                if (activityTasks.isEmpty() && !loading) {
                    item {
                        StateBox(
                            icon = "📋", title = "No tasks yet",
                            body = "Add the first task for this activity.",
                            actionLabel = "＋ Create task", onAction = { creatingTask = true }
                        )
                    }
                }
            }
        }
        return
    }

    // ── Activity editor (create/edit) ────────────────────────────────────
    if (editingActivity != null || creatingActivity) {
        ActivityEditor(
            admin = admin,
            activity = editingActivity,
            busy = busy,
            error = error,
            onSave = { payload ->
                scope.launch {
                    busy = true; error = null
                    try {
                        admin.saveActivity(
                            action = if (editingActivity != null) "update" else "create",
                            activityId = editingActivity?.id.orEmpty(),
                            data = payload
                        )
                        onNotice(if (editingActivity != null) "Activity updated." else "Activity created.")
                        editingActivity = null; creatingActivity = false
                        reload()
                    } catch (e: Exception) {
                        error = e.message ?: "Could not save the activity."
                    } finally {
                        busy = false
                    }
                }
            },
            onDelete = editingActivity?.let { act ->
                {
                    scope.launch {
                        busy = true; error = null
                        try {
                            admin.saveActivity("delete", act.id, org.json.JSONObject())
                            onNotice("Activity deleted (with its tasks).")
                            editingActivity = null
                            reload()
                        } catch (e: Exception) {
                            error = e.message ?: "Could not delete the activity."
                        } finally {
                            busy = false
                        }
                    }
                }
            },
            onManageTasks = editingActivity?.let { act -> { managingTasksFor = act } },
            onBack = { editingActivity = null; creatingActivity = false; error = null }
        )
        return
    }

    // ── Activity list ────────────────────────────────────────────────────
    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(
            "🛠️ Admin",
            trailing = {
                TextButton(onClick = { creatingActivity = true; error = null }) {
                    Text("＋ Activity", color = c.primaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        )
        ErrorBanner(error)
        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
        ) {
            if (loading) items(5) { ActivitySkeletonRow() }
            else {
                items(activities, key = { it.id }) { activity ->
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                            .background(c.surface)
                            .border(1.dp, c.border, RoundedCornerShape(16.dp))
                            .clickable { editingActivity = activity; error = null }
                            .padding(14.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(categoryIcon(activity.category), fontSize = 20.sp)
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    activity.title.ifBlank { "Untitled activity" },
                                    color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    "${activity.category} · #${activity.displayOrder} · ⚡ ${activity.xp} XP",
                                    color = c.inkDim, fontSize = 11.sp
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    if (activity.guestAllowed) "🔓 Guests" else "🔒 Members",
                                    color = c.inkMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold
                                )
                                Text(
                                    if (activity.published) "✅ Published" else "⏸ Draft",
                                    color = if (activity.published) Accent else c.warm,
                                    fontSize = 10.sp, fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TagPill("📋 Tasks", c.primaryText, c.primary.copy(alpha = 0.1f))
                            TextButton(
                                onClick = { managingTasksFor = activity },
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Text(
                                    "Manage ${tasks.count { it.activityId == activity.id }} tasks ›",
                                    color = c.primaryText, fontSize = 12.sp, fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
                if (activities.isEmpty() && !loading) {
                    item {
                        StateBox(
                            icon = "🛠️", title = "No activities",
                            body = "Create the first activity for Trio Day.",
                            actionLabel = "＋ Create activity", onAction = { creatingActivity = true }
                        )
                    }
                }
                item { Spacer(Modifier.height(12.dp)) }
            }
        }
    }
}

// ── Activity editor form ─────────────────────────────────────────────────────
@Composable
private fun ActivityEditor(
    admin: TrioAdminApi,
    activity: ActivityItem?,
    busy: Boolean,
    error: String?,
    onSave: (org.json.JSONObject) -> Unit,
    onDelete: (() -> Unit)?,
    onManageTasks: (() -> Unit)?,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val c = TrioTheme.colors

    var category by remember { mutableStateOf(activity?.category ?: "Learning") }
    var titleEn by remember { mutableStateOf(activity?.title.orEmpty()) }
    var titleHi by remember { mutableStateOf(activity?.titleHi.orEmpty()) }
    var descEn by remember { mutableStateOf(activity?.description.orEmpty()) }
    var descHi by remember { mutableStateOf(activity?.descriptionHi.orEmpty()) }
    var difficulty by remember { mutableStateOf(activity?.difficulty?.ifBlank { "Mixed" } ?: "Mixed") }
    var xp by remember { mutableStateOf(if ((activity?.xp ?: 0) > 0) "${activity?.xp}" else "30") }
    var displayOrder by remember { mutableStateOf("${activity?.displayOrder ?: 0}") }
    var guestAllowed by remember { mutableStateOf(activity?.guestAllowed ?: false) }
    var published by remember { mutableStateOf(activity?.published ?: true) }
    var coverUrl by remember { mutableStateOf(activity?.imageUrl.orEmpty()) }
    var uploading by remember { mutableStateOf(false) }
    var uploadError by remember { mutableStateOf<String?>(null) }

    val coverPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            uploading = true; uploadError = null
            try {
                val bytes = readBytes(context, uri, maxBytes = 8 * 1024 * 1024)
                    ?: throw java.io.IOException("That image could not be read (or it is over 8 MB).")
                coverUrl = admin.uploadCoverImage(bytes, "cover.jpg")
            } catch (e: Exception) {
                uploadError = e.message ?: "Cover upload failed."
            } finally {
                uploading = false
            }
        }
    }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(
            if (activity != null) "✎ Edit activity" else "＋ New activity",
            onBack = onBack
        )
        ErrorBanner(error ?: uploadError)
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionLabelSmall("CATEGORY")
            CategoryChips(ActivityCategories, category) { category = it }

            SectionLabelSmall("TITLE (ENGLISH) *")
            TrioInput("Title (English)", titleEn, { titleEn = it }, Modifier.fillMaxWidth(), maxLength = 120)

            SectionLabelSmall("TITLE (HINDI)")
            TrioInput("Title (Hindi)", titleHi, { titleHi = it }, Modifier.fillMaxWidth(), maxLength = 120)

            SectionLabelSmall("DESCRIPTIONS")
            TrioInput("Description (English)", descEn, { descEn = it }, Modifier.fillMaxWidth(), singleLine = false, minLines = 2, maxLines = 4, maxLength = 600)
            TrioInput("Description (Hindi)", descHi, { descHi = it }, Modifier.fillMaxWidth(), singleLine = false, minLines = 2, maxLines = 4, maxLength = 600)

            SectionLabelSmall("DIFFICULTY")
            CategoryChips(DifficultyLevels, difficulty) { difficulty = it }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) {
                    TrioInput("Total XP", xp, { xp = it.filter(Char::isDigit).take(3) }, Modifier.fillMaxWidth(), keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
                }
                Box(Modifier.weight(1f)) {
                    TrioInput("Display order", displayOrder, { displayOrder = it.filter(Char::isDigit).take(3) }, Modifier.fillMaxWidth(), keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
                }
            }

            SectionLabelSmall("COVER IMAGE (CLOUDINARY)")
            TrioInput("Cover image URL", coverUrl, { coverUrl = it }, Modifier.fillMaxWidth(), singleLine = false, maxLines = 2, maxLength = 500)
            TrioButton(
                label = if (uploading) "Uploading…" else "📷 Upload cover from gallery",
                onClick = { coverPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                style = TrioButtonStyle.Secondary,
                enabled = !uploading,
                loading = uploading,
                modifier = Modifier.fillMaxWidth(),
                height = 46.dp,
                fontSize = 13.sp
            )

            SectionLabelSmall("VISIBILITY")
            ToggleRow("🔓 Allow guest trial", guestAllowed) { guestAllowed = it }
            ToggleRow("✅ Published", published) { published = it }

            TrioButton(
                label = "Save activity",
                onClick = {
                    val payload = org.json.JSONObject()
                        .put("category", category)
                        .put("title_en", titleEn.trim())
                        .put("title_hi", titleHi.trim())
                        .put("description_en", descEn.trim())
                        .put("description_hi", descHi.trim())
                        .put("difficulty", difficulty)
                        .put("total_xp", xp.toIntOrNull() ?: 0)
                        .put("display_order", displayOrder.toIntOrNull() ?: 0)
                        .put("cover_image_url", coverUrl.trim())
                        .put("is_guest_allowed", guestAllowed)
                        .put("is_published", published)
                    onSave(payload)
                },
                enabled = !busy && titleEn.isNotBlank(),
                loading = busy,
                modifier = Modifier.fillMaxWidth()
            )

            if (activity != null) {
                TrioButton(
                    label = "📋 Manage tasks",
                    onClick = { onManageTasks?.invoke() },
                    style = TrioButtonStyle.Secondary,
                    modifier = Modifier.fillMaxWidth()
                )
                TrioButton(
                    label = "🗑 Delete activity (and tasks)",
                    onClick = { onDelete?.invoke() },
                    style = TrioButtonStyle.Danger,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

// ── Task editor form ─────────────────────────────────────────────────────────
@Composable
private fun TaskEditor(
    admin: TrioAdminApi,
    activity: ActivityItem,
    task: TrioAdminApi.AdminTask?,
    existingNumbers: List<Int>,
    busy: Boolean,
    error: String?,
    onSave: (org.json.JSONObject) -> Unit,
    onDelete: (() -> Unit)?,
    onBack: () -> Unit
) {
    val c = TrioTheme.colors
    var number by remember {
        mutableStateOf(
            "${(task?.number ?: ((existingNumbers.maxOrNull() ?: 0) + 1))}"
        )
    }
    var type by remember { mutableStateOf(task?.type?.ifBlank { null } ?: "Action Step") }
    var titleEn by remember { mutableStateOf(task?.title.orEmpty()) }
    var titleHi by remember { mutableStateOf(task?.titleHi.orEmpty()) }
    var instructionsEn by remember { mutableStateOf(task?.instructions.orEmpty()) }
    var instructionsHi by remember { mutableStateOf(task?.instructionsHi.orEmpty()) }
    var minTime by remember { mutableStateOf("${(task?.minTimeSeconds ?: 300) / 60}") }
    var xp by remember { mutableStateOf("${task?.xp ?: 10}") }

    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(if (task != null) "✎ Edit task" else "＋ New task", onBack = onBack)
        ErrorBanner(error)
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(activity.title, color = c.inkMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) {
                    TrioInput("Task number", number, { number = it.filter(Char::isDigit).take(2) }, Modifier.fillMaxWidth(), keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
                }
                Box(Modifier.weight(1f)) {
                    TrioInput("XP reward", xp, { xp = it.filter(Char::isDigit).take(3) }, Modifier.fillMaxWidth(), keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)
                }
            }
            SectionLabelSmall("TASK TYPE")
            CategoryChips(TaskTypes, type) { type = it }
            TrioInput("Title (English) *", titleEn, { titleEn = it }, Modifier.fillMaxWidth(), maxLength = 160)
            TrioInput("Title (Hindi)", titleHi, { titleHi = it }, Modifier.fillMaxWidth(), maxLength = 160)
            TrioInput("Instructions (English)", instructionsEn, { instructionsEn = it }, Modifier.fillMaxWidth(), singleLine = false, minLines = 3, maxLines = 6, maxLength = 1200)
            TrioInput("Instructions (Hindi)", instructionsHi, { instructionsHi = it }, Modifier.fillMaxWidth(), singleLine = false, minLines = 3, maxLines = 6, maxLength = 1200)
            TrioInput("Minimum time (minutes)", minTime, { minTime = it.filter(Char::isDigit).take(3) }, Modifier.fillMaxWidth(), keyboardType = androidx.compose.ui.text.input.KeyboardType.Number)

            TrioButton(
                label = "Save task",
                onClick = {
                    val payload = org.json.JSONObject()
                        .put("activity_id", activity.id)
                        .put("task_number", number.toIntOrNull() ?: 1)
                        .put("task_type", type)
                        .put("title_en", titleEn.trim())
                        .put("title_hi", titleHi.trim())
                        .put("instructions_en", instructionsEn.trim())
                        .put("instructions_hi", instructionsHi.trim())
                        .put("min_time_seconds", (minTime.toIntOrNull() ?: 0) * 60)
                        .put("xp_reward", xp.toIntOrNull() ?: 0)
                    onSave(payload)
                },
                enabled = !busy && titleEn.isNotBlank() && number.toIntOrNull() != null,
                loading = busy,
                modifier = Modifier.fillMaxWidth()
            )
            if (task != null) {
                TrioButton(
                    label = "🗑 Delete task",
                    onClick = { onDelete?.invoke() },
                    style = TrioButtonStyle.Danger,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

// ── Small helpers ────────────────────────────────────────────────────────────
@Composable
private fun SectionLabelSmall(text: String) {
    Text(
        text,
        color = TrioTheme.colors.primaryText,
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 1.5.sp
    )
}

@Composable
private fun CategoryChips(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    val c = TrioTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        options.chunked(3).forEach { rowOptions ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                rowOptions.forEach { option ->
                    val active = option == selected
                    Text(
                        option,
                        color = if (active) androidx.compose.ui.graphics.Color.White else c.inkMuted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (active) Primary else c.glass)
                            .border(1.dp, if (active) androidx.compose.ui.graphics.Color.Transparent else c.border, RoundedCornerShape(10.dp))
                            .clickable { onSelect(option) }
                            .padding(vertical = 8.dp, horizontal = 4.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
                if (rowOptions.size < 3) repeat(3 - rowOptions.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun ToggleRow(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    val c = TrioTheme.colors
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .background(c.surface)
            .border(1.dp, c.border, RoundedCornerShape(14.dp))
            .clickable { onChange(!value) }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Text(
            if (value) "ON" else "OFF",
            color = if (value) Accent else c.inkDim,
            fontSize = 13.sp,
            fontWeight = FontWeight.ExtraBold
        )
    }
}

private fun readBytes(context: android.content.Context, uri: Uri, maxBytes: Int): ByteArray? =
    try {
        context.contentResolver.openInputStream(uri)?.use { it.readBytes() }?.takeIf { it.size <= maxBytes }
    } catch (_: Exception) {
        null
    }
