import { describe, it, expect } from 'vitest';
import { initTetrisState, nextTick, snapRotate, hardDrop, holdPiece, type TetrisState, type Keys } from './gameState';

const NO_KEYS: Keys = { left: false, right: false, rotateLeft: false, rotateRight: false, down: false };

describe('initTetrisState', () => {
  it('초기 상태를 올바르게 생성해야 한다', () => {
    const state = initTetrisState();
    expect(state.bodies.length).toBe(1);
    expect(state.activeId).not.toBeNull();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.isGameOver).toBe(false);
  });
});

describe('nextTick', () => {
  it('한 프레임 후 active body가 이동해야 한다', () => {
    const state = initTetrisState();
    const active = state.bodies.find(b => b.id === state.activeId)!;
    const origY = active.position.y;
    const next = nextTick(state, 1 / 60, NO_KEYS);
    const newActive = next.bodies.find(b => b.id === next.activeId);
    expect(newActive).toBeDefined();
    if (newActive) expect(newActive.position.y).toBeGreaterThan(origY);
  });

  it('게임 오버 상태에서는 변경 없이 반환해야 한다', () => {
    const state = { ...initTetrisState(), isGameOver: true };
    const next = nextTick(state, 1 / 60, NO_KEYS);
    expect(next).toBe(state);
  });
});

describe('snapRotate', () => {
  it('active body가 90도 회전해야 한다', () => {
    const state = initTetrisState();
    const result = snapRotate(state);
    const body = result.bodies.find(b => b.id === result.activeId);
    expect(body).toBeDefined();
    if (body) expect(Math.abs(body.angle - Math.PI / 2)).toBeLessThan(0.01);
  });
});

describe('hardDrop', () => {
  it('블록이 즉시 착지하고 새 블록이 생성되어야 한다', () => {
    const state = initTetrisState();
    const origActiveId = state.activeId;
    const result = hardDrop(state);
    // 기존 active body는 isStatic이 됨
    const oldActive = result.bodies.find(b => b.id === origActiveId);
    expect(oldActive).toBeDefined();
    if (oldActive) expect(oldActive.isStatic).toBe(true);
    // 새 active body가 생성됨
    expect(result.activeId).not.toBe(origActiveId);
  });
});

describe('holdPiece', () => {
  it('active body를 보관하고 새 블록이 생성되어야 한다', () => {
    const state = initTetrisState();
    const origKind = state.bodies.find(b => b.id === state.activeId)!.kind;
    const result = holdPiece(state);
    expect(result.heldKind).toBe(origKind);
    expect(result.canHold).toBe(false);
    expect(result.activeId).not.toBe(state.activeId);
  });

  it('canHold가 false이면 무시해야 한다', () => {
    const state = { ...initTetrisState(), canHold: false };
    const result = holdPiece(state);
    expect(result).toBe(state);
  });
});
