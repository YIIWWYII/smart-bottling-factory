package com.hongmou.bottling.terminal;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;

import org.json.JSONObject;

import java.net.URI;

import java.util.ArrayList;

public final class MainActivity extends Activity {
    private static final int SPEECH_REQUEST = 41;
    private static final int FILE_REQUEST = 42;
    private static final int MEDIA_REQUEST = 43;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest mediaRequest;
    private String[] mediaResources;
    private String origin;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(244, 248, 252));
        getWindow().setNavigationBarColor(Color.rgb(244, 248, 252));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        String saved = getPreferences(0).getString("address", "");
        if (saved.isEmpty()) showAddressEditor(""); else connect(saved);
    }

    private void showAddressEditor(String value) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(44, 28, 44, 12);
        TextView title = new TextView(this);
        title.setText("鸿眸瓶安"); title.setTextSize(24); title.setTypeface(null, Typeface.BOLD); title.setTextColor(Color.rgb(25, 50, 78));
        TextView note = new TextView(this);
        note.setText("填写运行平台的电脑局域网地址。平板和电脑需连接同一 Wi-Fi。"); note.setTextSize(14); note.setTextColor(Color.rgb(88, 106, 127)); note.setPadding(0, 12, 0, 12);
        EditText input = new EditText(this);
        input.setSingleLine(true); input.setHint("例如 192.168.1.20:5174"); input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI); input.setText(value);
        Button go = new Button(this); go.setText("保存并进入工位终端");
        box.addView(title); box.addView(note); box.addView(input); box.addView(go);
        setContentView(box);
        go.setOnClickListener(v -> {
            String address = input.getText().toString().trim();
            if (!address.contains("://")) address = "http://" + address;
            try {
                URI uri = new URI(address);
                if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                        || uri.getHost() == null || uri.getUserInfo() != null || uri.getPort() > 65535
                        || uri.getQuery() != null || uri.getFragment() != null) throw new IllegalArgumentException();
                address = uri.getScheme().toLowerCase(java.util.Locale.ROOT) + "://" + uri.getRawAuthority()
                        + (uri.getRawPath() == null ? "" : uri.getRawPath());
            } catch (IllegalArgumentException | java.net.URISyntaxException e) {
                input.setError(getString(R.string.invalid_address)); return;
            }
            getPreferences(0).edit().putString("address", address).apply();
            connect(address);
            ((InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(), 0);
        });
        input.requestFocus();
    }

    private void connect(String address) {
        destroyWebView();
        Uri base = Uri.parse(address);
        origin = base.getScheme() + "://" + base.getAuthority();
        String url = address.replaceAll("/+$", "") + "/#station";
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        Button change = new Button(this); change.setText("平台地址  ·  " + base.getHost() + (base.getPort() > 0 ? ":" + base.getPort() : "") + "    修改");
        change.setAllCaps(false); change.setTextSize(12); change.setMinHeight(38);
        webView = new WebView(this); webView.setBackgroundColor(Color.rgb(244, 248, 252));
        webView.getSettings().setJavaScriptEnabled(true); webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setUserAgentString(webView.getSettings().getUserAgentString() + " HongmouTerminal/1.0");
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setAllowFileAccess(false); webView.getSettings().setAllowContentAccess(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if ("hongmou-terminal://speech".equals(target.toString())) {
                    if (request.isForMainFrame() && request.hasGesture() && view.getUrl() != null && isPlatform(Uri.parse(view.getUrl()))) startSpeechRecognition();
                    return true;
                }
                return request.isForMainFrame() && !isPlatform(target);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) showFailure(root, change, getString(R.string.network_hint));
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse response) {
                if (request.isForMainFrame()) showFailure(root, change, getString(R.string.http_error, response.getStatusCode()));
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                Uri requester = request.getOrigin();
                if (!"https".equals(requester.getScheme()) || !isPlatform(requester) || mediaRequest != null) {
                    request.deny(); return;
                }
                ArrayList<String> permissions = new ArrayList<>();
                ArrayList<String> resources = new ArrayList<>();
                for (String resource : request.getResources()) {
                    String permission = PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) ? android.Manifest.permission.CAMERA
                            : PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) ? android.Manifest.permission.RECORD_AUDIO : null;
                    if (permission != null) {
                        resources.add(resource);
                        if (checkSelfPermission(permission) != android.content.pm.PackageManager.PERMISSION_GRANTED) permissions.add(permission);
                    }
                }
                if (resources.isEmpty()) { request.deny(); return; }
                if (permissions.isEmpty()) { request.grant(resources.toArray(new String[0])); return; }
                mediaRequest = request;
                mediaResources = resources.toArray(new String[0]);
                requestPermissions(permissions.toArray(new String[0]), MEDIA_REQUEST);
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (mediaRequest == request) { mediaRequest = null; mediaResources = null; }
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_REQUEST); return true; }
                catch (ActivityNotFoundException e) { fileCallback = null; return false; }
            }
        });
        change.setOnClickListener(v -> { destroyWebView(); showAddressEditor(getPreferences(0).getString("address", address)); });
        root.addView(change, new LinearLayout.LayoutParams(-1, -2)); root.addView(webView, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root); webView.loadUrl(url);
    }

    private boolean isPlatform(Uri uri) {
        return uri != null && origin.equalsIgnoreCase(uri.getScheme() + "://" + uri.getAuthority());
    }

    private void showFailure(LinearLayout root, Button addressButton, String detail) {
        destroyWebView();
        TextView message = new TextView(this);
        message.setPadding(32, 48, 32, 24);
        message.setText(getString(R.string.connection_failed) + "\n\n" + detail);
        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(v -> connect(getPreferences(0).getString("address", "")));
        root.removeAllViews();
        root.addView(addressButton);
        root.addView(message);
        root.addView(retry);
    }

    private void startSpeechRecognition() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "请说出你的问题");
        try { startActivityForResult(intent, SPEECH_REQUEST); }
        catch (ActivityNotFoundException e) { deliverSpeech(null, "设备未安装语音识别服务，可使用键盘输入。"); }
    }

    private void deliverSpeech(String text, String error) {
        if (webView != null) webView.evaluateJavascript("window.HongmouSpeechResult?.("
                + (text == null ? "null" : JSONObject.quote(text)) + ","
                + (error == null ? "null" : JSONObject.quote(error)) + ")", null);
    }

    private void destroyWebView() {
        if (mediaRequest != null) { mediaRequest.deny(); mediaRequest = null; mediaResources = null; }
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (webView == null) return;
        WebView previous = webView;
        webView = null;
        previous.stopLoading();
        if (previous.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) previous.getParent()).removeView(previous);
        previous.destroy();
    }

    @Override protected void onDestroy() { destroyWebView(); super.onDestroy(); }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code != MEDIA_REQUEST || mediaRequest == null) return;
        PermissionRequest request = mediaRequest;
        String[] resources = mediaResources;
        mediaRequest = null;
        mediaResources = null;
        if (results.length == 0) { request.deny(); return; }
        for (int result : results) if (result != android.content.pm.PackageManager.PERMISSION_GRANTED) { request.deny(); return; }
        request.grant(resources);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SPEECH_REQUEST) {
            ArrayList<String> results = data == null ? null : data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            String text = resultCode == Activity.RESULT_OK && results != null && !results.isEmpty() ? results.get(0) : null;
            deliverSpeech(text, null);
        } else if (requestCode == FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); fileCallback = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
