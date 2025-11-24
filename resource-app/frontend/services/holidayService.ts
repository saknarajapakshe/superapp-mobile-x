
import { PublicHoliday } from '../types';
import { APP_CONFIG } from '../config';

// Simple in-memory cache to avoid re-fetching on every navigation
let holidayCache: Record<string, PublicHoliday[]> = {};

export const holidayService = {
  async getHolidays(year: number): Promise<PublicHoliday[]> {
    const countryCode = APP_CONFIG.HOLIDAY_COUNTRY;
    const cacheKey = `${countryCode}-${year}`;

    if (holidayCache[cacheKey]) {
      return holidayCache[cacheKey];
    }

    try {
      // Using Nager.Date Public API
      const response = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/${countryCode}`);
      
      if (!response.ok) {
        console.warn(`Failed to fetch holidays for ${countryCode}`);
        return [];
      }

      const data: PublicHoliday[] = await response.json();
      holidayCache[cacheKey] = data;
      return data;
    } catch (error) {
      console.error("Error fetching holidays:", error);
      return [];
    }
  }
};
