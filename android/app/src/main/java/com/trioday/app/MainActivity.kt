package com.trioday.app

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.launch
import java.io.IOException

private var lightMode by mutableStateOf(false)

class MainActivity : ComponentActivity() {
    private val api by lazy { TrioApi(applicationContext) }
    private val updater by lazy { AppUpdate(applicationContext) }
    private var downloadId: Long? = null
    private var pendingInstallUri: Uri? = null

    private val downloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val completedId = downloadId ?: return
            if (intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L) != completedId) return
            val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val uri = manager.getUriForDownloadedFile(completedId)
            if (uri == null) {
                Toast.makeText(this@MainActivity, "The update download failed. Please try again.", Toast.LENGTH_LONG).show()
                getSharedPreferences("app-update", MODE_PRIVATE).edit().remove("downloadId").apply()
                downloadId = null
                return
            }
            openInstaller(uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        downloadId = getSharedPreferences("app-update", MODE_PRIVATE)
            .getLong("downloadId", -1L)
            .takeIf { it >= 0L }
        ContextCompat.registerReceiver(
            this,
            downloadReceiver,
            IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        setContent {
            lightMode = api.preference("theme", "dark") == "light"
            TrioTheme(lightTheme = lightMode) {
                TrioDayApp(
                    api = api,
                    updater = updater,
                    onStartDownload = { release -> startDownload(release) }
                )
            }
        }
    }

    override fun onDestroy() {
        unregisterReceiver(downloadReceiver)
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        val uri = pendingInstallUri ?: downloadId?.let {
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).getUriForDownloadedFile(it)
        } ?: return
        if (packageManager.canRequestPackageInstalls()) {
            pendingInstallUri = null
            openInstaller(uri)
        }
    }

    private fun startDownload(release: AppRelease) {
        downloadId = updater.download(release)
        getSharedPreferences("app-update", MODE_PRIVATE).edit()
            .putLong("downloadId", downloadId ?: -1L)
            .apply()
    }

    private fun openInstaller(uri: Uri) {
        if (!packageManager.canRequestPackageInstalls()) {
            pendingInstallUri = uri
            startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                    .setData(Uri.parse("package:$packageName"))
            )
            return
        }
        val installIntent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(installIntent)
        getSharedPreferences("app-update", MODE_PRIVATE).edit().remove("downloadId").apply()
        downloadId = null
    }
}

private val AdminEmails = listOf("nikhilkumar210h@gmail.com", "nikhilkumar45374@gmail.com")

@Composable
private fun TrioDayApp(
    api: TrioApi,
    updater: AppUpdate,
    onStartDownload: (AppRelease) -> Unit
) {
    val scope = rememberCoroutineScope()
    val c = TrioTheme.colors
    val socialApi = remember { TrioSocialApi(api) }

    var session by remember { mutableStateOf<AuthSession?>(null) }
    var profile by remember { mutableStateOf<UserProfile?>(null) }
    var isAdmin by remember { mutableStateOf(false) }
    var booting by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var guestMode by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var route by remember { mutableStateOf("Today") }
    var playerActivity by remember { mutableStateOf<ActivityItem?>(null) }
    var language by remember { mutableStateOf(api.preference("language", "EN")) }
    var updateBusy by remember { mutableStateOf(false) }
    var selectedMember by remember { mutableStateOf<TrioUser?>(null) }

    // Auto-clear notices.
    LaunchedEffect(notice) {
        if (notice != null) {
            kotlinx.coroutines.delay(4000)
            notice = null
        }
    }

    fun reloadProfile() {
        scope.launch {
            try {
                profile = api.loadProfile()
            } catch (e: Exception) {
                error = e.message ?: "Could not refresh your profile."
            }
        }
    }

    fun afterSignIn() {
        reloadProfile()
        scope.launch {
            try {
                val email = api.loadPrivateEmail().lowercase()
                isAdmin = AdminEmails.contains(email) || session?.email?.lowercase()?.let { AdminEmails.contains(it) } == true
            } catch (_: Exception) { }
            if (api.guestClaims().length() > 0) {
                try {
                    val claimed = api.claimGuestProgress().optInt("claimed")
                    if (claimed > 0) notice = "$claimed guest task(s) credited to your account."
                } catch (e: Exception) {
                    error = "Guest progress will be claimed next time you're online."
                }
            }
        }
    }

    // Restore the saved session on boot.
    LaunchedEffect(Unit) {
        try {
            session = api.restoreSession()
        } catch (e: Exception) {
            error = e.message
        }
        if (session != null) {
            try {
                profile = api.loadProfile()
                if (profile?.onboardingComplete == false) route = "Today"
            } catch (e: Exception) {
                error = e.message ?: "Could not load your profile."
            }
            afterSignIn()
        }
        booting = false
    }

    val signedIn = session != null

    Box(Modifier.fillMaxSize().background(c.bg)) {
        Column(Modifier.fillMaxSize()) {
            when {
                booting -> Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    androidx.compose.material3.CircularProgressIndicator(color = Primary)
                }

                // ── Task player overlay ─────────────────────────────────
                playerActivity != null -> PlayerScreen(
                    api = api,
                    activity = playerActivity!!,
                    session = session,
                    language = language,
                    onExit = { playerActivity = null },
                    onProfileChanged = { reloadProfile() },
                    onRequireSignIn = { playerActivity = null; guestMode = false; route = "Today" }
                )

                // ── Auth ────────────────────────────────────────────────
                !signedIn && !guestMode -> AuthScreen(
                    busy = busy,
                    error = error,
                    onAuth = { name, identifier, password, isSignUp, useTrioId ->
                        scope.launch {
                            busy = true; error = null
                            try {
                                session = if (isSignUp) api.signUp(name, identifier, password)
                                else if (useTrioId) api.signInWithTrioUid(identifier, password)
                                else api.signIn(identifier, password)
                                afterSignIn()
                            } catch (e: Exception) {
                                error = e.message ?: "Sign-in failed."
                            } finally {
                                busy = false
                            }
                        }
                    },
                    onPasswordReset = { email ->
                        scope.launch {
                            busy = true; error = null
                            try {
                                api.sendPasswordReset(email)
                                notice = "Password reset instructions have been sent."
                            } catch (e: Exception) {
                                error = e.message ?: "Could not send the reset email."
                            } finally {
                                busy = false
                            }
                        }
                    },
                    onContinueGuest = { guestMode = true }
                )

                // ── Main app ─────────────────────────────────────────────
                else -> {
                    val navRoutes = if (isAdmin && signedIn) BaseNavItems.map { it.route } + "Admin" else BaseNavItems.map { it.route }
                    val member = selectedMember
                    Column(Modifier.fillMaxSize()) {
                        Box(Modifier.fillMaxSize().weight(1f)) {
                            when {
                                member != null -> MemberDetailScreen(
                                    socialApi = socialApi,
                                    myUid = session?.uid,
                                    person = member,
                                    onBack = { selectedMember = null },
                                    onMessage = { route = "Chat"; selectedMember = null }
                                )
                                else -> when (route) {
                                    "Today" -> TodayScreen(
                                        api = api,
                                        session = session,
                                        profile = profile,
                                        language = language,
                                        notice = notice,
                                        onOpenActivity = { activity -> playerActivity = activity },
                                        onSignIn = { guestMode = false },
                                        onSignOut = {
                                            scope.launch {
                                                api.signOut()
                                                session = null; profile = null; isAdmin = false
                                                guestMode = false; route = "Today"
                                            }
                                        },
                                        onProfileChanged = { reloadProfile() },
                                        onToggleLanguage = {
                                            language = if (language == "EN") "HI" else "EN"
                                            api.setPreference("language", language)
                                        },
                                        onToggleTheme = {
                                            val next = if (lightMode) "dark" else "light"
                                            api.setPreference("theme", next)
                                            lightMode = next == "light"
                                        }
                                    )
                                    "Leaderboard" -> LeaderboardScreen(
                                        socialApi = socialApi,
                                        myUid = session?.uid,
                                        onOpenProfile = { selectedMember = it }
                                    )
                                    "Chat" -> ChatScreen(
                                        socialApi = socialApi,
                                        myUid = session?.uid,
                                        language = language,
                                        onOpenProfile = { selectedMember = it },
                                        onFindPeople = { route = "Discover" }
                                    )
                                    "You" -> if (session == null) {
                                        // Guest gate — the profile is auth-guarded on the webapp too.
                                        Column(
                                            Modifier.fillMaxSize().background(c.bg).padding(28.dp),
                                            verticalArrangement = Arrangement.Center,
                                            horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
                                        ) {
                                            BrandMark(size = 44.dp)
                                            androidx.compose.foundation.layout.Spacer(
                                                Modifier.height(20.dp)
                                            )
                                            Text(
                                                "Your profile lives here",
                                                color = c.ink, fontSize = 22.sp,
                                                fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold
                                            )
                                            Text(
                                                "Sign in to sync your XP, badges, connections and messages to your Trio Day account.",
                                                color = c.inkMuted, fontSize = 14.sp,
                                                modifier = Modifier.padding(vertical = 10.dp)
                                            )
                                            TrioButton("Sign in or create account", { guestMode = false })
                                            androidx.compose.material3.TextButton(onClick = { route = "Help" }) {
                                                Text(
                                                    "❓ Help & about Trio Day",
                                                    color = c.primaryText,
                                                    fontSize = 13.sp,
                                                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
                                                )
                                            }
                                        }
                                    } else ProfileScreen(
                                        api = api,
                                        socialApi = socialApi,
                                        profile = profile,
                                        language = language,
                                        onNavigate = { route = it },
                                        onSignOut = {
                                            scope.launch {
                                                api.signOut()
                                                session = null; profile = null; isAdmin = false
                                                guestMode = false; route = "Today"
                                            }
                                        },
                                        onProfileChanged = { reloadProfile() },
                                        onNotice = { notice = it }
                                    )
                                    "Discover" -> DiscoverScreen(
                                        socialApi = socialApi,
                                        myUid = session?.uid,
                                        onOpenChat = { route = "Chat" }
                                    )
                                    "Connections" -> ConnectionsScreen(
                                        socialApi = socialApi,
                                        myUid = session?.uid,
                                        onBack = { route = "You" }
                                    )
                                    "Notifications" -> NotificationsScreen(
                                        socialApi = socialApi,
                                        myUid = session?.uid,
                                        onBack = { route = "You" },
                                        onNotice = { notice = it }
                                    )
                                    "Settings" -> SettingsScreen(
                                        api = api,
                                        profile = profile,
                                        theme = if (lightMode) "light" else "dark",
                                        language = language,
                                        versionName = BuildConfig.VERSION_NAME,
                                        onThemeChange = { value ->
                                            api.setPreference("theme", value)
                                            lightMode = value == "light"
                                        },
                                        onLanguageChange = { value ->
                                            language = value
                                            api.setPreference("language", value)
                                        },
                                        onProfileChanged = { reloadProfile() },
                                        onNotice = { notice = it },
                                        onBack = { route = "You" },
                                        onCheckUpdates = {
                                            scope.launch {
                                                updateBusy = true; error = null; notice = null
                                                try {
                                                    val release = updater.check()
                                                    onStartDownload(release)
                                                    notice = "Downloading Trio Day ${release.version}. Android will ask you to confirm installation."
                                                } catch (e: Exception) {
                                                    notice = e.message ?: "Update check failed."
                                                } finally {
                                                    updateBusy = false
                                                }
                                            }
                                        },
                                        busy = updateBusy
                                    )
                                    "Help" -> HelpScreen(onBack = { route = "Today" })
                                    "Admin" -> if (isAdmin) {
                                        AdminScreen(api = api, onNotice = { notice = it })
                                    } else {
                                        StateBox("🔒", "Admin only", "This area is restricted to Trio Day admins.", "Back to Today", onAction = { route = "Today" })
                                    }
                                    else -> TodayScreen(
                                        api = api, session = session, profile = profile, language = language, notice = null,
                                        onOpenActivity = { playerActivity = it },
                                        onSignIn = { guestMode = false },
                                        onSignOut = { scope.launch { api.signOut(); session = null; profile = null; route = "Today"; guestMode = false } },
                                        onProfileChanged = { reloadProfile() },
                                        onToggleLanguage = {
                                            language = if (language == "EN") "HI" else "EN"
                                            api.setPreference("language", language)
                                        },
                                        onToggleTheme = {
                                            val next = if (lightMode) "dark" else "light"
                                            api.setPreference("theme", next)
                                            lightMode = next == "light"
                                        }
                                    )
                                }
                            }
                        }
                        if (route in navRoutes && member == null) {
                            BottomNavBar(
                                activeRoute = route,
                                isAdmin = isAdmin && signedIn,
                                onNavigate = { route = it }
                            )
                        }
                    }
                }
            }
        }
    }
}
