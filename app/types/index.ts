// Location Types
export type LocationCoordinates = {
  latitude: number;
  longitude: number;
};

export type Region = LocationCoordinates & {
  latitudeDelta: number;
  longitudeDelta: number;
};

// Cat Types
export type Cat = {
  id: string;
  created_at: string;
  user_id: string;
  latitude: number;
  longitude: number;
  image_url: string;
  description?: string;
  spotted_at: string;
  name?: string;
  breed?: string;
  color?: string;
  age?: string;
  gender?: string;
  health_status?: string;
  is_neutered?: boolean;
  is_adoptable?: boolean;
  contact_info?: string;
  last_seen_date?: string;
  animal_type?: 'cat' | 'dog';
};

// Notification Types
export type NotifiedArea = {
  latitude: number;
  longitude: number;
  radius: number;
  timestamp: number;
};

// Settings Types
export type AppSettings = {
  notificationRadius: number;
  notificationTimeFrame: number;
  isNotificationsEnabled: boolean;
  isBackgroundTrackingEnabled: boolean;
};

// Navigation Types
export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  CatDetails: { catId: string };
  AddCat: { latitude?: number; longitude?: number } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Settings: undefined;
}; 