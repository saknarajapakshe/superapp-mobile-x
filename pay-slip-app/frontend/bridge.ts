// Bridge for microapp integration (same pattern used across other frontends)
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    nativebridge?: {
      requestGetLocalData: (params: {
        key: string;
      }) => Promise<{ value: string | null }>;
      requestSaveLocalData: (params: {
        key: string;
        value: string;
      }) => Promise<void>;
    };
  }
}

export const bridge = {
  async getLocalData<T>(key: string, defaultValue: T): Promise<T> {
    if (window.nativebridge?.requestGetLocalData) {
      try {
        const result = await window.nativebridge.requestGetLocalData({ key });
        if (result.value) {
          try {
            return JSON.parse(result.value);
          } catch (error) {
            console.error("Failed to parse stored data:", error);
            return defaultValue;
          }
        }
        return defaultValue;
      } catch (error) {
        console.error("Failed to get data from native bridge:", error);
        return defaultValue;
      }
    }

    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  async saveLocalData<T>(key: string, value: T): Promise<void> {
    if (window.nativebridge?.requestSaveLocalData) {
      try {
        await window.nativebridge.requestSaveLocalData({
          key,
          value: JSON.stringify(value),
        });
        return;
      } catch (error) {
        console.error("Failed to save data via native bridge:", error);
        throw error;
      }
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Failed to save local data:", error);
      throw error;
    }
  },

  isWebView(): boolean {
    return !!window.ReactNativeWebView;
  },
};
