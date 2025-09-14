import { differenceInDays } from "date-fns";

export type InsurancePolicyStatus = "Active" | "Expired" | "Suspended" | "Cancelled";

export type InsuranceStatusLevel = "ok" | "due_soon" | "expired" | "suspended" | "cancelled";

export interface InsuranceStatusInfo {
  level: InsuranceStatusLevel;
  label: string;
  daysUntilExpiry?: number;
}

export function getInsuranceStatusInfo(
  status: InsurancePolicyStatus,
  expiryDate: string
): InsuranceStatusInfo {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = differenceInDays(expiry, today);

  // Handle non-active statuses first
  if (status === "Expired") {
    return {
      level: "expired",
      label: "Expired",
      daysUntilExpiry: Math.abs(daysUntilExpiry)
    };
  }

  if (status === "Suspended") {
    return {
      level: "suspended",
      label: "Suspended",
      daysUntilExpiry
    };
  }

  if (status === "Cancelled") {
    return {
      level: "cancelled",
      label: "Cancelled",
      daysUntilExpiry
    };
  }

  // Handle active policies based on expiry date
  if (daysUntilExpiry < 0) {
    return {
      level: "expired",
      label: "Expired",
      daysUntilExpiry: Math.abs(daysUntilExpiry)
    };
  }

  if (daysUntilExpiry <= 30) {
    return {
      level: "due_soon",
      label: daysUntilExpiry === 0 ? "Expires Today" : `Expires in ${daysUntilExpiry} days`,
      daysUntilExpiry
    };
  }

  return {
    level: "ok",
    label: "Active",
    daysUntilExpiry
  };
}

export const INSURANCE_DOCUMENT_TYPES = [
  "Certificate",
  "Schedule",
  "NCD (No Claims Discount)",
  "Photo ID",
  "Proof of Address",
  "V5C",
  "Other"
] as const;

export type InsuranceDocumentType = typeof INSURANCE_DOCUMENT_TYPES[number];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
}

export function validatePolicyNumber(policyNumber: string): boolean {
  return policyNumber.trim().length >= 3;
}

export function validateDateRange(startDate: string, expiryDate: string): boolean {
  if (!startDate || !expiryDate) return false;
  return new Date(expiryDate) > new Date(startDate);
}