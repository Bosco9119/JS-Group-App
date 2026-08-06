// @ts-check
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Expo Go SDK 57 can SIGSEGV after bundling when JS worklets 0.10.1
 * initializes against older native worklets in Expo Go.
 * package.json pins reanimated/worklets to 4.5.0 / 0.10.0 for that reason.
 *
 * Last-resort local debugging only: EXPO_GO_WORKLETS_STUB=1
 * Do NOT set that for EAS production builds.
 */
const config = getDefaultConfig(__dirname);

if (process.env.EXPO_GO_WORKLETS_STUB === '1') {
  const baseResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-worklets') {
      return { type: 'empty' };
    }
    if (baseResolveRequest) {
      return baseResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
