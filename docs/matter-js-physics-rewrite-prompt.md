# Not Tetris 2 물리 엔진 — Matter.js 기반 완전 재작성 프롬프트

> 원본: https://github.com/Stabyourself/nottetris2 (gameA.lua)
> 원본은 LÖVE love.physics (Box2D 래퍼) 사용
> JS 대응: Matter.js (Box2D 수준의 실제 물리 엔진)
> 현재 SAT 직접 구현체(engine2d.ts, notTetrisState.ts)는 충돌 해소 버그로 폐기

---

## 원본 gameA.lua 핵심 로직 분석

```
블록 생성:
  love.physics.newBody(world, x, y)           → Matter.Bodies (body)
  love.physics.newRectangleShape(body, x, y, 32, 32)  → Matter.Bodies.rectangle per cell

이동:
  tetribodies[1]:applyForce(-70, 0)            → Matter.Body.applyForce
  tetribodies[1]:applyTorque(70)               → Matter.Body.setAngularVelocity (incremental)
  tetribodies[1]:setLinearVelocity(0, speed)   → Matter.Body.setVelocity

낙하 속도:
  difficulty_speed = 100 (px/s)
  if vy > difficulty_speed: setLinearVelocity(x, vy-2000*dt)   → 속도 캡
  setLinearVelocity(0, difficulty_speed) 초기 설정

라인 밀도:
  linearea[i] > 1024 * linecleartreshold       → 영역 기반 (not 카운트 기반)
  cellSize=32, 1024 = 32*32 = 한 칸 넓이
  threshold 0.5~1.0 (기본 ~0.9)

라인 클리어:
  removeline(lineno): refineshape()로 각 body의 shape을 수평선 기준으로 절단
  위쪽 조각: 새 body로 재생성 (중력 다시 적용)
  아래쪽 조각: 삭제

물리 설정:
  setLinearDamping(0.5)                         → frictionAir: 0.05 (Matter.js)
  setBullet(true)                               → Matter.js default collisions
  world gravity: 0, 500 (y축)                  → Matter.Engine gravity.y = ~1.0 (normalized)
```

---

## 작업 지시

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

지금까지 직접 구현한 SAT 충돌 감지 기반 물리 엔진에
충돌 해소 버그가 지속적으로 발생하고 있어.

원본 Not Tetris 2 (gameA.lua)는 love.physics (Box2D)를 사용하고 있어.
이를 JS에서 동일하게 구현하기 위해 Matter.js를 사용해서
물리 엔진을 완전히 재작성해줘.

---

## Step 0: Matter.js 설치

package.json에 추가:
npm install matter-js
npm install --save-dev @types/matter-js

---

## Step 1: 파일 구조

아래 파일들을 새로 작성해줘:
- src/physics/matterEngine.ts   ← Matter.js 기반 물리 엔진
- src/physics/matterState.ts    ← 게임 상태 관리 (notTetrisState.ts 대체)
- src/physics/matterRenderer.ts ← Canvas 렌더링 (renderer.ts 대체)
- src/physics/matterLinecut.ts  ← 라인 클리어 (linecut.ts 대체)

기존 파일(engine2d.ts, notTetrisState.ts, renderer.ts, linecut.ts)은
삭제하지 말고 .bak 확장자로 이름 변경.

---

## Step 2: matterEngine.ts

Matter.js 물리 엔진 초기화 + 블록 생성 유틸리티.

```typescript
import Matter from 'matter-js';

// 원본 gameA.lua 상수
export const CELL_SIZE = 32;        // 원본과 동일
export const BOARD_COLS = 10;
export const BOARD_ROWS = 18;       // 원본은 18줄 감지
export const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;   // 320px
export const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;  // 576px
export const DIFFICULTY_SPEED = 100; // 원본 difficulty_speed = 100 (px/s)
export const LINEAR_DAMPING = 0.05;  // 원본 setLinearDamping(0.5) → Matter frictionAir
export const TORQUE_STRENGTH = 0.002; // 회전력 (applyTorque 70 대응)
export const FORCE_STRENGTH = 0.004; // 이동력 (applyForce 70 대응)

// 원본 테트로미노 정의 (gameA.lua createtetriA 기준)
// 각 셀은 CELL_SIZE 크기의 사각형, body 중심 기준 상대 좌표
export const TETROMINO_CELLS: Record<number, {x: number, y: number}[]> = {
  1: [{x:-48,y:0},{x:-16,y:0},{x:16,y:0},{x:48,y:0}],     // I
  2: [{x:-32,y:-16},{x:0,y:-16},{x:32,y:-16},{x:32,y:16}], // J
  3: [{x:-32,y:-16},{x:0,y:-16},{x:32,y:-16},{x:-32,y:16}],// L
  4: [{x:-16,y:-16},{x:16,y:-16},{x:16,y:16},{x:-16,y:16}],// O
  5: [{x:-32,y:16},{x:0,y:-16},{x:32,y:-16},{x:0,y:16}],   // S
  6: [{x:-32,y:-16},{x:0,y:-16},{x:32,y:-16},{x:0,y:16}],  // T
  7: [{x:0,y:16},{x:0,y:-16},{x:32,y:16},{x:-32,y:-16}],   // Z
};

export const TETROMINO_COLORS: Record<number, string> = {
  1: '#00f0f0', 2: '#0000f0', 3: '#f0a000',
  4: '#f0f000', 5: '#00f000', 6: '#a000f0', 7: '#f00000',
};

/**
 * 원본 createtetriA 대응:
 * 테트로미노 body 생성 - 각 셀을 compound body로 만들기
 * Matter.js는 compound body를 지원함
 */
export function createTetromino(
  engine: Matter.Engine,
  kind: number,  // 1-7
  x: number,
  y: number
): Matter.Body {
  const cells = TETROMINO_CELLS[kind];
  const color = TETROMINO_COLORS[kind];
  const half = CELL_SIZE / 2;

  // 각 셀을 개별 Part로 만들어 compound body 구성
  const parts = cells.map(cell =>
    Matter.Bodies.rectangle(
      cell.x, cell.y, CELL_SIZE, CELL_SIZE,
      { label: 'cell' }
    )
  );

  const body = Matter.Body.create({
    parts,
    frictionAir: LINEAR_DAMPING,
    restitution: 0.1,   // 약간의 반발
    friction: 0.3,
    isSleeping: false,
  });

  // body 위치 설정
  Matter.Body.setPosition(body, { x, y });

  // 초기 낙하 속도 설정 (원본: setLinearVelocity(0, difficulty_speed))
  // Matter.js 속도는 px/frame 단위, 60fps 기준
  Matter.Body.setVelocity(body, { x: 0, y: DIFFICULTY_SPEED / 60 });

  // 커스텀 데이터 저장
  (body as any).color = color;
  (body as any).kind = kind;
  (body as any).isActive = true; // 현재 조작 중인 블록

  Matter.Composite.add(engine.world, body);
  return body;
}

/**
 * Matter.js Engine + World 초기화
 * 원본: world = love.physics.newWorld(0, -720, 960, 1200, 0, 500, true)
 * y축 중력 500 (픽셀 단위 → Matter.js gravity.y로 변환)
 */
export function createPhysicsEngine(): Matter.Engine {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 1.0 },  // 기본값, 아래에서 조정
    // positionIterations: 10,  // 충돌 해소 정밀도 향상
    // velocityIterations: 10,
  });

  // 원본 중력: y=500 (px/s²), 60fps 기준 Matter.js gravity.y 조정
  // Matter.js: position += velocity * delta, velocity += gravity * delta
  // delta = 1/60 ≈ 0.016, gravity.y=1.0 → velocity.y += 1.0 per frame
  // 원본은 setLinearVelocity로 speed를 cap하므로 gravity는 보조적
  engine.gravity.y = 0.5; // 적당한 중력

  return engine;
}

/**
 * 벽 + 바닥 생성
 * 원본: wallshapes[0~3] - left, right, ground, ceiling
 */
export function createWalls(engine: Matter.Engine): void {
  const thickness = 50;
  const opts = { isStatic: true, label: 'wall', friction: 0.00001 };

  const walls = [
    // 바닥
    Matter.Bodies.rectangle(
      BOARD_WIDTH / 2, BOARD_HEIGHT + thickness / 2,
      BOARD_WIDTH, thickness, { ...opts, label: 'ground' }
    ),
    // 왼쪽 벽
    Matter.Bodies.rectangle(
      -thickness / 2, BOARD_HEIGHT / 2,
      thickness, BOARD_HEIGHT * 2, { ...opts, label: 'left' }
    ),
    // 오른쪽 벽
    Matter.Bodies.rectangle(
      BOARD_WIDTH + thickness / 2, BOARD_HEIGHT / 2,
      thickness, BOARD_HEIGHT * 2, { ...opts, label: 'right' }
    ),
  ];

  Matter.Composite.add(engine.world, walls);
}
```

---

## Step 3: matterState.ts

게임 상태 관리. 원본 gameA_update/gameA_load 대응.

```typescript
import Matter from 'matter-js';
import {
  createPhysicsEngine, createWalls, createTetromino,
  CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, DIFFICULTY_SPEED,
  TETROMINO_COLORS, TORQUE_STRENGTH, FORCE_STRENGTH,
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
  }
): MatterGameState {
  if (state.isGameOver) return state;

  const active = state.activeBody;
  const dropSpeed = getDropSpeed(state.level); // px/s

  // --- 키 입력 처리 (원본 gameA_update 키 섹션) ---
  if (active) {
    const vel = active.velocity;
    const pos = active.position;

    // 회전 (원본: applyTorque ±70, 각속도 ±3 cap)
    if (keys.rotateRight) {
      if (active.angularVelocity < 3) {
        Matter.Body.setAngularVelocity(
          active,
          active.angularVelocity + TORQUE_STRENGTH * 70
        );
      }
    }
    if (keys.rotateLeft) {
      if (active.angularVelocity > -3) {
        Matter.Body.setAngularVelocity(
          active,
          active.angularVelocity - TORQUE_STRENGTH * 70
        );
      }
    }

    // 좌우 이동 (원본: applyForce ±70)
    if (keys.left) {
      Matter.Body.applyForce(active, pos, { x: -FORCE_STRENGTH * 70, y: 0 });
    }
    if (keys.right) {
      Matter.Body.applyForce(active, pos, { x: FORCE_STRENGTH * 70, y: 0 });
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
    Matter.Composite.allBodies(state.engine),
    BOARD_HEIGHT,
    BOARD_WIDTH,
    CELL_SIZE
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
  // → body가 spawn 위치보다 높이 올라가면 게임 오버
  const allBodies = Matter.Composite.allBodies(state.engine)
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
    CELL_SIZE * 1.5
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
      BOARD_WIDTH / 2, CELL_SIZE * 1.5
    );
    newHeldKind = currentKind;
  } else {
    // 처음 보관: 다음 블록으로 교체
    newActiveBody = createTetromino(
      state.engine, state.nextKind,
      BOARD_WIDTH / 2, CELL_SIZE * 1.5
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
  level: number
): number {
  const avgArea = lineAreas.reduce((a, b) => a + b, 0) / numLines / 10240;
  return Math.ceil((numLines * 3) ** (avgArea ** 10) * 20 + numLines ** 2 * 40);
}
```

---

## Step 4: matterLinecut.ts

라인 밀도 체크 + 클리어. 원본 checklinedensity + removeline 대응.

```typescript
import Matter from 'matter-js';
import { CELL_SIZE } from './matterEngine';

/**
 * 원본 linearea[i] > 1024 * linecleartreshold 대응
 * 각 행의 블록 점유 면적을 계산 (폴리곤 면적 기반)
 *
 * Matter.js body.vertices로 각 행의 단면 x 범위를 계산
 */
export function checkLineDensity(
  bodies: Matter.Body[],
  boardHeight: number,
  boardWidth: number,
  cellSize: number,
  threshold = 0.9  // 원본 linecleartreshold
): { linesToClear: number[]; lineAreas: number[] } {
  const numRows = Math.floor(boardHeight / cellSize); // 18행
  const lineAreas: number[] = new Array(numRows).fill(0);

  for (const body of bodies) {
    if (body.isStatic) continue;  // 벽/바닥 제외
    if (!(body as any).kind) continue; // 테트로미노만

    // body의 모든 꼭짓점으로 각 행 커버리지 계산
    const verts = body.vertices;

    for (let row = 0; row < numRows; row++) {
      const lineTop = row * cellSize;
      const lineBottom = lineTop + cellSize;

      // 이 body가 이 행에 겹치는 x 범위 계산
      const xs = verts
        .filter(v => v.y >= lineTop && v.y <= lineBottom)
        .map(v => v.x);

      if (xs.length >= 2) {
        const minX = Math.max(0, Math.min(...xs));
        const maxX = Math.min(boardWidth, Math.max(...xs));
        if (maxX > minX) {
          lineAreas[row] += (maxX - minX) * cellSize;
        }
      }
    }
  }

  // threshold 초과 행 수집
  const fullCellArea = cellSize * cellSize; // 1024 (32*32)
  const linesToClear: number[] = [];

  for (let row = 0; row < numRows; row++) {
    if (lineAreas[row] >= fullCellArea * boardWidth / cellSize * threshold) {
      linesToClear.push(row);
    }
  }

  return { linesToClear, lineAreas };
}

/**
 * 원본 removeline(lineno) 대응
 * 수평선으로 bodies를 절단하여 위쪽만 남기고 아래쪽 삭제
 * 절단된 위쪽 body는 중력에 의해 다시 낙하
 */
export function removeLine(
  engine: Matter.Engine,
  row: number,
  cellSize: number
): void {
  const lineTop = row * cellSize;
  const lineBottom = lineTop + cellSize;
  const bodies = Matter.Composite.allBodies(engine.world)
    .filter(b => !b.isStatic && (b as any).kind);

  for (const body of bodies) {
    const verts = body.vertices;
    const minY = Math.min(...verts.map(v => v.y));
    const maxY = Math.max(...verts.map(v => v.y));

    // 이 body가 클리어 라인과 겹치는지
    if (maxY <= lineTop || minY >= lineBottom) {
      // 겹치지 않음 → 그대로 유지
      continue;
    }

    const kind = (body as any).kind;
    const color = (body as any).color;

    // body 제거
    Matter.Composite.remove(engine.world, body);

    // 클리어 라인 위쪽 부분만 새 body로 재생성
    const aboveVerts = clipVertsAboveLine(verts, lineTop);

    if (aboveVerts.length >= 3) {
      // 새 body 생성 (중력 다시 받도록 isStatic=false)
      const newBody = Matter.Bodies.fromVertices(
        centroid(aboveVerts).x,
        centroid(aboveVerts).y,
        aboveVerts,
        {
          isStatic: false,
          frictionAir: 0.05,
          restitution: 0.1,
          friction: 0.3,
          label: 'fragment',
        }
      );
      (newBody as any).kind = kind;
      (newBody as any).color = color;
      (newBody as any).isActive = false;

      // 초기 속도 0으로 재낙하 시작
      Matter.Body.setVelocity(newBody, { x: 0, y: 0 });
      Matter.Composite.add(engine.world, newBody);
    }
    // 아래쪽 부분은 삭제 (추가 안 함)
  }
}

/**
 * lineY 위쪽 꼭짓점만 추출 (클리핑)
 */
function clipVertsAboveLine(verts: Matter.Vector[], lineY: number): Matter.Vector[] {
  const result: Matter.Vector[] = [];
  for (let i = 0; i < verts.length; i++) {
    const curr = verts[i];
    const next = verts[(i + 1) % verts.length];
    if (curr.y <= lineY) result.push(curr);
    if ((curr.y < lineY) !== (next.y < lineY)) {
      // 교차점
      const t = (lineY - curr.y) / (next.y - curr.y);
      result.push({ x: curr.x + t * (next.x - curr.x), y: lineY });
    }
  }
  return result;
}

function centroid(verts: Matter.Vector[]): Matter.Vector {
  const x = verts.reduce((s, v) => s + v.x, 0) / verts.length;
  const y = verts.reduce((s, v) => s + v.y, 0) / verts.length;
  return { x, y };
}
```

---

## Step 5: matterRenderer.ts

Canvas 렌더링. 원본 gameA_draw 대응.

```typescript
import Matter from 'matter-js';
import { CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, TETROMINO_COLORS } from './matterEngine';

export function renderMatterFrame(
  ctx: CanvasRenderingContext2D,
  engine: Matter.Engine,
  activeBody: Matter.Body | null
): void {
  // 배경
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // 그리드
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= BOARD_WIDTH; x += CELL_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, BOARD_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y <= BOARD_HEIGHT; y += CELL_SIZE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BOARD_WIDTH, y); ctx.stroke();
  }

  // 모든 테트로미노 렌더링
  const bodies = Matter.Composite.allBodies(engine.world)
    .filter(b => !b.isStatic && (b as any).kind);

  for (const body of bodies) {
    drawBody(ctx, body, body === activeBody);
  }
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  isActive: boolean
): void {
  const color = (body as any).color ?? '#ffffff';
  const verts = body.vertices;

  if (verts.length < 3) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(verts[i].x, verts[i].y);
  }
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  // 활성 블록 테두리 강조
  ctx.strokeStyle = isActive
    ? 'rgba(255,255,255,0.5)'
    : 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/**
 * Next/Hold 미리보기
 */
export function renderPreviewKind(
  ctx: CanvasRenderingContext2D,
  kind: number | null
): void {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (kind === null) return;

  // ... 간단한 미리보기 렌더링 (기존 renderPreviewBody 유사)
}
```

---

## Step 6: index.ts 연결

src/app/index.ts에서 기존 notTetrisState import를 matterState로 교체:

```typescript
// 기존
import { initNotTetrisState, nextTick, moveActive, ... } from '../physics/notTetrisState';

// 교체
import {
  initMatterState,
  updateMatter,
  lockAndSpawnNew,
  snapRotateMatter,
  hardDropMatter,
  holdMatter,
  MatterGameState,
} from '../physics/matterState';
import { renderMatterFrame } from '../physics/matterRenderer';

let gameState: MatterGameState = initMatterState();
```

gameLoop 함수에서:
```typescript
function gameLoop(timestamp: number): void {
  const dt = lastTimestamp > 0
    ? Math.min((timestamp - lastTimestamp) / 1000, 0.05)
    : 1/60;
  lastTimestamp = timestamp;

  // 착지 감지: 활성 블록 속도가 거의 0이고 바닥/블록에 닿아있으면
  if (gameState.activeBody) {
    const vel = gameState.activeBody.velocity;
    const speed = Math.sqrt(vel.x**2 + vel.y**2);
    if (speed < 0.1 && isBodyOnGround(gameState)) {
      gameState = lockAndSpawnNew(gameState);
    }
  }

  gameState = updateMatter(gameState, dt, getCurrentKeys());

  const ctx = boardCanvas.getContext('2d');
  if (ctx) renderMatterFrame(ctx, gameState.engine, gameState.activeBody);

  // ...
}

// 착지 판정: activeBody가 바닥 또는 다른 body와 접촉 중인지
function isBodyOnGround(state: MatterGameState): boolean {
  if (!state.activeBody) return false;
  const pairs = state.engine.pairs.list;  // 현재 충돌 쌍
  return pairs.some(pair =>
    pair.bodyA === state.activeBody || pair.bodyB === state.activeBody
  );
}
```

---

## 완료 후 커밋 순서

```bash
# 1. Matter.js 설치
npm install matter-js @types/matter-js

# 2. 파일 작성
# matterEngine.ts, matterState.ts, matterLinecut.ts, matterRenderer.ts

# 3. 기존 파일 백업
# engine2d.ts → engine2d.ts.bak
# notTetrisState.ts → notTetrisState.ts.bak
# renderer.ts → renderer.ts.bak
# linecut.ts → linecut.ts.bak

# 4. index.ts 연결

# 5. 테스트 후 커밋
git commit -m "feat(physics): Matter.js 기반 Not Tetris 2 물리 엔진 재작성"
```

---

## 핵심 차이 정리

| 항목 | 기존 (SAT 직접) | 원본 / 신규 (Matter.js) |
|---|---|---|
| 충돌 감지 | 직접 구현 SAT → 버그 | Matter.js 내장 (Box2D 수준) |
| 충돌 해소 | MTV 직접 보정 → 갭 발생 | Matter.js 자동 처리 |
| 중력 | 매 프레임 수동 누적 | Matter.js 물리 시뮬레이션 |
| 마찰/반발 | 없음 | frictionAir, restitution |
| 블록 간 겹침 | 발생 | 물리 엔진이 원천 차단 |
| 라인 클리어 | 면적 계산 버그 | Sutherland-Hodgman 클리핑 |
