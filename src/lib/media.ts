import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

import i18n from '@/i18n';
import type { LocalImage } from '@/lib/types';

function toLocalImage(asset: ImagePicker.ImagePickerAsset, prefix: string): LocalImage {
  let mimeType = (asset.mimeType ?? 'image/jpeg').toLowerCase();
  if (mimeType === 'image/jpg' || mimeType === 'image/pjpeg') {
    mimeType = 'image/jpeg';
  }

  const extensionFromMime =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/gif'
          ? 'gif'
          : 'jpg';

  const rawName = asset.fileName?.trim();
  const name =
    rawName && /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(rawName)
      ? rawName
      : `${prefix}-${Date.now()}.${extensionFromMime}`;

  return {
    uri: asset.uri,
    name,
    mimeType,
  };
}

async function ensureCameraAndMediaPermissions(): Promise<{ camera: boolean; media: boolean }> {
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const mediaGranted = media.granted || media.accessPrivileges === 'limited';

  return {
    camera: camera.granted,
    media: mediaGranted,
  };
}

function promptOpenSettings(message: string) {
  if (Platform.OS === 'web') {
    throw new Error(message);
  }

  Alert.alert(i18n.t('permissions.cameraMediaDeniedTitle'), message, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    {
      text: i18n.t('common.openSettings'),
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

export async function pickProofPhotos(): Promise<LocalImage[]> {
  const { camera, media } = await ensureCameraAndMediaPermissions();

  if (!camera || !media) {
    const message = i18n.t('permissions.cameraMediaDeniedBody');
    promptOpenSettings(message);
    throw new Error(message);
  }

  const cameraResult = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });

  if (!cameraResult.canceled && cameraResult.assets?.length) {
    return cameraResult.assets.map((asset, index) => toLocalImage(asset, `proof-${index}`));
  }

  const libraryResult = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsMultipleSelection: true,
    selectionLimit: 10,
  });

  if (libraryResult.canceled || !libraryResult.assets?.length) {
    return [];
  }

  return libraryResult.assets.map((asset, index) => toLocalImage(asset, `proof-${index}`));
}

export async function getOptionalCoords(): Promise<{ latitude: number; longitude: number } | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
