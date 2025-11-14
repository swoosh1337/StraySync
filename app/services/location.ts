import * as Location from 'expo-location';

export type LocationCoordinates = {
  latitude: number;
  longitude: number;
};

export type Region = LocationCoordinates & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export const locationService = {
  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      // Respect user's decision - don't show alert asking to reconsider
      console.log('[Location] Permission denied by user');
      return false;
    }

    return true;
  },
  
  // Get the current location
  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    try {
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        return null;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  },
  
  // Calculate distance between two coordinates in kilometers
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  },
  
  // Convert degrees to radians
  deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  },
  
  // Check if a location is within a specified radius (in kilometers)
  isLocationWithinRadius(
    userLocation: LocationCoordinates,
    targetLocation: LocationCoordinates,
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      targetLocation.latitude,
      targetLocation.longitude
    );
    
    return distance <= radiusKm;
  },
  
  // Get a map region based on a location and delta values
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