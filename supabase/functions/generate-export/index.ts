import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  reportType: string;
  exportType: 'csv' | 'xlsx' | 'pdf';
  filters: {
    fromDate: string;
    toDate: string;
    customers: string[];
    vehicles: string[];
    rentals: string[];
    paymentTypes: string[];
    statuses: string[];
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { reportType, exportType, filters }: ExportRequest = await req.json();
    
    console.log(`Generating ${reportType} export as ${exportType}`, { filters });

    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 13);
    let filename = `${reportType}_export_${timestamp}`;
    
    let data: any[] = [];
    let headers: string[] = [];

    // Fetch data based on report type
    switch (reportType) {
      case 'payments': {
        let query = supabaseClient
          .from('view_payments_export')
          .select('*')
          .gte('payment_date', filters.fromDate)
          .lte('payment_date', filters.toDate);

        if (filters.customers.length > 0) {
          query = query.in('customer_id', filters.customers);
        }
        if (filters.vehicles.length > 0) {
          query = query.in('vehicle_id', filters.vehicles);
        }
        if (filters.paymentTypes.length > 0) {
          query = query.in('payment_type', filters.paymentTypes);
        }

        const { data: paymentsData, error } = await query;
        if (error) throw error;

        data = paymentsData || [];
        headers = [
          'Payment Date', 'Customer', 'Vehicle Reg', 'Payment Type', 'Method',
          'Amount (£)', 'Applied (£)', 'Unapplied (£)', 'Customer Email', 'Vehicle Make', 'Vehicle Model'
        ];
        break;
      }

      case 'pl-report': {
        const { data: plData, error } = await supabaseClient
          .from('view_pl_by_vehicle')
          .select('*');
        if (error) throw error;

        data = plData || [];
        headers = [
          'Vehicle Reg', 'Make/Model', 'Rental Revenue (£)', 'Fee Revenue (£)', 'Other Revenue (£)',
          'Acquisition Cost (£)', 'Finance Cost (£)', 'Service Cost (£)', 'Other Costs (£)',
          'Total Revenue (£)', 'Total Costs (£)', 'Net Profit (£)'
        ];
        break;
      }

      case 'rentals': {
        let query = supabaseClient
          .from('view_rentals_export')
          .select('*')
          .gte('start_date', filters.fromDate)
          .lte('start_date', filters.toDate);

        const { data: rentalsData, error } = await query;
        if (error) throw error;

        data = rentalsData || [];
        headers = [
          'Customer', 'Vehicle Reg', 'Start Date', 'End Date', 'Schedule',
          'Monthly Amount (£)', 'Status', 'Initial Fee (£)', 'Balance (£)'
        ];
        break;
      }

      case 'customer-statements': {
        let query = supabaseClient
          .from('view_customer_statements')
          .select('*')
          .gte('entry_date', filters.fromDate)
          .lte('entry_date', filters.toDate);

        if (filters.customers.length > 0) {
          query = query.in('customer_id', filters.customers);
        }

        const { data: statementsData, error } = await query.order('customer_id, entry_date');
        if (error) throw error;

        data = statementsData || [];
        headers = [
          'Customer', 'Entry Date', 'Type', 'Category', 'Vehicle Reg', 
          'Transaction Amount (£)', 'Running Balance (£)', 'Customer Email', 'Customer Phone'
        ];
        break;
      }

      case 'fines': {
        let query = supabaseClient
          .from('view_fines_export')
          .select('*')
          .gte('issue_date', filters.fromDate)
          .lte('issue_date', filters.toDate);

        const { data: finesData, error } = await query;
        if (error) throw error;

        data = finesData || [];
        headers = [
          'Reference No', 'Type', 'Customer', 'Vehicle Reg', 'Issue Date', 'Due Date',
          'Amount (£)', 'Remaining (£)', 'Liability', 'Status', 'Appeal Status', 'Notes'
        ];
        break;
      }

      case 'aging': {
        const { data: agingData, error } = await supabaseClient
          .from('view_aging_receivables')
          .select('*');
        if (error) throw error;

        data = agingData || [];
        headers = [
          'Customer', '0-30 Days (£)', '31-60 Days (£)', '61-90 Days (£)', '90+ Days (£)', 'Total Due (£)'
        ];
        break;
      }

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    // Generate CSV content
    if (exportType === 'csv') {
      filename += '.csv';
      
      const formatCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const formatCurrency = (value: any): string => {
        if (value === null || value === undefined) return '0.00';
        return Number(value).toFixed(2);
      };

      const formatDate = (value: any): string => {
        if (!value) return '';
        try {
          const date = new Date(value);
          return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
        } catch {
          return String(value);
        }
      };

      // Create CSV rows
      const csvRows = [headers.join(',')];
      
      data.forEach(row => {
        const csvRow: string[] = [];
        
        switch (reportType) {
          case 'payments':
            csvRow.push(
              formatCsvValue(formatDate(row.payment_date)),
              formatCsvValue(row.customer_name),
              formatCsvValue(row.vehicle_reg),
              formatCsvValue(row.payment_type),
              formatCsvValue(row.method),
              formatCurrency(row.amount),
              formatCurrency(row.applied_amount),
              formatCurrency(row.unapplied_amount),
              formatCsvValue(row.customer_email),
              formatCsvValue(row.vehicle_make),
              formatCsvValue(row.vehicle_model)
            );
            break;
          case 'pl-report':
            csvRow.push(
              formatCsvValue(row.vehicle_reg),
              formatCsvValue(row.make_model),
              formatCurrency(row.revenue_rental),
              formatCurrency(row.revenue_fees),
              formatCurrency(row.revenue_other),
              formatCurrency(row.cost_acquisition),
              formatCurrency(row.cost_finance),
              formatCurrency(row.cost_service),
              formatCurrency(row.cost_other),
              formatCurrency(row.total_revenue),
              formatCurrency(row.total_costs),
              formatCurrency(row.net_profit)
            );
            break;
          case 'rentals':
            csvRow.push(
              formatCsvValue(row.customer_name),
              formatCsvValue(row.vehicle_reg),
              formatCsvValue(formatDate(row.start_date)),
              formatCsvValue(formatDate(row.end_date)),
              formatCsvValue(row.schedule),
              formatCurrency(row.monthly_amount),
              formatCsvValue(row.status),
              formatCurrency(row.initial_fee_amount),
              formatCurrency(row.balance)
            );
            break;
          case 'customer-statements':
            csvRow.push(
              formatCsvValue(row.customer_name),
              formatCsvValue(formatDate(row.entry_date)),
              formatCsvValue(row.type),
              formatCsvValue(row.category),
              formatCsvValue(row.vehicle_reg),
              formatCurrency(row.transaction_amount),
              formatCurrency(row.running_balance),
              formatCsvValue(row.customer_email),
              formatCsvValue(row.customer_phone)
            );
            break;
          case 'fines':
            csvRow.push(
              formatCsvValue(row.reference_no),
              formatCsvValue(row.type),
              formatCsvValue(row.customer_name),
              formatCsvValue(row.vehicle_reg),
              formatCsvValue(formatDate(row.issue_date)),
              formatCsvValue(formatDate(row.due_date)),
              formatCurrency(row.amount),
              formatCurrency(row.remaining_amount),
              formatCsvValue(row.liability),
              formatCsvValue(row.status),
              formatCsvValue(row.appeal_status),
              formatCsvValue(row.notes)
            );
            break;
          case 'aging':
            csvRow.push(
              formatCsvValue(row.customer_name),
              formatCurrency(row.bucket_0_30),
              formatCurrency(row.bucket_31_60),
              formatCurrency(row.bucket_61_90),
              formatCurrency(row.bucket_90_plus),
              formatCurrency(row.total_due)
            );
            break;
        }
        
        csvRows.push(csvRow.join(','));
      });

      const csvContent = csvRows.join('\n');
      
      return new Response(
        JSON.stringify({
          content: csvContent,
          filename,
          mimeType: 'text/csv'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // For now, return CSV for XLSX/PDF requests (could be enhanced with proper Excel/PDF generation)
    filename += exportType === 'xlsx' ? '.xlsx' : '.pdf';
    
    return new Response(
      JSON.stringify({
        error: `${exportType.toUpperCase()} export not yet implemented. Please use CSV for now.`
      }),
      {
        status: 501,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Export generation error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate export'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});