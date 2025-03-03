// Script to fix storage bucket permissions
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

async function fixStorage() {
  console.log('Starting storage bucket fix...');
  
  try {
    // 1. Create the bucket if it doesn't exist
    console.log('Ensuring cat-images bucket exists...');
    const { error: createError } = await supabase.storage.createBucket('cat-images', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
    });
    
    if (createError) {
      if (createError.message.includes('already exists')) {
        console.log('Bucket already exists, updating to be public...');
        
        // Try to update the bucket to be public using direct API
        try {
          // We can't directly update the bucket's public status via the JS client
          // But we can test if we can access it publicly
          console.log('Testing if bucket is publicly accessible...');
          
          // Create a test file to check public access
          const testFilePath = path.join(__dirname, 'test-public.txt');
          fs.writeFileSync(testFilePath, 'Testing public access');
          
          const testFileName = `public-test-${Date.now()}.txt`;
          const fileBuffer = fs.readFileSync(testFilePath);
          
          // Upload the test file
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('cat-images')
            .upload(testFileName, fileBuffer, {
              contentType: 'text/plain',
              upsert: true
            });
          
          fs.unlinkSync(testFilePath);
          
          if (uploadError) {
            console.log('Upload test failed:', uploadError.message);
          } else {
            console.log('Test file uploaded successfully');
            
            // Try to get a public URL
            const { data: urlData } = supabase.storage
              .from('cat-images')
              .getPublicUrl(uploadData.path);
            
            console.log('Public URL:', urlData.publicUrl);
            
            // Try to access the file publicly
            try {
              const response = await fetch(urlData.publicUrl);
              if (response.ok) {
                console.log('Bucket is publicly accessible!');
              } else {
                console.log('Bucket is not publicly accessible:', response.status);
              }
            } catch (fetchError) {
              console.log('Error testing public access:', fetchError.message);
            }
          }
        } catch (updateError) {
          console.log('Error testing bucket public access:', updateError.message);
        }
      } else {
        console.error('Error creating bucket:', createError.message);
      }
    } else {
      console.log('Bucket created successfully');
    }
    
    // 3. Test the bucket by uploading a test file
    console.log('Testing bucket with a test upload...');
    
    // Create a temporary test file
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for Supabase storage');
    
    const testFileName = `test-${Date.now()}.txt`;
    const fileBuffer = fs.readFileSync(testFilePath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cat-images')
      .upload(testFileName, fileBuffer, {
        contentType: 'text/plain',
        upsert: true
      });
    
    // Clean up the temporary file
    fs.unlinkSync(testFilePath);
    
    if (uploadError) {
      console.error('Test upload failed:', uploadError.message);
    } else {
      console.log('Test upload successful!');
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('cat-images')
        .getPublicUrl(uploadData.path);
      
      console.log('Public URL:', urlData.publicUrl);
      
      // Test uploading an image file
      console.log('Testing image upload...');
      
      // Create a simple 1x1 pixel PNG
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const imageBuffer = Buffer.from(base64Image, 'base64');
      
      const imageName = `test-image-${Date.now()}.png`;
      
      const { data: imageData, error: imageError } = await supabase.storage
        .from('cat-images')
        .upload(imageName, imageBuffer, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (imageError) {
        console.error('Image upload test failed:', imageError.message);
      } else {
        console.log('Image upload test successful!');
        
        // Get the public URL
        const { data: imageUrlData } = supabase.storage
          .from('cat-images')
          .getPublicUrl(imageData.path);
        
        console.log('Image Public URL:', imageUrlData.publicUrl);
      }
    }
    
    console.log('Storage bucket fix completed!');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixStorage(); 