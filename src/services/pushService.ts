import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;

export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  // Dynamic import to avoid loading native module on web
  const { PushNotifications } = await import('@capacitor/push-notifications');

  // Request permission
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    console.log('[Push] Permission not granted');
    return;
  }

  // Register with APNs
  await PushNotifications.register();

  // Save device token on successful registration
  PushNotifications.addListener('registration', async (token) => {
    console.log('[Push] Device token received');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('push_tokens').upsert(
        {
          user_id: user.id,
          token: token.value,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' }
      );
    }
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', error);
  });

  // Foreground notification — could show an in-app toast
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Foreground notification:', notification.title);
  });

  // User tapped a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    if (data?.tripId) {
      window.location.href = `/trips/${data.tripId}`;
    }
  });
}
