// ============================================================
// metricsStore.ts — 전역 메트릭 저장소 (싱글톤)
// 게임 루프에서 record() → Flamegraph 탭에서 구독하여 실시간 시각화
// ============================================================

import type { FlamegraphEntry } from '../../contracts';

const MAX_ENTRIES = 500;

export interface MetricsStore {
  entries: FlamegraphEntry[];
  isLive: boolean;
  startTime: number;

  record(entry: FlamegraphEntry): void;
  subscribe(fn: (entries: FlamegraphEntry[]) => void): () => void;
  clear(): void;
  setLive(live: boolean): void;

  // 통계 계산
  getStats(): {
    totalCommits: number;
    avgDuration: number;
    maxDuration: number;
    gameTimeSeconds: number;
    componentCounts: Map<string, number>;
  };
}

function createMetricsStore(): MetricsStore {
  let entries: FlamegraphEntry[] = [];
  let listeners: ((entries: FlamegraphEntry[]) => void)[] = [];
  let isLive = false;
  let startTime = 0;

  return {
    get entries() { return entries; },
    get isLive() { return isLive; },
    get startTime() { return startTime; },

    record(entry: FlamegraphEntry): void {
      entries.push(entry);
      if (entries.length > MAX_ENTRIES) {
        entries = entries.slice(-MAX_ENTRIES);
      }
      listeners.forEach((fn) => fn(entries));
    },

    subscribe(fn: (entries: FlamegraphEntry[]) => void): () => void {
      listeners.push(fn);
      return () => {
        listeners = listeners.filter((l) => l !== fn);
      };
    },

    clear(): void {
      entries = [];
      startTime = performance.now();
      listeners.forEach((fn) => fn(entries));
    },

    setLive(live: boolean): void {
      isLive = live;
      if (live && startTime === 0) {
        startTime = performance.now();
      }
    },

    getStats() {
      const totalCommits = entries.length;
      const durations = entries.map((e) => e.duration);
      const avgDuration = totalCommits > 0
        ? durations.reduce((a, b) => a + b, 0) / totalCommits
        : 0;
      const maxDuration = totalCommits > 0 ? Math.max(...durations) : 0;
      const gameTimeSeconds = startTime > 0
        ? (performance.now() - startTime) / 1000
        : 0;

      const componentCounts = new Map<string, number>();
      for (const entry of entries) {
        const count = componentCounts.get(entry.componentName) ?? 0;
        componentCounts.set(entry.componentName, count + 1);
      }

      return { totalCommits, avgDuration, maxDuration, gameTimeSeconds, componentCounts };
    },
  };
}

/** 전역 싱글톤 */
export const metricsStore = createMetricsStore();
