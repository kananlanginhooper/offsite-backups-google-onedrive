import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { ProviderId } from '../core/models';

/** Bytes as KB/MB/GB/TB (binary units, the way the providers report space). */
export function bytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function count(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString();
}

export function when(iso: string | null | undefined): string {
  return iso ? format(parseISO(iso), 'MMM d, yyyy HH:mm') : '—';
}

export function ago(iso: string | null | undefined): string {
  return iso ? `${formatDistanceToNowStrict(parseISO(iso))} ago` : 'never';
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  gdrive: 'Google Drive',
  gphotos: 'Google Photos',
  onedrive: 'OneDrive',
};

/** One fixed color per provider, used by every chart and pill. */
export const PROVIDER_COLOR: Record<ProviderId, string> = {
  gdrive: '#2f6fdb',
  gphotos: '#1f8a4c',
  onedrive: '#b97a00',
};
