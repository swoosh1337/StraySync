import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './app/navigation';
import { SettingsProvider } from './app/contexts/SettingsContext';
import { AuthProvider } from './app/contexts/AuthContext';
import * as Notifications from 'expo-notifications';
import { notificationService } from './app/services/notifications';
import { cleanupService } from './app/services/cleanup';
import { SplashScreen as CustomSplashScreen } from './app/components';
import { useLoading } from './app/hooks';
import * as SplashScreen from 'expo-splash-screen';
import { View, LogBox } from 'react-native';

// Ignore specific warnings that might be causing issues
LogBox.ignoreLogs([
  'Animated: `useNativeDriver` was not specified',
  'Non-serializable values were found in the navigation state',
  'Profile fetch timeout',
  'Exception in fetchProfile',
]);

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore error */
});

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const { withLoading } = useLoading();

  // Initialize app services
  useEffect(() => {
    async function prepare() {
      try {
        console.log('App initialization started');

        // Initialize services here
        await withLoading(async () => {
          console.log('Initializing app services...');

          // Initialize notification service
          await notificationService.initialize();
          console.log('Notification service initialized successfully');

          // Check and run cleanup of old animal records
          await cleanupService.checkAndRunCleanup();
          console.log('Cleanup check completed');

          // Add any other initialization tasks here
          // For example: load fonts, preload assets, etc.

          // Small delay to ensure everything is ready
          await new Promise(resolve => setTimeout(resolve, 500));
        });

        console.log('App initialization completed');
      } catch (e) {
        console.warn('Error initializing app:', e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // Handle splash screen completion
  const handleCustomSplashComplete = useCallback(() => {
    console.log('Custom splash screen animation completed');
    setShowCustomSplash(false);
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && !showCustomSplash) {
      console.log('Hiding native splash screen');
      // This tells the splash screen to hide immediately
      await SplashScreen.hideAsync().catch(e => {
        console.warn('Error hiding splash screen:', e);
      });
    }
  }, [appIsReady, showCustomSplash]);

  // Show custom splash screen after native splash screen
  if (!appIsReady || showCustomSplash) {
    return (
      <CustomSplashScreen
        onFinish={appIsReady ? handleCustomSplashComplete : undefined}
      />
    );
  }

  // Main app
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <SettingsProvider>
            <AppNavigator />
            <StatusBar style="auto" />
          </SettingsProvider>
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
