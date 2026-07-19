import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, UserRole } from './types';
import { userApi } from './api';
import { bridge } from '../../infrastructure/bridge';

interface UserContextType {
  currentUser: User | null;
  allUsers: User[];
  isLoading: boolean;
  error: string | null;
  refreshUsers: () => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  switchUser: (userId: string) => void;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await userApi.getMe();
      if (response.success && response.data) {
        setCurrentUser(response.data);

        if (response.data.role === UserRole.ADMIN) {
          const allResponse = await userApi.getUsers();
          if (allResponse.success && allResponse.data) {
            setAllUsers(allResponse.data);
          }
        } else {
          setAllUsers([]);
        }
      } else {
        throw new Error(response.error || "Failed to fetch current user");
      }
  } catch (err: unknown) {
    console.error("UserProvider error:", err);
    setError(err instanceof Error ? err.message : "Failed to initialize user context");
  } finally {
    setIsLoading(false);
  }
}, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUserRole = useCallback(async (userId: string, role: UserRole) => {
    try {
      const res = await userApi.updateUserRole(userId, role);
      if (res.success) {
        await fetchUsers();
      } else {
        setError(res.error || "Failed to update user role");
      }
    } catch (err: unknown) {
      console.error("updateUserRole error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred while updating user role");
    }
  }, [fetchUsers]);

  const switchUser = useCallback((userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  }, [allUsers]);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  return (
    <UserContext.Provider value={{
      currentUser,
      allUsers,
      isLoading,
      error,
      refreshUsers: fetchUsers,
      updateUserRole,
      switchUser,
      isAdmin
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
