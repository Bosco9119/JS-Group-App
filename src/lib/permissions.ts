import { isRunningInExpoGo } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type PermissionSnapshot = {
  locationGranted: boolean;
  notificationGranted: boolean;
  cameraGranted: boolean;
  mediaLibraryGranted: boolean;
  allGranted: boolean;
};

/** Expo Go on Android crashes if expo-notifications is imported (push APIs removed in SDK 53). */
const skipNotificationGate = isRunningInExpoGo() && Platform.OS === 'android';

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  if (skipNotificationGate) return null;
  // Lazy require so Expo Go Android never loads the package.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as NotificationsModule;
}

const Notifications = loadNotifications();

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function getPermissionSnapshot(): Promise<PermissionSnapshot> {
  const [location, notifications, camera, mediaLibrary] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Notifications
      ? Notifications.getPermissionsAsync()
      : Promise.resolve({ granted: true as const, ios: undefined }),
    ImagePicker.getCameraPermissionsAsync(),
    ImagePicker.getMediaLibraryPermissionsAsync(),
  ]);

  const locationGranted = location.granted;
  const notificationGranted = Notifications
    ? notifications.granted ||
      notifications.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    : true;
  const cameraGranted = camera.granted;
  const mediaLibraryGranted = mediaLibrary.granted || mediaLibrary.accessPrivileges === 'limited';

  return {
    locationGranted,
    notificationGranted,
    cameraGranted,
    mediaLibraryGranted,
    allGranted: locationGranted && notificationGranted && cameraGranted && mediaLibraryGranted,
  };
}

export async function requestRequiredPermissions(): Promise<PermissionSnapshot> {
  await Location.requestForegroundPermissionsAsync();
  if (Notifications) {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  }
  await ImagePicker.requestCameraPermissionsAsync();
  await ImagePicker.requestMediaLibraryPermissionsAsync();

  return getPermissionSnapshot();
}

export async function openSystemSettings(): Promise<void> {
  await Linking.openSettings();
}
