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

    // Insert/Update Ledger entry - handle duplicates with try-catch
    try {
      const { error: ledgerError } = await supabase
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
        }]);

      if (ledgerError && !ledgerError.message.includes('duplicate key')) {
        console.error('Ledger insert error:', ledgerError);
        return {
          ok: false,
          error: 'Failed to create ledger entry',
          detail: ledgerError.message
        };
      }
    } catch (err) {
      // Ignore duplicate key errors, log others
      if (!err.message?.includes('duplicate key')) {
        console.error('Ledger insert error:', err);
        return {
          ok: false,
          error: 'Failed to create ledger entry',
          detail: err.message
        };
      }
    }

    // The side column exists in pnl_entries (confirmed from schema)
    const hasSideColumn = true;

    // UPSERT P&L entry (Revenue, positive amount)
    const pnlEntry: any = {
      vehicle_id: payment.vehicle_id,
      rental_id: payment.rental_id,
      customer_id: payment.customer_id,
      entry_date: entryDate,
      category: category,
      amount: Math.abs(payment.amount), // Ensure positive
      reference: payment.id,
      payment_id: payment.id
    };

    if (hasSideColumn) {
      pnlEntry.side = 'Revenue';
    }

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