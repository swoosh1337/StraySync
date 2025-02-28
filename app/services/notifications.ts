import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { catService } from './supabase';
import { LocationCoordinates, locationService } from './location';

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

// Notification service
export const notificationService = {
  // Set to track cat IDs that have already triggered notifications in the current session
  notifiedCatIds: new Set<string>(),
  
  // Track the last notified area
  lastNotifiedArea: {
    latitude: 0,
    longitude: 0,
    radiusKm: 0,
    timestamp: 0,
  },
  
  // Initialize notification service
  async initialize(): Promise<void> {
    try {
      // Request permissions
      await this.requestPermissions();
      
      // Load previously notified cats from storage
      await this.loadNotifiedCats();
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  },
  
  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  },
  
  // Load notified cats from storage
  async loadNotifiedCats(): Promise<void> {
    try {
      const notifiedCatsJson = await AsyncStorage.getItem(NOTIFIED_CATS_KEY);
      if (notifiedCatsJson) {
        const notifiedCats = JSON.parse(notifiedCatsJson);
        this.notifiedCatIds = new Set(notifiedCats);
      }
      
      const lastNotifiedAreaJson = await AsyncStorage.getItem(LAST_NOTIFIED_AREA_KEY);
      if (lastNotifiedAreaJson) {
        this.lastNotifiedArea = JSON.parse(lastNotifiedAreaJson);
      }
    } catch (error) {
      console.error('Error loading notified cats:', error);
    }
  },
  
  // Save notified cats to storage
  async saveNotifiedCats(): Promise<void> {
    try {
      const notifiedCatsArray = Array.from(this.notifiedCatIds);
      await AsyncStorage.setItem(NOTIFIED_CATS_KEY, JSON.stringify(notifiedCatsArray));
      await AsyncStorage.setItem(LAST_NOTIFIED_AREA_KEY, JSON.stringify(this.lastNotifiedArea));
    } catch (error) {
      console.error('Error saving notified cats:', error);
    }
  },
  
  // Check if we've recently notified about cats in this area
  async hasRecentlyNotifiedArea(latitude: number, longitude: number, radiusKm: number): Promise<boolean> {
    const now = Date.now();
    const { latitude: lastLat, longitude: lastLong, radiusKm: lastRadius, timestamp } = this.lastNotifiedArea;
    
    // If it's been less than 5 minutes since the last notification in this area, don't notify again
    if (now - timestamp < 5 * 60 * 1000) {
      // Check if we're still in roughly the same area
      const distance = locationService.calculateDistance(latitude, longitude, lastLat, lastLong);
      if (distance < radiusKm + lastRadius) {
        return true;
      }
    }
    
    return false;
  },
  
  // Mark an area as notified
  async markAreaAsNotified(latitude: number, longitude: number, radiusKm: number): Promise<void> {
    this.lastNotifiedArea = {
      latitude,
      longitude,
      radiusKm,
      timestamp: Date.now(),
    };
    await this.saveNotifiedCats();
  },
  
  // Reset notification state if needed (when leaving an area)
  async resetNotificationStateIfNeeded(latitude: number, longitude: number): Promise<void> {
    const { latitude: lastLat, longitude: lastLong, radiusKm: lastRadius } = this.lastNotifiedArea;
    
    // If we've moved far enough away from the last notified area, reset the notification state
    const distance = locationService.calculateDistance(latitude, longitude, lastLat, lastLong);
    if (distance > lastRadius * 2) {
      console.log('User has left the previously notified area, resetting notification state');
      // We don't clear the notifiedCatIds set completely, as we still want to avoid duplicate notifications
      // for the same cats, but we do reset the last notified area
      this.lastNotifiedArea = {
        latitude: 0,
        longitude: 0,
        radiusKm: 0,
        timestamp: 0,
      };
      await this.saveNotifiedCats();
    }
  },
  
  // Check for nearby cats and send notifications
  async checkForNearbyCats(
    location: LocationCoordinates,
    radiusKm: number,
    timeFrameHours: number
  ): Promise<void> {
    try {
      // First, check if we need to reset notification state
      await this.resetNotificationStateIfNeeded(location.latitude, location.longitude);
      
      // Check if we've recently notified about cats in this area
      const recentlyNotified = await this.hasRecentlyNotifiedArea(
        location.latitude,
        location.longitude,
        radiusKm
      );
      
      if (recentlyNotified) {
        console.log('Recently notified about cats in this area, skipping notification');
        return;
      }
      
      // Get all cats
      const allCats = await catService.getCats();
      
      // Filter cats by distance and time
      const now = new Date();
      const timeFrameMs = timeFrameHours * 60 * 60 * 1000;
      const nearbyCats = allCats.filter((cat) => {
        // Check if within radius
        const distance = locationService.calculateDistance(
          location.latitude,
          location.longitude,
          cat.latitude,
          cat.longitude
        );
        
        // Check if within time frame
        const catTime = new Date(cat.spotted_at).getTime();
        const timeDiff = now.getTime() - catTime;
        
        // Check if we've already notified about this cat
        const alreadyNotified = this.notifiedCatIds.has(cat.id);
        
        return distance <= radiusKm && timeDiff <= timeFrameMs && !alreadyNotified;
      });
      
      if (nearbyCats.length > 0) {
        // Mark all these cats as notified
        nearbyCats.forEach((cat) => {
          this.notifiedCatIds.add(cat.id);
        });
        
        // Mark this area as notified
        await this.markAreaAsNotified(location.latitude, location.longitude, radiusKm);
        
        // Send notification
        const title = nearbyCats.length === 1
          ? 'Stray Cat Nearby!'
          : `${nearbyCats.length} Stray Cats Nearby!`;
        
        const body = nearbyCats.length === 1
          ? `A stray cat was spotted ${this.getTimeAgo(nearbyCats[0].spotted_at)} near you.`
          : `${nearbyCats.length} stray cats were spotted near you recently.`;
        
        await this.sendNotification(title, body);
        
        // Save notified cats to storage
        await this.saveNotifiedCats();
      }
    } catch (error) {
      console.error('Error checking for nearby cats:', error);
    }
  },
  
  // Send a notification
  async sendNotification(title: string, body: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  },
  
  // Get time ago string
  getTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
  },
}; 