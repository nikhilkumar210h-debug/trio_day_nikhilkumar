package com.trioday.app

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import okhttp3.Request

class AppUpdate(private val context: Context) {
    suspend fun check(): AppRelease = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(BuildConfig.GITHUB_RELEASES_URL)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Trio-Day-Android")
            .get()
            .build()

        httpClient.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException(
                    if (response.code == 404) "No Android release has been published yet."
                    else "Could not check for updates (${response.code})."
                )
            }

            val release = JSONObject(body)
            val version = release.optString("tag_name").trim().removePrefix("v")
            if (!version.matches(Regex("\\d+\\.\\d+\\.\\d+"))) {
                throw IOException("The latest release tag must use version format v1.2.3.")
            }

            val assets = release.optJSONArray("assets") ?: throw IOException("The latest release has no APK asset.")
            val apkUrl = (0 until assets.length())
                .map { assets.getJSONObject(it) }
                .firstOrNull { it.optString("name") == "trio-day.apk" }
                ?.optString("browser_download_url")
                ?.takeIf { it.startsWith("https://github.com/") }
                ?: throw IOException("The latest release must include an HTTPS asset named trio-day.apk.")

            if (compareVersions(version, BuildConfig.VERSION_NAME) <= 0) {
                throw IOException("You already have the latest version ($version).")
            }
            AppRelease(version, apkUrl)
        }
    }

    fun download(release: AppRelease): Long {
        val request = DownloadManager.Request(Uri.parse(release.apkUrl))
            .setTitle("Trio Day ${release.version}")
            .setDescription("Downloading the latest Trio Day update")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "trio-day-update.apk")
        return (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
    }

    private fun compareVersions(first: String, second: String): Int {
        val left = first.split(".").map(String::toInt)
        val right = second.split(".").map(String::toInt)
        for (index in 0..2) {
            val compared = left[index].compareTo(right[index])
            if (compared != 0) return compared
        }
        return 0
    }
}
