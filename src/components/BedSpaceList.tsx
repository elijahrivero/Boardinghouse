"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BedSpace } from "@/types";
import { ROOM_BED_COUNTS } from "@/types";
import BedModal from "./BedModal";

const BED_LABELS = "ABCDEFGH".split("");
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

function groupBedsByRoom(beds: BedSpace[]): Map<string, BedSpace[]> {
  const map = new Map<string, BedSpace[]>();
  const active = beds.filter((b) => !b.deletedAt);
  for (const bed of active) {
    let house: string;
    let room: string;
    if (bed.house !== undefined && bed.house !== "") {
      house = String(bed.house);
      room = String(bed.roomNumber);
    } else if (bed.roomNumber.length >= 2 && /^\d+$/.test(bed.roomNumber)) {
      house = bed.roomNumber[0];
      room = bed.roomNumber.slice(1).replace(/^0+/, "") || "1";
    } else {
      house = "1";
      room = bed.roomNumber;
    }
    const key = `${house}-${room}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(bed);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.bedNumber.localeCompare(b.bedNumber));
  }
  return map;
}

function getBedBySlot(beds: BedSpace[], house: string, room: string, bedLetter: string): BedSpace | undefined {
  return beds.filter((b) => !b.deletedAt).find((b) => {
    const h = b.house ?? (b.roomNumber.length >= 2 ? b.roomNumber[0] : "1");
    const r = b.house ? b.roomNumber : (b.roomNumber.length >= 2 ? b.roomNumber.slice(1).replace(/^0+/, "") || "1" : b.roomNumber);
    return h === house && r === room && b.bedNumber === bedLetter;
  });
}

const ROOM_ORDER: [string, string][] = [
  ["1", "1"], ["1", "2"],
  ["2", "1"], ["2", "2"], ["2", "3"], ["2", "4"],
];

interface BedSpaceListProps {
  canEdit?: boolean;
}

export default function BedSpaceList({ canEdit = false }: BedSpaceListProps) {
  const [beds, setBeds] = useState<BedSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [modalBed, setModalBed] = useState<BedSpace | Partial<BedSpace> | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit" | "add">("view");
  const [saving, setSaving] = useState(false);

  const hasFirebase = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  useEffect(() => {
    if (!hasFirebase) {
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
        data.sort((a, b) => {
          const keyA = `${a.house ?? "1"}-${a.roomNumber ?? ""}-${a.bedNumber ?? ""}`;
          const keyB = `${b.house ?? "1"}-${b.roomNumber ?? ""}-${b.bedNumber ?? ""}`;
          return keyA.localeCompare(keyB);
        });
        setBeds(data);
        setError(null);
      },
      (err) => {
        setError("Could not load bed spaces.");
        setBeds([]);
      }
    );
    setLoading(false);
    return () => unsubscribe();
  }, [hasFirebase]);

  const handleBedClick = useCallback((bed: BedSpace | null, house: string, room: string, bedLetter: string) => {
    if (bed) {
      setModalBed(bed);
      setModalMode("edit");
    } else {
      setModalBed({
        house,
        roomNumber: room,
        bedNumber: bedLetter,
        status: "available",
      });
      setModalMode(canEdit ? "add" : "view");
    }
  }, [canEdit]);

  const handleSave = useCallback(
    async (data: Partial<BedSpace>) => {
      setSaving(true);
      setError(null);
      try {
        const status = modalMode === "add" ? "occupied" : (data.status ?? "available");
        const tenantName = (data.tenantName ?? "").toString().trim();
        const bedData = {
          house: String(data.house ?? "1"),
          roomNumber: String(data.roomNumber ?? "1"),
          bedNumber: String(data.bedNumber ?? "A"),
          status,
          tenantName: status === "occupied" ? tenantName : undefined,
          tenantPhone: status === "occupied" ? (data.tenantPhone ?? "").toString().trim() || undefined : undefined,
          moveInDate: status === "occupied" ? (data.moveInDate ?? "").toString().trim() || undefined : undefined,
          notes: status === "occupied" ? (data.notes ?? "").toString().trim() || undefined : undefined,
        };

        if (hasFirebase) {
          const payload: Record<string, unknown> = {
            house: bedData.house,
            roomNumber: bedData.roomNumber,
            bedNumber: bedData.bedNumber,
            status: bedData.status,
            updatedAt: serverTimestamp(),
          };
          if (bedData.tenantName) payload.tenantName = bedData.tenantName;
          if (bedData.tenantPhone) payload.tenantPhone = bedData.tenantPhone;
          if (bedData.moveInDate) payload.moveInDate = bedData.moveInDate;
          if (bedData.notes) payload.notes = bedData.notes;
          if (modalMode === "add" && !("id" in data && data.id)) {
            if (!payload.tenantName) {
              setError("Tenant name is required.");
              setSaving(false);
              return;
            }
            await addDoc(collection(db, "beds"), payload);
          } else if ("id" in data && data.id) {
            await updateDoc(doc(db, "beds", data.id), payload);
          }
        } else {
          const current = loadBedsFromStorage();
          if (modalMode === "add" && !("id" in data && data.id)) {
            const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const newBed: BedSpace = { id, ...bedData } as BedSpace;
            const updated = [...current, newBed];
            saveBedsToStorage(updated);
            setBeds(updated);
          } else if ("id" in data && data.id) {
            const updated = current.map((b) =>
              b.id === data.id ? { ...b, ...bedData } : b
            );
            saveBedsToStorage(updated);
            setBeds(updated);
          }
        }
        setModalBed(null);
      } catch (err) {
        console.error(err);
        setError(hasFirebase ? "Failed to save. Check Firestore rules." : "Failed to save.");
      } finally {
        setSaving(false);
      }
    },
    [hasFirebase, modalMode]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Remove this bed record?")) return;
      setSaving(true);
      setError(null);
      try {
        if (hasFirebase) {
          await deleteDoc(doc(db, "beds", id));
        } else {
          const current = loadBedsFromStorage();
          const updated = current.filter((b) => b.id !== id);
          saveBedsToStorage(updated);
          setBeds(updated);
        }
        setModalBed(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete.";
        setError(hasFirebase ? `Delete failed: ${message}. Check Firestore rules allow write.` : message);
      } finally {
        setSaving(false);
      }
    },
    [hasFirebase]
  );

  const grouped = groupBedsByRoom(beds);

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
      <div className="space-y-4">
        {ROOM_ORDER.map(([house, room]) => {
          const key = `${house}-${room}`;
          const roomBeds = grouped.get(key) ?? [];
          const bedCount = ROOM_BED_COUNTS[key] ?? (roomBeds.length || 1);
          const isExpanded = expandedRoom === key;

          return (
            <div
              key={key}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setExpandedRoom(isExpanded ? null : key)}
                className="flex w-full items-center justify-between p-4 text-left transition hover:bg-stone-50"
              >
                <h2 className="text-lg font-semibold text-stone-900">
                  Room {room} — House {house}
                </h2>
                <span className="text-sm text-stone-500">
                  {bedCount} bed{bedCount !== 1 ? "s" : ""}
                </span>
                <span
                  className={`ml-2 text-stone-400 transition ${isExpanded ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>
              {isExpanded && (
                <div className="border-t border-stone-100 bg-stone-50/50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: bedCount }, (_, i) => {
                      const bedLetter = BED_LABELS[i];
                      const bed = getBedBySlot(beds, house, room, bedLetter);
                      return (
                        <button
                          key={bed?.id ?? `empty-${house}-${room}-${bedLetter}`}
                          type="button"
                          onClick={() => handleBedClick(bed ?? null, house, room, bedLetter)}
                          className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-stone-300 hover:shadow-sm"
                        >
                          <span className="font-medium text-stone-900">
                            Bed {bedLetter}
                            {bed?.tenantName && (
                              <span className="ml-1 block text-xs font-normal text-stone-500">
                                {bed.tenantName}
                              </span>
                            )}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${
                              bed?.tenantName
                                ? "bg-stone-100 text-stone-600"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {bed?.tenantName ? "Occupied" : "Available"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalBed && (
        <BedModal
          bed={modalBed}
          mode={modalMode}
          onClose={() => setModalBed(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          saving={saving}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
