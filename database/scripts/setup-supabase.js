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

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'supabase-schema.sql');
const sqlCommands = fs.readFileSync(sqlFilePath, 'utf8');

// Split the SQL commands by semicolon
const commands = sqlCommands
  .split(';')
  .map(cmd => cmd.trim())
  .filter(cmd => cmd.length > 0);

async function setupDatabase() {
  console.log('Setting up Supabase database...');
  
  try {
    // Execute each SQL command directly using the REST API
    for (const command of commands) {
      if (command.length > 0) {
        console.log(`Executing SQL command: ${command.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('pgrest_exec', { query: command });
        
        if (error) {
          console.log(`Warning: Command may not have executed through RPC: ${error.message}`);
          console.log('This is expected if you don\'t have the pgrest_exec function. Continuing...');
        }
      }
    }
    
    console.log('Database setup commands sent. Verifying setup...');
    
    // Verify the cats table exists by trying to select from it
    const { data: catsData, error: catsError } = await supabase
      .from('cats')
      .select('id')
      .limit(1);
    
    if (catsError) {
      console.error('Error verifying cats table:', catsError.message);
    } else {
      console.log('Cats table exists and is accessible.');
    }
    
    // Verify the storage bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error verifying storage buckets:', bucketsError.message);
    } else {
      const catImagesBucket = buckets.find(bucket => bucket.name === 'cat-images');
      if (catImagesBucket) {
        console.log('cat-images storage bucket exists.');
      } else {
        console.log('cat-images storage bucket not found. Creating it...');
        
        // Create the bucket if it doesn't exist
        const { error: createBucketError } = await supabase.storage.createBucket('cat-images', {
          public: true
        });
        
        if (createBucketError) {
          console.error('Error creating cat-images bucket:', createBucketError.message);
        } else {
          console.log('cat-images storage bucket created successfully.');
        }
      }
    }
    
    console.log('Database setup process completed!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

setupDatabase(); 