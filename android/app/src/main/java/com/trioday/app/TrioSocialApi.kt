package com.trioday.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder

class TrioSocialApi(private val api: TrioApi) {
    suspend fun searchPeople(search: String = ""): List<TrioUser> = withContext(Dispatchers.IO) {
        val users = listCollection("users", 100).mapNotNull(::parseUser)
        val signedInUid = api.requireSession().uid
        val query = search.trim().removePrefix("@").uppercase()
        users
            .filter { it.uid != signedInUid }
            .filter {
                query.isBlank() ||
                    it.name.contains(search.trim(), ignoreCase = true) ||
                    it.userId.contains(query, ignoreCase = true)
            }
            .take(60)
    }

    suspend fun profile(uid: String): TrioUser = withContext(Dispatchers.IO) {
        val document = api.firestoreRequest(api.requireSession(), "users/${pathSegment(uid)}", "GET")
        parseUser(document) ?: throw IOException("This Trio Day profile could not be found.")
    }

    suspend fun saveProfile(name: String, bio: String) = api.saveProfile(name, bio)

    suspend fun listConnections(uid: String, following: Boolean): List<TrioUser> = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        val relation = if (following) "following" else "followers"
        val ids = listCollection("users/${pathSegment(uid)}/$relation", 100)
            .map { it.optString("name").substringAfterLast('/') }
            .filter { it.isNotBlank() && it != uid }
        ids.map { id ->
            parseUser(api.firestoreRequest(current, "users/${pathSegment(id)}", "GET"))
                ?: throw IOException("A connected profile could not be found.")
        }
    }

    suspend fun follow(targetUid: String) = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        require(targetUid != current.uid) { "You cannot follow your own profile." }
        val me = profile(current.uid)
        val now = JSONObject().put("timestampValue", java.time.Instant.now().toString())
        val selfFields = relationFields(current.uid, me, now)
        val targetFields = relationFields(current.uid, me, now)
        api.firestoreRequest(
            current,
            "users/${pathSegment(targetUid)}/followers/${pathSegment(current.uid)}",
            "PATCH",
            JSONObject().put("fields", api.encodeFirestoreFields(selfFields))
        )
        try {
            api.firestoreRequest(
                current,
                "users/${pathSegment(current.uid)}/following/${pathSegment(targetUid)}",
                "PATCH",
                JSONObject().put("fields", api.encodeFirestoreFields(targetFields))
            )
        } catch (error: Exception) {
            try {
                api.firestoreRequest(
                    current,
                    "users/${pathSegment(targetUid)}/followers/${pathSegment(current.uid)}",
                    "DELETE"
                )
            } catch (rollbackError: Exception) {
                throw IOException(
                    "The follow could not be completed and its partial record could not be removed: ${rollbackError.message}",
                    error
                )
            }
            throw error
        }
        targetUid
    }

    suspend fun unfollow(targetUid: String) = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        api.firestoreRequest(
            current,
            "users/${pathSegment(current.uid)}/following/${pathSegment(targetUid)}",
            "DELETE"
        )
        try {
            api.firestoreRequest(
                current,
                "users/${pathSegment(targetUid)}/followers/${pathSegment(current.uid)}",
                "DELETE"
            )
        } catch (error: Exception) {
            throw IOException("You unfollowed this profile, but the follower count could not be refreshed: ${error.message}", error)
        }
    }

    suspend fun leaderboard(kind: String): List<TrioUser> = withContext(Dispatchers.IO) {
        val field = when (kind) {
            "Global XP" -> "xp"
            "Monthly" -> "monthlyXp"
            "Streak" -> "streakCurrent"
            else -> "weeklyXp"
        }
        runQuery("users", orderField = field, descending = true, limit = 50, greaterThanField = field)
            .mapNotNull(::parseUser)
    }

    suspend fun inbox(): List<ChatThread> = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        val following = listCollection("users/${pathSegment(current.uid)}/following", 100)
            .map { it.optString("name").substringAfterLast('/') }
        val followers = listCollection("users/${pathSegment(current.uid)}/followers", 100)
            .map { it.optString("name").substringAfterLast('/') }
        val peerIds = (following + followers).filter { it.isNotBlank() && it != current.uid }.distinct().take(40)
        val conversations = mutableListOf<ChatThread>()
        for (peerId in peerIds) {
            val peer = parseUser(api.firestoreRequest(current, "users/${pathSegment(peerId)}", "GET"))
                ?: continue // Skip profiles deleted from the directory instead of failing the inbox
            val recent = runQuery(
                "privateChats/${chatId(current.uid, peerId)}/messages",
                orderField = "createdAtMs",
                descending = true,
                limit = 50
            ).mapNotNull(::parseMessage)
            val latest = recent.firstOrNull()
            if (latest == null) continue
            val unread = recent.count { it.uid == peerId && it.seen == 0L }
            conversations.add(ChatThread(peer, latest, unread))
        }
        conversations.sortedByDescending { it.lastMessage?.createdAtMs ?: 0L }
    }

    /** Number of unread messages a peer has sent (for the inbox unread dot). */
    suspend fun unreadCount(peerUid: String): Int = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        runQuery(
            "privateChats/${chatId(current.uid, peerUid)}/messages",
            orderField = "createdAtMs",
            descending = true,
            limit = 50
        ).mapNotNull(::parseMessage).count { it.uid == peerUid && it.seen == 0L }
    }

    suspend fun connectionsCount(uid: String, following: Boolean): Int = withContext(Dispatchers.IO) {
        val relation = if (following) "following" else "followers"
        listCollection("users/${pathSegment(uid)}/$relation", 200).size
    }

    suspend fun unreadNotificationCount(): Int = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        listCollection("users/${pathSegment(current.uid)}/notifications", 50)
            .count { firestoreFields(it).optBoolean("read") == false }
    }

    suspend fun messages(peerUid: String): List<TrioMessage> = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        runQuery(
            "privateChats/${chatId(current.uid, peerUid)}/messages",
            orderField = "createdAtMs",
            descending = false,
            limit = 100
        ).mapNotNull(::parseMessage)
    }

    suspend fun sendMessage(peer: TrioUser, text: String) = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        val value = text.trim()
        require(value.isNotEmpty()) { "Write a message first." }
        require(value.length <= 500) { "Messages must be 500 characters or fewer." }
        val me = profile(current.uid)
        val fields = JSONObject()
            .put("uid", current.uid)
            .put("name", me.name)
            .put("text", value)
            .put("createdAt", System.currentTimeMillis())
            .put("createdAtMs", System.currentTimeMillis())
        createDocument("privateChats/${chatId(current.uid, peer.uid)}/messages", fields)
        runCatching {
            workerRequest(
                "https://trio-notifications.trioday-nikhil.workers.dev/notifications/create",
                JSONObject()
                    .put("targetUid", peer.uid)
                    .put("type", "message")
                    .put("actorUid", current.uid)
                    .put("actorName", me.name)
                    .put("text", value.take(180))
            )
        }
    }

    suspend fun deleteMessage(peerUid: String, message: TrioMessage) = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        require(message.uid == current.uid) { "You can delete only your own messages." }
        api.firestoreRequest(
            current,
            "privateChats/${chatId(current.uid, peerUid)}/messages/${pathSegment(message.id)}",
            "DELETE"
        )
    }

    suspend fun markMessagesSeen(peerUid: String, messages: List<TrioMessage>) = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        val unseen = messages.filter { it.uid == peerUid && it.seen == 0L }
        for (message in unseen) {
            api.firestoreRequest(
                current,
                "privateChats/${chatId(current.uid, peerUid)}/messages/${pathSegment(message.id)}",
                "PATCH",
                JSONObject().put("fields", api.encodeFirestoreFields(JSONObject().put("seen", System.currentTimeMillis())))
            )
        }
    }

    suspend fun notifications(): List<TrioNotification> = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        listCollection("users/${pathSegment(current.uid)}/notifications", 50)
            .mapNotNull { document ->
                val fields = firestoreFields(document)
                TrioNotification(
                    id = document.optString("id"),
                    type = fields.optString("type"),
                    actorName = fields.optString("actorName"),
                    actorUid = fields.optString("actorUid"),
                    text = fields.optString("text"),
                    urlPath = fields.optString("urlPath"),
                    createdAtMs = fields.longValue("createdAtMs"),
                    read = fields.optBoolean("read")
                )
            }
            .sortedByDescending { it.createdAtMs }
    }

    suspend fun markNotificationRead(id: String) = withContext(Dispatchers.IO) {
        val current = api.requireSession()
        api.firestoreRequest(
            current,
            "users/${pathSegment(current.uid)}/notifications/${pathSegment(id)}",
            "PATCH",
            JSONObject().put("fields", api.encodeFirestoreFields(JSONObject().put("read", true)))
        )
    }

    suspend fun markAllNotificationsRead(items: List<TrioNotification>) = withContext(Dispatchers.IO) {
        items.filterNot { it.read }.forEach { markNotificationRead(it.id) }
    }

    private suspend fun listCollection(path: String, count: Int): List<JSONObject> {
        val current = api.requireSession()
        val request = Request.Builder()
            .url("${documentsUrl(path)}?pageSize=$count")
            .header("Authorization", "Bearer ${api.getIdToken(current)}")
            .get()
            .build()
        val response = JSONObject(api.execute(request)).optJSONArray("documents") ?: JSONArray()
        return (0 until response.length()).mapNotNull { response.optJSONObject(it) }
    }

    private suspend fun runQuery(
        collectionPath: String,
        orderField: String? = null,
        descending: Boolean = false,
        limit: Int,
        greaterThanField: String? = null
    ): List<JSONObject> {
        val current = api.requireSession()
        val parts = collectionPath.split('/').filter(String::isNotBlank)
        require(parts.isNotEmpty())
        val collectionId = parts.last()
        val parent = parts.dropLast(1).joinToString("/")
        val structuredQuery = JSONObject()
            .put("from", JSONArray().put(JSONObject().put("collectionId", collectionId)))
            .put("limit", limit)
        if (orderField != null) {
            structuredQuery.put(
                "orderBy",
                JSONArray().put(
                    JSONObject()
                        .put("field", JSONObject().put("fieldPath", orderField))
                        .put("direction", if (descending) "DESCENDING" else "ASCENDING")
                )
            )
        }
        if (greaterThanField != null) {
            structuredQuery.put(
                "where",
                JSONObject().put(
                    "fieldFilter",
                    JSONObject()
                        .put("field", JSONObject().put("fieldPath", greaterThanField))
                        .put("op", "GREATER_THAN")
                        .put("value", JSONObject().put("integerValue", "0"))
                )
            )
        }
        val endpoint = documentsUrl(parent).let { base ->
            if (parent.isBlank()) "$base:runQuery" else "$base:runQuery"
        }
        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", "Bearer ${api.getIdToken(current)}")
            .post(JSONObject().put("structuredQuery", structuredQuery).toString().toRequestBody("application/json".toMediaType()))
            .build()
        val response = JSONArray(api.execute(request))
        return (0 until response.length()).mapNotNull { response.optJSONObject(it)?.optJSONObject("document") }
    }

    private suspend fun createDocument(collectionPath: String, values: JSONObject) {
        val current = api.requireSession()
        val body = JSONObject().put("fields", api.encodeFirestoreFields(values))
        val request = Request.Builder()
            .url(documentsUrl(collectionPath))
            .header("Authorization", "Bearer ${api.getIdToken(current)}")
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        api.execute(request)
    }

    private suspend fun workerRequest(url: String, body: JSONObject): JSONObject {
        val current = api.requireSession()
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer ${api.getIdToken(current)}")
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        return JSONObject(api.execute(request))
    }

    private fun documentsUrl(path: String): String {
        val suffix = path.split('/').filter(String::isNotBlank).joinToString("/") { pathSegment(it) }
        val root = "https://firestore.googleapis.com/v1/projects/${BuildConfig.FIREBASE_PROJECT_ID}" +
            "/databases/(default)/documents"
        return if (suffix.isBlank()) root else "$root/$suffix"
    }

    private fun parseUser(document: JSONObject): TrioUser? {
        val fields = firestoreFields(document)
        val uid = fields.optString("uid").ifBlank {
            document.optString("name").substringAfterLast('/').takeIf(String::isNotBlank) ?: return null
        }
        return TrioUser(
            uid = uid,
            name = fields.optString("displayName").ifBlank { fields.optString("name").ifBlank { "Trio Member" } },
            userId = fields.optString("userId"),
            bio = fields.optString("bio"),
            photoUrl = fields.optString("photoURL"),
            category = fields.optString("selectedCategory").ifBlank { "Starter" },
            xp = fields.longValue("xp"),
            level = fields.longValue("level").coerceAtLeast(1),
            weeklyXp = fields.longValue("weeklyXp"),
            monthlyXp = fields.longValue("monthlyXp"),
            streak = fields.longValue("streakCurrent")
        )
    }

    private fun parseMessage(document: JSONObject): TrioMessage? {
        val fields = firestoreFields(document)
        val id = document.optString("name").substringAfterLast('/')
        if (id.isBlank()) return null
        return TrioMessage(
            id = id,
            uid = fields.optString("uid"),
            name = fields.optString("name"),
            text = fields.optString("text"),
            createdAtMs = fields.longValue("createdAtMs").takeIf { it > 0 } ?: fields.longValue("createdAt"),
            seen = fields.longValue("seen")
        )
    }

    private fun relationFields(uid: String, user: TrioUser, createdAt: JSONObject): JSONObject =
        JSONObject()
            .put("uid", uid)
            .put("userId", user.userId)
            .put("name", user.name)
            .put("createdAt", createdAt)

    private fun firestoreFields(document: JSONObject): JSONObject {
        val fields = document.optJSONObject("fields") ?: return JSONObject()
        val decoded = JSONObject()
        val keys = fields.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            decoded.put(key, decodeFirestoreValue(fields.optJSONObject(key) ?: JSONObject()))
        }
        return decoded
    }

    private fun decodeFirestoreValue(value: JSONObject): Any? = when {
        value.has("stringValue") -> value.optString("stringValue")
        value.has("integerValue") -> value.optString("integerValue").toLongOrNull() ?: 0L
        value.has("doubleValue") -> value.optDouble("doubleValue")
        value.has("booleanValue") -> value.optBoolean("booleanValue")
        value.has("timestampValue") -> value.optString("timestampValue")
        value.has("nullValue") -> null
        value.has("arrayValue") -> {
            val values = value.optJSONObject("arrayValue")?.optJSONArray("values") ?: JSONArray()
            (0 until values.length()).map { decodeFirestoreValue(values.optJSONObject(it) ?: JSONObject()) }
        }
        value.has("mapValue") -> {
            val map = value.optJSONObject("mapValue")?.optJSONObject("fields") ?: JSONObject()
            val output = JSONObject()
            val keys = map.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                output.put(key, decodeFirestoreValue(map.optJSONObject(key) ?: JSONObject()))
            }
            output
        }
        else -> JSONObject.NULL
    }

    private fun JSONObject.longValue(key: String): Long = when (val value = opt(key)) {
        is Number -> value.toLong()
        is String -> value.toLongOrNull() ?: 0L
        else -> 0L
    }

    private fun chatId(first: String, second: String): String = listOf(first, second).sorted().joinToString("_")

    private fun pathSegment(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
}
