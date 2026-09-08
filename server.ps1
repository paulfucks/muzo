# Muzo - High Performance Multi-Device Backend Server
# Multi-threaded request processing with fast Innertube scraping, in-memory caching, and LAN mobile access.

param(
    [int]$Port = 5050
)

$ErrorActionPreference = "Continue"

# Root directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublicDir = Join-Path $ScriptDir "public"

if (-not (Test-Path $PublicDir)) {
    New-Item -ItemType Directory -Path $PublicDir -Force | Out-Null
}

# Detect Local LAN IPv4 for mobile connectivity
$LanIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual' -and $_.IPAddress -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1).IPAddress
if (-not $LanIP) { $LanIP = "127.0.0.1" }

# Load System.Web and System.Web.Extensions for URL encoding & JSON serialization
Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Web.Extensions

# -------------------------------------------------------------
# Curated Charts (Instantly Served in 0ms)
# -------------------------------------------------------------
$CuratedJson = @'
{
  "trending": [
    { "id": "Rif-RTvmmss", "title": "Starboy", "artist": "The Weeknd ft. Daft Punk", "duration": "3:50", "thumbnail": "https://i.ytimg.com/vi/Rif-RTvmmss/hqdefault.jpg" },
    { "id": "JGwWNGJdvx8", "title": "Shape of You", "artist": "Ed Sheeran", "duration": "3:53", "thumbnail": "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg" },
    { "id": "fJ9rUzIMcZQ", "title": "Bohemian Rhapsody", "artist": "Queen", "duration": "5:55", "thumbnail": "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg" },
    { "id": "4NRXx6U8ABQ", "title": "Blinding Lights", "artist": "The Weeknd", "duration": "3:20", "thumbnail": "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg" },
    { "id": "hT_nvWreIhg", "title": "Counting Stars", "artist": "OneRepublic", "duration": "4:17", "thumbnail": "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg" },
    { "id": "09R8_2nJtjg", "title": "Sugar", "artist": "Maroon 5", "duration": "3:55", "thumbnail": "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg" },
    { "id": "YVkUvmDQ3HY", "title": "Without Me", "artist": "Eminem", "duration": "4:50", "thumbnail": "https://i.ytimg.com/vi/YVkUvmDQ3HY/hqdefault.jpg" },
    { "id": "nfWlot6h_JM", "title": "Shake It Off", "artist": "Taylor Swift", "duration": "3:39", "thumbnail": "https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg" },
    { "id": "OPf0YbXqDm0", "title": "Uptown Funk", "artist": "Mark Ronson ft. Bruno Mars", "duration": "4:30", "thumbnail": "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg" },
    { "id": "kffacxfA7G4", "title": "Baby", "artist": "Justin Bieber", "duration": "3:34", "thumbnail": "https://i.ytimg.com/vi/kffacxfA7G4/hqdefault.jpg" }
  ],
  "anime": [
    { "id": "WNeLUngb-Xg", "title": "Gurenge (Demon Slayer OP)", "artist": "LiSA", "duration": "3:58", "thumbnail": "https://i.ytimg.com/vi/WNeLUngb-Xg/hqdefault.jpg" },
    { "id": "1tk1pqwOIfI", "title": "Shinunoga E-Wa", "artist": "Fujii Kaze", "duration": "3:05", "thumbnail": "https://i.ytimg.com/vi/1tk1pqwOIfI/hqdefault.jpg" },
    { "id": "sENM2wA_FTg", "title": "Suzume (Theme Song)", "artist": "RADWIMPS ft. Toaka", "duration": "3:58", "thumbnail": "https://i.ytimg.com/vi/sENM2wA_FTg/hqdefault.jpg" },
    { "id": "dxZ4z81k8_0", "title": "Kaikai Kitan (Jujutsu Kaisen OP)", "artist": "Eve", "duration": "3:41", "thumbnail": "https://i.ytimg.com/vi/dxZ4z81k8_0/hqdefault.jpg" },
    { "id": "m1V8kI52W6E", "title": "Nandemonaiya (Your Name OST)", "artist": "RADWIMPS", "duration": "5:42", "thumbnail": "https://i.ytimg.com/vi/m1V8kI52W6E/hqdefault.jpg" },
    { "id": "9aJVr5tTTWk", "title": "Peace Sign (My Hero Academia OP)", "artist": "Kenshi Yonezu", "duration": "4:02", "thumbnail": "https://i.ytimg.com/vi/9aJVr5tTTWk/hqdefault.jpg" }
  ],
  "pop": [
    { "id": "4NRXx6U8ABQ", "title": "Blinding Lights", "artist": "The Weeknd", "duration": "3:20", "thumbnail": "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg" },
    { "id": "TUVcZfQe-Kw", "title": "Levitating", "artist": "Dua Lipa", "duration": "3:23", "thumbnail": "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg" },
    { "id": "H5v3kku4y6Q", "title": "As It Was", "artist": "Harry Styles", "duration": "2:47", "thumbnail": "https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg" },
    { "id": "gNi_6U5Pm_o", "title": "Cruel Summer", "artist": "Taylor Swift", "duration": "2:58", "thumbnail": "https://i.ytimg.com/vi/gNi_6U5Pm_o/hqdefault.jpg" },
    { "id": "pB-5XG-DbAA", "title": "Flowers", "artist": "Miley Cyrus", "duration": "3:20", "thumbnail": "https://i.ytimg.com/vi/pB-5XG-DbAA/hqdefault.jpg" },
    { "id": "SlPhMPnQ58k", "title": "Memories", "artist": "Maroon 5", "duration": "3:09", "thumbnail": "https://i.ytimg.com/vi/SlPhMPnQ58k/hqdefault.jpg" }
  ],
  "hiphop": [
    { "id": "YVkUvmDQ3HY", "title": "Without Me", "artist": "Eminem", "duration": "4:50", "thumbnail": "https://i.ytimg.com/vi/YVkUvmDQ3HY/hqdefault.jpg" },
    { "id": "tvTRZJ-4EyI", "title": "HUMBLE.", "artist": "Kendrick Lamar", "duration": "2:57", "thumbnail": "https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg" },
    { "id": "uxpDa-c-4Mc", "title": "Hotline Bling", "artist": "Drake", "duration": "4:27", "thumbnail": "https://i.ytimg.com/vi/uxpDa-c-4Mc/hqdefault.jpg" },
    { "id": "UceaB4D0jpo", "title": "God's Plan", "artist": "Drake", "duration": "3:19", "thumbnail": "https://i.ytimg.com/vi/UceaB4D0jpo/hqdefault.jpg" },
    { "id": "eJO5HU_7_1w", "title": "The Real Slim Shady", "artist": "Eminem", "duration": "4:44", "thumbnail": "https://i.ytimg.com/vi/eJO5HU_7_1w/hqdefault.jpg" },
    { "id": "71GVxWpWfH8", "title": "Lucid Dreams", "artist": "Juice WRLD", "duration": "3:59", "thumbnail": "https://i.ytimg.com/vi/71GVxWpWfH8/hqdefault.jpg" }
  ],
  "chill": [
    { "id": "5qap5aO4i9A", "title": "Lofi Hip Hop Radio - Beats to Relax/Study to", "artist": "Lofi Girl", "duration": "Live", "thumbnail": "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg" },
    { "id": "DWcJFNfaw9c", "title": "Daylight", "artist": "David Kushner", "duration": "3:32", "thumbnail": "https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg" },
    { "id": "hN5X4kGhAtU", "title": "Until I Found You", "artist": "Stephen Sanchez", "duration": "2:57", "thumbnail": "https://i.ytimg.com/vi/hN5X4kGhAtU/hqdefault.jpg" },
    { "id": "ilNt2bikxUE", "title": "golden hour", "artist": "JVKE", "duration": "3:29", "thumbnail": "https://i.ytimg.com/vi/ilNt2bikxUE/hqdefault.jpg" },
    { "id": "RgKAFK5djSk", "title": "See You Again", "artist": "Wiz Khalifa ft. Charlie Puth", "duration": "3:50", "thumbnail": "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg" }
  ],
  "rock": [
    { "id": "fJ9rUzIMcZQ", "title": "Bohemian Rhapsody", "artist": "Queen", "duration": "5:55", "thumbnail": "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg" },
    { "id": "kXYiU_JCYtU", "title": "Numb", "artist": "Linkin Park", "duration": "3:07", "thumbnail": "https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg" },
    { "id": "eVTXPUF4Oz4", "title": "In The End", "artist": "Linkin Park", "duration": "3:36", "thumbnail": "https://i.ytimg.com/vi/eVTXPUF4Oz4/hqdefault.jpg" },
    { "id": "1w7OgIMMRc4", "title": "Sweet Child O' Mine", "artist": "Guns N' Roses", "duration": "5:03", "thumbnail": "https://i.ytimg.com/vi/1w7OgIMMRc4/hqdefault.jpg" },
    { "id": "hTWKbfoikeg", "title": "Smells Like Teen Spirit", "artist": "Nirvana", "duration": "4:38", "thumbnail": "https://i.ytimg.com/vi/hTWKbfoikeg/hqdefault.jpg" }
  ],
  "bollywood": [
    { "id": "Umqb9KENgmk", "title": "Kesariya", "artist": "Arijit Singh, Pritam", "duration": "4:28", "thumbnail": "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg" },
    { "id": "BddP6PYo2gs", "title": "Apna Bana Le", "artist": "Arijit Singh, Sachin-Jigar", "duration": "4:21", "thumbnail": "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg" },
    { "id": "YxWlaYCA8MU", "title": "Tum Hi Ho", "artist": "Arijit Singh, Mithoon", "duration": "4:22", "thumbnail": "https://i.ytimg.com/vi/YxWlaYCA8MU/hqdefault.jpg" },
    { "id": "V7LwfY5U5WI", "title": "Channa Mereya", "artist": "Arijit Singh, Pritam", "duration": "4:49", "thumbnail": "https://i.ytimg.com/vi/V7LwfY5U5WI/hqdefault.jpg" },
    { "id": "k4yXQkGIf5s", "title": "Heeriye", "artist": "Jasleen Royal, Arijit Singh", "duration": "3:14", "thumbnail": "https://i.ytimg.com/vi/k4yXQkGIf5s/hqdefault.jpg" }
  ]
}
'@

# -------------------------------------------------------------
# High-Speed Multi-Threaded C# Server & LAN Bridge
# -------------------------------------------------------------
$csharpSource = @"
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

public class TrackItem {
    public string id { get; set; }
    public string title { get; set; }
    public string artist { get; set; }
    public string duration { get; set; }
    public string thumbnail { get; set; }
}

public class LanBridge {
    private TcpListener _listener;
    private int _targetPort;
    private bool _running;

    public void Start(int listenPort, int targetPort) {
        _targetPort = targetPort;
        _listener = new TcpListener(IPAddress.Any, listenPort);
        _listener.Start();
        _running = true;
        ThreadPool.QueueUserWorkItem(_ => AcceptLoop());
    }

    private void AcceptLoop() {
        while (_running) {
            try {
                var client = _listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(state => BridgeClient((TcpClient)state), client);
            } catch {}
        }
    }

    private void BridgeClient(TcpClient client) {
        try {
            using (client)
            using (var server = new TcpClient("127.0.0.1", _targetPort))
            using (var clientStream = client.GetStream())
            using (var serverStream = server.GetStream()) {
                var t1 = Task.Run(() => clientStream.CopyTo(serverStream));
                var t2 = Task.Run(() => serverStream.CopyTo(clientStream));
                Task.WaitAny(t1, t2);
            }
        } catch {}
    }

    public void Stop() {
        _running = false;
        try { _listener.Stop(); } catch {}
    }
}

public class MuzoEngineServer {
    private HttpListener _listener;
    private bool _running;
    private string _publicDir;
    private string _lanIp;
    private int _publicPort;
    private Dictionary<string, object> _curated;
    private JavaScriptSerializer _js = new JavaScriptSerializer();

    public ConcurrentDictionary<string, string> SearchCache = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    public ConcurrentDictionary<string, string> LyricsCache = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    public ConcurrentDictionary<string, string> RecCache = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);

    public MuzoEngineServer(string publicDir, string curatedJson, string lanIp, int publicPort) {
        _publicDir = publicDir;
        _lanIp = lanIp;
        _publicPort = publicPort;
        try {
            _curated = (Dictionary<string, object>)_js.DeserializeObject(curatedJson);
        } catch {
            _curated = new Dictionary<string, object>();
        }
    }

    public void Start(int internalPort) {
        _listener = new HttpListener();
        _listener.Prefixes.Add("http://localhost:" + internalPort + "/");
        _listener.Prefixes.Add("http://127.0.0.1:" + internalPort + "/");
        _listener.Start();
        _running = true;

        ThreadPool.QueueUserWorkItem(_ => ListenLoop());
        ThreadPool.QueueUserWorkItem(_ => {
            try {
                Thread.Sleep(800);
                var pre = new string[] { "trending hits", "anime songs", "lofi chill", "pop hits", "coldplay", "taylor swift", "the weeknd", "arijit singh" };
                foreach (var q in pre) {
                    try { SearchFast(q); } catch {}
                }
            } catch {}
        });
    }

    private void ListenLoop() {
        while (_running && _listener.IsListening) {
            try {
                var ctx = _listener.GetContext();
                ThreadPool.QueueUserWorkItem(state => ProcessRequest((HttpListenerContext)state), ctx);
            } catch {}
        }
    }

    private void ProcessRequest(HttpListenerContext ctx) {
        try {
            var req = ctx.Request;
            var res = ctx.Response;

            res.AddHeader("Access-Control-Allow-Origin", "*");
            res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
            res.AddHeader("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS") {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            var path = req.Url.AbsolutePath;
            var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);

            if (path == "/api/network-info") {
                var netInfo = new Dictionary<string, object> {
                    { "lanIp", _lanIp },
                    { "port", _publicPort },
                    { "mobileUrl", "http://" + _lanIp + ":" + _publicPort }
                };
                SendJson(res, _js.Serialize(netInfo));
                return;
            }

            if (path == "/api/search") {
                var q = query["q"];
                if (string.IsNullOrWhiteSpace(q)) q = "top hits";
                var results = SearchFast(q);
                SendJson(res, results);
                return;
            }

            if (path == "/api/recommendations") {
                var seed = query["seed"];
                if (string.IsNullOrWhiteSpace(seed)) seed = "chill pop anime hits";
                var cacheKey = "rec_" + seed.ToLowerInvariant().Trim();
                string json;
                if (!RecCache.TryGetValue(cacheKey, out json)) {
                    json = SearchFast(seed + " mix");
                    RecCache[cacheKey] = json;
                }
                SendJson(res, json);
                return;
            }

            if (path == "/api/charts") {
                var cat = query["category"];
                if (string.IsNullOrWhiteSpace(cat) || !_curated.ContainsKey(cat)) {
                    cat = "trending";
                }
                var obj = _curated.ContainsKey(cat) ? _curated[cat] : new object[0];
                SendJson(res, _js.Serialize(obj));
                return;
            }

            if (path == "/api/lyrics") {
                var title = query["title"] ?? "";
                var artist = query["artist"] ?? "";
                var lyrJson = GetLyrics(title, artist);
                SendJson(res, lyrJson);
                return;
            }

            if (path == "/api/suggestions") {
                var q = query["q"] ?? "";
                var sugJson = GetSuggestions(q);
                SendJson(res, sugJson);
                return;
            }

            ServeStatic(ctx, path);
        } catch {
            try {
                ctx.Response.StatusCode = 500;
                ctx.Response.Close();
            } catch {}
        }
    }

    public string SearchFast(string query) {
        var key = query.ToLowerInvariant().Trim();
        string cached;
        if (SearchCache.TryGetValue(key, out cached)) {
            return cached;
        }

        // Check if query matches a curated category
        if (_curated.ContainsKey(key)) {
            var curJson = _js.Serialize(_curated[key]);
            SearchCache[key] = curJson;
            return curJson;
        }

        var tracks = SearchInnertube(query);
        if (tracks.Count == 0) {
            // Fallback to trending
            if (_curated.ContainsKey("trending")) {
                var fallbackJson = _js.Serialize(_curated["trending"]);
                SearchCache[key] = fallbackJson;
                return fallbackJson;
            }
        }

        var json = _js.Serialize(tracks);
        SearchCache[key] = json;
        return json;
    }

    private List<TrackItem> SearchInnertube(string query) {
        string jsonBody = "{\"context\":{\"client\":{\"clientName\":\"WEB\",\"clientVersion\":\"2.20240101.01.00\",\"hl\":\"en\",\"gl\":\"US\"}},\"query\":\"" + EscapeJson(query) + " audio\"}";
        var psi = new ProcessStartInfo {
            FileName = "curl.exe",
            Arguments = "-s --compressed --max-time 5 -X POST -H \"Content-Type: application/json\" --data-binary @- \"https://www.youtube.com/youtubei/v1/search?prettyPrint=false\"",
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8
        };

        string raw = "";
        try {
            using (var proc = Process.Start(psi)) {
                using (var sw = proc.StandardInput) {
                    sw.Write(jsonBody);
                    sw.Flush();
                }
                raw = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit(6000);
            }
        } catch {}

        var list = new List<TrackItem>();
        if (string.IsNullOrEmpty(raw)) return list;

        var matches = Regex.Matches(raw, "\"videoRenderer\":\\{(.+?)\"trackingParams\"", RegexOptions.Singleline);
        var seen = new HashSet<string>();

        foreach (Match m in matches) {
            var block = m.Groups[1].Value;
            var idM = Regex.Match(block, "\"videoId\":\"([a-zA-Z0-9_-]{11})\"");
            if (!idM.Success) continue;
            var id = idM.Groups[1].Value;
            if (seen.Contains(id)) continue;
            seen.Add(id);

            var title = "";
            var titleM = Regex.Match(block, "\"title\":\\{\"runs\":\\[\\{\"text\":\"(.*?)\"");
            if (titleM.Success) {
                title = Regex.Unescape(titleM.Groups[1].Value);
            } else {
                var simpleTitleM = Regex.Match(block, "\"title\":\\{\"simpleText\":\"(.*?)\"");
                if (simpleTitleM.Success) title = Regex.Unescape(simpleTitleM.Groups[1].Value);
            }
            if (string.IsNullOrEmpty(title)) title = "Track (" + id + ")";

            var artist = "Popular Music";
            var artistM = Regex.Match(block, "\"ownerText\":\\{\"runs\":\\[\\{\"text\":\"(.*?)\"");
            if (artistM.Success) artist = Regex.Unescape(artistM.Groups[1].Value);

            var duration = "3:30";
            var durM = Regex.Match(block, "\"lengthText\":\\{\"simpleText\":\"(.*?)\"");
            if (durM.Success) duration = durM.Groups[1].Value;

            list.Add(new TrackItem {
                id = id,
                title = CleanTitle(title),
                artist = artist,
                duration = duration,
                thumbnail = "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"
            });

            if (list.Count >= 20) break;
        }

        // Secondary fallback
        if (list.Count == 0) {
            var rawIds = Regex.Matches(raw, "\"videoId\":\"([a-zA-Z0-9_-]{11})\"");
            foreach (Match rm in rawIds) {
                var vid = rm.Groups[1].Value;
                if (!seen.Contains(vid)) {
                    seen.Add(vid);
                    list.Add(new TrackItem {
                        id = vid,
                        title = query,
                        artist = "Popular Artist",
                        duration = "3:30",
                        thumbnail = "https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg"
                    });
                    if (list.Count >= 8) break;
                }
            }
        }

        return list;
    }

    private string GetLyrics(string title, string artist) {
        var key = (title + " - " + artist).ToLowerInvariant().Trim();
        string cached;
        if (LyricsCache.TryGetValue(key, out cached)) {
            return cached;
        }

        var clean = CleanTitle(title);
        var encTitle = System.Web.HttpUtility.UrlEncode(clean);
        var encArtist = System.Web.HttpUtility.UrlEncode(artist);

        string res = "{\"found\":false,\"syncedLyrics\":null,\"plainLyrics\":\"Lyrics not available.\"}";

        try {
            var psi = new ProcessStartInfo {
                FileName = "curl.exe",
                Arguments = "-s --compressed --max-time 2 \"https://lrclib.net/api/get?track_name=" + encTitle + "&artist_name=" + encArtist + "\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8
            };
            using (var p = Process.Start(psi)) {
                var outStr = p.StandardOutput.ReadToEnd();
                p.WaitForExit(2500);
                if (!string.IsNullOrEmpty(outStr) && outStr.Contains("plainLyrics")) {
                    res = outStr;
                }
            }
        } catch {}

        LyricsCache[key] = res;
        return res;
    }

    private string GetSuggestions(string query) {
        if (string.IsNullOrWhiteSpace(query)) return "[]";
        try {
            var enc = System.Web.HttpUtility.UrlEncode(query);
            var psi = new ProcessStartInfo {
                FileName = "curl.exe",
                Arguments = "-s --max-time 2 \"https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=" + enc + "\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8
            };
            using (var p = Process.Start(psi)) {
                var outStr = p.StandardOutput.ReadToEnd();
                p.WaitForExit(2200);
                if (!string.IsNullOrEmpty(outStr)) {
                    var arr = (object[])_js.DeserializeObject(outStr);
                    if (arr.Length > 1) {
                        return _js.Serialize(arr[1]);
                    }
                }
            }
        } catch {}
        return "[]";
    }

    private void ServeStatic(HttpListenerContext ctx, string path) {
        var res = ctx.Response;
        if (string.IsNullOrEmpty(path) || path == "/") path = "/index.html";

        var localPath = Path.Combine(_publicDir, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        if (File.Exists(localPath)) {
            var ext = Path.GetExtension(localPath).ToLowerInvariant();
            res.ContentType = GetMimeType(ext);
            res.AddHeader("Cache-Control", "no-cache");
            var bytes = File.ReadAllBytes(localPath);
            res.ContentLength64 = bytes.Length;
            res.StatusCode = 200;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        } else {
            res.StatusCode = 404;
            var buf = Encoding.UTF8.GetBytes("404 Not Found");
            res.OutputStream.Write(buf, 0, buf.Length);
            res.Close();
        }
    }

    private void SendJson(HttpListenerResponse res, string json) {
        var bytes = Encoding.UTF8.GetBytes(json);
        res.ContentType = "application/json; charset=utf-8";
        res.ContentLength64 = bytes.Length;
        res.StatusCode = 200;
        res.OutputStream.Write(bytes, 0, bytes.Length);
        res.Close();
    }

    public static string CleanTitle(string title) {
        if (string.IsNullOrEmpty(title)) return "";
        title = Regex.Replace(title, @"(?i)\(Official\s+(Music\s+)?Video\)", "");
        title = Regex.Replace(title, @"(?i)\[Official\s+(Music\s+)?Video\]", "");
        title = Regex.Replace(title, @"(?i)\(Official\s+Audio\)", "");
        title = Regex.Replace(title, @"(?i)\[Official\s+Audio\]", "");
        title = Regex.Replace(title, @"(?i)\(Audio\)", "");
        title = Regex.Replace(title, @"(?i)\[Audio\]", "");
        title = Regex.Replace(title, @"(?i)\(Lyric\s+Video\)", "");
        title = Regex.Replace(title, @"(?i)\[Lyric\s+Video\]", "");
        title = Regex.Replace(title, @"(?i)\(Lyrics\)", "");
        title = Regex.Replace(title, @"(?i)\[Lyrics\]", "");
        title = Regex.Replace(title, @"(?i)\(Visualizer\)", "");
        title = Regex.Replace(title, @"(?i)\[Visualizer\]", "");
        title = Regex.Replace(title, @"(?i)\(Official\s+HD\s+Video\)", "");
        title = Regex.Replace(title, @"(?i)\(4K\)", "");
        title = Regex.Replace(title, @"(?i)\[4K\]", "");
        title = Regex.Replace(title, @"(?i)\(HQ\)", "");
        title = Regex.Replace(title, @"(?i)\[HQ\]", "");
        title = Regex.Replace(title, @"(?i)\(Remastered\)", "");
        return title.Trim();
    }

    private static string EscapeJson(string s) {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }

    private string GetMimeType(string ext) {
        switch (ext) {
            case ".html": case ".htm": return "text/html; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".js": return "application/javascript; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".png": return "image/png";
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".svg": return "image/svg+xml";
            case ".ico": return "image/x-icon";
            case ".mp3": return "audio/mpeg";
            case ".woff": return "font/woff";
            case ".woff2": return "font/woff2";
            default: return "application/octet-stream";
        }
    }

    public void Stop() {
        _running = false;
        try { _listener.Stop(); } catch {}
    }
}
"@

Add-Type -TypeDefinition $csharpSource -ReferencedAssemblies "System.Web.dll", "System.Web.Extensions.dll"

$InternalPort = $Port + 1
$Server = New-Object MuzoEngineServer($PublicDir, $CuratedJson, $LanIP, $Port)
$Bridge = New-Object LanBridge

try {
    $Server.Start($InternalPort)
    $Bridge.Start($Port, $InternalPort)
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host " 🚀 Muzo Multi-Device Music Server Running!     " -ForegroundColor Cyan
    Write-Host " PC URL:        http://localhost:$Port          " -ForegroundColor Yellow
    Write-Host " Mobile / LAN:  http://${LanIP}:${Port}         " -ForegroundColor Green
    Write-Host " Ultra-Fast Multi-Threaded Engine Active (<100ms)" -ForegroundColor DarkCyan
    Write-Host " Ready for iPhone, Android, iPad & other devices " -ForegroundColor DarkGray
    Write-Host "=================================================" -ForegroundColor Green
} catch {
    Write-Error "Failed to start server on port $Port : $($_.Exception.Message)"
    exit 1
}

# Keep alive loop
try {
    while ($true) {
        Start-Sleep -Seconds 2
    }
} finally {
    $Bridge.Stop()
    $Server.Stop()
}
