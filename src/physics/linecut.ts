// ============================================================
// linecut.ts — 라인 클리어 (원본 gameA.lua 방식)
// 각 Part를 개별 클리핑 + 위/아래 조각 모두 보존
// ============================================================

import type { Body, Part, Vec2 } from './engine';
import { getWorldVerts } from './engine';

// 원본 Not Tetris 2: linecleartreshold = 8.1
// 1024(한 셀 면적) * 8.1 = 8294.4 px²
const THRESHOLD = 1024 * 8.1;

let _fragId = 100000;

/** Shoelace formula로 다각형 면적 계산 */
function polygonArea(v: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length;
    a += v[i].x * v[j].y - v[j].x * v[i].y;
  }
  return Math.abs(a) / 2;
}

/**
 * Sutherland-Hodgman 수평 클리핑
 * keepBelow=false: y <= lineY 유지 (라인 위쪽)
 * keepBelow=true:  y >= lineY 유지 (라인 아래쪽)
 */
function clipLine(verts: Vec2[], lineY: number, keepBelow: boolean): Vec2[] {
  if (!verts.length) return [];
  const out: Vec2[] = [];
  const inside = (v: Vec2) => keepBelow ? v.y >= lineY : v.y <= lineY;
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

/** 각 Part별 행 내 면적 계산 (원본 checklinedensity 대응) */
export function checkLineDensity(
  bodies: Body[],
  boardH: number,
  _boardW: number,
  cellSize: number,
): { linesToClear: number[]; lineAreas: number[] } {
  const rows = Math.floor(boardH / cellSize);
  const areas = new Array(rows).fill(0);

  for (const body of bodies) {
    if (body.kind === 0) continue;  // isStatic 조건 제거 → 파편도 밀도 계산에 포함
    for (const part of body.parts) {
      const wv = getWorldVerts(part, body.position, body.angle);
      const minY = Math.min(...wv.map(v => v.y));
      const maxY = Math.max(...wv.map(v => v.y));

      for (let r = 0; r < rows; r++) {
        const top = r * cellSize;
        const bot = top + cellSize;
        if (minY > bot || maxY < top) continue;

        // 행 범위로 클리핑: top <= y <= bot
        const inBand = clipLine(clipLine(wv, top, true), bot, false);
        if (inBand.length >= 3) areas[r] += polygonArea(inBand);
      }
    }
  }

  return {
    linesToClear: areas.reduce(
      (acc: number[], a, i) => (a > THRESHOLD ? [...acc, i] : acc),
      [],
    ),
    lineAreas: areas,
  };
}

/**
 * 원본 gameA.lua removeline 로직
 * 각 Part를 개별 처리: 위/아래 조각 모두 생성
 */
export function removeLinesFromBodies(
  bodies: Body[],
  rows: number[],
  cellSize: number,
): Body[] {
  let result = [...bodies];

  // 바닥부터 위로 (행 인덱스 내림차순)
  for (const row of [...rows].sort((a, b) => b - a)) {
    const lineTop = row * cellSize;
    const lineBot = lineTop + cellSize;
    const nextResult: Body[] = [];

    for (const body of result) {
      // 비정적 body 또는 벽/바닥(kind=0)은 그대로 유지
      if (!body.isStatic || body.kind === 0) {
        nextResult.push(body);
        continue;
      }

      // 이 body가 클리어 밴드와 겹치는지 빠른 체크
      const allV = body.parts.flatMap(p => getWorldVerts(p, body.position, body.angle));
      const bodyMinY = Math.min(...allV.map(v => v.y));
      const bodyMaxY = Math.max(...allV.map(v => v.y));
      if (bodyMaxY <= lineTop || bodyMinY >= lineBot) {
        nextResult.push(body);
        continue;
      }

      // 각 Part를 개별로 처리 (원본과 동일)
      const surviveParts: Part[] = [];    // 클리어 밴드 아래 무관 Part
      const aboveFrags: Vec2[][] = [];    // 밴드 위 → 재낙하
      const belowFrags: Vec2[][] = [];    // 밴드 아래 절단 조각

      for (const part of body.parts) {
        const wv = getWorldVerts(part, body.position, body.angle);
        const pMinY = Math.min(...wv.map(v => v.y));
        const pMaxY = Math.max(...wv.map(v => v.y));

        if (pMaxY <= lineTop) {
          // 완전히 클리어 밴드 위 → 재낙하
          aboveFrags.push(wv);
        } else if (pMinY >= lineBot) {
          // 완전히 클리어 밴드 아래 → 정적 유지
          surviveParts.push(part);
        } else if (pMinY >= lineTop && pMaxY <= lineBot) {
          // 완전히 밴드 안 → 삭제
        } else {
          // 밴드에 걸침 → 위/아래로 절단
          const above = clipLine(wv, lineTop, false); // y <= lineTop
          if (above.length >= 3) aboveFrags.push(above);

          const below = clipLine(wv, lineBot, true);  // y >= lineBot
          if (below.length >= 3) belowFrags.push(below);
        }
      }

      // 1. 밴드 아래 정적 Part + 절단 아래 조각 → 기존 body에 통합
      const belowParts: Part[] = [...surviveParts];
      for (const verts of belowFrags) {
        const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
        const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
        belowParts.push({
          localVerts: verts.map(v => ({ x: v.x - cx, y: v.y - cy })),
        });
      }
      if (belowParts.length > 0) {
        nextResult.push({ ...body, parts: belowParts });
      }

      // 2. 밴드 위 조각 → 개별 동적 body로 재생성 (재낙하)
      for (const verts of aboveFrags) {
        if (verts.length < 3) continue;
        const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
        const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
        nextResult.push({
          ...body,
          id: ++_fragId,
          position: { x: cx, y: cy },
          parts: [{ localVerts: verts.map(v => ({ x: v.x - cx, y: v.y - cy })) }],
          isStatic: false,
          angle: 0,
          velocity: { x: 0, y: 0.5 },
          angularVelocity: 0,
        });
      }
    }

    result = nextResult;
  }

  return result;
}
