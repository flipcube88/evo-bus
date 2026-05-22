import React, { useState, useEffect } from "react";
import FavoritesSection from "./components/FavoritesSection";
import KmbSection from "./components/KmbSection";
import MtrSection from "./components/MtrSection";
import { Bookmark } from "./types";
import { Star, Bus, Train, Compass, Info, Github } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"favorites" | "kmb" | "mtr">("favorites");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [serverStatus, setServerStatus] = useState<"ok" | "connecting" | "error">("connecting");
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Fetch latest bookmarks from sync code
  const fetchLatestFromSync = async (code: string) => {
    try {
      setSyncLoading(true);
      const resp = await fetch(`/api/sync/get/${code.toUpperCase()}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === "ok" && Array.isArray(json.bookmarks)) {
          setBookmarks(json.bookmarks);
          localStorage.setItem("hk_transit_bookmarks", JSON.stringify(json.bookmarks));
          setSyncError(null);
        }
      }
    } catch (err) {
      console.error("Sync fetch error:", err);
    } finally {
      setSyncLoading(false);
    }
  };

  // Load bookmarks on initiation
  useEffect(() => {
    try {
      const stored = localStorage.getItem("hk_transit_bookmarks");
      if (stored) {
        setBookmarks(JSON.parse(stored));
      }

      const storedCode = localStorage.getItem("hk_transit_sync_code");
      if (storedCode) {
        setSyncCode(storedCode.toUpperCase());
        fetchLatestFromSync(storedCode.toUpperCase());
      }
    } catch (e) {
      console.error("Local storage error:", e);
    }

    // Ping server connection
    const checkServer = async () => {
      try {
        const resp = await fetch("/api/kmb/routes"); // Warm-up endpoint
        if (resp.ok) {
          setServerStatus("ok");
        } else {
          setServerStatus("error");
        }
      } catch {
        setServerStatus("error");
      }
    };
    checkServer();
  }, []);

  const toggleBookmark = (bookmark: Bookmark) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === bookmark.id);
      let updated: Bookmark[];
      if (exists) {
        updated = prev.filter((b) => b.id !== bookmark.id);
      } else {
        updated = [...prev, bookmark];
      }
      localStorage.setItem("hk_transit_bookmarks", JSON.stringify(updated));

      // Trigger automatic server upload if a sync code is configured
      const currentCode = syncCode || localStorage.getItem("hk_transit_sync_code");
      if (currentCode) {
        fetch("/api/sync/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: currentCode.toUpperCase(), bookmarks: updated })
        }).catch((err) => console.error("Auto sync update failed:", err));
      }

      return updated;
    });
  };

  const handleCreateSyncCode = async (): Promise<string | null> => {
    try {
      setSyncLoading(true);
      setSyncError(null);
      const resp = await fetch("/api/sync/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarks })
      });
      const json = await resp.json();
      if (resp.ok && json.status === "ok") {
        const code = json.code.toUpperCase();
        setSyncCode(code);
        localStorage.setItem("hk_transit_sync_code", code);
        return code;
      } else {
        setSyncError(json.message || "建立同步碼失敗");
        return null;
      }
    } catch (err: any) {
      setSyncError(err.message || "網路錯誤");
      return null;
    } finally {
      setSyncLoading(false);
    }
  };

  const handleLoadSyncCode = async (code: string): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setSyncError("請輸入正確的同步碼");
      return false;
    }
    try {
      setSyncLoading(true);
      setSyncError(null);
      const resp = await fetch(`/api/sync/get/${cleanCode}`);
      const json = await resp.json();
      if (resp.ok && json.status === "ok" && Array.isArray(json.bookmarks)) {
        setBookmarks(json.bookmarks);
        localStorage.setItem("hk_transit_bookmarks", JSON.stringify(json.bookmarks));
        
        setSyncCode(cleanCode);
        localStorage.setItem("hk_transit_sync_code", cleanCode);
        return true;
      } else {
        setSyncError(json.message || "找不到該同步碼");
        return false;
      }
    } catch (err: any) {
      setSyncError(err.message || "網路錯誤");
      return false;
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDisconnectSync = () => {
    setSyncCode(null);
    localStorage.removeItem("hk_transit_sync_code");
    setSyncError(null);
  };

  const selectTab = (tab: "favorites" | "kmb" | "mtr") => {
    setActiveTab(tab);
  };

  return (
    <div id="app" className="min-h-screen bg-slate-50/70 font-sans antialiased text-slate-900 pb-16">
      {/* 1. Header Area with active Connection indications */}
      <header id="app-header" className="bg-white border-b border-slate-200/60 sticky top-0 z-50 shadow-2xs backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Minimalist modern transport launcher logo */}
            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-lg tracking-wider">
              易
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-none">香港乘車易</h1>
              <p className="text-[10px] text-slate-400 mt-1 font-mono tracking-wider uppercase">
                HK Transit ETA Dashboard
              </p>
            </div>
          </div>

          {/* Connected status badge to show custom local lazy routes caching success */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline-block">數據中心連接</span>
            <div
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                serverStatus === "ok"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : serverStatus === "connecting"
                  ? "bg-slate-100 text-slate-600 border border-slate-200"
                  : "bg-red-50 text-red-600 border border-red-100"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  serverStatus === "ok"
                    ? "bg-emerald-500 animate-pulse-live"
                    : serverStatus === "connecting"
                    ? "bg-amber-400 animate-spin border-t-transparent border border-slate-400"
                    : "bg-red-500"
                }`}
              />
              <span>{serverStatus === "ok" ? "已連線" : serverStatus === "connecting" ? "連線中" : "錯誤"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main content block centering */}
      <main id="app-main" className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* Welcome greeting card with hints */}
        <div id="welcome-hint-card" className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5 text-center md:text-left">
            <h2 className="text-lg font-bold tracking-tight">實時到站，一手掌握</h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              整合香港特區政府<strong>運輸署開放數據大聯盟</strong> API。為您提供最精準的九巴 (KMB) 及港鐵 (MTR) 列車抵站時間表，收藏喜愛車站即可實現閃電預估。
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-2xl border border-white/10 text-xs font-medium backdrop-blur-sm">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>智能伺服器快取已啟動</span>
          </div>
        </div>

        {/* 3. Navigation custom tabs layout */}
        <div id="tabs-navigation" className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center gap-1 mb-6 border border-slate-200/20">
          <button
            id="tab-btn-favorites"
            onClick={() => selectTab("favorites")}
            className={`flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "favorites"
                ? "bg-white text-slate-900 shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <Star className={`w-4 h-4 ${activeTab === "favorites" ? "fill-amber-500 text-amber-500" : ""}`} />
            <span>我的最愛</span>
            {bookmarks.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                {bookmarks.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-kmb"
            onClick={() => selectTab("kmb")}
            className={`flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "kmb"
                ? "bg-rose-600 text-white font-extrabold shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <Bus className="w-4 h-4" />
            <span>巴士查詢</span>
          </button>

          <button
            id="tab-btn-mtr"
            onClick={() => selectTab("mtr")}
            className={`flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "mtr"
                ? "bg-sky-600 text-white font-extrabold shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <Train className="w-4 h-4" />
            <span>港鐵車務</span>
          </button>
        </div>

        {/* 4. Active tab container with motion layout animations */}
        <div id="tab-content" className="min-h-96">
          <AnimatePresence mode="wait">
            {activeTab === "favorites" && (
              <motion.div
                key="favorites-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <FavoritesSection
                  bookmarks={bookmarks}
                  toggleBookmark={toggleBookmark}
                  onNavigateToTab={(tab) => {
                    setActiveTab(tab);
                  }}
                  syncCode={syncCode}
                  syncLoading={syncLoading}
                  syncError={syncError}
                  onCreateSyncCode={handleCreateSyncCode}
                  onLoadSyncCode={handleLoadSyncCode}
                  onDisconnectSync={handleDisconnectSync}
                  onTriggerRefresh={() => {
                    if (syncCode) {
                      fetchLatestFromSync(syncCode);
                    }
                  }}
                />
              </motion.div>
            )}

            {activeTab === "kmb" && (
              <motion.div
                key="kmb-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <KmbSection bookmarks={bookmarks} toggleBookmark={toggleBookmark} />
              </motion.div>
            )}

            {activeTab === "mtr" && (
              <motion.div
                key="mtr-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <MtrSection bookmarks={bookmarks} toggleBookmark={toggleBookmark} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* 5. Clean minimalist Footer */}
      <footer id="app-footer" className="text-center pt-16 text-[11px] text-slate-400 font-medium space-y-1.5">
        <div>香港乘車易 - 港鐵巴士實時出街智能抵站大看板</div>
        <div className="flex items-center justify-center gap-1 font-mono text-[9px]">
          <span>© 2026 HK TRANSIT EASY | DATA SOURCES: DATA.GOV.HK</span>
        </div>
      </footer>
    </div>
  );
}
