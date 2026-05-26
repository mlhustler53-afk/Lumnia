import type { RecommendationSection, Song } from "@/types";
import {
  getTopArtists,
  getRecentlyPlayed,
  getFavoriteSongsFromHistory,
  hasListeningHistory,
} from "@/lib/listeningHistory";

const DISCOVERY_SECTIONS = [
  {
    id: "chill",
    title: "Chill & Focus",
    subtitle: "Lo-fi and ambient tracks for deep work",
    query: "lofi hip hop beats to study 2024",
    accent: "from-violet-600 to-purple-800",
  },
  {
    id: "night",
    title: "Late Night Drive",
    subtitle: "Moody synths and slow-burn anthems",
    query: "night drive synthwave playlist",
    accent: "from-indigo-600 to-blue-900",
  },
  {
    id: "hits",
    title: "Fresh Hits",
    subtitle: "What's trending right now",
    query: "top hits 2025 official music",
    accent: "from-fuchsia-600 to-pink-800",
  },
  {
    id: "discover",
    title: "Discover Something New",
    subtitle: "Hidden gems and indie favorites",
    query: "indie pop underrated songs",
    accent: "from-emerald-600 to-teal-800",
  },
] as const;

async function searchSongs(apiBase: string, query: string): Promise<Song[]> {
  try {
    const res = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(query)}`);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function fetchDiscoverySection(
  apiBase: string,
  config: (typeof DISCOVERY_SECTIONS)[number]
): Promise<RecommendationSection> {
  const songs = await searchSongs(apiBase, config.query);
  return { ...config, songs };
}

async function buildMadeForYouSection(apiBase: string): Promise<RecommendationSection | null> {
  const topArtists = getTopArtists(3);
  if (topArtists.length === 0) return null;

  const queries = topArtists.map((a) => `${a.artist} best songs`);
  const results = await Promise.all(queries.map((q) => searchSongs(apiBase, q)));
  const songs = dedupeSongs(results.flat()).slice(0, 12);

  if (songs.length === 0) return null;

  return {
    id: "made-for-you",
    title: "Made For You",
    subtitle: `Based on ${topArtists.map((a) => a.artist).join(", ")}`,
    query: queries[0],
    accent: "from-violet-500 to-fuchsia-600",
    songs,
  };
}

function dedupeSongs(songs: Song[]): Song[] {
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}

function sectionFromSongs(
  id: string,
  title: string,
  subtitle: string,
  accent: string,
  songs: Song[],
  query = ""
): RecommendationSection {
  return { id, title, subtitle, query, accent, songs };
}

export async function fetchHomeRecommendations(apiBase: string): Promise<RecommendationSection[]> {
  const personalized: RecommendationSection[] = [];
  const hasHistory = hasListeningHistory();

  if (hasHistory) {
    const recent = getRecentlyPlayed(12);
    if (recent.length > 0) {
      personalized.push(
        sectionFromSongs(
          "recently-played",
          "Recently Played",
          "Pick up where you left off",
          "from-slate-500 to-zinc-700",
          recent
        )
      );
    }

    const favorites = getFavoriteSongsFromHistory(12);
    if (favorites.length > 0) {
      personalized.push(
        sectionFromSongs(
          "your-favorites",
          "Your Favorites",
          "Tracks you've spent the most time with",
          "from-amber-500 to-orange-700",
          favorites
        )
      );
    }

    const madeForYou = await buildMadeForYouSection(apiBase);
    if (madeForYou) personalized.unshift(madeForYou);

    const topArtists = getTopArtists(5);
    if (topArtists.length > 0) {
      const artistQueries = topArtists.slice(0, 3).map((a) => `${a.artist} popular songs`);
      const artistResults = await Promise.all(artistQueries.map((q) => searchSongs(apiBase, q)));
      const artistSongs = dedupeSongs(artistResults.flat()).slice(0, 12);
      if (artistSongs.length > 0) {
        personalized.push(
          sectionFromSongs(
            "recommended-artists",
            "Recommended Artists",
            topArtists.map((a) => a.artist).join(" · "),
            "from-cyan-500 to-blue-700",
            artistSongs
          )
        );
      }
    }
  }

  const discovery = await Promise.all(
    DISCOVERY_SECTIONS.map((c) => fetchDiscoverySection(apiBase, c))
  );

  const seen = new Set<string>();
  const allSections = [...personalized, ...discovery];

  return allSections.map((section) => ({
    ...section,
    songs: section.songs.filter((song) => {
      if (seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    }),
  }));
}

export function buildHomeMix(sections: RecommendationSection[]): Song[] {
  const prioritized = sections.filter((s) =>
    ["made-for-you", "recently-played", "your-favorites", "recommended-artists"].includes(s.id)
  );
  const source = prioritized.length > 0 ? prioritized : sections;
  const all = source.flatMap((s) => s.songs);
  const unique = dedupeSongs(all);
  return unique.sort(() => Math.random() - 0.5).slice(0, 24);
}
