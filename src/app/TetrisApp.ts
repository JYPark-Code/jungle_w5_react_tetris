// ============================================================
// TetrisApp.ts — custom React 함수형 컴포넌트
//
// Why 패널 설명과 실제 코드가 1:1 대응:
//   useState  → 게임 전체 물리 상태 보관
//   useEffect → 게임 루프 시작/종료 (cleanup으로 이전 루프 제거)
//   useMemo   → body 수 변경 시에만 충돌 수 재계산
// ============================================================

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
import type { NotTetrisState, VNode } from '../../contracts';

export const TetrisAppFn = (props: {
  boardCanvas: HTMLCanvasElement | null;
  nextCanvas: HTMLCanvasElement | null;
  holdCanvas: HTMLCanvasElement | null;
}): VNode => {

  // ── useState: 게임 상태 ────────────────────────────────────
  const [gameState, setGameState] = useState<NotTetrisState>(
    initNotTetrisState()
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // ── useMemo: 바디 수 캐싱 ─────────────────────────────────
  const bodyCount = useMemo(
    () => gameState.bodies.length,
    [gameState.bodies]
  );

  // ── useEffect: Canvas 렌더링 ──────────────────────────────
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

        // 게임 오버 오버레이
        if (gameState.isGameOver) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(0, 0, props.boardCanvas.width, props.boardCanvas.height);
          ctx.fillStyle = '#f44';
          ctx.font = 'bold 28px Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('GAME OVER', props.boardCanvas.width / 2, props.boardCanvas.height / 2 - 10);
          ctx.fillStyle = '#ffe66d';
          ctx.font = '16px Consolas, monospace';
          ctx.fillText(`Score: ${gameState.score}`, props.boardCanvas.width / 2, props.boardCanvas.height / 2 + 20);
        }
      }
    }

    if (props.nextCanvas && gameState.nextBody) {
      renderPreviewBody(props.nextCanvas, gameState.nextBody);
    }

    if (props.holdCanvas) {
      renderPreviewBody(props.holdCanvas, gameState.heldBody ?? null);
    }

    metricsStore.record({
      componentName: 'TetrisApp',
      duration: performance.now() - startRender,
      timestamp: performance.now(),
      renderIndex: bodyCount,
    });
  }, [gameState]);

  // ── useEffect: 게임 루프 ──────────────────────────────────
  useEffect(() => {
    if (!isRunning || isPaused) return;

    let lastTime = 0;
    let animId = 0;

    const loop = (timestamp: number) => {
      const dt = lastTime > 0
        ? Math.min((timestamp - lastTime) / 1000, 0.05)
        : 1 / 60;
      lastTime = timestamp;

      setGameState((prev: NotTetrisState) => {
        if (prev.isGameOver) return prev;
        return nextTick(prev, dt);
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    // cleanup: 이전 루프 반드시 취소
    return () => cancelAnimationFrame(animId);
  }, [isRunning, isPaused]);

  // ── useEffect: 키보드 이벤트 ─────────────────────────────
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const pressedKeys = new Set<string>();
    let moveInterval: ReturnType<typeof setInterval> | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      // 게임 관련 키만 preventDefault (탭 이동 등 방해 방지)
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (pressedKeys.has(e.key)) return;
          pressedKeys.add(e.key);
          const dir = e.key === 'ArrowLeft' ? 'left' as const : 'right' as const;

          // 즉시 1회 이동
          setGameState((prev: NotTetrisState) => moveActive(prev, dir));

          // 기존 interval 클리어 후 새로 시작
          if (moveInterval) clearInterval(moveInterval);
          moveInterval = null;

          // 250ms 딜레이 후 연속 이동 (counter 기반, setTimeout 미사용)
          let delayCounter = 0;
          const capturedKey = e.key;
          moveInterval = setInterval(() => {
            delayCounter++;
            if (delayCounter < 5) return; // 처음 250ms 무시
            if (pressedKeys.has(capturedKey)) {
              setGameState((prev: NotTetrisState) => moveActive(prev, dir));
            } else {
              clearInterval(moveInterval!);
              moveInterval = null;
            }
          }, 50);
          break;
        }
        case 'ArrowUp':
          setGameState((prev: NotTetrisState) => snapRotate(prev)); break;
        case 'ArrowDown':
          setGameState((prev: NotTetrisState) => softDrop(prev)); break;
        case ' ':
          setGameState((prev: NotTetrisState) => hardDrop(prev)); break;
        case 'q': case 'Q':
          setGameState((prev: NotTetrisState) => applyRotation(prev, 'ccw')); break;
        case 'e': case 'E':
          setGameState((prev: NotTetrisState) => applyRotation(prev, 'cw')); break;
        case 'r': case 'R':
          setGameState((prev: NotTetrisState) => holdPiece(prev)); break;
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
      pressedKeys.clear(); // 핵심: setTimeout 클로저 방지
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (moveInterval) { clearInterval(moveInterval); moveInterval = null; }
    };
  }, [isRunning, isPaused]);

  // ── VNode 반환: Score 패널 ────────────────────────────────
  return createVNode('div', { class: 'score-inner' },
    createVNode('div', { class: 'score-label' }, 'SCORE'),
    createVNode('div', { id: 'score-value', class: 'score-number' },
      String(gameState.score)),
    createVNode('div', { class: 'score-sub' },
      createVNode('span', { class: 'score-label' }, 'LEVEL'),
      createVNode('span', { class: 'score-label' }, 'LINES'),
    ),
    createVNode('div', { class: 'score-sub' },
      createVNode('span', { id: 'level-value', class: 'score-subnum' },
        String(gameState.level)),
      createVNode('span', { id: 'lines-value', class: 'score-subnum' },
        String(gameState.linesCleared)),
    ),
    createVNode('div', { class: 'btn-group' },
      createVNode('button', {
        id: 'start-btn',
        class: 'game-btn',
        onclick: () => {
          setGameState(initNotTetrisState());
          setIsRunning(true);
          setIsPaused(false);
          metricsStore.clear();
          metricsStore.setLive(true);
        },
      }, '▶ START'),
      createVNode('button', {
        id: 'pause-btn',
        class: 'game-btn',
        onclick: () => setIsPaused((prev: boolean) => !prev),
      }, isPaused ? '▶ RESUME' : '⏸ PAUSE'),
    ),
  );
};
