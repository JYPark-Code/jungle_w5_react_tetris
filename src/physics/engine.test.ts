import { describe, it, expect } from 'vitest';
import { createTetromino, applyGravity, integratePosition, applyWallConstraints, checkLanding, checkCollision, getWorldVerts, BOARD_WIDTH, BOARD_HEIGHT } from './engine';
import type { Body } from './engine';

function makeStaticBlock(x: number, y: number): Body {
  return { ...createTetromino(4, x, y), isStatic: true, isActive: false, velocity: { x: 0, y: 0 } };
}

describe('createTetromino', () => {
  it('테트로미노를 생성해야 한다', () => {
    const body = createTetromino(1, 160, 48);
    expect(body.kind).toBe(1);
    expect(body.parts.length).toBe(4);
    expect(body.isActive).toBe(true);
    expect(body.isStatic).toBe(false);
  });
});

describe('applyGravity', () => {
  it('중력을 적용하면 vy가 증가해야 한다', () => {
    const body = createTetromino(1, 160, 48);
    const result = applyGravity(body);
    expect(result.velocity.y).toBeGreaterThan(body.velocity.y);
  });

  it('static body에는 중력이 적용되지 않아야 한다', () => {
    const body = makeStaticBlock(160, 500);
    const result = applyGravity(body);
    expect(result).toBe(body);
  });
});

describe('integratePosition', () => {
  it('velocity만큼 position이 이동해야 한다', () => {
    const body = { ...createTetromino(1, 100, 100), velocity: { x: 2, y: 3 } };
    const result = integratePosition(body);
    expect(result.position.x).toBe(102);
    expect(result.position.y).toBe(103);
  });
});

describe('applyWallConstraints', () => {
  it('왼쪽 벽을 벗어나면 보정해야 한다', () => {
    const body = createTetromino(1, 10, 100);
    const result = applyWallConstraints(body);
    const allV = result.parts.flatMap(p => getWorldVerts(p, result.position, result.angle));
    expect(Math.min(...allV.map(v => v.x))).toBeGreaterThanOrEqual(0);
  });

  it('바닥을 벗어나면 보정해야 한다', () => {
    const body = createTetromino(4, 160, BOARD_HEIGHT);
    const result = applyWallConstraints(body);
    const allV = result.parts.flatMap(p => getWorldVerts(p, result.position, result.angle));
    expect(Math.max(...allV.map(v => v.y))).toBeLessThanOrEqual(BOARD_HEIGHT);
  });
});

describe('checkLanding', () => {
  it('바닥에 닿으면 true를 반환해야 한다', () => {
    const body = createTetromino(4, 160, BOARD_HEIGHT - 16);
    expect(checkLanding(body, [])).toBe(true);
  });

  it('공중에 있으면 false를 반환해야 한다', () => {
    const body = createTetromino(4, 160, 100);
    expect(checkLanding(body, [])).toBe(false);
  });
});

describe('checkCollision (SAT)', () => {
  it('겹친 사각형은 충돌이어야 한다', () => {
    const a = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];
    const b = [{ x: 20, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 }, { x: 20, y: 40 }];
    expect(checkCollision(a, b).colliding).toBe(true);
  });

  it('떨어진 사각형은 충돌이 아니어야 한다', () => {
    const a = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];
    const b = [{ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }, { x: 100, y: 140 }];
    expect(checkCollision(a, b).colliding).toBe(false);
  });
});
