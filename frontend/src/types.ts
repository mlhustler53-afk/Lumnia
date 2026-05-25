export interface Song {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration?: string;
  url?: string;
}

export interface UserPlaylist {
  id: string;
  name: string;
  songs: Song[];
}

export interface LuminaUser {
  name: string;
}

export interface ListeningStat {
  id: string;
  name: string;
  totalSeconds: number;
  lastActive: number;
  isListening?: boolean;
}

export interface RecommendationSection {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  accent: string;
  songs: Song[];
}
