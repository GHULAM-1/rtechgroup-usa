import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentProcessingResult {
  success: boolean;
  paymentId: string;
  category: string;
  allocated: number;
  remaining: number;
  error?: string;
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
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { paymentId } = await req.json();
    
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    console.log('Processing payment:', paymentId);

    // Step 1: Load payment data
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, customer_id, rental_id, vehicle_id, amount, payment_type, payment_date, created_at')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found: ${paymentError?.message}`);
    }

    console.log('Loaded payment:', payment);

    // Step 2: Category mapping
    const paymentTypeUpper = (payment.payment_type || '').toUpperCase();
    let category: string;
    
    if (['INITIAL FEE', 'INITIALFEE', 'INITIAL FEES'].includes(paymentTypeUpper)) {
      category = 'Initial Fees';
    } else if (paymentTypeUpper === 'RENTAL') {
      category = 'Rental';
    } else if (paymentTypeUpper === 'FINE') {
      category = 'Fines';
    } else {
      category = 'Other';
    }

    const entryDate = payment.payment_date || payment.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];

    console.log('Mapped category:', category, 'Entry date:', entryDate);

    // Step 3: Upsert ledger entry (Payment)
    const { error: ledgerError } = await supabase
      .from('ledger_entries')
      .upsert({
        customer_id: payment.customer_id,
        rental_id: payment.rental_id,
        vehicle_id: payment.vehicle_id,
        entry_date: entryDate,
        type: 'Payment',
        category: category,
        amount: -payment.amount, // Negative for payment
        due_date: entryDate,
        remaining_amount: 0,
        reference: payment.id
      }, {
        onConflict: 'reference',
        ignoreDuplicates: false
      });

    if (ledgerError) {
      console.error('Ledger error:', ledgerError);
      throw new Error(`Failed to create ledger entry: ${ledgerError.message}`);
    }

    console.log('Created/updated ledger entry');

    // Step 4: Upsert P&L entry (Revenue)
    const { error: pnlError } = await supabase
      .from('pnl_entries')
      .upsert({
        vehicle_id: payment.vehicle_id,
        entry_date: entryDate,
        side: 'Revenue',
        category: category,
        amount: payment.amount,
        source_ref: payment.id,
        customer_id: payment.customer_id,
        rental_id: payment.rental_id
      }, {
        onConflict: 'source_ref',
        ignoreDuplicates: true
      });

    if (pnlError) {
      console.error('P&L error:', pnlError);
      throw new Error(`Failed to create P&L entry: ${pnlError.message}`);
    }

    console.log('Created/updated P&L entry');

    let allocated = 0;
    let paymentRemaining = payment.amount;

    // Step 5: FIFO allocation for rental payments
    if (payment.rental_id && category === 'Rental') {
      console.log('Starting FIFO allocation for rental payment');

      // Get open charges for this rental
      const { data: openCharges, error: chargesError } = await supabase
        .from('ledger_entries')
        .select('id, remaining_amount, due_date, entry_date')
        .eq('rental_id', payment.rental_id)
        .eq('type', 'Charge')
        .eq('category', 'Rental')
        .gt('remaining_amount', 0)
        .order('due_date', { ascending: true })
        .order('entry_date', { ascending: true })
        .order('id', { ascending: true });

      if (chargesError) {
        throw new Error(`Failed to get open charges: ${chargesError.message}`);
      }

      console.log('Found open charges:', openCharges?.length || 0);

      // Apply FIFO allocation
      for (const charge of openCharges || []) {
        if (paymentRemaining <= 0) break;

        const toAllocate = Math.min(charge.remaining_amount, paymentRemaining);
        
        // Create payment application
        const { error: appError } = await supabase
          .from('payment_applications')
          .upsert({
            payment_id: payment.id,
            charge_entry_id: charge.id,
            amount_applied: toAllocate
          }, {
            onConflict: 'payment_id,charge_entry_id',
            ignoreDuplicates: false
          });

        if (appError) {
          console.error('Payment application error:', appError);
          throw new Error(`Failed to create payment application: ${appError.message}`);
        }

        // Update charge remaining amount
        const { error: updateError } = await supabase
          .from('ledger_entries')
          .update({ remaining_amount: charge.remaining_amount - toAllocate })
          .eq('id', charge.id);

        if (updateError) {
          throw new Error(`Failed to update charge: ${updateError.message}`);
        }

        allocated += toAllocate;
        paymentRemaining -= toAllocate;
        
        console.log(`Allocated ${toAllocate} to charge ${charge.id}, remaining: ${paymentRemaining}`);
      }
    }

    // Step 6: Update payment status
    let status: string;
    if (paymentRemaining === 0) {
      status = 'Applied';
    } else if (paymentRemaining === payment.amount) {
      status = 'Credit';
    } else {
      status = 'Partial';
    }

    const { error: statusError } = await supabase
      .from('payments')
      .update({
        status: status,
        remaining_amount: paymentRemaining
      })
      .eq('id', payment.id);

    if (statusError) {
      throw new Error(`Failed to update payment status: ${statusError.message}`);
    }

    console.log('Updated payment status:', status, 'remaining:', paymentRemaining);

    const result: PaymentProcessingResult = {
      success: true,
      paymentId: payment.id,
      category: category,
      allocated: allocated,
      remaining: paymentRemaining
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    
    const result: PaymentProcessingResult = {
      success: false,
      paymentId: '',
      category: '',
      allocated: 0,
      remaining: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});