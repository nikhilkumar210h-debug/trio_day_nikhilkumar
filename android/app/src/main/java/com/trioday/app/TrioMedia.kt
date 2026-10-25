package com.trioday.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException

/*
 * TrioMedia — native port of public/image-upload.js for profile photos:
 * 1) request signed Cloudinary params from the trio-media-upload Worker
 *    (POST /media/sign { kind: "profile" }, Bearer Firebase ID token),
 * 2) compress the picked image client-side (≤640px, ≤500 KB, JPEG),
 * 3) upload via multipart to Cloudinary,
 * 4) return the f_auto,q_auto-optimized secure URL and save it to the
 *    users/{uid} Firestore document — the same photo the webapp displays.
 */
object TrioMedia {

    private const val DEFAULT_MEDIA_SIGN_URL = "https://trio-media-upload.trioday-nikhil.workers.dev/media/sign"

    suspend fun uploadProfilePhoto(api: TrioApi, context: Context, uri: Uri): String =
        withContext(Dispatchers.IO) {
            val compressed = compressImage(context, uri, maxEdge = 640, maxBytes = 500 * 1024)
                ?: throw IOException("That image could not be read. Try another photo.")
            val current = api.requireSession()
            val signBody = JSONObject().put("kind", "profile")
            val signRequest = Request.Builder()
                .url(DEFAULT_MEDIA_SIGN_URL)
                .header("Authorization", "Bearer ${api.getIdToken(current)}")
                .post(signBody.toString().toRequestBody("application/json".toMediaType()))
                .build()
            val signRaw = api.execute(signRequest)
            val signed = JSONObject(signRaw)
            if (!signed.has("signature")) throw IOException("The media service is unavailable right now.")

            val form = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", "avatar.jpg", compressed.toRequestBody("image/jpeg".toMediaType()))
                .addFormDataPart("api_key", signed.getString("apiKey"))
                .addFormDataPart("timestamp", signed.getLong("timestamp").toString())
                .addFormDataPart("signature", signed.getString("signature"))
                .addFormDataPart("folder", signed.getString("folder"))
                .addFormDataPart("public_id", signed.getString("publicId"))
                .addFormDataPart("overwrite", signed.optBoolean("overwrite", true).toString())
                .build()
            val uploadRequest = Request.Builder()
                .url(signed.getString("uploadUrl"))
                .post(form)
                .build()
            val response = JSONObject(api.execute(uploadRequest))
            val secureUrl = response.optString("secure_url")
            if (secureUrl.isBlank()) throw IOException("Cloudinary did not return a photo URL.")
            val optimized = cloudinaryAutoUrl(secureUrl)
            api.savePhotoUrl(optimized)
            optimized
        }

    /**
     * Progressive downscale + JPEG recompress until the payload fits the
     * budget — the Android equivalent of compressImageFile() in the webapp.
     */
    private fun compressImage(context: Context, uri: Uri, maxEdge: Int, maxBytes: Int): ByteArray? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        var sample = 1
        while (bounds.outWidth / (sample * 2) >= maxEdge || bounds.outHeight / (sample * 2) >= maxEdge) {
            sample *= 2
        }
        val bitmap = context.contentResolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return null

        val scaled = scaleDown(bitmap, maxEdge)
        var quality = 88
        var bytes = scaled.toJpeg(quality)
        while (bytes.size > maxBytes && quality > 40) {
            quality -= 10
            bytes = scaled.toJpeg(quality)
        }
        if (scaled !== bitmap) bitmap.recycle()
        return bytes
    }

    private fun scaleDown(source: Bitmap, maxEdge: Int): Bitmap {
        val largest = maxOf(source.width, source.height)
        if (largest <= maxEdge) return source
        val scale = maxEdge.toFloat() / largest
        return Bitmap.createScaledBitmap(source, (source.width * scale).toInt().coerceAtLeast(1), (source.height * scale).toInt().coerceAtLeast(1), true)
    }

    private fun Bitmap.toJpeg(quality: Int): ByteArray = ByteArrayOutputStream().use { stream ->
        compress(Bitmap.CompressFormat.JPEG, quality, stream)
        stream.toByteArray()
    }
}
