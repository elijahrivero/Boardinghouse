"use client";

import { useEffect, useState } from "react";
import type { TenantBalance } from "@/types";

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

export default function TenantBalanceList() {
  const [tenants, setTenants] = useState<TenantBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenants() {
      try {
        const res = await fetch("/api/sheets?type=tenants");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load");
        }
        const data = await res.json();
        setTenants(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load tenant balance data.");
      } finally {
        setLoading(false);
      }
    }
    fetchTenants();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="font-medium">Setup required</p>
          <p className="mt-1 text-sm">{error}</p>
          <p className="mt-2 text-sm opacity-90">
            Configure Google Sheets: add GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEET_ID to .env.local.
            Your sheet should have a &quot;TenantBalance&quot; tab with columns: Tenant Name, Room, Bed,
            Monthly Rent, Amount Paid, Remaining Balance, Status.
          </p>
        </div>
      )}
      {!error && tenants.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-stone-600">
          No tenant records yet.
        </p>
      )}
      {!error && tenants.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">
                  Tenant
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">
                  Room / Bed
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">
                  Monthly Rent
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">
                  Paid
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">
                  Balance
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {t.tenantName}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {t.roomNumber} / {t.bedNumber}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    ₱{t.monthlyRent.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    ₱{t.amountPaid.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-stone-900">
                    ₱{t.remainingBalance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[t.status]}`}
                    >
                      {STATUS_LABELS[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
