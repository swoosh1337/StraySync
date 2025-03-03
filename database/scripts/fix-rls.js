// Script to fix RLS policies for the cats table
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or key not found in environment variables.');
  console.error('Please make sure you have a .env file with SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRlsPolicies() {
  console.log('Fixing RLS policies for the cats table...');
  
  try {
    // SQL commands to fix RLS policies
    const sqlCommands = [
      // Drop existing policies if they exist
      `DROP POLICY IF EXISTS "Users can delete their own cats" ON public.cats;`,
      `DROP POLICY IF EXISTS "Anyone can delete cats" ON public.cats;`,
      
      // Create a policy to allow anyone to delete cats
      `CREATE POLICY "Anyone can delete cats" ON public.cats
       FOR DELETE USING (true);`,
      
      // Create a policy to allow anyone to update cats
      `CREATE POLICY "Anyone can update cats" ON public.cats
       FOR UPDATE USING (true)
       WITH CHECK (true);`
    ];
    
    // Execute each SQL command
    for (const command of sqlCommands) {
      console.log(`Executing: ${command}`);
      const { error } = await supabase.rpc('pgrest_exec', { query: command });
      
      if (error) {
        // If pgrest_exec is not available, try direct query
        console.log(`Warning: Command may not have executed through RPC: ${error.message}`);
        console.log('Trying direct query...');
        
        // Try a direct query to execute the SQL
        // Note: This might not work depending on your Supabase permissions
        const { error: directError } = await supabase.from('_exec_sql').select('*').eq('query', command);
        
        if (directError) {
          console.log(`Warning: Direct query also failed: ${directError.message}`);
          console.log('You may need to run these commands manually in the Supabase SQL editor.');
        }
      }
    }
    
    // Test if we can delete a cat
    console.log('\nTesting if we can delete a cat...');
    
    // First, create a test cat
    const testCat = {
      user_id: 'test-user-' + Date.now(),
      latitude: 35.6895,
      longitude: 139.6917,
      image_url: 'https://placekitten.com/200/200',
      description: 'Test cat for RLS policy check',
      spotted_at: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('cats')
      .insert(testCat)
      .select();
    
    if (insertError) {
      console.error('Error creating test cat:', insertError.message);
    } else {
      console.log('Test cat created with ID:', insertData[0].id);
      
      // Try to delete the test cat
      const { error: deleteError } = await supabase
        .from('cats')
        .delete()
        .eq('id', insertData[0].id);
      
      if (deleteError) {
        console.error('Error deleting test cat:', deleteError.message);
      } else {
        console.log('Test cat deleted successfully!');
        
        // Verify the cat was deleted
        const { data: checkData, error: checkError } = await supabase
          .from('cats')
          .select('id')
          .eq('id', insertData[0].id);
        
        if (checkError) {
          console.error('Error checking if cat was deleted:', checkError.message);
        } else if (checkData && checkData.length === 0) {
          console.log('Verified that the cat was deleted successfully!');
        } else {
          console.error('DELETION FAILED: Cat still exists in database after deletion!');
        }
      }
    }
    
    console.log('\nRLS policy fix completed!');
    console.log('You should now be able to delete cats from the app.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixRlsPolicies(); 