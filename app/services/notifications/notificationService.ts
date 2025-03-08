import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationCoordinates, NotifiedArea } from '../../types';
import { catService } from '../api/catService';
import { locationService } from '../location/locationService';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Storage keys
const NOTIFIED_CATS_KEY = 'notified_cats';
const LAST_NOTIFIED_AREA_KEY = 'last_notified_area';

export const notificationService = {
  // Notified cats cache
  notifiedCatIds: new Set<string>(),
  notifiedAreas: [] as NotifiedArea[],
  
  // Initialize the notification service
  async initialize(): Promise<void> {
    try {
      console.log('Initializing notification service...');
      await this.loadNotifiedCats();
      
      // Request permissions
      await this.requestPermissions();
    } catch (error: any) {
      console.error('Error initializing notification service:', error.message || error);
    }
  },
  
  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      console.log('Requesting notification permissions...');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }
      
      console.log('Notification permission granted');
      return true;
    } catch (error: any) {
      console.error('Error requesting notification permissions:', error.message || error);
      return false;
    }
  },
  
  // Load notified cats from storage
  async loadNotifiedCats(): Promise<void> {
    try {
      console.log('Loading notified cats from storage...');
      
      // Load notified cat IDs
      const notifiedCatsJson = await AsyncStorage.getItem(NOTIFIED_CATS_KEY);
      if (notifiedCatsJson) {
        const notifiedCats = JSON.parse(notifiedCatsJson);
        this.notifiedCatIds = new Set(notifiedCats);
        console.log(`Loaded ${this.notifiedCatIds.size} notified cat IDs`);
      }
      
      // Load notified areas
      const notifiedAreasJson = await AsyncStorage.getItem(LAST_NOTIFIED_AREA_KEY);
      if (notifiedAreasJson) {
        this.notifiedAreas = JSON.parse(notifiedAreasJson);
        console.log(`Loaded ${this.notifiedAreas.length} notified areas`);
      }
    } catch (error: any) {
      console.error('Error loading notified cats:', error.message || error);
    }
  },
  
  // Save notified cats to storage
  async saveNotifiedCats(): Promise<void> {
    try {
      console.log('Saving notified cats to storage...');
      
      // Save notified cat IDs
      await AsyncStorage.setItem(
        NOTIFIED_CATS_KEY,
        JSON.stringify([...this.notifiedCatIds])
      );
      
      // Save notified areas
      await AsyncStorage.setItem(
        LAST_NOTIFIED_AREA_KEY,
        JSON.stringify(this.notifiedAreas)
      );
    } catch (error: any) {
      console.error('Error saving notified cats:', error.message || error);
    }
  },
  
  // Check if we've recently notified about cats in this area
  async hasRecentlyNotifiedArea(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<boolean> {
    try {
      // Clean up old notifications first
      this.cleanupOldNotifications();
      
      // Check if we've recently notified about this area
      const currentLocation = { latitude, longitude };
      
      return this.notifiedAreas.some(area => {
        const areaLocation = { latitude: area.latitude, longitude: area.longitude };
        const isWithinRadius = locationService.isLocationWithinRadius(
          currentLocation,
          areaLocation,
          radiusKm
        );
        return isWithinRadius;
      });
    } catch (error: any) {
      console.error('Error checking recently notified area:', error.message || error);
      return false;
    }
  },
  
  // Mark an area as notified
  async markAreaAsNotified(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<void> {
    try {
      console.log(`Marking area (${latitude}, ${longitude}) with radius ${radiusKm}km as notified`);
      
      // Add to notified areas
      this.notifiedAreas.push({
        latitude,
        longitude,
        radius: radiusKm,
        timestamp: Date.now(),
      });
      
      // Save to storage
      await this.saveNotifiedCats();
    } catch (error: any) {
      console.error('Error marking area as notified:', error.message || error);
    }
  },
  
  // Reset notification state if needed (when user moves to a new area)
  async resetNotificationStateIfNeeded(
    latitude: number,
    longitude: number
  ): Promise<void> {
    try {
      // If we have no notified areas, nothing to reset
      if (this.notifiedAreas.length === 0) {
        return;
      }
      
      // Check if the user has moved far enough from all notified areas
      const currentLocation = { latitude, longitude };
      const farFromAllAreas = this.notifiedAreas.every(area => {
        const areaLocation = { latitude: area.latitude, longitude: area.longitude };
        const distance = locationService.calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          areaLocation.latitude,
          areaLocation.longitude
        );
        
        // If we're more than 5km away from a notified area, consider it "far"
        return distance > 5;
      });
      
      if (farFromAllAreas) {
        console.log('User has moved far from all notified areas, resetting notification state');
        this.notifiedAreas = [];
        await this.saveNotifiedCats();
      }
    } catch (error: any) {
      console.error('Error resetting notification state:', error.message || error);
    }
  },
  
  // Clean up old notifications (older than 24 hours)
  cleanupOldNotifications(): void {
    try {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      // Filter out areas older than 24 hours
      const oldLength = this.notifiedAreas.length;
      this.notifiedAreas = this.notifiedAreas.filter(
        area => now - area.timestamp < oneDayMs
      );
      
      if (oldLength !== this.notifiedAreas.length) {
        console.log(`Cleaned up ${oldLength - this.notifiedAreas.length} old notified areas`);
      }
    } catch (error: any) {
      console.error('Error cleaning up old notifications:', error.message || error);
    }
  },
  
  // Check for nearby cats and send notifications
  async checkForNearbyCats(
    location: LocationCoordinates,
    radiusKm: number,
    timeFrameHours: number
  ): Promise<void> {
    try {
      console.log(`Checking for cats within ${radiusKm}km in the last ${timeFrameHours} hours...`);
      
      // Check if we've recently notified about this area
      const recentlyNotified = await this.hasRecentlyNotifiedArea(
        location.latitude,
        location.longitude,
        radiusKm
      );
      
      if (recentlyNotified) {
        console.log('Already notified about cats in this area recently, skipping');
        return;
      }
      
      // Get nearby cats
      const nearbyCats = await catService.getCatsWithinRadius(
        location.latitude,
        location.longitude,
        radiusKm,
        timeFrameHours
      );
      
      // Filter out cats we've already notified about
      const newCats = nearbyCats.filter(cat => !this.notifiedCatIds.has(cat.id));
      
      if (newCats.length === 0) {
        console.log('No new cats found nearby');
        return;
      }
      
      console.log(`Found ${newCats.length} new cats nearby`);
      
      // Mark this area as notified
      await this.markAreaAsNotified(
        location.latitude,
        location.longitude,
        radiusKm
      );
      
      // Add these cats to the notified set
      newCats.forEach(cat => this.notifiedCatIds.add(cat.id));
      await this.saveNotifiedCats();
      
      // Send a notification
      if (newCats.length === 1) {
        const cat = newCats[0];
        const timeAgo = this.getTimeAgo(cat.created_at);
        await this.sendNotification(
          'stray animal Nearby',
          `A cat was spotted ${timeAgo} near your location. Tap to view details.`
        );
      } else {
        await this.sendNotification(
          'stray animals Nearby',
          `${newCats.length} cats were spotted near your location. Tap to view details.`
        );
      }
    } catch (error: any) {
      console.error('Error checking for nearby cats:', error.message || error);
    }
  },
  
  // Send a notification
  async sendNotification(title: string, body: string): Promise<void> {
    try {
      console.log(`Sending notification: ${title} - ${body}`);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      });
      
      console.log('Notification sent successfully');
    } catch (error: any) {
      console.error('Error sending notification:', error.message || error);
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
  }
}; 