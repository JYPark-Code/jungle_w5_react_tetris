// ============================================================
// src/app/index.ts — 4탭 SPA 진입점
// 물리 테트리스 게임 + 발표용 시각화 탭
// ============================================================

import type { PhysicsState } from '../../contracts';
import {
  initState,
  nextTick,
  movePiece,
  hardDrop,
  holdPiece,
  softDrop,
  rotatePieceInState,
  snapRotateInState,
} from '../physics/gameState';

// 탭 모듈
import { createPlayTab, renderBoard, renderPreview, updateScoreDisplay } from './tabs/play';
import { createWhyTab } from './tabs/why';
import { createFlamegraphTab, getFlamegraphPanel, refreshFlamegraph } from './tabs/flamegraph';
import { createLifecycleTab } from './tabs/lifecycle';

// ============================================================
// 게임 상태
// ============================================================

let gameState: PhysicsState = initState();
let isRunning = false;
let isPaused = false;
let animFrameId: number | null = null;
let renderIndex = 0;

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

/**
 * 해시 기반 라우팅으로 현재 활성 탭을 결정한다.
 */
function getCurrentTab(): TabId {
  const hash = window.location.hash.replace('#', '') as TabId;
  return TABS.some((t) => t.id === hash) ? hash : 'play';
}

/**
 * 탭을 전환한다.
 */
function switchTab(tabId: TabId): void {
  // 모든 탭 콘텐츠 숨기기
  document.querySelectorAll('.tab-content').forEach((el) => {
    el.classList.remove('active');
  });
  // 모든 탭 버튼 비활성화
  document.querySelectorAll('.nav-tab').forEach((el) => {
    el.classList.remove('active');
  });

  // 선택된 탭 활성화
  const content = document.getElementById(`tab-${tabId}`);
  const button = document.getElementById(`btn-${tabId}`);
  if (content) content.classList.add('active');
  if (button) button.classList.add('active');

  // Flamegraph 탭이면 Canvas 새로고침
  if (tabId === 'flamegraph') {
    refreshFlamegraph();
  }

  window.location.hash = tabId;
}

// ============================================================
// 게임 루프
// ============================================================

/**
 * 매 프레임 호출되는 게임 루프.
 * nextTick으로 물리 상태를 업데이트하고 Canvas에 렌더링한다.
 */
function gameLoop(): void {
  if (!isRunning || isPaused) return;

  const startTime = performance.now();

  // 물리 상태 업데이트
  gameState = nextTick(gameState);

  // Canvas 렌더링
  const boardCanvas = document.getElementById('board-canvas') as HTMLCanvasElement | null;
  if (boardCanvas) {
    renderBoard(boardCanvas, gameState);
  }

  // 사이드 패널 업데이트
  updateScoreDisplay(gameState);

  const nextCanvas = document.getElementById('next-canvas') as HTMLCanvasElement | null;
  if (nextCanvas) {
    renderPreview(nextCanvas, gameState.nextPiece);
  }

  const holdCanvas = document.getElementById('hold-canvas') as HTMLCanvasElement | null;
  if (holdCanvas) {
    renderPreview(holdCanvas, gameState.heldPiece);
  }

  // Flamegraph 데이터 기록
  const duration = performance.now() - startTime;
  getFlamegraphPanel().record({
    componentName: 'GameLoop',
    duration,
    timestamp: performance.now(),
    renderIndex: renderIndex++,
  });

  // 게임 오버 시 루프 중단
  if (gameState.isGameOver) {
    isRunning = false;
    return;
  }

  animFrameId = requestAnimationFrame(gameLoop);
}

/**
 * 게임을 시작한다.
 */
function startGame(): void {
  gameState = initState();
  isRunning = true;
  isPaused = false;
  renderIndex = 0;
  getFlamegraphPanel().clear();
  gameLoop();
}

/**
 * 게임을 일시정지/재개한다.
 */
function togglePause(): void {
  if (!isRunning) return;
  isPaused = !isPaused;
  if (!isPaused) {
    gameLoop();
  }
}

// ============================================================
// 키보드 입력 처리
// ============================================================

function handleKeyDown(e: KeyboardEvent): void {
  if (!isRunning || isPaused || gameState.isGameOver) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      gameState = movePiece(gameState, 'left');
      break;
    case 'ArrowRight':
      e.preventDefault();
      gameState = movePiece(gameState, 'right');
      break;
    case 'ArrowUp':
      e.preventDefault();
      gameState = snapRotateInState(gameState);
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
      gameState = rotatePieceInState(gameState, 'ccw');
      break;
    case 'e':
    case 'E':
      gameState = rotatePieceInState(gameState, 'cw');
      break;
    case 'r':
    case 'R':
      gameState = holdPiece(gameState);
      break;
  }
}

// ============================================================
// 앱 초기화
// ============================================================

function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // 네비게이션 바 생성
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

  // 탭 콘텐츠 생성
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

  // 초기 탭 활성화
  switchTab(getCurrentTab());

  // 해시 변경 감지
  window.addEventListener('hashchange', () => {
    switchTab(getCurrentTab());
  });

  // 키보드 이벤트 등록
  document.addEventListener('keydown', handleKeyDown);

  // 게임 버튼 이벤트
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  if (startBtn) startBtn.addEventListener('click', startGame);
  if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

  // Flamegraph 탭 버튼
  const refreshBtn = document.getElementById('flamegraph-refresh-btn');
  const clearBtn = document.getElementById('flamegraph-clear-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshFlamegraph);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      getFlamegraphPanel().clear();
      refreshFlamegraph();
    });
  }
}

// DOM 로드 후 앱 초기화
document.addEventListener('DOMContentLoaded', initApp);
