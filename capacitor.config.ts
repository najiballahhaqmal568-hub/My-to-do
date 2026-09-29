import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mytodo.personal',
  appName: 'کارهای من',
  webDir: 'dist',
  android: {
    backgroundColor: '#f1f4ee',
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    LocalNotifications: { smallIcon: 'ic_stat_icon', iconColor: '#1E6A51' },
  },
};

export default config;
