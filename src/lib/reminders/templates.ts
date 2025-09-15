import { formatCurrency } from "@/lib/vehicleUtils";

export interface ReminderContext {
  // Vehicle context
  vehicle_id?: string;
  reg?: string;
  make?: string;
  model?: string;
  
  // Customer context
  customer_id?: string;
  customer_name?: string;
  
  // Rental context
  rental_id?: string;
  
  // Fine context
  fine_id?: string;
  reference?: string;
  
  // Document context
  policy_no?: string;
  provider?: string;
  
  // Dates
  due_date?: string;
  
  // Amounts
  amount?: number;
  overdue_total?: number;
  oldest_due_date?: string;
  
  // Other
  days_until?: number;
  days_overdue?: number;
}

export function getTitleTemplate(ruleCode: string, context: ReminderContext): string {
  const templates: Record<string, (ctx: ReminderContext) => string> = {
    // Vehicle MOT reminders
    VEH_MOT_30D: (ctx) => `MOT due soon — ${ctx.reg} (30 days)`,
    VEH_MOT_14D: (ctx) => `MOT due soon — ${ctx.reg} (14 days)`,
    VEH_MOT_7D: (ctx) => `MOT due soon — ${ctx.reg} (7 days)`,
    VEH_MOT_0D: (ctx) => `MOT due today — ${ctx.reg}`,
    
    // Vehicle TAX reminders
    VEH_TAX_30D: (ctx) => `TAX due soon — ${ctx.reg} (30 days)`,
    VEH_TAX_14D: (ctx) => `TAX due soon — ${ctx.reg} (14 days)`,
    VEH_TAX_7D: (ctx) => `TAX due soon — ${ctx.reg} (7 days)`,
    VEH_TAX_0D: (ctx) => `TAX due today — ${ctx.reg}`,
    
    // Insurance expiry reminders
    INS_EXP_30D: (ctx) => `Insurance expiring — ${ctx.customer_name} (${ctx.reg}) (30 days)`,
    INS_EXP_14D: (ctx) => `Insurance expiring — ${ctx.customer_name} (${ctx.reg}) (14 days)`,
    INS_EXP_7D: (ctx) => `Insurance expiring — ${ctx.customer_name} (${ctx.reg}) (7 days)`,
    INS_EXP_0D: (ctx) => `Insurance expires today — ${ctx.customer_name} (${ctx.reg})`,
    
    // Insurance verification reminders
    INS_VERIFY_7D: (ctx) => `Verify insurance for ${ctx.reg}`,
    INS_VERIFY_14D: (ctx) => `Verify insurance for ${ctx.reg}`,
    INS_VERIFY_30D: (ctx) => `Verify insurance for ${ctx.reg}`,
    
    // Document expiry reminders
    DOC_EXP_30D: (ctx) => `Document expiring — ${ctx.customer_name} (30 days)`,
    DOC_EXP_14D: (ctx) => `Document expiring — ${ctx.customer_name} (14 days)`,
    DOC_EXP_7D: (ctx) => `Document expiring — ${ctx.customer_name} (7 days)`,
    DOC_EXP_0D: (ctx) => `Document expires today — ${ctx.customer_name}`,
    
    // Rental overdue reminders
    RENT_OVERDUE: (ctx) => `Overdue rental balance — ${ctx.customer_name} (${ctx.reg})`,
    
    // Fine due reminders
    FINE_DUE_14D: (ctx) => `Fine due soon — ${ctx.reg} (${ctx.reference}) (14 days)`,
    FINE_DUE_7D: (ctx) => `Fine due soon — ${ctx.reg} (${ctx.reference}) (7 days)`,
    FINE_DUE_0D: (ctx) => `Fine due today — ${ctx.reg} (${ctx.reference})`,
  };
  
  const template = templates[ruleCode];
  return template ? template(context) : `Reminder: ${ruleCode}`;
}

export function getMessageTemplate(ruleCode: string, context: ReminderContext): string {
  const templates: Record<string, (ctx: ReminderContext) => string> = {
    // Vehicle MOT reminders
    VEH_MOT_30D: (ctx) => `MOT for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Please book test soon.`,
    VEH_MOT_14D: (ctx) => `MOT for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Please book test immediately.`,
    VEH_MOT_7D: (ctx) => `MOT for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Book test urgently!`,
    VEH_MOT_0D: (ctx) => `MOT for ${ctx.reg} (${ctx.make} ${ctx.model}) due today (${ctx.due_date}). Immediate action required!`,
    
    // Vehicle TAX reminders
    VEH_TAX_30D: (ctx) => `TAX for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Renew soon.`,
    VEH_TAX_14D: (ctx) => `TAX for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Renew immediately.`,
    VEH_TAX_7D: (ctx) => `TAX for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Renew urgently!`,
    VEH_TAX_0D: (ctx) => `TAX for ${ctx.reg} (${ctx.make} ${ctx.model}) due today (${ctx.due_date}). Immediate action required!`,
    
    // Insurance expiry reminders
    INS_EXP_30D: (ctx) => `Insurance policy ${ctx.policy_no} for ${ctx.customer_name} expires on ${ctx.due_date}. Contact ${ctx.provider} to renew.`,
    INS_EXP_14D: (ctx) => `Insurance policy ${ctx.policy_no} for ${ctx.customer_name} expires on ${ctx.due_date}. Renew immediately with ${ctx.provider}.`,
    INS_EXP_7D: (ctx) => `Insurance policy ${ctx.policy_no} for ${ctx.customer_name} expires on ${ctx.due_date}. Urgent renewal required!`,
    INS_EXP_0D: (ctx) => `Insurance policy ${ctx.policy_no} for ${ctx.customer_name} expires today (${ctx.due_date}). Immediate action required!`,
    
    // Insurance verification reminders
    INS_VERIFY_7D: (ctx) => `Please verify that insurance is still active for vehicle ${ctx.reg} rented by ${ctx.customer_name}.`,
    INS_VERIFY_14D: (ctx) => `Please verify that insurance is still active for vehicle ${ctx.reg} rented by ${ctx.customer_name}.`,
    INS_VERIFY_30D: (ctx) => `Please verify that insurance is still active for vehicle ${ctx.reg} rented by ${ctx.customer_name}.`,
    
    // Document expiry reminders
    DOC_EXP_30D: (ctx) => `Document for ${ctx.customer_name} expires on ${ctx.due_date}. Please request renewal.`,
    DOC_EXP_14D: (ctx) => `Document for ${ctx.customer_name} expires on ${ctx.due_date}. Request renewal immediately.`,
    DOC_EXP_7D: (ctx) => `Document for ${ctx.customer_name} expires on ${ctx.due_date}. Urgent renewal required!`,
    DOC_EXP_0D: (ctx) => `Document for ${ctx.customer_name} expires today (${ctx.due_date}). Immediate action required!`,
    
    // Rental overdue reminders
    RENT_OVERDUE: (ctx) => `${formatCurrency(ctx.overdue_total || 0)} overdue since ${ctx.oldest_due_date}. Review ledger & contact customer.`,
    
    // Fine due reminders
    FINE_DUE_14D: (ctx) => `Fine ${ctx.reference} for ${ctx.reg} (${formatCurrency(ctx.amount || 0)}) due on ${ctx.due_date}. Prepare payment or appeal.`,
    FINE_DUE_7D: (ctx) => `Fine ${ctx.reference} for ${ctx.reg} (${formatCurrency(ctx.amount || 0)}) due on ${ctx.due_date}. Urgent action required!`,
    FINE_DUE_0D: (ctx) => `Fine ${ctx.reference} for ${ctx.reg} (${formatCurrency(ctx.amount || 0)}) due today (${ctx.due_date}). Immediate payment required!`,
  };
  
  const template = templates[ruleCode];
  return template ? template(context) : `Reminder for ${ruleCode}`;
}

export function getSeverityForRule(ruleCode: string): 'info' | 'warning' | 'critical' {
  if (ruleCode.includes('_30D') || ruleCode.includes('_14D')) {
    return 'warning';
  }
  if (ruleCode.includes('_7D') || ruleCode.includes('_0D') || ruleCode.includes('OVERDUE')) {
    return 'critical';
  }
  return 'info';
}
