import { NextResponse } from "next/server";
import { google } from "googleapis";
import type { TenantBalance, Parcel, TenantPaymentStatus, ParcelStatus } from "@/types";

function parsePaymentStatus(s: string): TenantPaymentStatus {
  const lower = (s || "").toLowerCase();
  if (lower.includes("paid")) return "paid";
  if (lower.includes("due soon") || lower.includes("duesoon")) return "due_soon";
  if (lower.includes("overdue")) return "overdue";
  return "due_soon";
}

function parseParcelStatus(s: string): ParcelStatus {
  const lower = (s || "").toLowerCase();
  if (lower.includes("claimed")) return "claimed";
  if (lower.includes("arrived")) return "arrived";
  if (lower.includes("incoming")) return "incoming";
  return "incoming";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "tenants" | "parcels"

  const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!credentials || !sheetId) {
    return NextResponse.json(
      { error: "Google Sheets not configured. Add GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEET_ID to .env.local" },
      { status: 503 }
    );
  }

  try {
    const cred = JSON.parse(credentials);
    const auth = new google.auth.GoogleAuth({
      credentials: cred,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const range = type === "parcels" ? "Parcels!A2:D" : "TenantBalance!A2:H";

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = res.data.values || [];

    if (type === "parcels") {
      const parcels: Parcel[] = rows.map((row, i) => ({
        id: `p-${i}`,
        tenantName: String(row[0] ?? ""),
        roomNumber: String(row[1] ?? ""),
        status: parseParcelStatus(String(row[2] ?? "incoming")),
      }));
      return NextResponse.json(parcels);
    }

    const tenants: TenantBalance[] = rows.map((row, i) => {
      const monthlyRent = Number(row[3] ?? 0) || 0;
      const amountPaid = Number(row[4] ?? 0) || 0;
      const rawBalance = Number(row[5]);
      const remainingBalance = !isNaN(rawBalance) ? rawBalance : Math.max(0, monthlyRent - amountPaid);
      const statusStr = String(row[6] ?? "due_soon");
      return {
        id: `t-${i}`,
        tenantName: String(row[0] ?? ""),
        roomNumber: String(row[1] ?? ""),
        bedNumber: String(row[2] ?? ""),
        monthlyRent,
        amountPaid,
        remainingBalance: remainingBalance > 0 ? remainingBalance : 0,
        status: parsePaymentStatus(statusStr),
      };
    });
    return NextResponse.json(tenants);
  } catch (error) {
    console.error("Sheets API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Google Sheets" },
      { status: 500 }
    );
  }
}
