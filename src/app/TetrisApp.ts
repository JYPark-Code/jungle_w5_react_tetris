// ============================================================
// TetrisApp.ts — custom React FunctionComponent
// Matter.js 물리 엔진을 useState/useEffect/useMemo로 구동
// ============================================================

import { useState, useEffect, useMemo } from '../core/hooks';
import { createVNode } from '../core/vdom';
import { metricsStore } from './metricsStore';
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
import type { VNode } from '../../contracts';

// ── 모듈 전역 ──────────────────────────────────────────────
const _keys = {
  left: false, right: false,
  rotateLeft: false, rotateRight: false,
  down: false,
};

let _renderIndex = 0;

// 외부(index.ts)에서 호출할 수 있는 제어 함수
let _startFn: (() => void) | null = null;
let _pauseFn: (() => void) | null = null;

export function triggerStart(): void { _startFn?.(); }
export function triggerPause(): void { _pauseFn?.(); }

// ── 착지 감지 ───────────────────────────────────────────────
function isBodyOnGround(state: MatterGameState): boolean {
  if (!state.activeBody) return false;
  const pairs = state.engine.pairs.list;
  return pairs.some((pair: any) => {
    if (!pair.isActive) return false;
    const isAct =
      pair.bodyA === state.activeBody || pair.bodyB === state.activeBody ||
      pair.bodyA.parent === state.activeBody || pair.bodyB.parent === state.activeBody;
    if (!isAct) return false;
    const other = (pair.bodyA === state.activeBody || pair.bodyA.parent === state.activeBody)
      ? pair.bodyB : pair.bodyA;
    const label = other.label ?? (other as any).parent?.label ?? '';
    if (label === 'left' || label === 'right') return false;
    return true;
  });
}

// ============================================================
// TetrisApp FunctionComponent
// ============================================================

export const TetrisAppFn = (props: {
  boardCanvas: HTMLCanvasElement | null;
  nextCanvas: HTMLCanvasElement | null;
  holdCanvas: HTMLCanvasElement | null;
}): VNode => {
  const [gameState, setGameState] = useState<MatterGameState>(initMatterState());
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // 외부 제어 함수 등록
  _startFn = () => {
    setGameState(initMatterState());
    setIsRunning(true);
    setIsPaused(false);
    metricsStore.clear();
    metricsStore.setLive(true);
    _renderIndex = 0;
  };
  _pauseFn = () => {
    setIsPaused((p: boolean) => !p);
  };

  // useMemo: static body 수 캐싱
  const staticCount = useMemo(() => {
    return Matter.Composite.allBodies(gameState.engine.world)
      .filter((b: Matter.Body) => !b.isStatic && (b as any).kind).length;
  }, [gameState]);

  // useEffect: Canvas 렌더링
  useEffect(() => {
    const t = performance.now();

    if (props.boardCanvas) {
      const ctx = props.boardCanvas.getContext('2d');
      if (ctx) {
        renderMatterFrame(ctx, gameState.engine, gameState.activeBody);
        if (gameState.isGameOver) {
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
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
    if (props.nextCanvas) {
      const ctx = props.nextCanvas.getContext('2d');
      if (ctx) renderPreviewKind(ctx, gameState.nextKind);
    }
    if (props.holdCanvas) {
      const ctx = props.holdCanvas.getContext('2d');
      if (ctx) renderPreviewKind(ctx, gameState.heldKind);
    }

    // 직접 DOM 업데이트 (custom React diff/patch 보완)
    const scoreEl = document.getElementById('score-value');
    const levelEl = document.getElementById('level-value');
    const linesEl = document.getElementById('lines-value');
    if (scoreEl) scoreEl.textContent = String(gameState.score);
    if (levelEl) levelEl.textContent = String(gameState.level);
    if (linesEl) linesEl.textContent = String(gameState.linesCleared);

    // Flamegraph 기록 — 증가 renderIndex 사용
    const ri = _renderIndex++;
    const dur = performance.now() - t;
    const ts = performance.now();

    metricsStore.record({ componentName: 'TetrisApp', duration: dur, timestamp: ts, renderIndex: ri });

    if (gameState.activeBody) {
      metricsStore.record({ componentName: 'Block', duration: dur * 0.3, timestamp: ts, renderIndex: ri });
    }

    // Board: staticCount 변경 시만
    const prevStatic = (props.boardCanvas as any)?._prevStatic ?? -1;
    if (staticCount !== prevStatic) {
      metricsStore.record({ componentName: 'Board', duration: dur * 0.2, timestamp: ts, renderIndex: ri });
      if (props.boardCanvas) (props.boardCanvas as any)._prevStatic = staticCount;
    }

    // Score: 점수 변경 시만
    const prevScore = (props.boardCanvas as any)?._prevScore ?? -1;
    if (gameState.score !== prevScore) {
      metricsStore.record({ componentName: 'ScoreBoard', duration: 0.2, timestamp: ts, renderIndex: ri });
      if (props.boardCanvas) (props.boardCanvas as any)._prevScore = gameState.score;
    }
  }, [gameState]);

  // useEffect: 게임 루프
  useEffect(() => {
    if (!isRunning || isPaused) return;
    let lastTime = 0, animId = 0;

    const loop = (timestamp: number) => {
      const dt = lastTime > 0 ? Math.min((timestamp - lastTime) / 1000, 0.05) : 1 / 60;
      lastTime = timestamp;

      setGameState((prev: MatterGameState) => {
        if (prev.isGameOver) { metricsStore.setLive(false); return prev; }
        if (prev.activeBody) {
          const vel = prev.activeBody.velocity;
          if (Math.sqrt(vel.x ** 2 + vel.y ** 2) < 0.3 && isBodyOnGround(prev)) {
            prev = lockAndSpawnNew(prev);
          }
        }
        return updateMatter(prev, dt, _keys);
      });

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, isPaused]);

  // useEffect: 키보드 이벤트
  useEffect(() => {
    if (!isRunning || isPaused) return;
    const pressed = new Set<string>();
    const updateKeys = () => {
      _keys.left = pressed.has('ArrowLeft');
      _keys.right = pressed.has('ArrowRight');
      _keys.rotateLeft = pressed.has('q') || pressed.has('Q');
      _keys.rotateRight = pressed.has('e') || pressed.has('E');
      _keys.down = pressed.has('ArrowDown');
    };
    const onDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      pressed.add(e.key);
      updateKeys();
      if (e.key === 'ArrowUp') setGameState((prev: MatterGameState) => snapRotateMatter(prev));
      if (e.key === ' ') setGameState((prev: MatterGameState) => hardDropMatter(prev));
      if (e.key === 'r' || e.key === 'R') setGameState((prev: MatterGameState) => holdMatter(prev));
    };
    const onUp = (e: KeyboardEvent) => { pressed.delete(e.key); updateKeys(); };
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => { pressed.clear(); document.removeEventListener('keydown', onDown); document.removeEventListener('keyup', onUp); };
  }, [isRunning, isPaused]);

  // VNode: Score 표시만 (버튼은 play.ts HTML에서 관리)
  return createVNode('div', { class: 'score-display' },
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
  );
};
