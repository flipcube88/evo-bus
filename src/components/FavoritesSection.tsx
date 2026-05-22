import React, { useState, useEffect } from "react";
import { Bookmark, KmbEta, MtrScheduleItem, safeJsonParse } from "../types";
import { getStationName } from "../data/mtrData";
import { 
  Star, Train, RefreshCw, Trash2, ArrowRightLeft, Clock, Bus, CheckCircle2,
  Cloud, Copy, Check, Link2, Unlink, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FavoritesSectionProps {
  bookmarks: Bookmark[];
  toggleBookmark: (bookmark: Bookmark) => void;
  onNavigateToTab: (tab: "kmb" | "mtr") => void;
  syncCode: string | null;
  syncLoading: boolean;
  syncError: string | null;
  onCreateSyncCode: () => Promise<string | null>;
  onLoadSyncCode: (code: string) => Promise<boolean>;
  onDisconnectSync: () => void;
  onTriggerRefresh: () => void;
}

interface FavoriteEtaState {
  [bookmarkId: string]: {
    loading: boolean;
    error: boolean;
    times: { dest: string; minsLeft: number; displayStr: string }[];
  };
}

export default function FavoritesSection({ 
  bookmarks, 
  toggleBookmark, 
  onNavigateToTab,
  syncCode,
  syncLoading,
  syncError,
  onCreateSyncCode,
  onLoadSyncCode,
  onDisconnectSync,
  onTriggerRefresh
}: FavoritesSectionProps) {
  const [favoriteEtas, setFavoriteEtas] = useState<FavoriteEtaState>({});
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(30);

  // Sync state UI variables
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState<boolean>(false);
  const [inputCode, setInputCode] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCopyCode = async () => {
    if (!syncCode) return;
    try {
      await navigator.clipboard.writeText(syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCreate = async () => {
    setLocalError(null);
    setSuccessMsg(null);
    const code = await onCreateSyncCode();
    if (code) {
      setSuccessMsg(`備份成功！已生成跨平台同步碼：${code}`);
    } else {
      setLocalError("備份或生成同步碼失敗，請稍後再試");
    }
  };

  const handleLoad = async () => {
    setLocalError(null);
    setSuccessMsg(null);
    const clean = inputCode.trim().toUpperCase();
    if (!clean || clean.length < 5) {
      setLocalError("請輸入正確的同步代碼");
      return;
    }
    const success = await onLoadSyncCode(clean);
    if (success) {
      setSuccessMsg(`同步成功！已成功同步您在其他平台收藏的最愛。`);
      setInputCode("");
    } else {
      setLocalError("找不到此同步碼。請確認代碼是否輸入正確或已過期。");
    }
  };

  // Parse custom MTR dates helper
  const getMtrMinsRemaining = (timeStr: string) => {
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
      return Math.ceil(diffMs / 60000);
    } catch {
      return -1;
    }
  };

  // Parse KMB dates helper
  const getKmbMinsRemaining = (isoStr: string | null) => {
    if (!isoStr) return -1;
    try {
      const trainTime = new Date(isoStr);
      const diffMs = trainTime.getTime() - Date.now();
      return Math.ceil(diffMs / 60000);
    } catch {
      return -1;
    }
  };

  const fetchSingleBookmarkEta = async (bookmark: Bookmark) => {
    if (bookmark.type === "mtr") {
      try {
        const resp = await fetch(`/api/mtr/schedule?line=${bookmark.lineCode}&station=${bookmark.stationCode}`);
        if (!resp.ok) throw new Error("MTR fetch failed");
        const json = await safeJsonParse(resp);

        if (json.status !== 0) {
          const key = `${bookmark.lineCode}-${bookmark.stationCode}`;
          const directionSchedules: MtrScheduleItem[] = json.data?.[key]?.[bookmark.direction!] || [];

          const resolvedTimes = directionSchedules.slice(0, 3).map((train) => {
            const mins = getMtrMinsRemaining(train.time);
            return {
              dest: getStationName(train.dest).tc,
              minsLeft: mins,
              displayStr: mins <= 0 ? "即將抵達" : `${mins} 分鐘`
            };
          });

          return { bookmarkId: bookmark.id, error: false, times: resolvedTimes };
        }
      } catch (err) {
        console.error("MTR bookmark fetch error:", err);
      }
      return { bookmarkId: bookmark.id, error: true, times: [] };
    } else {
      // KMB type
      try {
        const resp = await fetch(
          `/api/kmb/eta?stop_id=${bookmark.stopId}&route=${bookmark.route}&service_type=${bookmark.serviceType}`
        );
        if (!resp.ok) throw new Error("KMB fetch failed");
        const json = await safeJsonParse(resp);

        if (json.status === "ok") {
          const rawEtas: KmbEta[] = json.data || [];
          const matchedEtas = rawEtas
            .filter((eta) => eta.dir === bookmark.bound && eta.route === bookmark.route)
            .sort((a, b) => a.eta_seq - b.eta_seq);

          const resolvedTimes = matchedEtas.slice(0, 3).map((eta) => {
            const mins = getKmbMinsRemaining(eta.eta);
            return {
              dest: eta.dest_tc,
              minsLeft: mins,
              displayStr: mins < 0 ? "無數據" : mins === 0 ? "即將抵達" : `${mins} 分鐘`
            };
          });

          return { bookmarkId: bookmark.id, error: false, times: resolvedTimes };
        }
      } catch (err) {
        console.error("KMB bookmark fetch error:", err);
      }
      return { bookmarkId: bookmark.id, error: true, times: [] };
    }
  };

  const fetchAllFavorites = async () => {
    if (bookmarks.length === 0) return;
    setRefreshing(true);

    // Set initial loading states for new bookmarks that have no data
    setFavoriteEtas((prev) => {
      const updated = { ...prev };
      bookmarks.forEach((b) => {
        if (!updated[b.id]) {
          updated[b.id] = { loading: true, error: false, times: [] };
        }
      });
      return updated;
    });

    try {
      // Run queries in parallel
      const results = await Promise.all(bookmarks.map((b) => fetchSingleBookmarkEta(b)));
      
      const newEtaState: FavoriteEtaState = {};
      results.forEach((res) => {
        newEtaState[res.bookmarkId] = {
          loading: false,
          error: res.error,
          times: res.times
        };
      });

      setFavoriteEtas(newEtaState);
    } catch (err) {
      console.error("Failed to query all bookmarks:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Poll on bookmarks change
  useEffect(() => {
    fetchAllFavorites();
    setAutoRefreshSecs(30);
  }, [bookmarks]);

  // Tick timer
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoRefreshSecs((prev) => {
        if (prev <= 1) {
          fetchAllFavorites();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [bookmarks]);

  return (
    <div id="favorites-section" className="space-y-4">
      {/* Overview stats header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-500 tracking-wider">我的常用路線與車站</h3>
        {bookmarks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 bg-white px-2.5 py-1.5 border border-slate-100 rounded-xl">
              {autoRefreshSecs}秒後自動刷新
            </span>
            <button
              id="btn-favs-refresh"
              onClick={fetchAllFavorites}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-100 transition-colors text-slate-600 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {/* 跨平台同步控制面板 (Cross-platform Sync Control Panel) */}
      <div id="sync-control-panel" className="bg-white rounded-2xl border border-slate-200/55 shadow-3xs overflow-hidden transition-all duration-300">
        <button
          id="btn-toggle-sync-panel"
          onClick={() => setIsSyncPanelOpen(!isSyncPanelOpen)}
          className="w-full px-4 py-3 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Cloud className={`w-4 h-4 ${syncCode ? "text-emerald-500 animate-pulse" : "text-slate-400"}`} />
            <span className="text-xs font-bold text-slate-700">
              {syncCode ? "📳 我的最愛正啟用實時同步" : "☁️ 點此啟用跨平台/手機同步我的最愛"}
            </span>
            {syncCode && (
              <span className="bg-emerald-50 text-emerald-600 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border border-emerald-100">
                代碼: {syncCode}
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            {isSyncPanelOpen ? "收合選項 ▲" : "展開選項 ▼"}
          </span>
        </button>

        <AnimatePresence>
          {isSyncPanelOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-100 p-4 space-y-4 text-xs"
            >
              {syncLoading && (
                <div className="flex items-center gap-1.5 text-slate-500">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>正在處理同步操作...</span>
                </div>
              )}

              {(syncError || localError) && (
                <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl text-rose-600 flex items-start gap-1.5 leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{syncError || localError}</span>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-emerald-700 flex items-start gap-1.5 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {!syncCode ? (
                // Not synced state
                <div className="space-y-3.5 leading-relaxed text-slate-500">
                  <p>
                    <strong>香港乘車易</strong> 提供輕量級雲端同步。將您的「我的最愛」打包上傳至智能伺服器，即可在手機、平板或電腦（唔同平台）讀取，毋需註冊任何帳號！
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Method A: Create code */}
                    <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100/80 space-y-2">
                      <span className="font-bold text-slate-700 block text-[11px]">方法 1：備份本機最愛並產生同步碼</span>
                      <p className="text-[10.5px]">將您在此瀏覽器收藏的車站上傳，生成一組專屬的 6 位代碼：</p>
                      <button
                        id="btn-sync-create"
                        onClick={handleCreate}
                        disabled={syncLoading}
                        className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-center cursor-pointer transition-colors"
                      >
                        建立或匯出同步碼
                      </button>
                    </div>

                    {/* Method B: Enter code */}
                    <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100/80 space-y-2">
                      <span className="font-bold text-slate-700 block text-[11px]">方法 2：輸入既有同步碼</span>
                      <p className="text-[10.5px]">如果您已在手機或其他裝置取得了 6 位代碼，在此輸入以載入最愛：</p>
                      
                      <div className="flex gap-1.5">
                        <input
                          id="input-sync-code"
                          type="text"
                          maxLength={6}
                          placeholder="例如 MTR9A8"
                          value={inputCode}
                          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                          className="flex-1 bg-white border border-slate-200 outline-none rounded-lg px-2.5 text-slate-800 text-center font-mono font-bold tracking-wider placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus:border-slate-400 transition-colors uppercase"
                        />
                        <button
                          id="btn-sync-load"
                          onClick={handleLoad}
                          disabled={syncLoading || !inputCode.trim()}
                          className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer transition-colors disabled:opacity-40"
                        >
                          載入最愛
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Synced state
                <div className="space-y-3.5 leading-relaxed">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/40">
                    <div>
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        已啟用安全雲端同步
                      </span>
                      <p className="text-slate-400 text-[10.5px] mt-1">
                        任何在此裝置的新增或刪除，皆會自動備份至雲端。
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-sm self-stretch sm:self-auto justify-between border-t border-slate-200/40 sm:border-0 pt-2 sm:pt-0">
                      <span className="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg border tracking-wider text-xs">
                        {syncCode}
                      </span>
                      <button
                        id="btn-sync-copy"
                        onClick={handleCopyCode}
                        className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-600 transition-colors flex items-center justify-center border border-slate-200"
                        title="複製同步碼"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-400">
                    💡 提示：在您的其他平台（如手機瀏覽器）中點選「啟用跨平台同步」，並輸入相同的同步碼 <strong>{syncCode}</strong>，兩端即會保持完全相同。
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                    <button
                      id="btn-sync-now"
                      onClick={() => {
                        onTriggerRefresh();
                        fetchAllFavorites();
                        setSuccessMsg("最新最愛數據已與伺服器重新拉取同步。");
                      }}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors text-[10.5px]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      立即同步拉取 (雲端同步至本機)
                    </button>

                    <button
                      id="btn-sync-disconnect"
                      onClick={() => {
                        if (confirm("確定要解除此同步碼的綁定嗎？解除後本機變更將不會再上傳至該同步軌。")) {
                          onDisconnectSync();
                          setSuccessMsg("已解除該同步碼連結。");
                        }
                      }}
                      className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all text-[10.5px]"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      解除連結此同步碼
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Empty State visual card */}
      {bookmarks.length === 0 ? (
        <div id="favs-empty-card" className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center max-w-lg mx-auto space-y-5">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border border-amber-100/50">
            <Star className="w-8 h-8 text-amber-500 fill-amber-500/10" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-slate-900">尚無收藏的常用點</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              實時預測需要快速預覽？在查詢 KMB 巴士站點或 MTR 港鐵車站時，點選 <span className="font-semibold text-amber-500">收藏鍵 (★)</span>，該常用點就會呈現在這個分頁中，開啟程式即可一目了然！
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              id="btn-navigate-to-kmb"
              onClick={() => onNavigateToTab("kmb")}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Bus className="w-4 h-4" />
              <span>去搜尋九巴</span>
            </button>
            <button
              id="btn-navigate-to-mtr"
              onClick={() => onNavigateToTab("mtr")}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Train className="w-4 h-4" />
              <span>去搜尋港鐵</span>
            </button>
          </div>
        </div>
      ) : (
        /* Grid of bookmarked items */
        <div id="favorites-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {bookmarks.map((bookmark) => {
              const etaState = favoriteEtas[bookmark.id];
              const isLoading = !etaState || etaState.loading;
              const isError = etaState?.error;
              const resolvedTimes = etaState?.times || [];

              return (
                <motion.div
                  key={bookmark.id}
                  id={`fav-card-${bookmark.id}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex flex-col justify-between space-y-3 relative group"
                >
                  {/* Top line detailing operator info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0 pr-6">
                      <div className={`p-2 rounded-xl flex-shrink-0 text-white shadow-sm ${
                        bookmark.type === "mtr" ? "bg-sky-600" : "bg-rose-600"
                      }`}>
                        {bookmark.type === "mtr" ? <Train className="w-4 h-4" /> : <Bus className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 truncate leading-tight">
                          {bookmark.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate uppercase font-mono tracking-wide">
                          {bookmark.subtitle}
                        </span>
                      </div>
                    </div>

                    {/* Quick remove trigger */}
                    <button
                      id={`btn-remove-fav-${bookmark.id}`}
                      onClick={() => toggleBookmark(bookmark)}
                      className="opacity-60 hover:opacity-100 p-2 hover:bg-slate-50 border border-transparent hover:border-slate-100 text-rose-500 rounded-xl transition-all"
                      title="刪除此收藏"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mid predicting eta blocks */}
                  <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                    {isLoading ? (
                      <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-300" />
                        <span>查詢實時預報...</span>
                      </div>
                    ) : isError ? (
                      <div className="py-6 flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                        <span>暫無班次或非服務時段</span>
                      </div>
                    ) : resolvedTimes.length === 0 ? (
                      <div className="py-6 flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                        <span>查無對應可用班次點</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {resolvedTimes.map((time, idx) => {
                          return (
                            <div
                              key={`fav-eta-${idx}`}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="font-semibold text-slate-600">
                                {idx === 0 ? "下班車" : `起第 ${idx + 1} 班`} 往 <span className="text-slate-900">{time.dest}</span>
                              </span>
                              <span
                                className={`font-bold font-mono px-1.5 py-0.5 rounded ${
                                  time.minsLeft <= 0
                                    ? "bg-rose-50 text-rose-600 text-[10px] animate-pulse-live"
                                    : time.minsLeft <= 3
                                    ? "bg-amber-50 text-amber-600 border border-amber-100"
                                    : "text-slate-700 bg-slate-150-custom bg-slate-100/75"
                                }`}
                              >
                                {time.displayStr}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
