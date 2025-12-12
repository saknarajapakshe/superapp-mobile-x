import { UserEvent } from '../types';
import { bridge } from '../bridge';

const EVENTS_KEY = 'user_events';

export const eventService = {
  async getEvents(): Promise<UserEvent[]> {
    try {
      const events = await bridge.getLocalData<UserEvent[]>(EVENTS_KEY, []);
      return events;
    } catch (error) {
      console.error('Error loading events:', error);
      return [];
    }
  },

  async addEvent(event: Omit<UserEvent, 'id' | 'createdAt'>): Promise<UserEvent> {
    try {
      const events = await this.getEvents();
      const newEvent: UserEvent = {
        ...event,
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      };
      events.push(newEvent);
      await bridge.saveLocalData(EVENTS_KEY, events);
      return newEvent;
    } catch (error) {
      console.error('Error adding event:', error);
      throw error;
    }
  },

  async updateEvent(id: string, updates: Partial<UserEvent>): Promise<void> {
    try {
      const events = await this.getEvents();
      const index = events.findIndex((e) => e.id === id);
      if (index !== -1) {
        events[index] = { ...events[index], ...updates };
        await bridge.saveLocalData(EVENTS_KEY, events);
      }
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  },

  async deleteEvent(id: string): Promise<void> {
    try {
      const events = await this.getEvents();
      const filtered = events.filter((e) => e.id !== id);
      await bridge.saveLocalData(EVENTS_KEY, filtered);
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  },

  getEventsForDate(events: UserEvent[], date: string): UserEvent[] {
    return events.filter((e) => e.date === date);
  },
};
