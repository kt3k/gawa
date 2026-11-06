plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    `maven-publish`
}

// JitPack (jitpack.yml) passes -PpublishGroup / -PpublishVersion.
group = findProperty("publishGroup")?.toString() ?: "com.github.kt3k"
version = findProperty("publishVersion")?.toString() ?: "0.1.0"

android {
    namespace = "io.github.kt3k.gawa"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
    explicitApi()
}

dependencies {
    api("androidx.webkit:webkit:1.12.1")
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    api("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = project.group.toString()
            artifactId = "gawa"
            version = project.version.toString()
            afterEvaluate { from(components["release"]) }
            pom {
                name.set("gawa")
                description.set("A thin, typed bridge between a web page and its native host WebView")
                url.set("https://github.com/kt3k/gawa")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://github.com/kt3k/gawa/blob/main/LICENSE")
                    }
                }
            }
        }
    }
}
