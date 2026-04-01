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
  threshold = 0.9,  // 원본 linecleartreshold
): { linesToClear: number[]; lineAreas: number[] } {
  const numRows = Math.floor(boardHeight / cellSize); // 18행
  const lineAreas: number[] = new Array(numRows).fill(0);

  for (const body of bodies) {
    if (body.isStatic) continue;
    if (!(body as any).kind) continue;

    // compound body면 각 part의 vertices 사용, 아니면 body 자체
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];

    for (const part of parts) {
      const verts = part.vertices;

      for (let row = 0; row < numRows; row++) {
        const lineTop = row * cellSize;
        const lineBottom = lineTop + cellSize;

        const inRow = verts.filter(v => v.y >= lineTop && v.y <= lineBottom);
        if (inRow.length < 2) continue;

        const minX = Math.max(0, Math.min(...inRow.map(v => v.x)));
        const maxX = Math.min(boardWidth, Math.max(...inRow.map(v => v.x)));
        if (maxX > minX) {
          lineAreas[row] += (maxX - minX) * cellSize;
        }
      }
    }
  }

  // 클리어 판정: 한 행의 너비 90% 이상 채워짐
  const targetArea = boardWidth * cellSize * threshold;
  const linesToClear: number[] = [];

  for (let row = 0; row < numRows; row++) {
    if (lineAreas[row] >= targetArea) {
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
  cellSize: number,
): void {
  const lineTop = row * cellSize;
  const lineBottom = lineTop + cellSize;

  // activeBody도 라인 클리어 대상에 포함
  const bodies = Matter.Composite.allBodies(engine.world)
    .filter(b => !b.isStatic && (b as any).kind);

  for (const body of bodies) {
    const allParts = body.parts.length > 1 ? body.parts.slice(1) : [body];
    const bodyVerts = allParts.flatMap(p => Array.from(p.vertices));

    const minY = Math.min(...bodyVerts.map(v => v.y));
    const maxY = Math.max(...bodyVerts.map(v => v.y));

    // 클리어 라인과 겹치지 않으면 skip
    if (maxY <= lineTop || minY >= lineBottom) continue;

    const kind = (body as any).kind;
    const color = (body as any).color;

    // body 전체 제거
    Matter.Composite.remove(engine.world, body);

    // 각 part별로 위쪽 조각 재생성
    for (const part of allParts) {
      const partVerts = Array.from(part.vertices);
      const partMinY = Math.min(...partVerts.map(v => v.y));
      const partMaxY = Math.max(...partVerts.map(v => v.y));

      if (partMaxY <= lineTop) {
        // 완전히 클리어 라인 위 → Bodies.rectangle로 정확하게 재생성
        const center = centroid(partVerts);
        const newCell = Matter.Bodies.rectangle(
          center.x, center.y, CELL_SIZE, CELL_SIZE,
          { angle: body.angle, isStatic: false, frictionAir: 0.05, restitution: 0.1, friction: 0.3 }
        );
        (newCell as any).kind = kind;
        (newCell as any).color = color;
        Matter.Body.setVelocity(newCell, { x: 0, y: 0 });
        Matter.Composite.add(engine.world, newCell);

      } else if (partMinY < lineTop && partMaxY > lineTop) {
        // 클리어 라인에 걸침 → 위쪽 클리핑 후 rectangle로 재생성
        const aboveVerts = clipVertsAboveLine(partVerts, lineTop);
        if (aboveVerts.length >= 3) {
          const center = centroid(aboveVerts);
          const w = Math.max(...aboveVerts.map(v => v.x)) - Math.min(...aboveVerts.map(v => v.x));
          const h = lineTop - partMinY;
          // 충분한 크기일 때만 재생성 (너무 작은 조각 방지)
          if (w > 2 && h > 2) {
            const newCell = Matter.Bodies.rectangle(
              center.x, center.y, Math.max(w, 4), Math.max(h, 4),
              { isStatic: false, frictionAir: 0.05, restitution: 0.1, friction: 0.3 }
            );
            (newCell as any).kind = kind;
            (newCell as any).color = color;
            Matter.Body.setVelocity(newCell, { x: 0, y: 0 });
            Matter.Composite.add(engine.world, newCell);
          }
        }
      }
      // partMinY >= lineBottom → 클리어 라인 아래 → 삭제 (추가 안 함)
    }
  }
}

/**
 * lineY 위쪽 꼭짓점만 추출 (Sutherland-Hodgman 클리핑)
 */
export function clipVertsAboveLine(
  verts: Matter.Vector[],
  lineY: number,
): Matter.Vector[] {
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

/**
 * 꼭짓점 배열의 무게중심 계산
 */
export function centroid(verts: Matter.Vector[]): Matter.Vector {
  const x = verts.reduce((s, v) => s + v.x, 0) / verts.length;
  const y = verts.reduce((s, v) => s + v.y, 0) / verts.length;
  return { x, y };
}
