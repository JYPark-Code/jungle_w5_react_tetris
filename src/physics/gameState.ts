// ============================================================
// gameState.ts — 게임 상태 관리
// 모든 함수는 순수 함수로, state를 직접 변경하지 않고 새 state를 반환한다.
// ============================================================

import type { PhysicsState, Tetromino, Board, TetrominoShape, RotateDirection } from '../../contracts';
import { applyGravity, checkCollision, clearLines, getRotatedCells, rotatePiece as engineRotate, snapRotate as engineSnapRotate } from './engine';

// ------------------------------------------------------------
// 테트로미노 정의
// ------------------------------------------------------------

/** 7가지 표준 테트로미노 shape 정의 */
const SHAPES: { shape: TetrominoShape; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: '#00f0f0' },                    // I
  { shape: [[1, 0], [1, 0], [1, 1]], color: '#0000f0' },          // J
  { shape: [[0, 1], [0, 1], [1, 1]], color: '#f0a000' },          // L
  { shape: [[1, 1], [1, 1]], color: '#f0f000' },                  // O
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' },            // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' },            // Z
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' },            // T
];

/**
 * 랜덤 테트로미노를 생성한다.
 * 보드 상단 중앙에 배치하고, 초기 속도는 0이다.
 */
function createRandomPiece(boardCols: number): Tetromino {
  const idx = Math.floor(Math.random() * SHAPES.length);
  const { shape, color } = SHAPES[idx];
  return {
    shape,
    color,
    x: Math.floor(boardCols / 2) - Math.floor(shape[0].length / 2),
    y: 0,
    angle: 0,
    vx: 0,
    vy: 0,
    angularVelocity: 0,
  };
}

// ------------------------------------------------------------
// 보드 상수
// ------------------------------------------------------------

const BOARD_ROWS = 20;
const BOARD_COLS = 10;

/**
 * 빈 보드를 생성한다.
 */
function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(null)
  );
}

// ------------------------------------------------------------
// initState: 초기 게임 상태 반환
// ------------------------------------------------------------

/**
 * 게임의 초기 상태를 생성한다.
 *
 * 동작 원리:
 * 1. 빈 보드를 만든다.
 * 2. 현재 블록과 다음 블록을 랜덤 생성한다.
 * 3. 점수, 레벨, 라인 클리어 수를 0으로 초기화한다.
 */
export function initState(): PhysicsState {
  return {
    board: createEmptyBoard(),
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
// 블록을 보드에 고정(lock)
// ------------------------------------------------------------

/**
 * 현재 블록의 셀을 보드에 색상으로 기록한다.
 * 회전이 적용된 실제 좌표를 사용한다.
 */
function lockPiece(board: Board, piece: Tetromino): Board {
  // 보드 깊은 복사
  const newBoard = board.map((row) => [...row]);
  const cells = getRotatedCells(piece);

  for (const cell of cells) {
    if (cell.y >= 0 && cell.y < BOARD_ROWS && cell.x >= 0 && cell.x < BOARD_COLS) {
      newBoard[cell.y][cell.x] = piece.color;
    }
  }

  return newBoard;
}

// ------------------------------------------------------------
// nextTick: 매 프레임 호출
// ------------------------------------------------------------

/**
 * 게임 루프의 한 프레임을 처리한다.
 *
 * 동작 원리:
 * 1. 게임 오버 상태면 그대로 반환한다.
 * 2. 현재 블록에 중력을 적용한다.
 * 3. 중력 적용 후 블록이 이동하지 않았으면(착지) 보드에 고정한다.
 * 4. 라인 클리어를 수행한다.
 * 5. 다음 블록을 현재 블록으로 교체하고 새 다음 블록을 생성한다.
 * 6. 새 블록이 즉시 충돌하면 게임 오버다.
 */
export function nextTick(state: PhysicsState): PhysicsState {
  if (state.isGameOver || !state.currentPiece) {
    return state;
  }

  const piece = state.currentPiece;
  const movedPiece = applyGravity(piece, state.board);

  // 블록이 이동하지 않았으면 착지한 것으로 판단
  const isLanded =
    movedPiece.x === piece.x &&
    movedPiece.y === piece.y &&
    movedPiece.vy === 0;

  if (isLanded) {
    // 블록을 보드에 고정
    const lockedBoard = lockPiece(state.board, piece);
    // 라인 클리어
    const { board: clearedBoard, linesCleared } = clearLines(lockedBoard);

    // 점수 계산: 라인 수에 따른 점수 (1:100, 2:300, 3:500, 4:800)
    const scoreTable = [0, 100, 300, 500, 800];
    const addScore = (scoreTable[linesCleared] ?? linesCleared * 200) * state.level;

    const totalLines = state.linesCleared + linesCleared;
    const newLevel = Math.floor(totalLines / 10) + 1;

    // 다음 블록을 현재로 교체
    const newCurrent = state.nextPiece;
    const newNext = createRandomPiece(BOARD_COLS);

    // 새 블록이 즉시 충돌하면 게임 오버
    const isGameOver = newCurrent ? checkCollision(newCurrent, clearedBoard) : true;

    return {
      board: clearedBoard,
      currentPiece: isGameOver ? null : newCurrent,
      nextPiece: newNext,
      heldPiece: state.heldPiece,
      canHold: true, // 착지 시 hold 재사용 가능
      score: state.score + addScore,
      level: newLevel,
      isGameOver,
      linesCleared: totalLines,
    };
  }

  // 아직 낙하 중
  return {
    ...state,
    currentPiece: movedPiece,
  };
}

// ------------------------------------------------------------
// movePiece: 블록 좌우 이동
// ------------------------------------------------------------

/**
 * 블록을 좌우로 이동시킨다.
 *
 * 동작 원리:
 * 1. direction이 'left'이면 x-1, 'right'이면 x+1로 이동한다.
 * 2. 이동 후 충돌이 발생하면 이동하지 않는다.
 */
export function movePiece(
  state: PhysicsState,
  direction: 'left' | 'right'
): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;

  const dx = direction === 'left' ? -1 : 1;
  const moved: Tetromino = {
    ...state.currentPiece,
    x: state.currentPiece.x + dx,
  };

  if (checkCollision(moved, state.board)) {
    return state; // 충돌 시 이동 무시
  }

  return {
    ...state,
    currentPiece: moved,
  };
}

// ------------------------------------------------------------
// hardDrop: 블록 즉시 낙하
// ------------------------------------------------------------

/**
 * 블록을 즉시 바닥까지 낙하시킨다.
 *
 * 동작 원리:
 * 1. 블록의 y를 1씩 증가시키며 충돌할 때까지 반복한다.
 * 2. 충돌 직전 위치에 블록을 배치한다.
 * 3. 보드에 고정하고 라인 클리어를 수행한다.
 */
export function hardDrop(state: PhysicsState): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;

  let piece = { ...state.currentPiece, angle: state.currentPiece.angle };
  let dropDistance = 0;

  // 충돌할 때까지 1칸씩 내려감
  while (true) {
    const next: Tetromino = { ...piece, y: piece.y + 1 };
    if (checkCollision(next, state.board)) break;
    piece = next;
    dropDistance++;
  }

  // 보드에 고정
  const lockedBoard = lockPiece(state.board, piece);
  const { board: clearedBoard, linesCleared } = clearLines(lockedBoard);

  const scoreTable = [0, 100, 300, 500, 800];
  const addScore =
    ((scoreTable[linesCleared] ?? linesCleared * 200) * state.level) +
    dropDistance * 2; // 하드드롭 보너스

  const totalLines = state.linesCleared + linesCleared;
  const newLevel = Math.floor(totalLines / 10) + 1;

  const newCurrent = state.nextPiece;
  const newNext = createRandomPiece(BOARD_COLS);

  const isGameOver = newCurrent ? checkCollision(newCurrent, clearedBoard) : true;

  return {
    board: clearedBoard,
    currentPiece: isGameOver ? null : newCurrent,
    nextPiece: newNext,
    heldPiece: state.heldPiece,
    canHold: true, // 착지 시 hold 재사용 가능
    score: state.score + addScore,
    level: newLevel,
    isGameOver,
    linesCleared: totalLines,
  };
}

// ------------------------------------------------------------
// holdPiece: 블록 보관 (R키)
// ------------------------------------------------------------

/**
 * 현재 블록을 보관함에 저장하고 교체한다.
 *
 * 동작 원리:
 * 1. canHold가 false이면 무시한다 (착지 전 연속 사용 방지).
 * 2. heldPiece가 null이면: currentPiece → held, nextPiece → current로 교체.
 * 3. heldPiece가 있으면: currentPiece ↔ heldPiece 교체.
 * 4. 교체 후 canHold = false로 설정 (착지 시 true로 복원).
 * 5. 교체 후 새 currentPiece가 즉시 충돌하면 게임 오버.
 */
export function holdPiece(state: PhysicsState): PhysicsState {
  if (!state.currentPiece || state.isGameOver || !state.canHold) {
    return state;
  }

  // 보관할 블록: 위치/속도를 초기화하여 저장
  const pieceToHold: Tetromino = {
    ...state.currentPiece,
    x: Math.floor(BOARD_COLS / 2) - Math.floor(state.currentPiece.shape[0].length / 2),
    y: 0,
    angle: 0,
    vx: 0,
    vy: 0,
    angularVelocity: 0,
  };

  let newCurrent: Tetromino | null;
  let newNext = state.nextPiece;

  if (state.heldPiece === null) {
    // 보관함이 비어있으면: nextPiece를 current로
    newCurrent = state.nextPiece;
    newNext = createRandomPiece(BOARD_COLS);
  } else {
    // 보관함에 있으면: heldPiece ↔ currentPiece 교체
    newCurrent = {
      ...state.heldPiece,
      x: Math.floor(BOARD_COLS / 2) - Math.floor(state.heldPiece.shape[0].length / 2),
      y: 0,
      angle: 0,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
    };
  }

  // 교체 후 게임 오버 체크
  const isGameOver = newCurrent ? checkCollision(newCurrent, state.board) : true;

  return {
    ...state,
    currentPiece: isGameOver ? null : newCurrent,
    nextPiece: newNext,
    heldPiece: pieceToHold,
    canHold: false, // 착지 전까지 재사용 불가
    isGameOver,
  };
}

// ------------------------------------------------------------
// rotatePieceInState: 물리 기반 자유 회전 (Q/E키)
// ------------------------------------------------------------

/**
 * 블록에 회전 충격량을 가한다 (360도 자유 회전).
 * Q키: 반시계방향(ccw), E키: 시계방향(cw).
 *
 * 동작 원리:
 * 1. engine의 rotatePiece를 호출하여 angularVelocity에 충격량을 더한다.
 * 2. 실제 angle 변화는 매 프레임 applyGravity에서 누적 적용된다.
 * 3. 마찰에 의해 자연스럽게 감속한다.
 */
export function rotatePieceInState(
  state: PhysicsState,
  direction: RotateDirection
): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;

  return {
    ...state,
    currentPiece: engineRotate(state.currentPiece, direction),
  };
}

// ------------------------------------------------------------
// snapRotateInState: 90도 즉시 회전 (↑키)
// ------------------------------------------------------------

/**
 * 블록을 90도 즉시 회전시킨다 (전통 테트리스 스타일).
 * 충돌 시 회전을 무시한다.
 */
export function snapRotateInState(state: PhysicsState): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;

  const rotated = engineSnapRotate(state.currentPiece, state.board);

  // 회전이 무시된 경우 (충돌) 원본 반환
  if (rotated === state.currentPiece) return state;

  return {
    ...state,
    currentPiece: rotated,
  };
}

// ------------------------------------------------------------
// softDrop: 소프트 드롭 (↓키)
// ------------------------------------------------------------

/**
 * 블록의 낙하 속도를 일시적으로 높인다 (↓키).
 *
 * 동작 원리:
 * 1. vy에 소프트 드롭 가속도(1.0)를 더한다.
 * 2. 충돌 시 이동하지 않는다.
 * 3. 소프트 드롭 거리에 비례한 보너스 점수(1점/칸)를 추가한다.
 */
export function softDrop(state: PhysicsState): PhysicsState {
  if (!state.currentPiece || state.isGameOver) return state;

  const SOFT_DROP_SPEED = 1.0;

  const dropped: Tetromino = {
    ...state.currentPiece,
    y: state.currentPiece.y + SOFT_DROP_SPEED,
    vy: SOFT_DROP_SPEED,
  };

  if (checkCollision(dropped, state.board)) {
    return state;
  }

  return {
    ...state,
    currentPiece: dropped,
    score: state.score + 1, // 소프트 드롭 보너스
  };
}
