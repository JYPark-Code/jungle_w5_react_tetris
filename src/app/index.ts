// ============================================================
// src/app/index.ts — 4탭 SPA 진입점
// Matter.js 기반 Not Tetris 2 물리 테트리스
// ============================================================

import {
  initMatterState,
  updateMatter,
  lockAndSpawnNew,
  snapRotateMatter,
  hardDropMatter,
  holdMatter,
  type MatterGameState,
} from '../physics/matterState';
import { renderMatterFrame, renderPreviewKind } from '../physics/matterRenderer';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../physics/matterEngine';
import Matter from 'matter-js';

// 탭 모듈
import { createPlayTab } from './tabs/play';
import { createWhyTab } from './tabs/why';
import { createFlamegraphTab, refreshFlamegraph } from './tabs/flamegraph';
import { createLifecycleTab } from './tabs/lifecycle';
import { metricsStore } from './metricsStore';

// ============================================================
// 게임 상태
// ============================================================

let gameState: MatterGameState = initMatterState();
let isRunning = false;
let isPaused = false;
let animFrameId: number | null = null;
let renderIndex = 0;
let lastTimestamp = 0;

// 키 상태 추적
const pressedKeys = new Set<string>();

// Flamegraph 추적
let prevScore = 0;
let prevBodiesCount = 0;
let prevNextKind = 0;
let prevHeldKind: number | null = null;

// ============================================================
// 탭 라우팅
// ============================================================

type TabId = 'play' | 'why' | 'flamegraph' | 'lifecycle';

const TABS: { id: TabId; label: string }[] = [
  { id: 'play', label: '🎮 Play' },
  { id: 'why', label: '🧩 Why' },
  { id: 'flamegraph', label: '📊 Flame' },
  { id: 'lifecycle', label: '⚙️ 학습' },
];

function getCurrentTab(): TabId {
  const hash = window.location.hash.replace('#', '') as TabId;
  return TABS.some((t) => t.id === hash) ? hash : 'play';
}

function switchTab(tabId: TabId): void {
  document.querySelectorAll('.tab-content').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((el) => el.classList.remove('active'));
  document.getElementById(`tab-${tabId}`)?.classList.add('active');
  document.getElementById(`btn-${tabId}`)?.classList.add('active');
  if (tabId === 'flamegraph') refreshFlamegraph();
  window.location.hash = tabId;
}

// ============================================================
// 현재 키 상태 → updateMatter에 전달
// ============================================================

function getCurrentKeys() {
  return {
    left: pressedKeys.has('ArrowLeft'),
    right: pressedKeys.has('ArrowRight'),
    rotateLeft: pressedKeys.has('q') || pressedKeys.has('Q'),
    rotateRight: pressedKeys.has('e') || pressedKeys.has('E'),
    down: pressedKeys.has('ArrowDown'),
  };
}

// ============================================================
// 착지 감지: 활성 블록이 바닥/블록과 접촉 중인지
// ============================================================

function isBodyOnGround(state: MatterGameState): boolean {
  if (!state.activeBody) return false;
  const pairs = state.engine.pairs.list;
  return pairs.some((pair: any) => {
    if (!pair.isActive) return false;

    const isActive =
      pair.bodyA === state.activeBody ||
      pair.bodyB === state.activeBody ||
      pair.bodyA.parent === state.activeBody ||
      pair.bodyB.parent === state.activeBody;

    if (!isActive) return false;

    // 충돌 상대방 찾기
    const other =
      (pair.bodyA === state.activeBody || pair.bodyA.parent === state.activeBody)
        ? pair.bodyB
        : pair.bodyA;

    // 벽(left/right) 충돌은 착지 판정 제외
    const otherLabel = other.label ?? (other as any).parent?.label ?? '';
    if (otherLabel === 'left' || otherLabel === 'right') return false;

    return true;
  });
}

// ============================================================
// 게임 루프
// ============================================================

function gameLoop(timestamp: number): void {
  if (!isRunning || isPaused) return;

  const startTime = performance.now();

  const dt = lastTimestamp > 0
    ? Math.min((timestamp - lastTimestamp) / 1000, 0.05)
    : 1 / 60;
  lastTimestamp = timestamp;

  // 착지 감지: 속도가 거의 0이고 바닥/블록에 닿아있으면 새 블록 생성
  if (gameState.activeBody) {
    const vel = gameState.activeBody.velocity;
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
    if (speed < 0.3 && isBodyOnGround(gameState)) {
      gameState = lockAndSpawnNew(gameState);
    }
  }

  // Matter.js 물리 업데이트 + 키 입력
  gameState = updateMatter(gameState, dt, getCurrentKeys());

  // Canvas 렌더링
  const boardCanvas = document.getElementById('board-canvas') as HTMLCanvasElement | null;
  if (boardCanvas) {
    const ctx = boardCanvas.getContext('2d');
    if (ctx) {
      renderMatterFrame(ctx, gameState.engine, gameState.activeBody);

      if (gameState.isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
        ctx.fillStyle = '#f44';
        ctx.font = 'bold 28px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', BOARD_WIDTH / 2, BOARD_HEIGHT / 2 - 10);
        ctx.fillStyle = '#ffe66d';
        ctx.font = '16px Consolas, monospace';
        ctx.fillText(`Score: ${gameState.score}`, BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 20);
      }
    }
  }

  // 사이드 패널
  updateScoreDisplay();
  renderPreviewCanvases();

  // Flamegraph 기록
  const totalDuration = performance.now() - startTime;
  const ri = renderIndex++;
  const ts = performance.now();
  metricsStore.record({ componentName: 'GameLoop', duration: totalDuration, timestamp: ts, renderIndex: ri });

  if (gameState.activeBody) {
    metricsStore.record({ componentName: 'Block', duration: totalDuration * 0.4, timestamp: ts, renderIndex: ri });
  }

  const currentBodiesCount = Matter.Composite.allBodies(gameState.engine.world).filter(b => !b.isStatic).length;
  if (prevBodiesCount !== currentBodiesCount) {
    metricsStore.record({ componentName: 'Board', duration: totalDuration * 0.3, timestamp: ts, renderIndex: ri });
    prevBodiesCount = currentBodiesCount;
  }

  if (prevScore !== gameState.score) {
    metricsStore.record({ componentName: 'Score', duration: 0.5, timestamp: ts, renderIndex: ri });
    prevScore = gameState.score;
  }

  if (prevNextKind !== gameState.nextKind) {
    metricsStore.record({ componentName: 'Preview', duration: 0.3, timestamp: ts, renderIndex: ri });
    prevNextKind = gameState.nextKind;
  }

  if (prevHeldKind !== gameState.heldKind) {
    metricsStore.record({ componentName: 'HoldPanel', duration: 0.2, timestamp: ts, renderIndex: ri });
    prevHeldKind = gameState.heldKind;
  }

  if (gameState.isGameOver) {
    isRunning = false;
    metricsStore.setLive(false);
    return;
  }

  animFrameId = requestAnimationFrame(gameLoop);
}

function updateScoreDisplay(): void {
  const scoreEl = document.getElementById('score-value');
  const levelEl = document.getElementById('level-value');
  const linesEl = document.getElementById('lines-value');
  if (scoreEl) scoreEl.textContent = String(gameState.score);
  if (levelEl) levelEl.textContent = String(gameState.level);
  if (linesEl) linesEl.textContent = String(gameState.linesCleared);
}

function renderPreviewCanvases(): void {
  const nextCanvas = document.getElementById('next-canvas') as HTMLCanvasElement | null;
  if (nextCanvas) {
    const ctx = nextCanvas.getContext('2d');
    if (ctx) renderPreviewKind(ctx, gameState.nextKind);
  }

  const holdCanvas = document.getElementById('hold-canvas') as HTMLCanvasElement | null;
  if (holdCanvas) {
    const ctx = holdCanvas.getContext('2d');
    if (ctx) renderPreviewKind(ctx, gameState.heldKind);
  }
}

function startGame(): void {
  gameState = initMatterState();
  isRunning = true;
  isPaused = false;
  renderIndex = 0;
  lastTimestamp = 0;
  prevBodiesCount = 0;
  prevScore = 0;
  prevNextKind = 0;
  prevHeldKind = null;
  metricsStore.clear();
  metricsStore.setLive(true);
  animFrameId = requestAnimationFrame(gameLoop);
}

function togglePause(): void {
  if (!isRunning) return;
  isPaused = !isPaused;
  if (!isPaused) {
    lastTimestamp = 0;
    animFrameId = requestAnimationFrame(gameLoop);
  }
}

// ============================================================
// 키보드 입력
// ============================================================

function handleKeyDown(e: KeyboardEvent): void {
  if (!isRunning || isPaused || gameState.isGameOver) return;

  pressedKeys.add(e.key);

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      break;
    case 'ArrowUp':
      e.preventDefault();
      gameState = snapRotateMatter(gameState);
      break;
    case ' ':
      e.preventDefault();
      gameState = hardDropMatter(gameState);
      break;
    case 'r':
    case 'R':
      gameState = holdMatter(gameState);
      break;
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  pressedKeys.delete(e.key);
}

// ============================================================
// 앱 초기화
// ============================================================

function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // 네비게이션
  const nav = document.createElement('nav');
  nav.className = 'nav-tabs';
  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.id = `btn-${tab.id}`;
    btn.textContent = tab.label;
    btn.addEventListener('click', () => switchTab(tab.id));
    nav.appendChild(btn);
  }
  app.appendChild(nav);

  // 탭 콘텐츠
  const tabConfigs: { id: TabId; create: () => HTMLElement }[] = [
    { id: 'play', create: createPlayTab },
    { id: 'why', create: createWhyTab },
    { id: 'flamegraph', create: createFlamegraphTab },
    { id: 'lifecycle', create: createLifecycleTab },
  ];

  for (const { id, create } of tabConfigs) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tab-content';
    wrapper.id = `tab-${id}`;
    wrapper.appendChild(create());
    app.appendChild(wrapper);
  }

  switchTab(getCurrentTab());
  window.addEventListener('hashchange', () => switchTab(getCurrentTab()));
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  document.getElementById('start-btn')?.addEventListener('click', startGame);
  document.getElementById('pause-btn')?.addEventListener('click', togglePause);
  document.getElementById('flamegraph-refresh-btn')?.addEventListener('click', refreshFlamegraph);
  document.getElementById('flamegraph-clear-btn')?.addEventListener('click', () => {
    metricsStore.clear();
    refreshFlamegraph();
  });
}

document.addEventListener('DOMContentLoaded', initApp);
