// ============================================================
// linecut.ts — 다각형 수평 절단 (Sutherland-Hodgman 알고리즘)
// Not Tetris 2의 핵심: 기울어진 블록을 수평선으로 절단
// ============================================================

import type { Vec2, RigidBody } from '../../contracts';
import { getWorldVertices } from './engine2d';

// ------------------------------------------------------------
// Sutherland-Hodgman 클리핑
// ------------------------------------------------------------

/**
 * 다각형을 수평선(y = lineY) 기준으로 절단한다.
 *
 * Sutherland-Hodgman 알고리즘:
 * - 다각형의 각 모서리를 순회하며
 * - 시작점/끝점이 클리핑 영역 안(inside)/밖(outside)인지 판별
 * - 안→안: 끝점 추가
 * - 안→밖: 교차점 추가
 * - 밖→안: 교차점 + 끝점 추가
 * - 밖→밖: 추가 없음
 *
 * @param vertices 다각형 꼭짓점 배열
 * @param lineY 절단 수평선 y좌표
 * @param keepAbove true면 위쪽(y < lineY), false면 아래쪽 반환
 */
function clipPolygon(vertices: Vec2[], lineY: number, keepAbove: boolean): Vec2[] {
  if (vertices.length === 0) return [];

  const output: Vec2[] = [];

  // inside 판정: keepAbove면 y < lineY가 inside, 아니면 y >= lineY가 inside
  const isInside = (v: Vec2) => (keepAbove ? v.y <= lineY : v.y >= lineY);

  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];

    const currInside = isInside(current);
    const nextInside = isInside(next);

    if (currInside && nextInside) {
      // 둘 다 안쪽 → 끝점 추가
      output.push(next);
    } else if (currInside && !nextInside) {
      // 안→밖 → 교차점만 추가
      output.push(intersectHorizontal(current, next, lineY));
    } else if (!currInside && nextInside) {
      // 밖→안 → 교차점 + 끝점 추가
      output.push(intersectHorizontal(current, next, lineY));
      output.push(next);
    }
    // 밖→밖: 추가 없음
  }

  return output;
}

/**
 * 두 점을 잇는 선분이 수평선 y = lineY와 교차하는 점을 구한다.
 * 선형 보간(lerp)으로 교차점의 x좌표를 계산한다.
 */
function intersectHorizontal(a: Vec2, b: Vec2, lineY: number): Vec2 {
  const t = (lineY - a.y) / (b.y - a.y);
  return {
    x: a.x + t * (b.x - a.x),
    y: lineY,
  };
}

// ------------------------------------------------------------
// cutBodyAtLine: 강체를 수평선 기준으로 절단
// ------------------------------------------------------------

/**
 * 강체를 lineY 기준으로 위/아래로 절단한다.
 *
 * 동작 원리:
 * 1. 월드 좌표 꼭짓점을 구한다.
 * 2. Sutherland-Hodgman으로 위쪽/아래쪽 다각형을 클리핑한다.
 * 3. 각 다각형의 중심을 재계산하고 localVertices를 재설정한다.
 * 4. 위쪽 조각은 isStatic=false (재낙하), 아래쪽은 null (삭제)
 */
export function cutBodyAtLine(
  body: RigidBody,
  lineY: number
): { above: RigidBody | null; below: RigidBody | null } {
  const worldVerts = getWorldVertices(body);

  // 모든 꼭짓점이 lineY 위에 있으면 절단 불필요
  if (worldVerts.every((v) => v.y <= lineY)) {
    return { above: body, below: null };
  }
  // 모든 꼭짓점이 lineY 아래에 있으면 전체 삭제
  if (worldVerts.every((v) => v.y >= lineY)) {
    return { above: null, below: body };
  }

  const aboveVerts = clipPolygon(worldVerts, lineY, true);
  const belowVerts = clipPolygon(worldVerts, lineY, false);

  const above = aboveVerts.length >= 3 ? createBodyFromWorldVerts(aboveVerts, body.color, false) : null;
  const below = belowVerts.length >= 3 ? createBodyFromWorldVerts(belowVerts, body.color, true) : null;

  return { above, below };
}

/**
 * 월드 좌표 꼭짓점 배열로부터 새 RigidBody를 생성한다.
 * 중심(centroid)을 계산하고 localVertices를 중심 기준으로 변환한다.
 */
function createBodyFromWorldVerts(worldVerts: Vec2[], color: string, isStatic: boolean): RigidBody {
  // 중심 계산
  let cx = 0, cy = 0;
  for (const v of worldVerts) {
    cx += v.x;
    cy += v.y;
  }
  cx /= worldVerts.length;
  cy /= worldVerts.length;

  // 중심 기준 로컬 좌표로 변환 (angle=0이므로 회전 불필요)
  const localVertices = worldVerts.map((v) => ({
    x: v.x - cx,
    y: v.y - cy,
  }));

  return {
    position: { x: cx, y: cy },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    localVertices,
    color,
    isStatic,
  };
}

// ------------------------------------------------------------
// isLineFull: 특정 y좌표에서 보드 전체가 채워졌는지 확인
// ------------------------------------------------------------

/**
 * 특정 y좌표 범위(lineY ~ lineY+cellSize)에서
 * 정적 블록들이 보드 전체 너비를 덮고 있는지 확인한다.
 *
 * 동작 원리:
 * 1. 각 정적 블록의 월드 꼭짓점을 구한다.
 * 2. lineY에서의 수평 교차 범위(x 구간)를 계산한다.
 * 3. 모든 블록의 x 구간 합집합이 boardWidth를 덮으면 true.
 */
export function isLineFull(
  bodies: RigidBody[],
  lineY: number,
  cellSize: number,
  boardWidth: number
): boolean {
  // 해당 라인에 겹치는 블록들의 x 구간 수집
  const segments: { start: number; end: number }[] = [];

  for (const body of bodies) {
    if (!body.isStatic) continue;
    const verts = getWorldVertices(body);

    // 블록이 해당 라인 범위(lineY ~ lineY+cellSize)와 겹치는지 확인
    const minY = Math.min(...verts.map((v) => v.y));
    const maxY = Math.max(...verts.map((v) => v.y));
    if (maxY < lineY || minY > lineY + cellSize) continue;

    // 해당 y에서의 x 범위
    const xs = verts.map((v) => v.x);
    segments.push({ start: Math.min(...xs), end: Math.max(...xs) });
  }

  if (segments.length === 0) return false;

  // 구간 합집합 계산
  segments.sort((a, b) => a.start - b.start);
  let coverage = 0;
  let currentEnd = 0;

  for (const seg of segments) {
    const start = Math.max(seg.start, currentEnd);
    const end = seg.end;
    if (end > start) {
      coverage += end - start;
      currentEnd = Math.max(currentEnd, end);
    }
  }

  // 보드 너비의 90% 이상이면 꽉 찬 것으로 판정 (다각형 절단 오차 허용)
  return coverage >= boardWidth * 0.9;
}

// ------------------------------------------------------------
// clearFullLines: 꽉 찬 라인 제거
// ------------------------------------------------------------

/**
 * 모든 행을 체크하여 꽉 찬 라인을 제거한다.
 * 걸쳐있는 블록은 절단하고, 위쪽 조각은 재낙하시킨다.
 */
export function clearFullLines(
  bodies: RigidBody[],
  boardHeight: number,
  boardWidth: number,
  cellSize: number
): { bodies: RigidBody[]; linesCleared: number } {
  let result = [...bodies];
  let linesCleared = 0;

  // 바닥부터 위로 스캔
  for (let y = boardHeight - cellSize; y >= 0; y -= cellSize) {
    if (isLineFull(result, y, cellSize, boardWidth)) {
      linesCleared++;
      const lineY = y;
      const lineBottom = y + cellSize;
      const newBodies: RigidBody[] = [];

      for (const body of result) {
        const verts = getWorldVertices(body);
        const minY = Math.min(...verts.map((v) => v.y));
        const maxY = Math.max(...verts.map((v) => v.y));

        if (maxY <= lineY || minY >= lineBottom) {
          // 라인과 겹치지 않음 → 그대로 유지
          newBodies.push(body);
        } else {
          // 라인에 걸침 → 절단
          const { above } = cutBodyAtLine(body, lineY);
          if (above) {
            // 위 조각은 재낙하 (isStatic = false)
            newBodies.push({ ...above, isStatic: false, velocity: { x: 0, y: 0 } });
          }
          // 아래 조각(라인 안)은 삭제
        }
      }

      result = newBodies;
    }
  }

  return { bodies: result, linesCleared };
}
