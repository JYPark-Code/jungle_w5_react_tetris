import { describe, it, expect } from 'vitest';
import { initState, nextTick, movePiece, hardDrop, holdPiece, rotatePieceInState, snapRotateInState, softDrop } from './gameState';
import type { PhysicsState, Board, Tetromino } from '../../contracts';

// 테스트용 빈 보드 생성
function createEmptyBoard(rows = 20, cols = 10): Board {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

// 테스트용 고정된 상태 생성 (랜덤 제거)
function createTestState(overrides: Partial<PhysicsState> = {}): PhysicsState {
  const testPiece: Tetromino = {
    shape: [[1, 1], [1, 1]], // O 블록
    x: 4,
    y: 0,
    angle: 0,
    vx: 0,
    vy: 0,
    angularVelocity: 0,
    color: '#ff0',
  };

  return {
    board: createEmptyBoard(),
    lockedPieces: [],
    currentPiece: testPiece,
    nextPiece: { ...testPiece, x: 4, y: 0 },
    heldPiece: null,
    canHold: true,
    score: 0,
    level: 1,
    isGameOver: false,
    linesCleared: 0,
    ...overrides,
  };
}

describe('initState', () => {
  it('초기 상태를 올바르게 생성해야 한다', () => {
    const state = initState();
    expect(state.board.length).toBe(20);
    expect(state.board[0].length).toBe(10);
    expect(state.currentPiece).not.toBeNull();
    expect(state.nextPiece).not.toBeNull();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.isGameOver).toBe(false);
    expect(state.linesCleared).toBe(0);
    expect(state.heldPiece).toBeNull();
    expect(state.canHold).toBe(true);
  });

  it('보드가 모두 비어있어야 한다', () => {
    const state = initState();
    for (const row of state.board) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });
});

describe('nextTick', () => {
  it('중력을 적용하여 블록이 아래로 이동해야 한다', () => {
    const state = createTestState();
    const next = nextTick(state);
    expect(next.currentPiece).not.toBeNull();
    expect(next.currentPiece!.y).toBeGreaterThan(state.currentPiece!.y);
  });

  it('게임 오버 상태에서는 변경 없이 반환해야 한다', () => {
    const state = createTestState({ isGameOver: true });
    const next = nextTick(state);
    expect(next).toBe(state);
  });

  it('블록이 바닥에 착지하면 보드에 고정되어야 한다', () => {
    // 1행짜리 블록을 바닥(y=19)에 배치 → 중력 적용 시 y=20으로 충돌 → 착지
    const state = createTestState({
      currentPiece: {
        shape: [[1, 1]],
        x: 4,
        y: 19,
        angle: 0,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
        color: '#ff0',
      },
    });

    // 반복 tick으로 착지까지 진행
    let current = state;
    for (let i = 0; i < 5; i++) {
      current = nextTick(current);
    }

    // 착지 후 보드에 블록이 기록되어야 한다
    const hasBlockOnBoard = current.board.some((row) =>
      row.some((cell) => cell !== null)
    );
    expect(hasBlockOnBoard).toBe(true);
  });

  it('착지 후 다음 블록이 현재 블록이 되어야 한다', () => {
    const state = createTestState({
      currentPiece: {
        shape: [[1, 1], [1, 1]],
        x: 4,
        y: 18,
        angle: 0,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
        color: '#ff0',
      },
    });
    const next = nextTick(state);
    // 착지 후 새 currentPiece가 생겨야 한다
    if (!next.isGameOver) {
      expect(next.currentPiece).not.toBeNull();
    }
  });

  it('하드드롭 시 점수 보너스가 추가되어야 한다', () => {
    const state = createTestState();
    const dropped = hardDrop(state);
    // 하드드롭 보너스 (dropDistance * 2)
    expect(dropped.score).toBeGreaterThan(0);
  });
});

describe('movePiece', () => {
  it('왼쪽으로 이동하면 x가 1 감소해야 한다', () => {
    const state = createTestState();
    const moved = movePiece(state, 'left');
    expect(moved.currentPiece!.x).toBe(state.currentPiece!.x - 1);
  });

  it('오른쪽으로 이동하면 x가 1 증가해야 한다', () => {
    const state = createTestState();
    const moved = movePiece(state, 'right');
    expect(moved.currentPiece!.x).toBe(state.currentPiece!.x + 1);
  });

  it('벽 충돌 시 이동하지 않아야 한다', () => {
    const state = createTestState({
      currentPiece: {
        shape: [[1, 1], [1, 1]],
        x: 0,
        y: 0,
        angle: 0,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
        color: '#ff0',
      },
    });
    const moved = movePiece(state, 'left');
    expect(moved.currentPiece!.x).toBe(0); // 이동 안 됨
  });

  it('게임 오버 상태에서는 이동하지 않아야 한다', () => {
    const state = createTestState({ isGameOver: true });
    const moved = movePiece(state, 'left');
    expect(moved).toBe(state);
  });

  it('원본 상태가 변경되지 않아야 한다 (순수 함수)', () => {
    const state = createTestState();
    const originalX = state.currentPiece!.x;
    movePiece(state, 'left');
    expect(state.currentPiece!.x).toBe(originalX);
  });
});

describe('hardDrop', () => {
  it('블록이 즉시 바닥에 착지해야 한다', () => {
    const state = createTestState();
    const dropped = hardDrop(state);
    // 착지 후 보드에 블록이 기록되어야 한다
    const hasBlockOnBoard = dropped.board.some((row) =>
      row.some((cell) => cell !== null)
    );
    expect(hasBlockOnBoard).toBe(true);
  });

  it('하드드롭 후 점수에 드롭 보너스가 포함되어야 한다', () => {
    const state = createTestState();
    const dropped = hardDrop(state);
    expect(dropped.score).toBeGreaterThan(0); // 드롭 보너스
  });

  it('하드드롭 후 다음 블록이 현재 블록이 되어야 한다', () => {
    const state = createTestState();
    const dropped = hardDrop(state);
    if (!dropped.isGameOver) {
      expect(dropped.currentPiece).not.toBeNull();
    }
  });

  it('게임 오버 상태에서는 동작하지 않아야 한다', () => {
    const state = createTestState({ isGameOver: true });
    const dropped = hardDrop(state);
    expect(dropped).toBe(state);
  });

  it('원본 상태가 변경되지 않아야 한다 (순수 함수)', () => {
    const state = createTestState();
    const originalBoard = state.board.map((row) => [...row]);
    hardDrop(state);
    expect(state.board).toEqual(originalBoard);
  });

  it('하드드롭 후 canHold이 true로 복원되어야 한다', () => {
    const state = createTestState({ canHold: false });
    const dropped = hardDrop(state);
    expect(dropped.canHold).toBe(true);
  });
});

describe('holdPiece', () => {
  const iPiece: Tetromino = {
    shape: [[1, 1, 1, 1]],
    x: 3,
    y: 2,
    angle: 15,
    vx: 1,
    vy: 0.5,
    angularVelocity: 10,
    color: '#00f0f0',
  };

  it('보관함이 비어있으면 currentPiece를 보관하고 nextPiece를 current로 교체해야 한다', () => {
    const state = createTestState();
    const result = holdPiece(state);
    expect(result.heldPiece).not.toBeNull();
    expect(result.heldPiece!.color).toBe(state.currentPiece!.color);
    // nextPiece가 current가 되었으므로 새로운 nextPiece가 생성됨
    expect(result.currentPiece).not.toBeNull();
  });

  it('보관함에 블록이 있으면 currentPiece ↔ heldPiece 교체해야 한다', () => {
    const state = createTestState({ heldPiece: iPiece });
    const result = holdPiece(state);
    // 기존 held(I블록)가 current로, 기존 current(O블록)가 held로
    expect(result.heldPiece!.color).toBe('#ff0'); // O블록 색상
    expect(result.currentPiece!.color).toBe('#00f0f0'); // I블록 색상
  });

  it('교체 후 canHold가 false가 되어야 한다', () => {
    const state = createTestState();
    const result = holdPiece(state);
    expect(result.canHold).toBe(false);
  });

  it('canHold가 false이면 hold를 무시해야 한다 (연속 R키 방지)', () => {
    const state = createTestState({ canHold: false });
    const result = holdPiece(state);
    expect(result).toBe(state); // 변경 없음
  });

  it('보관된 블록의 위치/속도가 초기화되어야 한다', () => {
    const state = createTestState({
      currentPiece: iPiece, // 위치/속도/각도가 있는 블록
    });
    const result = holdPiece(state);
    expect(result.heldPiece!.y).toBe(0);
    expect(result.heldPiece!.angle).toBe(0);
    expect(result.heldPiece!.vx).toBe(0);
    expect(result.heldPiece!.vy).toBe(0);
    expect(result.heldPiece!.angularVelocity).toBe(0);
  });

  it('교체로 꺼낸 블록도 위치/속도가 초기화되어야 한다', () => {
    const heldWithVelocity: Tetromino = { ...iPiece, vx: 5, vy: 3, angle: 90 };
    const state = createTestState({ heldPiece: heldWithVelocity });
    const result = holdPiece(state);
    expect(result.currentPiece!.y).toBe(0);
    expect(result.currentPiece!.angle).toBe(0);
    expect(result.currentPiece!.vx).toBe(0);
    expect(result.currentPiece!.vy).toBe(0);
  });

  it('게임 오버 상태에서는 hold를 무시해야 한다', () => {
    const state = createTestState({ isGameOver: true });
    const result = holdPiece(state);
    expect(result).toBe(state);
  });

  it('착지 후 canHold이 true로 복원되어야 한다', () => {
    // hold 사용 → canHold=false → 착지 → canHold=true
    const state = createTestState();
    const held = holdPiece(state);
    expect(held.canHold).toBe(false);

    // 착지 시뮬레이션 (hardDrop)
    const dropped = hardDrop(held);
    expect(dropped.canHold).toBe(true);
  });
});

describe('rotatePieceInState', () => {
  it('시계방향(E키) 회전 시 angularVelocity가 양수여야 한다', () => {
    const state = createTestState();
    const result = rotatePieceInState(state, 'cw');
    expect(result.currentPiece!.angularVelocity).toBe(15);
  });

  it('반시계방향(Q키) 회전 시 angularVelocity가 음수여야 한다', () => {
    const state = createTestState();
    const result = rotatePieceInState(state, 'ccw');
    expect(result.currentPiece!.angularVelocity).toBe(-15);
  });

  it('게임 오버 상태에서는 회전하지 않아야 한다', () => {
    const state = createTestState({ isGameOver: true });
    const result = rotatePieceInState(state, 'cw');
    expect(result).toBe(state);
  });
});

describe('snapRotateInState', () => {
  it('90도 즉시 회전해야 한다', () => {
    const state = createTestState({
      currentPiece: {
        shape: [[1, 1], [1, 1]],
        x: 4,
        y: 5,
        angle: 0,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
        color: '#ff0',
      },
    });
    const result = snapRotateInState(state);
    expect(result.currentPiece!.angle).toBe(90);
  });

  it('게임 오버 상태에서는 회전하지 않아야 한다', () => {
    const state = createTestState({ isGameOver: true });
    const result = snapRotateInState(state);
    expect(result).toBe(state);
  });
});

describe('softDrop', () => {
  it('블록의 y가 증가해야 한다', () => {
    const state = createTestState({
      currentPiece: {
        shape: [[1, 1], [1, 1]],
        x: 4,
        y: 5,
        angle: 0,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
        color: '#ff0',
      },
    });
    const result = softDrop(state);
    expect(result.currentPiece!.y).toBeGreaterThan(5);
  });

  it('소프트 드롭 보너스 점수가 추가되어야 한다', () => {
    const state = createTestState({
      currentPiece: {
        shape: [[1, 1], [1, 1]],
        x: 4,
        y: 5,
        angle: 0,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
        color: '#ff0',
      },
    });
    const result = softDrop(state);
    expect(result.score).toBe(1);
  });

  it('바닥 충돌 시 이동하지 않아야 한다', () => {
    const state = createTestState({
      currentPiece: {
        shape: [[1, 1]],
        x: 4,
        y: 19,
        angle: 0,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
        color: '#ff0',
      },
    });
    const result = softDrop(state);
    expect(result).toBe(state);
  });

  it('게임 오버 상태에서는 동작하지 않아야 한다', () => {
    const state = createTestState({ isGameOver: true });
    const result = softDrop(state);
    expect(result).toBe(state);
  });
});
