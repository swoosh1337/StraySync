import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsContextType = {
  notificationRadius: number;
  setNotificationRadius: (radius: number) => void;
  notificationTimeFrame: number;
  setNotificationTimeFrame: (hours: number) => void;
  isNotificationsEnabled: boolean;
  setIsNotificationsEnabled: (enabled: boolean) => void;
  isBackgroundTrackingEnabled: boolean;
  setIsBackgroundTrackingEnabled: (enabled: boolean) => void;
  searchRadius: number;
  setSearchRadius: (radius: number) => void;
};

const defaultSettings: Omit<
  SettingsContextType,
  | 'setNotificationRadius'
  | 'setNotificationTimeFrame'
  | 'setIsNotificationsEnabled'
  | 'setIsBackgroundTrackingEnabled'
  | 'setSearchRadius'
> = {
  notificationRadius: 0.8, // Default radius in kilometers (0.5 miles ≈ 0.8 km)
  notificationTimeFrame: 24, // Default time frame in hours
  isNotificationsEnabled: true,
  isBackgroundTrackingEnabled: false,
  searchRadius: 50, // Default search radius in kilometers (about 31 miles)
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notificationRadius, setNotificationRadiusState] = useState(
    defaultSettings.notificationRadius
  );
  const [notificationTimeFrame, setNotificationTimeFrameState] = useState(
    defaultSettings.notificationTimeFrame
  );
  const [isNotificationsEnabled, setIsNotificationsEnabledState] = useState(
    defaultSettings.isNotificationsEnabled
  );
  const [isBackgroundTrackingEnabled, setIsBackgroundTrackingEnabledState] =
    useState(defaultSettings.isBackgroundTrackingEnabled);
  const [searchRadius, setSearchRadiusState] = useState(
    defaultSettings.searchRadius
  );

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem('userSettings');
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          setNotificationRadiusState(
            settings.notificationRadius ?? defaultSettings.notificationRadius
          );
          setNotificationTimeFrameState(
            settings.notificationTimeFrame ??
              defaultSettings.notificationTimeFrame
          );
          setIsNotificationsEnabledState(
            settings.isNotificationsEnabled ??
              defaultSettings.isNotificationsEnabled
          );
          setIsBackgroundTrackingEnabledState(
            settings.isBackgroundTrackingEnabled ??
              defaultSettings.isBackgroundTrackingEnabled
          );
          setSearchRadiusState(
            settings.searchRadius ?? defaultSettings.searchRadius
          );
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings to AsyncStorage whenever they change
  const saveSettings = async (settings: any) => {
    try {
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Wrapper functions to update state and save to AsyncStorage
  const setNotificationRadius = (radius: number) => {
    setNotificationRadiusState(radius);
    saveSettings({
      notificationRadius: radius,
      notificationTimeFrame,
      isNotificationsEnabled,
      isBackgroundTrackingEnabled,
    });
  };

  const setNotificationTimeFrame = (hours: number) => {
    setNotificationTimeFrameState(hours);
    saveSettings({
      notificationRadius,
      notificationTimeFrame: hours,
      isNotificationsEnabled,
      isBackgroundTrackingEnabled,
    });
  };

  const setIsNotificationsEnabled = (enabled: boolean) => {
    setIsNotificationsEnabledState(enabled);
    saveSettings({
      notificationRadius,
      notificationTimeFrame,
      isNotificationsEnabled: enabled,
      isBackgroundTrackingEnabled,
    });
  };

  const setIsBackgroundTrackingEnabled = (enabled: boolean) => {
    setIsBackgroundTrackingEnabledState(enabled);
    saveSettings({
      notificationRadius,
      notificationTimeFrame,
      isNotificationsEnabled,
      isBackgroundTrackingEnabled: enabled,
      searchRadius,
    });
  };

  const setSearchRadius = (radius: number) => {
    setSearchRadiusState(radius);
    saveSettings({
      notificationRadius,
      notificationTimeFrame,
      isNotificationsEnabled,
      isBackgroundTrackingEnabled,
      searchRadius: radius,
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        notificationRadius,
        setNotificationRadius,
        notificationTimeFrame,
        setNotificationTimeFrame,
        isNotificationsEnabled,
        setIsNotificationsEnabled,
        isBackgroundTrackingEnabled,
        setIsBackgroundTrackingEnabled,
        searchRadius,
        setSearchRadius,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}; 