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
  allocated?: number;
  remaining?: number;
  status?: string;
  error?: string;
  detail?: string;
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
        detail: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { paymentId } = await req.json();
    
    if (!paymentId) {
      console.error('Payment ID is required');
      return new Response(JSON.stringify({ 
        error: 'Payment ID is required',
        detail: 'paymentId field is missing from request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing payment:', paymentId);

    // Load payment data
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, customer_id, rental_id, vehicle_id, amount, payment_type, payment_date, created_at')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', paymentError);
      return new Response(JSON.stringify({ 
        error: 'Payment not found',
        detail: `Payment ${paymentId} not found: ${paymentError?.message || 'No payment record'}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Loaded payment:', payment);

    // Process payment using atomic database transaction
    const entryDate = payment.payment_date || payment.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
    
    console.log('Processing payment with atomic transaction:', {
      paymentId: payment.id,
      customerId: payment.customer_id,
      rentalId: payment.rental_id,
      vehicleId: payment.vehicle_id,
      amount: payment.amount,
      paymentType: payment.payment_type,
      entryDate
    });

    // Call the simple payment processing function without parameters
    const { data: processResult, error: processError } = await supabase
      .rpc('process_payment_transaction', {
        p_payment_id: payment.id
      });

    if (processError) {
      console.error('Payment processing RPC error:', processError);
      return new Response(JSON.stringify({ 
        error: 'Payment processing failed',
        detail: `RPC call failed: ${processError.message}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!processResult) {
      console.error('Payment processing returned null result');
      return new Response(JSON.stringify({ 
        error: 'Payment processing failed',
        detail: 'Processing function returned null result'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Payment processing result:', processResult);

    // Check if processing was successful
    if (!processResult.success) {
      console.error('Payment processing failed:', processResult.error);
      return new Response(JSON.stringify({ 
        error: processResult.error || 'Payment processing failed',
        detail: processResult.detail || 'Unknown database error'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return success result
    return new Response(JSON.stringify({
      ok: true,
      paymentId: processResult.paymentId,
      category: processResult.category,
      allocated: processResult.allocated,
      remaining: processResult.remaining,
      status: processResult.status
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    
    return new Response(JSON.stringify({
      error: 'Payment processing failed',
      detail: error instanceof Error ? error.message : String(error)
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});