// ============================================================
// renderer.ts — Canvas 기반 강체 렌더러
// 각 블록을 다각형으로 렌더링 (translate + rotate)
// ============================================================

import type { RigidBody } from '../../contracts';

/**
 * 매 프레임 호출되어 보드와 모든 블록을 Canvas에 그린다.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  bodies: RigidBody[],
  activeBody: RigidBody | null,
  boardWidth: number,
  boardHeight: number
): void {
  // 배경
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, boardWidth, boardHeight);

  // 그리드 라인 (참고용, 연한 색)
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  const cellSize = 28;
  for (let x = 0; x <= boardWidth; x += cellSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, boardHeight);
    ctx.stroke();
  }
  for (let y = 0; y <= boardHeight; y += cellSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(boardWidth, y);
    ctx.stroke();
  }

  // 고정된 블록 렌더링
  for (const body of bodies) {
    drawBody(ctx, body);
  }

  // 현재 떨어지는 블록 렌더링
  if (activeBody) {
    drawBody(ctx, activeBody);
  }
}

/**
 * 하나의 강체를 Canvas에 그린다.
 * translate + rotate로 로컬 좌표계에서 렌더링.
 */
function drawBody(ctx: CanvasRenderingContext2D, body: RigidBody): void {
  const { position, angle, localVertices, color } = body;

  if (localVertices.length < 3) return;

  ctx.save();

  // 블록 중심으로 이동 후 회전
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);

  // 다각형 경로 그리기
  ctx.beginPath();
  ctx.moveTo(localVertices[0].x, localVertices[0].y);
  for (let i = 1; i < localVertices.length; i++) {
    ctx.lineTo(localVertices[i].x, localVertices[i].y);
  }
  ctx.closePath();

  // 채우기
  ctx.fillStyle = color;
  ctx.fill();

  // 테두리 (입체감)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 어두운 테두리 (그림자)
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

/**
 * 미리보기 블록(Next/Hold)을 작은 Canvas에 렌더링한다.
 */
export function renderPreviewBody(canvas: HTMLCanvasElement, body: RigidBody | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!body) return;

  const { localVertices, color } = body;
  if (localVertices.length < 3) return;

  // 블록을 캔버스 중앙에 배치 (스케일 조정)
  const xs = localVertices.map((v) => v.x);
  const ys = localVertices.map((v) => v.y);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min((canvas.width - 16) / bw, (canvas.height - 16) / bh, 1);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.moveTo(localVertices[0].x, localVertices[0].y);
  for (let i = 1; i < localVertices.length; i++) {
    ctx.lineTo(localVertices[i].x, localVertices[i].y);
  }
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/**
 * 라인 클리어 이펙트 — 수평선 flash
 */
export function renderLineClearEffect(
  ctx: CanvasRenderingContext2D,
  lineY: number,
  cellSize: number,
  boardWidth: number
): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillRect(0, lineY, boardWidth, cellSize);
}
