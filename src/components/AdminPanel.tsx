"use client";

import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, getFirebaseStatus } from "@/lib/firebase";
import type { BedSpace } from "@/types";
import {
  loadBedsFromStorage,
  getBedMetrics,
  STORAGE_KEY,
  ROOM_ORDER,
  ROOM_BED_COUNTS,
  BED_LABELS,
  getBedBySlot,
} from "@/lib/boarding";
import BedSpaceList from "./BedSpaceList";
import TenantBalanceList from "./TenantBalanceList";

type ViewMode = "beds" | "tenants";

export default function AdminPanel({ onOverdueCountChange }: { onOverdueCountChange?: (count: number) => void }) {
  const [view, setView] = useState<ViewMode>("beds");
  const [searchQuery, setSearchQuery] = useState("");
  const [beds, setBeds] = useState<BedSpace[]>([]);
  const [overdueCollapsed, setOverdueCollapsed] = useState(false);
  const firebaseStatus = getFirebaseStatus();
  const hasFirebase = firebaseStatus.isConfigured && firebaseStatus.db;

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

  const overdueTenants = useMemo(() => {
    return activeBeds
      .filter((bed) => {
        if (!bed.tenantName) return false;
        return getBedMetrics(bed).status === "overdue";
      })
      .map((bed) => {
        const metrics = getBedMetrics(bed);
        return {
          id: bed.id!,
          tenantName: bed.tenantName,
          house: bed.house,
          roomNumber: bed.roomNumber,
          bedNumber: bed.bedNumber,
          remainingBalance: metrics.remainingBalance,
          nextDueDate: metrics.nextDueDate,
        };
      });
  }, [activeBeds]);

  const stats = useMemo(() => {
    let totalBeds = 0;
    let occupied = 0;
    let available = 0;
    for (const [house, room] of ROOM_ORDER) {
      const key = `${house}-${room}`;
      const bedCount = ROOM_BED_COUNTS[key] ?? 1;
      for (let i = 0; i < bedCount; i++) {
        totalBeds++;
        const bed = getBedBySlot(activeBeds, house, room, BED_LABELS[i]);
        if (bed?.tenantName) occupied++;
        else available++;
      }
    }
    return { totalBeds, occupied, available, overdue: overdueTenants.length };
  }, [activeBeds, overdueTenants.length]);

  useEffect(() => {
    onOverdueCountChange?.(overdueTenants.length);
  }, [overdueTenants.length, onOverdueCountChange]);

  const totalOverdueBalance = overdueTenants.reduce((s, t) => s + t.remainingBalance, 0);

  return (
    <div className="space-y-5">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 stagger-children animate-fade-up">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Beds</p>
            <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100">{stats.totalBeds}</p>
          <p className="text-xs text-slate-600 mt-1">All bed slots</p>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-blue-500/70 uppercase tracking-wider">Occupied</p>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-300">{stats.occupied}</p>
          <p className="text-xs text-blue-600/70 mt-1">Active tenants</p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-emerald-500/70 uppercase tracking-wider">Available</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-300">{stats.available}</p>
          <p className="text-xs text-emerald-600/70 mt-1">Open beds</p>
        </div>

        <div className={`rounded-xl border p-4 ${stats.overdue > 0 ? "border-rose-500/20 bg-rose-500/5" : "border-slate-700/50 bg-slate-800/60"}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs font-medium uppercase tracking-wider ${stats.overdue > 0 ? "text-rose-500/70" : "text-slate-500"}`}>Overdue</p>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stats.overdue > 0 ? "bg-rose-500/10" : "bg-slate-700/60"}`}>
              <svg className={`w-3.5 h-3.5 ${stats.overdue > 0 ? "text-rose-400" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className={`text-2xl font-bold ${stats.overdue > 0 ? "text-rose-300" : "text-slate-400"}`}>{stats.overdue}</p>
          <p className={`text-xs mt-1 ${stats.overdue > 0 ? "text-rose-600/70" : "text-slate-600"}`}>
            {stats.overdue > 0 ? `₱${totalOverdueBalance.toLocaleString()} owed` : "All paid up"}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <button
          type="button"
          onClick={() => setView("beds")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
            view === "beds"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Bed Management
        </button>
        <button
          type="button"
          onClick={() => setView("tenants")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
            view === "tenants"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Tenant Balance
        </button>
      </div>

      {/* Search Bar */}
      <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchQuery("")}
            placeholder={
              view === "beds"
                ? "Search tenants, rooms, or beds..."
                : "Search by name, room, or status..."
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-11 pr-10 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Overdue Tenants Alert */}
      {overdueTenants.length > 0 && (
        <div id="overdue-tenants-section" className="rounded-xl border border-rose-500/25 bg-rose-500/5 overflow-hidden">
          {/* Header - clickable to collapse */}
          <button
            type="button"
            onClick={() => setOverdueCollapsed(!overdueCollapsed)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-rose-500/10 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-rose-300">
                  {overdueTenants.length} Overdue {overdueTenants.length === 1 ? "Tenant" : "Tenants"}
                </p>
                <p className="text-xs text-rose-500/80">
                  Total balance due: ₱{totalOverdueBalance.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-xs text-rose-600/70">
                {overdueCollapsed ? "Show" : "Hide"}
              </span>
              <svg
                className={`w-4 h-4 text-rose-500 transition-transform duration-200 ${overdueCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </button>

          {/* List */}
          {!overdueCollapsed && (
            <div className="px-4 pb-4 space-y-2 border-t border-rose-500/15">
              <div className="pt-3 space-y-2">
                {overdueTenants.slice(0, 10).map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between rounded-xl border border-rose-500/15 bg-rose-500/8 px-4 py-3 hover:bg-rose-500/12 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-rose-300">
                          {tenant.tenantName?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{tenant.tenantName}</p>
                        <p className="text-xs text-slate-500">
                          House {tenant.house} · Room {tenant.roomNumber} · Bed {tenant.bedNumber}
                        </p>
                        {tenant.nextDueDate && (
                          <p className="text-xs text-rose-500 mt-0.5">Due: {tenant.nextDueDate}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-rose-300">₱{tenant.remainingBalance.toLocaleString()}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-xs font-medium text-rose-400">
                        Overdue
                      </span>
                    </div>
                  </div>
                ))}
                {overdueTenants.length > 10 && (
                  <p className="text-center text-xs text-rose-500/70 pt-1">
                    +{overdueTenants.length - 10} more overdue tenants in the list below
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Content */}
      <div className="min-h-[400px]">
        {view === "beds" && (
          <BedSpaceList canEdit searchQuery={searchQuery} variant="admin" />
        )}
        {view === "tenants" && (
          <TenantBalanceList canEdit searchQuery={searchQuery} variant="admin" />
        )}
      </div>
    </div>
  );
}
