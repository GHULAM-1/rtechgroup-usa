import { supabase } from "@/integrations/supabase/client";

export async function executeDataCleanup() {
  try {
    console.log('Starting data cleanup for client handover...');
    
    const { data, error } = await supabase.functions.invoke('cleanup-test-data', {
      body: {
        confirmationToken: 'CLEANUP_TEST_DATA_CONFIRMED',
        preserveUsers: true
      }
    });

    if (error) {
      console.error('Cleanup failed:', error);
      return { success: false, error: error.message };
    }

    console.log('Data cleanup completed successfully:', data);
    return data;
  } catch (error) {
    console.error('Cleanup error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

// Execute cleanup immediately
executeDataCleanup().then(result => {
  if (result.success) {
    console.log(`✅ Data cleanup completed successfully!`);
    console.log(`📊 Tables cleared: ${result.tablesCleared?.join(', ')}`);
    console.log(`📈 Total rows deleted: ${Object.values(result.rowsDeleted || {}).reduce((sum: number, count: number) => sum + count, 0)}`);
  } else {
    console.error('❌ Data cleanup failed:', result.error);
  }
});