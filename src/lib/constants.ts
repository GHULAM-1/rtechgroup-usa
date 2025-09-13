// P&L Category Constants
export const PNL_CATEGORIES = {
  INITIAL_FEES: 'Initial Fees',
  RENTAL: 'Rental', 
  ACQUISITION: 'Acquisition',
  FINANCE: 'Finance',
  SERVICE: 'Service',
  FINES: 'Fines',
  OTHER: 'Other'
} as const;

// Payment Type Constants
export const PAYMENT_TYPES = {
  INITIAL_FEE: 'InitialFee',
  RENTAL: 'Rental',
  FINE: 'Fine'
} as const;

// Payment Type to P&L Category Mapping
export const PAYMENT_TYPE_TO_PNL_CATEGORY = {
  [PAYMENT_TYPES.INITIAL_FEE]: PNL_CATEGORIES.INITIAL_FEES,
  [PAYMENT_TYPES.RENTAL]: PNL_CATEGORIES.RENTAL,
  [PAYMENT_TYPES.FINE]: PNL_CATEGORIES.FINES
} as const;