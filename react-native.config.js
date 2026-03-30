// Prevent certain modules from linking on iOS/macOS
module.exports = {
  dependencies: {
    'expo-libvlc-player': {
      platforms: {
        ios: null,
      },
    },
    'react-native-vlc-media-player': {
      platforms: {
        ios: null,
      },
    },
    'react-native-google-cast': {
      platforms: {
        ios: null, // Google Cast SDK doesn't support Mac Catalyst
      },
    },
    'expo-live-activity': {
      platforms: {
        ios: null, // ActivityKit is unavailable on Mac Catalyst
      },
    },
    '@shopify/react-native-skia': {
      platforms: {
        ios: null, // Skia library not available for Mac Catalyst
      },
    },
    '@adrianso/react-native-device-brightness': {
      platforms: {
        ios: null, // Brightness control not applicable on macOS
      },
    },
  },
};


