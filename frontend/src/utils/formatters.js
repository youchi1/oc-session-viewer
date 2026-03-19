import { format, formatDistanceToNow } from 'date-fns';

export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatCost = (cost) => {
  if (!cost || cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
};

export const formatNumber = (num) => {
  if (!num) return '0';
  return num.toLocaleString();
};

export const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  return format(date, 'MMM d, yyyy HH:mm');
};

export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return format(date, 'HH:mm:ss');
};

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Unknown';
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
};

export const formatDuration = (start, end) => {
  if (!start || !end) return '';
  const ms = new Date(end) - new Date(start);
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export const truncate = (str, len = 100) => {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
};

export const getModelColor = (model) => {
  if (!model) return 'gray';
  const m = model.toLowerCase();
  if (m.includes('opus')) return 'purple';
  if (m.includes('sonnet')) return 'blue';
  if (m.includes('haiku')) return 'green';
  if (m.includes('gpt-4')) return 'indigo';
  if (m.includes('gpt-3')) return 'teal';
  return 'gray';
};

export const getModelShortName = (model) => {
  if (!model) return 'unknown';
  // Extract just the model name, remove provider prefix
  const parts = model.split('/');
  const name = parts[parts.length - 1];
  // Shorten common patterns
  return name
    .replace('claude-', '')
    .replace('anthropic.', '')
    .replace('openai.', '')
    .replace('-20', '')
    .replace(/\d{8}$/, ''); // Remove date stamps
};
