import React from 'react';
import { RESOURCE_ICONS } from '../constants';

export const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const Icon = RESOURCE_ICONS[name] || RESOURCE_ICONS.DEFAULT;
  return <Icon className={className} />;
};