using System;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;

namespace MuzoApp
{
    public class MainForm : Form
    {
        private WebView2 webView;
        private NotifyIcon trayIcon;

        public MainForm()
        {
            this.Text = "Muzo - Free Music Player";
            this.Size = new Size(1280, 840);
            this.MinimumSize = new Size(920, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(18, 18, 18);

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string icoPath = Path.Combine(appDir, "Muzo.ico");
            if (File.Exists(icoPath))
            {
                try { this.Icon = new Icon(icoPath); } catch {}
            }

            SetupTray(icoPath);

            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            this.Controls.Add(webView);

            InitializeWebViewAsync();
        }

        private async void InitializeWebViewAsync()
        {
            try
            {
                string dataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MuzoMusicApp");
                var env = await CoreWebView2Environment.CreateAsync(null, dataFolder);
                await webView.EnsureCoreWebView2Async(env);

                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;

                int localPort = 5050;
                string url = IsPortInUse(localPort) ? ("http://127.0.0.1:" + localPort) : "https://paulfucks.github.io/muzo/public/";
                webView.Source = new Uri(url);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Muzo initialized: " + ex.Message, "Muzo Music", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private static bool IsPortInUse(int port)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/network-info");
                req.Timeout = 400;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private void SetupTray(string icoPath)
        {
            trayIcon = new NotifyIcon();
            trayIcon.Text = "Muzo - Free Music Player";
            if (File.Exists(icoPath))
            {
                try { trayIcon.Icon = new Icon(icoPath); } catch {}
            }
            if (trayIcon.Icon == null)
            {
                trayIcon.Icon = this.Icon ?? SystemIcons.Application;
            }

            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add("🎵 Open Muzo", (s, e) => {
                this.Show();
                this.WindowState = FormWindowState.Normal;
                this.BringToFront();
            });
            menu.MenuItems.Add("-");
            menu.MenuItems.Add("❌ Exit", (s, e) => {
                trayIcon.Visible = false;
                Application.Exit();
            });

            trayIcon.ContextMenu = menu;
            trayIcon.DoubleClick += (s, e) => {
                this.Show();
                this.WindowState = FormWindowState.Normal;
                this.BringToFront();
            };
            trayIcon.Visible = true;
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            base.OnFormClosing(e);
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            AppDomain.CurrentDomain.AssemblyResolve += (sender, args) =>
            {
                string name = new AssemblyName(args.Name).Name;
                string resName = null;
                if (name == "Microsoft.Web.WebView2.Core") resName = "WebView2Core.dll";
                else if (name == "Microsoft.Web.WebView2.WinForms") resName = "WebView2WinForms.dll";

                if (resName != null)
                {
                    using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resName))
                    {
                        if (stream != null)
                        {
                            byte[] data = new byte[stream.Length];
                            stream.Read(data, 0, data.Length);
                            return Assembly.Load(data);
                        }
                    }
                }
                return null;
            };

            ExtractNativeLoader();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            RunApp();
        }

        static void RunApp()
        {
            Application.Run(new MainForm());
        }

        static void ExtractNativeLoader()
        {
            try
            {
                string targetPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "WebView2Loader.dll");
                if (!File.Exists(targetPath))
                {
                    using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("WebView2Loader.dll"))
                    {
                        if (stream != null)
                        {
                            byte[] data = new byte[stream.Length];
                            stream.Read(data, 0, data.Length);
                            File.WriteAllBytes(targetPath, data);
                        }
                    }
                }
            }
            catch {}
        }
    }
}
