import { Alert } from 'react-native';
import { REMOVE_BG_API_KEY } from '@env';

export interface BackgroundRemovalResult {
  imageUri: string;
  success: boolean;
}

export const backgroundRemovalService = {
  /**
   * Remove background from an image using remove.bg API
   * @param imageUri - Local file URI or base64
   * @returns Image with transparent background
   */
  async removeBackground(imageUri: string): Promise<BackgroundRemovalResult | null> {
    try {
      if (__DEV__) {
        console.log('[BG Removal] Processing image...');
      }

      if (!REMOVE_BG_API_KEY) {
        if (__DEV__) {
          console.log('[BG Removal] No API key configured, using original image');
        }
        return null;
      }

      // Create FormData with file URI (React Native specific)
      const formData = new FormData();
      formData.append('size', 'auto');
      formData.append('image_file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': REMOVE_BG_API_KEY,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BG Removal] API error:', errorText);
        
        // Check if it's a credit limit error (403 or 402)
        if (response.status === 403 || response.status === 402) {
          if (__DEV__) {
            console.log('[BG Removal] Monthly limit reached, using original image');
          }
          // Silently fall back - don't show alert
          return null;
        }
        
        // For other errors, also fall back silently
        if (__DEV__) {
          console.log('[BG Removal] API error, using original image');
        }
        return null;
      }

      // Convert response blob to base64 data URI
      const resultBlob = await response.blob();
      const reader = new FileReader();
      
      const resultUri = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(resultBlob);
      });

      if (__DEV__) {
        console.log('[BG Removal] Background removed successfully');
      }

      return {
        imageUri: resultUri,
        success: true,
      };
    } catch (error: any) {
      console.error('[BG Removal] Error:', error);
      
      // Silently fall back to original image - no alert needed
      if (__DEV__) {
        console.log('[BG Removal] Failed, using original image');
      }
      
      return null;
    }
  },

  /**
   * Check if background removal is available
   */
  isAvailable(): boolean {
    return true; // Always available, will fall back gracefully if limit reached
  },
};
