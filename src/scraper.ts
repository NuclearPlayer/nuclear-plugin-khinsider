import { BASE_URL } from './config';
import type {
  FetchFn,
  KhinsiderAlbumDetail,
  KhinsiderAlbumSearchResult,
  KhinsiderTrack,
  SongPageResult,
} from './types';

const fetchHtml = async (
  fetchFn: FetchFn,
  url: string,
): Promise<Document> => {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`KHInsider returned ${response.status} for ${url}`);
  }
  const html = await response.text();
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
};

const parseTracksFromTable = (doc: Document): KhinsiderTrack[] => {
  const songList = doc.querySelector('#songlist');
  if (!songList) {
    return [];
  }

  const rows = Array.from(songList.querySelectorAll('tr'));
  let fallbackTrackNumber = 0;

  return rows.reduce<KhinsiderTrack[]>((tracks, row) => {
    if (row.id) {
      return tracks;
    }

    const cells = row.querySelectorAll('td.clickable-row');
    if (cells.length === 0) {
      return tracks;
    }

    const link = cells[0].querySelector('a');
    if (!link) {
      return tracks;
    }

    const name = link.textContent?.trim() ?? '';
    const songPageUrl = `${BASE_URL}${link.getAttribute('href')}`;

    const numberCell = row.querySelector('td:nth-child(2)');
    const parsedNumber = parseInt(numberCell?.textContent?.trim() ?? '', 10);
    fallbackTrackNumber++;
    const trackNumber = isNaN(parsedNumber) ? fallbackTrackNumber : parsedNumber;

    const duration = cells[1]?.textContent?.trim() ?? '';

    tracks.push({ name, trackNumber, duration, songPageUrl });
    return tracks;
  }, []);
};

const extractTextAfterLabel = (doc: Document, label: string): string | undefined => {
  const content = doc.querySelector('#pageContent');
  if (!content) {
    return undefined;
  }
  const match = content.innerHTML.match(new RegExp(`${label}:\\s*<b>([^<]+)</b>`));
  return match?.[1]?.trim();
};

export const parseAlbumPage = async (
  fetchFn: FetchFn,
  albumId: string,
): Promise<KhinsiderAlbumDetail> => {
  const albumUrl = `${BASE_URL}/game-soundtracks/album/${albumId}`;
  const doc = await fetchHtml(fetchFn, albumUrl);

  const title = doc.querySelector('#pageContent h2');
  if (!title?.textContent) {
    throw new Error(`No album title found on ${albumUrl}`);
  }

  const publisherLink = doc.querySelector('#pageContent a[href*="/game-soundtracks/publisher/"]');
  if (!publisherLink?.textContent) {
    throw new Error(`No publisher found on ${albumUrl}`);
  }

  const coverImages = doc.querySelectorAll('.albumImage a');
  const coverUrls = Array.from(coverImages)
    .map((link) => link.getAttribute('href'))
    .filter((href): href is string => href !== null);

  const year = extractTextAfterLabel(doc, 'Year');

  const platformLinks = doc.querySelectorAll('#pageContent p a[href*="/game-soundtracks/"]');
  const platforms = Array.from(platformLinks)
    .filter((link) => {
      const href = link.getAttribute('href') ?? '';
      return !href.includes('/album/') && !href.includes('/ost') && !href.includes('/gamerips');
    })
    .map((link) => link.textContent?.trim() ?? '');

  const tracks = parseTracksFromTable(doc);

  return {
    albumId,
    name: title.textContent.trim(),
    publisher: publisherLink.textContent.trim(),
    coverUrls,
    year,
    platforms,
    tracks,
  };
};

export const parseSongPage = async (
  fetchFn: FetchFn,
  songPageUrl: string,
): Promise<SongPageResult> => {
  const doc = await fetchHtml(fetchFn, songPageUrl);

  return Array.from(doc.querySelectorAll('.songDownloadLink')).reduce<SongPageResult>(
    (result, span) => {
      const href = span.closest('a')?.getAttribute('href');
      if (!href) {
        return result;
      }

      if (href.endsWith('.mp3')) {
        return { ...result, mp3Url: href };
      }
      if (href.endsWith('.flac')) {
        return { ...result, flacUrl: href };
      }
      return result;
    },
    {},
  );
};

export const parseSearchResults = async (
  fetchFn: FetchFn,
  query: string,
): Promise<KhinsiderAlbumSearchResult[]> => {
  const doc = await fetchHtml(
    fetchFn,
    `${BASE_URL}/search?search=${encodeURIComponent(query)}`,
  );

  const table = doc.querySelector('table.albumList');
  if (!table) {
    return [];
  }

  return Array.from(table.querySelectorAll('tr')).reduce<KhinsiderAlbumSearchResult[]>(
    (results, row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) {
        return results;
      }

      const albumLink = cells[1].querySelector('a');
      if (!albumLink) {
        return results;
      }

      const href = albumLink.getAttribute('href') ?? '';
      const albumId = href.replace('/game-soundtracks/album/', '');
      const name = albumLink.textContent?.trim() ?? '';

      const thumbnail = cells[0].querySelector('img');
      const thumbnailUrl = thumbnail?.getAttribute('src') ?? undefined;

      const platformAnchors = cells[2].querySelectorAll('a');
      const platforms = Array.from(platformAnchors).map(
        (link) => link.textContent?.trim() ?? '',
      );

      const type = cells[3].textContent?.trim() ?? '';
      const year = cells[4]?.textContent?.trim() ?? '';

      results.push({ albumId, name, thumbnailUrl, platforms, type, year });
      return results;
    },
    [],
  );
};
