# Phase 4 수정 프롬프트

> 우선순위 순서대로 진행
> 1. 초록 블록 렌더링 아티팩트
> 2. 블록 간 빈틈 / 벽 밀착 안 됨
> 3. 렌더링 메트릭 패널 중앙 정렬

---

## Fix 1 — 초록(S/Z/I) 블록 렌더링 아티팩트 (feat/physics) 최우선

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

초록 블록(S 또는 I 테트로미노) 오른쪽에
얇은 회색 세로선이 남는 렌더링 아티팩트가 있어.
즉 색칠이 덜 되고, 한칸이 비어있는 현상이 있음.

원인 분석 순서:

1. localVertices 확인
   - S 블록의 localVertices를 console.log로 출력
   - 꼭짓점이 canvas 오른쪽 경계(boardWidth)를 벗어나는지 확인

2. canvas clip 확인
   - renderer.ts에서 ctx.rect() 또는 ctx.clip() 호출이 있는지 확인
   - 있다면 제거하거나 boardWidth/boardHeight에 정확히 맞게 수정

3. stroke 아티팩트 확인
   - ctx.strokeStyle이 설정된 후 ctx.stroke() 호출 시
     path가 canvas 경계에서 잘리면 얇은 선이 남을 수 있음
   - 수정: ctx.save() → beginPath() → moveTo/lineTo → closePath()
     → fill() → stroke() → ctx.restore() 순서 확인
   - stroke를 fill 이후에만 호출, path는 반드시 closePath()

4. subpixel 렌더링 문제
   - 꼭짓점 좌표를 Math.round()로 정수화해서 그리기:
     vertices.map(v => ({ x: Math.round(v.x), y: Math.round(v.y) }))

수정 후 확인:
- 초록 블록이 4칸이 완성된 상태로 렌더링
- 모든 블록 색상에서 동일하게 깔끔하게 렌더링

완료 후 커밋:
fix(renderer): S/I 블록 렌더링 아티팩트 제거
```

---

## Fix 2 — 블록 간 빈틈 + 벽 밀착 안 됨 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

스크린샷에서 확인된 문제:
- 블록들이 서로 닿지 않고 조금씩 떠있음
- 블록이 오른쪽 벽/바닥에 완전히 밀착되지 않음
- 방향키로 이동해도 벽까지 완전히 붙지 않음

이 문제는 충돌 해결(resolveCollision)의 허용 오차(tolerance)가
너무 크거나, MTV 보정이 블록을 충분히 밀어내지 않는 것이 원인이야.

---

수정 1: 충돌 해결 허용 오차 제거

현재 코드에서 아래와 같은 패턴이 있으면 수정:
  if (penetrationDepth > 0.5) { // 0.5px 이상일 때만 보정
    position += mtv;
  }

수정:
  if (penetrationDepth > 0) { // 0보다 크면 즉시 보정
    position += mtv;
  }

---

수정 2: 벽 밀착 보정 강화

checkWallCollision에서:
- 오른쪽 벽: maxX > boardWidth
  → position.x -= (maxX - boardWidth)  // 정확히 맞닿도록
  → velocity.x = Math.min(0, velocity.x)  // 오른쪽 방향 속도 제거

- 왼쪽 벽: minX < 0
  → position.x -= minX  // 정확히 맞닿도록
  → velocity.x = Math.max(0, velocity.x)  // 왼쪽 방향 속도 제거

- 바닥: maxY > boardHeight
  → position.y -= (maxY - boardHeight)  // 정확히 바닥에 닿도록
  → velocity.y = 0

---

수정 3: 블록 간 밀착 보정 강화

resolveCollision에서 MTV 보정 후:
  // 보정 후 실제로 겹침이 해소됐는지 재확인
  const stillOverlapping = checkBodyCollision(activeBody, staticBody);
  if (stillOverlapping) {
    // 추가 보정: MTV 방향으로 1px씩 최대 10번 밀기
    for (let i = 0; i < 10; i++) {
      activeBody.position.x += normalizedMtv.x;
      activeBody.position.y += normalizedMtv.y;
      if (!checkBodyCollision(activeBody, staticBody)) break;
    }
  }

---

수정 4: 이동 시 벽 즉시 밀착

moveActive(direction) 에서:
  // 이동 후 벽 충돌 즉시 보정
  const moved = { ...activeBody, position: newPosition };
  const corrected = checkWallCollision(moved, boardWidth, boardHeight);
  return { ...state, activeBody: corrected };

완료 후 커밋:
fix(physics): 블록 간 빈틈 제거, 벽/바닥 밀착 보정 강화
```

---

## Fix 3 — 렌더링 메트릭 패널 중앙 정렬 (feat/app)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

렌더링 메트릭(Flamegraph) 탭이 왼쪽 정렬되어 있어.
Play 탭과 동일하게 중앙 정렬로 수정해줘.

tabs/flamegraph.ts 또는 관련 CSS 수정:

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

Flamegraph canvas도 중앙 정렬:
.flamegraph-canvas-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
}

바 차트 섹션도 동일하게 중앙:
.bar-chart-section {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

완료 후 커밋:
style(app): 렌더링 메트릭 패널 중앙 정렬
```
