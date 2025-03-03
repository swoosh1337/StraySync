// Script to delete a file with a delay before checking if it's gone
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or key not found in environment variables.');
  console.error('Please make sure you have a .env file with SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}

// Get the filename from command line arguments
const fileName = process.argv[2];

if (!fileName) {
  console.error('Error: No filename provided.');
  console.error('Usage: node delete-with-delay.js <filename>');
  console.error('Example: node delete-with-delay.js test-delete-1234567890.bin');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Supabase client with service role key if available
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Helper function to wait for a specified time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function listFiles() {
  console.log('Listing files in bucket...');
  
  try {
    const { data, error } = await supabase
      .storage
      .from('cat-images')
      .list();
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error listing files:', error);
    return { error };
  }
}

async function deleteFile(fileName, client = supabase) {
  console.log(`Attempting to delete file: ${fileName} using ${client === supabaseAdmin ? 'admin' : 'anon'} key`);
  
  try {
    const { data, error } = await client
      .storage
      .from('cat-images')
      .remove([fileName]);
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { error };
  }
}

async function main() {
  try {
    // List files before deletion
    const filesBefore = await listFiles();
    
    if (filesBefore.error) {
      console.error('Failed to list files before deletion');
      return;
    }
    
    console.log('Files in bucket:');
    filesBefore.forEach(file => {
      console.log(`- ${file.name}`);
    });
    
    // Check if the file exists
    const fileExists = filesBefore.some(file => file.name === fileName);
    
    if (!fileExists) {
      console.log(`File "${fileName}" not found in the bucket.`);
      return;
    }
    
    console.log(`File "${fileName}" found in bucket.`);
    
    // Delete the file using anon key
    let deleteResult = await deleteFile(fileName);
    
    // If deletion with anon key fails and we have a service key, try with that
    if (deleteResult.error && supabaseAdmin) {
      console.log('Deletion with anon key failed. Trying with service role key...');
      deleteResult = await deleteFile(fileName, supabaseAdmin);
    }
    
    if (deleteResult.error) {
      console.error('Failed to delete file with both keys');
      return;
    }
    
    console.log(`File "${fileName}" deletion request successful.`);
    
    // Wait for 5 seconds to allow the deletion to propagate
    console.log('Waiting 5 seconds for deletion to propagate...');
    await wait(5000);
    
    // List files after deletion to verify
    const filesAfter = await listFiles();
    
    if (filesAfter.error) {
      console.error('Failed to list files after deletion');
      return;
    }
    
    console.log('Files in bucket after deletion:');
    filesAfter.forEach(file => {
      console.log(`- ${file.name}`);
    });
    
    const fileStillExists = filesAfter.some(file => file.name === fileName);
    console.log(`File ${fileName} still exists: ${fileStillExists}`);
    
    if (fileStillExists) {
      console.log('WARNING: File still exists after deletion attempt.');
      console.log('This might be due to:');
      console.log('1. Insufficient permissions');
      console.log('2. Row Level Security (RLS) policies blocking deletion');
      console.log('3. Caching in the Supabase dashboard');
      
      console.log('\nPlease try running the SQL commands in fix-storage-delete-simple.sql directly in the Supabase SQL Editor.');
      console.log('Also, try refreshing the Supabase dashboard to see if the file is actually gone.');
      
      // Try one more time with a different approach
      console.log('\nTrying alternative deletion method...');
      
      try {
        // Try with a different path format
        const { data, error } = await supabase
          .storage
          .from('cat-images')
          .remove([`/${fileName}`]);
        
        if (error) {
          console.error('Alternative deletion failed:', error);
        } else {
          console.log('Alternative deletion request successful.');
          
          // Wait another 5 seconds
          console.log('Waiting 5 more seconds...');
          await wait(5000);
          
          // Check one more time
          const filesAfterAlt = await listFiles();
          
          if (!filesAfterAlt.error) {
            const stillExistsAfterAlt = filesAfterAlt.some(file => file.name === fileName);
            console.log(`After alternative deletion, file still exists: ${stillExistsAfterAlt}`);
          }
        }
      } catch (altError) {
        console.error('Error in alternative deletion:', altError);
      }
    } else {
      console.log('File successfully deleted!');
    }
    
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 