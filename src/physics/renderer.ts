// ============================================================
// renderer.ts — Canvas 렌더링 (각 Part를 개별 다각형으로)
// ============================================================

import { Body, getAllWorldVerts, getWorldVerts, createTetromino, CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, TETROMINO_COLORS } from './engine';

/** 메인 보드 렌더링 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  bodies: Body[],
  activeId: number | null,
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

  // 모든 body 렌더링 — stroke 없이 fill만 (내부 대각선 제거)
  for (const body of bodies) {
    if (body.kind === 0) continue;
    const isActive = body.id === activeId;
    const allPartVerts = getAllWorldVerts(body);

    // fill만 (stroke 없음 → 내부 경계선 사라짐)
    ctx.fillStyle = body.color;
    for (const verts of allPartVerts) {
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.fill();
    }

    // active 블록만 외곽 흰색 테두리
    if (isActive) {
      for (const verts of allPartVerts) {
        ctx.beginPath();
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
}

/** Next/Hold 미리보기 — 실제 테트로미노 모양 렌더링 */
export function renderPreview(
  canvas: HTMLCanvasElement,
  kind: number | null,
  colors: Record<number, string>,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!kind) return;

  // 임시 body로 모양 계산
  const dummy = createTetromino(kind, 0, 0);
  const allVerts = dummy.parts.flatMap(p => getWorldVerts(p, dummy.position, 0));

  // 바운딩 박스
  const minX = Math.min(...allVerts.map(v => v.x));
  const maxX = Math.max(...allVerts.map(v => v.x));
  const minY = Math.min(...allVerts.map(v => v.y));
  const maxY = Math.max(...allVerts.map(v => v.y));
  const w = maxX - minX || 1, h = maxY - minY || 1;

  const padding = 10;
  const scale = Math.min(
    (canvas.width - padding * 2) / w,
    (canvas.height - padding * 2) / h,
  );
  const offsetX = canvas.width / 2 - (minX + w / 2) * scale;
  const offsetY = canvas.height / 2 - (minY + h / 2) * scale;

  ctx.fillStyle = colors[kind] ?? '#888';
  for (const part of dummy.parts) {
    const verts = getWorldVerts(part, dummy.position, 0);
    ctx.beginPath();
    ctx.moveTo(verts[0].x * scale + offsetX, verts[0].y * scale + offsetY);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x * scale + offsetX, verts[i].y * scale + offsetY);
    }
    ctx.closePath();
    ctx.fill();
  }
}
