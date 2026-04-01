import Matter from 'matter-js';

// 원본 gameA.lua 상수
export const CELL_SIZE = 32;        // 원본과 동일
export const BOARD_COLS = 10;
export const BOARD_ROWS = 18;       // 원본은 18줄 감지
export const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;   // 320px
export const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;  // 576px
export const DIFFICULTY_SPEED = 100; // 원본 difficulty_speed = 100 (px/s)
export const LINEAR_DAMPING = 0.05;  // 원본 setLinearDamping(0.5) → Matter frictionAir
export const TORQUE_STRENGTH = 0.0001; // 회전력 (원본 applyTorque 70 대응, Matter.js 단위 조정)
export const FORCE_STRENGTH = 0.0002;  // 이동력 (원본 applyForce 70 대응, Matter.js 단위 조정)

// 원본 테트로미노 정의 (gameA.lua createtetriA 기준)
// 각 셀은 CELL_SIZE 크기의 사각형, body 중심 기준 상대 좌표
export const TETROMINO_CELLS: Record<number, { x: number; y: number }[]> = {
  1: [{ x: -48, y: 0 }, { x: -16, y: 0 }, { x: 16, y: 0 }, { x: 48, y: 0 }],      // I
  2: [{ x: -32, y: -16 }, { x: 0, y: -16 }, { x: 32, y: -16 }, { x: 32, y: 16 }],  // J
  3: [{ x: -32, y: -16 }, { x: 0, y: -16 }, { x: 32, y: -16 }, { x: -32, y: 16 }], // L
  4: [{ x: -16, y: -16 }, { x: 16, y: -16 }, { x: 16, y: 16 }, { x: -16, y: 16 }], // O
  5: [{ x: -32, y: 16 }, { x: 0, y: -16 }, { x: 32, y: -16 }, { x: 0, y: 16 }],    // S
  6: [{ x: -32, y: -16 }, { x: 0, y: -16 }, { x: 32, y: -16 }, { x: 0, y: 16 }],   // T
  7: [{ x: 0, y: 16 }, { x: 0, y: -16 }, { x: 32, y: 16 }, { x: -32, y: -16 }],    // Z
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
  y: number,
): Matter.Body {
  const cells = TETROMINO_CELLS[kind];
  const color = TETROMINO_COLORS[kind];

  // 각 셀을 개별 Part로 만들어 compound body 구성
  const parts = cells.map(cell =>
    Matter.Bodies.rectangle(
      cell.x, cell.y, CELL_SIZE, CELL_SIZE,
      { label: 'cell' },
    ),
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
  const engine = Matter.Engine.create();

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
  const thickness = 100;
  const opts: Matter.IChamferableBodyDefinition = { isStatic: true, label: 'wall', friction: 0.00001, restitution: 0 };

  const walls = [
    // 바닥 (보드보다 넓게)
    Matter.Bodies.rectangle(
      BOARD_WIDTH / 2, BOARD_HEIGHT + thickness / 2,
      BOARD_WIDTH + thickness * 2, thickness, { ...opts, label: 'ground' },
    ),
    // 왼쪽 벽
    Matter.Bodies.rectangle(
      -thickness / 2, BOARD_HEIGHT / 2,
      thickness, BOARD_HEIGHT * 3, { ...opts, label: 'left' },
    ),
    // 오른쪽 벽
    Matter.Bodies.rectangle(
      BOARD_WIDTH + thickness / 2, BOARD_HEIGHT / 2,
      thickness, BOARD_HEIGHT * 3, { ...opts, label: 'right' },
    ),
  ];

  Matter.Composite.add(engine.world, walls);
}
