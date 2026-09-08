using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;

namespace MuzoApp
{
    static class Program
    {
        private static Process serverProcess = null;
        private static NotifyIcon trayIcon = null;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            int port = 5050;

            StartServerIfNeeded(appDir, port);
            SetupTrayIcon(appDir, port);
            LaunchDesktopWindow(port);

            Application.Run();
        }

        private static void StartServerIfNeeded(string appDir, int port)
        {
            if (IsPortInUse(port)) return;

            try
            {
                string serverScript = Path.Combine(appDir, "server.ps1");
                if (!File.Exists(serverScript)) return;

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.Arguments = string.Format("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{0}\" -Port {1}", serverScript, port);
                psi.WorkingDirectory = appDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                serverProcess = Process.Start(psi);

                for (int i = 0; i < 30; i++)
                {
                    if (IsPortInUse(port)) break;
                    Thread.Sleep(100);
                }
            }
            catch {}
        }

        private static bool IsPortInUse(int port)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/network-info");
                req.Timeout = 500;
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

        private static void LaunchDesktopWindow(int port)
        {
            string url = "http://localhost:" + port;
            string[] browsers = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"BraveSoftware\Brave-Browser\Application\brave.exe")
            };

            string foundBrowser = null;
            foreach (string b in browsers)
            {
                if (File.Exists(b))
                {
                    foundBrowser = b;
                    break;
                }
            }

            if (foundBrowser != null)
            {
                string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MuzoProfile");
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = foundBrowser;
                psi.Arguments = string.Format("--app=\"{0}\" --window-size=1280,840 --user-data-dir=\"{1}\"", url, profileDir);
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            else
            {
                Process.Start(url);
            }
        }

        private static void SetupTrayIcon(string appDir, int port)
        {
            trayIcon = new NotifyIcon();
            trayIcon.Text = "Muzo - Free Music Player";

            string icoPath = Path.Combine(appDir, "Muzo.ico");
            if (File.Exists(icoPath))
            {
                try { trayIcon.Icon = new Icon(icoPath); } catch {}
            }
            if (trayIcon.Icon == null)
            {
                trayIcon.Icon = SystemIcons.Application;
            }

            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add("🎵 Open Muzo", (s, e) => LaunchDesktopWindow(port));
            menu.MenuItems.Add("📱 Connect Phone", (s, e) => Process.Start("http://localhost:" + port));
            menu.MenuItems.Add("-");
            menu.MenuItems.Add("❌ Exit Muzo", (s, e) => {
                trayIcon.Visible = false;
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    try { serverProcess.Kill(); } catch {}
                }
                Application.Exit();
            });

            trayIcon.ContextMenu = menu;
            trayIcon.DoubleClick += (s, e) => LaunchDesktopWindow(port);
            trayIcon.Visible = true;
        }
    }
}
