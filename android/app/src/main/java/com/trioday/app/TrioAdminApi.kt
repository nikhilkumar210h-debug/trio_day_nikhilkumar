package com.trioday.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

/*
 * TrioAdminApi — native mirror of public/admin-activity.js:
 * reads every activity (including drafts) and task via the Supabase REST
 * API, and performs create/update/delete through the gamification Worker's
 * admin endpoints. The Worker enforces the same strict ADMIN_EMAILS check,
 * so this client can only mutate what the signed-in admin owns.
 */
class TrioAdminApi(private val api: TrioApi) {

    data class AdminTask(
        val id: String,
        val activityId: String,
        val number: Int,
        val type: String,
        val title: String,
        val titleHi: String,
        val instructions: String,
        val instructionsHi: String,
        val minTimeSeconds: Int,
        val xp: Int
    )

    suspend fun loadAllActivities(): List<ActivityItem> = withContext(Dispatchers.IO) {
        val query = "select=id,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp," +
            "cover_image_url,is_guest_allowed,is_published,display_order&order=display_order.asc&limit=200"
        val request = supabaseGet(query)
        val items = JSONArray(api.execute(request))
        (0 until items.length()).map { index ->
            val item = items.getJSONObject(index)
            ActivityItem(
                id = item.getString("id"),
                category = item.optString("category"),
                title = item.optString("title_en", "Untitled activity"),
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

    suspend fun loadAllTasks(): List<AdminTask> = withContext(Dispatchers.IO) {
        val query = "select=id,activity_id,task_number,task_type,title_en,title_hi,instructions_en,instructions_hi," +
            "min_time_seconds,xp_reward&order=task_number.asc&limit=500"
        val request = supabaseGet(query)
        val items = JSONArray(api.execute(request))
        (0 until items.length()).map { index ->
            val item = items.getJSONObject(index)
            AdminTask(
                id = item.getString("id"),
                activityId = item.optString("activity_id"),
                number = item.optInt("task_number"),
                type = item.optString("task_type", "Action Step"),
                title = item.optString("title_en", "Task"),
                titleHi = item.optString("title_hi"),
                instructions = item.optString("instructions_en"),
                instructionsHi = item.optString("instructions_hi"),
                minTimeSeconds = item.optInt("min_time_seconds"),
                xp = item.optInt("xp_reward")
            )
        }
    }

    suspend fun saveActivity(
        action: String,
        activityId: String,
        data: JSONObject
    ): Unit = withContext(Dispatchers.IO) {
        workerAdmin(
            "/api/admin/activity",
            JSONObject()
                .put("action", action)
                .put("activityId", activityId)
                .put("data", data)
        )
    }

    suspend fun saveTask(
        action: String,
        taskId: String,
        data: JSONObject
    ): Unit = withContext(Dispatchers.IO) {
        workerAdmin(
            "/api/admin/task",
            JSONObject()
                .put("action", action)
                .put("taskId", taskId)
                .put("data", data)
        )
    }

    /**
     * Upload a cover image for an activity through the Worker-signed
     * Cloudinary flow (identical to admin-activity.js uploadCover).
     * Returns the optimized secure URL, or null when nothing was picked.
     */
    suspend fun uploadCoverImage(imageBytes: ByteArray, fileName: String): String =
        withContext(Dispatchers.IO) {
            val sign = workerAdmin(
                "/api/admin/cloudinary-sign",
                JSONObject().put("folder", "trio/activities").put("filename", fileName)
            )
            val form = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", fileName, imageBytes.toRequestBody("image/jpeg".toMediaType()))
                .addFormDataPart("api_key", sign.getString("apiKey"))
                .addFormDataPart("timestamp", sign.getLong("timestamp").toString())
                .addFormDataPart("signature", sign.getString("signature"))
                .addFormDataPart("folder", sign.getString("folder"))
                .addFormDataPart("public_id", sign.getString("publicId"))
                .build()
            val request = Request.Builder()
                .url(sign.getString("uploadUrl"))
                .post(form)
                .build()
            val response = JSONObject(api.execute(request))
            val secureUrl = response.optString("secure_url")
            if (secureUrl.isBlank()) throw IOException("Cloudinary did not return an image URL.")
            cloudinaryAutoUrl(secureUrl)
        }

    private fun supabaseGet(query: String): Request = Request.Builder()
        .url("${BuildConfig.SUPABASE_URL}/rest/v1/$query")
        .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
        .header("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
        .header("Accept", "application/json")
        .get()
        .build()

    private suspend fun workerAdmin(path: String, body: JSONObject): JSONObject =
        withContext(Dispatchers.IO) {
            val current = api.requireSession()
            val request = Request.Builder()
                .url("${BuildConfig.GAMIFICATION_WORKER_URL}$path")
                .header("Authorization", "Bearer ${api.getIdToken(current)}")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()
            val raw = api.execute(request)
            if (raw.isBlank()) JSONObject() else JSONObject(raw)
        }
}
