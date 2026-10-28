package com.trioday.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
 * HelpScreen — port of help.html: the journey steps, feature cards and
 * quick answers from the webapp Help Center, in the native design language.
 */

private data class HelpStep(val number: String, val icon: String, val title: String, val body: String)

private val HelpSteps = listOf(
    HelpStep("01", "🎯", "Choose Your Path", "Pick a growth category: Learning, Digital Skill, Personal Growth, Mind & Emotion, Social Life, or Career."),
    HelpStep("02", "📋", "Start an Activity", "Browse curated activities with multiple tasks each. Guests get 3 free tasks."),
    HelpStep("03", "⏱️", "Complete Tasks", "Each task has a suggested time and a proof box. AI verifies your reflection."),
    HelpStep("04", "🏆", "Earn XP & Rank", "Weekly XP resets every Sunday. Top 3 get podium spots.")
)

private data class HelpFaq(val icon: String, val title: String, val body: String)

private val HelpFaqs = listOf(
    HelpFaq("🔓", "Guest Trial", "3 free tasks without login — progress saves on this device and is credited when you sign in."),
    HelpFaq("🤖", "AI Verification", "A short reflection or a link to your work. Spam like “asdfg” gets rejected — genuine effort earns XP."),
    HelpFaq("🏆", "Leaderboard", "Weekly XP resets Sunday. Top 3 get Gold/Silver/Bronze podium cards; the full list shows everyone."),
    HelpFaq("🔐", "Login & Account", "Email/password, Trio ID sign-in and password reset are supported. Repeated failures are rate-limited for safety."),
    HelpFaq("🛡", "Privacy & Safety", "Keep passwords, OTPs and private addresses out of task proofs and chats. Report anything uncomfortable."),
    HelpFaq("🧹", "Data Storage", "Activities & tasks in Supabase. Accounts, XP and leaderboards in Firebase. Media in Cloudinary. Server operations via Cloudflare Workers."),
    HelpFaq("⏭", "Skipping", "Yes — Skip gives 0 XP and moves you to the next task.")
)

@Composable
fun HelpScreen(me: UserProfile? = null, onBack: () -> Unit) {
    val c = TrioTheme.colors
    Column(Modifier.fillMaxSize().background(c.bg)) {
        ScreenTopBar("Help Center", onBack = onBack, avatarName = me?.name, avatarUrl = me?.photoUrl)
        LazyColumn(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp)
        ) {
            item {
                Column {
                    Text(
                        "TRIO DAY · HELP CENTER",
                        color = c.primaryText, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 2.sp
                    )
                    Text(
                        "Pick a moment. Make it yours.",
                        color = c.ink, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                    Text(
                        "Trio Day is built around daily micro-activities: choose a growth path, complete tasks, earn XP, and climb the weekly leaderboard.",
                        color = c.inkMuted, fontSize = 14.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }

            items(HelpSteps) { step ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(step.icon, fontSize = 26.sp)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text("${step.number} · ${step.title}", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text(step.body, color = c.inkMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }

            items(HelpFaqs) { faq ->
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                        .background(c.surface)
                        .border(1.dp, c.border, RoundedCornerShape(18.dp))
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(faq.icon, fontSize = 20.sp)
                        Spacer(Modifier.width(10.dp))
                        Text(faq.title, color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                    Text(
                        faq.body, color = c.inkMuted, fontSize = 13.sp,
                        modifier = Modifier.padding(start = 30.dp, top = 6.dp)
                    )
                }
            }
            item { Spacer(Modifier.height(14.dp)) }
        }
    }
}
