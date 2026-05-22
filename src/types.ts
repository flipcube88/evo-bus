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
