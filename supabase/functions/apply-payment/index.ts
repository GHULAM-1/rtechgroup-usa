import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentProcessingResult {
  ok?: boolean;
  paymentId?: string;
  category?: string;
  entryDate?: string;
  error?: string;
  detail?: string;
}

async function applyPayment(supabase: any, paymentId: string): Promise<PaymentProcessingResult> {
  try {
    console.log('Processing payment:', paymentId);

    // Load payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      return {
        ok: false,
        error: 'Payment not found',
        detail: paymentError?.message || 'Payment does not exist'
      };
    }

    // Map category (case-insensitive)
    let category = 'Other';
    const paymentType = (payment.payment_type || '').toLowerCase();
    
    if (['initial fee', 'initial fees', 'initialfee'].includes(paymentType)) {
      category = 'Initial Fees';
    } else if (paymentType === 'rental') {
      category = 'Rental';
    } else if (paymentType === 'fine') {
      category = 'Fines';
    }

    // Determine entry date
    const entryDate = payment.payment_date || payment.paid_at || payment.created_at || new Date().toISOString().split('T')[0];

    console.log(`Payment ${paymentId}: ${category}, ${entryDate}, ${payment.amount}`);
    
    // Special logging for Initial Fee processing
    if (category === 'Initial Fees') {
      console.log(`Processing Initial Fee payment - will create immediate revenue entry, no allocation to charges`);
    }

    // Insert/Update Ledger entry - CRITICAL: Never fail silently
    console.log(`Creating ledger entry for payment ${paymentId}: amount=${payment.amount}, category=${category}`);
    
    const { data: ledgerEntry, error: ledgerError } = await supabase
      .from('ledger_entries')
      .insert([{
        customer_id: payment.customer_id,
        rental_id: payment.rental_id,
        vehicle_id: payment.vehicle_id,
        entry_date: entryDate,
        type: 'Payment',
        category: category,
        amount: -Math.abs(payment.amount), // Ensure negative
        due_date: entryDate,
        remaining_amount: 0,
        payment_id: payment.id
      }])
      .select()
      .single();

    if (ledgerError) {
      console.error('CRITICAL: Ledger insert failed:', ledgerError);
      
      // Only allow duplicate key errors to pass through
      if (ledgerError.message.includes('duplicate key') || ledgerError.code === '23505') {
        console.log('Ledger entry already exists, continuing...');
      } else {
        // All other errors are critical failures
        return {
          ok: false,
          error: 'CRITICAL: Failed to create ledger entry',
          detail: `${ledgerError.code}: ${ledgerError.message}`
        };
      }
    } else {
      console.log('Ledger entry created successfully:', ledgerEntry?.id);
    }

    // Handle different payment types
    if (category === 'Rental' && payment.rental_id) {
      console.log(`Processing Rental payment - applying FIFO allocation to charges`);
      
      // FIFO allocation logic for rental payments
      let remainingAmount = payment.amount;
      let totalAllocated = 0;
      
      // Fetch outstanding charges for this rental in FIFO order (by due_date, then entry_date)
      const { data: outstandingCharges, error: chargesError } = await supabase
        .from('ledger_entries')
        .select('id, amount, remaining_amount, due_date, entry_date')
        .eq('rental_id', payment.rental_id)
        .eq('type', 'Charge')
        .eq('category', 'Rental')
        .gt('remaining_amount', 0)
        .order('due_date', { ascending: true })
        .order('entry_date', { ascending: true })
        .order('id', { ascending: true });
      
      if (chargesError) {
        console.error('Error fetching outstanding charges:', chargesError);
        return {
          ok: false,
          error: 'Failed to fetch outstanding charges',
          detail: chargesError.message
        };
      }

      console.log(`Found ${outstandingCharges?.length || 0} outstanding charges for rental ${payment.rental_id}`);

      // Apply payment to charges in FIFO order
      for (const charge of outstandingCharges || []) {
        if (remainingAmount <= 0) break;

        const toApply = Math.min(remainingAmount, charge.remaining_amount);
        const chargeDueDate = charge.due_date;

        console.log(`Applying £${toApply} to charge ${charge.id} (due ${chargeDueDate})`);

        // Create payment application record
        const { error: applicationError } = await supabase
          .from('payment_applications')
          .insert({
            payment_id: paymentId,
            charge_entry_id: charge.id,
            amount_applied: toApply
          });

        if (applicationError && !applicationError.message.includes('duplicate key')) {
          console.error('Payment application error:', applicationError);
          return {
            ok: false,
            error: 'Failed to create payment application',
            detail: applicationError.message
          };
        }

        // Update charge remaining amount
        const { error: chargeUpdateError } = await supabase
          .from('ledger_entries')
          .update({
            remaining_amount: charge.remaining_amount - toApply
          })
          .eq('id', charge.id);

        if (chargeUpdateError) {
          console.error('Charge update error:', chargeUpdateError);
          return {
            ok: false,
            error: 'Failed to update charge',
            detail: chargeUpdateError.message
          };
        }

        // Create P&L revenue entry for the applied amount (booked on charge due date for FIFO)
        const { error: pnlRevenueError } = await supabase
          .from('pnl_entries')
          .insert({
            vehicle_id: payment.vehicle_id,
            entry_date: chargeDueDate,
            side: 'Revenue',
            category: 'Rental',
            amount: toApply,
            source_ref: `${paymentId}_${charge.id}`,
            customer_id: payment.customer_id
          });

        if (pnlRevenueError && !pnlRevenueError.message.includes('duplicate key')) {
          console.error('P&L revenue entry error:', pnlRevenueError);
        }

        totalAllocated += toApply;
        remainingAmount -= toApply;
      }

      console.log(`Rental payment allocation complete: £${totalAllocated} allocated, £${remainingAmount} remaining`);
      
      // Update payment status based on allocation
      let paymentStatus = 'Applied';
      if (remainingAmount > 0) {
        paymentStatus = remainingAmount === payment.amount ? 'Credit' : 'Partial';
      }

      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({ 
          status: paymentStatus, 
          remaining_amount: remainingAmount 
        })
        .eq('id', paymentId);

      if (paymentUpdateError) {
        console.error('Payment update error:', paymentUpdateError);
      }

      return {
        ok: true,
        paymentId: paymentId,
        category: category,
        entryDate: entryDate,
        allocated: totalAllocated,
        remaining: remainingAmount,
        status: paymentStatus
      };
    }

    // For non-rental payments (Initial Fees, etc.), create immediate P&L entry
    const pnlEntry: any = {
      vehicle_id: payment.vehicle_id,
      rental_id: payment.rental_id,
      customer_id: payment.customer_id,
      entry_date: entryDate,
      category: category,
      amount: Math.abs(payment.amount), // Ensure positive
      reference: payment.id,
      payment_id: payment.id,
      side: 'Revenue'
    };

    // Insert/Update P&L entry - handle duplicates with try-catch
    try {
      const { error: pnlError } = await supabase
        .from('pnl_entries')
        .insert([pnlEntry]);

      if (pnlError && !pnlError.message.includes('duplicate key')) {
        console.error('P&L insert error:', pnlError);
        return {
          ok: false,
          error: 'Failed to create P&L entry',
          detail: pnlError.message
        };
      }
    } catch (err) {
      // Ignore duplicate key errors, log others
      if (!err.message?.includes('duplicate key')) {
        console.error('P&L insert error:', err);
        return {
          ok: false,
          error: 'Failed to create P&L entry',
          detail: err.message
        };
      }
    }

    // Update payment status (no FIFO allocation yet)
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: 'Applied', 
        remaining_amount: 0 
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Payment update error:', updateError);
    }

    console.log('Payment processed successfully');

    return {
      ok: true,
      paymentId: paymentId,
      category: category,
      entryDate: entryDate
    };

  } catch (error) {
    console.error('Payment processing error:', error);
    return {
      ok: false,
      error: 'Payment processing failed',
      detail: error.message || 'Unknown error occurred'
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(JSON.stringify({ 
        error: 'Missing Supabase configuration',
        detail: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        detail: error.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { paymentId } = body;
    
    if (!paymentId) {
      return new Response(JSON.stringify({ 
        error: 'Payment ID is required',
        detail: 'paymentId field must be provided in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apply payment using centralized service
    const result = await applyPayment(supabase, paymentId);

    if (!result.ok) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Server error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: 'Internal server error',
      detail: error.message || 'Unknown server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});