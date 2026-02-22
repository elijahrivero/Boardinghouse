"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BedSpace } from "@/types";
import {
  loadBedsFromStorage,
  getBedMetrics,
  ROOM_ORDER,
  ROOM_BED_COUNTS,
  BED_LABELS,
  getBedBySlot,
  getPayments,
  STORAGE_KEY,
} from "@/lib/boarding";
import BedModal from "./BedModal";

const STATUS_STYLES = {
  available: "bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10",
  paid: "bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10",
  overdue: "bg-rose-500/30 text-rose-200 border-rose-500/40 shadow-sm shadow-rose-500/10",
  due_soon: "bg-amber-500/30 text-amber-200 border-amber-500/40 shadow-sm shadow-amber-500/10",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  paid: "Paid",
  overdue: "Overdue",
  due_soon: "Partial",
};

export default function Dashboard() {
  const [beds, setBeds] = useState<BedSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalBed, setModalBed] = useState<BedSpace | Partial<BedSpace> | null>(null);
  const hasFirebase = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && db);

  useEffect(() => {
    if (!hasFirebase || !db) {
      const load = () => setBeds(loadBedsFromStorage());
      load();
      setLoading(false);
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
    setLoading(false);
    return () => unsubscribe();
  }, [hasFirebase]);

  const activeBeds = useMemo(() => beds.filter((b) => !b.deletedAt), [beds]);

  const { stats, filteredRooms, monthlyIncome, overdueTenants, recentPayments } = useMemo(() => {
    let totalBeds = 0;
    let occupied = 0;
    let available = 0;
    let overdue = 0;
    let totalTenants = 0;
    let monthlyIncome = 0;
    
    const overdueTenants: Array<{
      id: string;
      tenantName: string;
      house: string;
      roomNumber: string;
      bedNumber: string;
      remainingBalance: number;
      nextDueDate?: string;
    }> = [];
    
    const recentPayments: Array<{
      tenantName: string;
      amount: number;
      date: string;
      house: string;
      roomNumber: string;
    }> = [];

    const q = searchQuery.toLowerCase().trim();

    type RoomBed = {
      bed: BedSpace | undefined;
      bedLetter: string;
      metrics?: ReturnType<typeof getBedMetrics>;
    };

    const roomData: Array<{
      house: string;
      room: string;
      key: string;
      beds: RoomBed[];
      availableCount: number;
      overdueCount: number;
    }> = [];

    for (const [house, room] of ROOM_ORDER) {
      const key = `${house}-${room}`;
      const bedCount = ROOM_BED_COUNTS[key] ?? 1;
      const roomBeds: RoomBed[] = [];

      for (let i = 0; i < bedCount; i++) {
        const bedLetter = BED_LABELS[i];
        const bed = getBedBySlot(activeBeds, house, room, bedLetter);
        totalBeds++;

        if (bed?.tenantName) {
          occupied++;
          totalTenants++;
          const metrics = getBedMetrics(bed);
          monthlyIncome += metrics.monthlyRent || 0;
          
          if (metrics.status === "overdue") {
            overdue++;
            overdueTenants.push({
              id: bed.id!,
              tenantName: bed.tenantName,
              house,
              roomNumber: room,
              bedNumber: bedLetter,
              remainingBalance: metrics.remainingBalance,
              nextDueDate: metrics.nextDueDate,
            });
          }

          // Get recent payments (last 5)
          const payments = getPayments(bed);
          payments.slice(-5).forEach(payment => {
            recentPayments.push({
              tenantName: bed.tenantName || '',
              amount: payment.amount,
              date: payment.date,
              house,
              roomNumber: room,
            });
          });

          const matchesSearch =
            !q ||
            (bed.tenantName && bed.tenantName.toLowerCase().includes(q)) ||
            room.toLowerCase().includes(q) ||
            house.toLowerCase().includes(q) ||
            bedLetter.toLowerCase().includes(q) ||
            STATUS_LABELS[metrics.status]?.toLowerCase().includes(q);

          if (matchesSearch) {
            roomBeds.push({ bed, bedLetter, metrics });
          }
        } else {
          available++;
          const matchesSearch =
            !q ||
            room.toLowerCase().includes(q) ||
            house.toLowerCase().includes(q) ||
            bedLetter.toLowerCase().includes(q) ||
            "available".includes(q);
          if (matchesSearch) roomBeds.push({ bed: undefined, bedLetter });
        }
      }

      if (roomBeds.length > 0) {
        const displayOverdue = roomBeds.filter(
          (rb) => rb.metrics?.status === "overdue"
        ).length;
        roomData.push({
          house,
          room,
          key,
          beds: roomBeds,
          availableCount: roomBeds.filter((rb) => !rb.bed?.tenantName).length,
          overdueCount: displayOverdue,
        });
      }
    }

    // Sort recent payments by date (newest first)
    recentPayments.sort((a, b) => b.date.localeCompare(a.date));

    return {
      stats: { totalBeds, occupied, available, overdue, totalTenants, monthlyIncome },
      filteredRooms: roomData,
      monthlyIncome,
      overdueTenants,
      recentPayments: recentPayments.slice(0, 10), // Show only last 10 payments
    };
  }, [activeBeds, searchQuery]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative inline-flex items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg">🏠</span>
            </div>
          </div>
          <p className="text-slate-400 animate-pulse">Loading boarding house data...</p>
          <p className="text-sm text-slate-500">Please wait while we fetch the latest information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Dashboard Overview Header */}
      <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-r from-slate-800/70 to-slate-800/50 p-4 sm:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-2 flex items-center gap-2">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
              Dashboard Overview
            </h2>
            <p className="text-sm text-slate-400">
              Real-time insights into your boarding house performance
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-slate-400">Occupancy Rate</p>
              <p className="text-lg font-semibold text-emerald-400">
                {stats.totalBeds > 0 ? Math.round((stats.occupied / stats.totalBeds) * 100) : 0}%
              </p>
              <div className="w-16 h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalBeds > 0 ? (stats.occupied / stats.totalBeds) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <p className="text-slate-400">Monthly Revenue</p>
              <p className="text-lg font-semibold text-amber-400">
                ₱{monthlyIncome.toLocaleString()}
              </p>
              <div className="w-16 h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Tenants", value: stats.totalTenants, icon: "users" },
          { label: "Total Beds", value: stats.totalBeds, icon: "bed" },
          { label: "Occupied", value: stats.occupied, icon: "check-circle" },
          { label: "Available", value: stats.available, icon: "home" },
          { label: "Monthly Income", value: `₱${monthlyIncome.toLocaleString()}`, icon: "currency-dollar" },
          { label: "Overdue", value: stats.overdue, icon: "exclamation-triangle" },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="group rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 sm:p-4 shadow-lg backdrop-blur transition hover:border-slate-600/50 hover:bg-slate-800/70 cursor-help"
            title={`Click to view details about ${label.toLowerCase()}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {icon === "users" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 8 4 4 0 008-4 4 4 0 00-8 4zM4 12a8 8 0 018 8 8 8 0 01-8-8z" />}
                {icon === "bed" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l2 2m6-2l2 2m0 0l-2-2m-8 8V5a2 2 0 012-2h8a2 2 0 012 2v14l-3-3m0 0l3 3m-3-3h6" />}
                {icon === "check-circle" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                {icon === "home" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l2 2m6-2l2 2m0 0l-2-2m-8 8V5a2 2 0 012-2h8a2 2 0 012 2v14l-3-3m0 0l3 3m-3-3h6" />}
                {icon === "currency-dollar" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 3 3 3 .895 3 3-3 1.657 0 3-.895 3-3z" />}
                {icon === "exclamation-triangle" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-1.908 0-.153-.015-.345-.015-.508 0-.214.015-.459.015-.637 0-.577-.015-.939.015-1.511 0-.807-.015-1.466.015-2.043 0-1.755-.015-3.255.015-4.71 0-2.773 1.702-4.746 4.746-4.746 1.326 0 2.553 1.702 4.746 4.746 4.746 0 0 1.326-1.702 4.746-4.746z" />}
              </svg>
              <p className="text-xs sm:text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                {label}
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-slate-100">
              {value}
            </p>
            <div className="mt-2 text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {label === "Tenants" && "Total number of tenants"}
              {label === "Total Beds" && "Total number of beds across all rooms"}
              {label === "Occupied" && "Beds currently occupied by tenants"}
              {label === "Available" && "Beds ready for new tenants"}
              {label === "Monthly Income" && "Expected monthly rent collection"}
              {label === "Overdue" && "Tenants with overdue payments"}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative rounded-xl sm:rounded-2xl border border-slate-600 bg-slate-800 p-2 sm:p-3 shadow-lg">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery("");
              }
            }}
            placeholder="Search tenants, rooms, or beds... (ESC to clear)"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 pl-9 sm:pl-10 pr-10 py-2.5 sm:py-3 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Search tenants, rooms, or beds"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 sm:right-3 top-1/2 flex h-6 w-6 sm:h-5 sm:w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-3 w-3 sm:h-4 sm:w-4">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Overdue Tenants */}
      {overdueTenants.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5">
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
            {overdueTenants.slice(0, 5).map((tenant) => (
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
            {overdueTenants.length > 5 && (
              <p className="text-center text-sm text-rose-400 pt-2">
                ... and {overdueTenants.length - 5} more overdue tenants
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Payments Activity */}
      {recentPayments.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-emerald-300 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 3 3 3 .895 3 3-3 1.657 0 3-.895 3-3z" />
              </svg>
              Recent Payments
            </h3>
            <span className="text-sm text-emerald-400">
              Last {recentPayments.length} payments
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {recentPayments.map((payment, index) => (
              <div
                key={`${payment.tenantName}-${payment.date}-${index}`}
                className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 sm:p-4"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-100">{payment.tenantName}</p>
                  <p className="text-sm text-slate-400">
                    House {payment.house} • Room {payment.roomNumber}
                  </p>
                  <p className="text-xs text-emerald-400 mt-1">
                    {new Date(payment.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-300">
                    +₱{payment.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-emerald-400">Paid</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {filteredRooms.map(({ house, room, key, beds: roomBeds, availableCount, overdueCount }) => (
          <div
            key={key}
            className="rounded-xl sm:rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5 shadow-lg transition hover:border-slate-600/50"
          >
            <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-slate-100">
                Room {room} — House {house}
              </h3>
              <div className="flex gap-2 text-xs sm:text-sm text-slate-400">
                <span>{availableCount} available</span>
                {overdueCount > 0 && (
                  <span className="text-rose-400">{overdueCount} overdue</span>
                )}
              </div>
            </div>
            <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-slate-500">
              {roomBeds.length} bed{roomBeds.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-2 sm:space-y-3">
              {roomBeds.map(({ bed, bedLetter, metrics }) => (
                <button
                  type="button"
                  key={`${key}-${bedLetter}`}
                  onClick={() =>
                    setModalBed(
                      bed ?? {
                        house,
                        roomNumber: room,
                        bedNumber: bedLetter,
                        status: "available",
                      }
                    )
                  }
                  onTouchStart={(e) => {
                    // Add haptic feedback on touch devices
                    if ('vibrate' in navigator) {
                      navigator.vibrate(50);
                    }
                  }}
                  className="group w-full rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 sm:p-5 text-left transition-all duration-200 hover:border-slate-600/70 hover:bg-slate-800/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-500 active:bg-slate-800/80 touch-manipulation"
                  aria-label={`Bed ${bedLetter} - ${bed?.tenantName ? `Occupied by ${bed.tenantName}` : 'Available'}${metrics ? ` - Status: ${STATUS_LABELS[metrics.status]}` : ''}`}
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {bed?.tenantName ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 8z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l2 2m6-2l2 2m0 0l-2-2m-8 8V5a2 2 0 012-2h8a2 2 0 012 2v14l-3-3m0 0l3 3m-3-3h6" />
                        )}
                      </svg>
                      <span className="text-sm sm:font-medium text-slate-200 group-hover:text-slate-100 transition-colors">
                        Bed {bedLetter}
                      </span>
                    </div>
                    <span
                      className={`rounded-lg border px-2 py-1 sm:px-2.5 sm:py-0.5 text-xs font-medium transition-all duration-300 animate-fade-in ${
                        bed?.tenantName
                          ? STATUS_STYLES[metrics?.status ?? "paid"]
                          : STATUS_STYLES.available
                      }`}
                    >
                      {bed?.tenantName
                        ? STATUS_LABELS[metrics?.status ?? "paid"]
                        : "Available"}
                    </span>
                  </div>
                  {bed?.tenantName && metrics && (
                    <div className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 text-xs sm:text-sm">
                      <p className="font-medium text-slate-100 group-hover:text-white transition-colors">
                        {bed.tenantName}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400">
                          Balance: <span className="font-medium text-slate-300">₱{metrics.remainingBalance.toLocaleString()}</span>
                        </p>
                        {metrics.status === "overdue" && (
                          <span className="text-xs text-rose-400 font-medium">⚠️ Overdue</span>
                        )}
                      </div>
                      {metrics.nextDueDate && (
                        <p className="text-slate-500 text-xs">
                          📅 Due: {metrics.nextDueDate}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
          {searchQuery ? (
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-2">No results found</h3>
                <p className="text-slate-400 mb-4">
                  No rooms or tenants match "{searchQuery}"
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear search
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-2">No rooms configured yet</h3>
                <p className="text-slate-400">
                  Start by adding rooms and beds to manage your boarding house
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {modalBed && (
        <BedModal
          bed={modalBed}
          mode="view"
          onClose={() => setModalBed(null)}
          onSave={async () => {}}
          onDelete={async () => {}}
          saving={false}
          canEdit={false}
        />
      )}
    </div>
  );
}
