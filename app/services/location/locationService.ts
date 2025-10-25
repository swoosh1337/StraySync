import * as Location from 'expo-location';
import { LocationCoordinates, Region } from '../../types';
import { Linking, Platform } from 'react-native';

// Track permission request to avoid multiple requests
let permissionRequested = false;

export const locationService = {
  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    try {
      // If we've already requested permissions, don't ask again in the same session
      if (permissionRequested) {
        console.log('Location permissions already requested this session');
        const { status } = await Location.getForegroundPermissionsAsync();
        return status === 'granted';
      }
      
      console.log('Requesting location permissions...');
      permissionRequested = true;
      
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
  
  // Get current location with timeout
  async getCurrentLocation(timeout = 10000): Promise<LocationCoordinates | null> {
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
      
      // Create a promise that rejects after the timeout
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), timeout);
      });
      
      // Create the location request promise
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      // Race the location request against the timeout
      const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
      
      console.log(`Current location: ${location.coords.latitude}, ${location.coords.longitude}`);
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error: any) {
      console.error('Error getting current location:', error.message || error);
      
      // Try to get last known location as fallback
      try {
        console.log('Trying to get last known location as fallback...');
        const lastLocation = await Location.getLastKnownPositionAsync();
        
        if (lastLocation) {
          console.log(`Using last known location: ${lastLocation.coords.latitude}, ${lastLocation.coords.longitude}`);
          return {
            latitude: lastLocation.coords.latitude,
            longitude: lastLocation.coords.longitude,
          };
        }
      } catch (fallbackError) {
        console.error('Error getting last known location:', fallbackError);
      }
      
      // If all else fails, return null
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
  
  // Open maps app with directions to a location
  async openMapsWithDirections(
    destinationLat: number,
    destinationLng: number,
    destinationName: string = 'Animal Location'
  ): Promise<boolean> {
    try {
      const currentLocation = await this.getCurrentLocation();
      
      // Encode the destination name for URLs
      const encodedDestName = encodeURIComponent(destinationName);
      
      // On iOS, use Apple Maps directly (no need for URL scheme configuration)
      if (Platform.OS === 'ios') {
        const appleMapsUrl = `http://maps.apple.com/?saddr=${currentLocation?.latitude},${currentLocation?.longitude}&daddr=${destinationLat},${destinationLng}&dirflg=w&q=${encodedDestName}`;
        
        console.log('Opening Apple Maps...');
        await Linking.openURL(appleMapsUrl);
        return true;
      }
      
      // On Android, try Google Maps app first
      if (Platform.OS === 'android') {
        try {
          const googleMapsUrl = `google.navigation:q=${destinationLat},${destinationLng}&mode=w`;
          const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
          
          if (canOpenGoogleMaps) {
            console.log('Opening Google Maps...');
            await Linking.openURL(googleMapsUrl);
            return true;
          }
        } catch (error) {
          console.log('Google Maps not available, using web fallback');
        }
      }
      
      // Fallback to web URL (works on all platforms)
      const webMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation?.latitude},${currentLocation?.longitude}&destination=${destinationLat},${destinationLng}&travelmode=walking`;
      
      console.log('Opening maps in browser...');
      await Linking.openURL(webMapsUrl);
      return true;
    } catch (error) {
      console.error('Error opening maps:', error);
      return false;
    }
  },
}; 