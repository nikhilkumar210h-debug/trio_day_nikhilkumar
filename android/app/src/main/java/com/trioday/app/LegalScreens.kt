package com.trioday.app

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * LegalScreens — fully NATIVE Privacy Policy and Terms & Conditions,
 * copied from the Trio Day webapp's legal pages (effective 18 October 2026).
 * No WebView, no external links: nothing can navigate the user out of the
 * app or expose the production website inside the app.
 */

private data class LegalSection(val number: String, val heading: String, val body: String)

private val PrivacySections = listOf(
    LegalSection("01", "Account data", "When you create or use an account, Trio Day may process your name, email address, Firebase user ID, permanent Trio UID, profile photo, bio, authentication provider and account timestamps. Email is kept in the private user record; the public profile does not intentionally expose the account email."),
    LegalSection("02", "Activity & Task content", "Activities, tasks, your task proofs/reflections, XP awards, streaks and badges are stored so the features you use can work. Activity definitions and tasks are stored in Supabase (PostgreSQL). Your task submissions and AI verification results are processed via Cloudflare Workers."),
    LegalSection("03", "Media", "Images and videos uploaded for activity cover images are stored with Cloudinary, auto-optimized in the trio/activities folder. No other user-generated media is currently stored."),
    LegalSection("04", "Private Chat", "Private Chat is one-to-one. Access is restricted by Firebase security rules and messages are stored under the participating accounts. Do not send passwords, one-time codes, financial information, exact private addresses or other sensitive information through Chat or task proofs."),
    LegalSection("05", "How we use data", "Data is used to authenticate accounts, operate Activities, show profiles and connections, deliver Chat and notifications, calculate valid progress (XP, streaks, badges), prevent abuse via AI verification, troubleshoot failures and maintain security. Trio Day does not use your content to create targeted advertising profiles."),
    LegalSection("06", "Service providers", "Trio Day uses Firebase for authentication and database services, Cloudflare Workers for selected server-side operations (AI verification, XP sync, admin APIs), Supabase (PostgreSQL) for activity/task definitions, and Cloudinary for configured media storage. Google sign-in is available as an authentication provider."),
    LegalSection("07", "Security & abuse prevention", "Authentication and protected operations use Firebase security controls and server-side checks. Login attempts are subject to Firebase's built-in abuse protections and Trio Day's additional login controls. AI verification checks task proofs against task-specific prompts to reject spam or low-effort submissions."),
    LegalSection("08", "Local storage", "The app stores preferences on your device (theme, language, guest task progress — max 3 tasks) and login-rate-limit state. These values help the app work smoothly and are not a substitute for account records."),
    LegalSection("09", "Retention & deletion", "We retain account and content data while it is needed to operate the service, comply with applicable obligations, resolve disputes, prevent abuse or preserve security. Deleting an account or content may not instantly remove every backup, log or third-party copy."),
    LegalSection("10", "Children & age requirements", "Users must follow the age and consent requirements that apply where they live. Where applicable law treats a user as a child, required parent or lawful-guardian consent must be obtained before processing that child's personal data. Trio Day does not knowingly request unnecessary sensitive information from children and does not use children's data for targeted advertising."),
    LegalSection("11", "Your choices", "You can control the profile, Activity and Chat information exposed by the app. You can change or delete content where the feature provides that control. For account, access, correction, deletion or privacy questions, use the Help Center and the support channel made available by Trio Day."),
    LegalSection("12", "Policy changes", "This policy may change as Trio Day's features, providers or legal obligations change. The effective date at the top will be updated when the policy is materially revised.")
)

private val TermsSections = listOf(
    LegalSection("01", "Acceptance", "By creating an account or using Trio Day, you agree to these Terms & Conditions and the Privacy Policy. If you do not agree, do not use the service."),
    LegalSection("02", "Eligibility", "You may use Trio Day only when you are legally permitted to use the service in your location. If local law requires parent or lawful-guardian consent for your age, obtain that consent before using the service."),
    LegalSection("03", "Your account", "Keep your login credentials private. You are responsible for activity performed through your account unless you promptly report unauthorized access. Your permanent Trio UID identifies your account and should not be used as a password."),
    LegalSection("04", "Your content", "You keep ownership of content you create (task proofs, reflections, chat messages), subject to the rights needed for Trio Day to host, store, display and transmit that content so the requested features work. Only upload content you have the right to share."),
    LegalSection("05", "Community rules", "Do not harass, threaten, impersonate, scam, dox or deliberately target other users. Do not upload illegal content, malware or stolen material. Do not use Trio Day to solicit passwords, one-time codes, financial credentials or private identifying information from others. Task proofs must reflect genuine effort — AI verification will reject spam, gibberish or off-topic submissions."),
    LegalSection("06", "Activities & XP", "Activities are structured micro-tasks for personal growth, not professional advice or guaranteed outcomes. XP, streaks and badges reflect participation consistency, not skill certification. Weekly XP resets every Sunday. Leaderboard rankings are based on verified task completions only. Guest trial allows 3 free tasks; progress is stored locally and synced once upon first login."),
    LegalSection("07", "Moderation", "Trio Day may hide content, restrict features, suspend accounts or remove content when reasonably necessary for safety, abuse prevention, security, legal compliance or service integrity."),
    LegalSection("08", "Security & rate limits", "Authentication providers and Trio Day may limit repeated requests to protect accounts and infrastructure. Attempts to bypass security, rate limits or AI verification are not permitted."),
    LegalSection("09", "Third-party services", "Trio Day relies on third-party infrastructure: Firebase (auth/database), Cloudflare Workers (serverless APIs), Supabase (PostgreSQL for activities) and Cloudinary (media). Their services can change, become unavailable or apply their own terms and technical limits."),
    LegalSection("10", "Availability", "Trio Day is provided as an evolving service. Features may change, be temporarily unavailable or be retired. We do not promise uninterrupted availability or permanent preservation of every feature."),
    LegalSection("11", "Disclaimer", "Trio Day is a social/community product for personal growth. Information, opinions and user-generated content are provided by their authors and should not be treated as professional legal, medical, financial, academic or other specialist advice."),
    LegalSection("12", "Changes & termination", "We may update these terms when the service or legal requirements change. Continued use after an effective update means you accept the revised terms. You may stop using the service at any time.")
)

@Composable
private fun LegalScreen(
    title: String,
    kicker: String,
    subtitle: String,
    sections: List<LegalSection>,
    footerHeading: String,
    footerBody: String,
    me: UserProfile?,
    onBack: () -> Unit
) {
    val c = TrioTheme.colors
    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar(title, onBack = onBack, avatarName = me?.name, avatarUrl = me?.photoUrl)
        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(horizontal = 22.dp, vertical = 18.dp)
        ) {
            item {
                Column {
                    Text(
                        kicker,
                        color = c.primaryText, fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold, letterSpacing = 2.sp
                    )
                    Text(
                        title,
                        color = c.ink, fontSize = 27.sp, fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Text(
                        subtitle,
                        color = c.inkMuted, fontSize = 14.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Text(
                        "Effective date: 18 October 2026",
                        color = c.inkDim, fontSize = 11.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
            items(sections.size) { index ->
                val section = sections[index]
                Row(Modifier.fillMaxWidth()) {
                    Box(
                        Modifier
                            .size(30.dp)
                            .clip(RoundedCornerShape(9.dp))
                            .background(c.primary.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            section.number,
                            color = c.primaryText, fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            section.heading,
                            color = c.ink, fontSize = 16.sp, fontWeight = FontWeight.Bold
                        )
                        Text(
                            section.body,
                            color = c.inkMuted, fontSize = 13.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(c.surface)
                        .padding(16.dp)
                ) {
                    Text(footerHeading, color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text(
                        footerBody,
                        color = c.inkMuted, fontSize = 12.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
fun PrivacyPolicyScreen(me: UserProfile? = null, onBack: () -> Unit) {
    LegalScreen(
        title = "Privacy Policy",
        kicker = "TRIO DAY · PRIVACY",
        subtitle = "Your data. Clear rules.",
        sections = PrivacySections,
        footerHeading = "Important",
        footerBody = "This policy describes the current Trio Day product and deployment configuration. It should be read together with the Terms & Conditions. If a mandatory local privacy rule gives you a stronger right than this policy describes, that mandatory rule controls.",
        me = me,
        onBack = onBack
    )
}

@Composable
fun TermsScreen(me: UserProfile? = null, onBack: () -> Unit) {
    LegalScreen(
        title = "Terms & Conditions",
        kicker = "TRIO DAY · TERMS",
        subtitle = "Use Trio Day responsibly.",
        sections = TermsSections,
        footerHeading = "Need help?",
        footerBody = "For questions about account access, privacy, content controls or reporting an issue, open the Help Center inside the app.",
        me = me,
        onBack = onBack
    )
}
