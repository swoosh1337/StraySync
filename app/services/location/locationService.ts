import * as Location from 'expo-location';
import { LocationCoordinates, Region } from '../../types';

export const locationService = {
  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    try {
      console.log('Requesting location permissions...');
      
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied');
        return false;
      }
      
      console.log('Foreground location permission granted');
      return true;
    } catch (error: any) {
      console.error('Error requesting location permissions:', error.message || error);
      return false;
    }
  },
  
  // Get current location
  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    try {
      console.log('Getting current location...');
      
      // Check permissions first
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission not granted, requesting...');
        const permissionGranted = await this.requestPermissions();
        if (!permissionGranted) {
          console.log('Location permission denied');
          return null;
        }
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      console.log(`Current location: ${location.coords.latitude}, ${location.coords.longitude}`);
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error: any) {
      console.error('Error getting current location:', error.message || error);
      return null;
    }
  },
  
  // Calculate distance between two points using Haversine formula
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    try {
      const R = 6371; // Radius of the earth in km
      const dLat = this.deg2rad(lat2 - lat1);
      const dLon = this.deg2rad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in km
      return distance;
    } catch (error: any) {
      console.error('Error calculating distance:', error.message || error);
      return Infinity; // Return a large value on error
    }
  },
  
  // Convert degrees to radians
  deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  },
  
  // Check if a location is within a radius of another location
  isLocationWithinRadius(
    userLocation: LocationCoordinates,
    targetLocation: LocationCoordinates,
    radiusKm: number
  ): boolean {
    try {
      const distance = this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        targetLocation.latitude,
        targetLocation.longitude
      );
      
      return distance <= radiusKm;
    } catch (error: any) {
      console.error('Error checking if location is within radius:', error.message || error);
      return false;
    }
  },
  
  // Get a region object for a map centered on a location
  getRegion(
    location: LocationCoordinates,
    latitudeDelta = 0.01,
    longitudeDelta = 0.01
  ): Region {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta,
      longitudeDelta,
    };
  },
}; 