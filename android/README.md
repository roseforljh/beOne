# SyncHub Android Client

Native Android client for SyncHub, built with Kotlin and Jetpack Compose.

## Features

- **Auth**: Dev Login (Mock) implementation.
- **Chat Board**: Real-time WebSocket messaging (Text & Files).
- **Cloud Drive**: File listing and Grid view.
- **File Upload**: Upload files via Floating Action Button (FAB) in Files screen.
- **File Download**: Download files to system Downloads folder from Chat or Files screen.
- **Image Preview**: Authentication-secured image previews using Coil.
- **Share Intent**: Share text or images from other apps directly to SyncHub.
- **Echo Prevention**: Client ID based filtering to prevent duplicate messages on the sender device.

## Tech Stack

- **Language**: Kotlin
- **UI**: Jetpack Compose (Material3)
- **Networking**: Retrofit, OkHttp, WebSocket
- **Async**: Coroutines, Flow
- **Image Loading**: Coil (with Auth header support)

## Setup & Build

1. **Prerequisites**:
   - Android Studio Hedgehog or newer.
   - JDK 17.
   - Android SDK API 34.

2. **Configuration**:
   - Open `app/build.gradle.kts`.
   - In the `buildTypes.debug` block, update `SERVER_HOST` to your backend IP:
     - For **Android Emulator**: use `10.0.2.2`
     - For **Real Device**: use your computer's LAN IP (e.g., `192.168.0.100`)
   - The `SERVER_PORT` defaults to `8000`.
   - Both REST API and WebSocket URLs are automatically configured from these values.

3. **Build**:
   ```bash
   ./gradlew assembleDebug
   ```

4. **Run**:
   - Install on an emulator or physical device.
   - Ensure the backend is running and accessible from the device network.

## Project Structure

```
com.synchub.app
├── data/           # Token management
├── network/        # Retrofit API definitions
├── service/        # WebSocket service
├── ui/
│   ├── chat/       # Chat screen
│   ├── files/      # File grid screen
│   ├── login/      # Login screen
│   ├── navigation/ # Navigation routes
│   └── theme/      # Material3 theme
└── utils/          # File utilities
```
