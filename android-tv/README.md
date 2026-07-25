# Cafe Postcode TV

Android TV kiosk wrapper for `https://pos.cafe-postcode.uz/tv`.

## Behavior

- Opens the TV monitor in immersive landscape mode.
- Keeps the display awake while the app is visible.
- Retains the paired restaurant in both WebView storage and Android preferences.
- Retries after connectivity errors and reloads a stalled monitor automatically.
- Restarts the monitor after the device boots when the TV firmware permits background launches.

## Build

Set `ANDROID_HOME` or add `sdk.dir` to `local.properties`, then run:

```powershell
./gradlew.bat assembleDebug
```

The installable APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

Release signing is read from the following Gradle properties and is intentionally
kept outside the repository:

- `TV_MONITOR_STORE_FILE`
- `TV_MONITOR_STORE_PASSWORD`
- `TV_MONITOR_KEY_ALIAS`
- `TV_MONITOR_KEY_PASSWORD`
