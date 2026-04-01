// ============================================================
// notTetrisState.ts — Not Tetris 2 방식 게임 상태 관리
// Phase 3 fix: 실제 꼭짓점 접촉 기반 착지 판정
// ============================================================

import type { NotTetrisState, RigidBody } from '../../contracts';
import { checkWallCollision, resolveCollision, checkBodyCollision, getWorldVertices } from './engine2d';
import { clearFullLines } from './linecut';
import { createRandomBody, CELL_SIZE } from './tetrominos';

// 보드 상수
const BOARD_COLS = 10;
const BOARD_ROWS = 20;
const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;
const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;
const SPAWN_X = BOARD_WIDTH / 2;
const SPAWN_Y = CELL_SIZE * 2;

const BASE_DROP_SPEED = 80;
const GRAVITY = 400;
const LOCK_DELAY = 0.5;
const MAX_LOCK_RESETS = 5;
const GRACE_PERIOD = 0.5;
const MOVE_AMOUNT = 8; // 이동량 (px)

// ------------------------------------------------------------
// 실제 접촉 판정 유틸리티
// ------------------------------------------------------------

/**
 * activeBody가 바닥 또는 static body 표면에 실제로 닿아있는지 확인한다.
 * "근처에 있음"이 아니라 "실제 접촉" 기준.
 */
function isTouchingGround(body: RigidBody, staticBodies: RigidBody[], boardHeight: number): boolean {
  const vertices = getWorldVertices(body);
  const maxY = Math.max(...vertices.map((v) => v.y));

  // 바닥 접촉 (2px 오차 허용)
  if (maxY >= boardHeight - 2) return true;

  // static body 위에 있는지 확인
  for (const s of staticBodies) {
    const sVertices = getWorldVertices(s);
    const sMinY = Math.min(...sVertices.map((v) => v.y));
    // active 바닥이 static 상단에 닿아있고 + SAT 충돌 중
    if (Math.abs(maxY - sMinY) < 5 && checkBodyCollision(body, s).colliding) {
      return true;
    }
  }

  return false;
}

// ------------------------------------------------------------
// initNotTetrisState
// ------------------------------------------------------------

export function initNotTetrisState(): NotTetrisState {
  return {
    bodies: [],
    activeBody: createRandomBody(SPAWN_X, SPAWN_Y),
    heldBody: null,
    nextBody: createRandomBody(SPAWN_X, SPAWN_Y),
    canHold: true,
    score: 0,
    level: 1,
    linesCleared: 0,
    isGameOver: false,
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    lockTimer: 0,
    lockResets: 0,
    graceTimer: 0,
  };
}

function getDropSpeed(level: number): number {
  return BASE_DROP_SPEED + (level - 1) * 20;
}

// ------------------------------------------------------------
// 착지 후 공통 처리 (lock + line clear + 새 블록 생성)
// ------------------------------------------------------------

function lockAndSpawn(
  state: NotTetrisState,
  lockedBody: RigidBody,
  allBodies: RigidBody[],
  graceTimer: number,
  bonusScore: number = 0
): NotTetrisState {
  const locked = {
    ...lockedBody,
    isStatic: true,
    velocity: { x: 0, y: 0 },
    angularVelocity: 0,
  };

  const newBodies = [...allBodies, locked];
  const { bodies: clearedBodies, linesCleared } = clearFullLines(
    newBodies, BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE
  );

  // 파편 재낙하 보장
  const fixedBodies = clearedBodies.map((b) =>
    b.isStatic ? b : { ...b, isStatic: false, velocity: { x: 0, y: 0 }, angularVelocity: 0 }
  );

  const scoreTable = [0, 100, 300, 500, 800];
  const addScore = ((scoreTable[linesCleared] ?? linesCleared * 200) * state.level) + bonusScore;
  const totalLines = state.linesCleared + linesCleared;
  const newLevel = Math.floor(totalLines / 10) + 1;

  const newActive = { ...state.nextBody };
  const newNext = createRandomBody(SPAWN_X, SPAWN_Y);

  let isGameOver = false;
  if (graceTimer <= 0) {
    for (const body of fixedBodies) {
      const collision = checkBodyCollision(newActive, body);
      if (collision.colliding && collision.depth && collision.depth > CELL_SIZE * 0.5) {
        isGameOver = true;
        break;
      }
    }
  }

  return {
    ...state,
    bodies: fixedBodies,
    activeBody: isGameOver ? null : newActive,
    nextBody: newNext,
    canHold: true,
    score: state.score + addScore,
    level: newLevel,
    linesCleared: totalLines,
    isGameOver,
    lockTimer: 0,
    lockResets: 0,
    graceTimer: GRACE_PERIOD,
  };
}

// ------------------------------------------------------------
// nextTick
// Phase 3: 실제 접촉 기반 착지 + 빈 공간이면 중력 계속 적용
// ------------------------------------------------------------

export function nextTick(state: NotTetrisState, dt: number): NotTetrisState {
  if (state.isGameOver || !state.activeBody) return state;

  const safeDt = Math.min(dt, 0.05);
  let active = { ...state.activeBody };
  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;
  let graceTimer = state.graceTimer;

  if (graceTimer > 0) graceTimer -= safeDt;

  const dropSpeed = getDropSpeed(state.level);

  // --- 파편(dynamic bodies) 물리 처리 ---
  const staticBodies = state.bodies.filter((b) => b.isStatic);
  const dynamicBodies = state.bodies.filter((b) => !b.isStatic);

  const processedDynamic: RigidBody[] = [];
  for (const dyn of dynamicBodies) {
    let d = { ...dyn, position: { ...dyn.position, y: dyn.position.y + dropSpeed * safeDt } };
    if (isTouchingGround(d, staticBodies, BOARD_HEIGHT)) {
      processedDynamic.push({ ...d, isStatic: true, velocity: { x: 0, y: 0 }, angularVelocity: 0 });
    } else {
      const dWall = checkWallCollision(d, BOARD_WIDTH, BOARD_HEIGHT);
      d = dWall.body;
      if (dWall.landed) {
        processedDynamic.push({ ...d, isStatic: true, velocity: { x: 0, y: 0 }, angularVelocity: 0 });
      } else {
        processedDynamic.push(d);
      }
    }
  }

  const allBodies = [...staticBodies, ...processedDynamic];
  const allStatic = allBodies.filter((b) => b.isStatic);

  // --- activeBody 이동 ---
  active = {
    ...active,
    position: {
      x: active.position.x + active.velocity.x * safeDt,
      y: active.position.y + dropSpeed * safeDt,
    },
    angle: active.angle + active.angularVelocity * safeDt,
    angularVelocity: active.angularVelocity * 0.85,
  };

  // 벽/바닥 충돌
  const wallResult = checkWallCollision(active, BOARD_WIDTH, BOARD_HEIGHT);
  active = wallResult.body;

  // static bodies와 SAT 충돌
  if (allStatic.length > 0) {
    const collisionResult = resolveCollision(active, allStatic);
    active = collisionResult.body;
  }

  // 수평 속도 감쇠
  active = { ...active, velocity: { x: active.velocity.x * 0.9, y: 0 } };

  // --- 실제 접촉 기반 착지 판정 ---
  const touching = isTouchingGround(active, allStatic, BOARD_HEIGHT);

  if (touching) {
    if (lockTimer === 0) {
      lockTimer = LOCK_DELAY;
    } else {
      lockTimer -= safeDt;
    }

    if (lockTimer <= 0) {
      return lockAndSpawn(state, active, allBodies, graceTimer);
    }
  } else {
    // 접촉하지 않으면 lockTimer 리셋 — 중력이 계속 적용됨
    lockTimer = 0;
  }

  return {
    ...state,
    bodies: allBodies,
    activeBody: active,
    lockTimer,
    lockResets,
    graceTimer,
  };
}

// ------------------------------------------------------------
// moveActive: 좌우 이동 (8px 단위)
// ------------------------------------------------------------

export function moveActive(
  state: NotTetrisState,
  direction: 'left' | 'right'
): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const dx = direction === 'left' ? -MOVE_AMOUNT : MOVE_AMOUNT;
  let moved: RigidBody = {
    ...state.activeBody,
    position: { x: state.activeBody.position.x + dx, y: state.activeBody.position.y },
  };

  // 꼭짓점 기반 벽 보정
  const vertices = getWorldVertices(moved);
  const maxX = Math.max(...vertices.map((v) => v.x));
  const minX = Math.min(...vertices.map((v) => v.x));
  if (maxX > BOARD_WIDTH) {
    moved = { ...moved, position: { ...moved.position, x: moved.position.x - (maxX - BOARD_WIDTH) } };
  }
  if (minX < 0) {
    moved = { ...moved, position: { ...moved.position, x: moved.position.x - minX } };
  }

  // static body 충돌 체크
  for (const s of state.bodies) {
    if (s.isStatic && checkBodyCollision(moved, s).colliding) {
      return state;
    }
  }

  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;
  if (lockTimer > 0 && lockResets < MAX_LOCK_RESETS) {
    lockTimer = LOCK_DELAY;
    lockResets++;
  }

  return { ...state, activeBody: moved, lockTimer, lockResets };
}

// ------------------------------------------------------------
// snapRotate: 90도 즉시 회전
// ------------------------------------------------------------

export function snapRotate(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  let rotated: RigidBody = {
    ...state.activeBody,
    angle: state.activeBody.angle + Math.PI / 2,
    angularVelocity: 0,
  };

  // 벽 보정
  const vertices = getWorldVertices(rotated);
  const maxX = Math.max(...vertices.map((v) => v.x));
  const minX = Math.min(...vertices.map((v) => v.x));
  if (maxX > BOARD_WIDTH) rotated = { ...rotated, position: { ...rotated.position, x: rotated.position.x - (maxX - BOARD_WIDTH) } };
  if (minX < 0) rotated = { ...rotated, position: { ...rotated.position, x: rotated.position.x - minX } };

  for (const s of state.bodies) {
    if (s.isStatic && checkBodyCollision(rotated, s).colliding) return state;
  }

  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;
  if (lockTimer > 0 && lockResets < MAX_LOCK_RESETS) { lockTimer = LOCK_DELAY; lockResets++; }

  return { ...state, activeBody: rotated, lockTimer, lockResets };
}

// ------------------------------------------------------------
// applyRotation: 자유 회전 Q/E (고정 속도)
// ------------------------------------------------------------

export function applyRotation(state: NotTetrisState, direction: 'cw' | 'ccw'): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const fixedSpeed = direction === 'cw' ? 2.0 : -2.0;

  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;
  if (lockTimer > 0 && lockResets < MAX_LOCK_RESETS) { lockTimer = LOCK_DELAY; lockResets++; }

  return {
    ...state,
    activeBody: { ...state.activeBody, angularVelocity: fixedSpeed },
    lockTimer, lockResets,
  };
}

// ------------------------------------------------------------
// softDrop
// ------------------------------------------------------------

export function softDrop(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const boost = getDropSpeed(state.level) * 0.016;
  return {
    ...state,
    activeBody: {
      ...state.activeBody,
      position: { x: state.activeBody.position.x, y: state.activeBody.position.y + boost },
    },
    score: state.score + 1,
  };
}

// ------------------------------------------------------------
// hardDrop: 꼭짓점 기반 바닥/충돌 체크
// ------------------------------------------------------------

export function hardDrop(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  let body = { ...state.activeBody };
  let dropDistance = 0;
  const step = 2;
  const statics = state.bodies.filter((b) => b.isStatic);

  while (true) {
    const next: RigidBody = { ...body, position: { x: body.position.x, y: body.position.y + step } };

    // 꼭짓점 기반 바닥 체크
    const vertices = getWorldVertices(next);
    const maxY = Math.max(...vertices.map((v) => v.y));
    if (maxY >= BOARD_HEIGHT) break;

    // static body 충돌 체크
    let hit = false;
    for (const s of statics) {
      if (checkBodyCollision(next, s).colliding) { hit = true; break; }
    }
    if (hit) break;

    body = next;
    dropDistance += step;
  }

  return lockAndSpawn(state, body, state.bodies, state.graceTimer, Math.floor(dropDistance / CELL_SIZE) * 2);
}

// ------------------------------------------------------------
// holdPiece
// ------------------------------------------------------------

export function holdPiece(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver || !state.canHold) return state;

  const toHold: RigidBody = {
    ...state.activeBody,
    position: { x: SPAWN_X, y: SPAWN_Y },
    velocity: { x: 0, y: 0 }, angle: 0, angularVelocity: 0, isStatic: false,
  };

  let newActive: RigidBody;
  let newNext = state.nextBody;

  if (state.heldBody === null) {
    newActive = { ...state.nextBody };
    newNext = createRandomBody(SPAWN_X, SPAWN_Y);
  } else {
    newActive = {
      ...state.heldBody,
      position: { x: SPAWN_X, y: SPAWN_Y },
      velocity: { x: 0, y: 0 }, angle: 0, angularVelocity: 0, isStatic: false,
    };
  }

  return {
    ...state,
    activeBody: newActive, nextBody: newNext, heldBody: toHold,
    canHold: false, lockTimer: 0, lockResets: 0, graceTimer: GRACE_PERIOD,
  };
}

export { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE };
