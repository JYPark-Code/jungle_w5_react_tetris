// ============================================================
// tetrominos.ts — 테트로미노 강체 정의 (Not Tetris 2 방식)
// 각 블록을 중심(0,0) 기준 꼭짓점 배열로 정의
// 셀 크기: 28px
// ============================================================

import type { Vec2, RigidBody } from '../../contracts';

const S = 28; // 셀 크기 (픽셀)
const H = S / 2; // 반쪽 셀

// ------------------------------------------------------------
// 7종 테트로미노 꼭짓점 정의
// 각 블록은 중심(0,0) 기준의 외곽 꼭짓점으로 정의
// L자, T자 등 복잡한 모양은 외곽선을 따라 꼭짓점을 나열
// ------------------------------------------------------------

interface TetrominoDef {
  localVertices: Vec2[];
  color: string;
}

/** I 블록 — 4x1 직사각형 */
const I_PIECE: TetrominoDef = {
  localVertices: [
    { x: -2 * S, y: -H },
    { x: 2 * S, y: -H },
    { x: 2 * S, y: H },
    { x: -2 * S, y: H },
  ],
  color: '#00f0f0',
};

/** O 블록 — 2x2 정사각형 */
const O_PIECE: TetrominoDef = {
  localVertices: [
    { x: -S, y: -S },
    { x: S, y: -S },
    { x: S, y: S },
    { x: -S, y: S },
  ],
  color: '#f0f000',
};

/** J 블록 — L자 뒤집힘 */
const J_PIECE: TetrominoDef = {
  localVertices: [
    { x: -S - H, y: -S },
    { x: -S - H, y: -S - S },
    { x: -H, y: -S - S },
    { x: -H, y: -S },
    { x: S + H, y: -S },
    { x: S + H, y: 0 },
    { x: -S - H, y: 0 },
  ],
  color: '#0000f0',
};

/** L 블록 */
const L_PIECE: TetrominoDef = {
  localVertices: [
    { x: -S - H, y: -S },
    { x: H, y: -S },
    { x: H, y: -S - S },
    { x: S + H, y: -S - S },
    { x: S + H, y: 0 },
    { x: -S - H, y: 0 },
  ],
  color: '#f0a000',
};

/** S 블록 — 외곽선 (중복 꼭짓점 제거) */
const S_PIECE: TetrominoDef = {
  localVertices: [
    { x: -S - H, y: 0 },
    { x: -S - H, y: -S },
    { x: -H, y: -S },
    { x: -H, y: -2 * S },
    { x: S + H, y: -2 * S },
    { x: S + H, y: -S },
    { x: H, y: -S },
    { x: H, y: 0 },
  ],
  color: '#00f000',
};

/** Z 블록 — 외곽선 */
const Z_PIECE: TetrominoDef = {
  localVertices: [
    { x: -S - H, y: -2 * S },
    { x: H, y: -2 * S },
    { x: H, y: -S },
    { x: S + H, y: -S },
    { x: S + H, y: 0 },
    { x: -H, y: 0 },
    { x: -H, y: -S },
    { x: -S - H, y: -S },
  ],
  color: '#f00000',
};

/** T 블록 */
const T_PIECE: TetrominoDef = {
  localVertices: [
    { x: -H, y: -S },
    { x: -H, y: -S - S },
    { x: H, y: -S - S },
    { x: H, y: -S },
    { x: S + H, y: -S },
    { x: S + H, y: 0 },
    { x: -S - H, y: 0 },
    { x: -S - H, y: -S },
  ],
  color: '#a000f0',
};

/** 모든 테트로미노 정의 배열 */
const ALL_PIECES: TetrominoDef[] = [I_PIECE, J_PIECE, L_PIECE, O_PIECE, S_PIECE, Z_PIECE, T_PIECE];

// ------------------------------------------------------------
// createRandomBody: 랜덤 테트로미노 강체 생성
// ------------------------------------------------------------

/**
 * 랜덤 테트로미노를 선택하고 RigidBody로 반환한다.
 * spawn 위치에 배치되며 초기 속도는 0이다.
 */
export function createRandomBody(spawnX: number, spawnY: number): RigidBody {
  const idx = Math.floor(Math.random() * ALL_PIECES.length);
  const def = ALL_PIECES[idx];

  return {
    position: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    localVertices: def.localVertices.map((v) => ({ ...v })),
    color: def.color,
    isStatic: false,
  };
}

/** 특정 인덱스의 테트로미노 생성 (테스트용) */
export function createBody(index: number, spawnX: number, spawnY: number): RigidBody {
  const def = ALL_PIECES[index % ALL_PIECES.length];
  return {
    position: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    localVertices: def.localVertices.map((v) => ({ ...v })),
    color: def.color,
    isStatic: false,
  };
}

export { ALL_PIECES, S as CELL_SIZE };
