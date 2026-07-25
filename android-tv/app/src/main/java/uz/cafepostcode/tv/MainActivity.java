package uz.cafepostcode.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String MONITOR_URL = "https://pos.cafe-postcode.uz/tv";
    private static final long RETRY_DELAY_MS = 10_000L;
    private static final long WATCHDOG_INTERVAL_MS = 30_000L;
    private static final long STALE_QUEUE_TIMEOUT_MS = 120_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private TextView connectionStatus;
    private TvJavascriptBridge javascriptBridge;
    private boolean pageLoaded;
    private boolean mainFrameFailed;
    private long lastMonitorLoadElapsedRealtime;

    private final Runnable retryRunnable = () -> {
        if (!isFinishing() && isNetworkAvailable()) {
            loadMonitor();
        }
    };

    private final Runnable watchdogRunnable = new Runnable() {
        @Override
        public void run() {
            if (!isFinishing()) {
                recoverIfStalled();
                handler.postDelayed(this, WATCHDOG_INTERVAL_MS);
            }
        }
    };

    private final BroadcastReceiver connectivityReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            boolean online = isNetworkAvailable();
            setOfflineVisible(!online);
            if (online) {
                dispatchBrowserRecoveryEvents();
                if (!pageLoaded || mainFrameFailed) {
                    loadMonitor();
                }
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        createContentView();
        IntentFilter connectivityFilter = new IntentFilter(ConnectivityManager.CONNECTIVITY_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(connectivityReceiver, connectivityFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(connectivityReceiver, connectivityFilter);
        }
        handler.post(watchdogRunnable);
        loadMonitor();
    }

    private void configureWindow() {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN
                        | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        applyImmersiveMode();
    }

    private void applyImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void createContentView() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16, 19, 25));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 19, 25));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " CafePostcodeTv/0.1.0");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        javascriptBridge = new TvJavascriptBridge(this);
        webView.addJavascriptInterface(javascriptBridge, "CafePostcodeTv");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new MonitorWebViewClient());

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        connectionStatus = new TextView(this);
        connectionStatus.setText(R.string.offline_message);
        connectionStatus.setTextColor(Color.rgb(245, 247, 251));
        connectionStatus.setTextSize(16);
        connectionStatus.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        connectionStatus.setGravity(Gravity.CENTER);
        connectionStatus.setPadding(dp(18), dp(10), dp(18), dp(10));
        connectionStatus.setBackgroundColor(Color.rgb(154, 52, 52));
        connectionStatus.setVisibility(View.GONE);

        FrameLayout.LayoutParams statusParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP | Gravity.END
        );
        statusParams.setMargins(dp(20), dp(20), dp(20), dp(20));
        root.addView(connectionStatus, statusParams);
        setContentView(root);
    }

    private void loadMonitor() {
        handler.removeCallbacks(retryRunnable);
        mainFrameFailed = false;
        pageLoaded = false;
        javascriptBridge.resetQueueHealth();
        lastMonitorLoadElapsedRealtime = SystemClock.elapsedRealtime();
        setOfflineVisible(!isNetworkAvailable());
        webView.loadUrl(MONITOR_URL);
    }

    private void scheduleRetry() {
        handler.removeCallbacks(retryRunnable);
        handler.postDelayed(retryRunnable, RETRY_DELAY_MS);
    }

    private void recoverIfStalled() {
        if (!isNetworkAvailable()) {
            setOfflineVisible(true);
            return;
        }

        long now = SystemClock.elapsedRealtime();
        long lastQueueSuccess = javascriptBridge.getLastQueueSuccessElapsedRealtime();
        long healthReference = lastQueueSuccess > 0 ? lastQueueSuccess : lastMonitorLoadElapsedRealtime;
        if (now - healthReference >= STALE_QUEUE_TIMEOUT_MS) {
            loadMonitor();
        }
    }

    private void dispatchBrowserRecoveryEvents() {
        if (webView == null || !pageLoaded) {
            return;
        }
        webView.evaluateJavascript(
                "window.dispatchEvent(new Event('online'));"
                        + "document.dispatchEvent(new Event('visibilitychange'));",
                null
        );
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo networkInfo = manager.getActiveNetworkInfo();
        return networkInfo != null && networkInfo.isConnected();
    }

    private void setOfflineVisible(boolean visible) {
        connectionStatus.setVisibility(visible ? View.VISIBLE : View.GONE);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyImmersiveMode();
        if (webView != null) {
            webView.onResume();
            dispatchBrowserRecoveryEvents();
            recoverIfStalled();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        unregisterReceiver(connectivityReceiver);
        if (webView != null) {
            webView.removeJavascriptInterface("CafePostcodeTv");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    private final class MonitorWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !isAllowedUri(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return !isAllowedUri(Uri.parse(url));
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            pageLoaded = true;
            mainFrameFailed = false;
            setOfflineVisible(false);
            dispatchBrowserRecoveryEvents();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                mainFrameFailed = true;
                setOfflineVisible(true);
                scheduleRetry();
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                mainFrameFailed = true;
                scheduleRetry();
            }
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            ((ViewGroup) view.getParent()).removeView(view);
            view.destroy();
            recreate();
            return true;
        }

        private boolean isAllowedUri(Uri uri) {
            return "https".equals(uri.getScheme()) && "pos.cafe-postcode.uz".equals(uri.getHost());
        }
    }
}
