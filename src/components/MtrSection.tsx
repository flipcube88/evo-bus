import React, { useState, useEffect } from "react";
import { MTR_LINES, getStationName, MtrLine, MtrStation } from "../data/mtrData";
import { Bookmark, MtrScheduleItem, safeJsonParse, getApiUrl, transitFetch } from "../types";
import { Train, RefreshCw, Star, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MtrSectionProps {
  bookmarks: Bookmark[];
  toggleBookmark: (bookmark: Bookmark) => void;
}

export default function MtrSection({ bookmarks, toggleBookmark }: MtrSectionProps) {
  const [selectedLine, setSelectedLine] = useState<MtrLine>(MTR_LINES[0]);
  const [selectedStation, setSelectedStation] = useState<MtrStation>(MTR_LINES[0].stations[0]);
  const [scheduleData, setScheduleData] = useState<{ UP?: MtrScheduleItem[]; DOWN?: MtrScheduleItem[] } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(30);

  // Fetch real-time schedule
  const fetchSchedule = async (lineCode: string, stationCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await transitFetch(`/api/mtr/schedule?line=${lineCode}&station=${stationCode}`);
      if (!resp.ok) throw new Error("無法連接港鐵伺服器");
      const json = await safeJsonParse(resp);

      if (json.status === 0) {
        // MTR error/no data can occur if system offline during graveyard hours
        setError(json.message || "目前非營運時間或無班次資料");
        setScheduleData(null);
      } else {
        const lineStationKey = `${lineCode}-${stationCode}`;
        const schedules = json.data?.[lineStationKey];
        if (schedules) {
          setScheduleData({
            UP: schedules.UP || [],
            DOWN: schedules.DOWN || []
          });
        } else {
          setScheduleData({});
          setError("未提供實時抵站時間（可能是不支援班次之終點站）");
        }
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);
      setError("讀取實時數據失敗，請稍後重試。");
    } finally {
      setLoading(false);
    }
  };

  // Fetch when station or line changes
  useEffect(() => {
    fetchSchedule(selectedLine.code, selectedStation.code);
  }, [selectedLine, selectedStation]);

  // Automatic refresh timer
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoRefreshSecs((prev) => {
        if (prev <= 1) {
          fetchSchedule(selectedLine.code, selectedStation.code);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedLine, selectedStation]);

  const handleLineChange = (line: MtrLine) => {
    setSelectedLine(line);
    setSelectedStation(line.stations[0]);
    setAutoRefreshSecs(30);
  };

  const handleStationChange = (station: MtrStation) => {
    setSelectedStation(station);
    setAutoRefreshSecs(30);
  };

  const handleRefresh = () => {
    fetchSchedule(selectedLine.code, selectedStation.code);
    setAutoRefreshSecs(30);
  };

  // Check if current station is bookmarked
  const getIsBookmarked = (direction: "UP" | "DOWN") => {
    const id = `mtr-${selectedLine.code}-${selectedStation.code}-${direction}`;
    return bookmarks.some((b) => b.id === id);
  };

  const handleAddBookmark = (direction: "UP" | "DOWN", directionLabel: string) => {
    const id = `mtr-${selectedLine.code}-${selectedStation.code}-${direction}`;
    const newBookmark: Bookmark = {
      id,
      type: "mtr",
      title: `${selectedStation.name_tc} 往 ${directionLabel}`,
      subtitle: `${selectedLine.name_tc}`,
      createdAt: Date.now(),
      lineCode: selectedLine.code,
      stationCode: selectedStation.code,
      direction
    };
    toggleBookmark(newBookmark);
  };

  // Helper to calculate minutes remaining
  const getMinutesRemaining = (timeStr: string) => {
    // Parse MTR time format: YYYY-MM-DD HH:MM:SS
    // Note: since current local time is 2026-05-22, let's use reliable date arithmetic
    try {
      const parts = timeStr.split(" ");
      const dateParts = parts[0].split("-");
      const timeParts = parts[1].split(":");
      const trainTime = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
        parseInt(timeParts[0]),
        parseInt(timeParts[1]),
        parseInt(timeParts[2])
      );
      const diffMs = trainTime.getTime() - Date.now();
      const mins = Math.ceil(diffMs / 60000);
      return mins;
    } catch {
      return 0;
    }
  };

  // Get dynamic ETA label
  const getEtaLabel = (timeStr: string) => {
    const mins = getMinutesRemaining(timeStr);
    if (mins <= 0) return "即將抵達";
    if (mins === 1) return "1 分鐘";
    return `${mins} 分鐘`;
  };

  // Extract destination station name for labeled translation
  const resolveDestName = (destCode: string) => {
    return getStationName(destCode).tc;
  };

  // Render station timeline scroll
  const currentLineHexColor = () => {
    switch (selectedLine.code) {
      case "KTL": return "#00ab5c";
      case "ISL": return "#007cd3";
      case "TWL": return "#e21b18";
      case "TKL": return "#a35eb5";
      case "EAL": return "#5ebfc4";
      case "TML": return "#9a382c";
      case "TCL": return "#f39712";
      case "AEL": return "#007078";
      case "SIL": return "#b5bd00";
      default: return "#475569";
    }
  };

  return (
    <div id="mtr-section" className="space-y-5">
      {/* 1. Line list horizontal selector */}
      <div id="mtr-line-selector" className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {MTR_LINES.map((line) => {
          const isActive = selectedLine.code === line.code;
          return (
            <button
              key={line.code}
              id={`btn-line-${line.code}`}
              onClick={() => handleLineChange(line)}
              className={`flex-none px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                isActive
                  ? `${line.color} text-white shadow-md ring-2 ring-offset-2 ring-slate-100 scale-102`
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-white" : line.color}`} />
              {line.name_tc}
            </button>
          );
        })}
      </div>

      {/* 2. Station List Selector (custom visual MTR timeline representation) */}
      <div id="mtr-station-selector" className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 tracking-wider">選擇港鐵車站</span>
          <span className="text-[10px] text-slate-400 font-mono">共 {selectedLine.stations.length} 站</span>
        </div>

        {/* Horizontal linear tube timeline style */}
        <div className="overflow-x-auto pb-3 pt-2 scrollbar-none">
          <div className="relative flex items-center gap-4 min-w-max px-4">
            {/* Connecting tube line */}
            <div
              className="absolute left-4 right-4 h-1.5 rounded-full pointer-events-none opacity-40 px-2"
              style={{ backgroundColor: currentLineHexColor(), top: "calc(50% - 6px)" }}
            />

            {selectedLine.stations.map((station, index) => {
              const isSelected = selectedStation.code === station.code;
              return (
                <button
                  key={station.code}
                  id={`btn-station-${station.code}`}
                  onClick={() => handleStationChange(station)}
                  className="relative flex-none flex flex-col items-center group z-10 w-14"
                >
                  {/* Station Node dot */}
                  <div
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                      isSelected
                        ? "bg-white scale-125 border-slate-900 shadow-sm"
                        : "bg-slate-100 border-slate-300 group-hover:bg-slate-200"
                    }`}
                    style={{ borderColor: isSelected ? currentLineHexColor() : undefined }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: currentLineHexColor() }}
                    />
                  </div>
                  {/* Name */}
                  <span
                    className={`mt-2 text-xs transition-colors duration-200 ${
                      isSelected
                        ? "font-semibold text-slate-950 scale-102"
                        : "text-slate-500 group-hover:text-slate-700"
                    }`}
                  >
                    {station.name_tc}
                  </span>
                  <span className="text-[8px] text-slate-400 font-mono pt-0.5">{station.code}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Real-time Train Times Display */}
      <div id="mtr-realtime-panel" className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
        {/* Title area with details */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: currentLineHexColor() }}
            >
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">{selectedStation.name_tc}</h3>
                <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  {selectedStation.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedLine.name_tc} • {selectedStation.name_en}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Countdown to next API query refresh */}
            <div className="text-right text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{autoRefreshSecs}秒後自動更新</span>
            </div>

            <button
              id="btn-mtr-refresh"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 disabled:opacity-50"
              title="重新整理班次"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Loading details */}
        {loading && !scheduleData && (
          <div id="mtr-loading-placeholder" className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
            <span className="text-sm">正在讀取最新的實時班次...</span>
          </div>
        )}

        {/* Show active errors if MTR returns data empty/delays */}
        {error && (
          <div id="mtr-error-alert" className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-2.5 text-amber-800 text-xs mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">{error}</p>
              <p className="text-[10px] text-amber-700">當前可能是非乘客行駛時間，或該站正被設定為終點港客調頭，無實時抵達預報。</p>
            </div>
          </div>
        )}

        {/* Up/Down Two Direction Streams Grid */}
        <AnimatePresence mode="wait">
          {!loading && scheduleData && (
            <motion.div
              id="schedules-grid"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >
              {/* UP Direction Column */}
              <div id="mtr-up-direction" className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-live" />
                    <h4 className="text-sm font-bold text-slate-800">上行 / 前往方向</h4>
                  </div>
                  {scheduleData.UP && scheduleData.UP.length > 0 && (
                    <button
                      id="bookmark-btn-up"
                      onClick={() => handleAddBookmark("UP", resolveDestName(scheduleData.UP![0].dest))}
                      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border transition-all ${
                        getIsBookmarked("UP")
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Star className={`w-3 h-3 ${getIsBookmarked("UP") ? "fill-amber-500 text-amber-500" : ""}`} />
                      <span>{getIsBookmarked("UP") ? "已收藏" : "收藏此方向"}</span>
                    </button>
                  )}
                </div>

                {(!scheduleData.UP || scheduleData.UP.length === 0) ? (
                  <div className="text-center py-8 text-xs text-slate-400">目前沒有實時北行/上行班次預報</div>
                ) : (
                  <div className="space-y-2">
                    {scheduleData.UP.map((train, idx) => {
                      const mins = getMinutesRemaining(train.time);
                      return (
                        <div
                          key={`up-${idx}`}
                          className={`bg-white rounded-xl p-3 border border-slate-200/60 shadow-xs flex items-center justify-between transition-all hover:border-slate-300 ${
                            idx === 0 ? "border-l-4" : ""
                          }`}
                          style={{ borderLeftColor: idx === 0 ? currentLineHexColor() : undefined }}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-mono bg-slate-100 text-slate-600 w-5 h-5 rounded-full flex items-center justify-center">
                              {train.plat}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-slate-800">
                                  往 {resolveDestName(train.dest)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({train.dest})
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-300" />
                                抵站時間: {train.time.split(" ")[1].substring(0, 5)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-sm font-bold font-mono px-2.5 py-1 rounded-lg ${
                                mins <= 1
                                  ? "bg-rose-50 text-rose-600 text-xs px-2 animate-pulse-live font-semibold"
                                  : mins <= 3
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {getEtaLabel(train.time)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* DOWN Direction Column */}
              <div id="mtr-down-direction" className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-live" />
                    <h4 className="text-sm font-bold text-slate-800">下行 / 前往方向</h4>
                  </div>
                  {scheduleData.DOWN && scheduleData.DOWN.length > 0 && (
                    <button
                      id="bookmark-btn-down"
                      onClick={() => handleAddBookmark("DOWN", resolveDestName(scheduleData.DOWN![0].dest))}
                      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border transition-all ${
                        getIsBookmarked("DOWN")
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Star className={`w-3 h-3 ${getIsBookmarked("DOWN") ? "fill-amber-500 text-amber-500" : ""}`} />
                      <span>{getIsBookmarked("DOWN") ? "已收藏" : "收藏此方向"}</span>
                    </button>
                  )}
                </div>

                {(!scheduleData.DOWN || scheduleData.DOWN.length === 0) ? (
                  <div className="text-center py-8 text-xs text-slate-400">目前沒有實時南行/下行班次預報</div>
                ) : (
                  <div className="space-y-2">
                    {scheduleData.DOWN.map((train, idx) => {
                      const mins = getMinutesRemaining(train.time);
                      return (
                        <div
                          key={`down-${idx}`}
                          className={`bg-white rounded-xl p-3 border border-slate-200/60 shadow-xs flex items-center justify-between transition-all hover:border-slate-300 ${
                            idx === 0 ? "border-l-4" : ""
                          }`}
                          style={{ borderLeftColor: idx === 0 ? currentLineHexColor() : undefined }}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-mono bg-slate-100 text-slate-600 w-5 h-5 rounded-full flex items-center justify-center">
                              {train.plat}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-slate-800">
                                  往 {resolveDestName(train.dest)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({train.dest})
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-300" />
                                抵站時間: {train.time.split(" ")[1].substring(0, 5)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-sm font-bold font-mono px-2.5 py-1 rounded-lg ${
                                mins <= 1
                                  ? "bg-rose-50 text-rose-600 text-xs px-2 animate-pulse-live font-semibold"
                                  : mins <= 3
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {getEtaLabel(train.time)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info stamp */}
        {lastUpdated && (
          <div className="text-center pt-4 mt-3 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            更新於: {lastUpdated.toLocaleTimeString()} | 數據來源: 香港政府運輸署
          </div>
        )}
      </div>
    </div>
  );
}
