import type { SongPageResult } from './types';

const cdnUrls = new Map<string, SongPageResult>();

export const cacheCdnUrl = (
  songPageUrl: string,
  result: SongPageResult,
): void => {
  cdnUrls.set(songPageUrl, result);
};

export const getCachedCdnUrl = (
  songPageUrl: string,
): SongPageResult | undefined => cdnUrls.get(songPageUrl);

export const clearCdnCache = (): void => {
  cdnUrls.clear();
};
