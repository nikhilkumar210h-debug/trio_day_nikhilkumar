package com.trioday.app

/*
 * Models.kt — data models mirroring the shared Trio Day backend schema:
 * Supabase activities/tasks, Firestore users/{uid}, private chats,
 * notifications, and the gamification constants (XP_PER_LEVEL = 100).
 */

// ── Gamification constants (public/gamification/constants.js) ──────────────
const val XP_PER_LEVEL = 100L
const val GUEST_TASK_LIMIT = 3

fun levelFromXp(xp: Long): Long = (xp.coerceAtLeast(0) / XP_PER_LEVEL) + 1
fun xpIntoLevel(xp: Long): Long = xp.coerceAtLeast(0) % XP_PER_LEVEL

data class BadgeDef(val id: String, val icon: String, val name: String)

val SystemBadges = listOf(
    BadgeDef("badge_first_complete", "🎯", "First Challenge"),
    BadgeDef("badge_streak_3", "🔥", "On Fire"),
    BadgeDef("badge_streak_7", "⚡", "Week Warrior"),
    BadgeDef("badge_streak_30", "💎", "Unstoppable"),
    BadgeDef("badge_xp_500", "✨", "Rising Star"),
    BadgeDef("badge_xp_1000", "👑", "Legend")
)

// ── Goal categories (today-activity.js GOAL_CATEGORIES) ────────────────────
data class GoalCategory(val key: String, val icon: String, val title: String, val sub: String)

val GoalCategories = listOf(
    GoalCategory("Learning", "📚", "Learning", "Core concepts & logic"),
    GoalCategory("Digital Skill", "💻", "Digital Skill", "Code, AI & tech mastery"),
    GoalCategory("Personal Growth", "🌱", "Personal Growth", "Habits & discipline"),
    GoalCategory("Mind & Emotion", "🧠", "Mind & Emotion", "Focus & mindfulness"),
    GoalCategory("Social Life", "🤝", "Social Life", "Network & communication"),
    GoalCategory("Career & Practical Life", "🧭", "Career & Practical Life", "Projects, decisions & everyday skills")
)

val ActivityCategories = listOf(
    "Starter", "Learning", "Digital Skill", "Personal Growth",
    "Mind & Emotion", "Social Life", "Career & Practical Life"
)

val TaskTypes = listOf(
    "Brainteaser", "Action Step", "Reflection", "Boss Task", "Real-life Action",
    "Learning Sprint", "Creative Build", "Social Connection", "Mindful Reset",
    "Planning", "Observation", "Habit Practice", "Problem Solving"
)

val DifficultyLevels = listOf("Easy", "Medium", "Hard", "Mixed")

fun categoryIcon(key: String): String =
    (GoalCategories.firstOrNull { it.key == key }?.icon) ?: if (key == "Starter") "🔥" else "⚡"

// ── Supabase: activities ────────────────────────────────────────────────────
data class ActivityItem(
    val id: String,
    val category: String,
    val title: String,
    val description: String,
    val difficulty: String,
    val xp: Int,
    val imageUrl: String,
    val guestAllowed: Boolean = false,
    val published: Boolean = true,
    val displayOrder: Int = 0,
    val titleHi: String = "",
    val descriptionHi: String = ""
) {
    fun titleFor(language: String): String = if (language == "HI") titleHi.ifBlank { title } else title
    fun descriptionFor(language: String): String = if (language == "HI") descriptionHi.ifBlank { description } else description
}

// ── Supabase: tasks ─────────────────────────────────────────────────────────
data class TaskItem(
    val id: String,
    val number: Int,
    val title: String,
    val instructions: String,
    val minTimeSeconds: Int,
    val xp: Int,
    val type: String = "",
    val titleHi: String = "",
    val instructionsHi: String = ""
) {
    fun titleFor(language: String): String = if (language == "HI") titleHi.ifBlank { title } else title
    fun instructionsFor(language: String): String = if (language == "HI") instructionsHi.ifBlank { instructions } else instructions
}

// ── Firestore: users/{uid} ─────────────────────────────────────────────────
data class UserProfile(
    val uid: String,
    val name: String,
    val userId: String,
    val bio: String,
    val photoUrl: String,
    val selectedCategory: String,
    val onboardingComplete: Boolean,
    val xp: Long,
    val level: Long,
    val weeklyXp: Long,
    val monthlyXp: Long,
    val streak: Long,
    val bestStreak: Long,
    val shields: Long,
    val badges: List<String>
)

// ── Firestore: directory users (leaderboards, discover) ─────────────────────
data class TrioUser(
    val uid: String,
    val name: String,
    val userId: String,
    val bio: String,
    val photoUrl: String,
    val category: String,
    val xp: Long,
    val level: Long,
    val weeklyXp: Long,
    val monthlyXp: Long,
    val streak: Long
)

// ── Chat ────────────────────────────────────────────────────────────────────
data class TrioMessage(
    val id: String,
    val uid: String,
    val name: String,
    val text: String,
    val createdAtMs: Long,
    val seen: Long
)

data class ChatThread(
    val peer: TrioUser,
    val lastMessage: TrioMessage?,
    val unreadCount: Int
)

// ── Notifications (users/{uid}/notifications) ────────────────────────────────
data class TrioNotification(
    val id: String,
    val type: String,
    val actorName: String,
    val actorUid: String,
    val text: String,
    val urlPath: String,
    val createdAtMs: Long,
    val read: Boolean
) {
    fun icon(): String = when (type) {
        "like" -> "❤️"
        "comment" -> "💬"
        "share" -> "↗️"
        "connect" -> "🤝"
        "message" -> "✉️"
        "badge_earned" -> "🏅"
        "challenge_reminder" -> "⏰"
        else -> "🔔"
    }
}

// ── App releases (sideload updater) ─────────────────────────────────────────
data class AppRelease(val version: String, val apkUrl: String)

// ── EN/HI translations (today-activity.js TRANSLATIONS + app strings) ───────
object T {
    private val EN = mapOf(
        "welcome" to "Choose Your Growth Path",
        "sub_welcome" to "Select a focus area to unlock personalized weekly activities:",
        "banner_sub" to "Pick an activity to start earning Weekly XP.",
        "change_goal" to "Switch Goal",
        "guest_trial" to "Free Tasks",
        "guest_limit" to "3/3 Free Tasks Completed!",
        "guest_msg" to "You've used your demo quota. Login to save your XP, unlock custom goals, and access all activities.",
        "no_activities" to "No activities here yet",
        "no_activities_hint" to "This category has no published activities.",
        "show_all" to "Show all activities",
        "all_activities" to "All activities",
        "all_activities_sub" to "Every published activity across Trio Day.",
        "loading" to "Loading activities…",
        "retry" to "Try again",
        "today" to "Today",
        "today_sub" to "One small meaningful thing every day.",
        "sign_in" to "Sign in",
        "sign_out" to "Sign out",
        "leaderboard" to "Leaderboard",
        "chat" to "Chat",
        "you" to "You",
        "weekly_xp" to "Weekly XP",
        "total_xp" to "Total XP",
        "streak" to "Day Streak"
    )

    private val HI = mapOf(
        "welcome" to "Apna Growth Goal Chunein",
        "sub_welcome" to "Apne hisab se best activities dekhne ke liye ek category select karein:",
        "banner_sub" to "Weekly XP kamane ke liye activity chunein.",
        "change_goal" to "Goal Badlein",
        "guest_trial" to "Free Tasks",
        "guest_limit" to "3/3 Free Tasks Pure Hue!",
        "guest_msg" to "Aapna demo quota pura ho gaya. XP save karne aur saare activities unlock karne ke liye login karein.",
        "no_activities" to "Yahan abhi koi activity nahi hai",
        "no_activities_hint" to "Is category me abhi koi published activity nahi hai.",
        "show_all" to "Saari activities dekhein",
        "all_activities" to "Saari activities",
        "all_activities_sub" to "Trio Day ki har published activity.",
        "loading" to "Activities load ho rahi hain…",
        "retry" to "Dobara koshish karein",
        "today" to "Aaj",
        "today_sub" to "Roz ek chhota achha kaam.",
        "sign_in" to "Sign in",
        "sign_out" to "Sign out",
        "leaderboard" to "Ranking",
        "chat" to "Chat",
        "you" to "Aap",
        "weekly_xp" to "Weekly XP",
        "total_xp" to "Total XP",
        "streak" to "Day Streak"
    )

    fun t(key: String, language: String): String =
        (if (language == "HI") HI[key] else null) ?: EN[key] ?: key
}
