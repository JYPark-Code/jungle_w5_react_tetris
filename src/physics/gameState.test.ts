import { describe, it, expect } from 'vitest';
import { initState, nextTick, movePiece, hardDrop } from './gameState';
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
    currentPiece: testPiece,
    nextPiece: { ...testPiece, x: 4, y: 0 },
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

  it('라인 클리어 시 점수가 증가해야 한다', () => {
    const board = createEmptyBoard();
    // 19행을 거의 채우고 1행짜리 블록으로 완성
    for (let c = 0; c < 10; c++) {
      board[19][c] = '#f00';
    }
    // 블록이 착지할 2칸만 비워둠
    board[19][4] = null;
    board[19][5] = null;

    const state = createTestState({
      board,
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
    expect(current.score).toBeGreaterThan(0);
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
});
