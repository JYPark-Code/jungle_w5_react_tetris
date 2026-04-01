// ============================================================
// src/app/index.ts — 4탭 SPA 진입점
// Not Tetris 2 방식 물리 테트리스 + 발표용 시각화 탭
// ============================================================

import type { NotTetrisState } from '../../contracts';
import {
  initNotTetrisState,
  nextTick,
  moveActive,
  hardDrop,
  holdPiece,
  softDrop,
  applyRotation,
  snapRotate,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from '../physics/notTetrisState';
import { renderFrame, renderPreviewBody } from '../physics/renderer';

// 탭 모듈
import { createPlayTab } from './tabs/play';
import { createWhyTab } from './tabs/why';
import { createFlamegraphTab, refreshFlamegraph } from './tabs/flamegraph';
import { createLifecycleTab } from './tabs/lifecycle';
import { metricsStore } from './metricsStore';

// ============================================================
// 게임 상태
// ============================================================

let gameState: NotTetrisState = initNotTetrisState();
let isRunning = false;
let isPaused = false;
let animFrameId: number | null = null;
let renderIndex = 0;
let lastTimestamp = 0;
const pressedKeys = new Set<string>();
let moveInterval: ReturnType<typeof setInterval> | null = null;
let prevBodiesCount = 0;
let prevScore = 0;
let prevNextColor = '';
let prevHeldColor = '';

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
  document.querySelectorAll('.tab-content').forEach((el) => {
    el.classList.remove('active');
  });
  document.querySelectorAll('.nav-tab').forEach((el) => {
    el.classList.remove('active');
  });

  const content = document.getElementById(`tab-${tabId}`);
  const button = document.getElementById(`btn-${tabId}`);
  if (content) content.classList.add('active');
  if (button) button.classList.add('active');

  if (tabId === 'flamegraph') {
    refreshFlamegraph();
  }

  window.location.hash = tabId;
}

// ============================================================
// 게임 루프
// ============================================================

function gameLoop(timestamp: number): void {
  if (!isRunning || isPaused) return;

  const startTime = performance.now();

  // delta time 계산 (초 단위)
  const dt = lastTimestamp === 0 ? 0.016 : (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  // 물리 상태 업데이트
  gameState = nextTick(gameState, dt);

  // Canvas 렌더링
  const boardCanvas = document.getElementById('board-canvas') as HTMLCanvasElement | null;
  if (boardCanvas) {
    const ctx = boardCanvas.getContext('2d');
    if (ctx) {
      renderFrame(ctx, gameState.bodies, gameState.activeBody, BOARD_WIDTH, BOARD_HEIGHT);

      // 게임 오버 오버레이
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

  // 사이드 패널 업데이트
  updateScoreDisplay(gameState);

  const nextCanvas = document.getElementById('next-canvas') as HTMLCanvasElement | null;
  if (nextCanvas) {
    renderPreviewBody(nextCanvas, gameState.nextBody);
  }

  const holdCanvas = document.getElementById('hold-canvas') as HTMLCanvasElement | null;
  if (holdCanvas) {
    renderPreviewBody(holdCanvas, gameState.heldBody);
  }

  // Flamegraph 데이터 기록 — 컴포넌트별 개별 record
  const totalDuration = performance.now() - startTime;
  const ri = renderIndex++;
  const ts = performance.now();

  // GameLoop 전체
  metricsStore.record({ componentName: 'GameLoop', duration: totalDuration, timestamp: ts, renderIndex: ri });

  // Block: 매 프레임 렌더링 (activeBody가 있을 때)
  if (gameState.activeBody) {
    metricsStore.record({ componentName: 'Block', duration: totalDuration * 0.4, timestamp: ts, renderIndex: ri });
  }

  // Board: 블록 고정 시만 (bodies 수 변화 감지)
  if (prevBodiesCount !== gameState.bodies.length) {
    metricsStore.record({ componentName: 'Board', duration: totalDuration * 0.3, timestamp: ts, renderIndex: ri });
    prevBodiesCount = gameState.bodies.length;
  }

  // Score: 점수 변경 시만
  if (prevScore !== gameState.score) {
    metricsStore.record({ componentName: 'Score', duration: 0.5, timestamp: ts, renderIndex: ri });
    prevScore = gameState.score;
  }

  // Preview: next 블록 변경 시
  if (prevNextColor !== gameState.nextBody.color) {
    metricsStore.record({ componentName: 'Preview', duration: 0.3, timestamp: ts, renderIndex: ri });
    prevNextColor = gameState.nextBody.color;
  }

  // HoldPanel: hold 블록 변경 시
  if (prevHeldColor !== (gameState.heldBody?.color ?? '')) {
    metricsStore.record({ componentName: 'HoldPanel', duration: 0.2, timestamp: ts, renderIndex: ri });
    prevHeldColor = gameState.heldBody?.color ?? '';
  }

  // 게임 오버 시 루프 중단
  if (gameState.isGameOver) {
    isRunning = false;
    metricsStore.setLive(false);
    return;
  }

  animFrameId = requestAnimationFrame(gameLoop);
}

function updateScoreDisplay(state: NotTetrisState): void {
  const scoreEl = document.getElementById('score-value');
  const levelEl = document.getElementById('level-value');
  const linesEl = document.getElementById('lines-value');
  if (scoreEl) scoreEl.textContent = String(state.score);
  if (levelEl) levelEl.textContent = String(state.level);
  if (linesEl) linesEl.textContent = String(state.linesCleared);
}

function startGame(): void {
  gameState = initNotTetrisState();
  isRunning = true;
  isPaused = false;
  renderIndex = 0;
  lastTimestamp = 0;
  prevBodiesCount = 0;
  prevScore = 0;
  prevNextColor = '';
  prevHeldColor = '';
  metricsStore.clear();
  metricsStore.setLive(true);
  animFrameId = requestAnimationFrame(gameLoop);
}

function togglePause(): void {
  if (!isRunning) return;
  isPaused = !isPaused;
  if (!isPaused) {
    lastTimestamp = 0; // dt 리셋하여 큰 점프 방지
    animFrameId = requestAnimationFrame(gameLoop);
  }
}

// ============================================================
// 키보드 입력 처리 (key repeat 지원)
// ============================================================

/** 좌우 이동 실행 (key repeat용) */
function executeMoveKeys(): void {
  if (!isRunning || isPaused || gameState.isGameOver) return;
  if (pressedKeys.has('ArrowLeft')) {
    gameState = moveActive(gameState, 'left');
  }
  if (pressedKeys.has('ArrowRight')) {
    gameState = moveActive(gameState, 'right');
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!isRunning || isPaused || gameState.isGameOver) return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      if (pressedKeys.has(e.key)) return; // OS repeat 방지
      pressedKeys.add(e.key);
      // 즉시 1번 이동
      gameState = moveActive(gameState, e.key === 'ArrowLeft' ? 'left' : 'right');
      // 150ms 후 repeat 시작 → 50ms 간격 반복
      if (moveInterval) clearInterval(moveInterval);
      setTimeout(() => {
        if (pressedKeys.has('ArrowLeft') || pressedKeys.has('ArrowRight')) {
          moveInterval = setInterval(executeMoveKeys, 50);
        }
      }, 150);
      break;
    case 'ArrowUp':
      e.preventDefault();
      gameState = snapRotate(gameState);
      break;
    case 'ArrowDown':
      e.preventDefault();
      gameState = softDrop(gameState);
      break;
    case ' ':
      e.preventDefault();
      gameState = hardDrop(gameState);
      break;
    case 'q':
    case 'Q':
      gameState = applyRotation(gameState, 'ccw');
      break;
    case 'e':
    case 'E':
      gameState = applyRotation(gameState, 'cw');
      break;
    case 'r':
    case 'R':
      gameState = holdPiece(gameState);
      break;
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  pressedKeys.delete(e.key);
  if (!pressedKeys.has('ArrowLeft') && !pressedKeys.has('ArrowRight')) {
    if (moveInterval) {
      clearInterval(moveInterval);
      moveInterval = null;
    }
  }
}

// ============================================================
// 앱 초기화
// ============================================================

function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // 네비게이션 바
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

  // 버튼 이벤트
  document.getElementById('start-btn')?.addEventListener('click', startGame);
  document.getElementById('pause-btn')?.addEventListener('click', togglePause);
  document.getElementById('flamegraph-refresh-btn')?.addEventListener('click', refreshFlamegraph);
  document.getElementById('flamegraph-clear-btn')?.addEventListener('click', () => {
    metricsStore.clear();
    refreshFlamegraph();
  });
}

document.addEventListener('DOMContentLoaded', initApp);
