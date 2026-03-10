import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rmpl.crm',
  appName: 'rmpl',
  webDir: 'dist',
  server: {
    url: 'https://green-sky-073df2c10.3.azurestaticapps.net',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
