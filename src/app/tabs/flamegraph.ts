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
          <button class="game-btn" id="flamegraph-refresh-btn" style="padding:6px 16px;font-size:12px;white-space:nowrap;">새로고침</button>
          <button class="game-btn pause" id="flamegraph-clear-btn" style="padding:6px 16px;font-size:12px;white-space:nowrap;">초기화</button>
        </div>
      </div>
      <div style="font-size:11px;color:#666;margin-bottom:8px;">
        ■ 색칠 = 렌더링 발생 &nbsp; □ 빈칸 = 렌더링 없음(최적화) &nbsp;&nbsp;
        <span style="color:#4ecdc4;">■ 초록=빠름</span> &nbsp;
        <span style="color:#ff9f43;">■ 주황=보통</span> &nbsp;
        <span style="color:#ffe66d;">■ 노랑=느림</span>
      </div>
      <canvas id="flamegraph-canvas" width="860" height="240" style="background:#0d0d0d;border:1px solid #222;border-radius:4px;width:100%;"></canvas>
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

  // 컴포넌트 이름 목록 (고정 순서)
  const componentNames = Array.from(new Set(entries.map((e) => e.componentName)));

  // renderIndex 기준으로 컴포넌트별 데이터 매핑
  const allIndices = Array.from(new Set(entries.map((e) => e.renderIndex))).sort((a, b) => a - b);
  const maxCols = 60; // 최대 표시 열 수
  const visibleIndices = allIndices.slice(-maxCols);

  // 컴포넌트 → renderIndex → entry 맵
  const dataMap = new Map<string, Map<number, FlamegraphEntry>>();
  for (const name of componentNames) {
    dataMap.set(name, new Map());
  }
  for (const e of entries) {
    dataMap.get(e.componentName)?.set(e.renderIndex, e);
  }

  const LABEL_W = 80;   // 왼쪽 컴포넌트명 영역
  const PADDING_T = 10;
  const ROW_H = Math.min(30, (H - PADDING_T) / Math.max(componentNames.length, 1));
  const colW = Math.max(2, Math.floor((W - LABEL_W - 10) / Math.max(visibleIndices.length, 1)));

  // 컴포넌트별 행 렌더링
  for (let row = 0; row < componentNames.length; row++) {
    const name = componentNames[row];
    const y = PADDING_T + row * ROW_H;

    // 컴포넌트명 레이블
    ctx.fillStyle = '#888';
    ctx.font = '11px Consolas';
    ctx.textAlign = 'right';
    ctx.fillText(name.slice(0, 10), LABEL_W - 4, y + ROW_H / 2 + 4);

    // 해당 컴포넌트의 각 commit에 대한 막대
    const compData = dataMap.get(name)!;
    for (let col = 0; col < visibleIndices.length; col++) {
      const idx = visibleIndices[col];
      const entry = compData.get(idx);
      const x = LABEL_W + col * colW;

      if (x + colW > W) break; // canvas 경계 초과 방지

      if (entry) {
        if (entry.duration < 8) ctx.fillStyle = '#4ecdc4';
        else if (entry.duration < 16) ctx.fillStyle = '#ff9f43';
        else ctx.fillStyle = '#ffe66d';
      } else {
        ctx.fillStyle = '#1a1a1a'; // 렌더링 없음
      }

      ctx.fillRect(x, y + 1, colW - 1, ROW_H - 2);
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

  // 데이터 기반 인사이트 자동 생성
  const counts = stats.componentCounts;
  const gameLoopCount = counts.get('GameLoop') ?? 0;
  const blockCount = counts.get('Block') ?? 0;
  const scoreCount = counts.get('Score') ?? 0;

  let insightText = '';
  if (gameLoopCount > 10 && scoreCount > 0) {
    const savePct = ((1 - scoreCount / gameLoopCount) * 100).toFixed(0);
    insightText = `<strong style="color:#ffe66d;">GameLoop이 ${gameLoopCount}번 실행되는 동안 Score는 ${scoreCount}번만 렌더링됐습니다 (${savePct}% 절감)</strong>`;
  } else if (gameLoopCount > 0) {
    insightText = `<strong style="color:#888;">데이터 수집 중... (${gameLoopCount} commits)</strong>`;
  }

  container.innerHTML = `
    <div style="display:flex;gap:24px;margin-bottom:12px;flex-wrap:wrap;">
      <span>🟢 평균: <strong style="color:#4ecdc4;">${avgDuration.toFixed(1)}ms</strong></span>
      <span>🔴 최대: <strong style="color:#f44;">${maxDuration.toFixed(1)}ms</strong></span>
      <span>📦 총 commit: <strong style="color:#ffe66d;">${totalCommits}회</strong></span>
      <span>⏱ 게임 시간: <strong style="color:#fff;">${timeStr}</strong></span>
    </div>
    ${insightText ? `<p style="margin-top:8px;font-size:14px;">${insightText}</p>` : ''}
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
