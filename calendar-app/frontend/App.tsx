import React, { useEffect, useState } from 'react';
import { CalendarView } from './views/CalendarView';
import { holidayService } from './services/holidayService';
import { eventService } from './services/eventService';
import { PublicHoliday, UserEvent } from './types';
import './styles.css';

const App: React.FC = () => {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const [holidaysData, eventsData] = await Promise.all([
        holidayService.getHolidays(currentYear),
        eventService.getEvents(),
      ]);
      setHolidays(holidaysData);
      setEvents(eventsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddEvent = async (eventData: Omit<UserEvent, 'id' | 'createdAt'>) => {
    try {
      const newEvent = await eventService.addEvent(eventData);
      setEvents((prev) => [...prev, newEvent]);
    } catch (err) {
      console.error('Failed to add event:', err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await eventService.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 text-sm">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center px-4">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Error Loading Calendar</h2>
          <p className="text-slate-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <CalendarView
      holidays={holidays}
      events={events}
      onAddEvent={handleAddEvent}
      onDeleteEvent={handleDeleteEvent}
    />
  );
};

export default App;