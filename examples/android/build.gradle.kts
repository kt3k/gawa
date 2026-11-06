plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "io.github.kt3k.gawa.example"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.kt3k.gawa.example"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // The shared example page, copied to assets/www (see copyExamplePage).
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/examplePage"))

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// examples/web/www → assets/www. Build the page first: examples/web/build.sh
val copyExamplePage by tasks.registering(Copy::class) {
    from("../web/www")
    into(layout.buildDirectory.dir("generated/examplePage/www"))
}
tasks.named("preBuild") { dependsOn(copyExamplePage) }

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":gawa"))

    androidTestImplementation("androidx.test:core:1.6.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
