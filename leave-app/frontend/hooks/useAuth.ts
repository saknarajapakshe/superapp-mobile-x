import { useState, useEffect } from "react";
import { UserInfo } from "../types";
import { useBridge } from "./useBridge";
import { api } from "../api/client";

export const useAuth = () => {
  const { token, isReady } = useBridge();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateUser = (updates: Partial<UserInfo>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };
  useEffect(() => {
    if (!isReady || !token) return;

    const fetchUser = async () => {
      try {
        const userData = await api.getMe(token);
        setUser(userData);
      } catch (err) {
        setError("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token, isReady]);

  return {
    user,
    token,
    isAdmin: user?.role === "admin",
    loading: loading || !isReady,
    error,
    updateUser,
  };
};
