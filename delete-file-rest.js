// Script to delete a file using the Supabase REST API directly
const fetch = require('node-fetch');
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
  console.error('Usage: node delete-file-rest.js <filename>');
  console.error('Example: node delete-file-rest.js test-delete-1234567890.bin');
  process.exit(1);
}

async function listFiles() {
  console.log('Listing files in bucket...');
  
  try {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/list/cat-images`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error listing files: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing files:', error);
    return { error };
  }
}

async function deleteFile(fileName) {
  console.log(`Deleting file: ${fileName}`);
  
  try {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/cat-images/${fileName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error deleting file: ${response.status} ${response.statusText}`);
    }
    
    return { success: true };
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
      console.log(`- ${file.name} (${file.id})`);
    });
    
    // Check if the file exists
    const fileExists = filesBefore.some(file => file.name === fileName);
    
    if (!fileExists) {
      console.log(`File "${fileName}" not found in the bucket.`);
      return;
    }
    
    console.log(`File "${fileName}" found in bucket.`);
    
    // Delete the file
    const deleteResult = await deleteFile(fileName);
    
    if (deleteResult.error) {
      console.error('Failed to delete file');
      return;
    }
    
    console.log(`File "${fileName}" deleted successfully.`);
    
    // List files after deletion to verify
    const filesAfter = await listFiles();
    
    if (filesAfter.error) {
      console.error('Failed to list files after deletion');
      return;
    }
    
    console.log('Files in bucket after deletion:');
    filesAfter.forEach(file => {
      console.log(`- ${file.name} (${file.id})`);
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