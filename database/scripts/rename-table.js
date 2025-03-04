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

async function renameCatsToAnimals() {
  try {
    console.log('Checking tables and columns...');
    
    // Check if cats table exists
    const { data: catsData, error: catsError } = await supabase
      .from('cats')
      .select('count(*)')
      .limit(1);
    
    if (!catsError) {
      console.log('The cats table exists. You need to run the SQL script manually in the Supabase SQL Editor.');
    } else {
      console.log('The cats table does not exist or cannot be accessed.');
    }
    
    // Check if animals table exists
    const { data: animalsData, error: animalsError } = await supabase
      .from('animals')
      .select('count(*)')
      .limit(1);
    
    if (!animalsError) {
      console.log('The animals table already exists!');
      
      // Check if animal_type column exists by trying to filter by it
      const { data: typeData, error: typeError } = await supabase
        .from('animals')
        .select('*')
        .eq('animal_type', 'cat')
        .limit(1);
      
      if (!typeError) {
        console.log('The animal_type column exists in the animals table.');
      } else {
        console.log('The animal_type column does not exist or cannot be accessed.');
        console.log('You need to run the SQL script manually to add the animal_type column.');
      }
    } else {
      console.log('The animals table does not exist yet. You need to run the SQL script manually.');
    }
    
    // Read the SQL file to display it
    const sqlFilePath = path.join(__dirname, '..', 'migrations', 'rename-cats-to-animals.sql');
    const sqlQuery = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('\nPlease run the following SQL in the Supabase SQL Editor:');
    console.log(sqlQuery);
  } catch (error) {
    console.error('Error:', error);
    console.log('Please run the SQL script manually in the Supabase SQL Editor.');
  }
}

renameCatsToAnimals()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  }); 