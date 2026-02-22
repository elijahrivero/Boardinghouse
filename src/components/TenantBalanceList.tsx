"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, deleteDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, getFirebaseStatus } from "@/lib/firebase";
import type { BedSpace, TenantBalance, TenantPaymentStatus, PaymentRecord } from "@/types";

const STORAGE_KEY = "boardinghouse-beds";

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
  while (d <= now) {
    count++;
    d.setMonth(d.getMonth() + 1);
  }
  return count;
}

function computeStatus(totalOwed: number, totalPaid: number, monthlyRent: number): TenantPaymentStatus {
  const remaining = totalOwed - totalPaid;
  if (totalOwed === 0 && totalPaid === 0) return "due_soon"; // Not yet due, first payment coming
  if (remaining <= 0) return "paid";
  if (remaining <= monthlyRent * 0.5) return "due_soon";
  return "overdue";
}

const STATUS_STYLES = {
  paid: "bg-emerald-100 text-emerald-800",
  due_soon: "bg-amber-100 text-amber-800",
  overdue: "bg-rose-100 text-rose-800",
};

const STATUS_LABELS = {
  paid: "Paid",
  due_soon: "Due Soon",
  overdue: "Overdue",
};

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

  const handleSetRent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rentLocked) return;
    const rent = parseFloat(monthlyRent) || 0;
    if (rent <= 0) return;
    setSaving(true);
    try {
      await onSetRent(tenant.id, rent);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) return;
    setSaving(true);
    try {
      await onAddPayment(tenant.id, paymentDate, amount, paymentMethod);
      setPaymentAmount("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
          <h3 className="font-semibold text-stone-900">{tenant.tenantName}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100">
            ✕
          </button>
        </div>

        {/* Monthly Rent - fixed once set */}
        <div className="mb-6">
          <h4 className="mb-2 text-sm font-medium text-stone-700">Monthly Rent</h4>
          {!canEdit || rentLocked ? (
            <p className="text-lg font-semibold text-stone-900">₱{tenant.monthlyRent.toLocaleString()}</p>
          ) : (
            <form onSubmit={handleSetRent} className="flex gap-2">
              <input
                type="number"
                min="1"
                step="0.01"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                placeholder="Enter monthly rent"
                className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-500"
              />
              <button
                type="submit"
                disabled={saving || !monthlyRent}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
              >
                Set
              </button>
            </form>
          )}
        </div>

        {/* Next Due */}
        {tenant.nextDueDate && tenant.monthlyRent && (
          <p className="mb-4 text-sm text-stone-600">
            Next payment due: <span className="font-medium">{tenant.nextDueDate}</span>
          </p>
        )}

        {/* Add Payment */}
        {canEdit && (
        <div className="mb-6">
          <h4 className="mb-2 text-sm font-medium text-stone-700">Add Payment</h4>
          <form onSubmit={handleAddPayment} className="flex flex-wrap gap-2">
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-500"
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Amount (₱)"
              className="w-28 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-500"
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "cash" | "gcash")}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
            </select>
            <button
              type="submit"
              disabled={saving || !paymentAmount}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </div>
        )}

        {/* Payment History */}
        <div>
          <h4 className="mb-2 text-sm font-medium text-stone-700">Payment History</h4>
          {tenant.payments.length === 0 ? (
            <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">No payments yet</p>
          ) : (
            <ul className="space-y-1 rounded-lg border border-stone-200 p-3">
              {[...tenant.payments].sort((a, b) => b.date.localeCompare(a.date)).map((p, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <div className="flex flex-col">
                    <span className="text-stone-600">{p.date}</span>
                    {p.method && (
                      <span className="text-xs text-stone-400 capitalize">{p.method}</span>
                    )}
                  </div>
                  <span className="font-medium">₱{p.amount.toLocaleString()}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-stone-200 pt-2 mt-2 text-sm font-medium">
                <span>Total Paid</span>
                <span>₱{tenant.amountPaid.toLocaleString()}</span>
              </li>
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-stone-200 py-2 text-sm font-medium text-stone-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}

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
        setTenants(bedsToTenants(data));
        setError(null);
      },
      (err) => {
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
          await updateDoc(doc(db, "beds", id), {
            monthlyRent,
            updatedAt: serverTimestamp(),
          });
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
          await updateDoc(doc(db, "beds", id), {
            payments: newPayments,
            updatedAt: serverTimestamp(),
          });
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
    [beds, hasFirebase, db]
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
          await updateDoc(doc(db, "beds", id), {
            deletedAt,
            updatedAt: serverTimestamp(),
          });
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
          await updateDoc(doc(db, "beds", id), {
            deletedAt: null,
            updatedAt: serverTimestamp(),
          });
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  const isAdmin = variant === "admin";
  const showSearchInList = !isAdmin && tenants.length > 0;

  return (
    <div className="space-y-4">
      {error && (
        <p className={`rounded-2xl px-4 py-2 text-sm ${isAdmin ? "bg-amber-500/20 text-amber-400" : "bg-amber-50 text-amber-800"}`}>{error}</p>
      )}
      {showSearchInList && (
        <div className="flex gap-2">
          <input
            type="search"
            value={searchQuery}
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
        <p className={`rounded-2xl p-8 text-center ${isAdmin ? "border border-slate-600/50 bg-slate-800/40 text-slate-400" : "border border-stone-200 bg-stone-50 text-stone-600"}`}>
          No tenants yet. Add a tenant in the Bed Spaces section to see them here.
        </p>
      ) : filteredTenants.length === 0 ? (
        <p className={`rounded-2xl p-8 text-center ${isAdmin ? "border border-slate-600/50 bg-slate-800/40 text-slate-400" : "border border-stone-200 bg-stone-50 text-stone-600"}`}>
          No tenants match &quot;{searchQuery}&quot;
        </p>
      ) : (
        <div className={`overflow-x-auto shadow-lg ${isAdmin ? "rounded-2xl border border-slate-600/50 bg-slate-800/60" : "rounded-xl border border-stone-200 bg-white"}`}>
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className={isAdmin ? "border-b border-slate-600/50 bg-slate-700/40" : "border-b border-stone-200 bg-stone-50"}>
                <th className={`px-5 py-4 text-left text-sm font-medium ${isAdmin ? "text-slate-300" : "text-stone-600"}`}>Tenant</th>
                <th className={`px-5 py-4 text-left text-sm font-medium ${isAdmin ? "text-slate-300" : "text-stone-600"}`}>Room / Bed</th>
                <th className={`px-5 py-4 text-left text-sm font-medium ${isAdmin ? "text-slate-300" : "text-stone-600"}`}>Move-in</th>
                <th className={`px-5 py-4 text-right text-sm font-medium ${isAdmin ? "text-slate-300" : "text-stone-600"}`}>Monthly Rent</th>
                <th className={`px-5 py-4 text-right text-sm font-medium ${isAdmin ? "text-slate-300" : "text-stone-600"}`}>Next Due</th>
                <th className={`px-5 py-4 text-right text-sm font-medium ${isAdmin ? "text-slate-300" : "text-stone-600"}`}>Paid</th>
                <th className={`px-5 py-4 text-right text-sm font-medium ${isAdmin ? "text-slate-300" : "text-stone-600"}`}>Balance</th>
                <th className={`px-5 py-4 text-right text-sm font-medium ${isAdmin ? "text-slate-300" : "text-stone-600"}`}>Status</th>
                {canEdit && <th className={`w-20 px-5 py-4`}></th>}
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setEditingTenant(t)}
                  className={`cursor-pointer transition ${isAdmin ? "border-b border-slate-600/30 hover:bg-slate-700/30" : "border-b border-stone-100 last:border-0 hover:bg-stone-50"}`}
                  style={isAdmin ? { height: "72px" } : undefined}
                >
                  <td className={`font-medium ${isAdmin ? "px-5 py-5 text-slate-100" : "px-4 py-3 text-stone-900"}`}>{t.tenantName}</td>
                  <td className={isAdmin ? "px-5 py-5 text-slate-400" : "px-4 py-3 text-stone-600"}>
                    {t.roomNumber} / Bed {t.bedNumber}
                  </td>
                  <td className={isAdmin ? "px-5 py-5 text-slate-400" : "px-4 py-3 text-stone-600"}>{t.moveInDate || "—"}</td>
                  <td className={`text-right tabular-nums ${isAdmin ? "px-5 py-5 text-slate-300" : "px-4 py-3 text-stone-700"}`}>
                    ₱{t.monthlyRent.toLocaleString()}
                  </td>
                  <td className={`text-right ${isAdmin ? "px-5 py-5 text-slate-400" : "px-4 py-3 text-stone-600"}`}>{t.nextDueDate || "—"}</td>
                  <td className={`text-right tabular-nums ${isAdmin ? "px-5 py-5 text-slate-300" : "px-4 py-3 text-stone-700"}`}>
                    ₱{t.amountPaid.toLocaleString()}
                  </td>
                  <td className={`text-right tabular-nums font-medium ${isAdmin ? "px-5 py-5 text-slate-100" : "px-4 py-3 text-stone-900"}`}>
                    ₱{t.remainingBalance.toLocaleString()}
                  </td>
                  <td className={isAdmin ? "px-5 py-5 text-right" : "px-4 py-3 text-right"}>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                        isAdmin
                          ? t.status === "paid"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : t.status === "overdue"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-amber-500/20 text-amber-400"
                          : STATUS_STYLES[t.status]
                      }`}
                    >
                      {STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  {canEdit && (
                    <td className={isAdmin ? "px-5 py-5" : "px-4 py-3"} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, t.id, t.tenantName)}
                        title="Move to trash"
                        className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                    )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trash - icon only, expand on click */}
      {canEdit && trashTenants.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={() => setTrashOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-stone-100 transition"
          >
            <span className="text-stone-500" title="Trash">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </span>
            <span className="text-sm font-medium text-stone-600">Trash ({trashTenants.length})</span>
            <span className={`ml-auto text-stone-400 transition ${trashOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          {trashOpen && (
          <div className="overflow-x-auto border-t border-stone-200">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-100">
                  <th className="px-4 py-2 text-left text-sm font-medium text-stone-600">Tenant</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-stone-600">Room / Bed</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-stone-600">Deleted</th>
                  <th className="w-40 px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {trashTenants.map((t) => {
                  const bed = beds.find((b) => b.id === t.id);
                  const deletedAt = bed?.deletedAt ?? "";
                  return (
                    <tr key={t.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3 text-stone-700">{t.tenantName}</td>
                      <td className="px-4 py-3 text-stone-600">
                        {t.roomNumber} / Bed {t.bedNumber}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-stone-500">
                        {deletedAt ? new Date(deletedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={(e) => handleRestore(e, t.id)}
                            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeletePermanently(e, t.id)}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                          >
                            Delete permanently
                          </button>
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

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div
            className="relative z-10 w-full max-w-sm rounded-xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-6 text-stone-700">
              Are you sure you want to delete <span className="font-medium">{deleteConfirm.name}</span>? The tenant will be moved to trash and the bed will become available.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deleteConfirm.id)}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Yes, delete
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
