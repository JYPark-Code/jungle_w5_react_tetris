# Phase 5 수정 프롬프트

> 핵심 문제: 블록이 공중에서 멈추는 현상 (충돌 감지 오작동)
> 이게 해결되면 라인 소거 오작동도 자연히 개선됨

---

## Fix 1 — 충돌 감지 오진단으로 블록이 공중에서 멈춤 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

스크린샷에서 확인된 현상:
- 블록이 다른 블록 근처에 오면 실제로 닿지 않았는데 멈춤
- 파편이 허공에서 착지 판정을 받아 고정됨
- 오른쪽 벽 밖으로 블록이 빠져나감

---

근본 원인:
checkBodyCollision(SAT)이 실제 접촉 없이
"가까이 있음"을 "충돌"로 오판하고 있음

---

수정 1: SAT 구현 검증

아래 단순 케이스를 console.log로 직접 테스트해줘:

// 테스트 A: 완전히 떨어진 두 블록 → 반드시 false
const bodyA = { position: {x:100, y:100}, angle:0,
  localVertices: [{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}] }
const bodyB = { position: {x:200, y:200}, angle:0,
  localVertices: [{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}] }
console.log('떨어진 블록:', checkBodyCollision(bodyA, bodyB)) // 반드시 false

// 테스트 B: 실제로 겹친 두 블록 → 반드시 true
const bodyC = { position: {x:100, y:100}, angle:0,
  localVertices: [{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}] }
const bodyD = { position: {x:110, y:100}, angle:0,
  localVertices: [{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}] }
console.log('겹친 블록:', checkBodyCollision(bodyC, bodyD)) // 반드시 true

// 테스트 C: 바로 옆에 붙은 블록 (닿기만 함) → false 또는 true 중 하나로 일관성
const bodyE = { position: {x:100, y:100}, angle:0,
  localVertices: [{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}] }
const bodyF = { position: {x:140, y:100}, angle:0,
  localVertices: [{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}] }
console.log('딱 붙은 블록:', checkBodyCollision(bodyE, bodyF)) // false가 맞음

테스트 결과에 따라 SAT 구현을 수정해줘.

---

수정 2: SAT에서 0 이하 분리 조건 수정

SAT의 핵심은 "분리 축이 하나라도 있으면 충돌 없음"인데
아래 조건이 잘못되어 있을 가능성이 높아:

잘못된 코드:
  if (overlap <= 0) return false;  // ← 0일 때 false가 맞음

올바른 코드:
  if (overlap < 0) return false;   // ← 엄격하게 음수일 때만 분리

또는 반대로:
  if (overlap >= 0) return true;   // ← 조건이 반대로 적용된 경우

현재 SAT 구현에서 분리 조건을 확인하고
"실제로 겹쳐야만 true"가 되도록 수정해줘.

---

수정 3: 착지 판정을 SAT가 아닌 거리 기반으로 분리

착지 판정(isStatic = true)은 SAT 충돌 감지와 별개로 처리:

// 착지 판정: 블록 바닥면이 실제로 표면에 닿았는지
function isLanded(activeBody, staticBodies, boardHeight): boolean {
  const vertices = getWorldVertices(activeBody);
  const maxY = Math.max(...vertices.map(v => v.y));

  // 바닥 접촉 (2px 허용 오차)
  if (maxY >= boardHeight - 2) return true;

  // 다른 블록 상단과 접촉
  for (const s of staticBodies) {
    const sVertices = getWorldVertices(s);
    const sMinY = Math.min(...sVertices.map(v => v.y));
    const sMaxX = Math.max(...sVertices.map(v => v.x));
    const sMinX = Math.min(...sVertices.map(v => v.x));
    const aMaxX = Math.max(...vertices.map(v => v.x));
    const aMinX = Math.min(...vertices.map(v => v.x));

    // X 범위가 겹치고 Y가 맞닿아있는 경우
    const xOverlap = aMinX < sMaxX && aMaxX > sMinX;
    const yTouch = Math.abs(maxY - sMinY) < 3;

    if (xOverlap && yTouch) return true;
  }
  return false;
}

// nextTick에서 착지 판정은 이 함수로, 충돌 해결은 SAT로 분리
const landed = isLanded(activeBody, staticBodies, boardHeight);
if (landed && Math.abs(velocity.y) < 10) {
  // lockDelay 시작 또는 isStatic = true
}

---

수정 4: 오른쪽 벽 이탈 방지

현재 블록이 오른쪽 벽 밖으로 나가는 문제:

checkWallCollision을 nextTick 매 프레임마다 호출하고 있는지 확인.
이동(moveActive) 후에도 반드시 호출:

function moveActive(state, direction): NotTetrisState {
  const dx = direction === 'left' ? -8 : 8;
  const moved = {
    ...state.activeBody,
    position: {
      x: state.activeBody.position.x + dx,
      y: state.activeBody.position.y
    }
  };

  // 이동 후 즉시 벽 보정
  const corrected = applyWallConstraints(moved, boardWidth);
  return { ...state, activeBody: corrected };
}

function applyWallConstraints(body, boardWidth): RigidBody {
  const vertices = getWorldVertices(body);
  const maxX = Math.max(...vertices.map(v => v.x));
  const minX = Math.min(...vertices.map(v => v.x));

  let dx = 0;
  if (maxX > boardWidth) dx = boardWidth - maxX;
  if (minX < 0) dx = -minX;

  return {
    ...body,
    position: { x: body.position.x + dx, y: body.position.y }
  };
}

완료 후 커밋:
fix(physics): SAT 충돌 오진단 수정, 착지 판정 분리, 벽 이탈 방지
```
