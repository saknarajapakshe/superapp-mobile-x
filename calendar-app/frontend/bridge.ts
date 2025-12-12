// Bridge for microapp integration
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

export const bridge = {

  async getLocalData<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  async saveLocalData<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save local data:', error);
    }
  },

  isWebView(): boolean {
    return !!window.ReactNativeWebView;
  },
};
