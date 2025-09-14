import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrgSettings {
  id?: string;
  org_id: string;
  company_name: string;
  timezone: string;
  currency_code: string;
  date_format: string;
  logo_url?: string;
  reminder_due_today: boolean;
  reminder_overdue_1d: boolean;
  reminder_overdue_multi: boolean;
  reminder_due_soon_2d: boolean;
}

// In-memory cache for settings (60 seconds)
let settingsCache: { data: OrgSettings | null; timestamp: number } = {
  data: null,
  timestamp: 0
};

const CACHE_DURATION = 60 * 1000; // 60 seconds

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const currentTime = Date.now();

    if (req.method === 'GET') {
      // Check cache first
      if (settingsCache.data && (currentTime - settingsCache.timestamp) < CACHE_DURATION) {
        console.log('Returning cached settings');
        return new Response(JSON.stringify(settingsCache.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch from database
      const { data: settings, error } = await supabaseClient
        .from('org_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error);
        throw error;
      }

      // Auto-seed if no settings exist
      if (!settings) {
        console.log('No settings found, seeding default settings');
        const defaultSettings: Partial<OrgSettings> = {
          company_name: 'Fleet Management System',
          timezone: 'Europe/London',
          currency_code: 'GBP',
          date_format: 'DD/MM/YYYY',
          reminder_due_today: true,
          reminder_overdue_1d: true,
          reminder_overdue_multi: true,
          reminder_due_soon_2d: false,
        };

        const { data: newSettings, error: insertError } = await supabaseClient
          .from('org_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating default settings:', insertError);
          throw insertError;
        }

        // Update cache
        settingsCache = { data: newSettings, timestamp: currentTime };
        
        return new Response(JSON.stringify(newSettings), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update cache
      settingsCache = { data: settings, timestamp: currentTime };

      return new Response(JSON.stringify(settings), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      
      // Validate required fields
      const validFields = [
        'company_name', 'timezone', 'currency_code', 'date_format', 
        'logo_url', 'reminder_due_today', 'reminder_overdue_1d', 
        'reminder_overdue_multi', 'reminder_due_soon_2d'
      ];

      // Filter out invalid fields
      const filteredUpdate: Partial<OrgSettings> = {};
      for (const [key, value] of Object.entries(body)) {
        if (validFields.includes(key)) {
          filteredUpdate[key as keyof OrgSettings] = value;
        }
      }

      // Validation
      if (filteredUpdate.timezone && !['Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles'].includes(filteredUpdate.timezone)) {
        return new Response(JSON.stringify({ error: 'Invalid timezone' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (filteredUpdate.currency_code && !['GBP', 'EUR', 'USD'].includes(filteredUpdate.currency_code)) {
        return new Response(JSON.stringify({ error: 'Invalid currency code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (filteredUpdate.date_format && !['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(filteredUpdate.date_format)) {
        return new Response(JSON.stringify({ error: 'Invalid date format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if settings exist
      const { data: existingSettings } = await supabaseClient
        .from('org_settings')
        .select('id')
        .limit(1)
        .single();

      let updatedSettings;
      if (existingSettings) {
        // Update existing settings
        const { data, error } = await supabaseClient
          .from('org_settings')
          .update(filteredUpdate)
          .eq('id', existingSettings.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating settings:', error);
          throw error;
        }
        updatedSettings = data;
      } else {
        // Insert new settings if none exist
        const { data, error } = await supabaseClient
          .from('org_settings')
          .insert(filteredUpdate)
          .select()
          .single();

        if (error) {
          console.error('Error creating settings:', error);
          throw error;
        }
        updatedSettings = data;
      }

      // Bust cache
      settingsCache = { data: null, timestamp: 0 };

      console.log('Settings updated successfully');
      return new Response(JSON.stringify(updatedSettings), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Settings API error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});