param(
    [string]$AndroidSdk = $env:ANDROID_HOME,
    [string]$JdkHome = $env:JAVA_HOME,
    [string]$BuildToolsVersion = '35.0.0',
    [string]$BuildToolsPath,
    [string]$AndroidJar,
    [string]$Python = 'python',
    [string]$Keystore,
    [string]$KeyAlias = 'sorting-study',
    [string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $JdkHome) { throw 'Set JAVA_HOME or pass -JdkHome (JDK 17 or newer).' }
if (-not $BuildToolsPath) {
    if (-not $AndroidSdk) { throw 'Set ANDROID_HOME or pass -AndroidSdk.' }
    $BuildToolsPath = Join-Path $AndroidSdk ('build-tools/' + $BuildToolsVersion)
}
if (-not $AndroidJar) {
    if (-not $AndroidSdk) { throw 'Set ANDROID_HOME or pass -AndroidJar.' }
    $AndroidJar = Join-Path $AndroidSdk 'platforms/android-35/android.jar'
}
$jdkBin = Join-Path $JdkHome 'bin'
foreach ($required in @('java.exe','javac.exe','jar.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $jdkBin $required) -PathType Leaf)) { throw ('Missing JDK tool: ' + $required) }
}
foreach ($required in @('aapt2.exe','zipalign.exe','lib/d8.jar','lib/apksigner.jar')) {
    if (-not (Test-Path -LiteralPath (Join-Path $BuildToolsPath $required) -PathType Leaf)) { throw ('Missing Android SDK tool: ' + $required) }
}
if (-not (Test-Path -LiteralPath $AndroidJar -PathType Leaf)) { throw 'Android API 35 android.jar was not found.' }
if ($Keystore) {
    $Keystore = (Resolve-Path -LiteralPath $Keystore).Path
    if ($Keystore.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Keep the signing keystore outside this repository.' }
    if (-not $env:SORTING_APK_STOREPASS) { throw 'Set SORTING_APK_STOREPASS for the external signing keystore.' }
}
function Invoke-Checked {
    param([string]$File, [string[]]$ToolArgs)
    & $File @ToolArgs
    if ($LASTEXITCODE -ne 0) { throw ('Build tool failed: ' + [IO.Path]::GetFileName($File)) }
}
Invoke-Checked $Python @((Join-Path $PSScriptRoot 'prepare_assets.py'))
$build = Join-Path $PSScriptRoot ('build/' + [Guid]::NewGuid().ToString('N'))
$release = if ($OutputDirectory) { $OutputDirectory } else { Join-Path $repoRoot 'release' }
New-Item -ItemType Directory -Force -Path $build,(Join-Path $build 'classes'),(Join-Path $build 'gen'),(Join-Path $build 'dex'),$release | Out-Null
Invoke-Checked (Join-Path $BuildToolsPath 'aapt2.exe') @('compile','--dir',(Join-Path $PSScriptRoot 'res'),'-o',(Join-Path $build 'resources.zip'))
Invoke-Checked (Join-Path $BuildToolsPath 'aapt2.exe') @('link','-o',(Join-Path $build 'resources.apk'),'-I',$AndroidJar,'--manifest',(Join-Path $PSScriptRoot 'AndroidManifest.xml'),'--java',(Join-Path $build 'gen'),'-A',(Join-Path $PSScriptRoot 'assets'),'--min-sdk-version','26','--target-sdk-version','35',(Join-Path $build 'resources.zip'))
$sources = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src'),(Join-Path $build 'gen') -Recurse -Filter '*.java' | Select-Object -ExpandProperty FullName)
Invoke-Checked (Join-Path $jdkBin 'javac.exe') (@('--release','8','-encoding','UTF-8','-classpath',$AndroidJar,'-d',(Join-Path $build 'classes')) + $sources)
Invoke-Checked (Join-Path $jdkBin 'jar.exe') @(('-J-Djava.io.tmpdir=' + $build),'cf',(Join-Path $build 'classes.jar'),'-C',(Join-Path $build 'classes'),'.')
Invoke-Checked (Join-Path $jdkBin 'java.exe') @('-cp',(Join-Path $BuildToolsPath 'lib/d8.jar'),'com.android.tools.r8.D8','--release','--min-api','26','--lib',$AndroidJar,'--output',(Join-Path $build 'dex'),(Join-Path $build 'classes.jar'))
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Copy-Item -LiteralPath (Join-Path $build 'resources.apk') -Destination (Join-Path $build 'unsigned.apk')
$archive = [IO.Compression.ZipFile]::Open((Join-Path $build 'unsigned.apk'),[IO.Compression.ZipArchiveMode]::Update)
try {
    foreach ($dex in Get-ChildItem -LiteralPath (Join-Path $build 'dex') -Filter '*.dex') {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$dex.FullName,$dex.Name,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
Invoke-Checked (Join-Path $BuildToolsPath 'zipalign.exe') @('-f','4',(Join-Path $build 'unsigned.apk'),(Join-Path $build 'aligned.apk'))
if ($Keystore) {
    $output = Join-Path $release 'SortingStudy-android.apk'
    Invoke-Checked (Join-Path $jdkBin 'java.exe') @('-jar',(Join-Path $BuildToolsPath 'lib/apksigner.jar'),'sign','--ks',$Keystore,'--ks-key-alias',$KeyAlias,'--ks-pass','env:SORTING_APK_STOREPASS','--key-pass','env:SORTING_APK_STOREPASS','--v1-signing-enabled','false','--v2-signing-enabled','true','--v3-signing-enabled','true','--v4-signing-enabled','false','--out',$output,(Join-Path $build 'aligned.apk'))
    Invoke-Checked (Join-Path $jdkBin 'java.exe') @('-jar',(Join-Path $BuildToolsPath 'lib/apksigner.jar'),'verify','--verbose',$output)
} else {
    $output = Join-Path $release 'SortingStudy-android-unsigned.apk'
    Copy-Item -LiteralPath (Join-Path $build 'aligned.apk') -Destination $output -Force
    Write-Warning 'Unsigned APK created. Android requires a signed APK for installation. Pass -Keystore to produce an installable APK.'
}
Invoke-Checked (Join-Path $BuildToolsPath 'zipalign.exe') @('-c','4',$output)
Get-Item -LiteralPath $output | Select-Object Name,Length
