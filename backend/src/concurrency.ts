/** Limits concurrent yt-dlp URL extractions (each spawns a child process). */
const YTDLP_MAX = Math.max(1, parseInt(process.env.YTDLP_MAX_CONCURRENT || "2", 10));

let ytdlpRunning = 0;
const ytdlpWaiters: Array<() => void> = [];

export async function acquireYtdlpSlot(): Promise<() => void> {
  if (ytdlpRunning < YTDLP_MAX) {
    ytdlpRunning++;
    return releaseYtdlpSlot;
  }
  await new Promise<void>((resolve) => ytdlpWaiters.push(resolve));
  ytdlpRunning++;
  return releaseYtdlpSlot;
}

function releaseYtdlpSlot(): void {
  ytdlpRunning = Math.max(0, ytdlpRunning - 1);
  const next = ytdlpWaiters.shift();
  if (next) next();
}

/** Limits simultaneous active audio proxy streams (each holds fetch + pipe buffers). */
const STREAM_MAX = Math.max(1, parseInt(process.env.STREAM_MAX_CONCURRENT || "3", 10));

let activeStreams = 0;

export function getActiveStreamCount(): number {
  return activeStreams;
}

export function tryAcquireStreamSlot(): boolean {
  if (activeStreams >= STREAM_MAX) return false;
  activeStreams++;
  return true;
}

export function releaseStreamSlot(): void {
  activeStreams = Math.max(0, activeStreams - 1);
}

export function getConcurrencyLimits(): { ytdlpMax: number; streamMax: number; ytdlpRunning: number; activeStreams: number } {
  return { ytdlpMax: YTDLP_MAX, streamMax: STREAM_MAX, ytdlpRunning, activeStreams };
}

/** Dedupe in-flight URL extractions for the same video ID. */
const inflightUrl = new Map<string, Promise<string | null>>();

export function dedupeUrlExtraction(videoId: string, run: () => Promise<string | null>): Promise<string | null> {
  const existing = inflightUrl.get(videoId);
  if (existing) return existing;

  const promise = run().finally(() => {
    inflightUrl.delete(videoId);
  });
  inflightUrl.set(videoId, promise);
  return promise;
}

export function clearInflightExtractions(): void {
  inflightUrl.clear();
}
