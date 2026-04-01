// ============================================================
// engine.ts — Matter.js 핵심 물리를 순수 TypeScript로 포팅
// Compound body (4개 사각형), velocity 기반 이동, SAT 충돌
// 모든 함수는 순수 함수 (state → newState)
// ============================================================

export const CELL_SIZE = 32;
export const BOARD_COLS = 10;
export const BOARD_ROWS = 18;
export const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;   // 320px
export const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;  // 576px
export const GRAVITY = 0.5;       // 중력 가속도 (px/frame²)
export const DROP_SPEED = 100;    // 기본 낙하 속도 (px/s)
export const FRICTION_AIR = 0.05; // 공기 마찰
export const RESTITUTION = 0.0;   // 반발 계수 (테트리스는 튕김 없음)
export const MAX_VY = 15;         // 최대 y 속도 (px/frame)

/** 2D 벡터 */
export interface Vec2 { x: number; y: number; }

/** 블록의 하나의 셀 (사각형) */
export interface Part {
  localVerts: Vec2[];  // 중심 기준 꼭짓점 (회전 전)
}

/** 강체 블록 — compound body (여러 Part로 구성) */
export interface Body {
  id: number;
  parts: Part[];           // 각 셀의 로컬 꼭짓점
  position: Vec2;          // 블록 중심 (픽셀)
  velocity: Vec2;          // 속도 (px/frame)
  angle: number;           // 회전각 (라디안)
  angularVelocity: number; // 각속도 (rad/frame)
  isStatic: boolean;       // 착지 후 true
  mass: number;            // 질량 (셀 수)
  frictionAir: number;     // 공기 마찰
  restitution: number;     // 반발 계수
  color: string;
  kind: number;            // 테트로미노 종류 (1-7)
  isActive: boolean;       // 현재 조작 중
}

// ── Vec2 유틸리티 ──────────────────────────────────────────
export const v2 = {
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s }),
  dot: (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y,
  len: (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y),
  norm: (v: Vec2): Vec2 => {
    const l = Math.sqrt(v.x * v.x + v.y * v.y);
    return l > 0.0001 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
  },
  perp: (v: Vec2): Vec2 => ({ x: -v.y, y: v.x }),
};

// ── 꼭짓점 변환 ────────────────────────────────────────────

/** Part의 localVerts를 월드 좌표로 변환 (회전 + 이동) */
export function getWorldVerts(part: Part, pos: Vec2, angle: number): Vec2[] {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return part.localVerts.map(v => ({
    x: pos.x + v.x * cos - v.y * sin,
    y: pos.y + v.x * sin + v.y * cos,
  }));
}

/** Body의 모든 Part의 월드 좌표를 반환 */
export function getAllWorldVerts(body: Body): Vec2[][] {
  return body.parts.map(p => getWorldVerts(p, body.position, body.angle));
}

// ── SAT 충돌 감지 ──────────────────────────────────────────

/** 다각형을 축에 투영 */
function project(verts: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const v of verts) {
    const p = v2.dot(v, axis);
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

/** 다각형의 모든 모서리에서 법선 벡터(분리축) 추출 */
function getAxes(verts: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < verts.length; i++) {
    axes.push(v2.norm(v2.perp(v2.sub(verts[(i + 1) % verts.length], verts[i]))));
  }
  return axes;
}

interface Collision { colliding: boolean; depth: number; normal: Vec2; }

/** SAT로 두 다각형의 충돌 판정 */
export function checkCollision(va: Vec2[], vb: Vec2[]): Collision {
  let minDepth = Infinity, minNormal: Vec2 = { x: 0, y: 1 };
  const axes = [...getAxes(va), ...getAxes(vb)];
  for (const axis of axes) {
    if (v2.len(axis) < 0.0001) continue;
    const [minA, maxA] = project(va, axis);
    const [minB, maxB] = project(vb, axis);
    // 분리축 발견 → 충돌 없음
    if (maxA < minB || maxB < minA) return { colliding: false, depth: 0, normal: minNormal };
    const depth = Math.min(maxA - minB, maxB - minA);
    if (depth < minDepth) {
      minDepth = depth;
      // MTV 방향: A→B
      const ca = va.reduce((s, v) => v2.add(s, v), { x: 0, y: 0 });
      ca.x /= va.length; ca.y /= va.length;
      const cb = vb.reduce((s, v) => v2.add(s, v), { x: 0, y: 0 });
      cb.x /= vb.length; cb.y /= vb.length;
      minNormal = v2.dot(v2.sub(cb, ca), axis) < 0 ? v2.scale(axis, -1) : axis;
    }
  }
  return { colliding: true, depth: minDepth, normal: minNormal };
}

// ── 테트로미노 정의 ────────────────────────────────────────

const H = CELL_SIZE / 2;

/** 원본 gameA.lua createtetriA 기준 셀 오프셋 */
const TETROMINO_CELLS: Record<number, Vec2[]> = {
  1: [{ x: -48, y: 0 }, { x: -16, y: 0 }, { x: 16, y: 0 }, { x: 48, y: 0 }],      // I
  2: [{ x: -32, y: -16 }, { x: 0, y: -16 }, { x: 32, y: -16 }, { x: 32, y: 16 }],  // J
  3: [{ x: -32, y: -16 }, { x: 0, y: -16 }, { x: 32, y: -16 }, { x: -32, y: 16 }], // L
  4: [{ x: -16, y: -16 }, { x: 16, y: -16 }, { x: 16, y: 16 }, { x: -16, y: 16 }], // O
  5: [{ x: -32, y: 16 }, { x: 0, y: -16 }, { x: 32, y: -16 }, { x: 0, y: 16 }],    // S
  6: [{ x: -32, y: -16 }, { x: 0, y: -16 }, { x: 32, y: -16 }, { x: 0, y: 16 }],   // T
  7: [{ x: 0, y: 16 }, { x: 0, y: -16 }, { x: 32, y: 16 }, { x: -32, y: -16 }],    // Z
};

export const TETROMINO_COLORS: Record<number, string> = {
  1: '#00f0f0', 2: '#0000f0', 3: '#f0a000', 4: '#f0f000',
  5: '#00f000', 6: '#a000f0', 7: '#f00000',
};

/** 셀 하나의 Part 생성 (중심 기준 사각형) */
function makeRectPart(cx: number, cy: number): Part {
  return {
    localVerts: [
      { x: cx - H, y: cy - H },
      { x: cx + H, y: cy - H },
      { x: cx + H, y: cy + H },
      { x: cx - H, y: cy + H },
    ],
  };
}

// ── 테트로미노 생성 ────────────────────────────────────────

let _nextId = 1;

/** 테트로미노 Body 생성 — 각 셀을 Part로 compound body 구성 */
export function createTetromino(kind: number, x: number, y: number): Body {
  return {
    id: _nextId++,
    parts: TETROMINO_CELLS[kind].map(c => makeRectPart(c.x, c.y)),
    position: { x, y },
    velocity: { x: 0, y: DROP_SPEED / 60 },
    angle: 0,
    angularVelocity: 0,
    isStatic: false,
    mass: 4,
    frictionAir: FRICTION_AIR,
    restitution: RESTITUTION,
    color: TETROMINO_COLORS[kind],
    kind,
    isActive: true,
  };
}

// ── 물리 스텝 함수들 ───────────────────────────────────────

/** 중력 + 공기 마찰 적용 */
export function applyGravity(body: Body): Body {
  if (body.isStatic) return body;
  let vx = body.velocity.x * (1 - body.frictionAir);
  let vy = Math.min(body.velocity.y + GRAVITY, MAX_VY);
  let av = body.angularVelocity * 0.9;

  // 매우 작은 속도는 0으로 snap (sleeping — 무한 미세 진동 방지)
  if (Math.abs(vx) < 0.05) vx = 0;
  if (Math.abs(av) < 0.001) av = 0;

  return { ...body, velocity: { x: vx, y: vy }, angularVelocity: av };
}

/** 위치/각도 적분 (velocity → position) */
export function integratePosition(body: Body): Body {
  if (body.isStatic) return body;
  return {
    ...body,
    position: v2.add(body.position, body.velocity),
    angle: body.angle + body.angularVelocity,
  };
}

/** 벽/바닥 제약 적용 */
export function applyWallConstraints(body: Body): Body {
  if (body.isStatic) return body;
  let pos = { ...body.position };
  let vel = { ...body.velocity };
  const allV = body.parts.flatMap(p => getWorldVerts(p, pos, body.angle));
  const minX = Math.min(...allV.map(v => v.x));
  const maxX = Math.max(...allV.map(v => v.x));
  const maxY = Math.max(...allV.map(v => v.y));
  if (minX < 0) { pos.x -= minX; if (vel.x < 0) vel.x = 0; }
  if (maxX > BOARD_WIDTH) { pos.x -= maxX - BOARD_WIDTH; if (vel.x > 0) vel.x = 0; }
  if (maxY > BOARD_HEIGHT) { pos.y -= maxY - BOARD_HEIGHT; vel.y = 0; vel.x *= 0.3; }
  return { ...body, position: pos, velocity: vel };
}

/** 모든 body 간 SAT 충돌 해소 */
export function resolveBodyCollisions(bodies: Body[]): Body[] {
  const result = bodies.map(b => ({
    ...b, position: { ...b.position }, velocity: { ...b.velocity },
  }));
  // 3회 반복으로 깊은 겹침도 완전 해소
  for (let iter = 0; iter < 2; iter++) {
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i], b = result[j];
      if (a.isStatic && b.isStatic) continue;
      // AABB 사전 체크
      const aV = a.parts.flatMap(p => getWorldVerts(p, a.position, a.angle));
      const bV = b.parts.flatMap(p => getWorldVerts(p, b.position, b.angle));
      if (Math.max(...aV.map(v => v.x)) < Math.min(...bV.map(v => v.x))) continue;
      if (Math.min(...aV.map(v => v.x)) > Math.max(...bV.map(v => v.x))) continue;
      if (Math.max(...aV.map(v => v.y)) < Math.min(...bV.map(v => v.y))) continue;
      if (Math.min(...aV.map(v => v.y)) > Math.max(...bV.map(v => v.y))) continue;
      // 각 Part 쌍별 SAT
      for (const pa of a.parts) {
        for (const pb of b.parts) {
          const wva = getWorldVerts(pa, a.position, a.angle);
          const wvb = getWorldVerts(pb, b.position, b.angle);
          const col = checkCollision(wva, wvb);
          if (!col.colliding || col.depth < 0.01) continue;
          // 위치 보정
          const corr = v2.scale(col.normal, col.depth);
          // 상대가 static이면 강하게, 아니면 약하게 보정
          const corrRateA = b.isStatic ? 0.4 : 0.08;
          const corrRateB = a.isStatic ? 0.4 : 0.08;
          if (!a.isStatic) result[i].position = v2.sub(result[i].position, v2.scale(corr, corrRateA));
          if (!b.isStatic) result[j].position = v2.add(result[j].position, v2.scale(corr, corrRateB));
          // 충격량 계산 (impulse)
          const rel = v2.sub(result[i].velocity, result[j].velocity);
          const vn = v2.dot(rel, col.normal);
          if (vn > 0) continue; // 이미 분리 중
          const e = Math.min(a.restitution, b.restitution);
          const ia = a.isStatic ? 0 : 1 / a.mass;
          const ib = b.isStatic ? 0 : 1 / b.mass;
          const jj = -(1 + e) * vn / (ia + ib);
          const imp = v2.scale(col.normal, jj);
          if (!a.isStatic) result[i].velocity = v2.sub(result[i].velocity, v2.scale(imp, ia));
          if (!b.isStatic) result[j].velocity = v2.add(result[j].velocity, v2.scale(imp, ib));
        }
      }
    }
  }
  } // iter 반복 끝
  return result;
}

/** 착지 판정: 1px 아래 가상 이동 후 SAT 충돌 여부로 판정 */
export function checkLanding(body: Body, statics: Body[]): boolean {
  if (body.isStatic) return false;

  // 1px 아래 테스트 위치
  const testPos: Vec2 = { x: body.position.x, y: body.position.y + 1 };

  // 바닥 체크
  const testVerts = body.parts.flatMap(p => getWorldVerts(p, testPos, body.angle));
  if (Math.max(...testVerts.map(v => v.y)) >= BOARD_HEIGHT) return true;

  // static body와 SAT 충돌 체크
  for (const s of statics) {
    for (const pa of body.parts) {
      const wva = getWorldVerts(pa, testPos, body.angle);
      for (const pb of s.parts) {
        const wvb = getWorldVerts(pb, s.position, s.angle);
        if (checkCollision(wva, wvb).colliding) return true;
      }
    }
  }
  return false;
}
