import { differenceInMonths, parseISO, isAfter } from "date-fns";

export const calculateDurationInMonths = (startDate: string, endDate: string | null): number => {
  if (!endDate) {
    return differenceInMonths(new Date(), parseISO(startDate));
  }
  return differenceInMonths(parseISO(endDate), parseISO(startDate));
};

export const formatDuration = (months: number): string => {
  if (months === 0) return "0 mo";
  return `${months} mo`;
};

export const getRentalStatus = (startDate: string, endDate: string | null, status: string): string => {
  const today = new Date();
  const start = parseISO(startDate);
  
  if (isAfter(start, today)) {
    return "Upcoming";
  }
  
  return status || "Active";
};

export const getDurationFilter = (months: number): string => {
  if (months <= 12) return "≤12 mo";
  if (months <= 24) return "13–24 mo";
  return ">24 mo";
};