import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderContext {
  vehicle_id?: string;
  reg?: string;
  make?: string;
  model?: string;
  customer_id?: string;
  customer_name?: string;
  rental_id?: string;
  fine_id?: string;
  reference?: string;
  policy_no?: string;
  provider?: string;
  due_date?: string;
  amount?: number;
  overdue_total?: number;
  oldest_due_date?: string;
  days_until?: number;
  days_overdue?: number;
}

function getTitleTemplate(ruleCode: string, context: ReminderContext): string {
  const templates: Record<string, (ctx: ReminderContext) => string> = {
    VEH_MOT_30D: (ctx) => `MOT due soon — ${ctx.reg} (30 days)`,
    VEH_MOT_14D: (ctx) => `MOT due soon — ${ctx.reg} (14 days)`,
    VEH_MOT_7D: (ctx) => `MOT due soon — ${ctx.reg} (7 days)`,
    VEH_MOT_0D: (ctx) => `MOT due today — ${ctx.reg}`,
    VEH_TAX_30D: (ctx) => `TAX due soon — ${ctx.reg} (30 days)`,
    VEH_TAX_14D: (ctx) => `TAX due soon — ${ctx.reg} (14 days)`,
    VEH_TAX_7D: (ctx) => `TAX due soon — ${ctx.reg} (7 days)`,
    VEH_TAX_0D: (ctx) => `TAX due today — ${ctx.reg}`,
    INS_EXP_30D: (ctx) => `Insurance expiring — ${ctx.customer_name} (${ctx.reg}) (30 days)`,
    INS_EXP_14D: (ctx) => `Insurance expiring — ${ctx.customer_name} (${ctx.reg}) (14 days)`,
    INS_EXP_7D: (ctx) => `Insurance expiring — ${ctx.customer_name} (${ctx.reg}) (7 days)`,
    INS_EXP_0D: (ctx) => `Insurance expires today — ${ctx.customer_name} (${ctx.reg})`,
    DOC_EXP_30D: (ctx) => `Document expiring — ${ctx.customer_name} (30 days)`,
    DOC_EXP_14D: (ctx) => `Document expiring — ${ctx.customer_name} (14 days)`,
    DOC_EXP_7D: (ctx) => `Document expiring — ${ctx.customer_name} (7 days)`,
    DOC_EXP_0D: (ctx) => `Document expires today — ${ctx.customer_name}`,
    RENT_OVERDUE: (ctx) => `Overdue rental balance — ${ctx.customer_name} (${ctx.reg})`,
    FINE_DUE_14D: (ctx) => `Fine due soon — ${ctx.reg} (${ctx.reference}) (14 days)`,
    FINE_DUE_7D: (ctx) => `Fine due soon — ${ctx.reg} (${ctx.reference}) (7 days)`,
    FINE_DUE_0D: (ctx) => `Fine due today — ${ctx.reg} (${ctx.reference})`,
  };
  
  const template = templates[ruleCode];
  return template ? template(context) : `Reminder: ${ruleCode}`;
}

function getMessageTemplate(ruleCode: string, context: ReminderContext): string {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  const templates: Record<string, (ctx: ReminderContext) => string> = {
    VEH_MOT_30D: (ctx) => `MOT for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Please book test soon.`,
    VEH_MOT_14D: (ctx) => `MOT for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Please book test immediately.`,
    VEH_MOT_7D: (ctx) => `MOT for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Book test urgently!`,
    VEH_MOT_0D: (ctx) => `MOT for ${ctx.reg} (${ctx.make} ${ctx.model}) due today (${ctx.due_date}). Immediate action required!`,
    VEH_TAX_30D: (ctx) => `TAX for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Renew soon.`,
    VEH_TAX_14D: (ctx) => `TAX for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Renew immediately.`,
    VEH_TAX_7D: (ctx) => `TAX for ${ctx.reg} (${ctx.make} ${ctx.model}) due on ${ctx.due_date}. Renew urgently!`,
    VEH_TAX_0D: (ctx) => `TAX for ${ctx.reg} (${ctx.make} ${ctx.model}) due today (${ctx.due_date}). Immediate action required!`,
    INS_EXP_30D: (ctx) => `Insurance policy ${ctx.policy_no} for ${ctx.customer_name} expires on ${ctx.due_date}. Contact ${ctx.provider} to renew.`,
    INS_EXP_14D: (ctx) => `Insurance policy ${ctx.policy_no} for ${ctx.customer_name} expires on ${ctx.due_date}. Renew immediately with ${ctx.provider}.`,
    INS_EXP_7D: (ctx) => `Insurance policy ${ctx.policy_no} for ${ctx.customer_name} expires on ${ctx.due_date}. Urgent renewal required!`,
    INS_EXP_0D: (ctx) => `Insurance policy ${ctx.policy_no} for ${ctx.customer_name} expires today (${ctx.due_date}). Immediate action required!`,
    DOC_EXP_30D: (ctx) => `Document for ${ctx.customer_name} expires on ${ctx.due_date}. Please request renewal.`,
    DOC_EXP_14D: (ctx) => `Document for ${ctx.customer_name} expires on ${ctx.due_date}. Request renewal immediately.`,
    DOC_EXP_7D: (ctx) => `Document for ${ctx.customer_name} expires on ${ctx.due_date}. Urgent renewal required!`,
    DOC_EXP_0D: (ctx) => `Document for ${ctx.customer_name} expires today (${ctx.due_date}). Immediate action required!`,
    RENT_OVERDUE: (ctx) => `${formatCurrency(ctx.overdue_total || 0)} overdue since ${ctx.oldest_due_date}. Review ledger & contact customer.`,
    FINE_DUE_14D: (ctx) => `Fine ${ctx.reference} for ${ctx.reg} (${formatCurrency(ctx.amount || 0)}) due on ${ctx.due_date}. Prepare payment or appeal.`,
    FINE_DUE_7D: (ctx) => `Fine ${ctx.reference} for ${ctx.reg} (${formatCurrency(ctx.amount || 0)}) due on ${ctx.due_date}. Urgent action required!`,
    FINE_DUE_0D: (ctx) => `Fine ${ctx.reference} for ${ctx.reg} (${formatCurrency(ctx.amount || 0)}) due today (${ctx.due_date}). Immediate payment required!`,
  };
  
  const template = templates[ruleCode];
  return template ? template(context) : `Reminder for ${ruleCode}`;
}

function getSeverityForRule(ruleCode: string): 'info' | 'warning' | 'critical' {
  if (ruleCode.includes('_30D') || ruleCode.includes('_14D')) {
    return 'warning';
  }
  if (ruleCode.includes('_7D') || ruleCode.includes('_0D') || ruleCode.includes('OVERDUE')) {
    return 'critical';
  }
  return 'info';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting reminder generation...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];
    let totalGenerated = 0;

    // Check if reminders are enabled
    const { data: config } = await supabase
      .from('reminder_config')
      .select('config_value')
      .eq('config_key', 'reminders.enabled')
      .single();

    if (!config || config.config_value !== true) {
      console.log('Reminders are disabled, skipping generation');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Reminders disabled',
        generated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Expire old reminders
    const { data: expiredReminders, error: expireError } = await supabase
      .from('reminders')
      .update({ status: 'expired' })
      .lt('due_on', today)
      .in('status', ['pending', 'snoozed'])
      .select('id');

    if (expireError) {
      console.error('Error expiring reminders:', expireError);
    } else {
      console.log(`Expired ${expiredReminders?.length || 0} old reminders`);
      
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
    }

    // 2. Generate Vehicle MOT/TAX reminders
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, reg, make, model, mot_due_date, tax_due_date')
      .or('mot_due_date.not.is.null,tax_due_date.not.is.null')
      .eq('is_disposed', false);

    for (const vehicle of vehicles || []) {
      // MOT reminders
      if (vehicle.mot_due_date) {
        const motDate = new Date(vehicle.mot_due_date);
        const rules = [
          { code: 'VEH_MOT_30D', leadDays: 30 },
          { code: 'VEH_MOT_14D', leadDays: 14 },
          { code: 'VEH_MOT_7D', leadDays: 7 },
          { code: 'VEH_MOT_0D', leadDays: 0 }
        ];

        for (const rule of rules) {
          const remindDate = new Date(motDate);
          remindDate.setDate(motDate.getDate() - rule.leadDays);
          const remindDateStr = remindDate.toISOString().split('T')[0];

          if (remindDateStr <= today) {
            const context: ReminderContext = {
              vehicle_id: vehicle.id,
              reg: vehicle.reg,
              make: vehicle.make,
              model: vehicle.model,
              due_date: vehicle.mot_due_date,
              days_until: rule.leadDays
            };

            const { error: reminderError } = await supabase
              .from('reminders')
              .upsert({
                rule_code: rule.code,
                object_type: 'Vehicle',
                object_id: vehicle.id,
                title: getTitleTemplate(rule.code, context),
                message: getMessageTemplate(rule.code, context),
                due_on: vehicle.mot_due_date,
                remind_on: remindDateStr,
                severity: getSeverityForRule(rule.code),
                context: context,
                status: 'pending'
              }, {
                onConflict: 'rule_code,object_type,object_id,due_on,remind_on'
              });

            if (!reminderError) {
              totalGenerated++;
            }
          }
        }
      }

      // TAX reminders (similar logic)
      if (vehicle.tax_due_date) {
        const taxDate = new Date(vehicle.tax_due_date);
        const rules = [
          { code: 'VEH_TAX_30D', leadDays: 30 },
          { code: 'VEH_TAX_14D', leadDays: 14 },
          { code: 'VEH_TAX_7D', leadDays: 7 },
          { code: 'VEH_TAX_0D', leadDays: 0 }
        ];

        for (const rule of rules) {
          const remindDate = new Date(taxDate);
          remindDate.setDate(taxDate.getDate() - rule.leadDays);
          const remindDateStr = remindDate.toISOString().split('T')[0];

          if (remindDateStr <= today) {
            const context: ReminderContext = {
              vehicle_id: vehicle.id,
              reg: vehicle.reg,
              make: vehicle.make,
              model: vehicle.model,
              due_date: vehicle.tax_due_date,
              days_until: rule.leadDays
            };

            const { error: reminderError } = await supabase
              .from('reminders')
              .upsert({
                rule_code: rule.code,
                object_type: 'Vehicle',
                object_id: vehicle.id,
                title: getTitleTemplate(rule.code, context),
                message: getMessageTemplate(rule.code, context),
                due_on: vehicle.tax_due_date,
                remind_on: remindDateStr,
                severity: getSeverityForRule(rule.code),
                context: context,
                status: 'pending'
              }, {
                onConflict: 'rule_code,object_type,object_id,due_on,remind_on'
              });

            if (!reminderError) {
              totalGenerated++;
            }
          }
        }
      }
    }

    // 3. Generate rental overdue reminders
    const { data: overdueCharges } = await supabase
      .from('ledger_entries')
      .select(`
        rental_id, customer_id, vehicle_id, due_date, remaining_amount,
        rentals!inner(status),
        customers!inner(name),
        vehicles!inner(reg, make, model)
      `)
      .eq('type', 'Charge')
      .eq('category', 'Rental')
      .gt('remaining_amount', 0)
      .lt('due_date', today)
      .eq('rentals.status', 'Active');

    // Group by rental
    const rentalGroups = new Map<string, any[]>();
    for (const charge of overdueCharges || []) {
      if (!rentalGroups.has(charge.rental_id)) {
        rentalGroups.set(charge.rental_id, []);
      }
      rentalGroups.get(charge.rental_id)!.push(charge);
    }

    for (const [rentalId, charges] of rentalGroups) {
      const totalOverdue = charges.reduce((sum, c) => sum + parseFloat(c.remaining_amount), 0);
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

      const { error: reminderError } = await supabase
        .from('reminders')
        .upsert({
          rule_code: 'RENT_OVERDUE',
          object_type: 'Rental',
          object_id: rentalId,
          title: getTitleTemplate('RENT_OVERDUE', context),
          message: getMessageTemplate('RENT_OVERDUE', context),
          due_on: oldestCharge.due_date,
          remind_on: today,
          severity: getSeverityForRule('RENT_OVERDUE'),
          context: context,
          status: 'pending'
        }, {
          onConflict: 'rule_code,object_type,object_id,due_on,remind_on'
        });

      if (!reminderError) {
        totalGenerated++;
      }
    }

    console.log(`Generation complete. Created ${totalGenerated} reminders.`);

    return new Response(JSON.stringify({ 
      success: true, 
      generated: totalGenerated,
      expired: expiredReminders?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reminder generation:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});