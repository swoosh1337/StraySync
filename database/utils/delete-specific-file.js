// Script to delete a specific file from storage
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

// Get the filename from command line arguments
const fileName = process.argv[2];

if (!fileName) {
  console.error('Error: No filename provided.');
  console.error('Usage: node delete-specific-file.js <filename>');
  console.error('Example: node delete-specific-file.js test-delete-1234567890.bin');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteSpecificFile(fileName) {
  console.log(`Attempting to delete file "${fileName}" from storage...`);

  try {
    // First, list all files in the bucket to see if the file exists
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
    
    // Check if the file exists
    const fileExists = files.some(file => file.name === fileName);
    
    if (!fileExists) {
      console.log(`File "${fileName}" not found in the bucket.`);
      return;
    }
    
    console.log(`File "${fileName}" found in bucket.`);
    
    // Try to delete the file
    console.log(`Attempting to delete file: ${fileName}`);
    const { error: deleteError } = await supabase.storage
      .from('cat-images')
      .remove([fileName]);
      
    if (deleteError) {
      console.error('Error deleting file:', deleteError);
      
      // Try with a different path format
      console.log('Trying with a leading slash...');
      const { error: altDeleteError } = await supabase.storage
        .from('cat-images')
        .remove([`/${fileName}`]);
        
      if (altDeleteError) {
        console.error('Error deleting file with leading slash:', altDeleteError);
      } else {
        console.log(`Successfully deleted file ${fileName} with leading slash`);
      }
    } else {
      console.log(`Successfully deleted file ${fileName}`);
    }
    
    // Verify deletion
    const { data: filesAfter, error: listAfterError } = await supabase.storage
      .from('cat-images')
      .list('', { limit: 100 });
      
    if (listAfterError) {
      console.error('Error listing files after deletion:', listAfterError);
      return;
    }
    
    const fileStillExists = filesAfter.some(file => file.name === fileName);
    console.log(`File ${fileName} still exists: ${fileStillExists}`);
    
    if (fileStillExists) {
      console.log('WARNING: File still exists after deletion attempt.');
      console.log('This might be due to:');
      console.log('1. Insufficient permissions');
      console.log('2. Row Level Security (RLS) policies blocking deletion');
      console.log('3. Caching in the Supabase dashboard');
      
      console.log('\nPlease try running the SQL commands in fix-storage-delete-simple.sql directly in the Supabase SQL Editor.');
    } else {
      console.log('File successfully deleted!');
    }
    
  } catch (error) {
    console.error('Error in deleteSpecificFile:', error);
  }
}

// Run the function
deleteSpecificFile(fileName).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 