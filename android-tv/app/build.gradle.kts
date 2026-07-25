plugins {
    id("com.android.application")
}

val tvMonitorStoreFile = providers.gradleProperty("TV_MONITOR_STORE_FILE").orNull
val tvMonitorStorePassword = providers.gradleProperty("TV_MONITOR_STORE_PASSWORD").orNull
val tvMonitorKeyAlias = providers.gradleProperty("TV_MONITOR_KEY_ALIAS").orNull
val tvMonitorKeyPassword = providers.gradleProperty("TV_MONITOR_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(
    tvMonitorStoreFile,
    tvMonitorStorePassword,
    tvMonitorKeyAlias,
    tvMonitorKeyPassword,
).all { !it.isNullOrBlank() }

android {
    namespace = "uz.cafepostcode.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "uz.cafepostcode.tv"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigning) {
                storeFile = file(tvMonitorStoreFile!!)
                storePassword = tvMonitorStorePassword
                keyAlias = tvMonitorKeyAlias
                keyPassword = tvMonitorKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
