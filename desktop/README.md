# Windows 桌面版

使用 WinForms 和 WebView2，界面、算法演示及复习记录均在本地运行。程序会把界面资源解压到 `%LOCALAPPDATA%\SortingStudy\App`，复习记录保存在同目录下的 `Profile` 文件夹。

## 构建

需要 Windows 10/11 x64、.NET Framework 的 C# 编译器和 PowerShell 5.1 或更高版本。运行程序还需要 Microsoft Edge WebView2 Runtime；一般随 Windows 和 Microsoft Edge 安装。

先在仓库根目录生成离线页面，再构建桌面程序：

```powershell
node scripts/export-offline.cjs
powershell -ExecutionPolicy Bypass -File desktop/build.ps1
```

输出为 `release/SortingStudy.exe`。构建脚本首次运行会从 NuGet 官方源下载固定版本 `Microsoft.Web.WebView2 1.0.4258.31`，并核对 SHA-256。下载缓存和解压后的 SDK 位于 `desktop/deps/`，无需提交到仓库。SDK 的再分发条款见 [WebView2-LICENSE.txt](WebView2-LICENSE.txt)，程序也内嵌了该文件。

已有 SDK 时可以指定目录，构建过程无需联网：

```powershell
powershell -ExecutionPolicy Bypass -File desktop/build.ps1 -WebView2Directory "D:\SDKs\webview2"
```

`-HtmlPath` 和 `-OutputPath` 可覆盖默认输入、输出位置。图标已包含；修改图标后，可以安装 Python 的 Pillow 并运行 `python desktop/create_icon.py` 重新生成。

## 使用

双击 EXE 启动，F11 切换全屏；导出 C++ 时使用系统保存窗口。关闭后重新打开，复习记录会保留。桌面程序没有代码签名证书。
