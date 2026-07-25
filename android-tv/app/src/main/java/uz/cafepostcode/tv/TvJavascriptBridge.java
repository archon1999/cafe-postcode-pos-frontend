package uz.cafepostcode.tv;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;

final class TvJavascriptBridge {
    private static final String PREFERENCES_NAME = "tv_monitor_device";
    private static final String DEVICE_KEY = "paired_device_json";

    private final SharedPreferences preferences;
    private volatile long lastQueueSuccessElapsedRealtime;

    TvJavascriptBridge(Context context) {
        preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public String getDevice() {
        return preferences.getString(DEVICE_KEY, "");
    }

    @JavascriptInterface
    public void setDevice(String deviceJson) {
        if (deviceJson == null || deviceJson.isBlank()) {
            preferences.edit().remove(DEVICE_KEY).apply();
            return;
        }
        preferences.edit().putString(DEVICE_KEY, deviceJson).apply();
    }

    @JavascriptInterface
    public void clearDevice() {
        preferences.edit().remove(DEVICE_KEY).apply();
    }

    @JavascriptInterface
    public void onQueueSuccess() {
        lastQueueSuccessElapsedRealtime = SystemClock.elapsedRealtime();
    }

    long getLastQueueSuccessElapsedRealtime() {
        return lastQueueSuccessElapsedRealtime;
    }

    void resetQueueHealth() {
        lastQueueSuccessElapsedRealtime = 0L;
    }
}
