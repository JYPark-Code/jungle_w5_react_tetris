// ============================================================
// engine.ts — 물리 엔진 기반 함수
// contracts.ts의 타입을 기준으로 순수 함수로 구현
// ============================================================

import type {
  Tetromino,
  Board,
  ApplyGravityFn,
  CheckCollisionFn,
  CutPieceAtLineFn,
  ClearLinesFn,
  RotateDirection,
  TetrominoShape,
} from '../../contracts';

// ------------------------------------------------------------
// 유틸리티: 회전된 블록의 실제 셀 좌표를 계산
// ------------------------------------------------------------

/**
 * 블록의 shape 배열과 위치/각도를 기반으로
 * 실제 보드 상의 셀 좌표(x, y)를 반환한다.
 *
 * 동작 원리:
 * 1. shape의 각 셀(1인 곳)에 대해 블록 중심 기준 상대 좌표를 구한다.
 * 2. angle(도 단위)만큼 2D 회전 변환을 적용한다.
 * 3. 블록의 위치(x, y)를 더해 보드 좌표로 변환한다.
 * 4. 반올림하여 정수 좌표로 반환한다.
 */
export function getRotatedCells(piece: Tetromino): { x: number; y: number }[] {
  const { shape, x, y, angle } = piece;
  const rows = shape.length;
  const cols = shape[0].length;
  // 블록 shape의 중심점
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const cells: { x: number; y: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r][c]) {
        // 중심 기준 상대 좌표
        const dx = c - cx;
        const dy = r - cy;
        // 2D 회전 변환
        const rx = dx * cosA - dy * sinA;
        const ry = dx * sinA + dy * cosA;
        // 보드 좌표로 변환 (반올림)
        cells.push({
          x: Math.round(x + rx),
          y: Math.round(y + ry),
        });
      }
    }
  }

  return cells;
}

// ------------------------------------------------------------
// checkCollision: 충돌 여부 반환
// ------------------------------------------------------------

/**
 * 블록이 보드 경계를 벗어나거나 이미 채워진 셀과 겹치는지 확인한다.
 *
 * 동작 원리:
 * 1. 회전이 적용된 실제 셀 좌표를 구한다.
 * 2. 각 셀이 보드 범위 밖이면 충돌이다.
 * 3. 각 셀 위치에 이미 블록이 있으면 충돌이다.
 */
export const checkCollision: CheckCollisionFn = (
  piece: Tetromino,
  board: Board
): boolean => {
  const cells = getRotatedCells(piece);
  const rows = board.length;
  const cols = board[0].length;

  for (const cell of cells) {
    // 보드 경계 체크
    if (cell.x < 0 || cell.x >= cols || cell.y < 0 || cell.y >= rows) {
      return true;
    }
    // 기존 블록과 충돌 체크
    if (board[cell.y][cell.x] !== null) {
      return true;
    }
  }

  return false;
};

// ------------------------------------------------------------
// applyGravity: 중력 적용 후 새 Tetromino 반환
// ------------------------------------------------------------

/**
 * 중력을 적용하여 블록을 아래로 이동시킨다.
 *
 * 동작 원리:
 * 1. vy(수직 속도)에 중력 가속도(0.5)를 더한다.
 * 2. 블록의 y 좌표에 vy를 더해 새 위치를 구한다.
 * 3. vx(수평 속도)도 적용하고 마찰(0.9)로 감쇠시킨다.
 * 4. angularVelocity가 있으면 angle에 더하고 감쇠시킨다.
 * 5. 새 위치에서 충돌이 발생하면 이전 위치를 유지하고 속도를 0으로 리셋한다.
 */
export const applyGravity: ApplyGravityFn = (
  piece: Tetromino,
  board: Board
): Tetromino => {
  const GRAVITY = 0.5;
  const FRICTION = 0.9;
  const ANGULAR_FRICTION = 0.85;

  // 새 속도 계산
  const newVy = piece.vy + GRAVITY;
  const newVx = piece.vx * FRICTION;
  const newAngularVelocity = piece.angularVelocity * ANGULAR_FRICTION;

  // 새 위치/각도 계산
  const newY = piece.y + newVy;
  const newX = piece.x + newVx;
  const newAngle = piece.angle + newAngularVelocity;

  const moved: Tetromino = {
    ...piece,
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
    angle: newAngle,
    angularVelocity: newAngularVelocity,
  };

  // 충돌 시 이전 위치 유지, 속도 리셋
  if (checkCollision(moved, board)) {
    return {
      ...piece,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
    };
  }

  return moved;
};

// ------------------------------------------------------------
// rotatePiece: 물리 기반 회전 (실제 각도)
// ------------------------------------------------------------

/**
 * 블록에 회전 충격량(angular impulse)을 가한다.
 * 360도 자유 회전 — Q키(반시계), E키(시계) 대응.
 *
 * 동작 원리:
 * 1. direction에 따라 양(+cw) 또는 음(-ccw) 충격량을 부여한다.
 * 2. 이 값은 매 프레임 applyGravity에서 angle에 누적 적용된다.
 * 3. 마찰에 의해 점차 감속하여 자연스러운 회전 효과를 낸다.
 */
export function rotatePiece(
  piece: Tetromino,
  direction: RotateDirection = 'cw'
): Tetromino {
  const ANGULAR_IMPULSE = 45; // 회전 충격량 (도 단위)
  const impulse = direction === 'cw' ? ANGULAR_IMPULSE : -ANGULAR_IMPULSE;

  return {
    ...piece,
    angularVelocity: piece.angularVelocity + impulse,
  };
}

/**
 * 90도 즉시 회전 (↑키).
 * 전통 테트리스 스타일: 각도를 즉시 90도 단위로 변경한다.
 *
 * 동작 원리:
 * 1. 현재 angle에 90도를 더한 새 블록을 만든다.
 * 2. 새 위치에서 충돌이 발생하면 회전하지 않는다.
 * 3. angularVelocity는 0으로 리셋하여 관성 회전을 멈춘다.
 */
export function snapRotate(piece: Tetromino, board: Board): Tetromino {
  const rotated: Tetromino = {
    ...piece,
    angle: piece.angle + 90,
    angularVelocity: 0, // 즉시 회전이므로 관성 제거
  };

  // 충돌 시 회전 무시
  if (checkCollision(rotated, board)) {
    return piece;
  }

  return rotated;
}

// ------------------------------------------------------------
// cutPieceAtLine: 기울어진 블록을 수평선 기준으로 절단
// ------------------------------------------------------------

/**
 * 블록을 주어진 수평선(lineY)을 기준으로 위/아래로 절단한다.
 * 이 프로젝트의 핵심 차별점: 기울어진 블록도 정확히 절단 처리.
 *
 * 동작 원리:
 * 1. 회전이 적용된 실제 셀 좌표를 구한다.
 * 2. 각 셀을 lineY 기준으로 위(y < lineY)와 아래(y >= lineY)로 분류한다.
 * 3. 위쪽 셀만으로 새 shape을 구성하여 top Tetromino를 만든다.
 * 4. 아래쪽 셀만으로 bottom Tetromino를 만든다.
 * 5. 한쪽에 셀이 없으면 null을 반환한다.
 */
export const cutPieceAtLine: CutPieceAtLineFn = (
  piece: Tetromino,
  lineY: number
): { top: Tetromino | null; bottom: Tetromino | null } => {
  const cells = getRotatedCells(piece);

  // 셀을 lineY 기준으로 분류
  const topCells = cells.filter((c) => c.y < lineY);
  const bottomCells = cells.filter((c) => c.y >= lineY);

  /**
   * 셀 목록으로부터 새 Tetromino를 생성한다.
   * 셀의 최소 좌표를 기준으로 shape 배열을 재구성하고,
   * 위치를 해당 최소 좌표로 설정한다.
   * 절단 후에는 각도를 0으로 리셋한다 (이미 회전이 셀 좌표에 반영됨).
   */
  function buildPiece(
    filteredCells: { x: number; y: number }[]
  ): Tetromino | null {
    if (filteredCells.length === 0) return null;

    const minX = Math.min(...filteredCells.map((c) => c.x));
    const minY = Math.min(...filteredCells.map((c) => c.y));
    const maxX = Math.max(...filteredCells.map((c) => c.x));
    const maxY = Math.max(...filteredCells.map((c) => c.y));

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // 새 shape 배열 생성
    const shape: number[][] = Array.from({ length: height }, () =>
      Array(width).fill(0)
    );

    for (const cell of filteredCells) {
      shape[cell.y - minY][cell.x - minX] = 1;
    }

    return {
      shape,
      x: minX,
      y: minY,
      angle: 0, // 회전은 이미 셀 좌표에 반영되었으므로 리셋
      vx: 0,
      vy: 0,
      angularVelocity: 0,
      color: piece.color,
    };
  }

  return {
    top: buildPiece(topCells),
    bottom: buildPiece(bottomCells),
  };
};

// ------------------------------------------------------------
// clearLines: 완성된 라인 제거 후 새 보드 반환
// ------------------------------------------------------------

/**
 * 보드에서 완성된 라인(모든 셀이 채워진 행)을 제거한다.
 *
 * 동작 원리:
 * 1. 각 행을 검사하여 모든 셀이 null이 아닌 행을 찾는다.
 * 2. 완성된 행을 제거한다.
 * 3. 제거된 행 수만큼 빈 행을 보드 상단에 추가한다.
 * 4. 새 보드와 제거된 라인 수를 반환한다.
 */
export const clearLines: ClearLinesFn = (
  board: Board
): { board: Board; linesCleared: number } => {
  const cols = board[0].length;

  // 완성되지 않은 행만 남긴다
  const remainingRows = board.filter(
    (row) => !row.every((cell) => cell !== null)
  );

  const linesCleared = board.length - remainingRows.length;

  // 제거된 행 수만큼 빈 행을 상단에 추가
  const emptyRows: (string | null)[][] = Array.from(
    { length: linesCleared },
    () => Array(cols).fill(null)
  );

  return {
    board: [...emptyRows, ...remainingRows],
    linesCleared,
  };
};
