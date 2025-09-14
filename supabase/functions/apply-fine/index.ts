import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FineChargeResult {
  success: boolean;
  fineId: string;
  status: string;
  chargedAmount: number;
  remainingAmount: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { fineId, action } = await req.json();

    if (!fineId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Fine ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing fine action: ${action} for fine: ${fineId}`);

    if (action === 'charge') {
      const result = await chargeFineToAccount(supabase, fineId);
      return new Response(
        JSON.stringify(result),
        { 
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else if (action === 'waive') {
      const result = await waiveFine(supabase, fineId);
      return new Response(
        JSON.stringify(result),
        { 
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else if (action === 'appeal') {
      const result = await markFineAsAppealed(supabase, fineId);
      return new Response(
        JSON.stringify(result),
        { 
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action. Use: charge, waive, or appeal' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Error processing fine action:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function chargeFineToAccount(supabase: any, fineId: string): Promise<FineChargeResult> {
  console.log(`Starting charge process for fine: ${fineId}`);

  // Start transaction-like operations
  const { data: fine, error: fineError } = await supabase
    .from('fines')
    .select('*')
    .eq('id', fineId)
    .single();

  if (fineError || !fine) {
    console.error('Fine not found:', fineError);
    return {
      success: false,
      fineId,
      status: 'error',
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Fine not found'
    };
  }

  // Validate fine can be charged
  if (['Waived', 'Charged', 'Paid'].includes(fine.status)) {
    console.log(`Fine ${fineId} already processed with status: ${fine.status}`);
    return {
      success: false,
      fineId,
      status: fine.status,
      chargedAmount: 0,
      remainingAmount: 0,
      error: `Fine is already ${fine.status.toLowerCase()}`
    };
  }

  // Only charge Customer liability fines
  if (fine.liability !== 'Customer') {
    return {
      success: false,
      fineId,
      status: fine.status,
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Only customer liability fines can be charged to account'
    };
  }

  if (!fine.customer_id) {
    return {
      success: false,
      fineId,
      status: fine.status,
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Fine must have a customer assigned'
    };
  }

  console.log(`Creating charge entry for fine ${fineId}, amount: ${fine.amount}`);

  // Create charge entry in ledger (idempotent using reference)
  const { error: chargeError } = await supabase
    .from('ledger_entries')
    .insert({
      customer_id: fine.customer_id,
      vehicle_id: fine.vehicle_id,
      entry_date: fine.issue_date,
      due_date: fine.due_date,
      type: 'Charge',
      category: 'Fine',
      amount: fine.amount,
      remaining_amount: fine.amount,
      reference: `FINE-${fine.id}`
    });

  if (chargeError && !chargeError.message.includes('duplicate key')) {
    console.error('Error creating charge entry:', chargeError);
    return {
      success: false,
      fineId,
      status: 'error',
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Failed to create charge entry'
    };
  }

  // Get the charge entry we just created
  const { data: chargeEntry, error: getChargeError } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('reference', `FINE-${fine.id}`)
    .eq('type', 'Charge')
    .single();

  if (getChargeError || !chargeEntry) {
    console.error('Error retrieving charge entry:', getChargeError);
    return {
      success: false,
      fineId,
      status: 'error',
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Failed to retrieve charge entry'
    };
  }

  console.log(`Charge entry created with ID: ${chargeEntry.id}, remaining: ${chargeEntry.remaining_amount}`);

  // Auto-allocate available credit (FIFO)
  const allocatedAmount = await allocateAvailableCredit(supabase, fine.customer_id, chargeEntry.id, chargeEntry.remaining_amount);
  
  console.log(`Allocated ${allocatedAmount} from available credit`);

  // Update charge remaining amount
  const newRemainingAmount = chargeEntry.remaining_amount - allocatedAmount;
  
  if (allocatedAmount > 0) {
    const { error: updateError } = await supabase
      .from('ledger_entries')
      .update({ remaining_amount: newRemainingAmount })
      .eq('id', chargeEntry.id);

    if (updateError) {
      console.error('Error updating charge remaining amount:', updateError);
    }
  }

  // Determine final status
  const finalStatus = newRemainingAmount <= 0 ? 'Paid' : 'Charged';
  const now = new Date().toISOString();

  console.log(`Final status: ${finalStatus}, remaining: ${newRemainingAmount}`);

  // Update fine status and timestamps
  const updateData: any = {
    status: finalStatus,
    charged_at: fine.charged_at || now
  };

  if (finalStatus === 'Paid') {
    updateData.resolved_at = fine.resolved_at || now;
  }

  const { error: updateFineError } = await supabase
    .from('fines')
    .update(updateData)
    .eq('id', fineId);

  if (updateFineError) {
    console.error('Error updating fine status:', updateFineError);
    return {
      success: false,
      fineId,
      status: 'error',
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Failed to update fine status'
    };
  }

  console.log(`Fine ${fineId} successfully processed. Status: ${finalStatus}`);

  return {
    success: true,
    fineId,
    status: finalStatus,
    chargedAmount: fine.amount,
    remainingAmount: newRemainingAmount
  };
}

async function allocateAvailableCredit(supabase: any, customerId: string, chargeEntryId: string, chargeAmount: number): Promise<number> {
  let totalAllocated = 0;
  let remainingToAllocate = chargeAmount;

  console.log(`Looking for credit to allocate for customer ${customerId}, need: ${chargeAmount}`);

  // Find payments with remaining credit (FIFO by payment_date)
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, amount, remaining_amount, payment_date')
    .eq('customer_id', customerId)
    .in('status', ['Credit', 'Partial'])
    .gt('remaining_amount', 0)
    .order('payment_date', { ascending: true })
    .order('id', { ascending: true });

  if (paymentsError) {
    console.error('Error fetching payments for allocation:', paymentsError);
    return 0;
  }

  if (!payments || payments.length === 0) {
    console.log('No credit available for allocation');
    return 0;
  }

  console.log(`Found ${payments.length} payments with available credit`);

  for (const payment of payments) {
    if (remainingToAllocate <= 0) break;

    const availableCredit = payment.remaining_amount;
    const toApply = Math.min(availableCredit, remainingToAllocate);

    console.log(`Applying ${toApply} from payment ${payment.id} (available: ${availableCredit})`);

    // Create payment application (idempotent)
    const { error: appError } = await supabase
      .from('payment_applications')
      .insert({
        payment_id: payment.id,
        charge_entry_id: chargeEntryId,
        amount_applied: toApply
      });

    if (appError && !appError.message.includes('duplicate key')) {
      console.error('Error creating payment application:', appError);
      continue;
    }

    // Update payment remaining amount
    const newPaymentRemaining = payment.remaining_amount - toApply;
    const newPaymentStatus = newPaymentRemaining <= 0 ? 'Applied' : 'Partial';

    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        remaining_amount: newPaymentRemaining,
        status: newPaymentStatus
      })
      .eq('id', payment.id);

    if (updatePaymentError) {
      console.error('Error updating payment:', updatePaymentError);
      continue;
    }

    totalAllocated += toApply;
    remainingToAllocate -= toApply;

    console.log(`Applied ${toApply}, total allocated: ${totalAllocated}, remaining to allocate: ${remainingToAllocate}`);
  }

  return totalAllocated;
}

async function waiveFine(supabase: any, fineId: string): Promise<FineChargeResult> {
  console.log(`Waiving fine: ${fineId}`);

  const { data: fine, error: fineError } = await supabase
    .from('fines')
    .select('*')
    .eq('id', fineId)
    .single();

  if (fineError || !fine) {
    return {
      success: false,
      fineId,
      status: 'error',
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Fine not found'
    };
  }

  if (['Waived', 'Paid'].includes(fine.status)) {
    return {
      success: false,
      fineId,
      status: fine.status,
      chargedAmount: 0,
      remainingAmount: 0,
      error: `Fine is already ${fine.status.toLowerCase()}`
    };
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('fines')
    .update({
      status: 'Waived',
      waived_at: now,
      resolved_at: now
    })
    .eq('id', fineId);

  if (updateError) {
    console.error('Error waiving fine:', updateError);
    return {
      success: false,
      fineId,
      status: 'error',
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Failed to waive fine'
    };
  }

  console.log(`Fine ${fineId} successfully waived`);

  return {
    success: true,
    fineId,
    status: 'Waived',
    chargedAmount: 0,
    remainingAmount: 0
  };
}

async function markFineAsAppealed(supabase: any, fineId: string): Promise<FineChargeResult> {
  console.log(`Marking fine as appealed: ${fineId}`);

  const { data: fine, error: fineError } = await supabase
    .from('fines')
    .select('*')
    .eq('id', fineId)
    .single();

  if (fineError || !fine) {
    return {
      success: false,
      fineId,
      status: 'error',
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Fine not found'
    };
  }

  if (!['Open'].includes(fine.status)) {
    return {
      success: false,
      fineId,
      status: fine.status,
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Only open fines can be appealed'
    };
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('fines')
    .update({
      status: 'Appealed',
      appealed_at: now
    })
    .eq('id', fineId);

  if (updateError) {
    console.error('Error marking fine as appealed:', updateError);
    return {
      success: false,
      fineId,
      status: 'error',
      chargedAmount: 0,
      remainingAmount: 0,
      error: 'Failed to mark fine as appealed'
    };
  }

  console.log(`Fine ${fineId} successfully marked as appealed`);

  return {
    success: true,
    fineId,
    status: 'Appealed',
    chargedAmount: 0,
    remainingAmount: 0
  };
}