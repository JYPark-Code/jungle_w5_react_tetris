# Matter.js 긴급 버그 수정 프롬프트

> 코드 직접 분석으로 확인된 4가지 버그
> 브랜치: feat/physics

---

## 버그 1: 벽에 닿으면 착지 판정

### 원인 (index.ts)
```js
// isBodyOnGround가 벽 충돌도 포함해서 true 반환
const pairs = state.engine.pairs.list;
return pairs.some(pair =>
  (pair.bodyA === state.activeBody || ...) && pair.isActive
);
// 벽에 닿고 속도 < 0.3이면 → lockAndSpawnNew 호출!
```

### 수정: src/app/index.ts

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/app/index.ts의 isBodyOnGround 함수를 수정해줘.

벽(left/right wall) 충돌은 착지 판정에서 제외해야 함.

function isBodyOnGround(state: MatterGameState): boolean {
  if (!state.activeBody) return false;
  const pairs = state.engine.pairs.list;
  return pairs.some((pair: any) => {
    if (!pair.isActive) return false;

    const isActive =
      pair.bodyA === state.activeBody ||
      pair.bodyB === state.activeBody ||
      pair.bodyA.parent === state.activeBody ||
      pair.bodyB.parent === state.activeBody;

    if (!isActive) return false;

    // 충돌 상대방 찾기
    const other =
      (pair.bodyA === state.activeBody || pair.bodyA.parent === state.activeBody)
        ? pair.bodyB
        : pair.bodyA;

    // 벽(left/right) 충돌은 착지 판정 제외
    const otherLabel = other.label ?? other.parent?.label ?? '';
    if (otherLabel === 'left' || otherLabel === 'right') return false;

    return true;
  });
}

완료 후 커밋:
fix(index): 벽 충돌 착지 판정 제외
```

---

## 버그 2: 매 프레임 라인 클리어로 게임 멈춤

### 원인 (matterState.ts)
```js
// isCutting이 절대 true로 안 됨 → 매 프레임 클리어 실행
if (linesToClear.length > 0 && !state.isCutting) {
  removeLine(...);
  // isCutting = true 설정 없음!
}
```
또한 `removeLine`이 compound body의 convex hull vertices를 사용해서
잘린 조각이 뭉개짐.

### 수정: src/physics/matterState.ts + matterLinecut.ts

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

---

수정 1: matterState.ts — 클리어 후 0.5초 쿨다운 추가

updateMatter 함수에서 라인 클리어 섹션 수정:

if (linesToClear.length > 0 && !state.isCutting) {
  for (const lineNo of linesToClear) {
    removeLine(state.engine, lineNo, CELL_SIZE);
  }

  const scoreAdd = calcScore(linesToClear.length, lineAreas, linesToClear, state.level);
  const newLinesCleared = state.linesCleared + linesToClear.length;
  const newLevel = Math.floor(newLinesCleared / 10) + 1;

  newState = {
    ...newState,
    score: state.score + scoreAdd,
    linesCleared: newLinesCleared,
    level: newLevel,
    isCutting: true,       // ← 쿨다운 시작
    cuttingTimer: 0.3,     // ← 0.3초 후 재판정 허용
  };
} else if (state.isCutting) {
  // 쿨다운 카운트다운
  const newTimer = state.cuttingTimer - dt;
  if (newTimer <= 0) {
    newState = { ...newState, isCutting: false, cuttingTimer: 0 };
  } else {
    newState = { ...newState, cuttingTimer: newTimer };
  }
}

---

수정 2: matterLinecut.ts — removeLine compound body 처리 수정

현재 body.vertices는 convex hull → 잘린 모양이 뭉개짐
compound body는 각 part를 개별 처리해야 함

export function removeLine(engine, row, cellSize) {
  const lineTop = row * cellSize;
  const lineBottom = lineTop + cellSize;

  const bodies = Matter.Composite.allBodies(engine.world)
    .filter(b => !b.isStatic && (b as any).kind);

  for (const body of bodies) {
    // compound body: parts[0]=parent, parts[1..]=실제 셀
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];

    const kind = (body as any).kind;
    const color = (body as any).color;

    // 각 part 기준으로 body가 이 행에 걸치는지 체크
    const bodyVerts = body.parts.length > 1
      ? body.parts.slice(1).flatMap(p => p.vertices)
      : body.vertices;

    const minY = Math.min(...bodyVerts.map(v => v.y));
    const maxY = Math.max(...bodyVerts.map(v => v.y));

    if (maxY <= lineTop || minY >= lineBottom) continue;

    // body 전체 제거
    Matter.Composite.remove(engine.world, body);

    // 각 part별로 위쪽 조각 재생성
    for (const part of parts) {
      const partVerts = part.vertices;
      const partMinY = Math.min(...partVerts.map(v => v.y));
      const partMaxY = Math.max(...partVerts.map(v => v.y));

      // 이 part가 클리어 라인 위에 걸쳐있는지
      if (partMaxY <= lineTop) {
        // 완전히 위에 있음 → 그대로 재생성 (새 개별 body)
        const center = centroid(partVerts);
        const localVerts = partVerts.map(v => ({
          x: v.x - center.x,
          y: v.y - center.y,
        }));
        const newPart = Matter.Bodies.fromVertices(center.x, center.y, [localVerts], {
          isStatic: false, frictionAir: 0.05, restitution: 0.1, friction: 0.3,
        });
        if (newPart) {
          (newPart as any).kind = kind;
          (newPart as any).color = color;
          // fromVertices가 위치를 조정하므로 재설정
          Matter.Body.setPosition(newPart, center);
          Matter.Body.setVelocity(newPart, { x: 0, y: 0 });
          Matter.Composite.add(engine.world, newPart);
        }
      } else if (partMinY < lineTop && partMaxY > lineTop) {
        // 클리어 라인에 걸침 → 위쪽만 클리핑
        const aboveVerts = clipVertsAboveLine(partVerts, lineTop);
        if (aboveVerts.length >= 3) {
          const center = centroid(aboveVerts);
          const localVerts = aboveVerts.map(v => ({
            x: v.x - center.x,
            y: v.y - center.y,
          }));
          const newPart = Matter.Bodies.fromVertices(center.x, center.y, [localVerts], {
            isStatic: false, frictionAir: 0.05, restitution: 0.1, friction: 0.3,
          });
          if (newPart) {
            (newPart as any).kind = kind;
            (newPart as any).color = color;
            Matter.Body.setPosition(newPart, center);
            Matter.Body.setVelocity(newPart, { x: 0, y: 0 });
            Matter.Composite.add(engine.world, newPart);
          }
        }
      }
      // partMinY >= lineBottom → 완전히 아래 → 삭제 (추가 안 함)
    }
  }
}

완료 후 커밋:
fix(physics): 라인 클리어 쿨다운 추가, compound body part별 절단 수정
```

---

## 버그 3: 점수 Infinity

### 원인 (matterState.ts calcScore)
```js
// 문제 1: ALL lineAreas(18개)를 합산 → avgArea >> 1 가능
const avgArea = lineAreas.reduce((a, b) => a + b, 0) / numLines / 10240;

// 문제 2: avgArea > 1이면 (numLines*3)**(avgArea**10) = Infinity
return Math.ceil((numLines * 3) ** (avgArea ** 10) * 20 + ...);
```

### 수정: src/physics/matterState.ts

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

matterState.ts의 calcScore 함수와 호출부를 수정해줘.

---

수정 1: calcScore 시그니처 변경 — 클리어된 행 인덱스 추가

function calcScore(
  numLines: number,
  lineAreas: number[],
  clearedRows: number[],  // 추가: 클리어된 행 인덱스
  level: number,
): number {
  void level;

  // 클리어된 행의 면적만 합산 (전체 행 합산 금지)
  const clearedAreaSum = clearedRows.reduce((sum, row) => sum + (lineAreas[row] ?? 0), 0);

  // avgArea = 클리어된 행의 평균 채움 비율 (0~1로 clamp)
  // 1행 최대 면적 = boardWidth(320) * cellSize(32) = 10240
  const avgArea = Math.min(1.0, clearedAreaSum / numLines / 10240);

  // 원본 scoring formula (avgArea가 0~1 이므로 Infinity 없음)
  return Math.ceil((numLines * 3) ** (avgArea ** 10) * 20 + numLines ** 2 * 40);
}

---

수정 2: calcScore 호출부에 clearedRows 추가

// updateMatter 내부
const scoreAdd = calcScore(linesToClear.length, lineAreas, linesToClear, state.level);
//                                                            ↑ 추가

완료 후 커밋:
fix(physics): calcScore 클리어 행만 합산, avgArea 1.0 clamp으로 Infinity 방지
```
