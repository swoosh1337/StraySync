// Script to fix storage bucket policies for deletion
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

async function fixStoragePolicies() {
  console.log('Fixing storage bucket policies for deletion...');

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'fix-storage-policies.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Split the SQL into individual commands
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    console.log(`Found ${commands.length} SQL commands to execute`);

    // Execute each command
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`Executing command ${i + 1}/${commands.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('pgrest_exec', { query: command });
        
        if (error) {
          console.error(`Error executing command ${i + 1}:`, error);
        } else {
          console.log(`Command ${i + 1} executed successfully`);
        }
      } catch (cmdError) {
        console.error(`Exception executing command ${i + 1}:`, cmdError);
      }
    }

    // Test if we can delete a file
    console.log('\nTesting file deletion...');
    
    // First, upload a test file
    const testData = new Uint8Array([0, 1, 2, 3, 4]);
    const testFileName = `test-delete-${Date.now()}.bin`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cat-images')
      .upload(testFileName, testData);
      
    if (uploadError) {
      console.error('Error uploading test file:', uploadError);
    } else {
      console.log(`Test file ${testFileName} uploaded successfully`);
      
      // Try to delete the test file
      const { error: deleteError } = await supabase.storage
        .from('cat-images')
        .remove([testFileName]);
        
      if (deleteError) {
        console.error('Error deleting test file:', deleteError);
      } else {
        console.log(`Test file ${testFileName} deleted successfully`);
      }
    }

    console.log('\nStorage bucket policies update completed.');
    console.log('You should now be able to delete files from the cat-images bucket.');
    
  } catch (error) {
    console.error('Error fixing storage policies:', error);
  }
}

// Run the function
fixStoragePolicies().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 