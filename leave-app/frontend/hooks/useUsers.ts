import { useState, useEffect, useCallback } from "react";
import { UserInfo, Allowances } from "../types";
import { api } from "../api/client";

interface UseUsersProps {
  token: string | null;
  isAdmin: boolean;
  onGlobalAllowancesUpdate?: (allowances: Allowances) => void;
}

export const useUsers = ({
  token,
  isAdmin,
  onGlobalAllowancesUpdate,
}: UseUsersProps) => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const data = await api.getUsers(token);
      setUsers(data);
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateGlobalAllowances = async (
    allowances: Allowances
  ): Promise<void> => {
    if (!token) return;
    try {
      await api.updateGlobalAllowances(token, allowances);
      setUsers((prev) => prev.map((u) => ({ ...u, allowances })));
      if (onGlobalAllowancesUpdate) {
        onGlobalAllowancesUpdate(allowances);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateUserRole = async (
    userId: string,
    role: "admin" | "user"
  ): Promise<void> => {
    if (!token) return;
    try {
      // Optimistic UI update: update role locally first so UI doesn't go blank
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      );
      // Call backend; if backend returns updated user, we can use it to sync exact user fields
      const updatedUser = await api.updateUserRole(token, userId, role);
      if (
        updatedUser &&
        typeof updatedUser === "object" &&
        "id" in updatedUser
      ) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? updatedUser : u))
        );
      }
    } catch (e) {
      console.error("Failed to update user role", e);
      // Roll back optimistic update on error by refetching users from the server
      try {
        const refreshed = await api.getUsers(token);
        setUsers(refreshed);
      } catch (refreshErr) {
        console.error(
          "Failed to refresh users after role update failure",
          refreshErr
        );
      }
      throw e;
    }
  };

  return {
    users,
    loading,
    updateGlobalAllowances,
    updateUserRole,
    refreshUsers: fetchUsers,
  };
};
