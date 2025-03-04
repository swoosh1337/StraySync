require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addAnimalTypeColumn() {
  try {
    console.log('Adding animal_type column to cats table if it doesn\'t exist...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '..', 'migrations', 'add-animal-type-column.sql');
    const sqlQuery = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL query
    const { error } = await supabase.rpc('pgclient', { query: sqlQuery });
    
    if (error) {
      // If direct RPC fails, try a different approach
      console.log('Direct RPC failed, trying alternative approach...');
      
      // Check if the column exists
      const { data, error: checkError } = await supabase
        .from('cats')
        .select('animal_type')
        .limit(1);
      
      if (checkError) {
        if (checkError.message.includes('column "animal_type" does not exist')) {
          console.log('animal_type column does not exist, adding it...');
          
          // We can't directly alter the table, so we'll need to use a workaround
          // Create a temporary function to add the column
          const { error: funcError } = await supabase.rpc('add_animal_type_column');
          
          if (funcError) {
            console.error('Error adding animal_type column:', funcError);
            console.log('Please run the following SQL in the Supabase SQL Editor:');
            console.log('ALTER TABLE public.cats ADD COLUMN IF NOT EXISTS animal_type TEXT DEFAULT \'cat\';');
          } else {
            console.log('Successfully added animal_type column');
          }
        } else {
          console.error('Error checking for animal_type column:', checkError);
        }
      } else {
        console.log('animal_type column already exists');
      }
    } else {
      console.log('Successfully executed SQL query');
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('Please run the following SQL in the Supabase SQL Editor:');
    console.log('ALTER TABLE public.cats ADD COLUMN IF NOT EXISTS animal_type TEXT DEFAULT \'cat\';');
  }
}

addAnimalTypeColumn()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  }); 