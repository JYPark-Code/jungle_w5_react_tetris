# 렌더링 대각선 + 파편 날아감 + 블록 결합 수정 프롬프트

> 브랜치: feat/app (현재 custom physics 브랜치)

---

## Fix 1: 렌더링 대각선 제거 (renderer.ts)

### 원인
각 part를 1.05 확장 후 각자 stroke → part 경계선이 내부에 보임

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/physics/renderer.ts의 renderFrame에서 body 렌더링 방식을 수정해줘.

1.05 expand 코드 제거.
모든 part를 stroke 없이 fill만. active 블록만 외곽 stroke 추가.

for (const body of bodies) {
  if (body.kind === 0) continue;
  const isActive = body.id === activeId;
  const allPartVerts = getAllWorldVerts(body);

  // stroke 없이 fill만 → 내부 경계선 사라짐
  ctx.fillStyle = body.color;
  for (const verts of allPartVerts) {
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.fill();
  }

  // active 블록만 외곽 흰색 테두리
  if (isActive) {
    for (const verts of allPartVerts) {
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

완료 후 커밋:
fix(renderer): part 내부 대각선 제거 — fill only, expand 삭제
```

---

## Fix 2: 파편이 하늘로 날아가는 버그 (linecut.ts)

### 원인
fragment 생성 위치가 바닥 static body와 1px 이내 → SAT impulse가 위로 날려보냄

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/physics/linecut.ts의 removeLinesFromBodies를 수정해줘.

// 기존
const cx = above.reduce((s, v) => s + v.x, 0) / above.length;
const cy = above.reduce((s, v) => s + v.y, 0) / above.length;
return [{ ...body, position:{x:cx,y:cy}, ..., isStatic:false, velocity:{x:0,y:0} }];

// 수정: cy를 lineTop 위 2px로 강제 이동 + 아래 초기 속도
const cx = above.reduce((s, v) => s + v.x, 0) / above.length;
const rawCy = above.reduce((s, v) => s + v.y, 0) / above.length;
const cy = Math.min(rawCy, lineTop - 2); // 클리어 라인보다 2px 위 보장

return [{
  ...body,
  position: { x: cx, y: cy },
  parts: [{ localVerts: above.map(v => ({ x: v.x - cx, y: v.y - cy })) }],
  isStatic: false,
  velocity: { x: 0, y: 1 }, // 아래 방향 초기 속도 (위로 안 날아가게)
  angularVelocity: 0,
}];

완료 후 커밋:
fix(linecut): fragment 초기 위치 보정 + 아래 방향 초기 속도
```

---

## Fix 3: 블록 점프 + 충돌 불안정 (engine.ts)

### 원인
1. RESTITUTION 0.05 → 매 충돌마다 미세하게 튕겨서 쌓임
2. 충돌 해소 1회 → 깊은 겹침 해소 부족
3. 착지 후에도 velocity 미세 진동

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/physics/engine.ts를 수정해줘.

수정 1: RESTITUTION = 0 (테트리스는 튕김 없음)
export const RESTITUTION = 0.0;

수정 2: resolveBodyCollisions — 충돌 해소 3회 반복

export function resolveBodyCollisions(bodies: Body[]): Body[] {
  let result = bodies.map(b => ({
    ...b, position: { ...b.position }, velocity: { ...b.velocity }
  }));

  // 3회 반복으로 깊은 겹침도 완전 해소 (1회는 불충분)
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i], b = result[j];
        if (a.isStatic && b.isStatic) continue;
        // ... 기존 AABB + SAT 코드 그대로 유지 ...
      }
    }
  }
  return result;
}

수정 3: applyGravity — 미세 속도 snap으로 진동 방지

export function applyGravity(body: Body): Body {
  if (body.isStatic) return body;
  let vx = body.velocity.x * (1 - body.frictionAir);
  let vy = Math.min(body.velocity.y + GRAVITY, MAX_VY);
  let av = body.angularVelocity * 0.9;

  // 매우 작은 속도는 0으로 snap (sleeping 효과 — 무한 미세 진동 방지)
  if (Math.abs(vx) < 0.05) vx = 0;
  if (Math.abs(av) < 0.001) av = 0;

  return { ...body, velocity: { x: vx, y: vy }, angularVelocity: av };
}

수정 4: applyWallConstraints — 바닥 충돌 시 수평 속도도 감쇠

if (maxY > BOARD_HEIGHT) {
  pos.y -= maxY - BOARD_HEIGHT;
  vel.y = 0;
  vel.x *= 0.3; // 바닥 충돌 시 수평 감쇠
}

완료 후 커밋:
fix(engine): RESTITUTION 0 + 3회 반복 충돌 해소 + sleeping snap
```

---

## Fix 4: 점수 확인 (gameState.ts에 로그 추가)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/physics/gameState.ts의 nextTick 라인 클리어 부분에 디버그 로그 추가.

if (linesToClear.length > 0) {
  // 디버그: 라인 클리어 트리거 확인
  console.log('[LineClear] rows:', linesToClear, 'areas:', linesToClear.map(r => lineAreas[r]?.toFixed(0)));

  bodies = removeLinesFromBodies(bodies, linesToClear, CELL_SIZE);
  // ... 기존 점수 로직
}

완료 후 커밋:
debug(gameState): 라인 클리어 디버그 로그
```
