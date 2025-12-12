import { PublicHoliday } from '../types';
import { bridge } from '../bridge';
import { APP_CONFIG } from '../config';

// Use CORS proxy to fetch the ICS file
const ICS_URL = APP_CONFIG.HOLIDAYS_URL;
const CACHE_KEY = 'holidays_cache';
const CACHE_DURATION_DAYS = 7;

interface CachedHolidays {
  data: PublicHoliday[];
  timestamp: number;
}

// Parse ICS file content
function parseICS(icsContent: string): PublicHoliday[] {
  const holidays: PublicHoliday[] = [];
  const lines = icsContent.split('\n');

  let currentDate = '';
  let currentSummary = '';
  let currentDescription = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('DTSTART;VALUE=DATE:')) {
      const dateStr = trimmedLine.replace('DTSTART;VALUE=DATE:', '');
      // Convert YYYYMMDD to YYYY-MM-DD
      if (dateStr.length >= 8) {
        currentDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      }
    }

    if (trimmedLine.startsWith('SUMMARY;LANGUAGE=en-us:')) {
      currentSummary = trimmedLine.replace('SUMMARY;LANGUAGE=en-us:', '');
    }

    if (trimmedLine.startsWith('DESCRIPTION:')) {
      let desc = trimmedLine.replace('DESCRIPTION:', '');
      // Clean up description
      desc = desc.replace(/\\n/g, ' ').trim();
      // Remove footer text
      const footerIndex = desc.indexOf('Information provided by');
      if (footerIndex !== -1) {
        desc = desc.slice(0, footerIndex);
      }
      currentDescription = desc.trim();
    }

    if (trimmedLine === 'END:VEVENT' && currentDate && currentSummary) {
      holidays.push({
        date: currentDate,
        localName: currentSummary,
        name: currentSummary,
        description: currentDescription,
        countryCode: 'LK',
        fixed: false,
        global: true,
        types: ['Public'],
      });
      currentDate = '';
      currentSummary = '';
      currentDescription = '';
    }
  }

  return holidays;
}

export const holidayService = {
  async getHolidays(year: number): Promise<PublicHoliday[]> {
    try {
      // 1. Try to load from cache
      const cached = await bridge.getLocalData<CachedHolidays | null>(CACHE_KEY, null);

      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        const maxAge = CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000;

        if (age < maxAge) {
          console.log('Using cached holidays');
          return cached.data.filter((h) => h.date.startsWith(year.toString()));
        }
      }

      // 2. Fetch ICS file directly from officeholidays.com
      console.log('Fetching holidays from officeholidays.com...');
      const response = await fetch(ICS_URL);

      if (!response.ok) {
        console.warn('Failed to fetch holidays, using cached data if available');
        return cached?.data.filter((h) => h.date.startsWith(year.toString())) || [];
      }

      const icsContent = await response.text();
      const holidays = parseICS(icsContent);

      // 3. Cache to storage
      await bridge.saveLocalData(CACHE_KEY, {
        data: holidays,
        timestamp: Date.now(),
      });

      console.log(`Fetched and cached ${holidays.length} holidays`);

      // 4. Return filtered by year
      return holidays.filter((h) => h.date.startsWith(year.toString()));
    } catch (error) {
      console.error('Error fetching holidays:', error);

      // Fallback to cached data even if expired
      const cached = await bridge.getLocalData<CachedHolidays | null>(CACHE_KEY, null);
      if (cached?.data) {
        console.log('Using expired cache due to error');
        return cached.data.filter((h) => h.date.startsWith(year.toString()));
      }

      return [];
    }
  },
};
