import type {
  Album,
  AlbumRef,
  ArtworkSet,
  MetadataProvider,
  NuclearPluginAPI,
  SearchParams,
  TrackRef,
} from '@nuclearplayer/plugin-sdk';

import { METADATA_PROVIDER_ID, STREAMING_PROVIDER_ID } from './config';
import { parseAlbumPage, parseSearchResults } from './scraper';
import type { KhinsiderAlbumDetail, KhinsiderAlbumSearchResult } from './types';

const DEFAULT_SEARCH_LIMIT = 20;

const makeSource = (id: string) => ({
  provider: METADATA_PROVIDER_ID,
  id,
});

const makeArtwork = (urls: string[]): ArtworkSet | undefined => {
  if (urls.length === 0) {
    return undefined;
  }
  return {
    items: urls.slice(0, 1).map((url) => ({
      url,
      purpose: 'cover' as const,
    })),
  };
};

const upscaleThumbnail = (thumbnailUrl: string): string =>
  thumbnailUrl.replace('/thumbs_small/', '/thumbs_large/');

const makeArtworkFromThumbnail = (
  thumbnailUrl?: string,
): ArtworkSet | undefined => {
  if (!thumbnailUrl) {
    return undefined;
  }
  return {
    items: [{ url: upscaleThumbnail(thumbnailUrl), purpose: 'thumbnail' as const }],
  };
};

const mapSearchResultToAlbumRef = (
  result: KhinsiderAlbumSearchResult,
): AlbumRef => ({
  title: result.name,
  artwork: makeArtworkFromThumbnail(result.thumbnailUrl),
  source: makeSource(result.albumId),
});

const mapAlbumDetailToAlbum = (detail: KhinsiderAlbumDetail): Album => {
  const albumArtist = {
    name: detail.publisher,
    roles: [] as string[],
    source: makeSource(detail.albumId),
  };

  return {
    title: detail.name,
    artists: [albumArtist],
    artwork: makeArtwork(detail.coverUrls),
    releaseDate: detail.year
      ? { precision: 'year', dateIso: detail.year }
      : undefined,
    genres: detail.platforms.length > 0 ? detail.platforms : undefined,
    tracks: detail.tracks.map(
      (track): TrackRef => ({
        title: track.name,
        artists: [albumArtist],
        artwork: makeArtwork(detail.coverUrls),
        source: makeSource(track.songPageUrl),
      }),
    ),
    source: makeSource(detail.albumId),
  };
};

export const createMetadataProvider = (
  api: NuclearPluginAPI,
): MetadataProvider => ({
  id: METADATA_PROVIDER_ID,
  kind: 'metadata',
  name: 'KHInsider',
  streamingProviderId: STREAMING_PROVIDER_ID,
  searchCapabilities: ['albums'],
  albumMetadataCapabilities: ['albumDetails'],

  searchAlbums: async (
    params: Omit<SearchParams, 'types'>,
  ): Promise<AlbumRef[]> => {
    const results = await parseSearchResults(api.Http.fetch, params.query);
    return results
      .slice(0, params.limit ?? DEFAULT_SEARCH_LIMIT)
      .map(mapSearchResultToAlbumRef);
  },

  fetchAlbumDetails: async (albumId: string): Promise<Album> => {
    const detail = await parseAlbumPage(api.Http.fetch, albumId);
    return mapAlbumDetailToAlbum(detail);
  },
});
