package com.trioday.app

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * AuthScreen — port of login.html: gradient hero, sign-in / sign-up tabs,
 * email+password or Trio ID sign-in, password reset and the guest trial.
 */
@Composable
fun AuthScreen(
    busy: Boolean,
    error: String?,
    onAuth: (name: String, identifier: String, password: String, isSignUp: Boolean, useTrioId: Boolean) -> Unit,
    onPasswordReset: (String) -> Unit,
    onContinueGuest: () -> Unit
) {
    val c = TrioTheme.colors
    var signUp by remember { mutableStateOf(false) }
    var useTrioId by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        Modifier
            .fillMaxSize()
            .background(c.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 26.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Spacer(Modifier.height(30.dp))
        // Hero
        Row(verticalAlignment = Alignment.CenterVertically) {
            BrandMark(size = 44.dp)
            Spacer(Modifier.width(12.dp))
            Column {
                Text("trio_day", color = c.ink, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp)
                Text("ONE SMALL THING EVERY DAY", color = c.primaryText, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            }
        }
        Spacer(Modifier.height(30.dp))
        Text(
            if (signUp) "Start your growth journey ✨" else "Welcome back 👋",
            color = c.ink, fontSize = 27.sp, fontWeight = FontWeight.ExtraBold
        )
        Text(
            "One small meaningful thing every day.",
            color = c.inkMuted, fontSize = 15.sp,
            modifier = Modifier.padding(top = 6.dp)
        )
        Spacer(Modifier.height(24.dp))

        // Tabs
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                .background(c.glass)
                .padding(5.dp)
        ) {
            listOf("Sign in" to false, "Create account" to true).forEach { (label, target) ->
                val active = signUp == target
                Box(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (active) Brush.horizontalGradient(listOf(Primary, PrimaryStrong))
                            else Brush.horizontalGradient(listOf(androidx.compose.ui.graphics.Color.Transparent, androidx.compose.ui.graphics.Color.Transparent))
                        )
                        .clickable { signUp = target }
                        .padding(vertical = 10.dp)
                ) {
                    Text(
                        label,
                        color = if (active) androidx.compose.ui.graphics.Color.White else c.inkMuted,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
        Spacer(Modifier.height(20.dp))

        if (signUp) {
            TrioInput("Display name", name, { name = it }, Modifier.fillMaxWidth(), placeholder = "Your name", maxLength = 60)
            Spacer(Modifier.height(12.dp))
        }
        TrioInput(
            if (useTrioId) "Trio ID" else "Email",
            identifier,
            { identifier = it },
            Modifier.fillMaxWidth(),
            placeholder = if (useTrioId) "TRIO-XXXXXXXX" else "you@example.com",
            keyboardType = if (useTrioId) KeyboardType.Text else KeyboardType.Email,
            maxLength = 80
        )
        Spacer(Modifier.height(12.dp))
        TrioInput("Password", password, { password = it }, Modifier.fillMaxWidth(), placeholder = "••••••••", password = true, maxLength = 80)
        error?.let {
            Text(it, color = c.danger, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp))
        }
        Spacer(Modifier.height(20.dp))
        TrioButton(
            label = if (signUp) "Create account" else "Sign in",
            onClick = { onAuth(name.trim(), identifier.trim().uppercase(), password, signUp, useTrioId) },
            enabled = !busy &&
                identifier.isNotBlank() &&
                password.length >= 6 &&
                (!signUp || name.isNotBlank()),
            loading = busy,
            modifier = Modifier.fillMaxWidth(),
            height = 52.dp
        )
        if (!signUp) {
            TextButton(onClick = { useTrioId = !useTrioId }) {
                Text(
                    if (useTrioId) "Sign in with email instead" else "Sign in with Trio ID",
                    color = c.primaryText, fontSize = 13.sp
                )
            }
            if (!useTrioId && identifier.contains("@")) {
                TextButton(onClick = { onPasswordReset(identifier.trim()) }, enabled = !busy) {
                    Text("Forgot password?", color = c.inkMuted, fontSize = 13.sp)
                }
            }
        }
        TextButton(onClick = onContinueGuest, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("Continue as guest →", color = c.inkDim, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(30.dp))
    }
}
