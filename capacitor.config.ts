import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.SM.app',
  appName: 'SM - System Management',
  webDir: 'dist',
  android: {
    backgroundColor: '#26A69A'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#26A69A',
      style: 'LIGHT'
    }
  }
};

// Développé par ING Amos JOSEPH

export default config;
