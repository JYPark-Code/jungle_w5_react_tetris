import { describe, it, expect } from 'vitest';
import { applyGravity, checkCollision, rotatePiece, getRotatedCells, cutPieceAtLine, clearLines } from './engine';
import type { Tetromino, Board } from '../../contracts';

// 테스트용 빈 보드 생성 (20행 x 10열)
function createEmptyBoard(rows = 20, cols = 10): Board {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

// 테스트용 기본 블록 (O 블록)
function createTestPiece(overrides: Partial<Tetromino> = {}): Tetromino {
  return {
    shape: [
      [1, 1],
      [1, 1],
    ],
    x: 4,
    y: 0,
    angle: 0,
    vx: 0,
    vy: 0,
    angularVelocity: 0,
    color: '#ff0',
    ...overrides,
  };
}

describe('getRotatedCells', () => {
  it('각도 0일 때 원래 shape 좌표를 반환해야 한다', () => {
    const piece = createTestPiece({ x: 4, y: 0 });
    const cells = getRotatedCells(piece);
    // O 블록(2x2): 중심 (0.5, 0.5) 기준, 셀 4개
    expect(cells).toHaveLength(4);
  });

  it('90도 회전 시 좌표가 변환되어야 한다', () => {
    // I 블록 (1x4)
    const piece = createTestPiece({
      shape: [[1, 1, 1, 1]],
      x: 5,
      y: 5,
      angle: 90,
    });
    const cells = getRotatedCells(piece);
    expect(cells).toHaveLength(4);
    // 90도 회전 시 가로가 세로로 변환됨
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    // 모든 x가 같아야 함 (세로 일렬)
    expect(new Set(xs).size).toBe(1);
    // y는 4개 다 달라야 함
    expect(new Set(ys).size).toBe(4);
  });
});

describe('checkCollision', () => {
  it('빈 보드 중앙에서 충돌이 없어야 한다', () => {
    const board = createEmptyBoard();
    const piece = createTestPiece({ x: 4, y: 0 });
    expect(checkCollision(piece, board)).toBe(false);
  });

  it('보드 왼쪽 벽을 벗어나면 충돌이어야 한다', () => {
    const board = createEmptyBoard();
    const piece = createTestPiece({ x: -1, y: 0 });
    expect(checkCollision(piece, board)).toBe(true);
  });

  it('보드 오른쪽 벽을 벗어나면 충돌이어야 한다', () => {
    const board = createEmptyBoard();
    const piece = createTestPiece({ x: 9, y: 0 });
    expect(checkCollision(piece, board)).toBe(true);
  });

  it('보드 바닥을 벗어나면 충돌이어야 한다', () => {
    const board = createEmptyBoard();
    const piece = createTestPiece({ x: 4, y: 19 });
    expect(checkCollision(piece, board)).toBe(true);
  });

  it('기존 블록과 겹치면 충돌이어야 한다', () => {
    const board = createEmptyBoard();
    board[1][4] = '#f00';
    const piece = createTestPiece({ x: 4, y: 0 });
    expect(checkCollision(piece, board)).toBe(true);
  });
});

describe('applyGravity', () => {
  it('중력을 적용하면 y 좌표가 증가해야 한다', () => {
    const board = createEmptyBoard();
    const piece = createTestPiece({ x: 4, y: 0 });
    const result = applyGravity(piece, board);
    expect(result.y).toBeGreaterThan(piece.y);
  });

  it('중력을 적용하면 vy가 증가해야 한다', () => {
    const board = createEmptyBoard();
    const piece = createTestPiece({ x: 4, y: 0, vy: 0 });
    const result = applyGravity(piece, board);
    expect(result.vy).toBeGreaterThan(0);
  });

  it('바닥 충돌 시 속도가 0으로 리셋되어야 한다', () => {
    const board = createEmptyBoard();
    const piece = createTestPiece({ x: 4, y: 18, vy: 2 });
    const result = applyGravity(piece, board);
    expect(result.vy).toBe(0);
    expect(result.y).toBe(18); // 이전 위치 유지
  });

  it('vx 마찰이 적용되어야 한다', () => {
    const board = createEmptyBoard();
    const piece = createTestPiece({ x: 4, y: 0, vx: 1 });
    const result = applyGravity(piece, board);
    expect(Math.abs(result.vx)).toBeLessThan(1);
  });
});

describe('rotatePiece', () => {
  it('회전 시 angularVelocity가 증가해야 한다', () => {
    const piece = createTestPiece();
    const result = rotatePiece(piece);
    expect(result.angularVelocity).toBe(45);
  });

  it('연속 회전 시 angularVelocity가 누적되어야 한다', () => {
    const piece = createTestPiece();
    const once = rotatePiece(piece);
    const twice = rotatePiece(once);
    expect(twice.angularVelocity).toBe(90);
  });

  it('원본 블록이 변경되지 않아야 한다 (순수 함수)', () => {
    const piece = createTestPiece();
    rotatePiece(piece);
    expect(piece.angularVelocity).toBe(0);
  });
});

// ============================================================
// M2: cutPieceAtLine, clearLines 테스트
// ============================================================

describe('cutPieceAtLine', () => {
  it('라인 위의 셀만 top으로 반환해야 한다', () => {
    // 2x2 O 블록, y=0에 위치 → 셀은 y=0, y=1
    const piece = createTestPiece({ x: 4, y: 0 });
    const result = cutPieceAtLine(piece, 1); // lineY=1 기준 절단
    // top: y<1인 셀 (y=0 행)
    expect(result.top).not.toBeNull();
    expect(result.top!.shape.length).toBe(1); // 1행
    // bottom: y>=1인 셀 (y=1 행)
    expect(result.bottom).not.toBeNull();
    expect(result.bottom!.shape.length).toBe(1);
  });

  it('모든 셀이 라인 위에 있으면 bottom은 null이어야 한다', () => {
    const piece = createTestPiece({ x: 4, y: 0 });
    const result = cutPieceAtLine(piece, 10); // lineY가 블록 아래
    expect(result.top).not.toBeNull();
    expect(result.bottom).toBeNull();
  });

  it('모든 셀이 라인 아래에 있으면 top은 null이어야 한다', () => {
    const piece = createTestPiece({ x: 4, y: 5 });
    const result = cutPieceAtLine(piece, 3); // lineY가 블록 위
    expect(result.top).toBeNull();
    expect(result.bottom).not.toBeNull();
  });

  it('절단 후 angle이 0으로 리셋되어야 한다', () => {
    const piece = createTestPiece({ x: 4, y: 0, angle: 30 });
    const result = cutPieceAtLine(piece, 1);
    if (result.top) expect(result.top.angle).toBe(0);
    if (result.bottom) expect(result.bottom.angle).toBe(0);
  });

  it('기울어진 블록(I 블록 45도)을 절단할 수 있어야 한다', () => {
    // I 블록(1x4), 45도 회전, y=5 위치
    const piece = createTestPiece({
      shape: [[1, 1, 1, 1]],
      x: 5,
      y: 5,
      angle: 45,
    });
    const cells = getRotatedCells(piece);
    // lineY를 셀들의 중간에 설정
    const ys = cells.map((c) => c.y).sort((a, b) => a - b);
    const midY = Math.floor((ys[0] + ys[ys.length - 1]) / 2) + 1;
    const result = cutPieceAtLine(piece, midY);
    // 양쪽 모두 셀이 있어야 한다
    expect(result.top).not.toBeNull();
    expect(result.bottom).not.toBeNull();
  });

  it('절단 후 색상이 유지되어야 한다', () => {
    const piece = createTestPiece({ x: 4, y: 0, color: '#00f' });
    const result = cutPieceAtLine(piece, 1);
    if (result.top) expect(result.top.color).toBe('#00f');
    if (result.bottom) expect(result.bottom.color).toBe('#00f');
  });
});

describe('clearLines', () => {
  it('완성된 라인을 제거해야 한다', () => {
    const board = createEmptyBoard();
    // 마지막 행을 모두 채움
    board[19] = Array(10).fill('#f00');
    const result = clearLines(board);
    expect(result.linesCleared).toBe(1);
    // 새 보드의 마지막 행은 비어있어야 함 (이전 18행이 내려옴)
    expect(result.board[0].every((cell) => cell === null)).toBe(true);
  });

  it('여러 라인을 동시에 제거해야 한다', () => {
    const board = createEmptyBoard();
    board[18] = Array(10).fill('#f00');
    board[19] = Array(10).fill('#0f0');
    const result = clearLines(board);
    expect(result.linesCleared).toBe(2);
    expect(result.board.length).toBe(20); // 보드 크기 유지
  });

  it('완성되지 않은 라인은 유지해야 한다', () => {
    const board = createEmptyBoard();
    board[19] = Array(10).fill('#f00');
    board[18][0] = '#0f0'; // 18행은 하나만 채움
    const result = clearLines(board);
    expect(result.linesCleared).toBe(1);
    // 18행(부분 채움)은 유지되어 보드 마지막 행으로 내려와야 함
    expect(result.board[19][0]).toBe('#0f0');
  });

  it('빈 보드에서는 0개 라인이 제거되어야 한다', () => {
    const board = createEmptyBoard();
    const result = clearLines(board);
    expect(result.linesCleared).toBe(0);
    expect(result.board).toEqual(board);
  });
});
