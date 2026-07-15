import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export type PermissionSnapshot = {
  locationGranted: boolean;
  notificationGranted: boolean;
  cameraGranted: boolean;
  mediaLibraryGranted: boolean;
  allGranted: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getPermissionSnapshot(): Promise<PermissionSnapshot> {
  const [location, notifications, camera, mediaLibrary] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Notifications.getPermissionsAsync(),
    ImagePicker.getCameraPermissionsAsync(),
    ImagePicker.getMediaLibraryPermissionsAsync(),
  ]);

  const locationGranted = location.granted;
  const notificationGranted =
    notifications.granted ||
    notifications.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
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
  await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  await ImagePicker.requestCameraPermissionsAsync();
  await ImagePicker.requestMediaLibraryPermissionsAsync();

  return getPermissionSnapshot();
}

export async function openSystemSettings(): Promise<void> {
  await Linking.openSettings();
}
