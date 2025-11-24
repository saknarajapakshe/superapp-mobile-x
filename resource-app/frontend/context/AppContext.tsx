
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Resource, Booking, UserRole, ApiResponse, ResourceUsageStats, BookingStatus, PublicHoliday } from '../types';
import { api } from '../services/api'; // Import from abstraction layer
import { holidayService } from '../services/holidayService';

interface AppContextType {
  currentUser: User | null;
  allUsers: User[];
  resources: Resource[];
  bookings: Booking[];
  stats: ResourceUsageStats[];
  holidays: PublicHoliday[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  switchUser: (userId: string) => void;
  refreshData: () => Promise<void>;
  createBooking: (data: any) => Promise<ApiResponse<Booking>>;
  cancelBooking: (id: string) => Promise<void>;
  dismissBooking: (id: string) => Promise<void>; // For rejecting proposals/clearing rejected status
  addResource: (data: any) => Promise<boolean>;
  updateResource: (data: Resource) => Promise<boolean>;
  deleteResource: (id: string) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  processBooking: (id: string, status: BookingStatus, reason?: string) => Promise<void>;
  rescheduleBooking: (id: string, start: string, end: string) => Promise<ApiResponse<Booking>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<ResourceUsageStats[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    try {
      const currentYear = new Date().getFullYear();
      
      const [usersRes, resRes, bookRes, statsRes, holidaysData] = await Promise.all([
        api.getUsers(),
        api.getResources(),
        api.getBookings(),
        api.getUtilizationStats(),
        holidayService.getHolidays(currentYear)
      ]);

      if (!usersRes.success && usersRes.error?.includes('Network')) {
          throw new Error(usersRes.error);
      }

      if (usersRes.success && usersRes.data) {
        setAllUsers(usersRes.data);
        if (currentUser) {
          const updated = usersRes.data.find(u => u.id === currentUser.id);
          if (updated) setCurrentUser(updated);
        } else if (usersRes.data.length > 0) {
          setCurrentUser(usersRes.data[0]);
        }
      }
      
      if (resRes.success && resRes.data) setResources(resRes.data);
      if (bookRes.success && bookRes.data) setBookings(bookRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      
      // Load holidays for current and next year to handle year-boundaries in calendar
      const nextYearHolidays = await holidayService.getHolidays(currentYear + 1);
      setHolidays([...holidaysData, ...nextYearHolidays]);
      
    } catch (err: any) {
      console.error("Failed to load data", err);
      setError(err.message || "Failed to connect to backend");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const switchUser = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) setCurrentUser(user);
  };

  const createBooking = async (data: any) => {
    const res = await api.createBooking({
      ...data,
      userId: currentUser?.id
    });
    if (res.success) await fetchData(); 
    return res;
  };

  const cancelBooking = async (id: string) => {
    await api.cancelBooking(id);
    await fetchData();
  };

  const dismissBooking = async (id: string) => {
    // Dismissing a rejection or proposal effectively removes it
    await api.cancelBooking(id);
    await fetchData();
  };

  const processBooking = async (id: string, status: BookingStatus, reason?: string) => {
    await api.processBooking(id, status, reason);
    await fetchData();
  };

  const rescheduleBooking = async (id: string, start: string, end: string) => {
    const res = await api.rescheduleBooking(id, start, end);
    if (res.success) await fetchData();
    return res;
  };

  const addResource = async (data: any) => {
    const res = await api.addResource(data);
    if (res.success) {
      await fetchData();
      return true;
    }
    return false;
  };

  const updateResource = async (data: Resource) => {
    const res = await api.updateResource(data);
    if (res.success) {
      await fetchData();
      return true;
    }
    return false;
  };

  const deleteResource = async (id: string) => {
    await api.deleteResource(id);
    await fetchData();
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    await api.updateUserRole(userId, role);
    await fetchData();
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      allUsers,
      resources,
      bookings,
      stats,
      holidays,
      isLoading,
      error,
      switchUser,
      refreshData: fetchData,
      createBooking,
      cancelBooking,
      dismissBooking,
      addResource,
      updateResource,
      deleteResource,
      updateUserRole,
      processBooking,
      rescheduleBooking
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
