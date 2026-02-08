"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BedSpace } from "@/types";

const MOCK_BEDS: BedSpace[] = [
  { id: "1", roomNumber: "101", bedNumber: "A", status: "available" },
  { id: "2", roomNumber: "101", bedNumber: "B", status: "occupied" },
  { id: "3", roomNumber: "102", bedNumber: "A", status: "available" },
  { id: "4", roomNumber: "102", bedNumber: "B", status: "available" },
  { id: "5", roomNumber: "103", bedNumber: "A", status: "occupied" },
];

export default function BedSpaceList() {
  const [beds, setBeds] = useState<BedSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBeds() {
      const hasConfig = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!hasConfig) {
        setBeds(MOCK_BEDS);
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "beds"),
          orderBy("roomNumber"),
          orderBy("bedNumber")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as BedSpace[];
        setBeds(data.length > 0 ? data : MOCK_BEDS);
      } catch (err) {
        setError("Could not load bed spaces. Showing sample data.");
        setBeds(MOCK_BEDS);
      } finally {
        setLoading(false);
      }
    }
    fetchBeds();
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
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {beds.map((bed) => (
          <div
            key={bed.id}
            className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div>
              <p className="font-medium text-stone-900">
                Room {bed.roomNumber} — Bed {bed.bedNumber}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                bed.status === "available"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {bed.status === "available" ? "Available" : "Occupied"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
