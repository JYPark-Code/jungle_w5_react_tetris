// ============================================================
// Tab 3 — 📊 Flamegraph (렌더링 메트릭 패널)
// 3구역: Flamegraph Canvas + 바 차트 + 인사이트 텍스트
// metricsStore 기반 실시간 연동
// ============================================================

import { metricsStore } from '../metricsStore';
import type { FlamegraphEntry } from '../../../contracts';

let unsubscribe: (() => void) | null = null;

/**
 * Flamegraph 탭의 HTML 구조를 생성한다.
 */
export function createFlamegraphTab(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tab-inner';

  container.innerHTML = `
    <div class="info-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="margin:0;">📊 렌더링 메트릭 <span id="live-indicator" style="color:#666;font-size:12px;">⚫ IDLE</span></h2>
        <div style="display:flex;gap:8px;">
          <button class="game-btn" id="flamegraph-refresh-btn" style="padding:6px 12px;font-size:12px;">새로고침</button>
          <button class="game-btn pause" id="flamegraph-clear-btn" style="padding:6px 12px;font-size:12px;">초기화</button>
        </div>
      </div>
      <canvas id="flamegraph-canvas" width="860" height="200" style="background:#0d0d0d;border:1px solid #222;border-radius:4px;width:100%;"></canvas>
    </div>

    <div class="info-section">
      <h2>컴포넌트별 렌더링 횟수</h2>
      <div id="bar-chart-container" style="font-size:13px;"></div>
    </div>

    <div class="info-section">
      <h2>핵심 인사이트</h2>
      <div id="insights-container" style="font-size:14px;color:#aaa;line-height:2;"></div>
    </div>
  `;

  return container;
}

/**
 * Flamegraph Canvas를 렌더링한다.
 */
function renderFlamegraphCanvas(entries: FlamegraphEntry[]): void {
  const canvas = document.getElementById('flamegraph-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, W, H);

  if (entries.length === 0) {
    ctx.fillStyle = '#444';
    ctx.font = '14px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('게임을 시작하면 메트릭이 표시됩니다', W / 2, H / 2);
    return;
  }

  // renderIndex 기준 그룹핑
  const groups = new Map<number, FlamegraphEntry[]>();
  for (const e of entries) {
    const g = groups.get(e.renderIndex) ?? [];
    g.push(e);
    groups.set(e.renderIndex, g);
  }

  const indices = Array.from(groups.keys()).sort((a, b) => a - b);
  // 최근 50개만 표시
  const visibleIndices = indices.slice(-50);
  const maxDepth = Math.max(...Array.from(groups.values()).map((g) => g.length), 1);

  const PADDING = 30;
  const barW = (W - PADDING * 2) / Math.max(visibleIndices.length, 1);
  const barH = (H - PADDING * 2) / Math.max(maxDepth, 1);

  // 축 라벨
  ctx.fillStyle = '#555';
  ctx.font = '10px Consolas';
  ctx.textAlign = 'center';
  ctx.fillText('← commit 순서 →', W / 2, H - 4);

  for (let col = 0; col < visibleIndices.length; col++) {
    const group = groups.get(visibleIndices[col])!;
    for (let depth = 0; depth < group.length; depth++) {
      const entry = group[depth];
      const x = PADDING + col * barW;
      const y = PADDING + depth * barH;
      const w = barW - 1;
      const h = barH - 1;

      // 색상: 초록(<8ms) 주황(8~16ms) 노랑(>16ms)
      if (entry.duration < 8) {
        ctx.fillStyle = '#4ecdc4';
      } else if (entry.duration < 16) {
        ctx.fillStyle = '#ff9f43';
      } else {
        ctx.fillStyle = '#ffe66d';
      }

      ctx.fillRect(x, y, w, h);

      // 이름 표시 (충분히 클 때만)
      if (w > 40 && h > 14) {
        ctx.fillStyle = '#000';
        ctx.font = '10px Consolas';
        ctx.textAlign = 'left';
        ctx.fillText(entry.componentName.slice(0, Math.floor(w / 6)), x + 2, y + h / 2 + 3);
      }
    }
  }
}

/**
 * 바 차트를 렌더링한다.
 */
function renderBarChart(): void {
  const container = document.getElementById('bar-chart-container');
  if (!container) return;

  const stats = metricsStore.getStats();
  const { componentCounts, totalCommits } = stats;

  if (componentCounts.size === 0) {
    container.innerHTML = '<p style="color:#555;">데이터 없음</p>';
    return;
  }

  // 횟수 내림차순 정렬
  const sorted = Array.from(componentCounts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0][1];

  let html = '';
  for (const [name, count] of sorted) {
    const pct = totalCommits > 0 ? ((count / totalCommits) * 100).toFixed(0) : '0';
    const barWidth = (count / maxCount) * 100;
    html += `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
        <span style="width:80px;color:#4ecdc4;text-align:right;">${name}</span>
        <div style="flex:1;background:#1a1a1a;height:18px;border-radius:3px;overflow:hidden;">
          <div style="width:${barWidth}%;height:100%;background:#4ecdc4;border-radius:3px;"></div>
        </div>
        <span style="width:80px;color:#888;">${count}회 (${pct}%)</span>
      </div>
    `;
  }

  container.innerHTML = html;
}

/**
 * 인사이트 텍스트를 렌더링한다.
 */
function renderInsights(): void {
  const container = document.getElementById('insights-container');
  if (!container) return;

  const stats = metricsStore.getStats();
  const { totalCommits, avgDuration, maxDuration, gameTimeSeconds } = stats;

  const minutes = Math.floor(gameTimeSeconds / 60);
  const seconds = Math.floor(gameTimeSeconds % 60);
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  container.innerHTML = `
    <div style="display:flex;gap:24px;margin-bottom:12px;">
      <span>🟢 평균 렌더링: <strong style="color:#4ecdc4;">${avgDuration.toFixed(1)}ms</strong></span>
      <span>🔴 최대: <strong style="color:#f44;">${maxDuration.toFixed(1)}ms</strong></span>
      <span>📦 총 commit: <strong style="color:#ffe66d;">${totalCommits}회</strong></span>
      <span>⏱ 게임 시간: <strong style="color:#fff;">${timeStr}</strong></span>
    </div>
    <p style="color:#888;font-size:13px;">
      "Component 분리를 통해 불필요한 렌더링을 제거할 수 있습니다.<br>
      Score는 점수가 바뀔 때만, Board는 블록 고정 시에만 렌더링하면 됩니다."
    </p>
  `;
}

/**
 * LIVE 인디케이터를 업데이트한다.
 */
function updateLiveIndicator(): void {
  const el = document.getElementById('live-indicator');
  if (!el) return;

  if (metricsStore.isLive) {
    el.innerHTML = '<span style="color:#f44;animation:blink 1s infinite;">●</span> LIVE';
    el.style.color = '#f44';
  } else {
    el.textContent = '⚫ IDLE';
    el.style.color = '#666';
  }
}

/**
 * Flamegraph 탭 전체를 새로고침한다.
 */
export function refreshFlamegraph(): void {
  renderFlamegraphCanvas(metricsStore.entries);
  renderBarChart();
  renderInsights();
  updateLiveIndicator();

  // 구독 시작 (최초 1회)
  if (!unsubscribe) {
    unsubscribe = metricsStore.subscribe((entries) => {
      // 탭이 활성화되어 있을 때만 렌더링 (성능)
      const tab = document.getElementById('tab-flamegraph');
      if (tab?.classList.contains('active')) {
        renderFlamegraphCanvas(entries);
        renderBarChart();
        renderInsights();
        updateLiveIndicator();
      }
    });
  }
}

// blink 애니메이션 CSS 주입
const style = document.createElement('style');
style.textContent = '@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }';
document.head?.appendChild(style);
