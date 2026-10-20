# 安卓版源码

Android 8.0 及以上；目标 API 35。使用系统 WebView，八个排序演示、代码和题目都保存在应用内，不需要联网权限。复制代码使用系统剪贴板；保存 C++ 使用系统文件选择器，不申请存储权限。

## 构建

需要 Windows PowerShell、Python 3、JDK 17 或更新版本，以及 Android SDK 的 Platform 35 和 Build Tools 35.0.0。构建过程不会自动下载工具。先在仓库根目录运行 `node scripts/export-offline.cjs`，生成 `release/sorting-review.html`。

设置 `JAVA_HOME` 和 `ANDROID_HOME` 后，从仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File android/build.ps1
```

默认生成 `release/SortingStudy-android-unsigned.apk`，未签名版本不能直接安装。发布时需要仓库外的签名密钥；通过环境变量提供密码，脚本不会创建或保存密码。

```powershell
$signingPassword = Read-Host 'Keystore password' -AsSecureString
$env:SORTING_APK_STOREPASS = [Net.NetworkCredential]::new('', $signingPassword).Password
try {
    powershell -ExecutionPolicy Bypass -File android/build.ps1 -Keystore 'D:\private\sorting-study.p12' -KeyAlias 'sorting-study'
} finally {
    Remove-Item Env:SORTING_APK_STOREPASS
}
```

签名后生成 `release/SortingStudy-android.apk`。密钥密码与私钥密码须相同。更新已有安装时必须使用原来的密钥；请在仓库外妥善保存，不要提交私钥或密码。

也可以传入 `-JdkHome`、`-AndroidSdk`、`-BuildToolsVersion`、`-BuildToolsPath`、`-AndroidJar` 和 `-Python`，适配不同的本地工具路径。

## 检查

```powershell
node android/tests/bridge.cjs
```

发布包已完成 Java 编译、APK 签名校验、资源与离线页面核对、桥接接口测试；尚未在安卓真机或模拟器上运行。手机上的触控、返回操作、系统文件保存和屏幕旋转仍需设备验证。
