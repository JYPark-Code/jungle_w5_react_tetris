import Matter from 'matter-js';
import {
  createPhysicsEngine, createWalls, createTetromino,
  CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, DIFFICULTY_SPEED,
  TORQUE_STRENGTH, FORCE_STRENGTH,
} from './matterEngine';
import { checkLineDensity, removeLine } from './matterLinecut';

// 게임 상태 인터페이스
export interface MatterGameState {
  engine: Matter.Engine;
  activeBody: Matter.Body | null;  // 현재 조작 중인 블록 (tetribodies[1])
  nextKind: number;                // 다음 블록 종류 (1-7)
  heldKind: number | null;         // 보관 블록
  canHold: boolean;
  score: number;
  level: number;
  linesCleared: number;
  isGameOver: boolean;
  isCutting: boolean;              // 라인 클리어 애니메이션 중
  cuttingTimer: number;
}

const SPAWN_X = BOARD_WIDTH / 2;  // 원본: 224 (중앙)
const SPAWN_Y = CELL_SIZE * 1.5;  // 원본: blockstartY

export function initMatterState(): MatterGameState {
  const engine = createPhysicsEngine();
  createWalls(engine);

  const nextKind = Math.ceil(Math.random() * 7);
  const firstKind = Math.ceil(Math.random() * 7);
  const activeBody = createTetromino(engine, firstKind, SPAWN_X, SPAWN_Y);

  return {
    engine,
    activeBody,
    nextKind,
    heldKind: null,
    canHold: true,
    score: 0,
    level: 1,
    linesCleared: 0,
    isGameOver: false,
    isCutting: false,
    cuttingTimer: 0,
  };
}

/**
 * 매 프레임 업데이트 (원본 gameA_update)
 * dt: 경과 시간 (초)
 */
export function updateMatter(
  state: MatterGameState,
  dt: number,
  keys: {
    left: boolean;
    right: boolean;
    rotateLeft: boolean;  // Q
    rotateRight: boolean; // E
    down: boolean;        // 소프트드롭
  },
): MatterGameState {
  if (state.isGameOver) return state;

  const active = state.activeBody;
  const dropSpeed = getDropSpeed(state.level); // px/s

  // --- 키 입력 처리 (원본 gameA_update 키 섹션) ---
  if (active) {
    const vel = active.velocity;
    const pos = active.position;

    // 회전 (각속도 캡: ±0.15 rad/frame)
    if (keys.rotateRight) {
      if (active.angularVelocity < 0.15) {
        Matter.Body.setAngularVelocity(
          active,
          active.angularVelocity + TORQUE_STRENGTH * 70,
        );
      }
    }
    if (keys.rotateLeft) {
      if (active.angularVelocity > -0.15) {
        Matter.Body.setAngularVelocity(
          active,
          active.angularVelocity - TORQUE_STRENGTH * 70,
        );
      }
    }

    // 좌우 이동 (속도 캡: ±3 px/frame)
    const MAX_VX = 3;
    if (keys.left) {
      if (vel.x > -MAX_VX) {
        Matter.Body.applyForce(active, pos, { x: -FORCE_STRENGTH * 70, y: 0 });
      }
    }
    if (keys.right) {
      if (vel.x < MAX_VX) {
        Matter.Body.applyForce(active, pos, { x: FORCE_STRENGTH * 70, y: 0 });
      }
    }

    // 키를 안 누를 때 수평 속도 감쇠
    if (!keys.left && !keys.right) {
      Matter.Body.setVelocity(active, {
        x: vel.x * 0.85,
        y: vel.y,
      });
    }

    // 낙하 속도 제어 (원본 핵심 로직)
    // 원본: if vy > difficulty_speed → setLinearVelocity(x, vy-2000*dt)
    //       else → 소프트드롭 시 applyForce(0, 20)
    const vy = vel.y * 60; // px/frame → px/s 변환

    if (keys.down) {
      // 소프트드롭: 원본 applyForce(0, 20)
      if (vy <= 500) {
        Matter.Body.applyForce(active, pos, { x: 0, y: FORCE_STRENGTH * 20 });
      } else {
        // 최대 속도 500px/s 캡
        Matter.Body.setVelocity(active, { x: vel.x, y: 500 / 60 });
      }
    } else {
      // 일반 낙하: 속도를 difficulty_speed로 유지
      if (vy > dropSpeed) {
        // 원본: setLinearVelocity(x, vy - 2000*dt)
        const newVy = Math.max(dropSpeed, vy - 2000 * dt);
        Matter.Body.setVelocity(active, { x: vel.x, y: newVy / 60 });
      }
      // vy < dropSpeed면 중력이 알아서 끌어올림
    }
  }

  // --- Matter.js 물리 시뮬레이션 ---
  Matter.Engine.update(state.engine, dt * 1000); // ms 단위

  // --- 라인 밀도 체크 + 클리어 ---
  const { linesToClear, lineAreas } = checkLineDensity(
    Matter.Composite.allBodies(state.engine.world),
    BOARD_HEIGHT,
    BOARD_WIDTH,
    CELL_SIZE,
  );

  let newState = { ...state };

  if (linesToClear.length > 0 && !state.isCutting) {
    // 라인 클리어 실행 (원본 removeline)
    for (const lineNo of linesToClear) {
      removeLine(state.engine, lineNo, CELL_SIZE);
    }

    const scoreAdd = calcScore(linesToClear.length, lineAreas, state.level);
    const newLinesCleared = state.linesCleared + linesToClear.length;
    const newLevel = Math.floor(newLinesCleared / 10) + 1;

    newState = {
      ...newState,
      score: state.score + scoreAdd,
      linesCleared: newLinesCleared,
      level: newLevel,
    };
  }

  // --- 게임 오버 체크 ---
  // 원본: failingA - bodies가 천장(y < -64) 위로 나가면 게임 오버
  const allBodies = Matter.Composite.allBodies(state.engine.world)
    .filter(b => !b.isStatic && (b as any).kind);

  for (const body of allBodies) {
    if (body.position.y < -CELL_SIZE * 2) {
      return { ...newState, isGameOver: true };
    }
  }

  return newState;
}

/**
 * 활성 블록 착지 후 새 블록 생성 (원본 game_addTetriA + endblockA)
 * Matter.js 충돌 이벤트로 트리거하거나, 속도 임계치로 판단
 */
export function lockAndSpawnNew(state: MatterGameState): MatterGameState {
  if (!state.activeBody) return state;

  // 현재 블록을 isActive = false (더 이상 조작 불가)
  (state.activeBody as any).isActive = false;
  // 마찰 증가 → 미끄러짐 방지
  state.activeBody.friction = 0.8;

  // 새 블록 생성
  const newBody = createTetromino(
    state.engine,
    state.nextKind,
    BOARD_WIDTH / 2,
    CELL_SIZE * 1.5,
  );

  const newNextKind = Math.ceil(Math.random() * 7);

  return {
    ...state,
    activeBody: newBody,
    nextKind: newNextKind,
    canHold: true,
  };
}

/**
 * 90도 즉시 회전 (↑ 키)
 */
export function snapRotateMatter(state: MatterGameState): MatterGameState {
  if (!state.activeBody) return state;
  const current = state.activeBody.angle;
  Matter.Body.setAngle(state.activeBody, current + Math.PI / 2);
  Matter.Body.setAngularVelocity(state.activeBody, 0);
  return state;
}

/**
 * 하드드롭 (Space)
 * 원본에는 없지만 UX를 위해 추가
 */
export function hardDropMatter(state: MatterGameState): MatterGameState {
  if (!state.activeBody) return state;
  // 매우 큰 아래 속도로 즉시 착지
  Matter.Body.setVelocity(state.activeBody, { x: 0, y: 20 });
  Matter.Body.setAngularVelocity(state.activeBody, 0);
  return state;
}

/**
 * 블록 보관 (R 키)
 */
export function holdMatter(state: MatterGameState): MatterGameState {
  if (!state.canHold || !state.activeBody) return state;

  const currentKind = (state.activeBody as any).kind as number;
  Matter.Composite.remove(state.engine.world, state.activeBody);

  let newActiveBody: Matter.Body;
  let newHeldKind: number;
  let newNextKind = state.nextKind;

  if (state.heldKind !== null) {
    // 보관된 블록 꺼내기
    newActiveBody = createTetromino(
      state.engine, state.heldKind,
      BOARD_WIDTH / 2, CELL_SIZE * 1.5,
    );
    newHeldKind = currentKind;
  } else {
    // 처음 보관: 다음 블록으로 교체
    newActiveBody = createTetromino(
      state.engine, state.nextKind,
      BOARD_WIDTH / 2, CELL_SIZE * 1.5,
    );
    newHeldKind = currentKind;
    newNextKind = Math.ceil(Math.random() * 7);
  }

  return {
    ...state,
    activeBody: newActiveBody,
    heldKind: newHeldKind,
    nextKind: newNextKind,
    canHold: false,
  };
}

// 낙하 속도 (원본: difficulty_speed = 100 + level*7)
function getDropSpeed(level: number): number {
  return 100 + (level - 1) * 7;
}

// 점수 계산 (원본 scoring formula)
function calcScore(
  numLines: number,
  lineAreas: number[],
  level: number,
): number {
  // level 매개변수는 향후 확장을 위해 보존
  void level;
  const avgArea = lineAreas.reduce((a, b) => a + b, 0) / numLines / 10240;
  return Math.ceil((numLines * 3) ** (avgArea ** 10) * 20 + numLines ** 2 * 40);
}
