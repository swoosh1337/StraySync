import { supabase } from './api/supabaseClient';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Free tier daily analysis limit (kept in one place)
export const FREE_TIER_DAILY_LIMIT = 30;

export interface AIAnalysisResult {
  animalType: 'cat' | 'dog' | 'unknown';
  breed: string;
  confidence?: number;
  color?: string;
  age?: string;
  healthStatus?: string;
  description?: string;
  features?: string[];
}

export interface AIUsageInfo {
  tokensUsed: number;
  cost: number;
  remaining: number;
  tier: 'free' | 'supporter';
}

export const aiAnalysisService = {
  /**
   * Analyze an animal image using AI
   * @param imageUri - Local file URI or remote URL
   * @returns Analysis result with breed, characteristics, etc.
   */
  async analyzeAnimal(imageUri: string): Promise<{
    analysis: AIAnalysisResult;
    usage: AIUsageInfo;
  } | null> {
    try {
      if (__DEV__) {
        console.log('[AI] Analyzing image:', imageUri.substring(0, 50) + '...');
      }

      // Convert local file to base64 if needed (React Native)
      let imageBase64: string | undefined;
      if (imageUri.startsWith('file://')) {
        try {
          // FileSystem can read the file:// URI directly
          imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (conversionError) {
          console.error('[AI] Failed to convert image to base64:', conversionError);
          throw new Error('Failed to process image');
        }
      }

      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('analyze-pet', {
        body: imageBase64 
          ? { imageBase64 }
          : { imageUrl: imageUri },
      });

      if (error) {
        // Handle rate limit error
        if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
          const errorData = typeof error === 'object' ? error : {};
          
          Alert.alert(
            '⏱️ Daily Limit Reached',
            errorData.message || 'You\'ve reached your daily AI analysis limit. Upgrade to Supporter for higher limits!',
            [
              { text: 'OK', style: 'cancel' },
              {
                text: 'Upgrade',
                onPress: () => {
                  // Navigate to upgrade screen
                  if (__DEV__) {
                    console.log('[AI] User wants to upgrade');
                  }
                },
              },
            ]
          );
          return null;
        }

        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      if (__DEV__) {
        console.log('[AI] Analysis complete:', {
          breed: data.analysis.breed,
          confidence: data.analysis.confidence,
          remaining: data.usage.remaining,
        });
      }

      return {
        analysis: data.analysis,
        usage: data.usage,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[AI] Analysis error:', msg);
      
      // Show user-friendly error
      Alert.alert(
        'Analysis Failed',
        'Unable to analyze the image. Please try again or enter details manually.',
        [{ text: 'OK' }]
      );
      
      return null;
    }
  },

  /**
   * Get user's AI usage statistics
   */
  async getUsageStats(): Promise<{
    totalRequests: number;
    requestsToday: number;
    remaining: number;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('user_ai_stats')
        .select('*')
        .single();

      if (error) {
        console.error('[AI] Failed to fetch stats:', error);
        return null;
      }

      return {
        totalRequests: data.total_requests || 0,
        requestsToday: data.requests_today || 0,
        remaining: FREE_TIER_DAILY_LIMIT - (data.requests_today || 0), // Assuming free tier
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[AI] Stats error:', msg);
      return null;
    }
  },

  /**
   * Check if AI analysis is available for user
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return !!user;
    } catch (error) {
      return false;
    }
  },
};
