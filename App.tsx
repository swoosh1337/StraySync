import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './app/navigation';
import { SettingsProvider } from './app/contexts/SettingsContext';
import * as Notifications from 'expo-notifications';
import { notificationService } from './app/services/notifications';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // Initialize notification service
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing notification service...');
        await notificationService.initialize();
        console.log('Notification service initialized successfully');
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
