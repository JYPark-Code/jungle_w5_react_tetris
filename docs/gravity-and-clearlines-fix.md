# 중력 + 라인 클리어 + 쌓인 블록 재낙하 수정 프롬프트

> 핵심 구조 변경: board(2D 배열) → lockedPieces(Tetromino[])
> 고정된 블록이 개체 정보를 유지해야 중력을 다시 받을 수 있음

---

## 근본 원인

```
현재 구조:
lockPiece → board[y][x] = color (개체 정보 소멸)
→ 고정된 블록은 그냥 색상값, 다시 중력 적용 불가

필요한 구조:
lockPiece → lockedPieces.push(piece) (개체 유지)
→ 매 프레임 lockedPieces도 중력 체크
→ 지지대 없으면 다시 낙하
→ board는 lockedPieces에서 매 프레임 재계산
```

---

## Fix 1 — contracts.ts: PhysicsState에 lockedPieces 추가

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

contracts.ts의 PhysicsState에 lockedPieces 필드를 추가해줘.

// 기존
export interface PhysicsState {
  board: Board;
  currentPiece: Tetromino | null;
  nextPiece: Tetromino | null;
  heldPiece: Tetromino | null;
  canHold: boolean;
  score: number;
  level: number;
  isGameOver: boolean;
  linesCleared: number;
}

// 수정
export interface PhysicsState {
  board: Board;              // lockedPieces에서 매 프레임 재계산 (렌더링/충돌용)
  lockedPieces: Tetromino[]; // 고정된 블록 목록 (물리 개체로 유지)
  currentPiece: Tetromino | null;
  nextPiece: Tetromino | null;
  heldPiece: Tetromino | null;
  canHold: boolean;
  score: number;
  level: number;
  isGameOver: boolean;
  linesCleared: number;
}

완료 후 커밋:
feat(contracts): PhysicsState에 lockedPieces 추가
```

---

## Fix 2 — engine.ts: GRAVITY 증가 + clearLines 90%

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/engine.ts를 수정해줘.

---

수정 1: GRAVITY 증가
// 기존
const GRAVITY = 0.05;

// 수정
const GRAVITY = 0.15;   // 회전 기능이 체감되는 속도
const MAX_VY = 1.0;     // 유지

---

수정 2: clearLines 90% 기준

// 기존
const remainingRows = board.filter(
  (row) => !row.every((cell) => cell !== null)
);

// 수정
const CLEAR_THRESHOLD = 0.9;
const remainingRows = board.filter((row) => {
  const filledCount = row.filter((cell) => cell !== null).length;
  return filledCount < Math.floor(row.length * CLEAR_THRESHOLD);
});

완료 후 커밋:
fix(physics): GRAVITY 0.15 + clearLines 90% 임계값
```

---

## Fix 3 — gameState.ts: lockedPieces 기반 물리 재구조

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/gameState.ts를 전면 수정해줘.
핵심: 고정된 블록도 매 프레임 중력을 받아야 함.

---

추가할 유틸리티 함수들:

/**
 * lockedPieces 배열에서 board(2D 배열)를 재계산한다.
 * 매 프레임 호출되어 렌더링/충돌 감지에 사용된다.
 */
function buildBoardFromPieces(pieces: Tetromino[]): Board {
  const board = createEmptyBoard();
  for (const piece of pieces) {
    const cells = getRotatedCells(piece);
    for (const cell of cells) {
      if (cell.y >= 0 && cell.y < BOARD_ROWS &&
          cell.x >= 0 && cell.x < BOARD_COLS) {
        board[cell.y][cell.x] = piece.color;
      }
    }
  }
  return board;
}

/**
 * 하나의 lockedPiece가 지지대를 잃었는지 확인한다.
 * 지지대 없음 = 바닥에 닿지 않고, 아래 셀도 비어있음
 *
 * 동작:
 * 1. 해당 piece를 제외한 나머지 pieces로 임시 board 생성
 * 2. piece를 1칸 아래로 이동했을 때 충돌이 없으면 → 지지대 없음
 */
function isUnsupported(piece: Tetromino, allPieces: Tetromino[]): boolean {
  // 자신을 제외한 나머지 pieces로 board 구성
  const otherPieces = allPieces.filter((p) => p !== piece);
  const boardWithoutSelf = buildBoardFromPieces(otherPieces);

  // 1칸 아래로 이동 시 충돌 없으면 → 지지대 없음
  const below = { ...piece, y: piece.y + 1 };
  return !checkCollision(below, boardWithoutSelf);
}

/**
 * 지지대 없는 lockedPiece에 중력을 적용한다.
 * 기울어진 방향으로 약간의 angularVelocity를 추가해
 * 자연스럽게 넘어지는 효과를 준다.
 */
function applyGravityToLocked(
  piece: Tetromino,
  board: Board
): Tetromino {
  // 기울어진 정도에 따라 약한 토크 추가 (기울어진 방향으로 넘어짐)
  const tilt = (piece.angle % 360) / 360;
  const torque = tilt > 0.1 ? 0.5 : tilt < -0.1 ? -0.5 : 0;

  return applyGravity(
    { ...piece, angularVelocity: piece.angularVelocity + torque },
    board
  );
}

---

nextTick 수정:

export function nextTick(state: PhysicsState): PhysicsState {
  if (state.isGameOver || !state.currentPiece) return state;

  // === 1단계: lockedPieces 중력 적용 ===
  // 지지대 없는 고정 블록들을 다시 낙하시킨다
  const updatedLockedPieces: Tetromino[] = [];
  let anyUnstable = false;

  for (const piece of state.lockedPieces) {
    if (isUnsupported(piece, state.lockedPieces)) {
      // 지지대 없음 → 중력 재적용 (동적 상태로)
      const boardForPhysics = buildBoardFromPieces(
        state.lockedPieces.filter((p) => p !== piece)
      );
      const fallen = applyGravityToLocked(piece, boardForPhysics);
      updatedLockedPieces.push(fallen);
      anyUnstable = true;
    } else {
      updatedLockedPieces.push(piece);
    }
  }

  // lockedPieces에서 board 재계산
  const updatedBoard = buildBoardFromPieces(updatedLockedPieces);

  // === 2단계: currentPiece 낙하 ===
  const piece = state.currentPiece;
  const movedPiece = applyGravity(piece, updatedBoard);

  // 착지 판정
  const isLanded =
    movedPiece.vy === 0 &&
    movedPiece.y === piece.y &&
    checkCollision({ ...movedPiece, y: movedPiece.y + 1 }, updatedBoard);

  if (isLanded) {
    // lockedPieces에 추가
    const newLockedPieces = [...updatedLockedPieces, piece];
    const lockedBoard = buildBoardFromPieces(newLockedPieces);

    // 라인 클리어 (90% 기준)
    const { board: clearedBoard, linesCleared } = clearLines(lockedBoard);

    // 라인 클리어 후 lockedPieces에서 소거된 행의 셀 제거
    // clearedBoard와 lockedBoard를 비교하여 사라진 셀을 lockedPieces에서 제거
    const finalLockedPieces = removeLineFromPieces(
      newLockedPieces,
      lockedBoard,
      clearedBoard
    );

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

---

추가할 유틸리티:

/**
 * 라인 클리어 후 lockedPieces에서 제거된 행의 셀을 삭제한다.
 * board 비교를 통해 사라진 셀 위치의 piece 셀을 제거한다.
 */
function removeLineFromPieces(
  pieces: Tetromino[],
  beforeBoard: Board,
  afterBoard: Board
): Tetromino[] {
  // 클리어된 행 찾기
  const clearedRows: number[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    const beforeFull = beforeBoard[r].every((c) => c !== null);
    const afterEmpty = afterBoard[r].every((c) => c === null);
    if (beforeFull && afterEmpty) clearedRows.push(r);
  }

  if (clearedRows.length === 0) return pieces;

  // 각 piece에서 클리어된 행에 속하는 셀 제거
  const result: Tetromino[] = [];
  for (const piece of pieces) {
    const cells = getRotatedCells(piece);
    const remainingCells = cells.filter((c) => !clearedRows.includes(c.y));

    if (remainingCells.length === 0) continue; // 완전히 소거된 piece 제거

    if (remainingCells.length === cells.length) {
      result.push(piece); // 변경 없음
      continue;
    }

    // 일부 셀만 남은 경우 → 새 shape으로 재구성
    const minX = Math.min(...remainingCells.map((c) => c.x));
    const minY = Math.min(...remainingCells.map((c) => c.y));
    const maxX = Math.max(...remainingCells.map((c) => c.x));
    const maxY = Math.max(...remainingCells.map((c) => c.y));
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const shape: number[][] = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );
    for (const cell of remainingCells) {
      shape[cell.y - minY][cell.x - minX] = 1;
    }

    result.push({
      ...piece,
      shape,
      x: minX,
      y: minY,
      angle: 0,
      vy: 0, // 라인 클리어 후 재낙하 시작
      vx: 0,
    });
  }

  return result;
}

---

initState에 lockedPieces 초기화 추가:

export function initState(): PhysicsState {
  return {
    board: createEmptyBoard(),
    lockedPieces: [],          // 추가
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

완료 후 테스트 실행하고 커밋:
feat(physics): lockedPieces 기반 재낙하 물리 구현
```
