
import { Briefcase, Car, Monitor, Wifi, Box, Zap } from 'lucide-react';
import { ResourceType } from './types';

export const RESOURCE_ICONS: Record<string, any> = {
  'MEETING_ROOM': Briefcase,
  'CAR': Car,
  'DEVICE': Monitor,
  'LAPTOP': Monitor,
  'WIFI': Wifi,
  'PARKING': Box,
  'DEFAULT': Zap
};

export const RESOURCE_ICON_OPTIONS = [
  { key: 'MEETING_ROOM', icon: Briefcase, label: 'Room' },
  { key: 'CAR', icon: Car, label: 'Vehicle' },
  { key: 'LAPTOP', icon: Monitor, label: 'Device' },
  { key: 'WIFI', icon: Wifi, label: 'Network' },
  { key: 'PARKING', icon: Box, label: 'Space' },
  { key: 'DEFAULT', icon: Zap, label: 'Other' },
];

export const COLOR_OPTIONS = ['blue', 'emerald', 'violet', 'amber', 'slate', 'red'];

export const TABS = {
  CALENDAR: 'calendar',
  CATALOG: 'catalog',
  ADMIN: 'admin',
  PROFILE: 'profile'
};

export const RESOURCE_TYPE_LABELS = Object.values(ResourceType);
