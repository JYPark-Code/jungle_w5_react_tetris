// ============================================================
// Tab 1 — 🎮 Play (물리 테트리스 게임)
// Canvas 기반 테트리스 보드 + 사이드 패널
// ============================================================

import type { PhysicsState, Tetromino } from '../../../contracts';
import { getRotatedCells } from '../../physics/engine';

// 보드 크기 상수
const CELL_SIZE = 28;
const BOARD_COLS = 10;
const BOARD_ROWS = 20;
const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;
const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;

/**
 * 테트리스 보드를 Canvas에 렌더링한다.
 * 보드에 고정된 셀 + 현재 떨어지는 블록을 모두 그린다.
 */
export function renderBoard(canvas: HTMLCanvasElement, state: PhysicsState): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 배경 초기화
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // 그리드 라인
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  // 보드에 고정된 블록 렌더링
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const color = state.board[r][c];
      if (color) {
        drawCell(ctx, c, r, color);
      }
    }
  }

  // 현재 떨어지는 블록 렌더링
  if (state.currentPiece) {
    const cells = getRotatedCells(state.currentPiece);
    for (const cell of cells) {
      if (cell.y >= 0 && cell.y < BOARD_ROWS && cell.x >= 0 && cell.x < BOARD_COLS) {
        drawCell(ctx, cell.x, cell.y, state.currentPiece.color);
      }
    }
  }

  // 게임 오버 오버레이
  if (state.isGameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 28px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', BOARD_WIDTH / 2, BOARD_HEIGHT / 2 - 10);
    ctx.fillStyle = '#ffe66d';
    ctx.font = '16px Consolas, monospace';
    ctx.fillText(`Score: ${state.score}`, BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 20);
  }
}

/**
 * 하나의 셀을 그린다. 입체감을 위해 그라데이션 효과 적용.
 */
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const px = x * CELL_SIZE;
  const py = y * CELL_SIZE;
  const size = CELL_SIZE - 1;

  // 메인 색상
  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);

  // 하이라이트 (위/왼쪽)
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(px, py, size, 2);
  ctx.fillRect(px, py, 2, size);

  // 그림자 (아래/오른쪽)
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px, py + size - 2, size, 2);
  ctx.fillRect(px + size - 2, py, 2, size);
}

/**
 * 미리보기 블록(Next/Hold)을 작은 Canvas에 렌더링한다.
 */
export function renderPreview(canvas: HTMLCanvasElement, piece: Tetromino | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const previewSize = 16;
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!piece) return;

  const { shape, color } = piece;
  const rows = shape.length;
  const cols = shape[0].length;
  const offsetX = Math.floor((canvas.width - cols * previewSize) / 2);
  const offsetY = Math.floor((canvas.height - rows * previewSize) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r][c]) {
        const px = offsetX + c * previewSize;
        const py = offsetY + r * previewSize;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, previewSize - 1, previewSize - 1);
      }
    }
  }
}

/**
 * Play 탭의 전체 HTML 구조를 생성한다.
 */
export function createPlayTab(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'play-container';

  // 보드 영역
  const boardWrapper = document.createElement('div');
  boardWrapper.className = 'board-wrapper';
  const boardCanvas = document.createElement('canvas');
  boardCanvas.className = 'board-canvas';
  boardCanvas.id = 'board-canvas';
  boardCanvas.width = BOARD_WIDTH;
  boardCanvas.height = BOARD_HEIGHT;
  boardWrapper.appendChild(boardCanvas);

  // 사이드 패널
  const sidePanel = document.createElement('div');
  sidePanel.className = 'side-panel';

  // Hold 패널
  sidePanel.innerHTML = `
    <div class="panel-box">
      <h3>Hold (R)</h3>
      <canvas class="preview-canvas" id="hold-canvas" width="80" height="64"></canvas>
    </div>
    <div class="panel-box">
      <h3>Next</h3>
      <canvas class="preview-canvas" id="next-canvas" width="80" height="64"></canvas>
    </div>
    <div class="panel-box">
      <div class="score-display">
        SCORE: <span class="value" id="score-value">0</span><br>
        LEVEL: <span class="value" id="level-value">1</span><br>
        LINES: <span class="value" id="lines-value">0</span>
      </div>
    </div>
    <div class="panel-box">
      <div class="game-buttons">
        <button class="game-btn" id="start-btn">▶ START</button>
        <button class="game-btn pause" id="pause-btn">⏸ PAUSE</button>
      </div>
    </div>
    <div class="panel-box">
      <div class="controls-help">
        <kbd>← →</kbd> 이동<br>
        <kbd>↑</kbd> 90° 회전<br>
        <kbd>Q</kbd><kbd>E</kbd> 자유 회전<br>
        <kbd>↓</kbd> 소프트 드롭<br>
        <kbd>SPC</kbd> 하드 드롭<br>
        <kbd>R</kbd> 블록 보관
      </div>
    </div>
  `;

  container.appendChild(boardWrapper);
  container.appendChild(sidePanel);
  return container;
}

/**
 * 사이드 패널의 점수/레벨/라인 표시를 업데이트한다.
 */
export function updateScoreDisplay(state: PhysicsState): void {
  const scoreEl = document.getElementById('score-value');
  const levelEl = document.getElementById('level-value');
  const linesEl = document.getElementById('lines-value');
  if (scoreEl) scoreEl.textContent = String(state.score);
  if (levelEl) levelEl.textContent = String(state.level);
  if (linesEl) linesEl.textContent = String(state.linesCleared);
}
