import type {
  NuclearPluginAPI,
  Stream,
  StreamCandidate,
  StreamingProvider,
} from '@nuclearplayer/plugin-sdk';

import { BASE_URL, STREAMING_PROVIDER_ID } from './config';
import { parseAlbumPage, parseSongPage, parseSearchResults } from './scraper';
import { cacheCdnUrl, getCachedCdnUrl } from './track-url-cache';
import type { FetchFn } from './types';

const SEARCH_RESULT_LIMIT = 5;

const makeSource = (songPageUrl: string) => ({
  provider: STREAMING_PROVIDER_ID,
  id: songPageUrl,
  url: songPageUrl,
});

const makeCandidate = (title: string, songPageUrl: string): StreamCandidate => ({
  id: songPageUrl,
  title,
  failed: false,
  source: makeSource(songPageUrl),
});

const resolveCdnUrl = async (
  fetchFn: typeof fetch,
  songPageUrl: string,
  logger: NuclearPluginAPI['Logger'],
): Promise<string | undefined> => {
  const cached = getCachedCdnUrl(songPageUrl);
  if (cached?.mp3Url) {
    logger.debug(`CDN cache hit for ${songPageUrl}`);
    return cached.mp3Url;
  }

  logger.debug(`Fetching song page: ${songPageUrl}`);
  const result = await parseSongPage(fetchFn, songPageUrl);
  cacheCdnUrl(songPageUrl, result);
  return result.mp3Url;
};

const searchByQuery = async (
  fetchFn: FetchFn,
  query: string,
  title: string,
): Promise<StreamCandidate[]> => {
  const albums = await parseSearchResults(fetchFn, query);

  const firstAlbum = albums[0];
  if (!firstAlbum) {
    return [];
  }

  const detail = await parseAlbumPage(fetchFn, firstAlbum.albumId);
  return detail.tracks
    .filter((albumTrack) =>
      albumTrack.name.toLowerCase().includes(title.toLowerCase()),
    )
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((albumTrack) => makeCandidate(albumTrack.name, albumTrack.songPageUrl));
};

export const createStreamingProvider = (
  api: NuclearPluginAPI,
): StreamingProvider => ({
  id: STREAMING_PROVIDER_ID,
  kind: 'streaming',
  name: 'KHInsider',

  searchForTrack: async (artist, title) => {
    return searchByQuery(api.Http.fetch, [artist, title].filter(Boolean).join(' '), title);
  },

  searchForTrackV2: async (track) => {
    const sourceId = track.source?.id;
    if (sourceId?.startsWith(BASE_URL)) {
      api.Logger.debug(`Direct source hit: ${sourceId}`);
      return [makeCandidate(track.title, sourceId)];
    }

    const artist = track.artists[0]?.name ?? '';
    return searchByQuery(api.Http.fetch, [artist, track.title].filter(Boolean).join(' '), track.title);
  },

  getStreamUrl: async (candidateId: string): Promise<Stream> => {
    const cdnUrl = await resolveCdnUrl(api.Http.fetch, candidateId, api.Logger);

    if (!cdnUrl) {
      throw new Error(`No MP3 download found for ${candidateId}`);
    }

    return {
      url: cdnUrl,
      protocol: 'https',
      mimeType: 'audio/mpeg',
      source: makeSource(candidateId),
    };
  },
});
