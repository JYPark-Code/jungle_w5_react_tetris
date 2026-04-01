import Matter from 'matter-js';
import { CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT, TETROMINO_CELLS, TETROMINO_COLORS } from './matterEngine';

/**
 * 메인 게임 보드 렌더링 (원본 gameA_draw 대응)
 */
export function renderMatterFrame(
  ctx: CanvasRenderingContext2D,
  engine: Matter.Engine,
  activeBody: Matter.Body | null,
): void {
  // 배경
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // 그리드
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= BOARD_WIDTH; x += CELL_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BOARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= BOARD_HEIGHT; y += CELL_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BOARD_WIDTH, y);
    ctx.stroke();
  }

  // 모든 테트로미노 렌더링
  const bodies = Matter.Composite.allBodies(engine.world)
    .filter(b => !b.isStatic && (b as any).kind);

  for (const body of bodies) {
    drawBody(ctx, body, body === activeBody);
  }
}

/**
 * 개별 body 렌더링 - body의 꼭짓점을 폴리곤으로 그리기
 */
function drawBody(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  isActive: boolean,
): void {
  const color: string = (body as any).color ?? '#ffffff';

  // compound body: parts[0] = parent, parts[1..] = 실제 셀
  const renderParts = body.parts.length > 1
    ? body.parts.slice(1)
    : [body];

  for (const part of renderParts) {
    const verts = part.vertices;
    if (verts.length < 3) continue;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = isActive
      ? 'rgba(255,255,255,0.5)'
      : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Next/Hold 미리보기 렌더링
 * 주어진 kind의 테트로미노를 작은 캔버스 중앙에 그리기
 */
export function renderPreviewKind(
  ctx: CanvasRenderingContext2D,
  kind: number | null,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // 배경 클리어
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, w, h);

  if (kind === null) return;

  const cells = TETROMINO_CELLS[kind];
  const color = TETROMINO_COLORS[kind];
  if (!cells || !color) return;

  // 셀들의 바운딩 박스 계산 (중심 맞추기 위해)
  const minX = Math.min(...cells.map(c => c.x));
  const maxX = Math.max(...cells.map(c => c.x));
  const minY = Math.min(...cells.map(c => c.y));
  const maxY = Math.max(...cells.map(c => c.y));

  // 셀 포함 전체 크기 (CELL_SIZE 고려)
  const shapeWidth = (maxX - minX) + CELL_SIZE;
  const shapeHeight = (maxY - minY) + CELL_SIZE;

  // 미리보기 크기에 맞게 스케일 계산
  const scale = Math.min(
    (w * 0.8) / shapeWidth,
    (h * 0.8) / shapeHeight,
    1.0,  // 1배 이상 확대하지 않음
  );

  // 캔버스 중앙에 배치하기 위한 오프셋
  const centerX = w / 2;
  const centerY = h / 2;
  // 셀 좌표의 중심점
  const shapeCenterX = (minX + maxX) / 2;
  const shapeCenterY = (minY + maxY) / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.translate(-shapeCenterX, -shapeCenterY);

  // 각 셀을 사각형으로 그리기
  for (const cell of cells) {
    const cellLeft = cell.x - CELL_SIZE / 2;
    const cellTop = cell.y - CELL_SIZE / 2;

    ctx.fillStyle = color;
    ctx.fillRect(cellLeft, cellTop, CELL_SIZE, CELL_SIZE);

    // 테두리
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cellLeft, cellTop, CELL_SIZE, CELL_SIZE);
  }

  ctx.restore();
}
