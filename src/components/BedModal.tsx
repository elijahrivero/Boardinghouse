"use client";

import { useState, useEffect } from "react";
import type { BedSpace } from "@/types";


interface BedModalProps {
  bed: BedSpace | Partial<BedSpace>;
  mode: "view" | "edit" | "add";
  onClose: () => void;
  onSave: (data: Partial<BedSpace>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving: boolean;
  canEdit: boolean;
}

export default function BedModal({
  bed,
  mode,
  onClose,
  onSave,
  onDelete,
  saving,
  canEdit,
}: BedModalProps) {
  const [form, setForm] = useState({
    house: (bed.house ?? "1").toString(),
    roomNumber: (bed.roomNumber ?? "1").toString(),
    bedNumber: (bed.bedNumber ?? "A").toString(),
    status: (bed.status ?? "available") as "available" | "occupied",
    tenantName: bed.tenantName ?? "",
    tenantPhone: bed.tenantPhone ?? "",
    moveInDate: bed.moveInDate ?? "",
    notes: bed.notes ?? "",
  });
  const [isEditing, setIsEditing] = useState(mode === "add");

  const showAddButton = mode === "add";
  const showEditDeleteButtons = ("id" in bed && bed.id) && canEdit;
  const showAddForm = mode === "add" || (isEditing && canEdit);

  useEffect(() => {
    setForm({
      house: (bed.house ?? "1").toString(),
      roomNumber: (bed.roomNumber ?? "1").toString(),
      bedNumber: (bed.bedNumber ?? "A").toString(),
      status: (bed.status ?? "available") as "available" | "occupied",
      tenantName: bed.tenantName ?? "",
      tenantPhone: bed.tenantPhone ?? "",
      moveInDate: bed.moveInDate ?? "",
      notes: bed.notes ?? "",
    });
    setIsEditing(mode === "add");
  }, [bed, mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...("id" in bed && bed.id ? { id: bed.id } : {}),
      ...form,
      tenantName: form.tenantName || undefined,
      tenantPhone: form.tenantPhone || undefined,
      moveInDate: form.moveInDate || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h3 className="font-semibold text-stone-900">
            House {form.house} — Room {form.roomNumber} — Bed {form.bedNumber}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
        </div>

        {showAddForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            {mode === "edit" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as "available" | "occupied" }))
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                </select>
              </div>
            ) : null}
            {(mode === "add" || form.status === "occupied") && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">
                    Tenant Name
                  </label>
                  <input
                    type="text"
                    value={form.tenantName}
                    onChange={(e) => setForm((f) => ({ ...f, tenantName: e.target.value }))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    placeholder="Enter tenant name"
                    required={mode === "add"}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">
                    Move-in Date
                  </label>
                  <input
                    type="date"
                    value={form.moveInDate}
                    onChange={(e) => setForm((f) => ({ ...f, moveInDate: e.target.value }))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">
                    Tenant Phone
                  </label>
                  <input
                    type="text"
                    value={form.tenantPhone}
                    onChange={(e) => setForm((f) => ({ ...f, tenantPhone: e.target.value }))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-4">
              {showAddButton && (
                <button
                  type="submit"
                  disabled={saving || !form.tenantName.trim()}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add"}
                </button>
              )}
              {!showAddButton && ("id" in bed && bed.id) && (
                <>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (bed.id) onDelete(bed.id);
                    }}
                    disabled={saving}
                    className="cursor-pointer rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => (showEditDeleteButtons ? setIsEditing(false) : onClose())}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700"
              >
                {showEditDeleteButtons ? "Cancel" : "Close"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 p-4">
            <div className="space-y-3">
              {form.tenantName ? (
                <>
                  <div>
                    <p className="text-sm text-stone-500">Tenant Name</p>
                    <p className="font-medium text-stone-900">
                      {form.tenantName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Move-in Date</p>
                    <p className="font-medium text-stone-900">
                      {form.moveInDate || "—"}
                    </p>
                  </div>
                  {form.tenantPhone && (
                    <div>
                      <p className="text-sm text-stone-500">Phone</p>
                      <p className="font-medium text-stone-900">{form.tenantPhone}</p>
                    </div>
                  )}
                  {form.notes && (
                    <div>
                      <p className="text-sm text-stone-500">Notes</p>
                      <p className="font-medium text-stone-900">{form.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-stone-600">This bed is available.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-4">
              {showAddButton && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
                >
                  Add
                </button>
              )}
              {showEditDeleteButtons && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
                  >
                    Edit
                  </button>
                  {"id" in bed && bed.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (bed.id) onDelete(bed.id);
                      }}
                      disabled={saving}
                      className="cursor-pointer rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700"
                  >
                    Close
                  </button>
                </>
              )}
              {!showAddButton && !showEditDeleteButtons && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
