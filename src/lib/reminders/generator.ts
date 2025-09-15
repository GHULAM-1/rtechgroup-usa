import { supabase } from "@/integrations/supabase/client";
import { getTitleTemplate, getMessageTemplate, getSeverityForRule, ReminderContext } from "./templates";
import { format, addDays, subDays, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = 'Europe/London';

interface ReminderRule {
  code: string;
  leadDays: number;
}

export interface GenerationSource {
  type: 'Vehicle' | 'Rental' | 'Customer' | 'Fine' | 'Document';
  rules: ReminderRule[];
}

// Define all reminder rules
export const REMINDER_SOURCES: GenerationSource[] = [
  {
    type: 'Vehicle',
    rules: [
      { code: 'VEH_MOT_30D', leadDays: 30 },
      { code: 'VEH_MOT_14D', leadDays: 14 },
      { code: 'VEH_MOT_7D', leadDays: 7 },
      { code: 'VEH_MOT_0D', leadDays: 0 },
      { code: 'VEH_TAX_30D', leadDays: 30 },
      { code: 'VEH_TAX_14D', leadDays: 14 },
      { code: 'VEH_TAX_7D', leadDays: 7 },
      { code: 'VEH_TAX_0D', leadDays: 0 },
      { code: 'IMM_FIT_30D', leadDays: 30 },
      { code: 'IMM_FIT_14D', leadDays: 14 },
      { code: 'IMM_FIT_7D', leadDays: 7 },
      { code: 'IMM_FIT_0D', leadDays: 0 }
    ]
  },
  {
    type: 'Document', 
    rules: [
      { code: 'INS_EXP_30D', leadDays: 30 },
      { code: 'INS_EXP_14D', leadDays: 14 },
      { code: 'INS_EXP_7D', leadDays: 7 },
      { code: 'INS_EXP_0D', leadDays: 0 },
      { code: 'DOC_EXP_30D', leadDays: 30 },
      { code: 'DOC_EXP_14D', leadDays: 14 },
      { code: 'DOC_EXP_7D', leadDays: 7 },
      { code: 'DOC_EXP_0D', leadDays: 0 }
    ]
  },
  {
    type: 'Rental',
    rules: [
      { code: 'RENT_OVERDUE', leadDays: 0 }
    ]
  },
  {
    type: 'Fine',
    rules: [
      { code: 'FINE_DUE_14D', leadDays: 14 },
      { code: 'FINE_DUE_7D', leadDays: 7 },
      { code: 'FINE_DUE_0D', leadDays: 0 }
    ]
  }
];

function getToday(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// Smart rule selection: pick the most appropriate rule based on days remaining
function selectBestRule(daysUntilDue: number, rulePrefix: string): ReminderRule | null {
  const vehicleSource = REMINDER_SOURCES.find(s => s.type === 'Vehicle');
  const rules = vehicleSource?.rules.filter(r => r.code.includes(rulePrefix)) || [];
  
  // Sort rules by leadDays descending (30, 14, 7, 0)
  const sortedRules = rules.sort((a, b) => b.leadDays - a.leadDays);
  
  // For immobiliser reminders, we check days since acquisition, not until due
  if (rulePrefix === 'IMM_FIT') {
    // For immobilisers, find the right rule based on days since acquisition
    for (const rule of sortedRules) {
      if (daysUntilDue >= rule.leadDays) {
        return rule;
      }
    }
    // If none matched, use the immediate rule (0 days)
    return rules.find(r => r.leadDays === 0) || null;
  }
  
  // For other types (MOT, TAX), use the original logic
  // Select the most appropriate rule based on days remaining
  for (const rule of sortedRules) {
    if (daysUntilDue >= rule.leadDays) {
      return rule;
    }
  }
  
  // If overdue (negative days), use the 0D rule
  return rules.find(r => r.leadDays === 0) || null;
}

// Clean up duplicate reminders for a specific vehicle and event type
async function cleanupDuplicateReminders(vehicleId: string, eventType: 'MOT' | 'TAX'): Promise<void> {
  await supabase
    .from('reminders')
    .delete()
    .eq('object_type', 'Vehicle')
    .eq('object_id', vehicleId)
    .like('rule_code', `%${eventType}%`)
    .in('status', ['pending', 'snoozed']);
}

export async function generateVehicleReminders(): Promise<number> {
  let generated = 0;
  const today = getToday();
  
  // Get vehicles with MOT or TAX dates, or without immobilisers
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, reg, make, model, mot_due_date, tax_due_date, has_remote_immobiliser, acquisition_date')
    .or('mot_due_date.not.is.null,tax_due_date.not.is.null,has_remote_immobiliser.eq.false')
    .eq('is_disposed', false);
    
  if (error) {
    console.error('Error fetching vehicles:', error);
    return 0;
  }
  
  for (const vehicle of vehicles || []) {
    // MOT reminders - smart rule selection
    if (vehicle.mot_due_date) {
      const motDate = parseISO(vehicle.mot_due_date);
      const daysUntilDue = Math.ceil((motDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Clean up existing MOT reminders first
      await cleanupDuplicateReminders(vehicle.id, 'MOT');
      
      // Select the best rule based on days remaining
      const bestRule = selectBestRule(daysUntilDue, 'MOT');
      
      if (bestRule) {
        const remindDate = subDays(motDate, bestRule.leadDays);
        
        // Only create if remind date has passed
        if (format(remindDate, 'yyyy-MM-dd') <= formatDate(today)) {
          const context: ReminderContext = {
            vehicle_id: vehicle.id,
            reg: vehicle.reg,
            make: vehicle.make,
            model: vehicle.model,
            due_date: vehicle.mot_due_date,
            days_until: Math.max(0, daysUntilDue)
          };
          
          const created = await upsertReminder({
            rule_code: bestRule.code,
            object_type: 'Vehicle',
            object_id: vehicle.id,
            title: getTitleTemplate(bestRule.code, context),
            message: getMessageTemplate(bestRule.code, context),
            due_on: vehicle.mot_due_date,
            remind_on: formatDate(remindDate),
            severity: getSeverityForRule(bestRule.code),
            context
          });
          
          if (created) generated++;
        }
      }
    }
    
    // TAX reminders - smart rule selection
    if (vehicle.tax_due_date) {
      const taxDate = parseISO(vehicle.tax_due_date);
      const daysUntilDue = Math.ceil((taxDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Clean up existing TAX reminders first
      await cleanupDuplicateReminders(vehicle.id, 'TAX');
      
      // Select the best rule based on days remaining
      const bestRule = selectBestRule(daysUntilDue, 'TAX');
      
      if (bestRule) {
        const remindDate = subDays(taxDate, bestRule.leadDays);
        
        // Only create if remind date has passed
        if (format(remindDate, 'yyyy-MM-dd') <= formatDate(today)) {
          const context: ReminderContext = {
            vehicle_id: vehicle.id,
            reg: vehicle.reg,
            make: vehicle.make,
            model: vehicle.model,
            due_date: vehicle.tax_due_date,
            days_until: Math.max(0, daysUntilDue)
          };
          
          const created = await upsertReminder({
            rule_code: bestRule.code,
            object_type: 'Vehicle',
            object_id: vehicle.id,
            title: getTitleTemplate(bestRule.code, context),
            message: getMessageTemplate(bestRule.code, context),
            due_on: vehicle.tax_due_date,
            remind_on: formatDate(remindDate),
            severity: getSeverityForRule(bestRule.code),
            context
          });
          
          if (created) generated++;
        }
      }
    }

    // Immobiliser reminders - for vehicles without immobilisers
    if (!vehicle.has_remote_immobiliser && vehicle.acquisition_date) {
      const acquisitionDate = parseISO(vehicle.acquisition_date);
      const daysSinceAcquisition = Math.ceil((today.getTime() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Clean up existing immobiliser reminders first
      await supabase
        .from('reminders')
        .delete()
        .eq('object_type', 'Vehicle')
        .eq('object_id', vehicle.id)
        .like('rule_code', '%IMM_FIT%')
        .in('status', ['pending', 'snoozed']);
      
      // Select the best rule based on days since acquisition
      const immobiliserRule = selectBestRule(daysSinceAcquisition, 'IMM_FIT');
      
      if (immobiliserRule) {
        const remindDate = addDays(acquisitionDate, immobiliserRule.leadDays);
        
        // Only create if remind date has passed
        if (format(remindDate, 'yyyy-MM-dd') <= formatDate(today)) {
          const context: ReminderContext = {
            vehicle_id: vehicle.id,
            reg: vehicle.reg,
            make: vehicle.make,
            model: vehicle.model,
            acquisition_date: vehicle.acquisition_date,
            days_since_acquisition: daysSinceAcquisition
          };
          
          const created = await upsertReminder({
            rule_code: immobiliserRule.code,
            object_type: 'Vehicle',
            object_id: vehicle.id,
            title: getTitleTemplate(immobiliserRule.code, context),
            message: getMessageTemplate(immobiliserRule.code, context),
            due_on: formatDate(today), // Due immediately since it's overdue
            remind_on: formatDate(remindDate),
            severity: getSeverityForRule(immobiliserRule.code),
            context
          });
          
          if (created) generated++;
        }
      }
    }
  }
  
  return generated;
}

export async function generateDocumentReminders(): Promise<number> {
  let generated = 0;
  const today = getToday();
  
  // Get customer documents with end dates
  const { data: documents, error } = await supabase
    .from('customer_documents')
    .select(`
      id, document_type, policy_number, insurance_provider, end_date, policy_end_date,
      customer_id, vehicle_id,
      customers!inner(name),
      vehicles(reg, make, model)
    `)
    .not('end_date', 'is', null)
    .or('policy_end_date.not.is.null');
    
  if (error) {
    console.error('Error fetching documents:', error);
    return 0;
  }
  
  for (const doc of documents || []) {
    const endDate = doc.policy_end_date || doc.end_date;
    if (!endDate) continue;
    
    const dueDate = parseISO(endDate);
    const isInsurance = doc.document_type === 'Insurance Certificate' || doc.insurance_provider;
    const rulePrefix = isInsurance ? 'INS_EXP' : 'DOC_EXP';
    const rules = REMINDER_SOURCES.find(s => s.type === 'Document')?.rules.filter(r => r.code.includes(rulePrefix)) || [];
    
    for (const rule of rules) {
      const remindDate = subDays(dueDate, rule.leadDays);
      
      if (format(remindDate, 'yyyy-MM-dd') <= formatDate(today)) {
        const context: ReminderContext = {
          customer_id: doc.customer_id,
          customer_name: doc.customers?.name,
          vehicle_id: doc.vehicle_id,
          reg: doc.vehicles?.reg,
          policy_no: doc.policy_number,
          provider: doc.insurance_provider,
          due_date: endDate,
          days_until: rule.leadDays
        };
        
        const created = await upsertReminder({
          rule_code: rule.code,
          object_type: 'Document',
          object_id: doc.id,
          title: getTitleTemplate(rule.code, context),
          message: getMessageTemplate(rule.code, context),
          due_on: endDate,
          remind_on: formatDate(remindDate),
          severity: getSeverityForRule(rule.code),
          context
        });
        
        if (created) generated++;
      }
    }
  }
  
  return generated;
}

export async function generateRentalReminders(): Promise<number> {
  let generated = 0;
  const today = getToday();
  
  // Get rentals with overdue charges
  const { data: overdueRentals, error } = await supabase
    .from('ledger_entries')
    .select(`
      rental_id, customer_id, vehicle_id,
      due_date, remaining_amount,
      rentals!inner(status),
      customers!inner(name),
      vehicles!inner(reg, make, model)
    `)
    .eq('type', 'Charge')
    .eq('category', 'Rental')
    .gt('remaining_amount', 0)
    .lt('due_date', formatDate(today))
    .eq('rentals.status', 'Active');
    
  if (error) {
    console.error('Error fetching overdue rentals:', error);
    return 0;
  }
  
  // Group by rental to avoid duplicates
  const rentalGroups = new Map<string, any[]>();
  for (const charge of overdueRentals || []) {
    if (!rentalGroups.has(charge.rental_id)) {
      rentalGroups.set(charge.rental_id, []);
    }
    rentalGroups.get(charge.rental_id)!.push(charge);
  }
  
  for (const [rentalId, charges] of rentalGroups) {
    const totalOverdue = charges.reduce((sum, c) => sum + parseFloat(c.remaining_amount.toString()), 0);
    const oldestCharge = charges.sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    
    const context: ReminderContext = {
      rental_id: rentalId,
      customer_id: oldestCharge.customer_id,
      customer_name: oldestCharge.customers?.name,
      vehicle_id: oldestCharge.vehicle_id,
      reg: oldestCharge.vehicles?.reg,
      overdue_total: totalOverdue,
      oldest_due_date: oldestCharge.due_date
    };
    
    const created = await upsertReminder({
      rule_code: 'RENT_OVERDUE',
      object_type: 'Rental',
      object_id: rentalId,
      title: getTitleTemplate('RENT_OVERDUE', context),
      message: getMessageTemplate('RENT_OVERDUE', context),
      due_on: oldestCharge.due_date,
      remind_on: formatDate(today),
      severity: getSeverityForRule('RENT_OVERDUE'),
      context
    });
    
    if (created) generated++;
  }
  
  return generated;
}

export async function generateFineReminders(): Promise<number> {
  let generated = 0;
  const today = getToday();
  
  // Get fines with due dates
  const { data: fines, error } = await supabase
    .from('fines')
    .select(`
      id, reference_no, type, amount, due_date, liability,
      customer_id, vehicle_id,
      customers(name),
      vehicles(reg, make, model)
    `)
    .in('status', ['Open', 'Appealed', 'Charged'])
    .not('due_date', 'is', null);
    
  if (error) {
    console.error('Error fetching fines:', error);
    return 0;
  }
  
  for (const fine of fines || []) {
    const dueDate = parseISO(fine.due_date);
    const rules = REMINDER_SOURCES.find(s => s.type === 'Fine')?.rules || [];
    
    for (const rule of rules) {
      const remindDate = subDays(dueDate, rule.leadDays);
      
      if (format(remindDate, 'yyyy-MM-dd') <= formatDate(today)) {
        const context: ReminderContext = {
          fine_id: fine.id,
          reference: fine.reference_no,
          customer_id: fine.customer_id,
          customer_name: fine.customers?.name,
          vehicle_id: fine.vehicle_id,
          reg: fine.vehicles?.reg,
          amount: parseFloat(fine.amount.toString()),
          due_date: fine.due_date,
          days_until: rule.leadDays
        };
        
        const created = await upsertReminder({
          rule_code: rule.code,
          object_type: 'Fine',
          object_id: fine.id,
          title: getTitleTemplate(rule.code, context),
          message: getMessageTemplate(rule.code, context),
          due_on: fine.due_date,
          remind_on: formatDate(remindDate),
          severity: getSeverityForRule(rule.code),
          context
        });
        
        if (created) generated++;
      }
    }
  }
  
  return generated;
}

interface ReminderInput {
  rule_code: string;
  object_type: string;
  object_id: string;
  title: string;
  message: string;
  due_on: string;
  remind_on: string;
  severity: string;
  context: ReminderContext;
}

async function upsertReminder(input: ReminderInput): Promise<boolean> {
  try {
    // First check if reminder already exists and is done/dismissed
    const { data: existing } = await supabase
      .from('reminders')
      .select('id, status')
      .eq('rule_code', input.rule_code)
      .eq('object_type', input.object_type)
      .eq('object_id', input.object_id)
      .eq('due_on', input.due_on)
      .eq('remind_on', input.remind_on)
      .single();
    
    if (existing && ['done', 'dismissed', 'expired'].includes(existing.status)) {
      return false; // Don't recreate completed reminders
    }
    
    const { error } = await supabase
      .from('reminders')
      .upsert({
        rule_code: input.rule_code,
        object_type: input.object_type,
        object_id: input.object_id,
        title: input.title,
        message: input.message,
        due_on: input.due_on,
        remind_on: input.remind_on,
        severity: input.severity,
        context: input.context as any,
        status: 'pending'
      });
    
    if (error) {
      console.error('Error upserting reminder:', error);
      return false;
    }
    
    // Note: We'd need the actual reminder ID for action logging
    // For now, skip action logging during generation to avoid complexity
    
    return !existing; // Return true if this was a new reminder
  } catch (error) {
    console.error('Error in upsertReminder:', error);
    return false;
  }
}

export async function expireOldReminders(): Promise<number> {
  const today = getToday();
  
  const { data: expiredReminders, error } = await supabase
    .from('reminders')
    .update({ status: 'expired' })
    .lt('due_on', formatDate(today))
    .in('status', ['pending', 'snoozed'])
    .select('id');
    
  if (error) {
    console.error('Error expiring old reminders:', error);
    return 0;
  }
  
  // Log expiry actions
  for (const reminder of expiredReminders || []) {
    await supabase
      .from('reminder_actions')
      .insert({
        reminder_id: reminder.id,
        action: 'expired',
        note: 'Automatically expired due to past due date'
      });
  }
  
  return expiredReminders?.length || 0;
}