# Step 2: Custom React + 순수 물리 엔진 완전 전환

> 목표: Matter.js 제거, custom React가 전체 게임을 구동
> 물리 로직 = .bak 순수 함수들 (state → newState)
> custom React = useState/useEffect/useMemo가 게임 루프/상태/렌더링 담당

---

## 전체 구조

```
키 입력 ──────────────────────────────────────────┐
                                                   ↓
                                    setGameState(prev => moveActive(prev))
                                                   ↓
[useEffect: 게임 루프]                   custom React batchScheduler
  setGameState(prev =>                             ↓
    nextTick(prev, dt))              diff(prevVNode, newVNode)
        ↓                                          ↓
[순수 함수 물리 계산]                  patch(DOM) → Score 업데이트
  nextTick() → new state                           ↓
        ↓                            Flamegraph → 실제 렌더링 시간
[useMemo: 충돌 캐싱]
  checkCollisions(bodies)
  (bodies 변경 시만 재계산)
        ↓
[useEffect: Canvas 렌더링]
  renderFrame(canvas, gameState)
  (gameState 변경 시마다)
```

---

## 작업 지시

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

Matter.js를 완전히 제거하고 custom React + .bak 물리 엔진으로 전환해줘.

---

## Step A: .bak 파일 복원

아래 명령어 실행:
cp src/physics/notTetrisState.ts.bak src/physics/notTetrisState.ts
cp src/physics/engine2d.ts.bak src/physics/engine2d.ts
cp src/physics/renderer.ts.bak src/physics/renderer.ts
cp src/physics/linecut.ts.bak src/physics/linecut.ts

Matter.js 파일들은 .old로 이름 변경 (삭제 금지):
mv src/physics/matterEngine.ts src/physics/matterEngine.ts.old
mv src/physics/matterState.ts src/physics/matterState.ts.old
mv src/physics/matterLinecut.ts src/physics/matterLinecut.ts.old
mv src/physics/matterRenderer.ts src/physics/matterRenderer.ts.old

package.json에서 matter-js 의존성 제거:
npm uninstall matter-js @types/matter-js

---

## Step B: src/app/TetrisApp.ts 생성 (핵심 파일)

import { useState, useEffect, useMemo } from '../core/hooks';
import { createVNode } from '../core/vdom';
import { metricsStore } from './metricsStore';
import {
  initNotTetrisState,
  nextTick,
  moveActive,
  snapRotate,
  applyRotation,
  softDrop,
  hardDrop,
  holdPiece,
} from '../physics/notTetrisState';
import { renderFrame, renderPreviewBody } from '../physics/renderer';
import type { NotTetrisState } from '../../contracts';

// ============================================================
// TetrisApp — custom React 함수형 컴포넌트
//
// Why 패널 설명과 실제 코드가 1:1 대응:
//   useState  → 게임 전체 물리 상태 보관
//   useEffect → 게임 루프 시작/종료 (cleanup으로 이전 루프 제거)
//   useMemo   → body 수 변경 시에만 충돌 수 재계산
// ============================================================
export const TetrisAppFn = (props: {
  boardCanvas: HTMLCanvasElement | null;
  nextCanvas: HTMLCanvasElement | null;
  holdCanvas: HTMLCanvasElement | null;
}) => {

  // ── useState: 게임 상태 ────────────────────────────────────
  // 물리 시뮬레이션 전체 상태를 하나의 state로 관리
  // setState(prev => nextTick(prev, dt)) → 순수 함수 패턴
  const [gameState, setGameState] = useState<NotTetrisState>(
    initNotTetrisState()
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // ── useMemo: 바디 수 캐싱 ─────────────────────────────────
  // bodies 배열이 바뀔 때만 재계산
  // → "블록이 500번 움직이는 동안 Body 수는 N번만 변경" 시각화
  const bodyCount = useMemo(
    () => gameState.bodies.length,
    [gameState.bodies]  // bodies 참조가 바뀔 때만
  );

  // ── useEffect: Canvas 렌더링 ──────────────────────────────
  // gameState 변경 → Canvas 재렌더링
  // (Canvas는 VDOM 밖이므로 useEffect로 직접 처리)
  useEffect(() => {
    const startRender = performance.now();

    if (props.boardCanvas) {
      const ctx = props.boardCanvas.getContext('2d');
      if (ctx) {
        renderFrame(
          ctx,
          gameState.bodies,
          gameState.activeBody,
          props.boardCanvas.width,
          props.boardCanvas.height,
        );
      }
    }

    if (props.nextCanvas && gameState.nextBody) {
      renderPreviewBody(props.nextCanvas, gameState.nextBody);
    }

    if (props.holdCanvas) {
      renderPreviewBody(props.holdCanvas, gameState.heldBody ?? null);
    }

    // Flamegraph: 실제 렌더링 시간 기록
    metricsStore.record({
      componentName: 'TetrisApp',
      duration: performance.now() - startRender,
      timestamp: performance.now(),
      renderIndex: bodyCount,
    });
  }, [gameState]);  // gameState 바뀔 때마다 Canvas 갱신

  // ── useEffect: 게임 루프 ──────────────────────────────────
  // isRunning/isPaused 변경 시 루프 시작 또는 중지
  // return () => cancelAnimationFrame(id) = cleanup
  // → "useEffect cleanup이 없으면 루프가 중복 실행된다" 시연
  useEffect(() => {
    if (!isRunning || isPaused) return;

    let lastTime = 0;
    let animId = 0;

    const loop = (timestamp: number) => {
      const dt = lastTime > 0
        ? Math.min((timestamp - lastTime) / 1000, 0.05)
        : 1 / 60;
      lastTime = timestamp;

      // 순수 함수 nextTick: state → newState
      // custom React가 변경 감지 → diff/patch 실행
      setGameState(prev => {
        if (prev.isGameOver) return prev;
        return nextTick(prev, dt);
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    // cleanup: 이전 루프 반드시 취소
    // → "cleanup 없으면 게임 루프가 2개 돌아간다" Why 패널 시연 포인트
    return () => cancelAnimationFrame(animId);
  }, [isRunning, isPaused]);

  // ── useEffect: 키보드 이벤트 ─────────────────────────────
  // cleanup으로 이벤트 리스너도 반드시 제거
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const pressedKeys = new Set<string>();
    let moveInterval: ReturnType<typeof setInterval> | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (pressedKeys.has(e.key)) return;
          pressedKeys.add(e.key);
          const dir = e.key === 'ArrowLeft' ? 'left' : 'right';
          setGameState(prev => moveActive(prev, dir));
          setTimeout(() => {
            if (pressedKeys.has(e.key!)) {
              moveInterval = setInterval(() => {
                setGameState(prev => moveActive(prev, dir));
              }, 50);
            }
          }, 150);
          break;
        }
        case 'ArrowUp':
          setGameState(prev => snapRotate(prev)); break;
        case 'ArrowDown':
          setGameState(prev => softDrop(prev)); break;
        case ' ':
          setGameState(prev => hardDrop(prev)); break;
        case 'q': case 'Q':
          setGameState(prev => applyRotation(prev, 'ccw')); break;
        case 'e': case 'E':
          setGameState(prev => applyRotation(prev, 'cw')); break;
        case 'r': case 'R':
          setGameState(prev => holdPiece(prev)); break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key);
      if (!pressedKeys.has('ArrowLeft') && !pressedKeys.has('ArrowRight')) {
        if (moveInterval) { clearInterval(moveInterval); moveInterval = null; }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (moveInterval) clearInterval(moveInterval);
    };
  }, [isRunning, isPaused]);

  // ── VNode 반환: Score 패널 ────────────────────────────────
  // 이 부분이 custom React diff/patch가 실제로 작동하는 곳
  // score가 바뀔 때만 해당 텍스트 노드를 patch
  return createVNode('div', { class: 'score-inner' }, [
    createVNode('div', { class: 'score-label' }, 'SCORE'),
    createVNode('div', { id: 'score-value', class: 'score-number' },
      String(gameState.score)),
    createVNode('div', { class: 'score-sub' }, [
      createVNode('span', { class: 'score-label' }, 'LEVEL'),
      createVNode('span', { class: 'score-label' }, 'LINES'),
    ]),
    createVNode('div', { class: 'score-sub' }, [
      createVNode('span', { id: 'level-value', class: 'score-subnum' },
        String(gameState.level)),
      createVNode('span', { id: 'lines-value', class: 'score-subnum' },
        String(gameState.linesCleared)),
    ]),
    // START/PAUSE 버튼도 VNode로
    createVNode('div', { class: 'btn-group' }, [
      createVNode('button', {
        id: 'start-btn',
        class: 'game-btn',
        onclick: () => {
          setGameState(initNotTetrisState());
          setIsRunning(true);
          setIsPaused(false);
        },
      }, '▶ START'),
      createVNode('button', {
        id: 'pause-btn',
        class: 'game-btn',
        onclick: () => setIsPaused(prev => !prev),
      }, isPaused ? '▶ RESUME' : '⏸ PAUSE'),
    ]),
  ]);
};

---

## Step C: src/app/index.ts 교체

src/app/index.ts를 완전히 새로 작성:

import { Component } from '../core/component';
import { TetrisAppFn } from './TetrisApp';
import { createPlayTab } from './tabs/play';
import { createWhyTab } from './tabs/why';
import { createFlamegraphTab, refreshFlamegraph } from './tabs/flamegraph';
import { createLifecycleTab } from './tabs/lifecycle';
import { metricsStore } from './metricsStore';

// ─── 탭 전환 (기존 로직 유지) ─────────────────────────────
type TabId = 'play' | 'why' | 'flamegraph' | 'lifecycle';

const TABS: { id: TabId; label: string }[] = [
  { id: 'play',      label: '🎮 Play'  },
  { id: 'why',       label: '🧩 Why'   },
  { id: 'flamegraph',label: '📊 Flame' },
  { id: 'lifecycle', label: '⚙️ 학습'  },
];

function getCurrentTab(): TabId {
  const hash = window.location.hash.replace('#', '') as TabId;
  return TABS.some(t => t.id === hash) ? hash : 'play';
}

function switchTab(tabId: TabId): void {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabId}`)?.classList.add('active');
  document.getElementById(`btn-${tabId}`)?.classList.add('active');
  if (tabId === 'flamegraph') refreshFlamegraph();
  window.location.hash = tabId;
}

// ─── 앱 초기화 ────────────────────────────────────────────
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

  // 탭 컨텐츠
  const tabConfigs: { id: TabId; create: () => HTMLElement }[] = [
    { id: 'play',       create: createPlayTab       },
    { id: 'why',        create: createWhyTab        },
    { id: 'flamegraph', create: createFlamegraphTab },
    { id: 'lifecycle',  create: createLifecycleTab  },
  ];
  for (const { id, create } of tabConfigs) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tab-content';
    wrapper.id = `tab-${id}`;
    wrapper.appendChild(create());
    app.appendChild(wrapper);
  }

  // ─── custom React Component 마운트 ───────────────────────
  // score 패널 영역을 TetrisApp 컴포넌트가 담당
  const scorePanelEl = document.querySelector('.score-panel') as HTMLElement | null;
  if (scorePanelEl) {
    scorePanelEl.innerHTML = '';  // 기존 HTML 비우기
    const tetrisApp = new Component(
      TetrisAppFn,
      {
        boardCanvas: document.getElementById('board-canvas') as HTMLCanvasElement,
        nextCanvas:  document.getElementById('next-canvas')  as HTMLCanvasElement,
        holdCanvas:  document.getElementById('hold-canvas')  as HTMLCanvasElement,
      },
      'TetrisApp',  // Flamegraph에 표시될 컴포넌트 이름
    );
    tetrisApp.mount(scorePanelEl);
  }

  // Flamegraph 버튼
  document.getElementById('flamegraph-refresh-btn')
    ?.addEventListener('click', refreshFlamegraph);
  document.getElementById('flamegraph-clear-btn')
    ?.addEventListener('click', () => metricsStore.clear());

  switchTab(getCurrentTab());
  window.addEventListener('hashchange', () => switchTab(getCurrentTab()));
}

document.addEventListener('DOMContentLoaded', initApp);

---

## 완료 체크리스트

작업 완료 후 순서대로 확인:

[ ] 1. npm run dev 실행 시 오류 없음
[ ] 2. Play 탭에서 블록이 내려오는가
[ ] 3. Score 숫자가 바뀌는가
[ ] 4. Flamegraph 탭에 'TetrisApp' 컴포넌트가 보이는가
[ ] 5. 게임 재시작 시 루프 중복 없이 정상 작동하는가

실패 시 즉시 롤백:
cp src/physics/notTetrisState.ts.bak.old src/physics/notTetrisState.ts  # Matter.js로 복귀
(또는 git checkout HEAD -- src/)

한글 주석 필수.

완료 후 커밋:
feat(app): custom React (useState/useEffect/useMemo) 물리 엔진 구동 전환
```
