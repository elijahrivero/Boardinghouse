import type { BedSpace, PaymentRecord, TenantPaymentStatus } from "@/types";
import { ROOM_BED_COUNTS } from "@/types";

const BED_LABELS = "ABCDEFGH".split("");
const STORAGE_KEY = "boardinghouse-beds";

export function loadBedsFromStorage(): BedSpace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getPayments(bed: BedSpace): PaymentRecord[] {
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

export function getNextDueDate(moveInDate: string): string {
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

export function computeStatus(
  totalOwed: number,
  totalPaid: number,
  monthlyRent: number
): TenantPaymentStatus {
  const remaining = totalOwed - totalPaid;
  if (totalOwed === 0 && totalPaid === 0) return "due_soon"; // Not yet due, first payment coming
  if (remaining <= 0) return "paid";
  if (remaining <= monthlyRent * 0.5) return "due_soon";
  return "overdue";
}

export function getBedMetrics(bed: BedSpace) {
  const monthlyRent = bed.monthlyRent ?? 0;
  const payments = getPayments(bed);
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const moveInDate = bed.moveInDate ?? "";
  const monthsOwed = getMonthsOwed(moveInDate, monthlyRent);
  const totalOwed = monthsOwed * monthlyRent;
  const remainingBalance = Math.max(0, totalOwed - amountPaid);
  const status = computeStatus(totalOwed, amountPaid, monthlyRent);
  const nextDueDate = getNextDueDate(moveInDate);
  return { monthlyRent, amountPaid, remainingBalance, status, nextDueDate, totalOwed };
}

export const ROOM_ORDER: [string, string][] = [
  ["1", "1"],
  ["1", "2"],
  ["2", "1"],
  ["2", "2"],
  ["2", "3"],
  ["2", "4"],
];

export function getBedBySlot(
  beds: BedSpace[],
  house: string,
  room: string,
  bedLetter: string
): BedSpace | undefined {
  return beds.filter((b) => !b.deletedAt).find((b) => {
    const h = b.house ?? (b.roomNumber.length >= 2 ? b.roomNumber[0] : "1");
    const r = b.house
      ? b.roomNumber
      : b.roomNumber.length >= 2
        ? b.roomNumber.slice(1).replace(/^0+/, "") || "1"
        : b.roomNumber;
    return h === house && r === room && b.bedNumber === bedLetter;
  });
}

export { BED_LABELS, STORAGE_KEY, ROOM_BED_COUNTS };
