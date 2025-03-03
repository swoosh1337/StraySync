import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../../types';

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  notificationRadius: 1, // 1 km
  notificationTimeFrame: 24, // 24 hours
  isNotificationsEnabled: true,
  isBackgroundTrackingEnabled: false,
};

// Storage key
const SETTINGS_STORAGE_KEY = 'app_settings';

export const settingsService = {
  // Current settings cache
  currentSettings: { ...DEFAULT_SETTINGS },
  
  // Initialize settings
  async initialize(): Promise<AppSettings> {
    try {
      console.log('Initializing settings service...');
      
      // Load settings from storage
      const settings = await this.loadSettings();
      
      // Update current settings
      this.currentSettings = settings;
      
      return settings;
    } catch (error: any) {
      console.error('Error initializing settings:', error.message || error);
      return this.currentSettings;
    }
  },
  
  // Load settings from storage
  async loadSettings(): Promise<AppSettings> {
    try {
      console.log('Loading settings from storage...');
      
      const settingsJson = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      
      if (!settingsJson) {
        console.log('No settings found in storage, using defaults');
        return { ...DEFAULT_SETTINGS };
      }
      
      const settings = JSON.parse(settingsJson);
      console.log('Loaded settings:', settings);
      
      // Ensure all required settings exist by merging with defaults
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (error: any) {
      console.error('Error loading settings:', error.message || error);
      return { ...DEFAULT_SETTINGS };
    }
  },
  
  // Save settings to storage
  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    try {
      console.log('Saving settings:', settings);
      
      // Merge with current settings
      const updatedSettings = { ...this.currentSettings, ...settings };
      
      // Save to storage
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      
      // Update current settings
      this.currentSettings = updatedSettings;
      
      return updatedSettings;
    } catch (error: any) {
      console.error('Error saving settings:', error.message || error);
      return this.currentSettings;
    }
  },
  
  // Update notification radius
  async setNotificationRadius(radius: number): Promise<AppSettings> {
    return this.saveSettings({ notificationRadius: radius });
  },
  
  // Update notification time frame
  async setNotificationTimeFrame(hours: number): Promise<AppSettings> {
    return this.saveSettings({ notificationTimeFrame: hours });
  },
  
  // Update notifications enabled
  async setNotificationsEnabled(enabled: boolean): Promise<AppSettings> {
    return this.saveSettings({ isNotificationsEnabled: enabled });
  },
  
  // Update background tracking enabled
  async setBackgroundTrackingEnabled(enabled: boolean): Promise<AppSettings> {
    return this.saveSettings({ isBackgroundTrackingEnabled: enabled });
  },
  
  // Get current settings
  getSettings(): AppSettings {
    return { ...this.currentSettings };
  },
  
  // Reset settings to defaults
  async resetSettings(): Promise<AppSettings> {
    return this.saveSettings({ ...DEFAULT_SETTINGS });
  },
}; 