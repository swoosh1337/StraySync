// Script to delete a specific test file from storage
const { createClient } = require('@supabase/supabase-js');
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

async function deleteTestFile() {
  console.log('Attempting to delete test file from storage...');

  try {
    // First, list all files in the bucket to see what's there
    const { data: files, error: listError } = await supabase.storage
      .from('cat-images')
      .list('', { limit: 100 });
      
    if (listError) {
      console.error('Error listing files in bucket:', listError);
      return;
    }
    
    console.log('Files in bucket:');
    files.forEach(file => {
      console.log(`- ${file.name} (${file.id})`);
    });
    
    // Find the test file
    const testFile = files.find(file => file.name.includes('test-delete'));
    
    if (!testFile) {
      console.log('No test file found in the bucket.');
      return;
    }
    
    console.log(`Found test file: ${testFile.name}`);
    
    // Try to delete the file
    console.log(`Attempting to delete file: ${testFile.name}`);
    const { error: deleteError } = await supabase.storage
      .from('cat-images')
      .remove([testFile.name]);
      
    if (deleteError) {
      console.error('Error deleting file:', deleteError);
      
      // Try with admin key if available
      if (process.env.SUPABASE_SERVICE_KEY) {
        console.log('Trying with service key...');
        const adminSupabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY);
        
        const { error: adminDeleteError } = await adminSupabase.storage
          .from('cat-images')
          .remove([testFile.name]);
          
        if (adminDeleteError) {
          console.error('Error deleting file with service key:', adminDeleteError);
        } else {
          console.log(`Successfully deleted file ${testFile.name} with service key`);
        }
      }
    } else {
      console.log(`Successfully deleted file ${testFile.name}`);
    }
    
    // Verify deletion
    const { data: filesAfter, error: listAfterError } = await supabase.storage
      .from('cat-images')
      .list('', { limit: 100 });
      
    if (listAfterError) {
      console.error('Error listing files after deletion:', listAfterError);
      return;
    }
    
    const fileStillExists = filesAfter.some(file => file.name === testFile.name);
    console.log(`File ${testFile.name} still exists: ${fileStillExists}`);
    
    console.log('Files in bucket after deletion:');
    filesAfter.forEach(file => {
      console.log(`- ${file.name} (${file.id})`);
    });
    
  } catch (error) {
    console.error('Error in deleteTestFile:', error);
  }
}

// Run the function
deleteTestFile().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 