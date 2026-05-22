import React, { useState, useEffect } from "react";
import { Bookmark, KmbRoute, KmbStop, KmbEta, safeJsonParse } from "../types";
import { Search, Compass, Star, MapPin, RefreshCw, AlertCircle, Clock, ToggleLeft, ToggleRight, ArrowUpDown, ChevronRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface KmbSectionProps {
  bookmarks: Bookmark[];
  toggleBookmark: (bookmark: Bookmark) => void;
}

const POPULAR_ROUTES = ["1A", "101", "2A", "6C", "98D", "681", "B1"];

export default function KmbSection({ bookmarks, toggleBookmark }: KmbSectionProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<KmbRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<KmbRoute | null>(null);
  const [currentBound, setCurrentBound] = useState<"O" | "I">("O");
  const [stops, setStops] = useState<KmbStop[]>([]);
  const [stopsLoading, setStopsLoading] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [stopsError, setStopsError] = useState<string | null>(null);

  // Accordion state to see real-time eta for clicked stops
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [etaData, setEtaData] = useState<KmbEta[]>([]);
  const [etaLoading, setEtaLoading] = useState<boolean>(false);
  const [lastEtaFetch, setLastEtaFetch] = useState<number>(0);

  // Debouncing search
  useEffect(() => {
    const handleSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const resp = await fetch(`/api/kmb/routes?q=${encodeURIComponent(searchQuery.trim())}`);
        if (!resp.ok) throw new Error("Search failed");
        const json = await safeJsonParse(resp);
        setSearchResults(json.data || []);
      } catch (err) {
        console.error("Route search error:", err);
      } finally {
        setSearchLoading(false);
      }
    };

    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load stops when selectedRoute or currentBound changes
  useEffect(() => {
    if (!selectedRoute) return;

    const fetchRouteStops = async () => {
      setStopsLoading(true);
      setStopsError(null);
      setExpandedStopId(null);
      try {
        const boundValue = currentBound;
        const resp = await fetch(
          `/api/kmb/route-stops?route=${selectedRoute.route}&bound=${boundValue}&service_type=${selectedRoute.service_type}`
        );
        if (!resp.ok) throw new Error("無法讀取巴士站名與順序");
        const json = await safeJsonParse(resp);
        if (json.status === "ok") {
          setStops(json.data || []);
        } else {
          throw new Error(json.message || "讀取失敗");
        }
      } catch (err: any) {
        console.error(err);
        setStopsError(err.message || "讀取路線巴士站出錯，該路線方向可能非營運班次。");
        setStops([]);
      } finally {
        setStopsLoading(false);
      }
    };

    fetchRouteStops();
  }, [selectedRoute, currentBound]);

  // Fetch ETA prediction for a single stop
  const fetchStopEta = async (stopId: string) => {
    if (!selectedRoute) return;
    setEtaLoading(true);
    try {
      const resp = await fetch(
        `/api/kmb/eta?stop_id=${stopId}&route=${selectedRoute.route}&service_type=${selectedRoute.service_type}`
      );
      if (!resp.ok) throw new Error("ETA fetch failed");
      const json = await safeJsonParse(resp);

      if (json.status === "ok") {
        // Filter ETAs matching selected direction
        // In KMB ETA API, direction returned might be 'O', 'I' or matching bound sequence, or we filter based on stop seq matches
        // KMB matches 'O' with 'outbound' -> KMB ETA co 'KMB' of direction 'O' or 'I'
        const rawEtas: KmbEta[] = json.data || [];
        const filtered = rawEtas.filter(
          (item) => item.dir === currentBound && item.route === selectedRoute.route
        );
        setEtaData(filtered.sort((a, b) => a.eta_seq - b.eta_seq));
      }
      setLastEtaFetch(Date.now());
    } catch (err) {
      console.error(err);
    } finally {
      setEtaLoading(false);
    }
  };

  const handleStopAccordionToggle = (stopId: string) => {
    if (expandedStopId === stopId) {
      setExpandedStopId(null);
    } else {
      setExpandedStopId(stopId);
      setEtaData([]);
      fetchStopEta(stopId);
    }
  };

  const swapDirection = () => {
    setCurrentBound((prev) => (prev === "O" ? "I" : "O"));
  };

  // Star Fav helper
  const getIsBookmarked = (stopId: string) => {
    if (!selectedRoute) return false;
    const id = `kmb-${selectedRoute.route}-${currentBound}-${selectedRoute.service_type}-${stopId}`;
    return bookmarks.some((b) => b.id === id);
  };

  const handleBookmarkStop = (e: React.MouseEvent, stop: KmbStop) => {
    e.stopPropagation(); // Avoid triggering accordion close/expand
    if (!selectedRoute) return;

    const destLabel = currentBound === "O" ? selectedRoute.dest_tc : selectedRoute.orig_tc;
    const id = `kmb-${selectedRoute.route}-${currentBound}-${selectedRoute.service_type}-${stop.stop}`;

    const newBookmark: Bookmark = {
      id,
      type: "kmb",
      title: `${selectedRoute.route} 往 ${destLabel}`,
      subtitle: stop.name_tc,
      createdAt: Date.now(),
      route: selectedRoute.route,
      bound: currentBound,
      serviceType: selectedRoute.service_type,
      stopId: stop.stop,
      stopNameTc: stop.name_tc,
      stopNameEn: stop.name_en
    };

    toggleBookmark(newBookmark);
  };

  // Helper to calculate minutes for ETA
  const getKmbMinsLeft = (isoStr: string | null) => {
    if (!isoStr) return -1;
    try {
      const trainTime = new Date(isoStr);
      const diffMs = trainTime.getTime() - Date.now();
      const mins = Math.max(0, Math.ceil(diffMs / 60000));
      return mins;
    } catch {
      return -1;
    }
  };

  const getKmbEtaString = (isoStr: string | null) => {
    const mins = getKmbMinsLeft(isoStr);
    if (mins < 0) return "無班次時間/非服務時間";
    if (mins === 0) return "即將抵達";
    return `${mins} 分鐘`;
  };

  // Reset selected route
  const handleClearRoute = () => {
    setSelectedRoute(null);
    setStops([]);
    setExpandedStopId(null);
  };

  return (
    <div id="kmb-section" className="space-y-4">
      {/* 1. KMB Route Selection Header card */}
      {!selectedRoute ? (
        <div id="kmb-search-selector-card" className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold text-slate-900">搜尋香港巴士 (九巴/龍運)</h3>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              id="kmb-route-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="輸入路線，例如 1A, 215X, 98D, N293..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 pl-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-mono"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4.5" />
          </div>

          {/* Popular shortcuts */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400">熱門路線快捷選擇</span>
            <div className="flex items-center gap-2 flex-wrap pb-1">
              {POPULAR_ROUTES.map((routeCode) => (
                <button
                  key={routeCode}
                  id={`btn-popular-${routeCode}`}
                  onClick={() => setSearchQuery(routeCode)}
                  className="px-3.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100/70 active:scale-95 transition-all text-xs font-bold rounded-lg font-mono border border-rose-100"
                >
                  {routeCode}
                </button>
              ))}
            </div>
          </div>

          {/* Search loading or results */}
          <AnimatePresence mode="wait">
            {searchLoading && (
              <div id="search-loading" className="flex items-center justify-center py-6 text-xs text-slate-400 gap-1.5">
                <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                <span>正在尋找路線數據...</span>
              </div>
            )}

            {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
              <div id="search-notfound" className="text-center py-6 text-xs text-slate-400">
                找不到對應的九巴/龍運路線 "{searchQuery}"
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <motion.div
                id="search-results-list"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden max-h-60 overflow-y-auto"
              >
                {searchResults.map((route, index) => (
                  <button
                    key={`${route.route}-${route.bound}-${route.service_type}-${index}`}
                    id={`btn-route-select-${route.route}-${route.bound}`}
                    onClick={() => {
                      setSelectedRoute(route);
                      setCurrentBound(route.bound);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 py-1 bg-rose-600 text-white rounded-lg font-mono font-black text-center text-sm shadow-xs">
                        {route.route}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                          <span>{route.orig_tc}</span>
                          <span className="text-[10px] text-slate-400">⇄</span>
                          <span>{route.dest_tc}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono tracking-wide">
                          KMB / LWB • 服務類型 {route.service_type}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* 2. Selected Route Detail Frame */
        <div id="kmb-stops-sequence-view" className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 bg-rose-600 text-white rounded-2xl font-mono font-black text-xl shadow-md flex items-center justify-center flex-shrink-0 glow-accent">
                {selectedRoute.route}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-slate-900">
                    往 {currentBound === "O" ? selectedRoute.dest_tc : selectedRoute.orig_tc}
                  </span>
                  <span className="text-[10px] font-mono bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">
                    {currentBound === "O" ? "去程" : "回程"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  起迄起點站：{selectedRoute.orig_tc} ⇄ {selectedRoute.dest_tc}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                id="btn-kmb-swap"
                onClick={swapDirection}
                className="px-3.5 py-2 hover:bg-slate-50 active:scale-95 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5"
                title="切換方向"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>切換方向</span>
              </button>
              <button
                id="btn-kmb-back"
                onClick={handleClearRoute}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-xs font-semibold text-slate-700 rounded-xl transition-all"
              >
                返回搜尋
              </button>
            </div>
          </div>

          {/* Stops List Timeline Container */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-400 tracking-wider">乘車停靠站順序</span>
              <span className="text-[10px] text-slate-400">點擊車站顯示最新抵站時間</span>
            </div>

            {stopsLoading && (
              <div id="stops-loading-placeholder" className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin text-rose-300" />
                <span className="text-sm">正在載入沿線巴士站點與名稱...</span>
              </div>
            )}

            {stopsError && (
              <div id="stops-error" className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-2 text-amber-800 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <p className="font-medium">{stopsError}</p>
              </div>
            )}

            {!stopsLoading && stops.length > 0 && (
              <div id="stops-list-timeline" className="relative pl-5 space-y-2">
                {/* Visual timeline vertical thread rail */}
                <div className="absolute left-7 top-4 bottom-8 w-0.5 bg-rose-200 pointer-events-none" />

                {stops.map((stop, index) => {
                  const isExpanded = expandedStopId === stop.stop;
                  const isFirst = index === 0;
                  const isLast = index === stops.length - 1;

                  return (
                    <div
                      key={`${stop.stop}-${index}`}
                      id={`stop-timeline-node-${stop.stop}`}
                      className="relative space-y-2"
                    >
                      {/* Timeline handle dot */}
                      <div
                        className={`absolute -left-5 top-3.5 w-3.5 h-3.5 rounded-full border-2 border-white z-10 transition-colors ${
                          isExpanded
                            ? "bg-rose-600 scale-110"
                            : isFirst
                            ? "bg-slate-900"
                            : isLast
                            ? "bg-rose-500"
                            : "bg-rose-200"
                        }`}
                      />

                      {/* Station card list component */}
                      <div
                        onClick={() => handleStopAccordionToggle(stop.stop)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isExpanded
                            ? "bg-rose-50/40 border-rose-300"
                            : "bg-slate-50/30 hover:bg-slate-50 border-slate-100"
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold font-mono text-rose-500 bg-rose-50 border border-rose-100/50 w-5 h-5 flex items-center justify-center rounded-md">
                              {stop.seq}
                            </span>
                            <span className="text-sm font-bold text-slate-800 truncate">
                              {stop.name_tc}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono tracking-tight font-medium bg-slate-100 px-1 py-0.5 rounded">
                              {stop.stop}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono truncate">
                            {stop.name_en}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Bookmark button */}
                          <button
                            id={`btn-stop-fav-${stop.stop}`}
                            onClick={(e) => handleBookmarkStop(e, stop)}
                            className={`p-2 rounded-xl transition-all hover:bg-white active:scale-95 border ${
                              getIsBookmarked(stop.stop)
                                ? "bg-amber-50 text-amber-500 border-amber-200 shadow-3xs"
                                : "bg-transparent text-slate-400 border-transparent hover:border-slate-200"
                            }`}
                            title="加入常用收藏"
                          >
                            <Star className={`w-4 h-4 ${getIsBookmarked(stop.stop) ? "fill-amber-500 text-amber-500" : ""}`} />
                          </button>

                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-rose-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Realtime ETA predictions child drawer */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            id={`accordion-eta-drawer-${stop.stop}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden pl-1 pr-1 pb-1"
                          >
                            <div className="bg-white border-x border-b border-rose-200/50 rounded-b-2xl p-3.5 space-y-2">
                              <div className="flex items-center justify-between pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 font-mono">
                                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                                  最新班次時段預測 (九巴實時)
                                </span>
                                {lastEtaFetch > 0 && (
                                  <span className="text-[8px] font-mono text-slate-300">
                                    更新: {new Date(lastEtaFetch).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>

                              {etaLoading && (
                                <div className="py-4 flex items-center justify-center gap-1.5 text-xs text-rose-400">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>正在查詢此站實時到站時間...</span>
                                </div>
                              )}

                              {!etaLoading && etaData.length === 0 && (
                                <div className="text-center py-4 text-xs text-slate-400">
                                  查無近期九巴班次數據。可能當前為非服務時間。
                                </div>
                              )}

                              {!etaLoading && etaData.length > 0 && (
                                <div className="space-y-1.5">
                                  {etaData.map((eta, etaIdx) => {
                                    const mins = getKmbMinsLeft(eta.eta);
                                    return (
                                      <div
                                        key={`eta-row-${etaIdx}`}
                                        className="flex items-center justify-between p-2.5 bg-slate-50/55 hover:bg-rose-50/10 border border-slate-100 rounded-xl transition-colors"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse-live" />
                                          <div>
                                            <span className="text-xs font-bold text-slate-700">
                                              班次 #{eta.eta_seq}
                                            </span>
                                            {eta.rmk_tc && (
                                              <span className="text-[9px] bg-slate-200/60 text-slate-500 py-0.5 px-1.5 rounded-md ml-2 font-medium">
                                                {eta.rmk_tc}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="text-right">
                                          <span
                                            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                                              mins <= 0
                                                ? "bg-rose-100 text-rose-700 animate-pulse-live"
                                                : mins <= 3
                                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                                : "text-slate-700 bg-slate-100"
                                            }`}
                                          >
                                            {getKmbEtaString(eta.eta)}
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
