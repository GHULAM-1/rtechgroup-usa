import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      reminder_events: {
        Row: {
          id: string;
          charge_id: string;
          customer_id: string;
          rental_id: string | null;
          vehicle_id: string;
          reminder_type: string;
          status: string;
          message_preview: string;
          created_at: string;
          delivered_at: string | null;
          snoozed_until: string | null;
        };
      };
    };
    Functions: {
      generate_daily_reminders: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting daily reminder generation at:', new Date().toISOString());

    // Call the database function to generate reminders
    const { error: functionError } = await supabaseClient.rpc('generate_daily_reminders');

    if (functionError) {
      console.error('Error calling generate_daily_reminders:', functionError);
      throw functionError;
    }

    // Get count of reminders generated today
    const today = new Date().toISOString().split('T')[0];
    const { data: remindersCount, error: countError } = await supabaseClient
      .from('reminder_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`);

    if (countError) {
      console.error('Error counting reminders:', countError);
    }

    const count = remindersCount || 0;
    console.log(`Daily reminder generation completed. Generated ${count} reminders for ${today}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${count} reminders for ${today}`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in daily reminders function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});