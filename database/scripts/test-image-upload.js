// Script to test image upload functionality
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

// Create a simple 1x1 pixel PNG
const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function testImageUpload() {
  console.log('Testing image upload functionality...');
  
  try {
    // 1. Test uploading a PNG image
    console.log('Testing PNG upload...');
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const imageName = `test-image-${Date.now()}.png`;
    
    const { data: imageData, error: imageError } = await supabase.storage
      .from('cat-images')
      .upload(imageName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (imageError) {
      console.error('PNG upload failed:', imageError.message);
    } else {
      console.log('PNG upload successful!');
      
      // Get the public URL
      const { data: imageUrlData } = supabase.storage
        .from('cat-images')
        .getPublicUrl(imageData.path);
      
      console.log('PNG Public URL:', imageUrlData.publicUrl);
      
      // Test accessing the image
      try {
        const response = await fetch(imageUrlData.publicUrl);
        if (response.ok) {
          console.log('PNG is publicly accessible!');
        } else {
          console.log('PNG is not publicly accessible:', response.status);
        }
      } catch (fetchError) {
        console.log('Error testing PNG access:', fetchError.message);
      }
    }
    
    // 2. Test uploading a JPEG image
    console.log('\nTesting JPEG upload...');
    const jpegName = `test-image-${Date.now()}.jpg`;
    
    const { data: jpegData, error: jpegError } = await supabase.storage
      .from('cat-images')
      .upload(jpegName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (jpegError) {
      console.error('JPEG upload failed:', jpegError.message);
    } else {
      console.log('JPEG upload successful!');
      
      // Get the public URL
      const { data: jpegUrlData } = supabase.storage
        .from('cat-images')
        .getPublicUrl(jpegData.path);
      
      console.log('JPEG Public URL:', jpegUrlData.publicUrl);
    }
    
    // 3. Test uploading with a user ID in the filename
    console.log('\nTesting upload with user ID in filename...');
    const userId = 'test-user-' + Date.now();
    const userFileName = `${userId}-${Date.now()}.png`;
    
    const { data: userData, error: userError } = await supabase.storage
      .from('cat-images')
      .upload(userFileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (userError) {
      console.error('User ID filename upload failed:', userError.message);
    } else {
      console.log('User ID filename upload successful!');
      
      // Get the public URL
      const { data: userUrlData } = supabase.storage
        .from('cat-images')
        .getPublicUrl(userData.path);
      
      console.log('User ID filename Public URL:', userUrlData.publicUrl);
    }
    
    // 4. Test listing files in the bucket
    console.log('\nListing files in bucket...');
    const { data: files, error: listError } = await supabase.storage
      .from('cat-images')
      .list();
    
    if (listError) {
      console.error('Error listing files:', listError.message);
    } else {
      console.log(`Found ${files.length} files in bucket:`);
      files.slice(0, 5).forEach(file => {
        console.log(`- ${file.name} (${file.metadata.size} bytes)`);
      });
      if (files.length > 5) {
        console.log(`... and ${files.length - 5} more files`);
      }
    }
    
    console.log('\nImage upload tests completed!');
  } catch (error) {
    console.error('Unexpected error during tests:', error);
  }
}

testImageUpload(); 