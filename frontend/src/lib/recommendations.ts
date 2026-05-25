import type { RecommendationSection, Song } from "@/types";

const SECTION_CONFIG = [
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

async function fetchSection(
  apiBase: string,
  config: (typeof SECTION_CONFIG)[number]
): Promise<RecommendationSection> {
  try {
    const res = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(config.query)}`);
    const songs: Song[] = res.ok ? await res.json() : [];
    return { ...config, songs };
  } catch {
    return { ...config, songs: [] };
  }
}

export async function fetchHomeRecommendations(apiBase: string): Promise<RecommendationSection[]> {
  const sections = await Promise.all(SECTION_CONFIG.map((c) => fetchSection(apiBase, c)));

  const seen = new Set<string>();
  return sections.map((section) => ({
    ...section,
    songs: section.songs.filter((song) => {
      if (seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    }),
  }));
}

export function buildHomeMix(sections: RecommendationSection[]): Song[] {
  const all = sections.flatMap((s) => s.songs);
  const unique = Array.from(new Map(all.map((s) => [s.id, s])).values());
  return unique.sort(() => Math.random() - 0.5).slice(0, 24);
}
