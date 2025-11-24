
export const APP_CONFIG = {
  API_LATENCY: 400,
  VISUAL_START_HOUR: 8,
  VISUAL_END_HOUR: 20,
  DEFAULT_DURATION_MINUTES: 60,
  MIN_DURATION_MINUTES: 15,
  DEFAULT_LEAD_TIME_HOURS: 1,
  DATE_FORMAT: 'yyyy-MM-dd',
  TIME_FORMAT: 'HH:mm',
  
  // Holiday Config
  HOLIDAY_COUNTRY: '101', // 'LK' for Sri Lanka, 'US' for USA, etc.
  
  // API Config
  USE_MOCK_API: true, // Change to false to use real Node.js backend
  API_BASE_URL: 'http://127.0.0.1:3001/api'
};
