
import { APP_CONFIG } from '../config';
import { mockApi } from './mockApi';
import { httpApi } from './httpApi';

// Factory that exports the correct API client based on configuration.
// To switch to Real backend, set USE_MOCK_API: false in config.ts
export const api = APP_CONFIG.USE_MOCK_API ? mockApi : httpApi;
