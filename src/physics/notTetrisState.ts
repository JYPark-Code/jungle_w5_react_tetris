// ============================================================
// notTetrisState.ts — Not Tetris 2 방식 게임 상태 관리
// physics-and-flamegraph-fix.md Fix 1 반영
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

// 낙하 속도 (문제 1 수정: velocity 누적 → 고정 속도)
const BASE_DROP_SPEED = 80; // 픽셀/초 (레벨 1)

// Lock Delay (문제 2)
const LOCK_DELAY = 0.5;     // 0.5초
const MAX_LOCK_RESETS = 5;   // 최대 리셋 횟수

// 게임 오버 유예 (문제 5)
const GRACE_PERIOD = 0.5;   // 0.5초

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

// ------------------------------------------------------------
// 낙하 속도 계산 (레벨에 따라 증가)
// ------------------------------------------------------------

function getDropSpeed(level: number): number {
  return BASE_DROP_SPEED + (level - 1) * 20;
}

// ------------------------------------------------------------
// nextTick: 매 프레임 게임 루프
// 문제 0~6 전부 수정 반영
// ------------------------------------------------------------

export function nextTick(state: NotTetrisState, dt: number): NotTetrisState {
  if (state.isGameOver || !state.activeBody) return state;

  // dt 클램핑
  const safeDt = Math.min(dt, 0.05);

  let active = { ...state.activeBody };
  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;
  let graceTimer = state.graceTimer;

  // 게임 오버 유예 타이머 감소 (문제 5)
  if (graceTimer > 0) {
    graceTimer -= safeDt;
  }

  // --- 문제 1: 고정 낙하 속도 (velocity 누적 아님) ---
  const dropSpeed = getDropSpeed(state.level);
  active = {
    ...active,
    position: {
      x: active.position.x + active.velocity.x * safeDt,
      y: active.position.y + dropSpeed * safeDt,
    },
    // 각속도 적용 + 감쇠
    angle: active.angle + active.angularVelocity * safeDt,
    angularVelocity: active.angularVelocity * 0.96,
  };

  // --- 3. 벽/바닥 충돌 ---
  const wallResult = checkWallCollision(active, BOARD_WIDTH, BOARD_HEIGHT);
  active = wallResult.body;
  let touching = wallResult.landed;

  // --- 4. static bodies와 SAT 충돌 (문제 0: 항상 체크) ---
  if (state.bodies.length > 0) {
    const collisionResult = resolveCollision(active, state.bodies);
    active = collisionResult.body;
    touching = touching || collisionResult.landed;
  }

  // 수평 속도 감쇠 (문제 6: 기울어져 미끄러짐 허용하되 감쇠)
  active = {
    ...active,
    velocity: {
      x: active.velocity.x * 0.9,
      y: 0, // y 속도는 고정 낙하 속도로 대체
    },
  };

  // --- 문제 2: Lock Delay ---
  if (touching) {
    if (lockTimer === 0) {
      // 첫 착지 감지 → lockTimer 시작
      lockTimer = LOCK_DELAY;
    } else {
      lockTimer -= safeDt;
    }

    // lockTimer 만료 → 고정 (문제 6: 추가 조건 체크)
    if (lockTimer <= 0 && Math.abs(active.angularVelocity) < 0.05) {
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

      // 문제 3: 라인 클리어 후 파편 재낙하 보장
      const fixedBodies = clearedBodies.map((b) => {
        if (!b.isStatic) {
          // 파편은 반드시 isStatic=false + velocity 초기화
          return { ...b, isStatic: false, velocity: { x: 0, y: 0 }, angularVelocity: 0 };
        }
        return b;
      });

      // 점수 계산
      const scoreTable = [0, 100, 300, 500, 800];
      const addScore = (scoreTable[linesCleared] ?? linesCleared * 200) * state.level;
      const totalLines = state.linesCleared + linesCleared;
      const newLevel = Math.floor(totalLines / 10) + 1;

      // 7. 새 블록 생성
      const newActive = { ...state.nextBody };
      const newNext = createRandomBody(SPAWN_X, SPAWN_Y);

      // 문제 5: 게임 오버 체크는 grace period 후에만
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
        graceTimer: GRACE_PERIOD, // 새 블록 생성 시 유예 시작
      };
    }
  } else {
    // 착지면에서 떨어지면 lockTimer 리셋
    lockTimer = 0;
  }

  return {
    ...state,
    activeBody: active,
    lockTimer,
    lockResets,
    graceTimer,
  };
}

// ------------------------------------------------------------
// moveActive: 좌우 이동 (문제 2: lockTimer 리셋)
// ------------------------------------------------------------

export function moveActive(
  state: NotTetrisState,
  direction: 'left' | 'right'
): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const moveSpeed = CELL_SIZE;
  const dx = direction === 'left' ? -moveSpeed : moveSpeed;

  const moved: RigidBody = {
    ...state.activeBody,
    position: {
      x: state.activeBody.position.x + dx,
      y: state.activeBody.position.y,
    },
  };

  const { body } = checkWallCollision(moved, BOARD_WIDTH, BOARD_HEIGHT);

  for (const s of state.bodies) {
    if (checkBodyCollision(body, s).colliding) {
      return state;
    }
  }

  // Lock delay 리셋 (최대 MAX_LOCK_RESETS 회)
  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;
  if (lockTimer > 0 && lockResets < MAX_LOCK_RESETS) {
    lockTimer = LOCK_DELAY;
    lockResets++;
  }

  return { ...state, activeBody: body, lockTimer, lockResets };
}

// ------------------------------------------------------------
// snapRotate: 90도 즉시 회전 (문제 2: lockTimer 리셋)
// ------------------------------------------------------------

export function snapRotate(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const rotated: RigidBody = {
    ...state.activeBody,
    angle: state.activeBody.angle + Math.PI / 2,
    angularVelocity: 0,
  };

  const { body } = checkWallCollision(rotated, BOARD_WIDTH, BOARD_HEIGHT);
  for (const s of state.bodies) {
    if (checkBodyCollision(body, s).colliding) {
      return state;
    }
  }

  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;
  if (lockTimer > 0 && lockResets < MAX_LOCK_RESETS) {
    lockTimer = LOCK_DELAY;
    lockResets++;
  }

  return { ...state, activeBody: body, lockTimer, lockResets };
}

// ------------------------------------------------------------
// applyRotation: 자유 회전 Q/E (문제 2: lockTimer 리셋)
// ------------------------------------------------------------

export function applyRotation(
  state: NotTetrisState,
  direction: 'cw' | 'ccw'
): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const impulse = direction === 'cw' ? 3.0 : -3.0;

  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;
  if (lockTimer > 0 && lockResets < MAX_LOCK_RESETS) {
    lockTimer = LOCK_DELAY;
    lockResets++;
  }

  return {
    ...state,
    activeBody: {
      ...state.activeBody,
      angularVelocity: state.activeBody.angularVelocity + impulse,
    },
    lockTimer,
    lockResets,
  };
}

// ------------------------------------------------------------
// softDrop: 소프트 드롭 (문제 1: 2배속 일시 적용)
// ------------------------------------------------------------

export function softDrop(state: NotTetrisState): NotTetrisState {
  if (!state.activeBody || state.isGameOver) return state;

  const dropBoost = getDropSpeed(state.level); // 추가 낙하분

  return {
    ...state,
    activeBody: {
      ...state.activeBody,
      position: {
        x: state.activeBody.position.x,
        y: state.activeBody.position.y + dropBoost * 0.016, // 1프레임분 추가 낙하
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
  const step = 2;

  while (true) {
    const next: RigidBody = {
      ...body,
      position: { x: body.position.x, y: body.position.y + step },
    };

    const { landed } = checkWallCollision(next, BOARD_WIDTH, BOARD_HEIGHT);
    if (landed) break;

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

  // 파편 재낙하 보장 (문제 3)
  const fixedBodies = clearedBodies.map((b) => {
    if (!b.isStatic) {
      return { ...b, velocity: { x: 0, y: 0 }, angularVelocity: 0 };
    }
    return b;
  });

  const scoreTable = [0, 100, 300, 500, 800];
  const addScore =
    ((scoreTable[linesCleared] ?? linesCleared * 200) * state.level) +
    Math.floor(dropDistance / CELL_SIZE) * 2;

  const totalLines = state.linesCleared + linesCleared;
  const newLevel = Math.floor(totalLines / 10) + 1;

  const newActive = { ...state.nextBody };
  const newNext = createRandomBody(SPAWN_X, SPAWN_Y);

  let isGameOver = false;
  for (const b of fixedBodies) {
    const collision = checkBodyCollision(newActive, b);
    if (collision.colliding && collision.depth && collision.depth > CELL_SIZE * 0.5) {
      isGameOver = true;
      break;
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
    newActive = { ...state.nextBody };
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

  return {
    ...state,
    activeBody: newActive,
    nextBody: newNext,
    heldBody: toHold,
    canHold: false,
    lockTimer: 0,
    lockResets: 0,
    graceTimer: GRACE_PERIOD,
  };
}

export { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE };
