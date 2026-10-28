package com.trioday.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
internal val httpClient = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(25, TimeUnit.SECONDS)
    .build()

class AuthSession(
    val uid: String,
    val email: String,
    private var idToken: String,
    private var refreshToken: String,
    private var expiresAtMillis: Long
) {
    @Synchronized
    fun validIdToken(): String? =
        idToken.takeIf { it.isNotBlank() && System.currentTimeMillis() < expiresAtMillis - 60_000 }

    @Synchronized
    fun updateToken(token: String, refresh: String, expiresInSeconds: Long) {
        idToken = token
        refreshToken = refresh
        expiresAtMillis = System.currentTimeMillis() + expiresInSeconds * 1000
    }

    @Synchronized
    fun refreshToken(): String = refreshToken
}

class TrioApi(context: Context) {
    private val appContext = context.applicationContext
    private val tokenStore = TokenStore(appContext)
    private val settings = appContext.getSharedPreferences("trio-preferences", Context.MODE_PRIVATE)
    private var session: AuthSession? = null

    suspend fun restoreSession(): AuthSession? = withContext(Dispatchers.IO) {
        val refreshToken = tokenStore.read() ?: return@withContext null
        val response = requestJson(
            "https://securetoken.googleapis.com/v1/token?key=${BuildConfig.FIREBASE_API_KEY}",
            "grant_type=refresh_token&refresh_token=${urlEncode(refreshToken)}",
            "application/x-www-form-urlencoded"
        )
        val nextRefreshToken = response.getString("refresh_token")
        val restored = AuthSession(
            uid = response.getString("user_id"),
            email = settings.getString("sessionEmail", "").orEmpty(),
            idToken = response.getString("id_token"),
            refreshToken = nextRefreshToken,
            expiresAtMillis = System.currentTimeMillis() + response.optLong("expires_in", 3600) * 1000
        )
        tokenStore.write(nextRefreshToken)
        session = restored
        restored
    }

    suspend fun signIn(email: String, password: String): AuthSession = authenticate(
        endpoint = "signInWithPassword",
        body = JSONObject().put("email", email).put("password", password).put("returnSecureToken", true)
    )

    suspend fun signInWithTrioUid(trioUid: String, password: String): AuthSession = withContext(Dispatchers.IO) {
        val response = requestJson(
            "https://us-central1-${BuildConfig.FIREBASE_PROJECT_ID}.cloudfunctions.net/signInWithTrioUid",
            JSONObject()
                .put("data", JSONObject().put("trioUid", trioUid.trim().uppercase()).put("password", password))
                .toString()
        )
        val customToken = response.optJSONObject("result")?.optString("customToken")
            ?: throw IOException(response.optJSONObject("error")?.optString("message") ?: "Trio UID sign-in failed.")
        val tokenResponse = requestJson(
            "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${BuildConfig.FIREBASE_API_KEY}",
            JSONObject().put("token", customToken).put("returnSecureToken", true).toString()
        )
        saveAuthenticatedSession(tokenResponse)
    }

    /**
     * Google Sign-In (same accounts as the webapp): exchange a Google ID
     * token from Credential Manager for a Firebase session via
     * accounts:signInWithIdp — the same endpoint the Firebase SDK uses.
     * Returns the session plus the Google display name for profile self-heal.
     */
    suspend fun signInWithGoogleIdToken(googleIdToken: String): Pair<AuthSession, String> =
        withContext(Dispatchers.IO) {
            val response = requestJson(
                "https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${BuildConfig.FIREBASE_API_KEY}",
                JSONObject()
                    .put("postBody", "id_token=${urlEncode(googleIdToken)}&providerId=google.com")
                    .put("requestUri", "http://localhost")
                    .put("returnSecureToken", true)
                    .toString()
            )
            val displayName = response.optString("displayName").orEmpty()
            saveAuthenticatedSession(response) to displayName
        }

    suspend fun sendPasswordReset(email: String) = withContext(Dispatchers.IO) {
        requestJson(
            "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${BuildConfig.FIREBASE_API_KEY}",
            JSONObject().put("requestType", "PASSWORD_RESET").put("email", email.trim()).toString()
        )
    }

    suspend fun signUp(name: String, email: String, password: String): AuthSession {
        val created = authenticate(
            endpoint = "signUp",
            body = JSONObject().put("email", email).put("password", password).put("returnSecureToken", true)
        )
        val trioId = makeUserId(created.uid)
        val profile = JSONObject()
            .put("name", name)
            .put("uid", created.uid)
            .put("displayName", name)
            .put("userId", trioId)
            .put("trioUid", trioId)
            .put("bio", "")
            .put("photoURL", JSONObject.NULL)
            .put("emailHidden", false)
            .put("onboardingComplete", false)
            .put("createdAt", JSONObject().put("timestampValue", java.time.Instant.now().toString()))
            .put("updatedAt", JSONObject().put("timestampValue", java.time.Instant.now().toString()))
        // Rules-safe profile creation (same write the web SDK's setDoc sends).
        // A failure here is NOT fatal: ensureProfileDoc() retries on sign-in,
        // so the freshly created account never becomes a dead end.
        try {
            setDocument("users/${created.uid}", profile)
            setDocument("usersPrivate/${created.uid}", JSONObject().put("email", email))
        } catch (error: IOException) {
            // Profile will be healed automatically right after sign-in.
        }
        return created
    }

    /**
     * SDK-style document upsert via documents:commit (a bare update write with
     * no precondition) — identical semantics to the webapp's setDoc. Unlike a
     * PATCH with updateMask, the rules engine evaluates it as a clean CREATE
     * when the document does not exist.
     */
    internal suspend fun setDocument(path: String, values: JSONObject) = withContext(Dispatchers.IO) {
        val current = requireSession()
        val body = JSONObject().put(
            "writes",
            JSONArray().put(
                JSONObject()
                    .put(
                        "update",
                        JSONObject()
                            .put(
                                "name",
                                "projects/${BuildConfig.FIREBASE_PROJECT_ID}/databases/(default)/documents/$path"
                            )
                            .put("fields", encodeFirestoreFields(values))
                    )
            )
        )
        val request = Request.Builder()
            .url("https://firestore.googleapis.com/v1/projects/${BuildConfig.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit")
            .header("Authorization", "Bearer ${getIdToken(current)}")
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        execute(request)
    }

    /**
     * Native port of the webapp's ensureUserProfile self-heal: if the
     * users/{uid} document is missing (an account created while the old
     * broken rules were live), create it now. Gamification fields are never
     * seeded — only the gamification Worker may write those. Returns true
     * when a profile document exists afterwards.
     */
    suspend fun ensureProfileDoc(displayName: String? = null): Boolean = withContext(Dispatchers.IO) {
        val current = requireSession()
        try {
            firestoreRequest(current, "users/${current.uid}", "GET")
            true
        } catch (_: Exception) {
            try {
                val name = displayName?.trim().takeUnless { it.isNullOrBlank() }
                    ?: sessionEmail().substringBefore("@").takeIf { it.isNotBlank() }
                    ?: "Trio Member"
                val trioId = makeUserId(current.uid)
                val profile = JSONObject()
                    .put("uid", current.uid)
                    .put("name", name)
                    .put("displayName", name)
                    .put("userId", trioId)
                    .put("trioUid", trioId)
                    .put("bio", "")
                    .put("emailHidden", false)
                    .put("onboardingComplete", false)
                    .put("createdAt", JSONObject().put("timestampValue", java.time.Instant.now().toString()))
                    .put("updatedAt", JSONObject().put("timestampValue", java.time.Instant.now().toString()))
                setDocument("users/${current.uid}", profile)
                if (sessionEmail().isNotBlank()) {
                    runCatching { setDocument("usersPrivate/${current.uid}", JSONObject().put("email", sessionEmail())) }
                }
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    /** Last known account email, persisted locally (used by self-heal + admin gate). */
    fun sessionEmail(): String = settings.getString("sessionEmail", session?.email.orEmpty()).orEmpty()

    private suspend fun authenticate(endpoint: String, body: JSONObject): AuthSession = withContext(Dispatchers.IO) {
        val response = requestJson(
            "https://identitytoolkit.googleapis.com/v1/accounts:$endpoint?key=${BuildConfig.FIREBASE_API_KEY}",
            body.toString()
        )
        saveAuthenticatedSession(response)
    }

    private fun saveAuthenticatedSession(response: JSONObject): AuthSession {
        val expiresIn = response.optString("expiresIn", "3600").toLongOrNull() ?: 3600
        val authenticated = AuthSession(
            uid = response.getString("localId"),
            email = response.optString("email"),
            idToken = response.getString("idToken"),
            refreshToken = response.getString("refreshToken"),
            expiresAtMillis = System.currentTimeMillis() + expiresIn * 1000
        )
        tokenStore.write(authenticated.refreshToken())
        if (authenticated.email.isNotBlank()) {
            settings.edit().putString("sessionEmail", authenticated.email).apply()
        }
        session = authenticated
        return authenticated
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        tokenStore.clear()
        settings.edit().remove("sessionEmail").apply()
        session = null
    }

    fun preference(key: String, default: String = ""): String = settings.getString(key, default) ?: default

    fun setPreference(key: String, value: String) {
        settings.edit().putString(key, value).apply()
    }

    fun guestTasksPlayed(): Int = settings.getInt("guestTasksPlayed", 0)

    fun guestClaims(): JSONArray = try {
        JSONArray(settings.getString("guestClaims", "[]"))
    } catch (_: org.json.JSONException) {
        JSONArray()
    }

    fun recordGuestCompletion(activity: ActivityItem, task: TaskItem, language: String) {
        val claims = guestClaims()
        if ((0 until claims.length()).any { claims.optJSONObject(it)?.optString("taskId") == task.id }) return
        if (guestTasksPlayed() >= 3) throw IOException("You’ve used all 3 free tasks. Sign in to continue.")
        claims.put(
            JSONObject()
                .put("activityId", activity.id)
                .put("taskId", task.id)
                .put("taskNumber", task.number)
                .put("xp", task.xp)
                .put("title", if (language == "HI") task.titleHi.ifBlank { task.title } else task.title)
        )
        settings.edit()
            .putString("guestClaims", claims.toString())
            .putInt("guestTasksPlayed", guestTasksPlayed() + 1)
            .apply()
    }

    suspend fun claimGuestProgress(): JSONObject = withContext(Dispatchers.IO) {
        val current = requireSession()
        val claims = guestClaims()
        if (claims.length() == 0) return@withContext JSONObject().put("claimed", 0)
        val payload = JSONObject()
            .put("claims", claims)
            .put("timeZone", java.util.TimeZone.getDefault().id)
        val request = Request.Builder()
            .url("${BuildConfig.GAMIFICATION_WORKER_URL}/api/activity/claim-guest-xp")
            .header("Authorization", "Bearer ${getIdToken(current)}")
            .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        val response = JSONObject(execute(request))
        settings.edit().remove("guestClaims").remove("guestTasksPlayed").apply()
        response
    }

    suspend fun saveProfile(name: String, bio: String) = withContext(Dispatchers.IO) {
        val current = requireSession()
        val profile = JSONObject()
            .put("uid", current.uid)
            .put("name", name.trim())
            .put("displayName", name.trim())
            .put("bio", bio.trim())
            .put("updatedAt", JSONObject().put("timestampValue", java.time.Instant.now().toString()))
        firestoreRequest(current, "users/${current.uid}", "PATCH", JSONObject().put("fields", encodeFirestoreFields(profile)))
    }

    suspend fun savePhotoUrl(url: String) = withContext(Dispatchers.IO) {
        val current = requireSession()
        val fields = JSONObject()
            .put("photoURL", url)
            .put("updatedAt", JSONObject().put("timestampValue", java.time.Instant.now().toString()))
        firestoreRequest(current, "users/${current.uid}", "PATCH", JSONObject().put("fields", encodeFirestoreFields(fields)))
    }

    /** Owner-only mirror of the account email (usersPrivate/{uid}). Used for
     *  the admin gate and the profile page, mirroring the webapp. */
    suspend fun loadPrivateEmail(): String = withContext(Dispatchers.IO) {
        val current = requireSession()
        try {
            val document = firestoreRequest(current, "usersPrivate/${current.uid}", "GET")
            document.stringField("email")
        } catch (_: Exception) {
            ""
        }
    }

    /** Streak shield activation — server-authoritative (Worker-owned field). */
    suspend fun useShield(): JSONObject = withContext(Dispatchers.IO) {
        val current = requireSession()
        val payload = JSONObject().put("timeZone", java.util.TimeZone.getDefault().id)
        val request = Request.Builder()
            .url("${BuildConfig.GAMIFICATION_WORKER_URL}/gamification/use-shield")
            .header("Authorization", "Bearer ${getIdToken(current)}")
            .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        JSONObject(execute(request))
    }

    suspend fun saveCategory(category: String) = withContext(Dispatchers.IO) {
        val current = requireSession()
        val fields = JSONObject()
            .put("selectedCategory", category)
            .put("onboardingComplete", true)
            .put("updatedAt", JSONObject().put("timestampValue", java.time.Instant.now().toString()))
        firestoreRequest(current, "users/${current.uid}", "PATCH", JSONObject().put("fields", encodeFirestoreFields(fields)))
        setPreference("selectedCategory", category)
    }

    suspend fun loadProfile(): UserProfile = withContext(Dispatchers.IO) {
        val current = requireSession()
        val document = firestoreRequest(current, "users/${current.uid}", "GET")
        // The *Field helpers expect the DOCUMENT root (they unwrap .fields
        // themselves). Calling them on the already-unwrapped fields object
        // made every profile field parse as empty — the "blank profile" bug.
        UserProfile(
            uid = document.stringField("uid").ifBlank { current.uid },
            name = document.stringField("name").ifBlank { current.email.substringBefore("@") },
            userId = document.stringField("userId"),
            bio = document.stringField("bio"),
            photoUrl = document.stringField("photoURL"),
            selectedCategory = document.stringField("selectedCategory"),
            onboardingComplete = document.booleanField("onboardingComplete"),
            xp = document.longField("xp"),
            level = document.longField("level").coerceAtLeast(1),
            weeklyXp = document.longField("weeklyXp"),
            monthlyXp = document.longField("monthlyXp"),
            streak = document.longField("streakCurrent"),
            bestStreak = document.longField("streakBest"),
            shields = document.longField("shields"),
            badges = document.stringListField("badges")
        )
    }

    suspend fun loadActivities(
        category: String? = null,
        guestAllowed: Boolean = false,
        limit: Int = 30
    ): List<ActivityItem> = withContext(Dispatchers.IO) {
        val query = buildString {
            append("select=id,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp,cover_image_url,is_guest_allowed,is_published,display_order")
            append("&is_published=eq.true&order=display_order.asc&limit=$limit")
            if (!category.isNullOrBlank()) append("&category=eq.${urlEncode(category)}")
            if (guestAllowed) append("&is_guest_allowed=eq.true")
        }
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/rest/v1/activities?$query")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
            .header("Accept", "application/json")
            .get()
            .build()
        val response = execute(request)
        val items = JSONArray(response)
        (0 until items.length()).map { index ->
            val item = items.getJSONObject(index)
            ActivityItem(
                id = item.getString("id"),
                category = item.optString("category"),
                title = item.optString("title_en", "Activity"),
                description = item.optString("description_en"),
                difficulty = item.optString("difficulty", "Mixed"),
                xp = item.optInt("total_xp"),
                imageUrl = item.optString("cover_image_url"),
                guestAllowed = item.optBoolean("is_guest_allowed"),
                published = item.optBoolean("is_published", true),
                displayOrder = item.optInt("display_order"),
                titleHi = item.optString("title_hi"),
                descriptionHi = item.optString("description_hi")
            )
        }
    }

    suspend fun loadTasks(activityId: String): List<TaskItem> = withContext(Dispatchers.IO) {
        val query = "select=id,task_number,task_type,title_en,title_hi,instructions_en,instructions_hi,min_time_seconds,xp_reward" +
            "&activity_id=eq.${urlEncode(activityId)}&order=task_number.asc"
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/rest/v1/tasks?$query")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
            .header("Accept", "application/json")
            .get()
            .build()
        val items = JSONArray(execute(request))
        (0 until items.length()).map { index ->
            val item = items.getJSONObject(index)
            TaskItem(
                id = item.getString("id"),
                number = item.optInt("task_number"),
                title = item.optString("title_en", "Task"),
                instructions = item.optString("instructions_en"),
                minTimeSeconds = item.optInt("min_time_seconds"),
                xp = item.optInt("xp_reward"),
                type = item.optString("task_type"),
                titleHi = item.optString("title_hi"),
                instructionsHi = item.optString("instructions_hi")
            )
        }
    }

    suspend fun completeTask(
        activityId: String,
        task: TaskItem,
        proof: String,
        timeSpentSeconds: Long
    ): JSONObject = withContext(Dispatchers.IO) {
        require(proof.trim().length >= 15) { "Write at least 15 characters about what you did." }
        require(proof.length <= 2000) { "Reflection must be 2,000 characters or fewer." }
        val current = requireSession()
        val token = getIdToken(current)
        val payload = JSONObject()
            .put("activityId", activityId)
            .put("taskId", task.id)
            .put("taskNumber", task.number)
            .put("proof", proof.trim())
            .put("timeSpent", timeSpentSeconds)
            .put("timeZone", java.util.TimeZone.getDefault().id)
        val request = Request.Builder()
            .url("${BuildConfig.GAMIFICATION_WORKER_URL}/api/activity/complete-task")
            .header("Authorization", "Bearer $token")
            .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        JSONObject(execute(request))
    }

    suspend fun skipTask(activityId: String, task: TaskItem) = withContext(Dispatchers.IO) {
        val current = requireSession()
        val payload = JSONObject()
            .put("activityId", activityId)
            .put("taskId", task.id)
            .put("taskNumber", task.number)
            .put("timeZone", java.util.TimeZone.getDefault().id)
        val request = Request.Builder()
            .url("${BuildConfig.GAMIFICATION_WORKER_URL}/api/activity/skip-task")
            .header("Authorization", "Bearer ${getIdToken(current)}")
            .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        execute(request)
    }

    internal suspend fun getIdToken(current: AuthSession): String {
        current.validIdToken()?.let { return it }
        val response = requestJson(
            "https://securetoken.googleapis.com/v1/token?key=${BuildConfig.FIREBASE_API_KEY}",
            "grant_type=refresh_token&refresh_token=${urlEncode(current.refreshToken())}",
            "application/x-www-form-urlencoded"
        )
        val idToken = response.getString("id_token")
        val refreshToken = response.getString("refresh_token")
        val expiresIn = response.optLong("expires_in", 3600)
        current.updateToken(idToken, refreshToken, expiresIn)
        tokenStore.write(refreshToken)
        return idToken
    }

    internal suspend fun requireSession(): AuthSession {
        session?.let { return it }
        restoreSession()?.let { return it }
        throw IOException("Please sign in again.")
    }

    internal suspend fun firestoreRequest(
        auth: AuthSession,
        path: String,
        method: String,
        body: JSONObject? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val token = getIdToken(auth)
        val url = "https://firestore.googleapis.com/v1/projects/${BuildConfig.FIREBASE_PROJECT_ID}" +
            "/databases/(default)/documents/$path"
        val builder = Request.Builder()
            .header("Authorization", "Bearer $token")
        when (method) {
            "PATCH" -> {
                val fields = body?.optJSONObject("fields") ?: JSONObject()
                if (fields.length() == 0) throw IOException("Refusing to update a document without fields.")
                // Masked updates MUST use the documents:commit form with the
                // updateMask INSIDE the write — the exact wire format the
                // Firestore SDKs send. The ?updateMask.fieldPaths= query
                // binding is rejected/mis-evaluated by this API and was the
                // cause of every "Missing or insufficient permissions"
                // failure on profile saves, goal switches and mark-read.
                // No precondition: masked bare-update upserts, so relation
                // documents (follows) are still created when missing.
                val mask = JSONArray()
                fields.keys().asSequence().forEach { mask.put(it) }
                val write = JSONObject()
                    .put(
                        "update",
                        JSONObject()
                            .put(
                                "name",
                                "projects/${BuildConfig.FIREBASE_PROJECT_ID}/databases/(default)/documents/$path"
                            )
                            .put("fields", fields)
                    )
                    .put("updateMask", JSONObject().put("fieldPaths", mask))
                val commitBody = JSONObject().put("writes", JSONArray().put(write))
                val commitRequest = Request.Builder()
                    .url("https://firestore.googleapis.com/v1/projects/${BuildConfig.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit")
                    .header("Authorization", "Bearer $token")
                    .post(commitBody.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()
                val response = execute(commitRequest)
                if (response.isBlank()) JSONObject() else JSONObject(response)
            }
            "DELETE" -> {
                builder.url(url).delete()
                val response = execute(builder.build())
                if (response.isBlank()) JSONObject() else JSONObject(response)
            }
            else -> {
                builder.url(url).get()
                val response = execute(builder.build())
                if (response.isBlank()) JSONObject() else JSONObject(response)
            }
        }
    }

    internal fun requestJson(url: String, body: String, contentType: String = "application/json"): JSONObject {
        val mediaType = contentType.toMediaType()
        val request = Request.Builder()
            .url(url)
            .post(body.toRequestBody(mediaType))
            .header("Accept", "application/json")
            .build()
        return JSONObject(execute(request))
    }

    internal fun execute(request: Request): String {
        httpClient.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val error = runCatching { JSONObject(body).getJSONObject("error").optString("message") }
                    .getOrNull()
                    .orEmpty()
                throw IOException(error.ifBlank { "Request failed (${response.code})." })
            }
            return body
        }
    }

    internal fun encodeFirestoreFields(values: JSONObject): JSONObject {
        val fields = JSONObject()
        val keys = values.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = values.get(key)
            fields.put(
                key,
                when (value) {
                    is String -> JSONObject().put("stringValue", value)
                    is Number -> JSONObject().put("integerValue", value.toString())
                    is Boolean -> JSONObject().put("booleanValue", value)
                    JSONObject.NULL -> JSONObject().put("nullValue", JSONObject.NULL)
                    else -> value
                }
            )
        }
        return fields
    }
}

private fun makeUserId(uid: String): String {
    var hash = 2166136261L
    val input = "$uid:0"
    input.forEach { character ->
        hash = ((hash xor character.code.toLong()) * 16777619L) and 0xFFFFFFFFL
    }
    return "TRIO-${hash.toString(36).uppercase().padStart(8, '0').takeLast(8)}"
}

/**
 * Port of utils.js cloudinaryAutoUrl — injects f_auto,q_auto into a Cloudinary
 * secure_url so every surface serves the optimal format/quality, exactly like
 * the webapp does for avatars and covers.
 */
private val cloudinaryAutoRegex = Regex("/image/upload/(v\\d+/)?")

fun cloudinaryAutoUrl(secureUrl: String): String {
    if (secureUrl.isBlank() || secureUrl.contains("f_auto,q_auto")) return secureUrl
    return cloudinaryAutoRegex.replace(secureUrl, "/image/upload/f_auto,q_auto/$1")
}

private fun JSONObject.stringField(name: String): String =
    optJSONObject("fields")?.optJSONObject(name)?.optString("stringValue").orEmpty()

private fun JSONObject.booleanField(name: String): Boolean =
    optJSONObject("fields")?.optJSONObject(name)?.optBoolean("booleanValue") ?: false

private fun JSONObject.stringListField(name: String): List<String> {
    val values = optJSONObject("fields")?.optJSONObject(name)?.optJSONObject("arrayValue")?.optJSONArray("values")
        ?: return emptyList()
    return (0 until values.length()).mapNotNull { values.optJSONObject(it)?.optString("stringValue") }
}

private fun JSONObject.longField(name: String): Long {
    val value = optJSONObject("fields")?.optJSONObject(name) ?: return 0L
    return value.optString("integerValue").toLongOrNull()
        ?: value.optString("doubleValue").toDoubleOrNull()?.toLong()
        ?: 0L
}

private fun urlEncode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())

private class TokenStore(context: Context) {
    private val preferences = context.getSharedPreferences("trio-auth", Context.MODE_PRIVATE)
    private val keyAlias = "com.trioday.app.refresh-token"

    fun read(): String? {
        val encoded = preferences.getString("refreshToken", null) ?: return null
        val encrypted = try {
            Base64.decode(encoded, Base64.NO_WRAP)
        } catch (error: IllegalArgumentException) {
            clear()
            throw IOException("Saved sign-in data is invalid. Please sign in again.", error)
        }
        if (encrypted.size <= 12) {
            clear()
            throw IOException("Saved sign-in data is incomplete. Please sign in again.")
        }
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                GCMParameterSpec(128, encrypted.copyOfRange(0, 12))
            )
            String(cipher.doFinal(encrypted.copyOfRange(12, encrypted.size)), Charsets.UTF_8)
        } catch (error: GeneralSecurityException) {
            clear()
            throw IOException("Saved sign-in data could not be decrypted. Please sign in again.", error)
        }
    }

    fun write(token: String) {
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val encrypted = cipher.iv + cipher.doFinal(token.toByteArray(Charsets.UTF_8))
            preferences.edit().putString("refreshToken", Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
        } catch (error: GeneralSecurityException) {
            throw IOException("Could not securely save sign-in data.", error)
        }
    }

    fun clear() {
        preferences.edit().remove("refreshToken").apply()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        (keyStore.getKey(keyAlias, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}
