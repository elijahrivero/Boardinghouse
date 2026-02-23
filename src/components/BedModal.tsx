"use client";

import { useState, useEffect } from "react";
import type { BedSpace } from "@/types";
import { getBedMetrics, getPayments } from "@/lib/boarding";

interface BedModalProps {
  bed: BedSpace | Partial<BedSpace>;
  mode: "view" | "edit" | "add";
  onClose: () => void;
  onSave: (data: Partial<BedSpace>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving: boolean;
  canEdit: boolean;
}

export default function BedModal({ bed, mode, onClose, onSave, onDelete, saving, canEdit }: BedModalProps) {
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
  
  // Calculate payment details for occupied beds
  const paymentDetails = bed.id ? getBedMetrics(bed as BedSpace) : null;
  const payments = bed.id ? getPayments(bed as BedSpace) : [];

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

  const isOccupied = !!bed.tenantName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/60 max-h-[92vh] overflow-y-auto animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-900 border-b border-slate-700/60 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
              isOccupied
                ? "bg-indigo-500/15 border border-indigo-500/20 text-indigo-400"
                : "bg-emerald-500/15 border border-emerald-500/20 text-emerald-400"
            }`}>
              {form.bedNumber}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                House {form.house} · Room {form.roomNumber} · Bed {form.bedNumber}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isOccupied ? `Occupied by ${bed.tenantName}` : "Available"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form / View content */}
        {showAddForm ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {mode === "edit" && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Status
                </label>
                <div className="flex rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
                  {(["available", "occupied"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 py-2.5 text-sm font-medium transition capitalize ${
                        form.status === s
                          ? s === "occupied"
                            ? "bg-indigo-600 text-white"
                            : "bg-emerald-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(mode === "add" || form.status === "occupied") && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Tenant Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.tenantName}
                    onChange={(e) => setForm((f) => ({ ...f, tenantName: e.target.value }))}
                    placeholder="Enter full name"
                    required={mode === "add"}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Move-in Date
                  </label>
                  <input
                    type="date"
                    value={form.moveInDate}
                    onChange={(e) => setForm((f) => ({ ...f, moveInDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.tenantPhone}
                    onChange={(e) => setForm((f) => ({ ...f, tenantPhone: e.target.value }))}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition resize-none"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-700/60">
              {showAddButton && (
                <button
                  type="submit"
                  disabled={saving || !form.tenantName.trim()}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  {saving ? "Adding…" : "Add Tenant"}
                </button>
              )}
              {!showAddButton && ("id" in bed && bed.id) && (
                <>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (bed.id) onDelete(bed.id); }}
                    disabled={saving}
                    className="rounded-xl bg-rose-600/80 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50 transition"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => (showEditDeleteButtons ? setIsEditing(false) : onClose())}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition"
              >
                {showEditDeleteButtons ? "Cancel" : "Close"}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-5">
            {form.tenantName ? (
              <div className="space-y-3">
                {[
                  { label: "Tenant Name", value: form.tenantName },
                  { label: "Move-in Date", value: form.moveInDate || "—" },
                  form.tenantPhone ? { label: "Phone", value: form.tenantPhone } : null,
                  form.notes ? { label: "Notes", value: form.notes } : null,
                ].filter(Boolean).map((item) => (
                  <div key={item!.label} className="flex items-start justify-between gap-4 rounded-xl bg-slate-800/50 border border-slate-700/40 px-4 py-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5 shrink-0">{item!.label}</p>
                    <p className="text-sm font-medium text-slate-100 text-right">{item!.value}</p>
                  </div>
                ))}
                
                {/* Payment Details Section */}
                {paymentDetails && mode === "view" && (
                  <div className="mt-6 space-y-3 border-t border-stone-200 pt-4">
                    <h4 className="text-base font-semibold text-stone-900 mb-3">Payment Details</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-stone-500">Monthly Rent</p>
                        <p className="font-medium text-stone-900">₱{paymentDetails.monthlyRent?.toLocaleString() || "0"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-stone-500">Payment Status</p>
                        <p className={`font-medium ${
                          paymentDetails.status === "paid" ? "text-emerald-600" :
                          paymentDetails.status === "due_soon" ? "text-amber-600" :
                          "text-rose-600"
                        }`}>
                          {paymentDetails.status === "paid" && "Paid"}
                          {paymentDetails.status === "due_soon" && `Due: ${paymentDetails.nextDueDate}`}
                          {paymentDetails.status === "overdue" && `Overdue: ₱${paymentDetails.remainingBalance.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                    
                    {paymentDetails.remainingBalance > 0 && (
                      <div>
                        <p className="text-sm text-stone-500">Remaining Balance</p>
                        <p className="font-medium text-rose-600">₱{paymentDetails.remainingBalance.toLocaleString()}</p>
                      </div>
                    )}
                    
                    {payments.length > 0 && (
                      <div>
                        <p className="text-sm text-stone-500 mb-2">Recent Payments</p>
                        <div className="space-y-2">
                          {payments.slice(-3).reverse().map((payment, index) => (
                            <div key={index} className="flex justify-between text-sm p-2 bg-stone-50 rounded">
                              <span className="text-stone-600">{payment.date}</span>
                              <span className="font-medium text-stone-900">₱{payment.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-4 py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-emerald-400 font-medium">Bed is available</p>
                <p className="text-xs text-slate-500 mt-1">Ready for a new tenant</p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons for view mode */}
        {!showAddForm && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/60">
            {showAddButton && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
              >
                Add Tenant
              </button>
            )}
            {showEditDeleteButtons && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
                >
                  Edit
                </button>
                {"id" in bed && bed.id && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (bed.id) onDelete(bed.id); }}
                    disabled={saving}
                    className="rounded-xl bg-rose-600/80 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </>
            )}
            {!showAddButton && !showEditDeleteButtons && (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
