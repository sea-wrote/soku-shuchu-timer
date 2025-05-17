import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.sokushuchu',
  appName: '即集中時計',
  webDir: 'out',
  // 追加設定
  ios: {
    // iOSの設定（必要に応じて）
    scheme: 'App' // iOSスキーム名の設定 
  },
  server: {
    // デバッグ用（開発時のみ）
    cleartext: true
  }
};

export default config;
