# Custom Physics + Custom React 완전 전환 프롬프트

> Matter.js를 순수 TypeScript로 포팅 + custom React 연결
> .bak 방식 X — Matter.js 방식 그대로 TypeScript로 포팅
> 브랜치: feat/app

---

## 구조

```
src/physics/
  engine.ts       ← Matter.js 핵심 로직을 순수 TS 함수로 포팅
  gameState.ts    ← 게임 상태 관리 (순수 함수 nextTick)
  renderer.ts     ← Canvas 렌더링
  linecut.ts      ← 라인 클리어 (Shoelace + 81%)

src/app/
  TetrisApp.ts    ← custom React Component
  index.ts        ← 마운트 (Matter.js import 제거)
```

---

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

Matter.js 라이브러리 없이, Matter.js의 핵심 물리 로직을
순수 TypeScript로 구현하고 custom React로 게임을 구동해줘.

아래 코드를 각 파일로 그대로 만들어줘. 한글 주석 필수.

---

## 파일 1: src/physics/engine.ts

// ============================================================
// engine.ts — Matter.js 핵심 물리를 순수 TypeScript로 포팅
// Compound body (4개 사각형), velocity 기반 이동, SAT 충돌
// 모든 함수는 순수 함수 (state → newState)
// ============================================================

export const CELL_SIZE = 32;
export const BOARD_COLS = 10;
export const BOARD_ROWS = 18;
export const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;
export const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;
export const GRAVITY = 0.5;
export const DROP_SPEED = 100;
export const FRICTION_AIR = 0.05;
export const RESTITUTION = 0.05;
export const MAX_VY = 15;

export interface Vec2 { x: number; y: number; }

export interface Part {
  localVerts: Vec2[];
}

export interface Body {
  id: number;
  parts: Part[];
  position: Vec2;
  velocity: Vec2;
  angle: number;
  angularVelocity: number;
  isStatic: boolean;
  mass: number;
  frictionAir: number;
  restitution: number;
  color: string;
  kind: number;
  isActive: boolean;
}

export const v2 = {
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s }),
  dot: (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y,
  len: (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y),
  norm: (v: Vec2): Vec2 => {
    const l = Math.sqrt(v.x * v.x + v.y * v.y);
    return l > 0.0001 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
  },
  perp: (v: Vec2): Vec2 => ({ x: -v.y, y: v.x }),
};

export function getWorldVerts(part: Part, pos: Vec2, angle: number): Vec2[] {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return part.localVerts.map(v => ({
    x: pos.x + v.x * cos - v.y * sin,
    y: pos.y + v.x * sin + v.y * cos,
  }));
}

export function getAllWorldVerts(body: Body): Vec2[][] {
  return body.parts.map(p => getWorldVerts(p, body.position, body.angle));
}

function project(verts: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const v of verts) { const p = v2.dot(v, axis); if (p < min) min = p; if (p > max) max = p; }
  return [min, max];
}

function getAxes(verts: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < verts.length; i++) {
    axes.push(v2.norm(v2.perp(v2.sub(verts[(i + 1) % verts.length], verts[i]))));
  }
  return axes;
}

interface Collision { colliding: boolean; depth: number; normal: Vec2; }

export function checkCollision(va: Vec2[], vb: Vec2[]): Collision {
  let minDepth = Infinity, minNormal: Vec2 = { x: 0, y: 1 };
  const axes = [...getAxes(va), ...getAxes(vb)];
  for (const axis of axes) {
    if (v2.len(axis) < 0.0001) continue;
    const [minA, maxA] = project(va, axis);
    const [minB, maxB] = project(vb, axis);
    if (maxA < minB || maxB < minA) return { colliding: false, depth: 0, normal: minNormal };
    const depth = Math.min(maxA - minB, maxB - minA);
    if (depth < minDepth) {
      minDepth = depth;
      const ca = va.reduce((s, v) => v2.add(s, v), { x: 0, y: 0 });
      ca.x /= va.length; ca.y /= va.length;
      const cb = vb.reduce((s, v) => v2.add(s, v), { x: 0, y: 0 });
      cb.x /= vb.length; cb.y /= vb.length;
      minNormal = v2.dot(v2.sub(cb, ca), axis) < 0 ? v2.scale(axis, -1) : axis;
    }
  }
  return { colliding: true, depth: minDepth, normal: minNormal };
}

const H = CELL_SIZE / 2;
const TETROMINO_CELLS: Record<number, Vec2[]> = {
  1: [{x:-48,y:0},{x:-16,y:0},{x:16,y:0},{x:48,y:0}],
  2: [{x:-32,y:-16},{x:0,y:-16},{x:32,y:-16},{x:32,y:16}],
  3: [{x:-32,y:-16},{x:0,y:-16},{x:32,y:-16},{x:-32,y:16}],
  4: [{x:-16,y:-16},{x:16,y:-16},{x:16,y:16},{x:-16,y:16}],
  5: [{x:-32,y:16},{x:0,y:-16},{x:32,y:-16},{x:0,y:16}],
  6: [{x:-32,y:-16},{x:0,y:-16},{x:32,y:-16},{x:0,y:16}],
  7: [{x:0,y:16},{x:0,y:-16},{x:32,y:16},{x:-32,y:-16}],
};
export const TETROMINO_COLORS: Record<number, string> = {
  1:'#00f0f0',2:'#0000f0',3:'#f0a000',4:'#f0f000',5:'#00f000',6:'#a000f0',7:'#f00000',
};

function makeRectPart(cx: number, cy: number): Part {
  return { localVerts: [{x:cx-H,y:cy-H},{x:cx+H,y:cy-H},{x:cx+H,y:cy+H},{x:cx-H,y:cy+H}] };
}

let _nextId = 1;
export function createTetromino(kind: number, x: number, y: number): Body {
  return {
    id: _nextId++,
    parts: TETROMINO_CELLS[kind].map(c => makeRectPart(c.x, c.y)),
    position: { x, y },
    velocity: { x: 0, y: DROP_SPEED / 60 },
    angle: 0, angularVelocity: 0,
    isStatic: false, mass: 4,
    frictionAir: FRICTION_AIR, restitution: RESTITUTION,
    color: TETROMINO_COLORS[kind], kind, isActive: true,
  };
}

export function applyGravity(body: Body): Body {
  if (body.isStatic) return body;
  return {
    ...body,
    velocity: {
      x: body.velocity.x * (1 - body.frictionAir),
      y: Math.min(body.velocity.y + GRAVITY, MAX_VY),
    },
    angularVelocity: body.angularVelocity * 0.9,
  };
}

export function integratePosition(body: Body): Body {
  if (body.isStatic) return body;
  return {
    ...body,
    position: v2.add(body.position, body.velocity),
    angle: body.angle + body.angularVelocity,
  };
}

export function applyWallConstraints(body: Body): Body {
  if (body.isStatic) return body;
  let pos = { ...body.position };
  let vel = { ...body.velocity };
  const allV = body.parts.flatMap(p => getWorldVerts(p, pos, body.angle));
  const minX = Math.min(...allV.map(v => v.x));
  const maxX = Math.max(...allV.map(v => v.x));
  const maxY = Math.max(...allV.map(v => v.y));
  if (minX < 0) { pos.x -= minX; if (vel.x < 0) vel.x = 0; }
  if (maxX > BOARD_WIDTH) { pos.x -= maxX - BOARD_WIDTH; if (vel.x > 0) vel.x = 0; }
  if (maxY > BOARD_HEIGHT) { pos.y -= maxY - BOARD_HEIGHT; vel.y = 0; }
  return { ...body, position: pos, velocity: vel };
}

export function resolveBodyCollisions(bodies: Body[]): Body[] {
  const result = bodies.map(b => ({
    ...b, position: { ...b.position }, velocity: { ...b.velocity }
  }));
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i], b = result[j];
      if (a.isStatic && b.isStatic) continue;
      const aV = a.parts.flatMap(p => getWorldVerts(p, a.position, a.angle));
      const bV = b.parts.flatMap(p => getWorldVerts(p, b.position, b.angle));
      // AABB 사전 체크
      if (Math.max(...aV.map(v=>v.x)) < Math.min(...bV.map(v=>v.x))) continue;
      if (Math.min(...aV.map(v=>v.x)) > Math.max(...bV.map(v=>v.x))) continue;
      if (Math.max(...aV.map(v=>v.y)) < Math.min(...bV.map(v=>v.y))) continue;
      if (Math.min(...aV.map(v=>v.y)) > Math.max(...bV.map(v=>v.y))) continue;
      // SAT
      for (const pa of a.parts) {
        for (const pb of b.parts) {
          const wva = getWorldVerts(pa, a.position, a.angle);
          const wvb = getWorldVerts(pb, b.position, b.angle);
          const col = checkCollision(wva, wvb);
          if (!col.colliding || col.depth < 0.01) continue;
          const corr = v2.scale(col.normal, col.depth);
          if (!a.isStatic) result[i].position = v2.sub(result[i].position, v2.scale(corr, 0.5));
          if (!b.isStatic) result[j].position = v2.add(result[j].position, v2.scale(corr, 0.5));
          const rel = v2.sub(result[i].velocity, result[j].velocity);
          const vn = v2.dot(rel, col.normal);
          if (vn > 0) continue;
          const e = Math.min(a.restitution, b.restitution);
          const ia = a.isStatic ? 0 : 1/a.mass, ib = b.isStatic ? 0 : 1/b.mass;
          const jj = -(1+e)*vn/(ia+ib);
          const imp = v2.scale(col.normal, jj);
          if (!a.isStatic) result[i].velocity = v2.sub(result[i].velocity, v2.scale(imp, ia));
          if (!b.isStatic) result[j].velocity = v2.add(result[j].velocity, v2.scale(imp, ib));
        }
      }
    }
  }
  return result;
}

export function checkLanding(body: Body, statics: Body[]): boolean {
  if (body.isStatic) return false;
  const verts = body.parts.flatMap(p => getWorldVerts(p, body.position, body.angle));
  const maxY = Math.max(...verts.map(v => v.y));
  const minX = Math.min(...verts.map(v => v.x));
  const maxX = Math.max(...verts.map(v => v.x));
  if (maxY >= BOARD_HEIGHT - 1) return true;
  for (const s of statics) {
    const sv = s.parts.flatMap(p => getWorldVerts(p, s.position, s.angle));
    const sMinY = Math.min(...sv.map(v => v.y));
    const sMinX = Math.min(...sv.map(v => v.x));
    const sMaxX = Math.max(...sv.map(v => v.x));
    const xOverlap = Math.min(maxX, sMaxX) - Math.max(minX, sMinX);
    if (xOverlap > 2 && Math.abs(maxY - sMinY) < 4) return true;
  }
  return false;
}

---

## 파일 2: src/physics/gameState.ts

import {
  Body, Vec2, BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE, DROP_SPEED, MAX_VY,
  createTetromino, getAllWorldVerts,
  applyGravity, integratePosition, applyWallConstraints, resolveBodyCollisions, checkLanding,
} from './engine';
import { checkLineDensity, removeLinesFromBodies } from './linecut';

export interface TetrisState {
  bodies: Body[];
  activeId: number | null;
  nextKind: number;
  heldKind: number | null;
  canHold: boolean;
  score: number;
  level: number;
  linesCleared: number;
  isGameOver: boolean;
  lockTimer: number;
  clearCooldown: number;
}

export interface Keys {
  left: boolean; right: boolean;
  rotateLeft: boolean; rotateRight: boolean;
  down: boolean;
}

const SPAWN_X = BOARD_WIDTH / 2;
const SPAWN_Y = CELL_SIZE * 1.5;
const LOCK_DELAY = 0.5;
const CLEAR_COOLDOWN = 1.2;

export function initTetrisState(): TetrisState {
  const firstKind = Math.ceil(Math.random() * 7);
  const nextKind = Math.ceil(Math.random() * 7);
  const active = createTetromino(firstKind, SPAWN_X, SPAWN_Y);
  return {
    bodies: [active], activeId: active.id, nextKind,
    heldKind: null, canHold: true,
    score: 0, level: 1, linesCleared: 0,
    isGameOver: false, lockTimer: 0, clearCooldown: 0,
  };
}

// ── 핵심: 순수 함수 nextTick ──────────────────────────────
// custom React: setGameState(prev => nextTick(prev, dt, keys))
export function nextTick(state: TetrisState, dt: number, keys: Keys): TetrisState {
  if (state.isGameOver) return state;
  const safeDt = Math.min(dt, 0.05);
  if (state.clearCooldown > 0) return { ...state, clearCooldown: state.clearCooldown - safeDt };

  const dropSpeed = DROP_SPEED + (state.level - 1) * 7;

  // 키 입력 → active body velocity 조정
  let bodies = state.bodies.map(b => {
    if (b.id !== state.activeId) return b;
    let vel = { ...b.velocity };
    let av = b.angularVelocity;
    if (keys.left && vel.x > -4) vel.x -= 0.8;
    if (keys.right && vel.x < 4) vel.x += 0.8;
    if (!keys.left && !keys.right) vel.x *= 0.75;
    if (keys.rotateLeft && av > -0.15) av -= 0.015;
    if (keys.rotateRight && av < 0.15) av += 0.015;
    const vyS = vel.y * 60;
    if (keys.down) { if (vyS < 500) vel.y += 0.3; }
    else if (vyS > dropSpeed) vel.y = Math.max(dropSpeed / 60, vel.y - 2000 * safeDt / 60);
    return { ...b, velocity: vel, angularVelocity: av };
  });

  // 물리 스텝
  bodies = bodies.map(applyGravity);
  bodies = bodies.map(integratePosition);
  bodies = resolveBodyCollisions(bodies);
  bodies = bodies.map(applyWallConstraints);

  // 착지 판정
  let lockTimer = state.lockTimer;
  const active = bodies.find(b => b.id === state.activeId);
  const statics = bodies.filter(b => b.isStatic);
  const landed = active ? checkLanding(active, statics) : false;

  let { activeId, nextKind, canHold, score, linesCleared, level, clearCooldown } = state;

  if (landed) {
    if (lockTimer === 0) lockTimer = LOCK_DELAY;
    else lockTimer -= safeDt;

    if (lockTimer <= 0) {
      bodies = bodies.map(b =>
        b.id === activeId
          ? { ...b, isStatic: true, isActive: false, velocity: {x:0,y:0}, angularVelocity: 0 }
          : b
      );

      const { linesToClear, lineAreas } = checkLineDensity(bodies, BOARD_HEIGHT, BOARD_WIDTH, CELL_SIZE);
      if (linesToClear.length > 0) {
        bodies = removeLinesFromBodies(bodies, linesToClear, CELL_SIZE);
        const sum = linesToClear.reduce((s, r) => s + (lineAreas[r] ?? 0), 0);
        const avg = Math.min(1, sum / linesToClear.length / 10240);
        score += Math.ceil((linesToClear.length * 3) ** (avg ** 10) * 20 + linesToClear.length ** 2 * 40);
        linesCleared += linesToClear.length;
        level = Math.floor(linesCleared / 10) + 1;
        clearCooldown = CLEAR_COOLDOWN;
      }

      const newActive = createTetromino(nextKind, SPAWN_X, SPAWN_Y);
      bodies = [...bodies, newActive];
      activeId = newActive.id;
      nextKind = Math.ceil(Math.random() * 7);
      canHold = true;

      const isGameOver = bodies.filter(b => b.isStatic && b.kind > 0)
        .some(b => Math.min(...b.parts.flatMap(p =>
          getAllWorldVerts(b).flat()).map(v => v.y)) < CELL_SIZE);

      return { ...state, bodies, activeId, nextKind, canHold, score, linesCleared, level, clearCooldown, isGameOver, lockTimer: 0 };
    }
  } else {
    lockTimer = 0;
  }

  return { ...state, bodies, lockTimer, score, linesCleared, level, clearCooldown };
}

export function snapRotate(state: TetrisState): TetrisState {
  return {
    ...state,
    bodies: state.bodies.map(b =>
      b.id === state.activeId ? { ...b, angle: b.angle + Math.PI / 2, angularVelocity: 0 } : b
    ),
  };
}

export function hardDrop(state: TetrisState): TetrisState {
  return {
    ...state,
    bodies: state.bodies.map(b =>
      b.id === state.activeId ? { ...b, velocity: { x: 0, y: MAX_VY } } : b
    ),
  };
}

export function holdPiece(state: TetrisState): TetrisState {
  if (!state.canHold || state.activeId === null) return state;
  const active = state.bodies.find(b => b.id === state.activeId);
  if (!active) return state;
  const bodies = state.bodies.filter(b => b.id !== state.activeId);
  const newKind = state.heldKind ?? state.nextKind;
  const newActive = createTetromino(newKind, BOARD_WIDTH / 2, CELL_SIZE * 1.5);
  return {
    ...state,
    bodies: [...bodies, newActive],
    activeId: newActive.id,
    heldKind: active.kind,
    nextKind: state.heldKind !== null ? state.nextKind : Math.ceil(Math.random() * 7),
    canHold: false,
  };
}

---

## 파일 3: src/physics/linecut.ts

import { Body, Vec2, getWorldVerts } from './engine';

const THRESHOLD = 1024 * 8.1;

function polygonArea(v: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length;
    a += v[i].x * v[j].y - v[j].x * v[i].y;
  }
  return Math.abs(a) / 2;
}

function clip(verts: Vec2[], lineY: number, keepAbove: boolean): Vec2[] {
  if (!verts.length) return [];
  const out: Vec2[] = [];
  const inside = (v: Vec2) => keepAbove ? v.y <= lineY : v.y >= lineY;
  for (let i = 0; i < verts.length; i++) {
    const c = verts[i], n = verts[(i + 1) % verts.length];
    if (inside(c)) out.push(c);
    if (inside(c) !== inside(n)) {
      const t = (lineY - c.y) / (n.y - c.y);
      out.push({ x: c.x + t * (n.x - c.x), y: lineY });
    }
  }
  return out;
}

export function checkLineDensity(
  bodies: Body[], boardH: number, boardW: number, cellSize: number
): { linesToClear: number[]; lineAreas: number[] } {
  const rows = Math.floor(boardH / cellSize);
  const areas = new Array(rows).fill(0);
  for (const body of bodies) {
    if (!body.isStatic || body.kind === 0) continue;
    for (const part of body.parts) {
      const wv = getWorldVerts(part, body.position, body.angle);
      for (let r = 0; r < rows; r++) {
        const top = r * cellSize, bot = top + cellSize;
        if (Math.min(...wv.map(v=>v.y)) > bot || Math.max(...wv.map(v=>v.y)) < top) continue;
        const clipped = clip(clip(wv, top, false), bot, true);
        if (clipped.length >= 3) areas[r] += polygonArea(clipped);
      }
    }
  }
  return {
    linesToClear: areas.reduce((acc: number[], a, i) => a > THRESHOLD ? [...acc, i] : acc, []),
    lineAreas: areas,
  };
}

export function removeLinesFromBodies(bodies: Body[], rows: number[], cellSize: number): Body[] {
  let result = [...bodies];
  for (const row of [...rows].sort((a, b) => b - a)) {
    const lineTop = row * cellSize;
    result = result.flatMap(body => {
      if (!body.isStatic || body.kind === 0) return [body];
      const verts = body.parts.flatMap(p => getWorldVerts(p, body.position, body.angle));
      if (Math.max(...verts.map(v=>v.y)) <= lineTop || Math.min(...verts.map(v=>v.y)) >= lineTop + cellSize) return [body];
      const above = clip(verts, lineTop, true);
      if (above.length < 3) return [];
      const cx = above.reduce((s,v)=>s+v.x,0)/above.length;
      const cy = above.reduce((s,v)=>s+v.y,0)/above.length;
      return [{ ...body, position:{x:cx,y:cy}, parts:[{localVerts:above.map(v=>({x:v.x-cx,y:v.y-cy}))}], isStatic:false, velocity:{x:0,y:0} }];
    });
  }
  return result;
}

---

## 파일 4: src/physics/renderer.ts

import { Body, getAllWorldVerts, CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT } from './engine';

export function renderFrame(ctx: CanvasRenderingContext2D, bodies: Body[], activeId: number | null): void {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= BOARD_WIDTH; x += CELL_SIZE) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,BOARD_HEIGHT); ctx.stroke(); }
  for (let y = 0; y <= BOARD_HEIGHT; y += CELL_SIZE) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(BOARD_WIDTH,y); ctx.stroke(); }
  for (const body of bodies) {
    if (body.kind === 0) continue;
    const isActive = body.id === activeId;
    for (const verts of getAllWorldVerts(body)) {
      const cx = verts.reduce((s,v)=>s+v.x,0)/verts.length;
      const cy = verts.reduce((s,v)=>s+v.y,0)/verts.length;
      const ev = verts.map(v => ({ x: cx+(v.x-cx)*1.05, y: cy+(v.y-cy)*1.05 }));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ev[0].x, ev[0].y);
      for (let i = 1; i < ev.length; i++) ctx.lineTo(ev[i].x, ev[i].y);
      ctx.closePath();
      ctx.fillStyle = body.color;
      ctx.fill();
      ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}

export function renderPreview(canvas: HTMLCanvasElement, kind: number | null, colors: Record<number,string>): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!kind) return;
  ctx.fillStyle = colors[kind] ?? '#888';
  ctx.fillRect(canvas.width/4, canvas.height/4, canvas.width/2, canvas.height/2);
}

---

## 파일 5: src/app/TetrisApp.ts

import { useState, useEffect, useMemo } from '../core/hooks';
import { createVNode } from '../core/vdom';
import { metricsStore } from './metricsStore';
import { initTetrisState, nextTick, snapRotate, hardDrop, holdPiece, TetrisState, Keys } from '../physics/gameState';
import { renderFrame, renderPreview } from '../physics/renderer';
import { CELL_SIZE, TETROMINO_COLORS } from '../physics/engine';

export const TetrisAppFn = (props: {
  boardCanvas: HTMLCanvasElement | null;
  nextCanvas: HTMLCanvasElement | null;
  holdCanvas: HTMLCanvasElement | null;
}) => {
  const [gameState, setGameState] = useState<TetrisState>(initTetrisState());
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [keys, setKeys] = useState<Keys>({ left:false, right:false, rotateLeft:false, rotateRight:false, down:false });

  const staticCount = useMemo(
    () => gameState.bodies.filter(b => b.isStatic && b.kind > 0).length,
    [gameState.bodies]
  );

  useEffect(() => {
    if (!props.boardCanvas) return;
    const t = performance.now();
    const ctx = props.boardCanvas.getContext('2d');
    if (ctx) renderFrame(ctx, gameState.bodies, gameState.activeId);
    if (props.nextCanvas) renderPreview(props.nextCanvas, gameState.nextKind, TETROMINO_COLORS);
    if (props.holdCanvas) renderPreview(props.holdCanvas, gameState.heldKind, TETROMINO_COLORS);
    metricsStore.record({ componentName:'TetrisApp', duration:performance.now()-t, timestamp:performance.now(), renderIndex:staticCount });
  }, [gameState]);

  useEffect(() => {
    if (!isRunning || isPaused) return;
    let last = 0, id = 0;
    const loop = (t: number) => {
      const dt = last > 0 ? Math.min((t-last)/1000, 0.05) : 1/60;
      last = t;
      setGameState(prev => nextTick(prev, dt, keys));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [isRunning, isPaused, keys]);

  useEffect(() => {
    if (!isRunning || isPaused) return;
    const pressed = new Set<string>();
    const update = () => setKeys({
      left: pressed.has('ArrowLeft'), right: pressed.has('ArrowRight'),
      rotateLeft: pressed.has('q')||pressed.has('Q'),
      rotateRight: pressed.has('e')||pressed.has('E'),
      down: pressed.has('ArrowDown'),
    });
    const onDown = (e: KeyboardEvent) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
      pressed.add(e.key);
      update();
      if (e.key === 'ArrowUp') setGameState(prev => snapRotate(prev));
      if (e.key === ' ') setGameState(prev => hardDrop(prev));
      if (e.key==='r'||e.key==='R') setGameState(prev => holdPiece(prev));
    };
    const onUp = (e: KeyboardEvent) => { pressed.delete(e.key); update(); };
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => { pressed.clear(); document.removeEventListener('keydown', onDown); document.removeEventListener('keyup', onUp); };
  }, [isRunning, isPaused]);

  return createVNode('div', { class: 'score-section' }, [
    createVNode('div', { class: 'score-display' }, [
      createVNode('span', null, 'SCORE'),
      createVNode('div', { id:'score-value', class:'value' }, String(gameState.score)),
      createVNode('div', { style:'display:flex;gap:16px;margin-top:4px;' }, [
        createVNode('div', null, [createVNode('span', null, 'LEVEL'), createVNode('span', { id:'level-value', class:'value small' }, String(gameState.level))]),
        createVNode('div', null, [createVNode('span', null, 'LINES'), createVNode('span', { id:'lines-value', class:'value small' }, String(gameState.linesCleared))]),
      ]),
    ]),
    createVNode('div', { class:'game-buttons', style:'margin-top:12px;' }, [
      createVNode('button', { class:'game-btn', onclick: () => { setGameState(initTetrisState()); setIsRunning(true); setIsPaused(false); } }, '▶ START'),
      createVNode('button', { class:'game-btn pause', onclick: () => { if (isRunning) setIsPaused((p: boolean) => !p); } }, isPaused ? '▶ RESUME' : '⏸ PAUSE'),
    ]),
  ]);
};

---

## 파일 6: src/app/tabs/play.ts 수정

score-panel 빈 컨테이너로:
  <div class="panel-box score-panel"><!-- TetrisApp 마운트됨 --></div>
기존 score-display HTML과 버튼 panel-box 제거.

---

## 파일 7: src/app/index.ts 수정

Matter.js 관련 import/로직 전부 제거.
TetrisApp 마운트만:

import { Component } from '../core/component';
import { TetrisAppFn } from './TetrisApp';
// ... 탭 생성 로직 (기존 유지)

const el = document.querySelector('.score-panel') as HTMLElement;
if (el) {
  new Component(TetrisAppFn, {
    boardCanvas: document.getElementById('board-canvas') as HTMLCanvasElement,
    nextCanvas: document.getElementById('next-canvas') as HTMLCanvasElement,
    holdCanvas: document.getElementById('hold-canvas') as HTMLCanvasElement,
  }, 'TetrisApp').mount(el);
}

---

## 완료 확인 순서

[ ] npm run dev — 오류 없음
[ ] START → 블록 낙하
[ ] 좌우 이동 / 회전 정상
[ ] 블록 결합 (틈 없음)
[ ] Score 업데이트
[ ] Flamegraph — TetrisApp 기록

실패 시 즉시 롤백:
git checkout c6dfeab -- src/

한글 주석 필수.
완료 후 커밋:
feat(physics): Matter.js 순수 TS 포팅 + custom React 연결
```
