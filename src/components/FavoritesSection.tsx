import React, { useState, useEffect } from "react";
import { Bookmark, KmbEta, MtrScheduleItem, safeJsonParse } from "../types";
import { getStationName } from "../data/mtrData";
import { 
  Star, Train, RefreshCw, Trash2, ArrowRightLeft, Clock, Bus, CheckCircle2,
  Cloud, Copy, Check, Link2, Unlink, AlertCircle, LogIn, LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "firebase/auth";

interface FavoritesSectionProps {
  bookmarks: Bookmark[];
  toggleBookmark: (bookmark: Bookmark) => void;
  onNavigateToTab: (tab: "kmb" | "mtr") => void;
  user: User | null;
  syncLoading: boolean;
  syncError: string | null;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onRefreshCloud: () => Promise<void>;
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
  user,
  syncLoading,
  syncError,
  onGoogleLogin,
  onGoogleLogout,
  onRefreshCloud
}: FavoritesSectionProps) {
  const [favoriteEtas, setFavoriteEtas] = useState<FavoriteEtaState>({});
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(30);

  // Sync state UI variables
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setLocalError(null);
    setSuccessMsg(null);
    try {
      await onGoogleLogin();
      setSuccessMsg("成功登入！您的我的最愛已自動與 Google Cloud Firestore 進行安全同步。");
    } catch (err: any) {
      setLocalError(err?.message || "登入失敗，請確認彈出視窗並重試");
    }
  };

  const handleLogout = async () => {
    setLocalError(null);
    setSuccessMsg(null);
    try {
      await onGoogleLogout();
      setSuccessMsg("已成功登出 Google 帳戶並切換回本機/離線模式。");
    } catch (err: any) {
      setLocalError(err?.message || "登出失敗，請重試");
    }
  };

  const handleRefresh = async () => {
    setLocalError(null);
    setSuccessMsg(null);
    try {
      await onRefreshCloud();
      setSuccessMsg("已重新與雲端拉取最新的我的最愛數據！");
    } catch (err: any) {
      setLocalError(err?.message || "同步更新失敗，請確認網絡連接");
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
            <Cloud className={`w-4 h-4 ${user ? "text-emerald-500 animate-pulse" : "text-slate-400"}`} />
            <span className="text-xs font-bold text-slate-700">
              {user ? "📳 雲端自動同步正啟用中" : "☁️ 點此登入以啟動跨平台/手機同步"}
            </span>
            {user && (
              <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-100">
                已登入: {user.displayName || user.email}
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

              {!user ? (
                // Not logged in state
                <div className="space-y-3.5 leading-relaxed text-slate-500">
                  <p>
                    <strong>香港乘車易</strong> 現已支援 <strong>Google 安全雲端自動同步</strong>。
                    只需登入您的 Google 帳戶，您在此收藏的「我的最愛」車站將安全備份於雲端，不論是 iPhone、Android 手機、平板或電腦皆會完全完美同步！
                  </p>
                  
                  <div className="pt-1 select-none">
                    <button
                      id="btn-sync-login"
                      onClick={handleLogin}
                      disabled={syncLoading}
                      className="inline-flex items-center justify-center gap-2.5 py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-center cursor-pointer transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      使用 Google 帳戶登入並同步
                    </button>
                  </div>
                </div>
              ) : (
                // Logged in state
                <div className="space-y-3.5 leading-relaxed">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/40">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt="Avatar" 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-800 text-white font-bold rounded-full flex items-center justify-center text-xs">
                          {user.displayName?.charAt(0) || "U"}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Google 連線同步已啟用
                        </span>
                        <p className="text-slate-400 text-[10.5px] mt-1">
                          已帳戶同步：<strong>{user.displayName || user.email}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-between border-t border-slate-200/40 sm:border-0 pt-2 sm:pt-0">
                      <button
                        id="btn-sync-logout"
                        onClick={handleLogout}
                        disabled={syncLoading}
                        className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all text-[10.5px]"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        登出帳戶
                      </button>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-400">
                    💡 智能合併：如果您跨多部裝置使用，登入後您的本機最愛和雲端最愛會自動智能合併，絕不丟失任何車站！
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                    <button
                      id="btn-sync-now"
                      onClick={() => {
                        handleRefresh();
                        fetchAllFavorites();
                      }}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors text-[10.5px]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      手動重新整理雲端 (強制拉取)
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
