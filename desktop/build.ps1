param(
    [string]$HtmlPath,
    [string]$OutputPath,
    [string]$WebView2Directory
)

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $HtmlPath) { $HtmlPath = Join-Path $taskRoot 'release/sorting-review.html' }
if (-not $OutputPath) { $OutputPath = Join-Path $taskRoot 'release/SortingStudy.exe' }
if (-not $WebView2Directory) { $WebView2Directory = Join-Path $PSScriptRoot 'deps/webview2' }
$taskHtml = (Resolve-Path -LiteralPath $HtmlPath).Path
$taskOutput = [IO.Path]::GetFullPath($OutputPath)
$taskDeps = [IO.Path]::GetFullPath($WebView2Directory)
$taskVersion = '1.0.4258.31'
$taskPackageHash = '56F7F4B8BF9AEE4B8EFEFBBDD4F67D5F74EBD1B100ED0806DA71BF76AF481AA9'

# The SDK is downloaded only for building. The app uses the installed WebView2 Runtime.
if (-not (Test-Path -LiteralPath (Join-Path $taskDeps 'lib/net462/Microsoft.Web.WebView2.Core.dll'))) {
    $taskCache = Join-Path $PSScriptRoot 'deps'
    New-Item -ItemType Directory -Path $taskCache -Force | Out-Null
    $taskArchive = Join-Path $taskCache ('microsoft.web.webview2.' + $taskVersion + '.zip')
    $taskUri = 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/' + $taskVersion + '/microsoft.web.webview2.' + $taskVersion + '.nupkg'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    if (-not (Test-Path -LiteralPath $taskArchive)) {
        Invoke-WebRequest -Uri $taskUri -OutFile $taskArchive -UseBasicParsing
    }
    if ((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash -ne $taskPackageHash) {
        throw "WebView2 SDK checksum mismatch: $taskArchive"
    }
    Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskDeps -Force
}

foreach ($taskRelativeFile in @(
    'lib/net462/Microsoft.Web.WebView2.Core.dll',
    'lib/net462/Microsoft.Web.WebView2.WinForms.dll',
    'runtimes/win-x64/native/WebView2Loader.dll',
    'LICENSE.txt'
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskDeps $taskRelativeFile))) {
        throw "WebView2 SDK file is missing: $taskRelativeFile"
    }
}
$taskAssemblyVersion = [Reflection.AssemblyName]::GetAssemblyName((Join-Path $taskDeps 'lib/net462/Microsoft.Web.WebView2.Core.dll')).Version.ToString()
if ($taskAssemblyVersion -ne $taskVersion) { throw "Expected WebView2 SDK $taskVersion; found $taskAssemblyVersion" }

$taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $taskCompiler)) { throw '.NET Framework C# compiler was not found.' }
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($taskOutput)) -Force | Out-Null
$taskArgs = @(
    '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/utf8output',
    ('/out:' + $taskOutput),
    ('/win32icon:' + (Join-Path $PSScriptRoot 'assets/sorting.ico')),
    ('/win32manifest:' + (Join-Path $PSScriptRoot 'app.manifest')),
    '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll',
    ('/reference:' + (Join-Path $taskDeps 'lib/net462/Microsoft.Web.WebView2.Core.dll')),
    ('/reference:' + (Join-Path $taskDeps 'lib/net462/Microsoft.Web.WebView2.WinForms.dll')),
    ('/resource:' + $taskHtml + ',App.index.html'),
    ('/resource:' + (Join-Path $taskDeps 'lib/net462/Microsoft.Web.WebView2.Core.dll') + ',App.Core.dll'),
    ('/resource:' + (Join-Path $taskDeps 'lib/net462/Microsoft.Web.WebView2.WinForms.dll') + ',App.WinForms.dll'),
    ('/resource:' + (Join-Path $taskDeps 'runtimes/win-x64/native/WebView2Loader.dll') + ',App.Loader.dll'),
    ('/resource:' + (Join-Path $taskDeps 'LICENSE.txt') + ',App.LICENSE.txt'),
    ('/resource:' + (Join-Path $PSScriptRoot 'assets/sorting.ico') + ',App.icon.ico'),
    ('/resource:' + (Join-Path $PSScriptRoot 'bridge.js') + ',App.bridge.js'),
    (Join-Path $PSScriptRoot 'SortingStudy.cs')
)
& $taskCompiler @taskArgs
if ($LASTEXITCODE -ne 0) { throw 'C# compilation failed' }
Get-Item -LiteralPath $taskOutput | Select-Object Name,Length
