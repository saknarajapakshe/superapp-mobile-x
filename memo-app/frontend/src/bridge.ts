import { ReceivedMemo, Group } from "./types";
import { isMemoExpired } from "./lib/memoExpiry";
import { jwtDecode } from "jwt-decode";

import { TTLStorage } from "./lib/storage";
import { getUsers } from "./api";

const MEMOS_STORAGE_KEY = "memo-app:received-memos";
const FAVORITES_STORAGE_KEY = "memo-app:favorites";
const ARCHIVE_STORAGE_KEY = "memo-app:archive";
const DELETED_IDS_STORAGE_KEY = "memo-app:deleted-ids";
const GROUPS_STORAGE_KEY = "memo-app:groups";

// Initialize storage managers
const deletedIdsStorage = new TTLStorage<string>(DELETED_IDS_STORAGE_KEY, 30); // 30 days TTL

/**
 * JWT token claims interface
 * Supports standard OIDC/OAuth2 claims
 */
interface JWTClaims {
  email?: string;
  preferred_username?: string;
  sub?: string;
}

const Bridge = {
  /**
   * Get authentication token from the native app
   * Decodes JWT to extract user email and ID from token claims
   *
   * @returns Object containing token, email, and userId
   * @throws Error if bridge is not available or token is missing
   */
  getToken: async () => {
    if (window.nativebridge?.requestToken) {
      const token = await window.nativebridge.requestToken();

      if (!token) {
        throw new Error("No token received from bridge");
      }

      // Decode JWT to extract email and userId from token claims
      try {
        const claims = jwtDecode<JWTClaims>(token);

        return {
          token: token,
          email: claims.email || claims.preferred_username || claims.sub || "",
        };
      } catch (error) {
        console.error("Failed to decode JWT token:", error);
        // Return token without decoded claims if decoding fails
        return {
          token: token,
          email: "",
        };
      }
    }
    throw new Error("Bridge not available - must be run within the mobile app");
  },

  saveMemo: async (memo: ReceivedMemo) => {
    if (window.nativebridge?.requestSaveLocalData) {
      const existing = await bridge.getSavedMemos();
      const updated = [...existing, memo];

      await window.nativebridge.requestSaveLocalData({
        key: MEMOS_STORAGE_KEY,
        value: JSON.stringify(updated),
      });
      return;
    }
    throw new Error("Bridge not available - must be run within the mobile app");
  },

  getSavedMemos: async (): Promise<ReceivedMemo[]> => {
    if (window.nativebridge?.requestGetLocalData) {
      const result = await window.nativebridge.requestGetLocalData({
        key: MEMOS_STORAGE_KEY,
      });

      if (result.value) {
        try {
          const parsed: ReceivedMemo[] = JSON.parse(result.value);

          // Filter out expired memos. If any were expired, persist the cleaned list.
          const valid = parsed.filter((m) => !isMemoExpired(m));
          if (
            valid.length !== parsed.length &&
            window.nativebridge.requestSaveLocalData
          ) {
            try {
              await window.nativebridge.requestSaveLocalData({
                key: MEMOS_STORAGE_KEY,
                value: JSON.stringify(valid),
              });
            } catch (e) {
              // Best-effort: if saving fails, continue and return the filtered list
              console.warn(
                "Failed to persist cleaned memos after expiry filter:",
                e
              );
            }
          }

          return valid;
        } catch (error) {
          console.error("Failed to parse saved memos:", error);
          return [];
        }
      }
      return [];
    }
    throw new Error("Bridge not available - must be run within the mobile app");
  },

  /**
   * Delete a memo from local storage
   * Uses AsyncStorage through the bridge
   */
  deleteMemo: async (id: string) => {
    if (window.nativebridge?.requestSaveLocalData) {
      const existing = await bridge.getSavedMemos();
      const updated = existing.filter((memo) => memo.id !== id);

      await window.nativebridge.requestSaveLocalData({
        key: MEMOS_STORAGE_KEY,
        value: JSON.stringify(updated),
      });
      return;
    }
    throw new Error("Bridge not available - must be run within the mobile app");
  },

  /**
   * Save favorite memo IDs to local storage
   * Uses AsyncStorage through the bridge, falls back to localStorage for browser testing
   */
  saveFavorites: async (favoriteIds: string[]) => {
    if (window.nativebridge?.requestSaveLocalData) {
      await window.nativebridge.requestSaveLocalData({
        key: FAVORITES_STORAGE_KEY,
        value: JSON.stringify(favoriteIds),
      });
      return;
    }
    // Fallback to localStorage for browser testing
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch (error) {
      console.warn("Failed to save favorites to localStorage:", error);
    }
  },

  /**
   * Get favorite memo IDs from local storage
   * Uses AsyncStorage through the bridge, falls back to localStorage for browser testing
   */
  getFavorites: async (): Promise<string[]> => {
    if (window.nativebridge?.requestGetLocalData) {
      const result = await window.nativebridge.requestGetLocalData({
        key: FAVORITES_STORAGE_KEY,
      });

      if (result.value) {
        try {
          const parsed: string[] = JSON.parse(result.value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.error("Failed to parse saved favorites:", error);
          return [];
        }
      }
      return [];
    }
    // Fallback to localStorage for browser testing
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.warn("Failed to load favorites from localStorage:", error);
    }
    return [];
  },

  /**
   * Save archived memos to local storage
   * Uses AsyncStorage through the bridge, falls back to localStorage for browser testing
   */
  saveArchive: async (archivedMemos: any[]) => {
    if (window.nativebridge?.requestSaveLocalData) {
      await window.nativebridge.requestSaveLocalData({
        key: ARCHIVE_STORAGE_KEY,
        value: JSON.stringify(archivedMemos),
      });
      return;
    }
    // Fallback to localStorage for browser testing
    try {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archivedMemos));
    } catch (error) {
      console.warn("Failed to save archive to localStorage:", error);
    }
  },

  /**
   * Get archived memos from local storage
   * Uses AsyncStorage through the bridge, falls back to localStorage for browser testing
   */
  getArchive: async (): Promise<any[]> => {
    if (window.nativebridge?.requestGetLocalData) {
      const result = await window.nativebridge.requestGetLocalData({
        key: ARCHIVE_STORAGE_KEY,
      });

      if (result.value) {
        try {
          const parsed: any[] = JSON.parse(result.value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.error("Failed to parse saved archive:", error);
          return [];
        }
      }
      return [];
    }
    // Fallback to localStorage for browser testing
    try {
      const stored = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      if (stored) {
        const parsed: any[] = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.warn("Failed to load archive from localStorage:", error);
    }
    return [];
  },

  /**
   * Get list of deleted memo IDs
   * Filters out IDs older than 30 days
   */
  getDeletedMemoIds: async (): Promise<string[]> => {
    return await deletedIdsStorage.get();
  },

  /**
   * Helper to save the full deleted items list (internal use)
   */
  saveDeletedMemoIds: async (items: { id: string; timestamp: number }[]) => {
    const value = JSON.stringify(items);
    if (window.nativebridge?.requestSaveLocalData) {
      await window.nativebridge.requestSaveLocalData({
        key: DELETED_IDS_STORAGE_KEY,
        value,
      });
    } else {
      try {
        localStorage.setItem(DELETED_IDS_STORAGE_KEY, value);
      } catch (e) {
        console.warn("Failed to save deleted IDs to localStorage:", e);
      }
    }
  },

  /**
   * Add an ID to the deleted list
   */
  addDeletedMemoId: async (id: string) => {
    await deletedIdsStorage.add(id);
  },

  /**
   * Get list of active users (emails)
   * Cached for 1 day
   */
  getUsers: async (): Promise<string[]> => {
    // const USERS_STORAGE_KEY = 'memo-app:users';
    // const usersStorage = new TTLStorage<string>(USERS_STORAGE_KEY, 1); // 1 day TTL

    // // Try cache first
    // const cached = await usersStorage.get();
    // if (cached && cached.length > 0) {
    //   return cached;
    // }

    // Fetch from API using the api module (which handles auth)
    try {
      const users = await getUsers();

      // // Cache results
      // for (const user of users) {
      //   await usersStorage.add(user);
      // }

      return users;
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return [];
    }
  },

  showAlert: async (title: string, message: string) => {
    if (window.nativebridge?.requestAlert) {
      return await window.nativebridge.requestAlert({
        title,
        message,
        buttonText: "OK",
      });
    }
    // Fallback to browser alert if bridge not available
    alert(`${title}\n\n${message}`);
  },

  /**
   * Save groups to local storage
   */
  saveGroups: async (groups: Group[]) => {
    if (window.nativebridge?.requestSaveLocalData) {
      try {
        await window.nativebridge.requestSaveLocalData({
          key: GROUPS_STORAGE_KEY,
          value: JSON.stringify(groups),
        });
      } catch (error) {
        console.error("Failed to save groups:", error);
        throw error;
      }
      return;
    }

    // Fallback for browser testing
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
    } catch (error) {
      console.warn("Failed to save groups to localStorage:", error);
    }
  },

  /**
   * Get saved groups from local storage
   */
  getGroups: async (): Promise<Group[]> => {
    if (window.nativebridge?.requestGetLocalData) {
      const result = await window.nativebridge.requestGetLocalData({
        key: GROUPS_STORAGE_KEY,
      });

      if (result.value) {
        try {
          const parsed: Group[] = JSON.parse(result.value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.error("Failed to parse saved groups:", error);
          return [];
        }
      }
      return [];
    }

    // Fallback for browser testing
    try {
      const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (stored) {
        const parsed: Group[] = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.warn("Failed to load groups from localStorage:", error);
    }
    return [];
  },
};

export const bridge = Bridge;
