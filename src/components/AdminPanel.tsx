"use client";

import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BedSpace } from "@/types";
import { loadBedsFromStorage, getBedMetrics, STORAGE_KEY } from "@/lib/boarding";
import BedSpaceList from "./BedSpaceList";
import TenantBalanceList from "./TenantBalanceList";

type ViewMode = "beds" | "tenants";

export default function AdminPanel() {
  const [view, setView] = useState<ViewMode>("beds");
  const [searchQuery, setSearchQuery] = useState("");
  const [beds, setBeds] = useState<BedSpace[]>([]);
  const hasFirebase = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && db);

  useEffect(() => {
    if (!hasFirebase || !db) {
      const load = () => setBeds(loadBedsFromStorage());
      load();
      const onStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) load();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    const unsubscribe = onSnapshot(
      collection(db, "beds"),
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as BedSpace[];
        setBeds(data);
      },
      () => setBeds(loadBedsFromStorage())
    );
    return () => unsubscribe();
  }, [hasFirebase]);

  const activeBeds = beds.filter((b) => !b.deletedAt);

  return (
    <div className="space-y-6">
      {/* Segmented Control */}
      <div className="inline-flex rounded-2xl border border-slate-600 bg-slate-800/80 p-1">
        <button
          type="button"
          onClick={() => setView("beds")}
          className={`rounded-xl px-6 py-2.5 text-sm font-medium transition ${
            view === "beds"
              ? "bg-slate-600 text-slate-100 shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Bed Space Management
        </button>
        <button
          type="button"
          onClick={() => setView("tenants")}
          className={`rounded-xl px-6 py-2.5 text-sm font-medium transition ${
            view === "tenants"
              ? "bg-slate-600 text-slate-100 shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Tenant Balance
        </button>
      </div>

      {/* Sticky Search Bar */}
      <div className="sticky top-[73px] z-20 -mx-4 bg-slate-950/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-950/90 sm:-mx-6 sm:px-6">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            view === "beds"
              ? "Search by tenant, room, or bed..."
              : "Search by tenant, room, bed, or status..."
          }
          className="w-full rounded-2xl border border-slate-600 bg-slate-800 px-5 py-3.5 text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
        />
      </div>

      {/* View Content */}
      <div className="min-h-[400px]">
        {view === "beds" && (
          <BedSpaceList
            canEdit
            searchQuery={searchQuery}
            variant="admin"
          />
        )}
        {view === "tenants" && (
          <TenantBalanceList
            canEdit
            searchQuery={searchQuery}
            variant="admin"
          />
        )}
      </div>
    </div>
  );
}
