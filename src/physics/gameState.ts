// ============================================================
// gameState.ts — 게임 상태 관리 (순수 함수 nextTick)
// custom React: setGameState(prev => nextTick(prev, dt, keys))
// ============================================================

import {
  Body, BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE, DROP_SPEED, MAX_VY,
  createTetromino, getAllWorldVerts,
  applyGravity, integratePosition, applyWallConstraints, resolveBodyCollisions, checkLanding,
} from './engine';
import { checkLineDensity, removeLinesFromBodies } from './linecut';

export interface TetrisState {
  bodies: Body[];
  activeId: number | null;
  nextKind: number;
  heldKind: number | null;
  canHold: boolean;
  score: number;
  level: number;
  linesCleared: number;
  isGameOver: boolean;
  lockTimer: number;
  clearCooldown: number;
}

export interface Keys {
  left: boolean;
  right: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  down: boolean;
}

const SPAWN_X = BOARD_WIDTH / 2;
const SPAWN_Y = CELL_SIZE * 1.5;
const LOCK_DELAY = 0.5;
const CLEAR_COOLDOWN = 0.5;

export function initTetrisState(): TetrisState {
  const firstKind = Math.ceil(Math.random() * 7);
  const nextKind = Math.ceil(Math.random() * 7);
  const active = createTetromino(firstKind, SPAWN_X, SPAWN_Y);
  return {
    bodies: [active],
    activeId: active.id,
    nextKind,
    heldKind: null,
    canHold: true,
    score: 0,
    level: 1,
    linesCleared: 0,
    isGameOver: false,
    lockTimer: 0,
    clearCooldown: 0,
  };
}

// ── 핵심: 순수 함수 nextTick ──────────────────────────────
export function nextTick(state: TetrisState, dt: number, keys: Keys): TetrisState {
  if (state.isGameOver) return state;
  const safeDt = Math.min(dt, 0.05);

  // 클리어 쿨다운 중에도 파편 낙하 물리는 계속 실행
  if (state.clearCooldown > 0) {
    let coolBodies = state.bodies.map(b =>
      b.id === state.activeId ? b : applyGravity(b)
    );
    coolBodies = coolBodies.map(b =>
      b.id === state.activeId ? b : integratePosition(b)
    );
    coolBodies = resolveBodyCollisions(coolBodies);
    coolBodies = coolBodies.map(b =>
      b.id === state.activeId ? b : applyWallConstraints(b)
    );
    // 파편 착지 → isStatic 전환
    const coolStatics = coolBodies.filter(b => b.isStatic);
    coolBodies = coolBodies.map(b => {
      if (b.isStatic || b.id === state.activeId) return b;
      if (checkLanding(b, coolStatics)) {
        return { ...b, isStatic: true, velocity: { x: 0, y: 0 }, angularVelocity: 0 };
      }
      return b;
    });
    return { ...state, bodies: coolBodies, clearCooldown: state.clearCooldown - safeDt };
  }

  const dropSpeed = DROP_SPEED + (state.level - 1) * 7;

  // 키 입력 → active body velocity 조정
  let bodies = state.bodies.map(b => {
    if (b.id !== state.activeId) return b;
    let vel = { ...b.velocity };
    let av = b.angularVelocity;
    // 좌우 이동 (속도 캡 ±4 px/frame)
    if (keys.left && vel.x > -4) vel.x -= 0.8;
    if (keys.right && vel.x < 4) vel.x += 0.8;
    if (!keys.left && !keys.right) vel.x *= 0.75; // 감쇠
    // 회전 (각속도 캡 ±0.15 rad/frame)
    if (keys.rotateLeft && av > -0.15) av -= 0.015;
    if (keys.rotateRight && av < 0.15) av += 0.015;
    // 소프트 드롭
    const vyS = vel.y * 60; // px/frame → px/s
    if (keys.down) {
      if (vyS < 500) vel.y += 0.3;
    } else if (vyS > dropSpeed) {
      vel.y = Math.max(dropSpeed / 60, vel.y - 2000 * safeDt / 60);
    }
    return { ...b, velocity: vel, angularVelocity: av };
  });

  // 물리 스텝
  bodies = bodies.map(applyGravity);
  bodies = bodies.map(integratePosition);
  bodies = resolveBodyCollisions(bodies);
  bodies = bodies.map(applyWallConstraints);

  // 파편 착지 처리 (라인 클리어 집계 위해 필수)
  const allStaticsNow = bodies.filter(b => b.isStatic);
  bodies = bodies.map(b => {
    if (b.isStatic || b.id === state.activeId) return b;
    if (checkLanding(b, allStaticsNow)) {
      return { ...b, isStatic: true, velocity: { x: 0, y: 0 }, angularVelocity: 0 };
    }
    return b;
  });

  // 착지 판정
  let lockTimer = state.lockTimer;
  const active = bodies.find(b => b.id === state.activeId);
  const statics = bodies.filter(b => b.isStatic);
  const landed = active ? checkLanding(active, statics) : false;

  let { activeId, nextKind, canHold, score, linesCleared, level, clearCooldown } = state;

  if (landed) {
    if (lockTimer === 0) lockTimer = LOCK_DELAY;
    else lockTimer -= safeDt;

    if (lockTimer <= 0) {
      // 블록 고정
      bodies = bodies.map(b =>
        b.id === activeId
          ? { ...b, isStatic: true, isActive: false, velocity: { x: 0, y: 0 }, angularVelocity: 0 }
          : b
      );

      // 라인 클리어 체크
      const { linesToClear, lineAreas } = checkLineDensity(bodies, BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE);
      if (linesToClear.length > 0) {
        bodies = removeLinesFromBodies(bodies, linesToClear, CELL_SIZE);
        const sum = linesToClear.reduce((s, r) => s + (lineAreas[r] ?? 0), 0);
        const avg = Math.min(1, sum / linesToClear.length / 10240);
        score += Math.ceil((linesToClear.length * 3) ** (avg ** 10) * 20 + linesToClear.length ** 2 * 40);
        linesCleared += linesToClear.length;
        level = Math.floor(linesCleared / 10) + 1;
        clearCooldown = CLEAR_COOLDOWN;
      }

      // 새 블록 생성
      const newActive = createTetromino(nextKind, SPAWN_X, SPAWN_Y);
      bodies = [...bodies, newActive];
      activeId = newActive.id;
      nextKind = Math.ceil(Math.random() * 7);
      canHold = true;

      // 게임 오버 체크: static body가 천장 위로 올라갔는지
      const isGameOver = bodies
        .filter(b => b.isStatic && b.kind > 0)
        .some(b => {
          const allV = getAllWorldVerts(b).flat();
          return Math.min(...allV.map(v => v.y)) < CELL_SIZE;
        });

      return {
        ...state, bodies, activeId, nextKind, canHold,
        score, linesCleared, level, clearCooldown,
        isGameOver, lockTimer: 0,
      };
    }
  } else {
    lockTimer = 0;
  }

  return { ...state, bodies, lockTimer, score, linesCleared, level, clearCooldown };
}

// ── 즉시 액션들 ────────────────────────────────────────────

/** 90도 즉시 회전 (↑ 키) */
export function snapRotate(state: TetrisState): TetrisState {
  return {
    ...state,
    bodies: state.bodies.map(b =>
      b.id === state.activeId
        ? { ...b, angle: b.angle + Math.PI / 2, angularVelocity: 0 }
        : b
    ),
  };
}

/** 하드 드롭 (Space) */
export function hardDrop(state: TetrisState): TetrisState {
  return {
    ...state,
    bodies: state.bodies.map(b =>
      b.id === state.activeId
        ? { ...b, velocity: { x: 0, y: MAX_VY } }
        : b
    ),
  };
}

/** 블록 보관 (R 키) */
export function holdPiece(state: TetrisState): TetrisState {
  if (!state.canHold || state.activeId === null) return state;
  const active = state.bodies.find(b => b.id === state.activeId);
  if (!active) return state;

  const bodies = state.bodies.filter(b => b.id !== state.activeId);
  const newKind = state.heldKind ?? state.nextKind;
  const newActive = createTetromino(newKind, BOARD_WIDTH / 2, CELL_SIZE * 1.5);

  return {
    ...state,
    bodies: [...bodies, newActive],
    activeId: newActive.id,
    heldKind: active.kind,
    nextKind: state.heldKind !== null ? state.nextKind : Math.ceil(Math.random() * 7),
    canHold: false,
  };
}
