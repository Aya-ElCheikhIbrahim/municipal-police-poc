# OfficerApp - Android

This is the Android mobile application for the Tripoli Municipal Police.

## ⚠️ Required Setup (Read Carefully)

To ensure this project runs correctly and to avoid version mismatch errors, you **must** manually install the correct versions of Java and Gradle. Automatic downloading via the Gradle Wrapper has been disabled.

### 1. Install Java Development Kit (JDK 17)
This project requires **JDK 17**.
- **Download:** [Oracle JDK 17](https://www.oracle.com/java/technologies/downloads/#java17).
- **Verification:** Run `java -version`. It should show `17.x.x`.

### 2. Install Gradle (9.7.1)
This project requires **Gradle 9.7.1**.
- **Download:** [Gradle 9.7.1 (Binary-only)](https://services.gradle.org/distributions/gradle-9.7.1-bin.zip).
- **Setup:**
   1. Extract to a permanent folder (e.g., `C:\Gradle`).
   2. Add the `bin` folder to your system's `PATH`.
- **Verification:** Run `gradle -v`. It should show `9.7.1`.

---

## 🚀 Running the Project

### 1. Set Environment Variables
Run this in PowerShell:
```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;" + $env:Path
```

### 2. Start the Emulator
```powershell
emulator -avd Pixel_7
```

### 3. Build and Install
```powershell
gradle installDebug
```

---

## ⚙️ Permanent Environment Setup (Recommended)

Add these to your **System Environment Variables**:
1.  **JAVA_HOME**: Point to your JDK 17 folder.
2.  **GRADLE_HOME**: Point to your Gradle 9.7.1 folder.
3.  **ANDROID_HOME**: `%LOCALAPPDATA%\Android\Sdk`.
4.  **Path**: Add `%JAVA_HOME%\bin`, `%GRADLE_HOME%\bin`, `%ANDROID_HOME%\platform-tools`, and `%ANDROID_HOME%\emulator` to the top.

---

## 🛠️ Common Commands

| Task | Command |
| :--- | :--- |
| **Build APK** | `gradle assembleDebug` |
| **Install to Device** | `gradle installDebug` |
| **Clean Project** | `gradle clean` |
