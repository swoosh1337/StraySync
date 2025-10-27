import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './api/supabaseClient';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    // Skip on web/simulator
    if (Platform.OS === 'web') {
      if (__DEV__) {
        console.log('[Notifications] Web platform, skipping permissions');
      }
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) {
        console.log('[Notifications] Permission not granted');
      }
      return false;
    }

    return true;
  },

  // Get push token
  async getPushToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      
      if (__DEV__) {
        console.log('[Notifications] Push token:', token);
      }

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return token;
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Notifications] Failed to get push token:', error.message);
      }
      return null;
    }
  },

  // Save push token to database
  async savePushToken(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update or insert push token in profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) throw error;

      if (__DEV__) {
        console.log('[Notifications] Push token saved');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('[Notifications] Failed to save push token:', error.message);
      }
    }
  },

  // Initialize notifications
  async initialize(): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    const token = await this.getPushToken();
    if (token) {
      await this.savePushToken(token);
    }
  },

  // Send local notification (for testing)
  async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Show immediately
    });
  },

  // Subscribe to animal status changes for favorites
  subscribeToFavoriteUpdates(userId: string, callback: (animal: any) => void) {
    // Subscribe to changes in animals table for favorited animals
    const channel = supabase
      .channel(`favorite-updates:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'animals',
        },
        async (payload) => {
          // Check if this animal is in user's favorites
          const { data: favorite } = await supabase
            .from('favorites')
            .select('id')
            .eq('auth_user_id', userId)
            .eq('animal_id', payload.new.id)
            .single();

          if (favorite) {
            // Check if status changed to rescued
            if (payload.new.is_rescued && (!payload.old || !payload.old.is_rescued)) {
              callback(payload.new);
              
              // Send local notification
              await this.sendLocalNotification(
                '🎉 Animal Rescued!',
                `An animal you favorited has been rescued!`,
                { animalId: payload.new.id }
              );
            }
          }
        }
      )
      .subscribe();

    return channel;
  },

  // Unsubscribe from updates
  unsubscribeFromUpdates(channel: any) {
    supabase.removeChannel(channel);
  },

  // Add notification listener
  addNotificationListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  },

  // Add notification response listener (when user taps notification)
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },
};
