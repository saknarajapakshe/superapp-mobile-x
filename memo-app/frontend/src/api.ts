import axios from 'axios';
import { Memo } from './types';
import { bridge } from './bridge';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://192.168.1.100:8080/api';

const api = axios.create({
  baseURL: API_URL + '/api',
});

api.interceptors.request.use(async (config) => {
  try {
    const tokenData = await bridge.getToken();
    if (tokenData.token) {
      config.headers['Authorization'] = `Bearer ${tokenData.token}`;
    }
    // // Fallback: Add email as header for development/testing (when JWT not available)
    // if (tokenData.email) {
    //   config.headers['X-User-Email'] = tokenData.email;
    // }
  } catch (error) {
    console.error('Failed to get authentication token:', error);
    // Continue request without auth - backend will reject if auth is required
  }
  return config;
});

/**
 * Send a new memo to a recipient or broadcast to all users
 */
export const sendMemo = async (
  to: string, 
  subject: string, 
  message: string, 
  isBroadcast: boolean = false, 
  ttlDays?: number
) => {
  const response = await api.post('/memos', { 
    to: isBroadcast ? 'broadcast' : to, 
    subject, 
    message,
    isBroadcast,
    ttlDays
  });
  return response.data;
};

/**
 * Retrieve all memos sent by the current user
 */
export const getSentMemos = async (limit?: number, offset?: number) => {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  
  const response = await api.get<Memo[]>(`/memos/sent?${params.toString()}`);
  return response.data;
};

/**
 * Retrieve all memos received by the current user
 * Includes both direct messages and broadcast messages
 */
export const getReceivedMemos = async (limit?: number, offset?: number) => {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  
  const response = await api.get<Memo[]>(`/memos/received?${params.toString()}`);
  return response.data;
};

/**
 * Update the delivery status of a memo
 */
export const updateMemoStatus = async (id: string, status: 'sent' | 'delivered') => {
  await api.put(`/memos/${id}/status`, { status });
};

/**
 * Delete a sent memo from the server
 */
export const deleteMemo = async (id: string) => {
  await api.delete(`/memos/${id}`);
};
