"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, deleteDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, getFirebaseStatus } from "@/lib/firebase";
import type { BedSpace, TenantBalance, TenantPaymentStatus, PaymentRecord } from "@/types";

const STORAGE_KEY = "riverobh-beds";

function loadBedsFromStorage(): BedSpace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBedsToStorage(beds: BedSpace[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(beds));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

function getPayments(bed: BedSpace): PaymentRecord[] {
  if (bed.payments?.length) return bed.payments;
  if ((bed.amountPaid ?? 0) > 0) {
    return [{ date: new Date().toISOString().slice(0, 10), amount: bed.amountPaid! }];
  }
  return [];
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function getNextDueDate(moveInDate: string): string {
  if (!moveInDate) return "";
  return addMonths(moveInDate, 1);
}

function getMonthsOwed(moveInDate: string, monthlyRent: number): number {
  if (!moveInDate || monthlyRent <= 0) return 0;
  const moveIn = new Date(moveInDate + "T12:00:00");
  const firstDue = new Date(moveIn);
  firstDue.setMonth(firstDue.getMonth() + 1);
  const now = new Date();
  if (now < firstDue) return 0;
  let count = 0;
  let d = new Date(firstDue);
  while (d <= now) { count++; d.setMonth(d.getMonth() + 1); }
  return count;
}

function computeStatus(totalOwed: number, totalPaid: number, monthlyRent: number): TenantPaymentStatus {
  const remaining = totalOwed - totalPaid;
  if (totalOwed === 0 && totalPaid === 0) return "due_soon";
  if (remaining <= 0) return "paid";
  if (remaining <= monthlyRent * 0.5) return "due_soon";
  return "overdue";
}

function bedsToTenants(beds: BedSpace[], deletedOnly = false): TenantBalance[] {
  return beds
    .filter((b) => b.tenantName?.trim() && (deletedOnly ? !!b.deletedAt : !b.deletedAt))
    .map((b) => {
      const monthlyRent = b.monthlyRent ?? 0;
      const payments = getPayments(b);
      const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const moveInDate = b.moveInDate ?? "";
      const monthsOwed = getMonthsOwed(moveInDate, monthlyRent);
      const totalOwed = monthsOwed * monthlyRent;
      const remainingBalance = Math.max(0, totalOwed - amountPaid);
      const status = computeStatus(totalOwed, amountPaid, monthlyRent);
      const nextDueDate = getNextDueDate(moveInDate);
      return {
        id: b.id,
        tenantName: b.tenantName!,
        roomNumber: `House ${b.house ?? "1"} — Room ${b.roomNumber ?? ""}`,
        bedNumber: b.bedNumber ?? "",
        moveInDate,
        monthlyRent,
        amountPaid,
        remainingBalance,
        status,
        payments,
        nextDueDate,
      };
    });
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  paid: {
    label: "Paid",
    badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    dot: "bg-emerald-400",
    row: "",
  },
  due_soon: {
    label: "Due Soon",
    badge: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    dot: "bg-amber-400",
    row: "",
  },
  overdue: {
    label: "Overdue",
    badge: "bg-rose-500/15 text-rose-400 border border-rose-500/20",
    dot: "bg-rose-400",
    row: "bg-rose-500/[0.04]",
  },
};

// ── Tenant Edit Modal ──────────────────────────────────────────────────────────
interface EditModalProps {
  tenant: TenantBalance;
  bed: BedSpace;
  onClose: () => void;
  onSetRent: (id: string, monthlyRent: number) => Promise<void>;
  onAddPayment: (id: string, date: string, amount: number, method: "cash" | "gcash") => Promise<void>;
  canEdit?: boolean;
}

function TenantEditModal({ tenant, bed, onClose, onSetRent, onAddPayment, canEdit = true }: EditModalProps) {
  const [monthlyRent, setMonthlyRent] = useState(String(tenant.monthlyRent || ""));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash");
  const [saving, setSaving] = useState(false);

  const rentLocked = (tenant.monthlyRent ?? 0) > 0;
  const cfg = STATUS_CONFIG[tenant.status];

  const handleSetRent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rentLocked) return;
    const rent = parseFloat(monthlyRent) || 0;
    if (rent <= 0) return;
    setSaving(true);
    try { await onSetRent(tenant.id, rent); } finally { setSaving(false); }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) return;
    setSaving(true);
    try {
      await onAddPayment(tenant.id, paymentDate, amount, paymentMethod);
      setPaymentAmount("");
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/60 animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700/60 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
              <span className="text-sm font-bold text-indigo-400">
                {tenant.tenantName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">{tenant.tenantName}</h3>
              <p className="text-xs text-slate-500">{tenant.roomNumber} · Bed {tenant.bedNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Balance Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Monthly Rent</p>
              <p className="text-base font-bold text-slate-100">₱{tenant.monthlyRent.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Total Paid</p>
              <p className="text-base font-bold text-emerald-400">₱{tenant.amountPaid.toLocaleString()}</p>
            </div>
            <div className={`rounded-xl border p-3 text-center ${tenant.remainingBalance > 0 ? "bg-rose-500/8 border-rose-500/20" : "bg-slate-800/60 border-slate-700/50"}`}>
              <p className="text-xs text-slate-500 mb-1">Balance</p>
              <p className={`text-base font-bold ${tenant.remainingBalance > 0 ? "text-rose-400" : "text-slate-100"}`}>
                ₱{tenant.remainingBalance.toLocaleString()}
              </p>
            </div>
          </div>

          {tenant.nextDueDate && tenant.monthlyRent > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-800/40 border border-slate-700/40 px-4 py-2.5">
              <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-400">
                Next due: <span className="font-medium text-slate-200">{tenant.nextDueDate}</span>
              </p>
            </div>
          )}

          {/* Monthly Rent Setting */}
          {canEdit && !rentLocked && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Set Monthly Rent</h4>
              <form onSubmit={handleSetRent} className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  placeholder="Enter amount"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
                <button
                  type="submit"
                  disabled={saving || !monthlyRent}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  Set
                </button>
              </form>
            </div>
          )}

          {/* Add Payment */}
          {canEdit && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Record Payment</h4>
              <form onSubmit={handleAddPayment} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Amount (₱)"
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex rounded-xl border border-slate-700 bg-slate-800 overflow-hidden flex-1">
                    {(["cash", "gcash"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`flex-1 py-2.5 text-sm font-medium transition ${
                          paymentMethod === method
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {method === "cash" ? "Cash" : "GCash"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={saving || !paymentAmount}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Payment History */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Payment History</h4>
            {tenant.payments.length === 0 ? (
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-5 text-center">
                <p className="text-sm text-slate-500">No payments recorded yet</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 divide-y divide-slate-700/40 overflow-hidden">
                {[...tenant.payments]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-200">{p.date}</p>
                        {p.method && (
                          <span className={`text-xs capitalize px-1.5 py-0.5 rounded-md mt-0.5 inline-block ${
                            p.method === "gcash"
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-slate-700/60 text-slate-400"
                          }`}>
                            {p.method}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-emerald-400 tabular-nums">₱{p.amount.toLocaleString()}</span>
                    </div>
                  ))}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-700/20">
                  <span className="text-sm font-semibold text-slate-300">Total Paid</span>
                  <span className="font-bold text-emerald-400 tabular-nums">₱{tenant.amountPaid.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface TenantBalanceListProps {
  canEdit?: boolean;
  searchQuery?: string;
  variant?: "default" | "admin";
}

export default function TenantBalanceList({ canEdit = true, searchQuery: externalSearch = "", variant = "default" }: TenantBalanceListProps) {
  const [tenants, setTenants] = useState<TenantBalance[]>([]);
  const [beds, setBeds] = useState<BedSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTenant, setEditingTenant] = useState<TenantBalance | null>(null);
  const [internalSearch, setInternalSearch] = useState("");
  const searchQuery = variant === "admin" ? externalSearch : internalSearch;
  const [trashOpen, setTrashOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const firebaseStatus = getFirebaseStatus();
  const hasFirebase = firebaseStatus.isConfigured && firebaseStatus.db;

  const trashTenants = bedsToTenants(beds, true);
  const filteredTenants = tenants.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      t.tenantName.toLowerCase().includes(q) ||
      t.roomNumber.toLowerCase().includes(q) ||
      t.bedNumber.toLowerCase().includes(q) ||
      (t.moveInDate ?? "").includes(q)
    );
  });

  useEffect(() => {
    if (!hasFirebase || !db) {
      const load = () => {
        const data = loadBedsFromStorage();
        setBeds(data);
        setTenants(bedsToTenants(data));
      };
      load();
      setLoading(false);
      const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) load(); };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    const unsubscribe = onSnapshot(
      collection(db, "beds"),
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })) as BedSpace[];
        setBeds(data);
        setTenants(bedsToTenants(data));
        setError(null);
      },
      () => {
        const data = loadBedsFromStorage();
        setBeds(data);
        setTenants(bedsToTenants(data));
        setError("Could not load from Firebase. Showing local data.");
      }
    );
    setLoading(false);
    return () => unsubscribe();
  }, [hasFirebase]);

  const handleSetRent = useCallback(
    async (id: string, monthlyRent: number) => {
      try {
        if (hasFirebase && db) {
          await updateDoc(doc(db, "beds", id), { monthlyRent, updatedAt: serverTimestamp() });
        } else {
          const updated = beds.map((b) => (b.id === id ? { ...b, monthlyRent } : b));
          saveBedsToStorage(updated);
          setBeds(updated);
          setTenants(bedsToTenants(updated));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    },
    [hasFirebase, beds]
  );

  const handleAddPayment = useCallback(
    async (id: string, date: string, amount: number, method: "cash" | "gcash" = "cash") => {
      try {
        const bed = beds.find((b) => b.id === id);
        if (!bed) return;
        const payments = getPayments(bed);
        const newPayments = [...payments, { date, amount, method }].sort((a, b) => a.date.localeCompare(b.date));
        if (hasFirebase && db) {
          await updateDoc(doc(db, "beds", id), { payments: newPayments, updatedAt: serverTimestamp() });
        } else {
          const updated = beds.map((b) => (b.id === id ? { ...b, payments: newPayments } : b));
          saveBedsToStorage(updated);
          setBeds(updated);
          setTenants(bedsToTenants(updated));
        }
      } catch (error) {
        console.error("Failed to add payment:", error);
        throw error;
      }
    },
    [beds, hasFirebase]
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setDeleteConfirm({ id, name });
  }, []);

  const handleDeleteConfirm = useCallback(
    async (id: string) => {
      setDeleteConfirm(null);
      const deletedAt = new Date().toISOString();
      try {
        if (hasFirebase && db) {
          await updateDoc(doc(db, "beds", id), { deletedAt, updatedAt: serverTimestamp() });
        } else {
          const updated = beds.map((b) => (b.id === id ? { ...b, deletedAt } : b));
          saveBedsToStorage(updated);
          setBeds(updated);
          setTenants(bedsToTenants(updated));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to move to trash.");
      }
    },
    [hasFirebase, beds]
  );

  const handleRestore = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      try {
        if (hasFirebase && db) {
          await updateDoc(doc(db, "beds", id), { deletedAt: null, updatedAt: serverTimestamp() });
        } else {
          const updated = beds.map((b) => (b.id === id ? { ...b, deletedAt: undefined } : b));
          saveBedsToStorage(updated);
          setBeds(updated);
          setTenants(bedsToTenants(updated));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to restore.");
      }
    },
    [hasFirebase, beds]
  );

  const handleDeletePermanently = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("Permanently delete this tenant? This cannot be undone.")) return;
      try {
        if (hasFirebase && db) {
          await deleteDoc(doc(db, "beds", id));
        } else {
          const updated = beds.filter((b) => b.id !== id);
          saveBedsToStorage(updated);
          setBeds(updated);
          setTenants(bedsToTenants(updated));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete permanently.");
      }
    },
    [hasFirebase, beds]
  );

  const editingBed = editingTenant ? beds.find((b) => b.id === editingTenant.id) : null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  const isAdmin = variant === "admin";
  const showSearchInList = !isAdmin && tenants.length > 0;

  // ── Default (non-admin) variant ─────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        {error && <p className="rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</p>}
        {showSearchInList && (
          <div className="flex gap-2">
            <input
              type="search"
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              placeholder="Search by name, room, or bed..."
              className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
            <button
              type="button"
              onClick={() => setInternalSearch("")}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Clear
            </button>
          </div>
        )}
        {tenants.length === 0 ? (
          <p className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center text-stone-600">
            No tenants yet. Add a tenant in the Bed Spaces section to see them here.
          </p>
        ) : filteredTenants.length === 0 ? (
          <p className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center text-stone-600">
            No tenants match &quot;{searchQuery}&quot;
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-lg">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  {["Tenant", "Room / Bed", "Move-in", "Monthly Rent", "Next Due", "Paid", "Balance", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                  ))}
                  {canEdit && <th className="w-16 px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((t) => {
                  const cfg = STATUS_CONFIG[t.status];
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setEditingTenant(t)}
                      className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50 transition"
                    >
                      <td className="px-4 py-3 font-medium text-stone-900">{t.tenantName}</td>
                      <td className="px-4 py-3 text-stone-600">{t.roomNumber} / Bed {t.bedNumber}</td>
                      <td className="px-4 py-3 text-stone-600">{t.moveInDate || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-stone-700">₱{t.monthlyRent.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{t.nextDueDate || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-stone-700">₱{t.amountPaid.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-stone-900">₱{t.remainingBalance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(e, t.id, t.tenantName)}
                            className="rounded p-1.5 text-rose-500 hover:bg-rose-50 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && trashTenants.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-stone-50">
            <button
              type="button"
              onClick={() => setTrashOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-stone-100 transition"
            >
              <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm font-medium text-stone-600">Trash ({trashTenants.length})</span>
              <svg className={`ml-auto w-4 h-4 text-stone-400 transition-transform ${trashOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {trashOpen && (
              <div className="overflow-x-auto border-t border-stone-200">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-100">
                      {["Tenant", "Room / Bed", "Deleted", ""].map((h, i) => (
                        <th key={i} className={`px-4 py-2 text-sm font-medium text-stone-600 ${i > 1 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trashTenants.map((t) => {
                      const bed = beds.find((b) => b.id === t.id);
                      return (
                        <tr key={t.id} className="border-b border-stone-100 last:border-0">
                          <td className="px-4 py-3 text-stone-700">{t.tenantName}</td>
                          <td className="px-4 py-3 text-stone-600">{t.roomNumber} / Bed {t.bedNumber}</td>
                          <td className="px-4 py-3 text-right text-sm text-stone-500">
                            {bed?.deletedAt ? new Date(bed.deletedAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={(e) => handleRestore(e, t.id)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100">Restore</button>
                              <button type="button" onClick={(e) => handleDeletePermanently(e, t.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="mb-5 text-stone-700">Remove <span className="font-medium">{deleteConfirm.name}</span>? They'll be moved to trash.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700">Cancel</button>
                <button type="button" onClick={() => handleDeleteConfirm(deleteConfirm.id)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
              </div>
            </div>
          </div>
        )}
        {editingTenant && editingBed && (
          <TenantEditModal tenant={editingTenant} bed={editingBed} onClose={() => setEditingTenant(null)} onSetRent={handleSetRent} onAddPayment={handleAddPayment} canEdit={canEdit} />
        )}
      </div>
    );
  }

  // ── Admin variant ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-10 text-center">
          <p className="text-slate-400">No tenants yet. Add a tenant in Bed Management to see them here.</p>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-10 text-center">
          <p className="text-slate-400">No tenants match &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3 animate-fade-up">
            {filteredTenants.map((t) => {
              const cfg = STATUS_CONFIG[t.status];
              return (
                <div
                  key={t.id}
                  onClick={() => setEditingTenant(t)}
                  className={`cursor-pointer rounded-xl border border-slate-700/60 bg-slate-800/50 p-4 transition-colors active:bg-slate-700/40 ${cfg.row}`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-slate-300">
                          {t.tenantName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 text-sm truncate">{t.tenantName}</p>
                        <p className="text-xs text-slate-500 truncate">{t.roomNumber} · Bed {t.bedNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(e, t.id, t.tenantName)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Move to trash"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Finance grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-900/60 border border-slate-700/40 px-3 py-2">
                      <p className="text-xs text-slate-500 mb-0.5">Monthly Rent</p>
                      <p className="text-sm font-semibold text-slate-200 tabular-nums">₱{t.monthlyRent.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-slate-900/60 border border-slate-700/40 px-3 py-2">
                      <p className="text-xs text-slate-500 mb-0.5">Total Paid</p>
                      <p className="text-sm font-semibold text-emerald-400 tabular-nums">₱{t.amountPaid.toLocaleString()}</p>
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${t.remainingBalance > 0 ? "bg-rose-500/5 border-rose-500/20" : "bg-slate-900/60 border-slate-700/40"}`}>
                      <p className="text-xs text-slate-500 mb-0.5">Balance</p>
                      <p className={`text-sm font-semibold tabular-nums ${t.remainingBalance > 0 ? "text-rose-400" : "text-slate-300"}`}>
                        ₱{t.remainingBalance.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/60 border border-slate-700/40 px-3 py-2">
                      <p className="text-xs text-slate-500 mb-0.5">Next Due</p>
                      <p className="text-sm font-semibold text-slate-300">{t.nextDueDate || "—"}</p>
                    </div>
                  </div>

                  {t.moveInDate && (
                    <p className="mt-2.5 text-xs text-slate-600">Move-in: {t.moveInDate}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-800/50 shadow-lg animate-fade-up">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/80">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tenant</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Room / Bed</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Move-in</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Rent</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Next Due</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Paid</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Balance</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  {canEdit && <th className="w-14 px-4 py-3.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filteredTenants.map((t) => {
                  const cfg = STATUS_CONFIG[t.status];
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setEditingTenant(t)}
                      className={`cursor-pointer transition-colors hover:bg-slate-700/30 ${cfg.row}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-slate-300">
                              {t.tenantName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-slate-100">{t.tenantName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {t.roomNumber} / Bed {t.bedNumber}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">{t.moveInDate || "—"}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-sm text-slate-300">
                        ₱{t.monthlyRent.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-slate-400">{t.nextDueDate || "—"}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-sm text-emerald-400 font-medium">
                        ₱{t.amountPaid.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-sm font-semibold">
                        <span className={t.remainingBalance > 0 ? "text-rose-400" : "text-slate-300"}>
                          ₱{t.remainingBalance.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(e, t.id, t.tenantName)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Move to trash"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Trash section */}
      {canEdit && trashTenants.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setTrashOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-700/30 transition"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-sm font-medium text-slate-500">Trash</span>
            <span className="text-xs bg-slate-700 text-slate-400 rounded-full px-2 py-0.5">{trashTenants.length}</span>
            <svg className={`ml-auto w-4 h-4 text-slate-600 transition-transform ${trashOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {trashOpen && (
            <div className="border-t border-slate-700/50 divide-y divide-slate-700/30">
              {trashTenants.map((t) => {
                const bed = beds.find((b) => b.id === t.id);
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-300">{t.tenantName}</p>
                      <p className="text-xs text-slate-500">{t.roomNumber} / Bed {t.bedNumber}</p>
                      {bed?.deletedAt && (
                        <p className="text-xs text-slate-600 mt-0.5">Deleted {new Date(bed.deletedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleRestore(e, t.id)}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeletePermanently(e, t.id)}
                        className="rounded-lg bg-rose-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/60 p-5 shadow-2xl animate-fade-in-scale"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">Move to Trash?</h3>
            <p className="text-sm text-slate-400 mb-5">
              <span className="font-medium text-slate-200">{deleteConfirm.name}</span> will be moved to trash and their bed will become available.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deleteConfirm.id)}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 transition"
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTenant && editingBed && (
        <TenantEditModal
          tenant={editingTenant}
          bed={editingBed}
          onClose={() => setEditingTenant(null)}
          onSetRent={handleSetRent}
          onAddPayment={handleAddPayment}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
