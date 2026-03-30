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
  },
};


