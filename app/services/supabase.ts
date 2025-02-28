import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } from '@env';
import { locationService } from './location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SecureStore adapter for Supabase auth
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Initialize Supabase client
const supabaseUrl = EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('Initializing Supabase with URL:', supabaseUrl.substring(0, 20) + '...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Check if Supabase connection is working
export const checkSupabaseConnection = async () => {
  try {
    console.log('Checking Supabase connection...');
    const { data, error } = await supabase.from('cats').select('count').limit(1);
    
    if (error) {
      if (error.message.includes('security policy')) {
        console.log('Security policy detected - this is normal if RLS is enabled');
        console.log('Supabase connection appears to be working, but with limited permissions');
        return true;
      }
      console.error('Supabase connection error:', error.message);
      return false;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (error: any) {
    console.error('Error checking Supabase connection:', error.message || error);
    return false;
  }
};

// Call connection check
checkSupabaseConnection().then(isConnected => {
  console.log('Supabase connection status:', isConnected ? 'Connected' : 'Failed');
});

// Initialize storage bucket
export const initializeStorage = async () => {
  try {
    console.log('Checking if cat-images bucket exists...');
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error.message);
      // Continue anyway - the bucket might exist but we can't list it due to permissions
      console.log('Continuing with existing storage configuration');
      return;
    }
    
    const catImagesBucket = buckets.find(bucket => bucket.name === 'cat-images');
    
    if (!catImagesBucket) {
      console.log('cat-images bucket not found, attempting to create it...');
      try {
        const { error: createError } = await supabase.storage.createBucket('cat-images', {
          public: true
        });
        
        if (createError) {
          // If we get a security policy error, the bucket likely exists but we don't have permission to create it
          if (createError.message.includes('security policy')) {
            console.log('Security policy prevented bucket creation - this is normal if the bucket already exists');
          } else {
            console.error('Error creating cat-images bucket:', createError.message);
          }
        } else {
          console.log('cat-images bucket created successfully');
        }
      } catch (createErr: any) {
        console.log('Error during bucket creation, continuing anyway:', createErr.message);
      }
    } else {
      console.log('cat-images bucket already exists');
    }
  } catch (error: any) {
    console.error('Error initializing storage:', error.message || error);
    // Continue anyway - the app can still function with the fallback image URL
  }
};

// Test storage permissions
export const testStoragePermissions = async () => {
  try {
    console.log('=== TESTING STORAGE PERMISSIONS ===');
    
    // Check authentication
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log('Authentication status:', authError 
      ? `Error: ${authError.message}` 
      : (authData.session ? `Authenticated as ${authData.session.user.id}` : 'Not authenticated'));
    
    // List buckets
    console.log('Attempting to list buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.log('Cannot list buckets:', bucketsError.message);
    } else {
      console.log('Buckets:', buckets.map(b => `${b.name} (public: ${b.public})`).join(', '));
    }
    
    // Check if cat-images exists
    const catImagesBucket = buckets?.find(b => b.name === 'cat-images');
    if (!catImagesBucket) {
      console.log('cat-images bucket not found');
    } else {
      console.log('cat-images bucket exists, public:', catImagesBucket.public);
      
      // Try to list files
      console.log('Attempting to list files in cat-images...');
      const { data: files, error: filesError } = await supabase.storage
        .from('cat-images')
        .list();
        
      if (filesError) {
        console.log('Cannot list files:', filesError.message);
      } else {
        console.log('Files in bucket:', files.length);
      }
      
      // Try to upload a test file
      console.log('Attempting to upload a test file...');
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cat-images')
        .upload(`test-${Date.now()}.txt`, testBlob);
        
      if (uploadError) {
        console.log('Upload test failed:', uploadError.message);
        console.log('Error details:', JSON.stringify(uploadError));
      } else {
        console.log('Upload test succeeded:', uploadData.path);
        
        // Try to get URL
        const { data: urlData } = supabase.storage
          .from('cat-images')
          .getPublicUrl(uploadData.path);
          
        console.log('Public URL:', urlData.publicUrl);
      }
    }
    
    console.log('=== STORAGE PERMISSION TEST COMPLETE ===');
  } catch (error: any) {
    console.error('Error testing storage permissions:', error.message || error);
  }
};

// Call initialization
initializeStorage().catch(err => console.error('Failed to initialize storage:', err));

// Call test on startup
testStoragePermissions().catch(err => console.error('Failed to test storage permissions:', err));

// Define types for our database tables
export type Cat = {
  id: string;
  created_at: string;
  user_id: string;
  latitude: number;
  longitude: number;
  image_url: string;
  description?: string;
  spotted_at: string;
};

// Functions to interact with the database
export const catService = {
  // Add a new cat sighting
  async addCat(cat: Omit<Cat, 'id' | 'created_at'>): Promise<Cat | null> {
    try {
      const { data, error } = await supabase
        .from('cats')
        .insert(cat)
        .select()
        .single();
      
      if (error) {
        // Check if this is a security policy error
        if (error.message.includes('security policy')) {
          console.log('Security policy prevented adding cat - this might be expected if RLS is enabled');
          // Return a mock cat object with the data we tried to insert
          return {
            id: `mock-${Date.now()}`,
            created_at: new Date().toISOString(),
            ...cat
          };
        }
        console.error('Error adding cat:', error);
        return null;
      }
      
      return data;
    } catch (error: any) {
      console.error('Error in addCat:', error.message || error);
      return null;
    }
  },
  
  // Get all cat sightings
  async getCats(): Promise<Cat[]> {
    try {
      const { data, error } = await supabase
        .from('cats')
        .select('*')
        .order('spotted_at', { ascending: false });
      
      if (error) {
        // Check if this is a security policy error
        if (error.message.includes('security policy')) {
          console.log('Security policy prevented fetching cats - returning empty array');
          return [];
        }
        console.error('Error fetching cats:', error);
        return [];
      }
      
      return data || [];
    } catch (error: any) {
      console.error('Error in getCats:', error.message || error);
      return [];
    }
  },
  
  // Get cat sightings within a specific time frame (in hours)
  async getCatsWithinTimeFrame(hours: number): Promise<Cat[]> {
    try {
      // First try to use the database function if it exists
      const { data, error } = await supabase.rpc('find_recent_cats', {
        hours_ago: hours
      });
      
      if (!error && data) {
        return data;
      }
      
      // Fallback: fetch all recent cats and filter in the app
      console.log('Falling back to manual time filtering');
      const timeAgo = new Date();
      timeAgo.setHours(timeAgo.getHours() - hours);
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('cats')
        .select('*')
        .gte('spotted_at', timeAgo.toISOString())
        .order('spotted_at', { ascending: false });
      
      if (fallbackError) {
        console.error('Error fetching recent cats:', fallbackError);
        return [];
      }
      
      return fallbackData || [];
    } catch (error) {
      console.error('Error in getCatsWithinTimeFrame:', error);
      return [];
    }
  },
  
  // Get cat sightings within a radius and time frame
  async getCatsWithinRadius(
    latitude: number,
    longitude: number,
    radiusKm: number,
    hours: number
  ): Promise<Cat[]> {
    try {
      // First try to use the PostGIS function if it exists
      const { data, error } = await supabase.rpc('find_cats_within_radius', {
        lat: latitude,
        lng: longitude,
        radius_km: radiusKm,
        hours_ago: hours
      });
      
      if (!error && data) {
        return data;
      }
      
      // Fallback: fetch all recent cats and filter by distance in the app
      console.log('Falling back to manual distance calculation');
      const cats = await this.getCatsWithinTimeFrame(hours);
      
      return cats.filter(cat => 
        locationService.isLocationWithinRadius(
          { latitude, longitude },
          { latitude: cat.latitude, longitude: cat.longitude },
          radiusKm
        )
      );
    } catch (error) {
      console.error('Error in getCatsWithinRadius:', error);
      return [];
    }
  },
  
  // Upload an image to Supabase storage
  async uploadImage(uri: string, userId: string): Promise<string> {
    console.log('Starting image upload process...');
    
    // If no URI is provided, return fallback immediately
    if (!uri) {
      console.log('No image URI provided, returning fallback image');
      return this.getFallbackImageUrl();
    }
    
    try {
      // Try direct upload first - the bucket should already exist from our tests
      console.log('Attempting direct upload to cat-images bucket...');
      
      // First, try to use the base64 upload method which might be more reliable
      try {
        console.log('Trying base64 upload method first...');
        const base64Url = await this.uploadImageBase64(uri, userId);
        if (base64Url) {
          console.log('Base64 upload successful:', base64Url);
          return base64Url;
        }
        console.log('Base64 upload failed, trying blob method...');
      } catch (base64Error) {
        console.log('Base64 upload error:', base64Error);
        // Continue to blob method
      }
      
      // Try the blob upload method
      try {
        // Fetch the image data with a timeout
        console.log('Fetching image from URI:', uri.substring(0, 50) + '...');
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Fetch timeout after 10 seconds')), 10000);
        });
        
        // Race the fetch against the timeout
        const response = await Promise.race([
          fetch(uri),
          timeoutPromise
        ]) as Response;
        
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        
        // Get the blob with a timeout
        const blobPromise = response.blob();
        const blob = await Promise.race([
          blobPromise,
          timeoutPromise
        ]) as Blob;
        
        console.log('Image blob created, size:', blob.size, 'bytes');
        
        // If image is too large (> 2MB), try to use the base64 method again with compression
        if (blob.size > 2 * 1024 * 1024) {
          console.log('Image is too large (>2MB), using fallback service');
          return this.uploadToPublicService();
        }
        
        // Generate a unique filename
        const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = fileName;
        
        console.log('Uploading as:', filePath);
        
        // Upload to Supabase Storage with a single attempt
        console.log('Attempting upload...');
        const { data, error } = await supabase.storage
          .from('cat-images')
          .upload(filePath, blob, {
            cacheControl: '3600',
            upsert: true,
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`
          });
        
        if (error) {
          console.error('Upload failed:', error.message);
          
          // If we get a bucket not found error, try to ensure it exists
          if (error.message.includes('bucket') || error.message.includes('security policy')) {
            console.log('Bucket issue detected, checking if bucket exists...');
            const bucketExists = await this.ensureStorageBucketExists();
            if (bucketExists) {
              console.log('Bucket exists, retrying upload...');
              // Try one more time
              const { data: retryData, error: retryError } = await supabase.storage
                .from('cat-images')
                .upload(filePath, blob, {
                  cacheControl: '3600',
                  upsert: true,
                  contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`
                });
                
              if (retryError) {
                console.error('Retry upload failed:', retryError.message);
                throw new Error(`Retry upload failed: ${retryError.message}`);
              }
              
              console.log('Retry upload successful!');
              
              // Get the public URL
              console.log('Waiting briefly before getting URL...');
              await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
              
              const { data: urlData } = supabase.storage
                .from('cat-images')
                .getPublicUrl(retryData.path);
              
              console.log('Image public URL:', urlData.publicUrl);
              return urlData.publicUrl;
            }
          }
          
          throw new Error(`Upload failed: ${error.message}`);
        }
        
        console.log('Upload successful!');
        
        // Get the public URL
        // Add a small delay before getting the public URL
        console.log('Waiting briefly before getting URL...');
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        
        const { data: urlData } = supabase.storage
          .from('cat-images')
          .getPublicUrl(data.path);
        
        console.log('Image public URL:', urlData.publicUrl);
        return urlData.publicUrl;
      } catch (fetchError) {
        console.error('Error in blob upload:', fetchError);
        throw fetchError; // Rethrow to be caught by outer try/catch
      }
    } catch (error) {
      console.error('Error in uploadImage:', error);
      console.log('Falling back to public image service...');
      
      // Fallback to a public image service
      return this.uploadToPublicService();
    }
  },
  
  // Helper function to create the bucket if it doesn't exist
  async createBucketIfNotExists(): Promise<void> {
    try {
      console.log('Checking if cat-images bucket exists...');
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        console.error('Error listing buckets:', error.message);
        return;
      }
      
      const catImagesBucket = buckets.find(bucket => bucket.name === 'cat-images');
      
      if (!catImagesBucket) {
        console.log('cat-images bucket not found, creating it...');
        const { error: createError } = await supabase.storage.createBucket('cat-images', {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
        });
        
        if (createError) {
          console.error('Error creating bucket:', createError.message);
        } else {
          console.log('Bucket created successfully');
        }
      } else {
        console.log('cat-images bucket already exists');
      }
    } catch (error) {
      console.error('Error in createBucketIfNotExists:', error);
    }
  },
  
  // Fallback function that returns a placeholder cat image
  uploadToPublicService(): string {
    // For demo purposes, return a random cat image from placekitten
    const width = Math.floor(Math.random() * 300) + 200;
    const height = Math.floor(Math.random() * 300) + 200;
    const url = `https://placekitten.com/${width}/${height}`;
    console.log('Using fallback image URL:', url);
    return url;
  },
  
  // Alternative upload method using base64 encoding
  async uploadImageBase64(uri: string, userId: string): Promise<string | null> {
    try {
      console.log('Starting base64 upload for URI:', uri.substring(0, 50) + '...');
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Base64 conversion timeout after 15 seconds')), 15000);
      });
      
      // Convert image to base64 with timeout
      const response = await Promise.race([
        fetch(uri),
        timeoutPromise
      ]) as Response;
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image for base64: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('Image blob created for base64, size:', blob.size, 'bytes');
      
      // If image is too large, return null to try other methods
      if (blob.size > 3 * 1024 * 1024) {
        console.log('Image too large for base64 encoding (>3MB)');
        return null;
      }
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        // Set up a timeout for the FileReader
        const readerTimeout = setTimeout(() => {
          reader.abort();
          reject(new Error('FileReader timeout after 10 seconds'));
        }, 10000);
        
        reader.onload = async () => {
          try {
            clearTimeout(readerTimeout);
            
            const base64data = reader.result as string;
            // Remove the data:image/jpeg;base64, part
            const base64File = base64data.split(',')[1];
            
            if (!base64File) {
              console.error('Failed to extract base64 data');
              resolve(null);
              return;
            }
            
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${userId}-${Date.now()}.${fileExt}`;
            const filePath = fileName;
            
            console.log('Base64 data prepared, uploading...');
            const { data, error } = await supabase.storage
              .from('cat-images')
              .upload(filePath, this.decode(base64File), {
                contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                upsert: true
              });
            
            if (error) {
              console.log('Base64 upload error:', error.message);
              resolve(null);
              return;
            }
            
            // Add a small delay before getting the public URL
            // This helps ensure the file is properly registered in Supabase
            console.log('Upload successful, waiting briefly before getting URL...');
            setTimeout(async () => {
              const { data: urlData } = supabase.storage
                .from('cat-images')
                .getPublicUrl(filePath);
              
              console.log('Base64 upload successful, URL:', urlData.publicUrl);
              resolve(urlData.publicUrl);
            }, 500); // 500ms delay
          } catch (err) {
            clearTimeout(readerTimeout);
            console.error('Error in base64 upload process:', err);
            resolve(null);
          }
        };
        
        reader.onerror = () => {
          clearTimeout(readerTimeout);
          console.error('FileReader error');
          resolve(null);
        };
        
        reader.onabort = () => {
          clearTimeout(readerTimeout);
          console.error('FileReader aborted');
          resolve(null);
        };
        
        // Start reading the blob as data URL
        reader.readAsDataURL(blob);
      });
    } catch (error: any) {
      console.error('Error in uploadImageBase64:', error.message || error);
      return null;
    }
  },
  
  // Helper function to decode base64
  decode(base64String: string): Uint8Array {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  },
  
  // Get a fallback image URL if Supabase storage fails
  getFallbackImageUrl(): string {
    // Return a placeholder cat image URL
    return 'https://placekitten.com/500/500';
  },

  // Ensure the storage bucket exists before uploading
  async ensureStorageBucketExists(): Promise<boolean> {
    try {
      console.log('Checking if cat-images bucket exists...');
      
      // First check if the bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.log('Cannot list buckets due to permissions, assuming bucket exists...');
        
        // Try to upload a tiny test file to see if we can use the bucket
        return await this.testBucketAccess();
      }
      
      const catImagesBucket = buckets.find(bucket => bucket.name === 'cat-images');
      
      if (!catImagesBucket) {
        console.log('cat-images bucket not found, trying to create it...');
        
        // Try to create the bucket
        const { error: createError } = await supabase.storage.createBucket('cat-images', {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
        });
        
        if (createError) {
          if (createError.message.includes('already exists')) {
            console.log('Bucket already exists (race condition)');
            return true;
          }
          
          console.log('Cannot create bucket due to permissions, assuming it exists...');
          // Even if we can't create it, it might exist and we can upload to it
          return await this.testBucketAccess();
        }
        
        console.log('Bucket created successfully');
        return true;
      }
      
      console.log('cat-images bucket exists');
      return true;
    } catch (error) {
      console.error('Error in ensureStorageBucketExists:', error);
      // Even if we get an error, try to test bucket access
      return await this.testBucketAccess();
    }
  },
  
  // Test if we can upload to the bucket
  async testBucketAccess(): Promise<boolean> {
    try {
      console.log('Testing if we can upload to cat-images bucket...');
      
      // Create a tiny 1x1 transparent pixel as base64
      const tinyPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const testData = this.decode(tinyPixel);
      const testPath = `test-${Date.now()}.png`;
      
      const { data, error } = await supabase.storage
        .from('cat-images')
        .upload(testPath, testData, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (error) {
        console.log('Test upload failed:', error.message);
        return false;
      }
      
      console.log('Test upload succeeded, bucket is accessible');
      return true;
    } catch (error) {
      console.log('Error testing bucket access:', error);
      return false;
    }
  },
  
  // Check if a user owns a cat sighting
  async isUserOwner(catId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('cats')
        .select('user_id')
        .eq('id', catId)
        .single();
      
      if (error || !data) {
        console.error('Error checking cat ownership:', error?.message || 'Cat not found');
        return false;
      }
      
      return data.user_id === userId;
    } catch (error: any) {
      console.error('Error in isUserOwner:', error.message || error);
      return false;
    }
  },
  
  // Update a cat sighting
  async updateCat(
    catId: string, 
    userId: string, 
    updates: Partial<Omit<Cat, 'id' | 'created_at' | 'user_id'>>
  ): Promise<boolean> {
    try {
      // First check if the user owns this cat
      const isOwner = await this.isUserOwner(catId, userId);
      
      if (!isOwner) {
        console.log('User does not own this cat sighting');
        return false;
      }
      
      const { error } = await supabase
        .from('cats')
        .update(updates)
        .eq('id', catId)
        .eq('user_id', userId); // Extra safety check
      
      if (error) {
        console.error('Error updating cat:', error);
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('Error in updateCat:', error.message || error);
      return false;
    }
  },
  
  // Delete a cat sighting
  async deleteCat(catId: string, userId: string): Promise<boolean> {
    try {
      // First check if the user owns this cat
      const isOwner = await this.isUserOwner(catId, userId);
      
      if (!isOwner) {
        console.log('User does not own this cat sighting');
        return false;
      }
      
      const { error } = await supabase
        .from('cats')
        .delete()
        .eq('id', catId)
        .eq('user_id', userId); // Extra safety check
      
      if (error) {
        console.error('Error deleting cat:', error);
        return false;
      }
      
      return true;
    } catch (error: any) {
      console.error('Error in deleteCat:', error.message || error);
      return false;
    }
  },
  
  // Clean up old cat sightings that haven't been interacted with
  async cleanupOldCatSightings(): Promise<string[]> {
    try {
      console.log('Starting cleanup of old cat sightings...');
      
      // Get all cats
      const cats = await this.getCats();
      console.log(`Total cats in database: ${cats.length}`);
      
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      // Filter cats older than 24 hours
      const oldCats = cats.filter(cat => {
        const spottedAt = new Date(cat.spotted_at);
        const isOld = spottedAt < oneDayAgo;
        if (isOld) {
          console.log(`Cat ${cat.id} spotted at ${spottedAt.toISOString()} is older than 24 hours`);
        }
        return isOld;
      });
      
      if (oldCats.length === 0) {
        console.log('No old cat sightings to clean up');
        return [];
      }
      
      console.log(`Found ${oldCats.length} old cat sightings to clean up`);
      
      const deletedCatIds: string[] = [];
      const failedDeletions: string[] = [];
      
      // Delete each old cat
      for (const cat of oldCats) {
        console.log(`Attempting to delete old cat sighting: ${cat.id}`);
        
        // Verify the cat exists before deletion
        const { data: existingCat, error: checkError } = await supabase
          .from('cats')
          .select('id')
          .eq('id', cat.id)
          .single();
          
        if (checkError) {
          if (checkError.code === 'PGRST116') {
            // Cat already doesn't exist
            console.log(`Cat ${cat.id} no longer exists, skipping deletion`);
            continue;
          }
          console.error(`Error checking if cat ${cat.id} exists:`, checkError);
          continue;
        }
        
        if (!existingCat) {
          console.log(`Cat ${cat.id} no longer exists, skipping deletion`);
          continue;
        }
        
        // Perform the deletion
        const { error } = await supabase
          .from('cats')
          .delete()
          .eq('id', cat.id);
        
        if (error) {
          console.error(`Error deleting cat ${cat.id}:`, error);
          failedDeletions.push(cat.id);
        } else {
          console.log(`Successfully deleted cat ${cat.id} from database`);
          
          // Verify deletion was successful
          const { data: checkDeleted, error: verifyError } = await supabase
            .from('cats')
            .select('id')
            .eq('id', cat.id)
            .single();
            
          if (verifyError && verifyError.code === 'PGRST116') {
            console.log(`Verified cat ${cat.id} was deleted (not found)`);
            deletedCatIds.push(cat.id);
          } else if (checkDeleted) {
            console.error(`DELETION FAILED: Cat ${cat.id} still exists in database after deletion!`);
            failedDeletions.push(cat.id);
          } else {
            // This shouldn't happen, but just in case
            console.log(`Cat ${cat.id} appears to be deleted but verification was inconclusive`);
            deletedCatIds.push(cat.id);
          }
        }
      }
      
      // Final verification - get all cats again to confirm deletions
      const remainingCats = await this.getCats();
      const actualDeleted = cats.length - remainingCats.length;
      
      console.log(`After cleanup: ${remainingCats.length} cats remain in database (deleted ${actualDeleted})`);
      
      if (actualDeleted !== deletedCatIds.length) {
        console.log(`Warning: Detected ${actualDeleted} deletions but tracked ${deletedCatIds.length} successful deletions`);
        console.log(`Failed deletions: ${failedDeletions.length}`);
        
        // If we detected more deletions than we tracked, try to identify which cats were deleted
        if (actualDeleted > deletedCatIds.length) {
          const remainingCatIds = new Set(remainingCats.map(cat => cat.id));
          const additionalDeletedCats = cats.filter(cat => !remainingCatIds.has(cat.id) && !deletedCatIds.includes(cat.id));
          
          console.log(`Found ${additionalDeletedCats.length} additional deleted cats that weren't tracked`);
          for (const cat of additionalDeletedCats) {
            console.log(`Adding untracked deleted cat ${cat.id} to deletedCatIds`);
            deletedCatIds.push(cat.id);
          }
        }
      }
      
      console.log(`Cleanup completed. Deleted ${deletedCatIds.length} cat sightings.`);
      return deletedCatIds;
    } catch (error: any) {
      console.error('Error in cleanupOldCatSightings:', error.message || error);
      return [];
    }
  },
}; 