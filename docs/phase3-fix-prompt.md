# Phase 3 수정 프롬프트

> 스크린샷 3장 기준 잔존 버그 정리
> 전부 feat/physics + feat/app 대상

---

## Fix 1 — 중력 미적용 + 경계/하드드롭/이동 버그 (feat/physics) 최우선

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

스크린샷에서 빨간 원으로 표시한 것:
블록 아래에 빈 공간이 있는데 블록이 내려가지 않고 허공에 멈춰있음.
중력이 착지 판정 이후 다시 적용되지 않는 구조 문제야.

---

문제 1 (최우선): 블록이 빈 공간 위에서 멈춤 — 중력 미적용

원인 추정:
- isStatic = true 전환 조건이 너무 일찍 충족됨
- 또는 착지 판정 후 velocity.y = 0으로 초기화되어
  중력이 다시 붙지 않음
- 또는 충돌 감지가 실제 접촉 없이 proximity만으로 판정함

수정 방향:
- isStatic = true 조건을 엄격하게:
  반드시 getWorldVertices로 실제 꼭짓점이
  바닥(boardHeight) 또는 staticBody 표면에 닿아있을 때만 true
  "근처에 있음"이 아니라 "실제 접촉"

- 착지 체크 로직:
  const vertices = getWorldVertices(activeBody);
  const maxY = Math.max(...vertices.map(v => v.y));

  // 바닥 접촉 여부
  const onFloor = maxY >= boardHeight - 2;

  // 다른 static body 위에 있는지 여부
  const onBody = staticBodies.some(s => {
    const sVertices = getWorldVertices(s);
    const sMinY = Math.min(...sVertices.map(v => v.y));
    // active 블록 바닥이 static 블록 상단에 닿아있는지
    return Math.abs(maxY - sMinY) < 3 && checkBodyCollision(activeBody, s);
  });

  if ((onFloor || onBody) && Math.abs(velocity.y) < 5) {
    isStatic = true;
  }

- 빈 공간이 있으면 velocity.y를 초기화하지 말고
  중력을 계속 누적:
  if (!onFloor && !onBody) {
    velocity.y += gravity * dt; // 중력 계속 적용
    position.y += velocity.y * dt;
  }

---

문제 2: 오른쪽 경계면 이동 불가

원인: checkWallCollision에서 블록 중심(position.x)만 체크,
      꼭짓점 기준으로 체크 안 함

수정:
- getWorldVertices로 모든 꼭짓점 구한 후:
  maxX = Math.max(...vertices.map(v => v.x))
  minX = Math.min(...vertices.map(v => v.x))
- 오른쪽: maxX > boardWidth → position.x -= (maxX - boardWidth)
- 왼쪽: minX < 0 → position.x -= minX
- velocity.x = 0

---

문제 3: Space(하드 드롭)가 빈 공간에서 멈춤

수정:
  function hardDrop(state): NotTetrisState {
    const step = 2;
    let testBody = { ...state.activeBody };

    while (true) {
      const next = {
        ...testBody,
        position: { x: testBody.position.x, y: testBody.position.y + step }
      };

      const vertices = getWorldVertices(next);
      const maxY = Math.max(...vertices.map(v => v.y));
      if (maxY >= boardHeight) break;

      const hit = state.staticBodies.some(s => checkBodyCollision(next, s));
      if (hit) break;

      testBody = next;
    }

    return { ...state, activeBody: { ...testBody, isStatic: true } };
  }

---

문제 4: 좌우 이동이 픽셀 단위로 끊겨 보임

수정:
- 이동량: 한 번 입력 시 8px
- keydown → 즉시 8px 이동
- 150ms 후 repeat 시작 → 매 50ms마다 8px 이동
- keyup 시 interval 클리어

---

문제 5: 초록(I 블록) 렌더링 얇은 선 아티팩트

수정:
- canvas clip 영역 제거
- renderer에서 boardWidth/boardHeight 범위만 clearRect로 처리
- I 블록 spawn 시 position.x = boardWidth / 2 정확히 설정

완료 후 커밋:
fix(physics): 중력 미적용, 경계면, 하드드롭, 부드러운 이동, I블록 렌더링
```

---

## Fix 2 — Play / Flamegraph 패널 중앙 정렬 (feat/app)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

Play 탭과 Flamegraph 탭이 왼쪽 정렬되어 있어.
이 두 탭만 가운데 정렬로 수정해줘.

---

Play 탭:
- 게임 보드(Canvas) + 사이드 패널 전체를
  수평 중앙 정렬
- 방법:
  .play-container {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    height: calc(100vh - 48px);
    gap: 24px;
    padding: 0 24px;
    box-sizing: border-box;
  }

Flamegraph 탭:
- Flamegraph canvas와 바 차트, 인사이트 섹션 전체를
  수평 중앙 정렬
- 방법:
  .flamegraph-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 48px;
    box-sizing: border-box;
  }

Why, 학습, Code 탭은 기존 레이아웃 유지
(이미 전체 너비 활용 중)

완료 후 커밋:
style(app): Play/Flamegraph 패널 중앙 정렬
```
