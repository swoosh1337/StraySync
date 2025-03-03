import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export const utilsService = {
  // Format a date string to a human-readable format
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error: any) {
      console.error('Error formatting date:', error.message || error);
      return dateString;
    }
  },
  
  // Get a human-readable time ago string
  getTimeAgo(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 60) {
        return diffMins <= 1 ? 'just now' : `${diffMins} minutes ago`;
      } else if (diffHours < 24) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
      } else {
        return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
      }
    } catch (error) {
      return 'recently';
    }
  },
  
  // Generate a unique ID
  generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  },
  
  // Check if a string is a valid URL
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  },
  
  // Get file info
  async getFileInfo(uri: string): Promise<{ exists: boolean; size?: number; type?: string }> {
    try {
      if (!uri) {
        return { exists: false };
      }
      
      // For web platform
      if (Platform.OS === 'web') {
        return { exists: true };
      }
      
      // For native platforms
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      return {
        exists: fileInfo.exists,
        // The size property might not exist on all FileInfo objects
        size: 'size' in fileInfo ? fileInfo.size : undefined,
        type: uri.split('.').pop()?.toLowerCase(),
      };
    } catch (error: any) {
      console.error('Error getting file info:', error.message || error);
      return { exists: false };
    }
  },
  
  // Format file size to human-readable format
  formatFileSize(bytes?: number): string {
    if (bytes === undefined) return 'Unknown size';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  },
  
  // Truncate text with ellipsis
  truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    
    return text.substring(0, maxLength) + '...';
  },
  
  // Capitalize first letter of each word
  capitalizeWords(text: string): string {
    if (!text) return '';
    
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },
  
  // Validate email format
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Decode base64 string to Uint8Array
  decode(base64String: string): Uint8Array {
    try {
      const binaryString = atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes;
    } catch (error: any) {
      console.error('Error decoding base64 string:', error.message || error);
      return new Uint8Array();
    }
  },
  
  // Sleep for a specified number of milliseconds
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
}; 