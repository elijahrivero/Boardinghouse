export type BedStatus = "available" | "occupied";
export type TenantPaymentStatus = "paid" | "due_soon" | "overdue";

export interface PaymentRecord {
  date: string;
  amount: number;
}

export interface BedSpace {
  id: string;
  house?: string;
  roomNumber: string;
  bedNumber: string;
  status: BedStatus;
  tenantName?: string;
  tenantPhone?: string;
  moveInDate?: string;
  notes?: string;
  monthlyRent?: number;
  amountPaid?: number; // legacy, prefer payments
  payments?: PaymentRecord[];
  deletedAt?: string; // ISO date when moved to trash
}

// Room structure: House 1 (R1: 3 beds, R2: 2 beds), House 2 (R1: 2, R2: 4, R3: 2, R4: 2)
export const ROOM_BED_COUNTS: Record<string, number> = {
  "1-1": 3, // House 1, Room 1
  "1-2": 2, // House 1, Room 2
  "2-1": 2, // House 2, Room 1
  "2-2": 4,
  "2-3": 2,
  "2-4": 2,
};

export interface TenantBalance {
  id: string;
  tenantName: string;
  roomNumber: string;
  bedNumber: string;
  moveInDate?: string;
  monthlyRent: number;
  amountPaid: number;
  remainingBalance: number;
  status: TenantPaymentStatus;
  payments: PaymentRecord[];
  nextDueDate?: string;
}
