/**
 * Web stub — native OS permission prompts are unavailable.
 * Treat permissions as granted so local web preview can run.
 */
export type PermissionSnapshot = {
  locationGranted: boolean;
  notificationGranted: boolean;
  cameraGranted: boolean;
  mediaLibraryGranted: boolean;
  allGranted: boolean;
};

export async function getPermissionSnapshot(): Promise<PermissionSnapshot> {
  return {
    locationGranted: true,
    notificationGranted: true,
    cameraGranted: true,
    mediaLibraryGranted: true,
    allGranted: true,
  };
}

export async function requestRequiredPermissions(): Promise<PermissionSnapshot> {
  return getPermissionSnapshot();
}

export async function openSystemSettings(): Promise<void> {
  // No system settings deep-link on web preview.
}
