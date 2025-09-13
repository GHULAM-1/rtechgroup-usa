import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentProcessingResult {
  success: boolean;
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
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing Supabase configuration',
        detail: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { paymentId } = await req.json();
    
    if (!paymentId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment ID is required',
        detail: 'Request body must include paymentId field'
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
        success: false,
        error: 'Payment not found',
        detail: paymentError?.message || `No payment found with ID ${paymentId}`
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Loaded payment:', payment);

    const entryDate = payment.payment_date || payment.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];

    // Use atomic transaction function for all payment processing
    const { data: result, error: processError } = await supabase.rpc('process_payment_transaction', {
      p_payment_id: payment.id,
      p_customer_id: payment.customer_id,
      p_rental_id: payment.rental_id,
      p_vehicle_id: payment.vehicle_id,
      p_amount: payment.amount,
      p_payment_type: payment.payment_type,
      p_payment_date: entryDate
    });

    if (processError) {
      console.error('Transaction processing error:', processError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Database transaction failed',
        detail: processError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The stored procedure returns a JSONB result
    const transactionResult = result as PaymentProcessingResult;
    
    if (!transactionResult.success) {
      console.error('Payment processing failed:', transactionResult.error);
      return new Response(JSON.stringify({
        success: false,
        error: transactionResult.error || 'Payment processing failed',
        detail: transactionResult.detail || 'Unknown database error'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Payment processed successfully:', transactionResult);

    return new Response(JSON.stringify(transactionResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      detail: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});