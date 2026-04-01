// ============================================================
// renderer.ts — Canvas 렌더링 (각 Part를 개별 다각형으로)
// ============================================================

import { Body, getAllWorldVerts, CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, TETROMINO_COLORS } from './engine';

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

  // 모든 body 렌더링 (각 Part 개별)
  for (const body of bodies) {
    if (body.kind === 0) continue;
    const isActive = body.id === activeId;
    for (const verts of getAllWorldVerts(body)) {
      // 중심에서 5% 확장 (시각적 틈 제거)
      const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
      const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
      const ev = verts.map(v => ({ x: cx + (v.x - cx) * 1.05, y: cy + (v.y - cy) * 1.05 }));

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ev[0].x, ev[0].y);
      for (let i = 1; i < ev.length; i++) ctx.lineTo(ev[i].x, ev[i].y);
      ctx.closePath();
      ctx.fillStyle = body.color;
      ctx.fill();
      ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Next/Hold 미리보기 */
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
  // 간단한 사각형 미리보기
  ctx.fillStyle = colors[kind] ?? '#888';
  ctx.fillRect(canvas.width / 4, canvas.height / 4, canvas.width / 2, canvas.height / 2);
}
