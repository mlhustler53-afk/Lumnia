const LRCLIB_BASE = "https://lrclib.net/api";

interface LrclibTrack {
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export async function fetchLyrics(title: string, artist?: string): Promise<string> {
  const track = title.trim();
  const artistName = artist?.trim();
  if (!track) return "Lyrics not found.";

  try {
    const params = new URLSearchParams({ track_name: track });
    if (artistName) params.set("artist_name", artistName);

    const direct = await fetch(`${LRCLIB_BASE}/get?${params}`, {
      headers: { "User-Agent": "LuminaMusic/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (direct.ok) {
      const data = (await direct.json()) as LrclibTrack;
      const text = data.syncedLyrics || data.plainLyrics;
      if (text?.trim()) return text.trim();
    }

    const query = artistName ? `${track} ${artistName}` : track;
    const search = await fetch(`${LRCLIB_BASE}/search?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "LuminaMusic/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (search.ok) {
      const results = (await search.json()) as LrclibTrack[];
      const match = results.find((r) => r.plainLyrics || r.syncedLyrics);
      const text = match?.syncedLyrics || match?.plainLyrics;
      if (text?.trim()) return text.trim();
    }
  } catch {
    // fall through
  }

  return "Lyrics not found.";
}
