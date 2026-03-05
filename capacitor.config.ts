import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.52c5577d74ea4af5b66b95f1e91101e1',
  appName: 'rmpl',
  webDir: 'dist',
  server: {
    url: 'https://52c5577d-74ea-4af5-b66b-95f1e91101e1.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
