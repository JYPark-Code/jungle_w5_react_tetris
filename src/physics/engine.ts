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
 * 90도 단위가 아닌, 실제 각도(degree) 기반 회전.
 *
 * 동작 원리:
 * 1. angularVelocity에 회전 충격량(45도/프레임)을 더한다.
 * 2. 이 값은 매 프레임 applyGravity에서 angle에 누적 적용된다.
 * 3. 마찰에 의해 점차 감속하여 자연스러운 회전 효과를 낸다.
 */
export function rotatePiece(piece: Tetromino): Tetromino {
  const ANGULAR_IMPULSE = 45; // 회전 충격량 (도 단위)

  return {
    ...piece,
    angularVelocity: piece.angularVelocity + ANGULAR_IMPULSE,
  };
}
