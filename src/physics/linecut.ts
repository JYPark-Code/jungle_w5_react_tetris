// ============================================================
// linecut.ts — 라인 클리어 (Shoelace 면적 + 81% 임계값)
// Sutherland-Hodgman 클리핑으로 다각형 절단
// ============================================================

import { Body, Vec2, getWorldVerts } from './engine';

// 임계값: 셀 면적(1024) × 셀 수(10) × 81% ≈ 8294
const THRESHOLD = 1024 * 8.1;

/** Shoelace formula로 다각형 면적 계산 */
function polygonArea(v: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length;
    a += v[i].x * v[j].y - v[j].x * v[i].y;
  }
  return Math.abs(a) / 2;
}

/** Sutherland-Hodgman 수평선 클리핑 */
function clip(verts: Vec2[], lineY: number, keepAbove: boolean): Vec2[] {
  if (!verts.length) return [];
  const out: Vec2[] = [];
  const inside = (v: Vec2) => keepAbove ? v.y <= lineY : v.y >= lineY;
  for (let i = 0; i < verts.length; i++) {
    const c = verts[i], n = verts[(i + 1) % verts.length];
    if (inside(c)) out.push(c);
    if (inside(c) !== inside(n)) {
      const t = (lineY - c.y) / (n.y - c.y);
      out.push({ x: c.x + t * (n.x - c.x), y: lineY });
    }
  }
  return out;
}

/**
 * 각 행의 블록 점유 면적을 계산 (Shoelace 면적 기반)
 * 정적 블록만 대상 + 각 Part를 행 범위로 클리핑하여 면적 합산
 */
export function checkLineDensity(
  bodies: Body[],
  boardH: number,
  boardW: number,
  cellSize: number,
): { linesToClear: number[]; lineAreas: number[] } {
  const rows = Math.floor(boardH / cellSize);
  const areas = new Array(rows).fill(0);

  for (const body of bodies) {
    if (!body.isStatic || body.kind === 0) continue;
    for (const part of body.parts) {
      const wv = getWorldVerts(part, body.position, body.angle);
      for (let r = 0; r < rows; r++) {
        const top = r * cellSize, bot = top + cellSize;
        if (Math.min(...wv.map(v => v.y)) > bot || Math.max(...wv.map(v => v.y)) < top) continue;
        // 행 범위로 2번 클리핑 (위+아래)
        const clipped = clip(clip(wv, top, false), bot, true);
        if (clipped.length >= 3) areas[r] += polygonArea(clipped);
      }
    }
  }

  return {
    linesToClear: areas.reduce((acc: number[], a, i) => a > THRESHOLD ? [...acc, i] : acc, []),
    lineAreas: areas,
  };
}

/**
 * 클리어된 행에 걸친 body를 절단하고 위쪽만 유지
 * 바닥부터 위로 처리 (행 번호 내림차순)
 */
export function removeLinesFromBodies(bodies: Body[], rows: number[], cellSize: number): Body[] {
  let result = [...bodies];
  for (const row of [...rows].sort((a, b) => b - a)) {
    const lineTop = row * cellSize;
    result = result.flatMap(body => {
      if (!body.isStatic || body.kind === 0) return [body];
      const verts = body.parts.flatMap(p => getWorldVerts(p, body.position, body.angle));
      // 이 body가 클리어 라인과 겹치지 않으면 그대로 유지
      if (Math.max(...verts.map(v => v.y)) <= lineTop ||
          Math.min(...verts.map(v => v.y)) >= lineTop + cellSize) {
        return [body];
      }
      // 위쪽 조각만 유지
      const above = clip(verts, lineTop, true);
      if (above.length < 3) return []; // 완전히 삭제
      const cx = above.reduce((s, v) => s + v.x, 0) / above.length;
      const cy = above.reduce((s, v) => s + v.y, 0) / above.length;
      return [{
        ...body,
        position: { x: cx, y: cy },
        parts: [{ localVerts: above.map(v => ({ x: v.x - cx, y: v.y - cy })) }],
        isStatic: false,
        velocity: { x: 0, y: 0 },
      }];
    });
  }
  return result;
}
