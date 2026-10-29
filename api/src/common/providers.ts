export const PROVIDERS = ['gdrive', 'gphotos', 'onedrive'] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  gdrive: 'Google Drive',
  gphotos: 'Google Photos',
  onedrive: 'OneDrive',
};
