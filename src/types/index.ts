export type BedStatus = "available" | "occupied";
export type ParcelStatus = "incoming" | "arrived" | "claimed";
export type TenantPaymentStatus = "paid" | "due_soon" | "overdue";

export interface BedSpace {
  id: string;
  roomNumber: string;
  bedNumber: string;
  status: BedStatus;
}

export interface TenantBalance {
  id: string;
  tenantName: string;
  roomNumber: string;
  bedNumber: string;
  monthlyRent: number;
  amountPaid: number;
  remainingBalance: number;
  status: TenantPaymentStatus;
}

export interface Parcel {
  id: string;
  tenantName: string;
  roomNumber: string;
  status: ParcelStatus;
}
