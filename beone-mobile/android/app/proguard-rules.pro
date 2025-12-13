# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ===== 性能优化配置 =====
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose

# 优化选项
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*

# 保留行号信息用于调试
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ===== Capacitor 相关保留规则 =====
-keep class com.getcapacitor.** { *; }
-keep class com.beone.app.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.CapacitorPlugin *;
    @com.getcapacitor.PluginMethod *;
}

# ===== WebView JavaScript 接口 =====
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ===== AndroidX 保留规则 =====
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ===== Kotlin 相关 =====
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings {
    <fields>;
}

# ===== 网络请求相关 =====
-keepattributes Signature
-keepattributes *Annotation*
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**

# ===== JSON 序列化 =====
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# ===== 保留枚举 =====
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ===== 保留 Parcelable =====
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# ===== 保留 Serializable =====
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ===== 移除日志 =====
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
