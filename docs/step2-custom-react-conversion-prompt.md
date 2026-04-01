# Step 2: Custom React 전환 프롬프트

> .bak 물리 + custom React (useState/useEffect/useMemo) 구조로 전환
> Matter.js 제거, 순수 함수 물리 + custom React 상태 관리
> 브랜치: feat/app (또는 feat/physics)

---

## 왜 가능한가

```typescript
// .bak의 nextTick은 이미 순수 함수
nextTick(state: NotTetrisState, dt: number): NotTetrisState

// custom React useState와 완벽하게 맞음
setGameState(prev => nextTick(prev, dt));

// useEffect → 게임 루프 시작/종료
// useMemo   → 충돌 계산 캐싱
// useState  → 게임 전체 상태
```

---

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

Matter.js 기반 게임 루프를 제거하고
.bak 물리 엔진 + custom React로 전환해줘.

---

## Step 1: 복원할 파일들

아래 .bak 파일들을 원본으로 복원:
- src/physics/notTetrisState.ts.bak → src/physics/notTetrisState.ts (덮어쓰기)
- src/physics/engine2d.ts.bak      → src/physics/engine2d.ts (덮어쓰기)
- src/physics/renderer.ts.bak      → src/physics/renderer.ts (덮어쓰기)
- src/physics/linecut.ts.bak       → src/physics/linecut.ts (덮어쓰기)

Matter.js 파일들은 삭제하지 말고 .old 확장자로 이름 변경:
- src/physics/matterEngine.ts   → matterEngine.ts.old
- src/physics/matterState.ts    → matterState.ts.old
- src/physics/matterLinecut.ts  → matterLinecut.ts.old
- src/physics/matterRenderer.ts → matterRenderer.ts.old

---

## Step 2: TetrisApp 컴포넌트 생성

새 파일 src/app/TetrisApp.ts 생성:

import { Component } from '../core/component';
import { useState, useEffect, useMemo } from '../core/hooks';
import { createVNode } from '../core/vdom';
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
import { metricsStore } from './metricsStore';
import type { NotTetrisState } from '../../contracts';

// ============================================================
// TetrisApp 함수형 컴포넌트
// custom React의 useState/useEffect/useMemo로 게임 전체 관리
// ============================================================
const TetrisAppFn = (props: { boardCanvas: HTMLCanvasElement; nextCanvas: HTMLCanvasElement; holdCanvas: HTMLCanvasElement }) => {
  // ── useState: 게임 전체 상태 ──────────────────────────────
  // 물리 상태 전체를 하나의 state로 관리
  // setState(prev => nextTick(prev, dt)) 패턴으로 매 프레임 업데이트
  const [gameState, setGameState] = useState<NotTetrisState>(initNotTetrisState());
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // ── useMemo: 충돌 데이터 캐싱 ────────────────────────────
  // bodies가 변경될 때만 재계산 (매 프레임 전체 재계산 방지)
  const bodyCount = useMemo(
    () => gameState.bodies.length,
    [gameState.bodies]
  );

  // ── useEffect: Canvas 렌더링 ──────────────────────────────
  // gameState 변경 시마다 Canvas를 다시 그림
  useEffect(() => {
    const start = performance.now();

    const ctx = props.boardCanvas.getContext('2d');
    if (ctx) {
      renderFrame(ctx, gameState.bodies, gameState.activeBody,
        props.boardCanvas.width, props.boardCanvas.height);
    }

    const nextCtx = props.nextCanvas.getContext('2d');
    if (nextCtx && gameState.nextBody) {
      renderPreviewBody(props.nextCanvas, gameState.nextBody);
    }

    const holdCtx = props.holdCanvas.getContext('2d');
    if (holdCtx) {
      renderPreviewBody(props.holdCanvas, gameState.heldBody);
    }

    // Flamegraph 기록 — 실제 렌더링 시간
    metricsStore.record({
      componentName: 'TetrisApp',
      duration: performance.now() - start,
      timestamp: performance.now(),
      renderIndex: bodyCount,
    });
  }, [gameState]); // gameState 바뀔 때만 Canvas 갱신

  // ── useEffect: 게임 루프 ──────────────────────────────────
  // isRunning/isPaused 변경 시 루프 시작/중지
  // cleanup 함수로 이전 루프 반드시 취소 (useEffect cleanup 시연)
  useEffect(() => {
    if (!isRunning || isPaused) return;

    let lastTime = 0;
    let animId: number;

    const loop = (timestamp: number) => {
      const dt = lastTime > 0
        ? Math.min((timestamp - lastTime) / 1000, 0.05)
        : 1 / 60;
      lastTime = timestamp;

      // 순수 함수 nextTick → 새 state 반환 → setState → diff/patch
      setGameState(prev => {
        if (prev.isGameOver) return prev;
        return nextTick(prev, dt);
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    // cleanup: 언마운트 또는 deps 변경 시 루프 취소
    // → "useEffect cleanup으로 이전 루프 제거" 시연 포인트
    return () => cancelAnimationFrame(animId);
  }, [isRunning, isPaused]);

  // ── useEffect: 키보드 이벤트 ─────────────────────────────
  useEffect(() => {
    const pressedKeys = new Set<string>();
    let moveInterval: ReturnType<typeof setInterval> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRunning || isPaused) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          if (pressedKeys.has(e.key)) return;
          pressedKeys.add(e.key);
          setGameState(prev => moveActive(prev, e.key === 'ArrowLeft' ? 'left' : 'right'));
          setTimeout(() => {
            if (pressedKeys.has(e.key!)) {
              moveInterval = setInterval(() => {
                setGameState(prev => moveActive(prev, e.key === 'ArrowLeft' ? 'left' : 'right'));
              }, 50);
            }
          }, 150);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setGameState(prev => snapRotate(prev));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setGameState(prev => softDrop(prev));
          break;
        case ' ':
          e.preventDefault();
          setGameState(prev => hardDrop(prev));
          break;
        case 'q': case 'Q':
          setGameState(prev => applyRotation(prev, 'ccw'));
          break;
        case 'e': case 'E':
          setGameState(prev => applyRotation(prev, 'cw'));
          break;
        case 'r': case 'R':
          setGameState(prev => holdPiece(prev));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key);
      if (!pressedKeys.has('ArrowLeft') && !pressedKeys.has('ArrowRight')) {
        if (moveInterval) { clearInterval(moveInterval); moveInterval = null; }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // cleanup: 이벤트 리스너 제거
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (moveInterval) clearInterval(moveInterval);
    };
  }, [isRunning, isPaused]);

  // ── VNode 반환: Score 패널만 custom React diff/patch ─────
  // Canvas는 useEffect에서 직접 그리므로 VNode 불필요
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
  ]);
};

// ── Component 인스턴스 export ────────────────────────────────
// index.ts에서 mount() 호출
export { TetrisAppFn };

---

## Step 3: index.ts 교체

src/app/index.ts에서 Matter.js import를 모두 제거하고
TetrisApp Component로 교체:

// 제거
import { initMatterState, updateMatter, ... } from '../physics/matterState';
import { renderMatterFrame, ... } from '../physics/matterRenderer';

// 추가
import { Component } from '../core/component';
import { TetrisAppFn } from './TetrisApp';

// initApp에서:
const scorePanelEl = document.querySelector('.score-panel') as HTMLElement;
if (scorePanelEl) {
  scorePanelEl.innerHTML = '';
  const tetrisApp = new Component(TetrisAppFn, {
    boardCanvas: document.getElementById('board-canvas') as HTMLCanvasElement,
    nextCanvas: document.getElementById('next-canvas') as HTMLCanvasElement,
    holdCanvas: document.getElementById('hold-canvas') as HTMLCanvasElement,
  }, 'TetrisApp');
  tetrisApp.mount(scorePanelEl);
}

// 기존 gameLoop, updateScoreDisplay 등 Matter.js 관련 함수 모두 제거

---

## 확인 포인트

작업 완료 후 아래 3가지 확인:

1. 게임 화면이 뜨고 블록이 내려오는가?
2. Flamegraph에 'TetrisApp' 컴포넌트가 잡히는가?
3. Score가 변경될 때만 diff/patch가 실행되는가?
   (콘솔에 'diff triggered' 로그 추가해서 확인 가능)

만약 게임이 작동하지 않으면 즉시 중단하고 Matter.js로 롤백:
git checkout -- src/physics/matterEngine.ts.old src/app/index.ts

한글 주석 필수.

완료 후 커밋:
feat(app): custom React (useState/useEffect/useMemo) + .bak 물리 엔진 연결
```
