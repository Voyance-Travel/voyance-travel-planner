import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.bbef7015a2df45af893d7d36d59f8dcd',
  appName: 'voyance-travel-planner',
  webDir: 'dist',
  server: {
    url: 'https://bbef7015-a2df-45af-893d-7d36d59f8dcd.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  ios: {
    appendUserAgent: 'VoyanceApp'
  },
  android: {
    appendUserAgent: 'VoyanceApp'
  }
};

export default config;
