// ============================================================
// notTetrisState.ts — Not Tetris 2 방식 게임 상태 관리
// 모든 함수는 순수 함수로, state를 직접 변경하지 않고 새 state를 반환한다.
// ============================================================

import type { NotTetrisState, RigidBody } from '../../contracts';
import { applyGravity, checkWallCollision, resolveCollision, checkBodyCollision } from './engine2d';
import { clearFullLines } from './linecut';
import { createRandomBody, CELL_SIZE } from './tetrominos';

// 보드 상수
const BOARD_COLS = 10;
const BOARD_ROWS = 20;
const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;
const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;
const SPAWN_X = BOARD_WIDTH / 2;
const SPAWN_Y = CELL_SIZE * 2; // 상단에서 약간 아래
const GRAVITY = 400; // 픽셀/초² — 자연스러운 낙하 속도

// ------------------------------------------------------------
// initNotTetrisState: 초기 게임 상태
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
  };
}

// ------------------------------------------------------------
// nextTick: 매 프레임 게임 루프
// ------------------------------------------------------------

/**
 * 게임 루프의 한 프레임을 처리한다.
 *
 * 실행 순서:
 * 1. dt 클램핑 (탭 전환 후 큰 dt 방지)
 * 2. activeBody에 중력 적용
 * 3. 벽/바닥 충돌 체크
 * 4. static bodies와 SAT 충돌 체크
 * 5. 착지 조건 체크 → isStatic 전환
 * 6. 라인 클리어 체크
 * 7. 새 블록 생성 + 게임 오버 체크
 */
export function nextTick(state: NotTetrisState, dt: number): NotTetrisState {
  if (state.isGameOver || !state.activeBody) return state;

  // 1. dt 클램핑 — 탭 전환 후 큰 dt 방지
  const safeDt = Math.min(dt, 0.05);

  let active = state.activeBody;

  // 2. 중력 적용
  active = applyGravity(active, safeDt, GRAVITY);

  // 3. 벽/바닥 충돌
  const wallResult = checkWallCollision(active, BOARD_WIDTH, BOARD_HEIGHT);
  active = wallResult.body;
  let landed = wallResult.landed;

  // 4. static bodies와 충돌 (착지 여부와 무관하게 항상 체크)
  if (state.bodies.length > 0) {
    const collisionResult = resolveCollision(active, state.bodies);
    active = collisionResult.body;
    landed = landed || collisionResult.landed;
  }

  // 바닥에 닿아서 속도가 거의 0이면 강제 착지
  if (!landed && wallResult.landed && Math.abs(active.velocity.y) < 5) {
    landed = true;
  }

  // 5. 착지 판정
  if (landed) {
    active = {
      ...active,
      isStatic: true,
      velocity: { x: 0, y: 0 },
      angularVelocity: 0,
    };

    const newBodies = [...state.bodies, active];

    // 6. 라인 클리어
    const { bodies: clearedBodies, linesCleared } = clearFullLines(
      newBodies,
      BOARD_HEIGHT,
      BOARD_WIDTH,
      CELL_SIZE
    );

    // 점수 계산
    const scoreTable = [0, 100, 300, 500, 800];
    const addScore = (scoreTable[linesCleared] ?? linesCleared * 200) * state.level;
    const totalLines = state.linesCleared + linesCleared;
    const newLevel = Math.floor(totalLines / 10) + 1;

    // 7. 새 블록 생성
    const newActive = state.nextBody;
    const newNext = createRandomBody(SPAWN_X, SPAWN_Y);

    // 게임 오버 체크: 새 블록이 기존 블록과 완전히 겹치는지
    let isGameOver = false;
    for (const body of clearedBodies) {
      const collision = checkBodyCollision(newActive, body);
      if (collision.colliding && collision.depth && collision.depth > CELL_SIZE * 0.5) {
        isGameOver = true;
        break;
      }
    }

    return {
      ...state,
      bodies: clearedBodies,
      activeBody: isGameOver ? null : newActive,
      nextBody: newNext,
      canHold: true,
      score: state.score + addScore,
      level: newLevel,
      linesCleared: totalLines,
      isGameOver,
    };
  }

  // 아직 낙하 중
  return {
    ...state,
    activeBody: active,
  };
}

// ------------------------------------------------------------
// moveActive: 좌우 이동
// ------------------------------------------------------------

export function moveActive(
  state: NotTetrisState,
  direction: 'left' | 'right'
): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const moveSpeed = CELL_SIZE; // 한 셀씩 이동
  const dx = direction === 'left' ? -moveSpeed : moveSpeed;

  const moved: RigidBody = {
    ...state.activeBody,
    position: {
      x: state.activeBody.position.x + dx,
      y: state.activeBody.position.y,
    },
  };

  // 벽 체크
  const { body } = checkWallCollision(moved, BOARD_WIDTH, BOARD_HEIGHT);

  // 기존 블록과 충돌 체크
  for (const s of state.bodies) {
    if (checkBodyCollision(body, s).colliding) {
      return state; // 충돌 시 이동 무시
    }
  }

  return { ...state, activeBody: body };
}

// ------------------------------------------------------------
// snapRotate: 90도 즉시 회전 (↑키)
// ------------------------------------------------------------

export function snapRotate(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const rotated: RigidBody = {
    ...state.activeBody,
    angle: state.activeBody.angle + Math.PI / 2,
    angularVelocity: 0,
  };

  // 충돌 체크
  const { body } = checkWallCollision(rotated, BOARD_WIDTH, BOARD_HEIGHT);
  for (const s of state.bodies) {
    if (checkBodyCollision(body, s).colliding) {
      return state;
    }
  }

  return { ...state, activeBody: body };
}

// ------------------------------------------------------------
// applyRotation: 자유 회전 (Q/E키)
// ------------------------------------------------------------

export function applyRotation(
  state: NotTetrisState,
  direction: 'cw' | 'ccw'
): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const impulse = direction === 'cw' ? 3.0 : -3.0; // 라디안/초

  return {
    ...state,
    activeBody: {
      ...state.activeBody,
      angularVelocity: state.activeBody.angularVelocity + impulse,
    },
  };
}

// ------------------------------------------------------------
// softDrop: 소프트 드롭 (↓키)
// ------------------------------------------------------------

export function softDrop(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  return {
    ...state,
    activeBody: {
      ...state.activeBody,
      velocity: {
        x: state.activeBody.velocity.x,
        y: state.activeBody.velocity.y + 200,
      },
    },
    score: state.score + 1,
  };
}

// ------------------------------------------------------------
// hardDrop: 하드 드롭 (Space키)
// ------------------------------------------------------------

export function hardDrop(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  let body = { ...state.activeBody };
  let dropDistance = 0;
  const step = 2; // 2px씩 내리면서 충돌 체크

  while (true) {
    const next: RigidBody = {
      ...body,
      position: { x: body.position.x, y: body.position.y + step },
    };

    // 바닥 체크
    const { landed } = checkWallCollision(next, BOARD_WIDTH, BOARD_HEIGHT);
    if (landed) break;

    // 기존 블록 충돌 체크
    let hit = false;
    for (const s of state.bodies) {
      if (checkBodyCollision(next, s).colliding) {
        hit = true;
        break;
      }
    }
    if (hit) break;

    body = next;
    dropDistance += step;
  }

  // 즉시 착지
  body = {
    ...body,
    isStatic: true,
    velocity: { x: 0, y: 0 },
    angularVelocity: 0,
  };

  const newBodies = [...state.bodies, body];
  const { bodies: clearedBodies, linesCleared } = clearFullLines(
    newBodies,
    BOARD_HEIGHT,
    BOARD_WIDTH,
    CELL_SIZE
  );

  const scoreTable = [0, 100, 300, 500, 800];
  const addScore =
    ((scoreTable[linesCleared] ?? linesCleared * 200) * state.level) +
    Math.floor(dropDistance / CELL_SIZE) * 2;

  const totalLines = state.linesCleared + linesCleared;
  const newLevel = Math.floor(totalLines / 10) + 1;

  const newActive = state.nextBody;
  const newNext = createRandomBody(SPAWN_X, SPAWN_Y);

  let isGameOver = false;
  for (const b of clearedBodies) {
    const collision = checkBodyCollision(newActive, b);
    if (collision.colliding && collision.depth && collision.depth > CELL_SIZE * 0.5) {
      isGameOver = true;
      break;
    }
  }

  return {
    ...state,
    bodies: clearedBodies,
    activeBody: isGameOver ? null : newActive,
    nextBody: newNext,
    canHold: true,
    score: state.score + addScore,
    level: newLevel,
    linesCleared: totalLines,
    isGameOver,
  };
}

// ------------------------------------------------------------
// holdPiece: 블록 보관 (R키)
// ------------------------------------------------------------

export function holdPiece(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver || !state.canHold) return state;

  const toHold: RigidBody = {
    ...state.activeBody,
    position: { x: SPAWN_X, y: SPAWN_Y },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    isStatic: false,
  };

  let newActive: RigidBody;
  let newNext = state.nextBody;

  if (state.heldBody === null) {
    newActive = state.nextBody;
    newNext = createRandomBody(SPAWN_X, SPAWN_Y);
  } else {
    newActive = {
      ...state.heldBody,
      position: { x: SPAWN_X, y: SPAWN_Y },
      velocity: { x: 0, y: 0 },
      angle: 0,
      angularVelocity: 0,
      isStatic: false,
    };
  }

  let isGameOver = false;
  for (const b of state.bodies) {
    const collision = checkBodyCollision(newActive, b);
    if (collision.colliding && collision.depth && collision.depth > CELL_SIZE * 0.5) {
      isGameOver = true;
      break;
    }
  }

  return {
    ...state,
    activeBody: isGameOver ? null : newActive,
    nextBody: newNext,
    heldBody: toHold,
    canHold: false,
    isGameOver,
  };
}

export { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE };
