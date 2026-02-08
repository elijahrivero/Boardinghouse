"use client";

import { useEffect, useState } from "react";
import type { Parcel } from "@/types";

const STATUS_STYLES = {
  incoming: "bg-blue-100 text-blue-800",
  arrived: "bg-amber-100 text-amber-800",
  claimed: "bg-emerald-100 text-emerald-800",
};

const STATUS_LABELS = {
  incoming: "Incoming",
  arrived: "Arrived",
  claimed: "Claimed",
};

export default function ParcelList() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchParcels() {
      try {
        const res = await fetch("/api/sheets?type=parcels");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load");
        }
        const data = await res.json();
        setParcels(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load parcel data.");
      } finally {
        setLoading(false);
      }
    }
    fetchParcels();
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
            Your sheet should have a &quot;Parcels&quot; tab with columns: Tenant Name, Room, Status.
          </p>
        </div>
      )}
      {!error && parcels.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-stone-600">
          No parcels on record.
        </p>
      )}
      {!error && parcels.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {parcels.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div>
                <p className="font-medium text-stone-900">{p.tenantName}</p>
                <p className="text-sm text-stone-500">Room {p.roomNumber}</p>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[p.status]}`}
              >
                {STATUS_LABELS[p.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
