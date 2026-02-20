const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;

// API keys from environment variables (never exposed to client)
const WU_API_KEY = process.env.WU_API_KEY || "";
const TEMPEST_TOKEN = process.env.TEMPEST_TOKEN || "";

// Station defaults per city (server-side, keys stay hidden)
const STATION_DEFAULTS = {
  "Milano": { tempest: "195317", wu: ["IMILAN5976"] },
  "Bormio": { wu: ["IGROSI31", "ISONDA1"] },
  "Torino": { wu: ["ITURIN3276", "ITURIN3266"] },
  "Boston": { wu: ["KMABOSTO391"] }
};

function proxyGet(targetUrl, res, maxRedirects) {
  if(maxRedirects===undefined)maxRedirects=3;
  var parsed = url.parse(targetUrl);
  var options = {
    hostname: parsed.hostname,
    path: parsed.path,
    headers: {
      "User-Agent": "PantaMeteo/1.0 (weather dashboard; contact: pantameteo@example.com)",
      "Accept": "application/json"
    }
  };
  console.log("Proxy GET:", parsed.hostname, parsed.path.substring(0,80));
  https.get(options, function(proxyRes) {
    // Follow redirects
    if((proxyRes.statusCode===301||proxyRes.statusCode===302||proxyRes.statusCode===307)&&proxyRes.headers.location&&maxRedirects>0){
      console.log("Proxy redirect:",proxyRes.statusCode,"->",proxyRes.headers.location);
      proxyGet(proxyRes.headers.location,res,maxRedirects-1);
      return;
    }
    let body = "";
    proxyRes.on("data", function(chunk) { body += chunk; });
    proxyRes.on("end", function() {
      console.log("Proxy response:", proxyRes.statusCode, "len=" + body.length, body.substring(0, 300));
      // Handle 204 No Content
      if (proxyRes.statusCode === 204 || !body.trim()) {
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end("[]");
        return;
      }
      res.writeHead(proxyRes.statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(body);
    });
  }).on("error", function(e) {
    console.error("Proxy error:", e.message);
    res.writeHead(502, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: e.message }));
  });
}

const server = http.createServer(function(req, res) {
  const parsed = url.parse(req.url, true);

  // Version check endpoint (for PWA auto-update)
  if (parsed.pathname === "/api/version") {
    var indexPath = path.join(__dirname, "index.html");
    try {
      var stat = fs.statSync(indexPath);
      var ver = stat.mtimeMs.toString();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      });
      res.end(JSON.stringify({ version: ver }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Station config endpoint — tells client which stations are available (no keys exposed)
  if (parsed.pathname === "/api/stations") {
    var city = parsed.query.city || "";
    var def = STATION_DEFAULTS[city] || {};
    var result = {
      tempest: def.tempest && TEMPEST_TOKEN ? def.tempest : null,
      wu: def.wu && WU_API_KEY ? def.wu : null
    };
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(result));
    return;
  }

  // Tempest proxy — token stays server-side
  if (parsed.pathname === "/api/tempest") {
    var staId = parsed.query.stationId || "";
    if (!staId || !TEMPEST_TOKEN) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "stationId required and TEMPEST_TOKEN must be configured" }));
      return;
    }
    proxyGet("https://swd.weatherflow.com/swd/rest/observations/station/" + encodeURIComponent(staId) + "?token=" + encodeURIComponent(TEMPEST_TOKEN), res);
    return;
  }

  // Tempest forecast proxy
  if (parsed.pathname === "/api/tempest-forecast") {
    var staId = parsed.query.stationId || "";
    if (!staId || !TEMPEST_TOKEN) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "stationId required and TEMPEST_TOKEN must be configured" }));
      return;
    }
    proxyGet("https://swd.weatherflow.com/swd/rest/better_forecast?station_id=" + encodeURIComponent(staId) + "&token=" + encodeURIComponent(TEMPEST_TOKEN) + "&units_temp=c&units_wind=kph&units_pressure=mb&units_precip=mm", res);
    return;
  }

  // METAR proxy
  if (parsed.pathname === "/api/metar") {
    var ids = parsed.query.ids || "LIML";
    proxyGet("https://aviationweather.gov/api/data/metar?ids=" + encodeURIComponent(ids) + "&format=json", res);
    return;
  }

  // METAR debug endpoint
  if (parsed.pathname === "/api/metar-debug") {
    var ids = parsed.query.ids || "LIML";
    var targetUrl = "https://aviationweather.gov/api/data/metar?ids=" + encodeURIComponent(ids) + "&format=json";
    var parsedUrl = url.parse(targetUrl);
    var options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      headers: {
        "User-Agent": "PantaMeteo/1.0 (weather dashboard; contact: pantameteo@example.com)",
        "Accept": "application/json"
      }
    };
    https.get(options, function(proxyRes) {
      let body = "";
      proxyRes.on("data", function(chunk) { body += chunk; });
      proxyRes.on("end", function() {
        var debug = {
          requestUrl: targetUrl,
          statusCode: proxyRes.statusCode,
          headers: proxyRes.headers,
          bodyLength: body.length,
          bodyPreview: body.substring(0, 1000),
          bodyIsArray: false,
          bodyIsObject: false
        };
        try {
          var j = JSON.parse(body);
          debug.bodyIsArray = Array.isArray(j);
          debug.bodyIsObject = typeof j === "object" && !Array.isArray(j);
          if (Array.isArray(j) && j.length > 0) debug.firstItem = Object.keys(j[0]);
          if (debug.bodyIsObject) debug.topKeys = Object.keys(j);
        } catch(e) { debug.parseError = e.message; }
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(debug, null, 2));
      });
    }).on("error", function(e) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  // Weather Underground PWS proxy — API key stays server-side
  if (parsed.pathname === "/api/wu") {
    var staId = parsed.query.stationId || "";
    if (!staId || !WU_API_KEY) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: "stationId required and WU_API_KEY must be configured" }));
      return;
    }
    proxyGet("https://api.weather.com/v2/pws/observations/current?stationId=" + encodeURIComponent(staId) + "&format=json&units=m&apiKey=" + encodeURIComponent(WU_API_KEY), res);
    return;
  }

  // Static files
  let filePath = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".md": "text/markdown; charset=utf-8"
  };

  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[ext] || "text/html",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  });
});

server.listen(PORT, function() {
  console.log("PantaMeteo running on port " + PORT);
  console.log("  WU_API_KEY:", WU_API_KEY ? "configured (" + WU_API_KEY.substring(0,8) + "...)" : "NOT SET");
  console.log("  TEMPEST_TOKEN:", TEMPEST_TOKEN ? "configured (" + TEMPEST_TOKEN.substring(0,8) + "...)" : "NOT SET");
  console.log("  Station defaults:", JSON.stringify(STATION_DEFAULTS));
});
