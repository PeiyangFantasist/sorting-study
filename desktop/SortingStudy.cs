using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("排序研习室")]
[assembly: AssemblyDescription("八种排序算法的 C++ 可视化离线复习工具")]
[assembly: AssemblyProduct("排序研习室")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class Program
{
    internal static string DataRoot;
    internal static string RuntimeRoot;
    internal static string SelfTestOutput;
    internal static string TestStage;
    internal static string SnapshotOutput;
    internal const string AppTitle = "排序研习室 · C++";
    private static Mutex singleInstance;

    [DllImport("user32.dll")] private static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr FindWindow(string className, string windowName);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);

    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            DataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SortingStudy");
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--data-dir" && i + 1 < args.Length) DataRoot = Path.GetFullPath(args[++i]);
                else if (args[i] == "--self-test" && i + 1 < args.Length) SelfTestOutput = Path.GetFullPath(args[++i]);
                else if (args[i] == "--test-stage" && i + 1 < args.Length) TestStage = args[++i];
                else if (args[i] == "--snapshot" && i + 1 < args.Length) SnapshotOutput = Path.GetFullPath(args[++i]);
            }
            bool isFirst;
            string mutexId = "Local\\SortingStudy-" + Hash(Encoding.UTF8.GetBytes(DataRoot.ToLowerInvariant())).Substring(0, 20);
            singleInstance = new Mutex(true, mutexId, out isFirst);
            if (!isFirst)
            {
                IntPtr existing = FindWindow(null, AppTitle);
                if (existing != IntPtr.Zero) { ShowWindow(existing, 9); SetForegroundWindow(existing); }
                return;
            }
            Directory.CreateDirectory(DataRoot);
            byte[] html = Resource("App.index.html");
            string key = Hash(html).Substring(0, 12) + "-1.0.4258.31";
            RuntimeRoot = Path.Combine(DataRoot, "App", key);
            Directory.CreateDirectory(RuntimeRoot);
            Extract("App.Core.dll", "Microsoft.Web.WebView2.Core.dll");
            Extract("App.WinForms.dll", "Microsoft.Web.WebView2.WinForms.dll");
            Extract("App.Loader.dll", "WebView2Loader.dll");
            Extract("App.index.html", "index.html");
            Extract("App.LICENSE.txt", "WebView2-LICENSE.txt");
            AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs e)
            {
                string name = new AssemblyName(e.Name).Name;
                if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms") return null;
                return Assembly.LoadFrom(Path.Combine(RuntimeRoot, name + ".dll"));
            };
            try { SetProcessDPIAware(); } catch { }
            StartUI();
        }
        catch (Exception ex)
        {
            ReportFailure(ex);
        }
        finally
        {
            if (singleInstance != null) singleInstance.Dispose();
        }
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void StartUI()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        CoreWebView2Environment.SetLoaderDllFolderPath(RuntimeRoot);
        Application.Run(new StudyWindow());
    }

    internal static byte[] Resource(string name)
    {
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        {
            if (stream == null) throw new InvalidOperationException("程序资源不完整：" + name);
            using (MemoryStream bytes = new MemoryStream()) { stream.CopyTo(bytes); return bytes.ToArray(); }
        }
    }

    private static void Extract(string resource, string filename)
    {
        byte[] expected = Resource(resource);
        string target = Path.Combine(RuntimeRoot, filename);
        if (File.Exists(target) && Hash(File.ReadAllBytes(target)) == Hash(expected)) return;
        File.WriteAllBytes(target, expected);
    }

    private static string Hash(byte[] bytes)
    {
        using (SHA256 sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
    }

    internal static void ReportFailure(Exception ex)
    {
        string detail = ex.ToString();
        try { if (DataRoot != null) File.WriteAllText(Path.Combine(DataRoot, "startup-error.txt"), detail, Encoding.UTF8); } catch { }
        if (SelfTestOutput != null)
        {
            try { File.WriteAllText(SelfTestOutput, new JavaScriptSerializer().Serialize(new { ok = false, error = detail }), Encoding.UTF8); } catch { }
        }
        else MessageBox.Show("程序暂时无法启动。\n\n" + ex.Message + "\n\n本程序使用 Microsoft Edge WebView2。若电脑缺少该组件，可从微软官网下载运行时后重试。", AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Information);
        Environment.ExitCode = 1;
    }
}

internal sealed class StudyWindow : Form
{
    private readonly WebView2 web = new WebView2();
    private readonly Label startup = new Label();
    private readonly JavaScriptSerializer json = new JavaScriptSerializer();
    private readonly List<string> blockedRequests = new List<string>();
    private bool initialNavigation = true;
    private bool fullscreen;
    private FormWindowState oldWindowState;
    private Rectangle oldBounds;
    private readonly string windowFile = Path.Combine(Program.DataRoot, "window.json");
    private System.Windows.Forms.Timer testWatchdog;
    private string testDownload;

    public StudyWindow()
    {
        Text = Program.AppTitle;
        BackColor = ColorTranslator.FromHtml("#f6f7f4");
        MinimumSize = new Size(850, 650);
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1360, 940);
        WindowState = FormWindowState.Maximized;
        using (MemoryStream icon = new MemoryStream(Program.Resource("App.icon.ico"))) Icon = new Icon(icon);
        AutoScaleMode = AutoScaleMode.Dpi;
        RestoreWindow();
        startup.Text = "排序研习室\n\n正在准备你的复习空间…";
        startup.Font = new Font("Microsoft YaHei UI", 16);
        startup.ForeColor = ColorTranslator.FromHtml("#246a55");
        startup.TextAlign = ContentAlignment.MiddleCenter;
        startup.Dock = DockStyle.Fill;
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = BackColor;
        web.Visible = false;
        Controls.Add(web); Controls.Add(startup);
        Shown += async delegate { await InitializeAsync(); };
        FormClosing += delegate { SaveWindow(); web.Dispose(); };
        if (Program.SelfTestOutput != null)
        {
            testWatchdog = new System.Windows.Forms.Timer { Interval = 60000 };
            testWatchdog.Tick += delegate { FailTest(new TimeoutException("Desktop integration check timed out")); };
            testWatchdog.Start();
        }
    }

    private async Task InitializeAsync()
    {
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.DataRoot, "Profile"));
            await web.EnsureCoreWebView2Async(environment);
            var core = web.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping("sorting-study.test", Program.RuntimeRoot, CoreWebView2HostResourceAccessKind.Deny);
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsBuiltInErrorPageEnabled = false;
            core.Settings.IsWebMessageEnabled = true;
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += delegate(object sender, CoreWebView2WebResourceRequestedEventArgs e)
            {
                Uri uri;
                if (Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out uri) && (uri.Scheme == "http" || uri.Scheme == "https") && uri.Host != "sorting-study.test")
                {
                    blockedRequests.Add(e.Request.Uri);
                    e.Response = environment.CreateWebResourceResponse(new MemoryStream(), 403, "Offline application", "Content-Type: text/plain");
                }
            };
            core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e)
            {
                Uri uri;
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out uri) || !((uri.Scheme == "https" && uri.Host == "sorting-study.test") || e.Uri.StartsWith("blob:https://sorting-study.test/", StringComparison.Ordinal) || e.Uri == "about:blank")) e.Cancel = true;
            };
            core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            core.WebMessageReceived += delegate(object sender, CoreWebView2WebMessageReceivedEventArgs e)
            {
                if (!e.Source.StartsWith("https://sorting-study.test/", StringComparison.Ordinal)) return;
                string message;
                try { message = e.TryGetWebMessageAsString(); } catch { return; }
                if (message == "fullscreen") ToggleFullscreen();
                else if (message.StartsWith("{", StringComparison.Ordinal))
                {
                    try
                    {
                        var request = json.Deserialize<Dictionary<string, object>>(message);
                        if (request.ContainsKey("type") && Convert.ToString(request["type"]) == "save-cpp") SaveCpp(request);
                    }
                    catch { }
                }
            };
            core.DownloadStarting += HandleDownload;
            await core.AddScriptToExecuteOnDocumentCreatedAsync(Encoding.UTF8.GetString(Program.Resource("App.bridge.js")));
            core.NavigationCompleted += OnNavigationCompleted;
            core.Navigate("https://sorting-study.test/index.html");
        }
        catch (Exception ex)
        {
            Program.ReportFailure(ex); Close();
        }
    }

    private async void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!initialNavigation) return;
        initialNavigation = false;
        if (!e.IsSuccess) { FailTest(new Exception("页面加载失败：" + e.WebErrorStatus)); return; }
        startup.Visible = false; web.Visible = true; web.Focus();
        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('footer span:last-child').textContent='8 algorithms · C++17 · 离线桌面版';");
        if (Program.SelfTestOutput != null)
        {
            try { await RunSelfTest(); }
            catch (Exception ex) { FailTest(ex); }
        }
        else if (Program.SnapshotOutput != null)
        {
            await Task.Delay(500);
            using (var output = File.Create(Program.SnapshotOutput)) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
        }
    }

    private void HandleDownload(object sender, CoreWebView2DownloadStartingEventArgs e)
    {
        if (Program.SelfTestOutput != null)
        {
            string folder = Path.Combine(Program.DataRoot, "Exports");
            Directory.CreateDirectory(folder);
            testDownload = Path.Combine(folder, Path.GetFileName(e.ResultFilePath));
            e.Handled = true; e.ResultFilePath = testDownload;
            return;
        }
        var deferral = e.GetDeferral();
        e.Handled = true;
        BeginInvoke(new Action(delegate
        {
            try
            {
                using (var dialog = new SaveFileDialog())
                {
                    dialog.FileName = Path.GetFileName(e.ResultFilePath);
                    dialog.Filter = "C++ 源文件 (*.cpp)|*.cpp|所有文件 (*.*)|*.*";
                    dialog.DefaultExt = "cpp"; dialog.AddExtension = true;
                    dialog.Title = "保存当前算法的 C++ 示例";
                    if (dialog.ShowDialog(this) == DialogResult.OK) e.ResultFilePath = dialog.FileName;
                    else e.Cancel = true;
                }
            }
            catch { e.Cancel = true; }
            finally { deferral.Complete(); }
        }));
    }

    private void SaveCpp(Dictionary<string, object> request)
    {
        bool saved = false;
        object requestId = request.ContainsKey("id") ? request["id"] : 0;
        try
        {
            string code = Convert.ToString(request["code"]);
            string filename = Path.GetFileName(Convert.ToString(request["filename"]));
            if (code.Length > 200000 || !filename.EndsWith(".cpp", StringComparison.OrdinalIgnoreCase)) return;
            if (Program.SelfTestOutput != null)
            {
                string folder = Path.Combine(Program.DataRoot, "Exports");
                Directory.CreateDirectory(folder); testDownload = Path.Combine(folder, filename);
                File.WriteAllText(testDownload, code, new UTF8Encoding(false)); saved = true;
            }
            else using (var dialog = new SaveFileDialog())
            {
                dialog.FileName = filename; dialog.Filter = "C++ 源文件 (*.cpp)|*.cpp";
                dialog.DefaultExt = "cpp"; dialog.AddExtension = true; dialog.Title = "保存 C++ 示例";
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    File.WriteAllText(dialog.FileName, code, new UTF8Encoding(false)); saved = true;
                }
            }
        }
        catch (Exception ex)
        {
            if (Program.SelfTestOutput == null) MessageBox.Show(ex.Message, "保存失败", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        finally
        {
            web.CoreWebView2.PostWebMessageAsJson(json.Serialize(new { type = "save-result", id = requestId, ok = saved }));
        }
    }

    private void ToggleFullscreen()
    {
        if (!fullscreen)
        {
            oldBounds = Bounds; oldWindowState = WindowState;
            FormBorderStyle = FormBorderStyle.None; WindowState = FormWindowState.Maximized;
        }
        else
        {
            FormBorderStyle = FormBorderStyle.Sizable; WindowState = FormWindowState.Normal; Bounds = oldBounds; WindowState = oldWindowState;
        }
        fullscreen = !fullscreen;
    }

    private void RestoreWindow()
    {
        try
        {
            var state = json.Deserialize<Dictionary<string, int>>(File.ReadAllText(windowFile));
            var bounds = new Rectangle(state["x"], state["y"], state["width"], state["height"]);
            bool visible = false;
            foreach (Screen screen in Screen.AllScreens) if (Rectangle.Intersect(screen.WorkingArea, bounds).Width >= 250 && Rectangle.Intersect(screen.WorkingArea, bounds).Height >= 150) visible = true;
            if (visible && bounds.Width >= MinimumSize.Width && bounds.Height >= MinimumSize.Height)
            {
                StartPosition = FormStartPosition.Manual; Bounds = bounds;
                WindowState = state["maximized"] == 1 ? FormWindowState.Maximized : FormWindowState.Normal;
            }
        }
        catch { }
    }

    private void SaveWindow()
    {
        if (Program.SelfTestOutput != null) return;
        try
        {
            Rectangle rect = fullscreen ? oldBounds : WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            File.WriteAllText(windowFile, json.Serialize(new { x = rect.X, y = rect.Y, width = rect.Width, height = rect.Height, maximized = (fullscreen ? oldWindowState : WindowState) == FormWindowState.Maximized ? 1 : 0 }), Encoding.UTF8);
        }
        catch { }
    }

    private async Task<string> Eval(string script)
    {
        string result = await web.CoreWebView2.ExecuteScriptAsync(script);
        return result;
    }

    private async Task RunSelfTest()
    {
        // Runs only when explicitly requested by the build verifier, using its isolated data folder.
        string script = @"(async()=>{
const assert=(value,message)=>{if(!value)throw new Error(message)};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
if(document.getElementById('mastery-button').classList.contains('is-mastered'))document.getElementById('mastery-button').click();
document.querySelector('[data-view=quiz]').click();document.getElementById('quiz-reset').click();document.querySelector('[data-view=lab]').click();
assert(window.SortLab && Object.keys(SortModules).length===8,'8 modules initialized');
assert(isSecureContext,'secure local origin');
const root=getComputedStyle(document.documentElement);
assert(root.getPropertyValue('--coral').trim()==='#d98c6d','theme intact');
for(const id of ['insertion','binary','shell','bubble','quick','heap','merge','radix']){
  SortLab.selectAlgorithm(id); SortLab.applyValues([42,17,8,33,21,17,9,28]);
  const frames=SortModules[id].run([42,17,8,33,21,17,9,28]);
  let colored=0;
  for(let index=0;index<frames.length;index++){
    SortLab.jump(index);
    assert(document.querySelectorAll('#chart .bar').length===8,id+' frame bar count');
    for(const bar of document.querySelectorAll('#chart .bar')){
      assert(getComputedStyle(bar).backgroundColor!=='rgba(0, 0, 0, 0)',id+' opaque bar');
      assert(parseFloat(getComputedStyle(bar).minHeight)>=10,id+' min height');
    }
    if(frames[index].changed.length)colored++;
    assert(document.querySelectorAll('.code-line.current').length===frames[index].lines.length,id+' code highlighting');
  }
  const actual=SortLab.getState().frame.arr.map(item=>item.v).join(',');
  assert(actual==='8,9,17,17,21,28,33,42',id+' final order');
  results.push({id,frames:frames.length,colorFrames:colored});
}
SortLab.selectAlgorithm('insertion');
document.getElementById('play-button').click(); await wait(1150);
assert(SortLab.getState().index>0,'automatic playback');
document.getElementById('play-button').click();
const savedIndex=SortLab.getState().index; await wait(1100);
assert(SortLab.getState().index===savedIndex,'pause');
document.getElementById('mastery-button').click();
assert(JSON.parse(localStorage.getItem('sorting-lab-mastery-v1')).includes('insertion'),'mastery storage');
document.querySelector('[data-view=quiz]').click();
document.querySelector('[data-question=insertion-pass][data-answer=""0""]').click();
assert(document.querySelector('.quiz-feedback').textContent.includes('回答正确'),'quiz answer');
document.querySelector('[data-view=lab]').click();
document.getElementById('download-code').click();await wait(600);
SortLab.jump(13); await wait(300);
return {ok:true,origin:location.origin,secure:isSecureContext,results,viewport:{width:innerWidth,height:innerHeight},progress:JSON.parse(localStorage.getItem('sorting-lab-mastery-v1')),cssColor:getComputedStyle(document.querySelector('.bar.changed')).backgroundColor};
})().then(result=>window.__desktopTestResult=result).catch(error=>window.__desktopTestResult={ok:false,error:String(error.stack||error)});";
        if (Program.TestStage == "persist")
        {
            script = @"window.__desktopTestResult={ok:JSON.parse(localStorage.getItem('sorting-lab-mastery-v1')||'[]').includes('insertion')&&JSON.parse(localStorage.getItem('sorting-lab-quiz-v1')||'{}')['insertion-pass']===0,mastery:localStorage.getItem('sorting-lab-mastery-v1'),quiz:localStorage.getItem('sorting-lab-quiz-v1'),origin:location.origin};";
        }
        await Eval(script);
        string report = "null";
        for (int i = 0; i < 80; i++)
        {
            report = await Eval("JSON.stringify(window.__desktopTestResult||null)");
            string inner = json.Deserialize<string>(report);
            if (inner != "null") { report = inner; break; }
            await Task.Delay(250);
        }
        if (report == "null") throw new TimeoutException("JavaScript check did not finish");
        var result = json.Deserialize<Dictionary<string, object>>(report);
        if (Program.TestStage != "persist")
        {
            for (int i = 0; i < 20 && (testDownload == null || !File.Exists(testDownload)); i++) await Task.Delay(100);
            bool downloaded = testDownload != null && File.Exists(testDownload) && File.ReadAllText(testDownload).Contains("int main()");
            result["cppDownload"] = downloaded;
            if (!downloaded) { result["ok"] = false; result["error"] = "C++ export failed"; }
        }
        result["externalRequestsBlocked"] = blockedRequests.ToArray();
        result["runtime"] = web.CoreWebView2.Environment.BrowserVersionString;
        File.WriteAllText(Program.SelfTestOutput, json.Serialize(result), Encoding.UTF8);
        if (Program.SnapshotOutput != null)
        {
            await Eval("window.scrollTo(0,340)"); await Task.Delay(300);
            using (var output = File.Create(Program.SnapshotOutput)) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
        }
        if (testWatchdog != null) testWatchdog.Stop();
        if (!result.ContainsKey("ok") || !Convert.ToBoolean(result["ok"])) Environment.ExitCode = 1;
        Close();
    }

    private void FailTest(Exception ex)
    {
        if (testWatchdog != null) testWatchdog.Stop();
        Program.ReportFailure(ex); Close();
    }
}
