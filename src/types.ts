export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type KhinsiderTrack = {
  name: string;
  trackNumber: number;
  duration: string;
  songPageUrl: string;
};

export type SongPageResult = {
  mp3Url?: string;
  flacUrl?: string;
};

export type KhinsiderAlbumSearchResult = {
  albumId: string;
  name: string;
  thumbnailUrl?: string;
  platforms: string[];
  type: string;
  year: string;
};

export type KhinsiderAlbumDetail = {
  albumId: string;
  name: string;
  publisher: string;
  coverUrls: string[];
  year?: string;
  platforms: string[];
  tracks: KhinsiderTrack[];
};
