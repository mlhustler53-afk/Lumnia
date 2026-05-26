import { clearInflightExtractions } from "./concurrency.js";
import { clearSearchCache } from "./searchCache.js";
import { clearStreamUrlCache } from "./streamCache.js";

const RAM_LIMIT_MB = Math.max(128, parseInt(process.env.MEMORY_LIMIT_MB || "512", 10));
const WARN_PCT = 70;
const CRITICAL_PCT = 85;
const INTERVAL_MS = 60_000;

let lastWarnAt = 0;

function rssMb(): number {
  return process.memoryUsage().rss / 1024 / 1024;
}

function heapMb(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

function usagePct(): number {
  return (rssMb() / RAM_LIMIT_MB) * 100;
}

export function runEmergencyCleanup(reason: string): void {
  clearStreamUrlCache();
  clearSearchCache();
  clearInflightExtractions();
  if (typeof global.gc === "function") {
    try {
      global.gc();
    } catch {
      /* optional --expose-gc */
    }
  }
  console.warn(`[memory] Emergency cleanup (${reason}) — RSS ${rssMb().toFixed(0)}MB`);
}

function tick(): void {
  const rss = rssMb();
  const heap = heapMb();
  const pct = usagePct();

  console.log(`[memory] RSS ${rss.toFixed(0)}MB heap ${heap.toFixed(0)}MB (${pct.toFixed(0)}% of ${RAM_LIMIT_MB}MB limit)`);

  if (pct >= CRITICAL_PCT) {
    runEmergencyCleanup(`usage ${pct.toFixed(0)}%`);
    return;
  }

  if (pct >= WARN_PCT) {
    const now = Date.now();
    if (now - lastWarnAt > INTERVAL_MS) {
      lastWarnAt = now;
      console.warn(`[memory] High usage ${pct.toFixed(0)}% — consider reducing concurrent streams`);
    }
  }
}

export function startMemoryMonitor(): void {
  tick();
  setInterval(tick, INTERVAL_MS).unref();
}

export function getMemorySnapshot(): {
  rssMb: number;
  heapMb: number;
  limitMb: number;
  usagePct: number;
} {
  return {
    rssMb: Math.round(rssMb()),
    heapMb: Math.round(heapMb()),
    limitMb: RAM_LIMIT_MB,
    usagePct: Math.round(usagePct()),
  };
}
