import { PublicHoliday } from "../types";
import { client as api } from "../api/client";
import { bridge } from "../bridge";

const CACHE_KEY = "holidays_cache";
const CACHE_DURATION_DAYS = 7; // Refresh every 7 days

interface CachedHolidays {
  data: PublicHoliday[];
  timestamp: number;
}

export const holidayService = {
  async getHolidays(year: number): Promise<PublicHoliday[]> {
    try {
      // 1. Try to load from cache (bridge storage)
      const cached = await bridge.getLocalData<CachedHolidays>(CACHE_KEY, null);

      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        const maxAge = CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000;

        if (age < maxAge) {
          return cached.data.filter((h) => h.date.startsWith(year.toString()));
        }
      }

      // 2. Fetch from backend API
      const response = await api.getHolidays();

      if (!response.success || !response.data) {
        console.warn(
          "Failed to fetch holidays from API, using cached data if available"
        );
        return (
          cached?.data.filter((h) => h.date.startsWith(year.toString())) || []
        );
      }

      const holidays = response.data as PublicHoliday[];

      // 3. Cache to bridge storage
      await bridge.saveLocalData(CACHE_KEY, {
        data: holidays,
        timestamp: Date.now(),
      });

      // 4. Return filtered by year
      return holidays.filter((h) => h.date.startsWith(year.toString()));
    } catch (error) {
      console.error("Error fetching holidays:", error);

      // Fallback to cached data even if expired
      const cached = await bridge.getLocalData<CachedHolidays>(CACHE_KEY, null);
      if (cached?.data) {
        return cached.data.filter((h) => h.date.startsWith(year.toString()));
      }

      return [];
    }
  },
};
