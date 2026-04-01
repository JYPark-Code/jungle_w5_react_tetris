// ============================================================
// TetrisApp.ts — custom React 함수형 컴포넌트
// useState/useEffect/useMemo가 실제로 작동하는 핵심 파일
// ============================================================

import { useState, useEffect, useMemo } from '../core/hooks';
import { createVNode } from '../core/vdom';
import { metricsStore } from './metricsStore';
import { initTetrisState, nextTick, snapRotate, hardDrop, holdPiece, type TetrisState, type Keys } from '../physics/gameState';
import { renderFrame, renderPreview } from '../physics/renderer';
import { TETROMINO_COLORS } from '../physics/engine';
import type { VNode } from '../../contracts';

// 모듈 레벨 전역 키 상태 (useState에서 분리 → useEffect deps에서 제거)
const _keys: Keys = { left: false, right: false, rotateLeft: false, rotateRight: false, down: false };

export const TetrisAppFn = (props: {
  boardCanvas: HTMLCanvasElement | null;
  nextCanvas: HTMLCanvasElement | null;
  holdCanvas: HTMLCanvasElement | null;
}): VNode => {
  const [gameState, setGameState] = useState<TetrisState>(initTetrisState());
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // useMemo: 정적 블록 수 캐싱 (bodies 변경 시만)
  const staticCount = useMemo(
    () => gameState.bodies.filter(b => b.isStatic && b.kind > 0).length,
    [gameState.bodies],
  );

  // useEffect: Canvas 렌더링 (gameState 변경 시)
  useEffect(() => {
    if (!props.boardCanvas) return;
    const t = performance.now();
    const ctx = props.boardCanvas.getContext('2d');
    if (ctx) {
      renderFrame(ctx, gameState.bodies, gameState.activeId);

      // 게임 오버 오버레이
      if (gameState.isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
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
    if (props.nextCanvas) renderPreview(props.nextCanvas, gameState.nextKind, TETROMINO_COLORS);
    if (props.holdCanvas) renderPreview(props.holdCanvas, gameState.heldKind, TETROMINO_COLORS);

    // 직접 DOM 업데이트 (custom React diff/patch 보완)
    const scoreEl = document.getElementById('score-value');
    const levelEl = document.getElementById('level-value');
    const linesEl = document.getElementById('lines-value');
    if (scoreEl) scoreEl.textContent = String(gameState.score);
    if (levelEl) levelEl.textContent = String(gameState.level);
    if (linesEl) linesEl.textContent = String(gameState.linesCleared);

    // 1. TetrisApp — canvas 전체 렌더링 시간
    metricsStore.record({
      componentName: 'TetrisApp',
      duration: performance.now() - t,
      timestamp: performance.now(),
      renderIndex: staticCount,
    });

    // 2. ScoreBoard — 점수가 바뀔 때만 기록 (diff/patch 시연용)
    const prevScore = (props.boardCanvas as any)?._prevScore ?? -1;
    if (gameState.score !== prevScore) {
      const scoreStart = performance.now();
      metricsStore.record({
        componentName: 'ScoreBoard',
        duration: Math.max(0.1, performance.now() - scoreStart),
        timestamp: performance.now(),
        renderIndex: staticCount,
      });
      if (props.boardCanvas) (props.boardCanvas as any)._prevScore = gameState.score;
    }

    // 3. Block — active block이 있을 때마다 기록
    const activeBody = gameState.bodies.find(b => b.id === gameState.activeId);
    if (activeBody) {
      metricsStore.record({
        componentName: 'Block',
        duration: 0.3,
        timestamp: performance.now(),
        renderIndex: staticCount,
      });
    }
  }, [gameState]);

  // useEffect: 게임 루프 (cleanup으로 중복 방지)
  useEffect(() => {
    if (!isRunning || isPaused) return;
    let last = 0, id = 0;
    const loop = (t: number) => {
      const dt = last > 0 ? Math.min((t - last) / 1000, 0.05) : 1 / 60;
      last = t;
      setGameState((prev: TetrisState) => nextTick(prev, dt, _keys));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [isRunning, isPaused]); // keys deps 제거 → 키 입력 시 루프 재시작 방지

  // useEffect: 키보드 이벤트 (cleanup으로 리스너 해제)
  useEffect(() => {
    if (!isRunning || isPaused) return;
    const pressed = new Set<string>();
    const update = () => {
      _keys.left = pressed.has('ArrowLeft');
      _keys.right = pressed.has('ArrowRight');
      _keys.rotateLeft = pressed.has('q') || pressed.has('Q');
      _keys.rotateRight = pressed.has('e') || pressed.has('E');
      _keys.down = pressed.has('ArrowDown');
    };
    const onDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      pressed.add(e.key);
      update();
      if (e.key === 'ArrowUp') setGameState((prev: TetrisState) => snapRotate(prev));
      if (e.key === ' ') setGameState((prev: TetrisState) => hardDrop(prev));
      if (e.key === 'r' || e.key === 'R') setGameState((prev: TetrisState) => holdPiece(prev));
    };
    const onUp = (e: KeyboardEvent) => { pressed.delete(e.key); update(); };
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => {
      pressed.clear();
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('keyup', onUp);
    };
  }, [isRunning, isPaused]);

  // VNode 반환: Score 패널 (custom React diff/patch가 작동하는 곳)
  return createVNode('div', { class: 'score-section' },
    createVNode('div', { class: 'score-display' },
      createVNode('span', null, 'SCORE'),
      createVNode('div', { id: 'score-value', class: 'value' }, String(gameState.score)),
      createVNode('div', { style: 'display:flex;gap:16px;margin-top:4px;' },
        createVNode('div', null,
          createVNode('span', null, 'LEVEL'),
          createVNode('span', { id: 'level-value', class: 'value small' }, String(gameState.level)),
        ),
        createVNode('div', null,
          createVNode('span', null, 'LINES'),
          createVNode('span', { id: 'lines-value', class: 'value small' }, String(gameState.linesCleared)),
        ),
      ),
    ),
    createVNode('div', { class: 'game-buttons', style: 'margin-top:12px;' },
      createVNode('button', {
        class: 'game-btn',
        onclick: () => {
          setGameState(initTetrisState());
          setIsRunning(true);
          setIsPaused(false);
          metricsStore.clear();
          metricsStore.setLive(true);
        },
      }, '▶ START'),
      createVNode('button', {
        class: 'game-btn pause',
        onclick: () => setIsPaused((p: boolean) => !p),
      }, isPaused ? '▶ RESUME' : '⏸ PAUSE'),
    ),
  );
};
