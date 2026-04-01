// ============================================================
// gameState.ts — 게임 상태 관리 (lockedPieces 기반)
// 고정된 블록이 개체 정보를 유지하여 중력 재적용 가능
// ============================================================

import type { PhysicsState, Tetromino, Board, TetrominoShape, RotateDirection } from '../../contracts';
import { applyGravity, checkCollision, clearLines, getRotatedCells, rotatePiece as engineRotate, snapRotate as engineSnapRotate } from './engine';

// 테트로미노 정의
const SHAPES: { shape: TetrominoShape; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: '#00f0f0' },
  { shape: [[1, 0], [1, 0], [1, 1]], color: '#0000f0' },
  { shape: [[0, 1], [0, 1], [1, 1]], color: '#f0a000' },
  { shape: [[1, 1], [1, 1]], color: '#f0f000' },
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' },
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' },
];

function createRandomPiece(boardCols: number): Tetromino {
  const idx = Math.floor(Math.random() * SHAPES.length);
  const { shape, color } = SHAPES[idx];
  return {
    shape, color,
    x: Math.floor(boardCols / 2) - Math.floor(shape[0].length / 2),
    y: 0, angle: 0, vx: 0, vy: 0, angularVelocity: 0,
  };
}

const BOARD_ROWS = 20;
const BOARD_COLS = 10;

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
}

// ------------------------------------------------------------
// lockedPieces → board 재계산
// ------------------------------------------------------------

function buildBoardFromPieces(pieces: Tetromino[]): Board {
  const board = createEmptyBoard();
  for (const piece of pieces) {
    const cells = getRotatedCells(piece);
    for (const cell of cells) {
      if (cell.y >= 0 && cell.y < BOARD_ROWS && cell.x >= 0 && cell.x < BOARD_COLS) {
        if (board[cell.y][cell.x] === null) {
          board[cell.y][cell.x] = piece.color;
        }
      }
    }
  }
  return board;
}

// ------------------------------------------------------------
// 지지대 확인: 아래에 바닥 또는 다른 블록이 있는지
// ------------------------------------------------------------

function isUnsupported(piece: Tetromino, allPieces: Tetromino[]): boolean {
  const otherPieces = allPieces.filter((p) => p !== piece);
  const boardWithoutSelf = buildBoardFromPieces(otherPieces);
  const below = { ...piece, y: piece.y + 1 };
  return !checkCollision(below, boardWithoutSelf);
}

// ------------------------------------------------------------
// 라인 클리어 후 lockedPieces에서 제거된 셀 삭제
// ------------------------------------------------------------

function removeLineFromPieces(
  pieces: Tetromino[],
  beforeBoard: Board,
  afterBoard: Board
): Tetromino[] {
  const clearedRows: number[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    const beforeFull = beforeBoard[r].filter((c) => c !== null).length >= Math.floor(BOARD_COLS * 0.9);
    const afterEmpty = afterBoard[r].every((c) => c === null);
    if (beforeFull && afterEmpty) clearedRows.push(r);
  }

  if (clearedRows.length === 0) return pieces;

  const result: Tetromino[] = [];
  for (const piece of pieces) {
    const cells = getRotatedCells(piece);
    const remainingCells = cells.filter((c) => !clearedRows.includes(c.y));

    if (remainingCells.length === 0) continue;
    if (remainingCells.length === cells.length) { result.push(piece); continue; }

    const minX = Math.min(...remainingCells.map((c) => c.x));
    const minY = Math.min(...remainingCells.map((c) => c.y));
    const maxX = Math.max(...remainingCells.map((c) => c.x));
    const maxY = Math.max(...remainingCells.map((c) => c.y));
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const shape: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
    for (const cell of remainingCells) {
      shape[cell.y - minY][cell.x - minX] = 1;
    }

    // getRotatedCells는 cell.y = Math.round(piece.y + (rowIndex - cy)) 계산
    // piece.y = minY + cy 로 설정해야 첫 번째 행이 minY에 정확히 배치됨
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    result.push({ ...piece, shape, x: minX + cx, y: minY + cy, angle: 0, vy: 0, vx: 0 });
  }

  return result;
}

// ------------------------------------------------------------
// initState
// ------------------------------------------------------------

export function initState(): PhysicsState {
  return {
    board: createEmptyBoard(),
    lockedPieces: [],
    currentPiece: createRandomPiece(BOARD_COLS),
    nextPiece: createRandomPiece(BOARD_COLS),
    heldPiece: null,
    canHold: true,
    score: 0,
    level: 1,
    isGameOver: false,
    linesCleared: 0,
  };
}

// ------------------------------------------------------------
// nextTick
// ------------------------------------------------------------

export function nextTick(state: PhysicsState): PhysicsState {
  if (state.isGameOver || !state.currentPiece) return state;

  // === 1단계: lockedPieces 중력 적용 ===
  const updatedLockedPieces: Tetromino[] = [];
  for (const p of state.lockedPieces) {
    if (isUnsupported(p, state.lockedPieces)) {
      const boardForPhysics = buildBoardFromPieces(state.lockedPieces.filter((pp) => pp !== p));
      const fallen = applyGravity(p, boardForPhysics);
      updatedLockedPieces.push(fallen);
    } else {
      updatedLockedPieces.push(p);
    }
  }

  const updatedBoard = buildBoardFromPieces(updatedLockedPieces);

  // === 2단계: currentPiece 낙하 ===
  const piece = state.currentPiece;
  const movedPiece = applyGravity(piece, updatedBoard);

  const isLanded =
    movedPiece.vy === 0 &&
    movedPiece.y === piece.y &&
    checkCollision({ ...movedPiece, y: movedPiece.y + 1 }, updatedBoard);

  if (isLanded) {
    const newLockedPieces = [...updatedLockedPieces, piece];
    const lockedBoard = buildBoardFromPieces(newLockedPieces);
    const { board: clearedBoard, linesCleared } = clearLines(lockedBoard);
    const finalLockedPieces = removeLineFromPieces(newLockedPieces, lockedBoard, clearedBoard);

    const scoreTable = [0, 100, 300, 500, 800];
    const addScore = (scoreTable[linesCleared] ?? linesCleared * 200) * state.level;
    const totalLines = state.linesCleared + linesCleared;
    const newLevel = Math.floor(totalLines / 10) + 1;

    const newCurrent = state.nextPiece;
    const newNext = createRandomPiece(BOARD_COLS);
    const isGameOver = newCurrent
      ? checkCollision({ ...newCurrent, y: 0 }, clearedBoard)
      : true;

    return {
      board: clearedBoard,
      lockedPieces: finalLockedPieces,
      currentPiece: isGameOver ? null : newCurrent,
      nextPiece: newNext,
      heldPiece: state.heldPiece,
      canHold: true,
      score: state.score + addScore,
      level: newLevel,
      isGameOver,
      linesCleared: totalLines,
    };
  }

  return {
    ...state,
    board: updatedBoard,
    lockedPieces: updatedLockedPieces,
    currentPiece: movedPiece,
  };
}

// ------------------------------------------------------------
// movePiece
// ------------------------------------------------------------

export function movePiece(state: PhysicsState, direction: 'left' | 'right'): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;
  const dx = direction === 'left' ? -1 : 1;
  const moved: Tetromino = { ...state.currentPiece, x: state.currentPiece.x + dx };
  if (checkCollision(moved, state.board)) return state;
  return { ...state, currentPiece: moved };
}

// ------------------------------------------------------------
// hardDrop
// ------------------------------------------------------------

export function hardDrop(state: PhysicsState): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;
  let piece = { ...state.currentPiece };
  let dropDistance = 0;

  while (true) {
    const next: Tetromino = { ...piece, y: piece.y + 1 };
    if (checkCollision(next, state.board)) break;
    piece = next;
    dropDistance++;
  }

  const newLockedPieces = [...state.lockedPieces, piece];
  const lockedBoard = buildBoardFromPieces(newLockedPieces);
  const { board: clearedBoard, linesCleared } = clearLines(lockedBoard);
  const finalLockedPieces = removeLineFromPieces(newLockedPieces, lockedBoard, clearedBoard);

  const scoreTable = [0, 100, 300, 500, 800];
  const addScore = ((scoreTable[linesCleared] ?? linesCleared * 200) * state.level) + dropDistance * 2;
  const totalLines = state.linesCleared + linesCleared;
  const newLevel = Math.floor(totalLines / 10) + 1;

  const newCurrent = state.nextPiece;
  const newNext = createRandomPiece(BOARD_COLS);
  const isGameOver = newCurrent ? checkCollision(newCurrent, clearedBoard) : true;

  return {
    board: clearedBoard,
    lockedPieces: finalLockedPieces,
    currentPiece: isGameOver ? null : newCurrent,
    nextPiece: newNext,
    heldPiece: state.heldPiece,
    canHold: true,
    score: state.score + addScore,
    level: newLevel,
    isGameOver,
    linesCleared: totalLines,
  };
}

// ------------------------------------------------------------
// holdPiece
// ------------------------------------------------------------

export function holdPiece(state: PhysicsState): PhysicsState {
  if (!state.currentPiece || state.isGameOver || !state.canHold) return state;

  const pieceToHold: Tetromino = {
    ...state.currentPiece,
    x: Math.floor(BOARD_COLS / 2) - Math.floor(state.currentPiece.shape[0].length / 2),
    y: 0, angle: 0, vx: 0, vy: 0, angularVelocity: 0,
  };

  let newCurrent: Tetromino | null;
  let newNext = state.nextPiece;

  if (state.heldPiece === null) {
    newCurrent = state.nextPiece;
    newNext = createRandomPiece(BOARD_COLS);
  } else {
    newCurrent = {
      ...state.heldPiece,
      x: Math.floor(BOARD_COLS / 2) - Math.floor(state.heldPiece.shape[0].length / 2),
      y: 0, angle: 0, vx: 0, vy: 0, angularVelocity: 0,
    };
  }

  const isGameOver = newCurrent ? checkCollision(newCurrent, state.board) : true;

  return {
    ...state,
    currentPiece: isGameOver ? null : newCurrent,
    nextPiece: newNext,
    heldPiece: pieceToHold,
    canHold: false,
    isGameOver,
  };
}

// ------------------------------------------------------------
// rotatePieceInState / snapRotateInState / softDrop
// ------------------------------------------------------------

export function rotatePieceInState(state: PhysicsState, direction: RotateDirection): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;
  return { ...state, currentPiece: engineRotate(state.currentPiece, direction) };
}

export function snapRotateInState(state: PhysicsState): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;
  const rotated = engineSnapRotate(state.currentPiece, state.board);
  if (rotated === state.currentPiece) return state;
  return { ...state, currentPiece: rotated };
}

export function softDrop(state: PhysicsState): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;
  const dropped: Tetromino = {
    ...state.currentPiece,
    y: state.currentPiece.y + 1,
    vy: 1,
  };
  if (checkCollision(dropped, state.board)) return state;
  return { ...state, currentPiece: dropped, score: state.score + 1 };
}
