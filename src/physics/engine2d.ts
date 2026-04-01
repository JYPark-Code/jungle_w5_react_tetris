// ============================================================
// engine2d.ts — 2D 강체 물리 엔진 (Not Tetris 2 방식)
// 그리드 기반이 아닌, 픽셀 좌표 연속 이동 + SAT 충돌 감지
// ============================================================

import type { Vec2, RigidBody } from '../../contracts';

// ------------------------------------------------------------
// Vec2 유틸리티
// ------------------------------------------------------------

/** 벡터 덧셈 */
export function v2add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** 벡터 뺄셈 */
export function v2sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** 스칼라 곱 */
export function v2scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

/** 내적 (dot product) — 투영 계산에 사용 */
export function v2dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** 벡터 크기 */
export function v2length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** 법선 벡터 (모서리에 수직인 방향) — SAT에서 분리축으로 사용 */
export function v2normal(edge: Vec2): Vec2 {
  return { x: -edge.y, y: edge.x };
}

// ------------------------------------------------------------
// getWorldVertices: 강체의 실제 꼭짓점 좌표 계산
// ------------------------------------------------------------

/**
 * localVertices를 angle만큼 회전 후 position에 더해 월드 좌표를 반환한다.
 *
 * 회전 행렬:
 *   x' = x * cos(θ) - y * sin(θ)
 *   y' = x * sin(θ) + y * cos(θ)
 */
export function getWorldVertices(body: RigidBody): Vec2[] {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);

  return body.localVertices.map((v) => ({
    x: body.position.x + v.x * cos - v.y * sin,
    y: body.position.y + v.x * sin + v.y * cos,
  }));
}

// ------------------------------------------------------------
// applyGravity: 중력 + 속도 적용 (매 프레임)
// ------------------------------------------------------------

/**
 * 강체에 중력을 적용하고 위치/각도를 업데이트한다.
 *
 * @param body 대상 강체
 * @param dt   경과 시간 (초)
 * @param gravity 중력 가속도 (픽셀/초²)
 */
export function applyGravity(body: RigidBody, dt: number, gravity: number): RigidBody {
  if (body.isStatic) return body;

  const ANGULAR_DAMPING = 0.98; // 각속도 감쇠 — 자연스러운 회전 정지
  const MAX_VY = 200; // 최대 낙하 속도 (px/s) — 장애물 건너뜀 방지

  const newVelocity: Vec2 = {
    x: body.velocity.x,
    y: Math.min(body.velocity.y + gravity * dt, MAX_VY),
  };

  return {
    ...body,
    position: {
      x: body.position.x + newVelocity.x * dt,
      y: body.position.y + newVelocity.y * dt,
    },
    velocity: newVelocity,
    angle: body.angle + body.angularVelocity * dt,
    angularVelocity: body.angularVelocity * ANGULAR_DAMPING,
  };
}

// ------------------------------------------------------------
// checkWallCollision: 벽/바닥 충돌 처리
// ------------------------------------------------------------

/**
 * 강체가 벽이나 바닥과 충돌하면 위치를 보정하고 속도를 반전시킨다.
 *
 * @param body 대상 강체
 * @param boardWidth 보드 너비 (픽셀)
 * @param boardHeight 보드 높이 (픽셀)
 * @returns 보정된 강체 + 착지 여부
 */
export function checkWallCollision(
  body: RigidBody,
  boardWidth: number,
  boardHeight: number
): { body: RigidBody; landed: boolean } {
  let newBody = { ...body, position: { ...body.position }, velocity: { ...body.velocity } };
  let landed = false;

  // 꼭짓점 전체 기반 경계 체크 (min/max로 한번에 보정)
  const vertices = getWorldVertices(newBody);
  const maxX = Math.max(...vertices.map((v) => v.x));
  const minX = Math.min(...vertices.map((v) => v.x));
  const maxY = Math.max(...vertices.map((v) => v.y));

  // 왼쪽 벽 — 정확히 맞닿도록
  if (minX < 0) {
    newBody.position.x -= minX;
    newBody.velocity.x = Math.max(0, newBody.velocity.x);
  }

  // 오른쪽 벽 — 정확히 맞닿도록
  if (maxX > boardWidth) {
    newBody.position.x -= (maxX - boardWidth);
    newBody.velocity.x = Math.min(0, newBody.velocity.x);
  }

  // 바닥 — 정확히 바닥에 닿도록
  if (maxY > boardHeight) {
    newBody.position.y -= (maxY - boardHeight);
    newBody.velocity.y = 0;
    landed = true;
  }

  return { body: newBody, landed };
}

// ------------------------------------------------------------
// SAT (Separating Axis Theorem) — 다각형 충돌 감지
// ------------------------------------------------------------

/**
 * 다각형을 축에 투영하여 최소/최대값을 반환한다.
 * SAT의 핵심: 두 투영 구간이 겹치지 않는 축이 있으면 충돌 아님.
 */
function projectPolygon(vertices: Vec2[], axis: Vec2): { min: number; max: number } {
  const len = v2length(axis);
  const normalized: Vec2 = { x: axis.x / len, y: axis.y / len };

  let min = v2dot(vertices[0], normalized);
  let max = min;

  for (let i = 1; i < vertices.length; i++) {
    const proj = v2dot(vertices[i], normalized);
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }

  return { min, max };
}

/** 두 투영 구간이 실제로 겹치는지 확인 (딱 닿기만 한 경우는 충돌 아님) */
function overlaps(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.max > b.min && b.max > a.min;
}

/** 겹침 깊이 (penetration depth) 계산 */
function overlapDepth(a: { min: number; max: number }, b: { min: number; max: number }): number {
  return Math.min(a.max - b.min, b.max - a.min);
}

/**
 * 다각형의 모든 모서리에서 법선 벡터(분리축 후보)를 구한다.
 */
function getAxes(vertices: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    const edge = v2sub(vertices[next], vertices[i]);
    axes.push(v2normal(edge));
  }
  return axes;
}

/**
 * SAT로 두 다각형의 충돌 여부를 판정한다.
 *
 * 동작 원리:
 * 1. 두 다각형의 모든 모서리에서 법선 벡터(분리축)를 구한다.
 * 2. 각 축에 두 다각형을 투영한다.
 * 3. 투영이 겹치지 않는 축이 하나라도 있으면 → 충돌 아님
 * 4. 모든 축에서 겹치면 → 충돌
 *
 * @returns 충돌 시 { colliding: true, mtv, depth }, 아니면 { colliding: false }
 */
export function checkBodyCollision(
  a: RigidBody,
  b: RigidBody
): { colliding: boolean; mtv?: Vec2; depth?: number } {
  const vertsA = getWorldVertices(a);
  const vertsB = getWorldVertices(b);

  const axes = [...getAxes(vertsA), ...getAxes(vertsB)];

  let minDepth = Infinity;
  let minAxis: Vec2 = { x: 0, y: 1 };

  for (const axis of axes) {
    const len = v2length(axis);
    if (len < 0.0001) continue; // 퇴화 축 무시

    const projA = projectPolygon(vertsA, axis);
    const projB = projectPolygon(vertsB, axis);

    if (!overlaps(projA, projB)) {
      return { colliding: false }; // 분리축 발견 → 충돌 아님
    }

    const depth = overlapDepth(projA, projB);
    if (depth < minDepth) {
      minDepth = depth;
      // 최소 관통 벡터(MTV) 방향 결정
      const normalized: Vec2 = { x: axis.x / len, y: axis.y / len };
      // MTV가 A에서 B로 향하도록 방향 보정
      const centerA = getCentroid(vertsA);
      const centerB = getCentroid(vertsB);
      const d = v2sub(centerB, centerA);
      if (v2dot(d, normalized) < 0) {
        minAxis = { x: -normalized.x, y: -normalized.y };
      } else {
        minAxis = normalized;
      }
    }
  }

  return {
    colliding: true,
    mtv: minAxis, // 최소 관통 벡터 방향
    depth: minDepth,
  };
}

/** 다각형 중심점 계산 */
function getCentroid(vertices: Vec2[]): Vec2 {
  let x = 0, y = 0;
  for (const v of vertices) {
    x += v.x;
    y += v.y;
  }
  return { x: x / vertices.length, y: y / vertices.length };
}

// ------------------------------------------------------------
// isLanded: 거리 기반 착지 판정 (SAT와 분리)
// ------------------------------------------------------------

/**
 * 블록 바닥면이 실제로 표면(바닥 or static body 상단)에 닿았는지 확인.
 * SAT 충돌 감지와 별개의 거리 기반 판정.
 */
export function isLanded(
  body: RigidBody,
  staticBodies: RigidBody[],
  boardHeight: number
): boolean {
  const vertices = getWorldVertices(body);
  const maxY = Math.max(...vertices.map((v) => v.y));
  const aMaxX = Math.max(...vertices.map((v) => v.x));
  const aMinX = Math.min(...vertices.map((v) => v.x));

  // 바닥 접촉 (2px 허용 오차)
  if (maxY >= boardHeight - 2) return true;

  // 다른 블록 상단과 접촉
  for (const s of staticBodies) {
    const sVertices = getWorldVertices(s);
    const sMinY = Math.min(...sVertices.map((v) => v.y));
    const sMaxX = Math.max(...sVertices.map((v) => v.x));
    const sMinX = Math.min(...sVertices.map((v) => v.x));

    // X 범위가 의미있게 겹치고 Y가 맞닿아있는 경우 (최소 2px 겹침)
    const overlapWidth = Math.min(aMaxX, sMaxX) - Math.max(aMinX, sMinX);
    const xOverlap = overlapWidth > 2;
    const yTouch = Math.abs(maxY - sMinY) < 14;  // 14px — CELL_SIZE 28px의 50%

    if (xOverlap && yTouch) return true;
  }

  return false;
}

// ------------------------------------------------------------
// applyWallConstraints: 벽 밀착 보정 (이동 후 즉시 적용)
// ------------------------------------------------------------

export function applyWallConstraints(body: RigidBody, boardWidth: number): RigidBody {
  const vertices = getWorldVertices(body);
  const maxX = Math.max(...vertices.map((v) => v.x));
  const minX = Math.min(...vertices.map((v) => v.x));

  let dx = 0;
  if (maxX > boardWidth) dx = boardWidth - maxX;
  if (minX < 0) dx = -minX;

  if (dx === 0) return body;

  return {
    ...body,
    position: { x: body.position.x + dx, y: body.position.y },
  };
}

// ------------------------------------------------------------
// resolveCollision: 충돌 해소
// ------------------------------------------------------------

/**
 * 활성 강체가 정적 강체들과 충돌 시 위치를 보정하고 속도를 감쇠시킨다.
 *
 * @param active 떨어지고 있는 블록
 * @param statics 이미 착지한 블록들
 * @returns 보정된 블록 + 착지 여부
 */
export function resolveCollision(
  active: RigidBody,
  statics: RigidBody[]
): { body: RigidBody; landed: boolean } {
  const RESTITUTION = 0.2;
  const STATIC_THRESHOLD_VY = 30;      // 이 속도 이하면 착지로 판정
  const STATIC_THRESHOLD_AV = 0.5;     // 각속도 임계치
  const FRICTION = 0.7;                // 충돌 시 수평 속도 감쇠

  let result = { ...active, position: { ...active.position }, velocity: { ...active.velocity } };
  let hadCollision = false;

  for (const stat of statics) {
    const collision = checkBodyCollision(result, stat);
    if (collision.colliding && collision.mtv && collision.depth && collision.depth > 0) {
      hadCollision = true;

      // 위치 보정: MTV 반대 방향으로 정확히 밀어냄
      result.position = {
        x: result.position.x - collision.mtv.x * collision.depth,
        y: result.position.y - collision.mtv.y * collision.depth,
      };

      // 보정 후 재확인 — 아직 겹치면 추가로 1px씩 밀기
      for (let i = 0; i < 10; i++) {
        const still = checkBodyCollision(result, stat);
        if (!still.colliding) break;
        result.position = {
          x: result.position.x - collision.mtv.x,
          y: result.position.y - collision.mtv.y,
        };
      }

      // 속도 반전 + 감쇠
      const dot = v2dot(result.velocity, collision.mtv);
      if (dot > 0) {
        result.velocity = {
          x: (result.velocity.x - collision.mtv.x * dot * (1 + RESTITUTION)) * FRICTION,
          y: result.velocity.y - collision.mtv.y * dot * (1 + RESTITUTION),
        };
      }

      result.angularVelocity = (result.angularVelocity ?? active.angularVelocity) * 0.7;
    }
  }

  // 착지 판정: 충돌이 있었고 + 속도가 충분히 작으면 정지
  const landed = hadCollision &&
    Math.abs(result.velocity.y) < STATIC_THRESHOLD_VY &&
    Math.abs(result.angularVelocity ?? 0) < STATIC_THRESHOLD_AV;

  return { body: result, landed };
}
