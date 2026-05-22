import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import cors from "cors";

// Version bump to trigger AI Studio share prompt
const app = express();
app.use(express.json());

// Permit requests from external domains like Vercel deployments
app.use(cors());

const PORT = 3000;

// In-memory caches to speed up and reduce third party load
let kmbRoutesCache: any[] | null = null;
let lastKmbRoutesFetch: number = 0;
const stopCache = new Map<string, { name_tc: string; name_en: string; lat: number; long: number }>();

// Helper to fetch KMB routes
async function getKmbRoutes() {
  const now = Date.now();
  // Cache for 1 day
  if (kmbRoutesCache && now - lastKmbRoutesFetch < 24 * 60 * 60 * 1000) {
    return kmbRoutesCache;
  }

  try {
    console.log("Fetching KMB Route definition list from Data.gov.hk...");
    const response = await fetch("https://data.etabus.gov.hk/v1/transport/kmb/route/");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const json = await response.json();
    if (json && Array.isArray(json.data)) {
      kmbRoutesCache = json.data;
      lastKmbRoutesFetch = now;
      console.log(`Successfully cached ${kmbRoutesCache?.length} KMB routes.`);
      return kmbRoutesCache;
    }
  } catch (error) {
    console.error("Error fetching KMB routes:", error);
    if (kmbRoutesCache) return kmbRoutesCache; // Use stale cache on error
  }
  return [];
}

// Fetch single stop info
async function getStopInfo(stopId: string) {
  if (stopCache.has(stopId)) {
    return stopCache.get(stopId)!;
  }

  try {
    const response = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop/${stopId}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const json = await response.json();
    if (json && json.data) {
      const stopData = {
        name_tc: json.data.name_tc || "未知車站",
        name_en: json.data.name_en || "Unknown Stop",
        lat: parseFloat(json.data.lat) || 0,
        long: parseFloat(json.data.long) || 0
      };
      stopCache.set(stopId, stopData);
      return stopData;
    }
  } catch (err) {
    console.error(`Error fetching stop ${stopId}:`, err);
  }

  return { name_tc: "未知車站", name_en: "Unknown Stop", lat: 0, long: 0 };
}

// -------------------------
// SERVER API ROUTES
// -------------------------

// 1. KMB Route Search
app.get("/api/kmb/routes", async (req, res) => {
  try {
    const search = (req.query.q as string || "").trim().toLowerCase();
    const allRoutes = await getKmbRoutes();

    if (!search) {
      // Just return top 40 routes
      return res.json({ status: "ok", data: allRoutes.slice(0, 40) });
    }

    // Filter matching route codes
    const matches = allRoutes.filter((r: any) => 
      r.route.toLowerCase().includes(search)
    );

    // Sort to prioritize routes starting with or strictly equal to search query
    matches.sort((a: any, b: any) => {
      const aLower = a.route.toLowerCase();
      const bLower = b.route.toLowerCase();
      if (aLower === search && bLower !== search) return -1;
      if (bLower === search && aLower !== search) return 1;
      if (aLower.startsWith(search) && !bLower.startsWith(search)) return -1;
      if (bLower.startsWith(search) && !aLower.startsWith(search)) return 1;
      return aLower.localeCompare(bLower, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json({ status: "ok", data: matches.slice(0, 60) });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// 2. KMB Route Stops (Resolves names using server cache)
app.get("/api/kmb/route-stops", async (req, res) => {
  try {
    const { route, bound, service_type } = req.query;
    if (!route || !bound || !service_type) {
      return res.status(400).json({ status: "error", message: "Missing required parameters (route, bound, service_type)" });
    }

    const direction = bound === "O" ? "outbound" : bound === "I" ? "inbound" : bound;

    const url = `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${route}/${direction}/${service_type}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch stops for ${route} (${direction})`);
    
    const json = await response.json();
    const rawStops = json.data || [];

    // Fetch and resolve stop names/coordinates in parallel (throttled/cached)
    const resolvedStops = await Promise.all(
      rawStops.map(async (stopItem: any) => {
        const info = await getStopInfo(stopItem.stop);
        return {
          seq: stopItem.seq,
          stop: stopItem.stop,
          name_tc: info.name_tc,
          name_en: info.name_en,
          lat: info.lat,
          long: info.long
        };
      })
    );

    res.json({ status: "ok", data: resolvedStops });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// 3. KMB ETA Proxy
app.get("/api/kmb/eta", async (req, res) => {
  try {
    const { stop_id, route, service_type } = req.query;
    if (!stop_id) {
      return res.status(400).json({ status: "error", message: "Missing stop_id" });
    }

    let url = "";
    if (route && service_type) {
      url = `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stop_id}/${route}/${service_type}`;
    } else {
      url = `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stop_id}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch ETA from KMB");
    const json = await response.json();
    res.json({ status: "ok", data: json.data || [] });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// 4. MTR Schedule Proxy
app.get("/api/mtr/schedule", async (req, res) => {
  try {
    const { line, station } = req.query;
    if (!line || !station) {
      return res.status(400).json({ status: "error", message: "Missing parameters (line and station codes)" });
    }

    const url = `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${line}&sta=${station}&lang=zh`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch MTR schedule");
    
    const json = await response.json();
    res.json({ status: "ok", ...json });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// -------------------------
// REUSABLE SYNC STORAGE & ACTIONS
// -------------------------
const SYNC_FILE_PATH = path.join(process.cwd(), "syncStore.json");
let syncStore: Record<string, { bookmarks: any[]; updatedAt: number }> = {};

// Load existing sync data on startup
try {
  if (fs.existsSync(SYNC_FILE_PATH)) {
    const raw = fs.readFileSync(SYNC_FILE_PATH, "utf8");
    syncStore = JSON.parse(raw);
    console.log(`[Sync] Loaded ${Object.keys(syncStore).length} sync codes from file.`);
  }
} catch (err) {
  console.error("[Sync] Error loading syncStore.json:", err);
}

function saveSyncStore() {
  try {
    fs.writeFileSync(SYNC_FILE_PATH, JSON.stringify(syncStore, null, 2), "utf8");
  } catch (err) {
    console.error("[Sync] Error saving syncStore.json:", err);
  }
}

function generateSyncCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Easy to read uppercase chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (syncStore[code]) return generateSyncCode(); // Collision safety
  return code;
}

// Create new sync code with initial bookmarks
app.post("/api/sync/create", (req, res) => {
  try {
    const { bookmarks } = req.body;
    if (!Array.isArray(bookmarks)) {
      return res.status(400).json({ status: "error", message: "Invalid bookmarks list" });
    }
    const code = generateSyncCode();
    syncStore[code] = {
      bookmarks,
      updatedAt: Date.now()
    };
    saveSyncStore();
    console.log(`[Sync] Created new sync code: ${code} with ${bookmarks.length} bookmarks`);
    res.json({ status: "ok", code });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Fetch bookmarks by sync code
app.get("/api/sync/get/:code", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toUpperCase();
    if (!code || !syncStore[code]) {
      return res.status(404).json({ status: "error", message: "找不到此同步碼，請確認無誤" });
    }
    res.json({ status: "ok", bookmarks: syncStore[code].bookmarks, updatedAt: syncStore[code].updatedAt });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Update bookmarks for existing sync code
app.post("/api/sync/update", (req, res) => {
  try {
    const { code, bookmarks } = req.body;
    const cleanCode = (code || "").trim().toUpperCase();
    if (!cleanCode || !syncStore[cleanCode]) {
      return res.status(404).json({ status: "error", message: "找不到指定的同步碼" });
    }
    if (!Array.isArray(bookmarks)) {
      return res.status(400).json({ status: "error", message: "Invalid bookmarks list" });
    }
    syncStore[cleanCode] = {
      bookmarks,
      updatedAt: Date.now()
    };
    saveSyncStore();
    console.log(`[Sync] Updated bookmarks for sync code ${cleanCode}, size: ${bookmarks.length}`);
    res.json({ status: "ok" });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// -------------------------
// EXPRESS SETUP + VITE MIDDLEWARE
// -------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[HK Transit] Server running on http://0.0.0.0:${PORT}`);
    // Pre-seed KMB route cache asynchronously to ensure first searches are warm!
    getKmbRoutes().then(() => {
      console.log("KMB routes pre-cached successfully.");
    });
  });
}

startServer();
