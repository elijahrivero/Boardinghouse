"use client";

import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BedSpace } from "@/types";
import { loadBedsFromStorage, getBedMetrics, STORAGE_KEY } from "@/lib/boarding";
import BedSpaceList from "./BedSpaceList";
import TenantBalanceList from "./TenantBalanceList";

type ViewMode = "beds" | "tenants";

export default function AdminPanel({ onOverdueCountChange }: { onOverdueCountChange?: (count: number) => void }) {
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

  const overdueTenants = useMemo(() => {
    return activeBeds
      .filter(bed => {
        if (!bed.tenantName) return false;
        const metrics = getBedMetrics(bed);
        return metrics.status === "overdue";
      })
      .map(bed => {
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

  useEffect(() => {
    if (onOverdueCountChange) {
      onOverdueCountChange(overdueTenants.length);
    }
  }, [overdueTenants.length, onOverdueCountChange]);

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

      {/* Overdue Tenants Section - Admin Only */}
      {overdueTenants.length > 0 && (
        <div id="overdue-tenants-section" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-rose-300 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-1.908 0-.153-.015-.345-.015-.508 0-.214.015-.459.015-.637 0-.577-.015-.939.015-1.511 0-.807-.015-1.466.015-2.043 0-1.755-.015-3.255.015-4.71 0-2.773 1.702-4.746 4.746-4.746 1.326 0 2.553 1.702 4.746 4.746 4.746 0 0 1.326-1.702 4.746-4.746z" />
              </svg>
              Overdue Tenants ({overdueTenants.length})
            </h3>
            <span className="text-sm text-rose-400">
              Total: ₱{overdueTenants.reduce((sum, tenant) => sum + tenant.remainingBalance, 0).toLocaleString()}
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {overdueTenants.slice(0, 10).map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 sm:p-4"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-100">{tenant.tenantName}</p>
                  <p className="text-sm text-slate-400">
                    House {tenant.house} • Room {tenant.roomNumber} • Bed {tenant.bedNumber}
                  </p>
                  {tenant.nextDueDate && (
                    <p className="text-xs text-rose-400 mt-1">Due: {tenant.nextDueDate}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-rose-300">
                    ₱{tenant.remainingBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-rose-400">Overdue</p>
                </div>
              </div>
            ))}
            {overdueTenants.length > 10 && (
              <p className="text-center text-sm text-rose-400 pt-2">
                ... and {overdueTenants.length - 10} more overdue tenants
              </p>
            )}
          </div>
        </div>
      )}

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
