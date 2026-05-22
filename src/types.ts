export interface Bookmark {
  id: string; // e.g., 'kmb-1A-O-1-BS01-stopCode' or 'mtr-KTL-WHA-UP'
  type: "kmb" | "mtr";
  title: string;       // "1A 往 尖沙咀碼頭" or "九龍灣"
  subtitle: string;    // "創紀之城" or "觀塘綫"
  createdAt: number;

  // KMB properties
  route?: string;
  bound?: "O" | "I";
  serviceType?: string;
  stopId?: string;
  stopNameTc?: string;
  stopNameEn?: string;

  // MTR properties
  lineCode?: string;
  stationCode?: string;
  direction?: "UP" | "DOWN" | "BOTH";
}

export interface KmbRoute {
  route: string;
  bound: "O" | "I";
  service_type: string;
  orig_tc: string;
  dest_tc: string;
  orig_en: string;
  dest_en: string;
}

export interface KmbStop {
  seq: number;
  stop: string;
  name_tc: string;
  name_en: string;
  lat: number;
  long: number;
}

export interface KmbEta {
  co: string;
  route: string;
  dir: string;
  service_type: number;
  seq: number;
  dest_tc: string;
  dest_en: string;
  eta_seq: number;
  eta: string | null; // ISO Date String, can be null
  rmk_tc: string;
  rmk_en: string;
  data_timestamp: string;
}

export interface MtrScheduleItem {
  seq: string;
  time: string; // YYYY-MM-DD HH:MM:SS
  dest: string; // Destination Station Code
  plat: string; // Platform number
  ttbl: string;
  valid: string;
}

export interface MtrScheduleResponse {
  status: number;
  message: string;
  curr_time: string; // YYYY-MM-DD HH:MM:SS
  isdelay: "Y" | "N";
  data: {
    [stationLineCode: string]: {
      UP?: MtrScheduleItem[];
      DOWN?: MtrScheduleItem[];
    };
  };
}

export async function safeJsonParse(resp: Response): Promise<any> {
  const contentType = resp.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await resp.text();
    console.warn("Expected JSON but received non-JSON content. Length:", text.length, "First 200 chars:", text.slice(0, 200));
    throw new Error("伺服器正在啟動中或回應格式不正確，請重新整理或稍作等待再試");
  }
  try {
    return await resp.json();
  } catch (err) {
    console.error("JSON parsing error:", err);
    throw new Error("解析伺服器數據失敗，請稍後重試");
  }
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return cleanPath;
  }
  
  // Custom API endpoint stored in localStorage
  const storedApiUrl = localStorage.getItem("hk_transit_api_base_url");
  if (storedApiUrl) {
    return `${storedApiUrl.replace(/\/$/, "")}${cleanPath}`;
  }

  const host = window.location.hostname;
  if (
    host === "localhost" || 
    host === "127.0.0.1" || 
    host.includes("run.app") || 
    host.includes("webcontainer.io")
  ) {
    return cleanPath;
  }
  // Default to shared server URL (PRE) which is public and accessible by external domains like Vercel without AI Studio login cookies
  return `https://ais-pre-jpvkv3zthkbit3hwb6lbhf-179377875007.us-east1.run.app${cleanPath}`;
}

// Global/local client-side cache managers for serverless direct-to-API mode (Vercel)
let localRoutesCache: any[] | null = null;
const localStopCache = new Map<string, any>();

// Initialize stop cache from localStorage if available
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("hk_transit_client_stop_cache_v5");
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([k, v]) => localStopCache.set(k, v));
    }
  } catch (e) {
    console.error("Failed to read stop cache from localStorage:", e);
  }
}

function saveStopCacheToLocalStorage() {
  try {
    const obj: Record<string, any> = {};
    localStopCache.forEach((v, k) => {
      obj[k] = v;
    });
    // Cap localStorage size to prevent QuotaExceededError (keeps last 500 entries)
    if (Object.keys(obj).length > 500) {
      const keys = Object.keys(obj).slice(-300); // keep most recent 300
      const trimmedObj: Record<string, any> = {};
      keys.forEach((k) => { trimmedObj[k] = obj[k]; });
      localStorage.setItem("hk_transit_client_stop_cache_v5", JSON.stringify(trimmedObj));
    } else {
      localStorage.setItem("hk_transit_client_stop_cache_v5", JSON.stringify(obj));
    }
  } catch (e) {
    console.warn("Failed to save stop cache to localStorage:", e);
  }
}

async function getClientKmbRoutes(): Promise<any[]> {
  if (localRoutesCache) return localRoutesCache;
  
  try {
    const stored = localStorage.getItem("hk_transit_client_routes_cache_v5");
    if (stored) {
      const parsed = JSON.parse(stored);
      // cache for 1 day
      if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        localRoutesCache = parsed.data;
        return localRoutesCache!;
      }
    }
  } catch (e) {
    console.error("Failed to read routes from local storage:", e);
  }

  try {
    const resp = await fetch("https://data.etabus.gov.hk/v1/transport/kmb/route/");
    const json = await resp.json();
    if (json && Array.isArray(json.data)) {
      localRoutesCache = json.data;
      try {
        localStorage.setItem("hk_transit_client_routes_cache_v5", JSON.stringify({
          timestamp: Date.now(),
          data: localRoutesCache
        }));
      } catch (e) {
        console.error("Failed to write routes to local storage:", e);
      }
      return localRoutesCache!;
    }
  } catch (err) {
    console.error("Direct fetch KMB routes error:", err);
  }
  return [];
}

async function getClientStopInfo(stopId: string): Promise<any> {
  if (localStopCache.has(stopId)) {
    return localStopCache.get(stopId);
  }
  try {
    const resp = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop/${stopId}`);
    const json = await resp.json();
    if (json && json.data) {
      const stopData = {
        name_tc: json.data.name_tc || "未知車站",
        name_en: json.data.name_en || "Unknown Stop",
        lat: parseFloat(json.data.lat) || 0,
        long: parseFloat(json.data.long) || 0
      };
      localStopCache.set(stopId, stopData);
      return stopData;
    }
  } catch (err) {
    console.error(`Direct fetch stop ${stopId} error:`, err);
  }
  return { name_tc: "未知車站", name_en: "Unknown Stop", lat: 0, long: 0 };
}

export function shouldBypassServer(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (
    host &&
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    !host.includes("run.app") &&
    !host.includes("webcontainer.io")
  ) {
    return true;
  }
  if (localStorage.getItem("hk_transit_force_client_direct") === "true") {
    return true;
  }
  return false;
}

export async function transitFetch(apiPath: string): Promise<Response> {
  const cleanPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  
  if (!shouldBypassServer()) {
    // Standard full-stack server request proxy
    return fetch(getApiUrl(cleanPath));
  }

  // Pure Client-Side Direct Hook Subroutines (Unlocks absolute zero-dependency Vercel hosting!)
  try {
    if (cleanPath.startsWith("/api/status")) {
      return new Response(JSON.stringify({ 
        status: "ok", 
        version: "1.2.0-direct-mode", 
        is_client_direct_mode: true,
        timestamp: Date.now(),
        environment: "production",
        cors_enabled: true,
        kmb_cache_preloaded: true,
        kmb_cache_size: 1600
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (cleanPath.startsWith("/api/mtr/schedule")) {
      const urlParams = new URL(apiPath, "http://local").searchParams;
      const line = urlParams.get("line");
      const station = urlParams.get("station");
      const nativeUrl = `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${line}&sta=${station}&lang=zh`;
      const resp = await fetch(nativeUrl);
      const mtrData = await resp.json();
      return new Response(JSON.stringify({ status: "ok", ...mtrData }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (cleanPath.startsWith("/api/kmb/eta")) {
      const urlParams = new URL(apiPath, "http://local").searchParams;
      const stopId = urlParams.get("stop_id");
      const route = urlParams.get("route");
      const serviceType = urlParams.get("service_type");
      
      let url = "";
      if (route && serviceType) {
        url = `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stopId}/${route}/${serviceType}`;
      } else {
        url = `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stopId}`;
      }
      
      const resp = await fetch(url);
      const json = await resp.json();
      return new Response(JSON.stringify({ status: "ok", data: json.data || [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (cleanPath.startsWith("/api/kmb/routes")) {
      const urlParams = new URL(apiPath, "http://local").searchParams;
      const q = (urlParams.get("q") || "").trim().toLowerCase();
      const allRoutes = await getClientKmbRoutes();

      let matches = allRoutes;
      if (q) {
        matches = allRoutes.filter((r: any) => r.route.toLowerCase().includes(q));
        matches.sort((a: any, b: any) => {
          const aLower = a.route.toLowerCase();
          const bLower = b.route.toLowerCase();
          if (aLower === q && bLower !== q) return -1;
          if (bLower === q && aLower !== q) return 1;
          if (aLower.startsWith(q) && !bLower.startsWith(q)) return -1;
          if (bLower.startsWith(q) && !aLower.startsWith(q)) return 1;
          return aLower.localeCompare(bLower, undefined, { numeric: true, sensitivity: "base" });
        });
      }
      const limit = q ? 60 : 40;
      return new Response(JSON.stringify({ status: "ok", data: matches.slice(0, limit) }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (cleanPath.startsWith("/api/kmb/route-stops")) {
      const urlParams = new URL(apiPath, "http://local").searchParams;
      const route = urlParams.get("route");
      const bound = urlParams.get("bound");
      const serviceType = urlParams.get("service_type");
      const direction = bound === "O" ? "outbound" : bound === "I" ? "inbound" : bound;
      
      const stopListUrl = `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${route}/${direction}/${serviceType}`;
      const response = await fetch(stopListUrl);
      const json = await response.json();
      const rawStops = json.data || [];
      
      let updatedCache = false;
      const resolvedStops = await Promise.all(
        rawStops.map(async (stopItem: any) => {
          const isCached = localStopCache.has(stopItem.stop);
          const info = await getClientStopInfo(stopItem.stop);
          if (!isCached) updatedCache = true;
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
      
      if (updatedCache) {
        saveStopCacheToLocalStorage();
      }
      
      return new Response(JSON.stringify({ status: "ok", data: resolvedStops }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err: any) {
    console.error("Client Direct Mode error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Fallback if URL matches nothing
  return new Response(JSON.stringify({ status: "error", message: "Unknown API path" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}

