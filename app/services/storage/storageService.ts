import { supabase } from '../api/supabaseClient';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export const storageService = {
  // Initialize storage bucket
  async initializeStorage(): Promise<void> {
    try {
      console.log('Initializing storage...');
      await this.createBucketIfNotExists();
    } catch (error: any) {
      console.error('Error initializing storage:', error.message || error);
    }
  },
  
  // Test storage permissions
  async testStoragePermissions(): Promise<boolean> {
    try {
      console.log('Testing storage permissions...');
      
      // Try to list files in the bucket
      const { data, error } = await supabase
        .storage
        .from('cat-images')
        .list();
      
      if (error) {
        if (error.message.includes('The resource was not found')) {
          console.log('Bucket not found, will attempt to create it');
          return await this.createBucketIfNotExists();
        }
        
        console.error('Storage permission test failed:', error.message);
        return false;
      }
      
      console.log(`Storage permission test successful, found ${data.length} files`);
      return true;
    } catch (error: any) {
      console.error('Error testing storage permissions:', error.message || error);
      return false;
    }
  },
  
  // Upload an image to storage
  async uploadImage(uri: string, userId: string): Promise<string> {
    try {
      console.log('Uploading image from URI:', uri.substring(0, 50) + '...');
      
      // Ensure the bucket exists
      await this.createBucketIfNotExists();
      
      // Generate a unique filename
      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}.jpg`;
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('File exists:', fileInfo.exists, 'size:', fileInfo.size, 'bytes');
      
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
      
      // Read the file as base64
      let base64Data: string;
      
      if (Platform.OS === 'web') {
        // For web, we need to handle this differently
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        base64Data = await new Promise((resolve) => {
          reader.onloadend = () => {
            const base64 = reader.result as string;
            resolve(base64.split(',')[1]); // Remove the data URL prefix
          };
          reader.readAsDataURL(blob);
        });
      } else {
        // For native platforms
        base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      
      // Upload the file
      const { data, error } = await supabase
        .storage
        .from('cat-images')
        .upload(fileName, this.decode(base64Data), {
          contentType: 'image/jpeg',
          upsert: true,
        });
      
      if (error) {
        console.error('Error uploading image:', error.message);
        
        // Try fallback method
        return this.getFallbackImageUrl();
      }
      
      // Get the public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('cat-images')
        .getPublicUrl(fileName);
      
      const publicUrl = publicUrlData.publicUrl;
      console.log('Image uploaded successfully, public URL:', publicUrl.substring(0, 50) + '...');
      
      return publicUrl;
    } catch (error: any) {
      console.error('Error in uploadImage:', error.message || error);
      return this.getFallbackImageUrl();
    }
  },
  
  // Create the storage bucket if it doesn't exist
  async createBucketIfNotExists(): Promise<void> {
    try {
      console.log('Checking if cat-images bucket exists...');
      
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabase
        .storage
        .listBuckets();
      
      if (listError) {
        console.error('Error listing buckets:', listError.message);
        return;
      }
      
      const bucketExists = buckets.some(bucket => bucket.name === 'cat-images');
      
      if (!bucketExists) {
        console.log('cat-images bucket not found, attempting to create it...');
        
        // Create the bucket
        const { error: createError } = await supabase
          .storage
          .createBucket('cat-images', {
            public: true,
          });
        
        if (createError) {
          console.error('Error creating cat-images bucket:', createError.message);
          return;
        }
        
        console.log('cat-images bucket created successfully');
      } else {
        console.log('cat-images bucket already exists');
      }
    } catch (error: any) {
      console.error('Error in createBucketIfNotExists:', error.message || error);
    }
  },
  
  // Get a fallback image URL if upload fails
  getFallbackImageUrl(): string {
    // Use a placeholder cat image
    return 'https://placekitten.com/400/300';
  },
  
  // Decode base64 string to Uint8Array
  decode(base64String: string): Uint8Array {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  },
  
  // Delete an image from storage
  async deleteImageFromStorage(imageUrl: string): Promise<boolean> {
    try {
      console.log('Attempting to delete image from URL:', imageUrl.substring(0, 50) + '...');
      
      // Skip deletion for placeholder images
      if (!imageUrl || imageUrl.includes('placekitten.com')) {
        console.log('Skipping deletion of placeholder or empty image URL');
        return true;
      }
      
      // Extract the filename from the URL
      let fileName = '';
      
      // Try to extract the filename from the URL
      const bucketIndex = imageUrl.indexOf('cat-images');
      if (bucketIndex !== -1) {
        // Extract everything after the bucket name
        const afterBucket = imageUrl.substring(bucketIndex + 'cat-images'.length);
        
        // Remove any query parameters
        let extractedName = afterBucket.split('?')[0];
        
        // Remove leading slash if present
        if (extractedName.startsWith('/')) {
          extractedName = extractedName.substring(1);
        }
        
        fileName = extractedName;
      }
      
      if (!fileName) {
        console.error('Could not extract filename from URL:', imageUrl);
        return false;
      }
      
      console.log('Extracted filename:', fileName);
      
      // Delete the file
      const { error } = await supabase
        .storage
        .from('cat-images')
        .remove([fileName]);
      
      if (error) {
        console.error('Error deleting image:', error.message);
        return false;
      }
      
      console.log('Image deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error in deleteImageFromStorage:', error.message || error);
      return false;
    }
  }
}; 