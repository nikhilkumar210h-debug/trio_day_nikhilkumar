package com.trioday.app

import android.app.Activity
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import java.io.IOException

/*
 * GoogleIdentity — Credential Manager wrapper for Google Sign-In, matching
 * the webapp's Google button against the same Firebase accounts. Returns a
 * Google ID token that TrioApi exchanges for a Firebase session via
 * accounts:signInWithIdp.
 */
class GoogleIdentity(private val activity: Activity) {

    /** Opens the Google account sheet and returns the selected account's ID token. */
    suspend fun fetchGoogleIdToken(): String {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(false)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()
        val manager = CredentialManager.create(activity)
        return try {
            val response = manager.getCredential(activity, request)
            val credential = response.credential
            if (credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                GoogleIdTokenCredential.createFrom(credential.data).idToken
            } else {
                throw IOException("Google sign-in returned an unexpected credential.")
            }
        } catch (error: GetCredentialCancellationException) {
            throw IOException("Google sign-in was cancelled.")
        } catch (error: NoCredentialException) {
            throw IOException("No Google account is available on this device. Add one in Android settings, or use email / Trio ID.")
        } catch (error: GetCredentialException) {
            throw IOException("Google sign-in is unavailable on this device (${error.message}).")
        }
    }

    /** Forget the previously selected Google account so the sheet shows again. */
    suspend fun clearCredentialState() {
        runCatching {
            CredentialManager.create(activity).clearCredentialState(ClearCredentialStateRequest())
        }
    }
}
