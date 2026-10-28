package com.trioday.app

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

/*
 * Ui.kt — shared Trio Day UI kit, ported from the webapp component system
 * (tokens.css + style.css): tricolor strip, brand mark, gradient buttons,
 * glass cards, tag pills, stat tiles, avatars, shimmer skeletons, empty
 * states and the bottom navigation.
 */

// ── Tricolor strip (signature top detail from every webapp page) ───────────
@Composable
fun TricolorStrip(modifier: Modifier = Modifier) {
    Row(modifier = modifier.fillMaxWidth().height(3.dp)) {
        Box(Modifier.weight(1f).fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0xFFFF9933), Color(0xFFFF7700)))))
        Box(Modifier.weight(1f).fillMaxSize().background(TricolorWhite))
        Box(Modifier.weight(1f).fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0xFF128807), Color(0xFF0A6305)))))
    }
}

// ── Brand ──────────────────────────────────────────────────────────────────
@Composable
fun BrandMark(size: Dp = 34.dp) {
    Box(
        Modifier
            .size(size)
            .clip(RoundedCornerShape(10.dp))
            .background(
                Brush.linearGradient(
                    listOf(Primary.copy(alpha = 0.35f), PrimaryStrong.copy(alpha = 0.25f))
                )
            )
            .border(1.dp, TrioTheme.colors.border, RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text("ॐ", color = Primary, fontSize = (size.value * 0.5f).sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun BrandHeader(compact: Boolean = false, subtitle: String = "ACTIVITIES") {
    Row(verticalAlignment = Alignment.CenterVertically) {
        BrandMark(size = if (compact) 28.dp else 34.dp)
        Spacer(Modifier.width(10.dp))
        Column {
            Text(
                "trio_day",
                color = TrioTheme.colors.ink,
                fontSize = if (compact) 16.sp else 18.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.4).sp
            )
            Text(
                subtitle,
                color = TrioTheme.colors.inkMuted,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )
        }
    }
}

// ── Buttons ────────────────────────────────────────────────────────────────
enum class TrioButtonStyle { Primary, Secondary, Ghost, Danger }

@Composable
fun TrioButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: TrioButtonStyle = TrioButtonStyle.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
    height: Dp = 50.dp,
    fontSize: TextUnit = 15.sp
) {
    val c = TrioTheme.colors
    val (container, content) = when (style) {
        TrioButtonStyle.Primary -> c.primary to Color.White
        TrioButtonStyle.Secondary -> c.glass to c.ink
        TrioButtonStyle.Ghost -> Color.Transparent to c.inkMuted
        TrioButtonStyle.Danger -> c.danger.copy(alpha = 0.12f) to c.danger
    }
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.height(height),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = container,
            contentColor = content,
            disabledContainerColor = if (style == TrioButtonStyle.Primary) c.primary.copy(alpha = 0.35f) else container,
            disabledContentColor = if (style == TrioButtonStyle.Primary) Color.White.copy(alpha = 0.7f) else content
        ),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp)
    ) {
        if (loading) {
            CircularProgressIndicator(
                Modifier.size(18.dp),
                color = content,
                strokeWidth = 2.dp
            )
            Spacer(Modifier.width(10.dp))
        }
        Text(label, fontSize = fontSize, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun TrioTextButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = TrioTheme.colors.primaryText,
    bold: Boolean = false,
    fontSize: TextUnit = 14.sp
) {
    TextButton(onClick = onClick, modifier = modifier) {
        Text(label, color = color, fontSize = fontSize, fontWeight = if (bold) FontWeight.Bold else FontWeight.SemiBold)
    }
}

// ── Cards & chips ──────────────────────────────────────────────────────────
@Composable
fun TrioCard(
    modifier: Modifier = Modifier,
    fill: Boolean = true,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(18.dp)
    Box(
        modifier
            .clip(shape)
            .background(TrioTheme.colors.surface, shape)
            .border(1.dp, TrioTheme.colors.border, shape)
    ) {
        Column(Modifier.padding(if (fill) 16.dp else 0.dp), content = content)
    }
}

@Composable
fun TagPill(text: String, tint: Color = TrioTheme.colors.primaryText, fill: Color = TrioTheme.colors.primary.copy(alpha = 0.12f)) {
    Text(
        text,
        color = tint,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(fill)
            .border(1.dp, tint.copy(alpha = 0.25f), RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}

@Composable
fun XpChip(amount: Int) {
    TagPill("⚡ +$amount XP", TrioTheme.colors.warm, TrioTheme.colors.warm.copy(alpha = 0.12f))
}

// ── Stat tile (profile grid style) ─────────────────────────────────────────
@Composable
fun StatTile(label: String, value: String, accent: Color = TrioTheme.colors.ink, big: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value,
            color = accent,
            fontSize = if (big) 22.sp else 17.sp,
            fontWeight = FontWeight.ExtraBold
        )
        Text(label, color = TrioTheme.colors.inkMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 2.dp))
    }
}

// ── Avatar (image or gradient initials — mirrors webapp avatarHtml) ────────
@Composable
fun TrioAvatar(
    name: String,
    photoUrl: String,
    size: Dp = 44.dp,
    modifier: Modifier = Modifier
) {
    val initial = name.trim().firstOrNull()?.uppercase() ?: 'U'
    if (photoUrl.isNotBlank()) {
        AsyncImage(
            model = cloudinaryAutoUrl(photoUrl),
            contentDescription = name,
            contentScale = ContentScale.Crop,
            modifier = modifier
                .size(size)
                .clip(CircleShape)
                .border(1.dp, TrioTheme.colors.borderStrong, CircleShape)
        )
    } else {
        Box(
            modifier
                .size(size)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(Primary, PrimaryStrong))),
            contentAlignment = Alignment.Center
        ) {
            Text(
                initial.toString(),
                color = Color.White,
                fontWeight = FontWeight.ExtraBold,
                fontSize = (size.value * 0.42f).sp
            )
        }
    }
}

// ── Shimmer skeleton (skeleton.css shimmer) ────────────────────────────────
@Composable
fun ShimmerBox(modifier: Modifier, corner: Dp = 12.dp) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val alpha by transition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing), RepeatMode.Reverse),
        label = "alpha"
    )
    Box(
        modifier
            .clip(RoundedCornerShape(corner))
            .background(TrioTheme.colors.glassStrong)
            .alpha(alpha)
    )
}

@Composable
fun ActivitySkeletonRow() {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 7.dp)
            .height(104.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(TrioTheme.colors.surface, RoundedCornerShape(18.dp))
            .border(1.dp, TrioTheme.colors.border, RoundedCornerShape(18.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            ShimmerBox(Modifier.width(46.dp).height(14.dp))
            Spacer(Modifier.height(10.dp))
            ShimmerBox(Modifier.fillMaxWidth(0.7f).height(18.dp))
            Spacer(Modifier.height(10.dp))
            ShimmerBox(Modifier.width(120.dp).height(12.dp))
        }
        Spacer(Modifier.width(14.dp))
        ShimmerBox(Modifier.size(84.dp), corner = 14.dp)
    }
}

// ── Empty / error states (stateBox in today-activity.js) ───────────────────
@Composable
fun StateBox(
    icon: String,
    title: String,
    body: String,
    actionLabel: String? = null,
    secondActionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    onSecondAction: (() -> Unit)? = null
) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(icon, fontSize = 42.sp)
        Spacer(Modifier.height(12.dp))
        Text(title, color = TrioTheme.colors.ink, fontSize = 19.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(body, color = TrioTheme.colors.inkMuted, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 24.dp))
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(18.dp))
            TrioButton(actionLabel, onAction, style = TrioButtonStyle.Secondary)
        }
        if (secondActionLabel != null && onSecondAction != null) {
            Spacer(Modifier.height(8.dp))
            TrioButton(secondActionLabel, onSecondAction, style = TrioButtonStyle.Secondary)
        }
    }
}

// ── Banners ────────────────────────────────────────────────────────────────
@Composable
fun NoticeBanner(notice: String?) {
    if (notice.isNullOrBlank()) return
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(TrioTheme.colors.accent.copy(alpha = 0.12f))
            .border(1.dp, TrioTheme.colors.accent.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        Text("✓ $notice", color = Accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun ErrorBanner(message: String?, onDismiss: (() -> Unit)? = null) {
    if (message.isNullOrBlank()) return
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(TrioTheme.colors.danger.copy(alpha = 0.1f))
            .border(1.dp, TrioTheme.colors.danger.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(message, color = TrioTheme.colors.danger, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        if (onDismiss != null) {
            TextButton(onClick = onDismiss) { Text("✕", color = TrioTheme.colors.danger) }
        }
    }
}

// ── XP progress bar (profile journey card) ─────────────────────────────────
@Composable
fun XpProgressTrack(xpIntoLevel: Long, xpPerLevel: Long = 100) {
    val fraction = (xpIntoLevel.toFloat() / xpPerLevel.toFloat()).coerceIn(0f, 1f)
    Box(
        Modifier
            .fillMaxWidth()
            .height(9.dp)
            .clip(RoundedCornerShape(50))
            .background(TrioTheme.colors.glassStrong)
    ) {
        Box(
            Modifier
                .fillMaxWidth(fraction)
                .height(9.dp)
                .clip(RoundedCornerShape(50))
                .background(Brush.horizontalGradient(listOf(Primary, PrimaryStrong)))
        )
    }
}

// ── Screen top bar ─────────────────────────────────────────────────────────
@Composable
fun ScreenTopBar(
    title: String,
    onBack: (() -> Unit)? = null,
    avatarName: String? = null,
    avatarUrl: String? = null,
    trailing: @Composable (() -> Unit)? = null
) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(TrioTheme.colors.bgElevated)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (onBack != null) {
            TextButton(onClick = onBack) { Text("‹", color = TrioTheme.colors.primaryText, fontSize = 26.sp, fontWeight = FontWeight.Bold) }
        }
        if (avatarName != null) {
            // Signed-in identity — the user's (or peer's) photo replaces the
            // brand mark, matching the webapp header's auth chip. Shown either
            // standalone or beside a back button in detail screens.
            TrioAvatar(
                name = avatarName,
                photoUrl = avatarUrl.orEmpty(),
                size = 30.dp,
                modifier = Modifier.padding(start = if (onBack != null) 0.dp else 6.dp)
            )
        } else if (onBack == null) {
            BrandMark(size = 30.dp)
        }
        Text(
            title,
            color = TrioTheme.colors.ink,
            fontSize = 18.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier
                .weight(1f)
                .padding(start = 8.dp)
        )
        trailing?.invoke()
    }
}

// ── Input field ────────────────────────────────────────────────────────────
@Composable
fun TrioInput(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    password: Boolean = false,
    showToggle: Boolean = false,
    singleLine: Boolean = true,
    minLines: Int = 1,
    maxLines: Int = if (singleLine) 1 else 5,
    keyboardType: KeyboardType = KeyboardType.Text,
    maxLength: Int = 2000,
    trailing: @Composable (() -> Unit)? = null
) {
    var passwordVisible by remember { mutableStateOf(false) }
    val effectiveTrailing: (@Composable (() -> Unit))? = when {
        password && showToggle -> {
            {
                TextButton(
                    onClick = { passwordVisible = !passwordVisible },
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp)
                ) {
                    Text(if (passwordVisible) "🙈" else "👁", fontSize = 16.sp)
                }
            }
        }
        else -> trailing
    }
    OutlinedTextField(
        value = value,
        onValueChange = { if (it.length <= maxLength) onValueChange(it) },
        modifier = modifier,
        label = { Text(label, color = TrioTheme.colors.inkMuted) },
        placeholder = { Text(placeholder, color = TrioTheme.colors.inkDim) },
        singleLine = singleLine,
        minLines = minLines,
        maxLines = maxLines,
        shape = RoundedCornerShape(14.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (password && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = effectiveTrailing,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Primary,
            unfocusedBorderColor = TrioTheme.colors.border,
            focusedContainerColor = TrioTheme.colors.surface,
            unfocusedContainerColor = TrioTheme.colors.surface,
            focusedTextColor = TrioTheme.colors.ink,
            unfocusedTextColor = TrioTheme.colors.ink,
            cursorColor = Primary
        )
    )
}

// ── Bottom navigation (ui/nav.js: Today · Leaderboard · Chat · You · Admin) ─
data class NavItem(val route: String, val icon: String, val label: String)

val BaseNavItems = listOf(
    NavItem("Today", "🏠", "Today"),
    NavItem("Leaderboard", "🏆", "Ranks"),
    NavItem("Chat", "💬", "Chat"),
    NavItem("You", "👤", "You")
)
val AdminNavItem = NavItem("Admin", "🛠️", "Admin")

@Composable
fun BottomNavBar(
    activeRoute: String,
    isAdmin: Boolean,
    onNavigate: (String) -> Unit
) {
    val items = if (isAdmin) BaseNavItems + AdminNavItem else BaseNavItems
    Row(
        Modifier
            .fillMaxWidth()
            .background(TrioTheme.colors.bgElevated)
            .border(1.dp, TrioTheme.colors.border),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        items.forEach { item ->
            val active = item.route == activeRoute
            Column(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .clickable { onNavigate(item.route) }
                    .padding(vertical = 9.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    item.icon,
                    fontSize = if (active) 19.sp else 16.sp,
                    modifier = Modifier.alpha(if (active) 1f else 0.72f)
                )
                Text(
                    item.label,
                    color = if (active) TrioTheme.colors.primaryText else TrioTheme.colors.inkMuted,
                    fontSize = 10.sp,
                    fontWeight = if (active) FontWeight.ExtraBold else FontWeight.SemiBold
                )
            }
        }
    }
}
