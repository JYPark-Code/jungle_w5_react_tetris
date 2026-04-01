# 실제 물리 엔진(engine2d) 수정 프롬프트

> 실제 게임은 NotTetrisState + RigidBody + engine2d.ts 사용
> grid-based gameState.ts는 테스트용 레거시

---

## 확인된 문제들

### 문제 1: dynamic 파편들이 서로 지지대를 못 인식

`notTetrisState.ts` nextTick에서:
```js
const staticBodies = state.bodies.filter(b => b.isStatic);
const dynamicBodies = state.bodies.filter(b => !b.isStatic);

for (const dyn of dynamicBodies) {
  // 오직 staticBodies만 체크 → 다른 dynamic 파편은 지지대로 인식 못함!
  if (checkIsLanded(d, staticBodies, BOARD_HEIGHT)) { ... }
}
```

라인 클리어 후 여러 파편이 동시에 떨어질 때, 파편들이 서로를 지지대로 인식하지 못해
모두 바닥까지 떨어지며 겹침.

### 문제 2: isLanded 허용 오차가 너무 좁음 (3px)

`engine2d.ts`:
```js
const yTouch = Math.abs(maxY - sMinY) < 3;
```
CELL_SIZE=28px 기준으로 3px는 너무 작음. 블록 테두리 stroke(1px)와 subpixel
렌더링 오차로 인해 실제로 맞닿아도 isLanded가 false로 반환될 수 있음.

### 문제 3: xOverlap 체크가 bounding box 기반 — 기울어진 블록 오감지

기울어진 블록의 bounding box는 실제 접촉 면보다 넓어서
실제로 닿지 않은 블록도 isLanded=true가 될 수 있음.

---

## Fix 1 — notTetrisState.ts: dynamic 파편 순차 처리

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/notTetrisState.ts의 nextTick에서
dynamic bodies 물리 처리 부분을 수정해줘.

현재 문제:
dynamicBodies가 staticBodies만 체크해서 파편끼리 지지대 인식 못함

수정:
// 파편(dynamic bodies) 순차 처리 — 처리된 파편을 누적하여 다음 파편의 지지대로 사용
const processedDynamic: RigidBody[] = [];
for (const dyn of dynamicBodies) {
  // 지금까지 처리된 파편 + 기존 static bodies를 지지대로 사용
  const currentStatics = [...staticBodies, ...processedDynamic.filter(p => p.isStatic)];

  let d = { ...dyn, position: { ...dyn.position, y: dyn.position.y + dropSpeed * safeDt } };

  if (checkIsLanded(d, currentStatics, BOARD_HEIGHT)) {
    processedDynamic.push({ ...d, isStatic: true, velocity: { x: 0, y: 0 }, angularVelocity: 0 });
  } else {
    const dWall = checkWallCollision(d, BOARD_WIDTH, BOARD_HEIGHT);
    d = dWall.body;
    if (dWall.landed) {
      processedDynamic.push({ ...d, isStatic: true, velocity: { x: 0, y: 0 }, angularVelocity: 0 });
    } else {
      processedDynamic.push(d);
    }
  }
}

완료 후 커밋:
fix(physics): dynamic 파편 순차 처리로 파편 간 지지대 인식
```

---

## Fix 2 — engine2d.ts: isLanded 허용 오차 증가

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/engine2d.ts의 isLanded 함수를 수정해줘.

현재:
const yTouch = Math.abs(maxY - sMinY) < 3;

수정:
const yTouch = Math.abs(maxY - sMinY) < 6;  // 3 → 6px

이유:
- CELL_SIZE=28px에서 3px는 너무 작음
- 1px stroke border + subpixel 렌더링 오차 고려
- 6px = CELL_SIZE의 약 21% → 충분히 안전한 착지 감지

완료 후 커밋:
fix(physics): isLanded 허용 오차 3 → 6px
```

---

## Fix 3 — engine2d.ts: isLanded X overlap 개선

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/engine2d.ts의 isLanded에서 X 겹침 판정을 개선해줘.

현재: bounding box 기반 xOverlap (기울어진 블록에서 오감지 가능)

// 기존
const xOverlap = aMinX < sMaxX && aMaxX > sMinX;

// 수정: 최소 겹침 폭 요구 (단순 접촉이 아닌 의미있는 겹침)
const overlapWidth = Math.min(aMaxX, sMaxX) - Math.max(aMinX, sMinX);
const xOverlap = overlapWidth > 2; // 최소 2px 겹침 필요

완료 후 커밋:
fix(physics): isLanded X overlap 최소 2px 조건 추가
```
