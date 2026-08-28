# OfficerApp - Android

This is the Android mobile application for the Tripoli Municipal Police.

## 🚀 Quick Start (Running the Project)

Follow these 3 steps to run the app from your terminal:

### 1. Configure the Environment
Ensure your terminal is using the correct Java and Android paths. Run this in your PowerShell window:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;" + $env:Path
```

### 2. Start the Emulator
You need a running device to install the app. Launch the recommended Pixel 7 emulator:
```powershell
emulator -avd Pixel_7
```
*(Wait until the phone fully boots to the home screen)*

### 3. Build and Install
Open a **new** terminal (ensuring step 1 is applied) and run:
```powershell
./gradlew installDebug
```

---

## ⚙️ Setting Environment Variables

Environment variables tell your computer where to find tools like `java`, `adb`, and `gradle`. You can set them in two ways:

### 🔹 Local (Current Session Only)
**Best for:** Quick testing or if you share a machine and don't want to mess with system settings.
- **How:** Run `$env:VARIABLE_NAME = "value"` in PowerShell.
- **Duration:** It disappears as soon as you close the terminal window.

### 🔹 Global (Permanent)
**Best for:** Your primary development machine. Once set, commands like `./gradlew` will work in *any* terminal window without setup.
1. Press `Windows Key` and type **"env"**.
2. Select **Edit the system environment variables**.
3. Click **Environment Variables...**.
4. Under **System variables**, click **New** to add:
   - `JAVA_HOME`: `C:\Program Files\Android\Android Studio\jbr`
   - `ANDROID_HOME`: `%LOCALAPPDATA%\Android\Sdk`
   - `ANDROID_USER_HOME`: `%USERPROFILE%\.android`
5. Find the `Path` variable, click **Edit**, and add these new entries at the **TOP**:
   - `%JAVA_HOME%\bin`
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`

---

## 💡 Important Insights

- **JDK Version:** This project requires **Java 17 or higher**. Always point `JAVA_HOME` to Android Studio's `jbr` folder—it is pre-configured and optimized for Android development.
- **Variable Conflicts:** **Never** set both `ANDROID_USER_HOME` and `ANDROID_PREFS_ROOT`. This will crash the build system. Use `ANDROID_USER_HOME` as it is the modern standard.
- **Emulator Discovery:** If you get a `No connected devices!` error even though the emulator is open, run `adb kill-server` followed by `adb start-server` to refresh the connection.

---

## 🛠️ Common Commands

| Task | Command |
| :--- | :--- |
| **Build APK** | `./gradlew assembleDebug` |
| **Install to Device** | `./gradlew installDebug` |
| **Clean Build Files** | `./gradlew clean` |
| **List Emulators** | `emulator -list-avds` |
