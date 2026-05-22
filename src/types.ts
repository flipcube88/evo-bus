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

