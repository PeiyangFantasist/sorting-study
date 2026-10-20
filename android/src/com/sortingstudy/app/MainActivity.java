package com.sortingstudy.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + HOST + "/assets/index.html";
    private static final int SAVE_CPP = 21;
    private WebView web;
    private String pendingCode;
    private int pendingId;
    private boolean destroyed;
    private Object backCallback;
    private final ExecutorService fileWriter = Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null) {
            pendingCode = savedInstanceState.getString("pendingCode");
            pendingId = savedInstanceState.getInt("pendingId");
        }
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(237, 243, 246));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(237, 243, 246));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        configureInsets(root);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        if (Build.VERSION.SDK_INT >= 29) settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        if (Build.VERSION.SDK_INT >= 33) settings.setAlgorithmicDarkeningAllowed(false);
        web.addJavascriptInterface(new NativeBridge(), "SortingAndroidNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isAppUrl(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isAppUrl(Uri.parse(url));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (isAppUrl(request.getUrl())) {
                    try {
                        WebResourceResponse response = new WebResourceResponse("text/html", "UTF-8", getAssets().open("index.html"));
                        response.setResponseHeaders(Collections.singletonMap("Cache-Control", "no-store"));
                        return response;
                    } catch (IOException error) {
                        return blocked();
                    }
                }
                return blocked();
            }
        });
        if (Build.VERSION.SDK_INT >= 33) registerPredictiveBack();
        web.loadUrl(APP_URL);
    }

    private static boolean isAppUrl(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && "/assets/index.html".equals(uri.getPath()) && uri.getQuery() == null;
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Offline application",
                Collections.<String, String>emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private void configureInsets(final View root) {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else flags |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        getWindow().getDecorView().setSystemUiVisibility(flags);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        root.requestApplyInsets();
    }

    private void registerPredictiveBack() {
        OnBackInvokedCallback callback = () -> handleBack();
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
        backCallback = callback;
    }

    @Override public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (web == null || destroyed) { finish(); return; }
        web.evaluateJavascript("(()=>{const dialog=document.getElementById('info-dialog');if(dialog&&dialog.open){dialog.close();return true;}const side=document.getElementById('sidebar');if(side&&side.classList.contains('open')){side.classList.remove('open');return true;}const lab=document.getElementById('lab-view');if(lab&&lab.hidden){document.querySelector('[data-view=lab]').click();window.scrollTo(0,0);return true;}return false;})()",
                handled -> { if (!"true".equals(handled)) finish(); });
    }

    public final class NativeBridge {
        @JavascriptInterface public void copyText(final int id, final String text) {
            runOnUiThread(() -> {
                boolean ok = false;
                try {
                    if (destroyed || text == null || text.length() > 200000) { reply(id, false); return; }
                    ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    clipboard.setPrimaryClip(ClipData.newPlainText("C++ 示例", text));
                    ok = true;
                } catch (RuntimeException ignored) { }
                reply(id, ok);
            });
        }
        @JavascriptInterface public void saveCpp(final int id, final String filename, final String code) {
            runOnUiThread(() -> {
                if (destroyed || pendingCode != null || filename == null || code == null || code.length() > 200000 || !filename.endsWith(".cpp")) {
                    reply(id, false); return;
                }
                pendingCode = code; pendingId = id;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("text/x-c++src");
                intent.putExtra(Intent.EXTRA_TITLE, filename.replaceAll("[^a-zA-Z0-9._-]", "_"));
                try { startActivityForResult(intent, SAVE_CPP); }
                catch (RuntimeException error) { pendingCode = null; reply(id, false); Toast.makeText(MainActivity.this, "无法打开系统保存窗口", Toast.LENGTH_SHORT).show(); }
            });
        }
    }

    private void reply(final int id, final boolean ok) {
        if (!destroyed && web != null) web.evaluateJavascript("window.SortAndroidResolve&&window.SortAndroidResolve(" + id + "," + ok + ")", null);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != SAVE_CPP) return;
        final int id = pendingId;
        final String code = pendingCode;
        pendingCode = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || code == null) { reply(id, false); return; }
        final Uri target = data.getData();
        fileWriter.execute(() -> {
            boolean ok = false;
            try (OutputStream output = getContentResolver().openOutputStream(target, "wt")) {
                if (output != null) { output.write(code.getBytes(StandardCharsets.UTF_8)); output.flush(); ok = true; }
            } catch (IOException | RuntimeException ignored) { }
            final boolean saved = ok;
            runOnUiThread(() -> {
                reply(id, saved);
                if (!saved && !destroyed) Toast.makeText(MainActivity.this, "文件未保存，请重试", Toast.LENGTH_SHORT).show();
            });
        });
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (pendingCode != null) { state.putString("pendingCode", pendingCode); state.putInt("pendingId", pendingId); }
    }

    @Override protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("if(window.SortLab)SortLab.jump(SortLab.getState().index)", null);
            web.onPause(); web.pauseTimers();
        }
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.resumeTimers(); }
    }

    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
    }

    @Override protected void onDestroy() {
        destroyed = true;
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback((OnBackInvokedCallback) backCallback);
        if (web != null) { web.removeJavascriptInterface("SortingAndroidNative"); web.destroy(); web = null; }
        fileWriter.shutdown();
        super.onDestroy();
    }
}
