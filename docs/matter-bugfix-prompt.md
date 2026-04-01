# Matter.js 버그 수정 프롬프트

> 스크린샷 기반 4가지 버그 확인
> 브랜치: feat/physics (dev에 머지 후)

---

## 버그 1 (최우선): 블록 렌더링 뭉개짐

### 원인
`drawBody`에서 `body.vertices`를 사용하는데,
Matter.js compound body의 `body.vertices`는
**전체 부품의 convex hull (볼록 껍질)** 이다.
T자 블록 → 볼록 다각형(육각형)으로 렌더링됨.

### 수정: src/physics/matterRenderer.ts

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/matterRenderer.ts의 drawBody 함수를 수정해줘.

현재:
function drawBody(ctx, body, isActive) {
  const verts = body.vertices;  // ← compound body의 convex hull (잘못됨)
  ctx.moveTo(verts[0].x, verts[0].y);
  ...
}

수정:
compound body는 body.parts 배열에 각 셀이 있음.
body.parts[0]는 body 자신 (skip), body.parts[1..n]이 실제 셀들.
각 셀을 개별 사각형으로 렌더링해야 함.

function drawBody(ctx, body, isActive) {
  const color = (body as any).color ?? '#ffffff';

  // compound body: parts[0] = parent, parts[1..] = 실제 셀
  const renderParts = body.parts.length > 1
    ? body.parts.slice(1)   // compound body → 각 셀 렌더링
    : [body];               // 단일 body → body 자체 렌더링

  for (const part of renderParts) {
    const verts = part.vertices;
    if (verts.length < 3) continue;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = isActive
      ? 'rgba(255,255,255,0.5)'
      : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

완료 후 커밋:
fix(renderer): compound body 각 셀 개별 렌더링
```

---

## 버그 2: 블록이 좌우 경계 밖으로 나감

### 원인
벽 body의 위치가 맞지 않거나,
`applyForce`가 너무 강해서 블록이 벽을 뚫음.

### 수정: src/physics/matterEngine.ts

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/matterEngine.ts의 createWalls와 FORCE_STRENGTH를 수정해줘.

수정 1: 벽 두께를 100px로 늘리고 위치 정밀화

function createWalls(engine) {
  const thickness = 100;  // 50 → 100 (더 두꺼운 벽)
  const opts = { isStatic: true, label: 'wall', friction: 0.00001, restitution: 0 };

  const walls = [
    // 바닥
    Matter.Bodies.rectangle(
      BOARD_WIDTH / 2, BOARD_HEIGHT + thickness / 2,
      BOARD_WIDTH + thickness * 2, thickness, { ...opts, label: 'ground' }
    ),
    // 왼쪽 벽 (x 중심이 -thickness/2에 위치)
    Matter.Bodies.rectangle(
      -thickness / 2, BOARD_HEIGHT / 2,
      thickness, BOARD_HEIGHT * 3, { ...opts, label: 'left' }
    ),
    // 오른쪽 벽
    Matter.Bodies.rectangle(
      BOARD_WIDTH + thickness / 2, BOARD_HEIGHT / 2,
      thickness, BOARD_HEIGHT * 3, { ...opts, label: 'right' }
    ),
  ];

  Matter.Composite.add(engine.world, walls);
}

수정 2: 이동 힘 대폭 감소

// 기존
export const FORCE_STRENGTH = 0.004;

// 수정: Matter.js body 질량 기준으로 조정
// body 질량 ≈ 4 (셀 4개), applyForce는 F=ma에서 a = F/m
// 원본: applyForce(70) → 이동 가속도 70/mass
// Matter.js 단위: px/frame² → 매우 작은 값 필요
export const FORCE_STRENGTH = 0.0002;  // 0.004 → 0.0002

수정 3: 회전 속도 감소

// 기존
export const TORQUE_STRENGTH = 0.002;

// 수정
export const TORQUE_STRENGTH = 0.0001;  // 0.002 → 0.0001

// matterState.ts의 각속도 캡도 수정
// 기존: angularVelocity < 3
// 수정: angularVelocity < 0.3 (Matter.js 단위는 rad/frame)

완료 후 커밋:
fix(physics): 벽 두께 증가, 이동/회전력 조정
```

---

## 버그 3: 회전/이동 속도 너무 빠름 (matterState.ts 수정)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/matterState.ts의 키 입력 처리를 수정해줘.

원인:
- applyForce가 매 프레임 누적되어 속도가 계속 증가
- angularVelocity 캡이 3인데 Matter.js 단위(rad/frame)로는 엄청 빠름

수정:
// 회전: angularVelocity 캡 조정
if (keys.rotateRight) {
  if (active.angularVelocity < 0.15) {  // 3 → 0.15 rad/frame
    Matter.Body.setAngularVelocity(
      active,
      active.angularVelocity + TORQUE_STRENGTH * 70
    );
  }
}
if (keys.rotateLeft) {
  if (active.angularVelocity > -0.15) {
    Matter.Body.setAngularVelocity(
      active,
      active.angularVelocity - TORQUE_STRENGTH * 70
    );
  }
}

// 좌우 이동: 속도 캡 추가 (원본: x방향 최대 속도 제한)
const MAX_VX = 3;  // px/frame

if (keys.left) {
  if (active.velocity.x > -MAX_VX) {
    Matter.Body.applyForce(active, pos, { x: -FORCE_STRENGTH * 70, y: 0 });
  }
}
if (keys.right) {
  if (active.velocity.x < MAX_VX) {
    Matter.Body.applyForce(active, pos, { x: FORCE_STRENGTH * 70, y: 0 });
  }
}

// 키를 안 누를 때 수평 속도 감쇠 (원본: friction으로 처리)
if (!keys.left && !keys.right) {
  Matter.Body.setVelocity(active, {
    x: active.velocity.x * 0.85,  // 수평 감쇠
    y: active.velocity.y,
  });
}

완료 후 커밋:
fix(physics): 회전/이동 속도 캡 수정
```

---

## 버그 4: 점수가 안 잡힘

### 원인
`checkLineDensity`에서 compound body의 `body.vertices`(convex hull)로
밀도를 계산 → 실제보다 큰 면적이 계산되거나 작게 계산됨.
또한 `lineAreas[row]` 누적 방식이 부정확.

### 수정: src/physics/matterLinecut.ts

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/matterLinecut.ts의 checkLineDensity를 수정해줘.

원인: compound body의 body.vertices는 convex hull
      → 각 셀(part)의 vertices를 사용해야 정확함

수정:

export function checkLineDensity(bodies, boardHeight, boardWidth, cellSize, threshold = 0.9) {
  const numRows = Math.floor(boardHeight / cellSize);
  const lineAreas = new Array(numRows).fill(0);

  for (const body of bodies) {
    if (body.isStatic) continue;
    if (!(body as any).kind) continue;

    // compound body면 각 part의 vertices 사용, 아니면 body 자체
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];

    for (const part of parts) {
      const verts = part.vertices;

      for (let row = 0; row < numRows; row++) {
        const lineTop = row * cellSize;
        const lineBottom = lineTop + cellSize;

        // 이 part가 이 행에 겹치는 x 범위
        const inRow = verts.filter(v => v.y >= lineTop && v.y <= lineBottom);
        if (inRow.length < 2) continue;

        const minX = Math.max(0, Math.min(...inRow.map(v => v.x)));
        const maxX = Math.min(boardWidth, Math.max(...inRow.map(v => v.x)));
        if (maxX > minX) {
          lineAreas[row] += (maxX - minX) * cellSize;
        }
      }
    }
  }

  // 클리어 판정: 한 행의 너비 90% 이상 채워짐
  const targetArea = boardWidth * cellSize * threshold;
  const linesToClear = [];

  for (let row = 0; row < numRows; row++) {
    if (lineAreas[row] >= targetArea) {
      linesToClear.push(row);
    }
  }

  return { linesToClear, lineAreas };
}

완료 후 커밋:
fix(linecut): compound body 각 part 기준으로 밀도 계산
```

---

## 수정 순서

```
Fix 1 (렌더링) → 바로 적용 가능, 가장 눈에 띄는 버그
Fix 2 (벽)     → FORCE_STRENGTH도 함께 수정
Fix 3 (속도)   → matterState.ts 캡 값 수정
Fix 4 (점수)   → matterLinecut.ts 수정

모두 feat/physics 브랜치에서 작업 후 dev PR
```
