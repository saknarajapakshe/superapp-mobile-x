import { useState, useMemo, useCallback } from 'react';
import { endOfMonth, eachDayOfInterval, getDay, format } from 'date-fns';
import { PublicHoliday } from '../types';

interface UseCalendarProps {
  holidays: PublicHoliday[];
}

export const useCalendar = ({ holidays }: UseCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  // Calendar Grid Calculation
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayIndex = getDay(monthStart);
  const paddingDays = Array(startDayIndex).fill(null);

  // Get Holiday for specific date
  const getHolidayForDate = useCallback(
    (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return holidays.find((h) => h.date === dateStr);
    },
    [holidays]
  );

  const selectedDayHoliday = useMemo(
    () => getHolidayForDate(selectedDate),
    [getHolidayForDate, selectedDate]
  );

  return {
    currentDate,
    selectedDate,
    setSelectedDate,
    changeMonth,
    goToToday,
    daysInMonth,
    paddingDays,
    selectedDayHoliday,
    getHolidayForDate,
  };
};
