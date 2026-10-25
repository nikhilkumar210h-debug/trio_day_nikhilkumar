plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.trioday.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.trioday.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 3
        versionName = "2.0.0"
        // The Firebase web API key is public client configuration, not a server secret.
        buildConfigField("String", "FIREBASE_API_KEY", "\"AIzaSyDyuycRTSAaGSEiCPEXXf36sxhyDVPQLTA\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"nkm-ind\"")
        buildConfigField("String", "SUPABASE_URL", "\"https://vccypxwiqcuexxrhtgyq.supabase.co\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"sb_publishable_zJvP50wf3CW2PNfkOD9yCQ_ffFhsZEp\"")
        buildConfigField("String", "GAMIFICATION_WORKER_URL", "\"https://trio-gamification.trioday-nikhil.workers.dev\"")
        buildConfigField("String", "GITHUB_RELEASES_URL", "\"https://api.github.com/repos/nikhilkumar210h-debug/trio_day_nikhilkumar/releases/latest\"")
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.02.02"))
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("io.coil-kt:coil-compose:2.5.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
