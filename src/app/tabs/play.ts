// ============================================================
// Tab 1 — 🎮 Play (물리 테트리스 게임)
// DOM 구조 생성만 담당. 렌더링은 index.ts + renderer.ts가 처리.
// ============================================================

// 보드 크기 상수 — Matter.js 기준 (32px셀, 10x18)
const CELL_SIZE = 32;
const BOARD_COLS = 10;
const BOARD_ROWS = 18;
const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;  // 320px
const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS; // 576px

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

  sidePanel.innerHTML = `
    <div class="panel-box">
      <h3>Hold (R)</h3>
      <canvas class="preview-canvas" id="hold-canvas" width="140" height="140"></canvas>
    </div>
    <div class="panel-box">
      <h3>Next</h3>
      <canvas class="preview-canvas" id="next-canvas" width="140" height="140"></canvas>
    </div>
    <div class="panel-box score-panel"><!-- TetrisApp Component 마운트 영역 --></div>
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
