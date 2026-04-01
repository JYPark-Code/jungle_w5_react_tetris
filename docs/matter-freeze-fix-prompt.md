# 게임 멈춤 + 작은 사각형 버그 수정 프롬프트

> 코드 분석으로 확인된 근본 원인 2가지
> 브랜치: feat/physics

---

## 근본 원인

**버그 1 (게임 멈춤)**:
`removeLine`이 activeBody(현재 떨어지는 블록)도 잘라냄.
activeBody가 world에서 제거되면 state.activeBody는 죽은 참조가 되어
속도/위치 계산이 깨지고 새 블록이 스폰되지 않음.

**버그 2 (작은 사각형)**:
`fromVertices`로 재생성한 body의 위치/크기가 부정확.
완전한 셀(32×32)은 `Bodies.rectangle`로 만들어야 정확함.

---

## Fix — matterLinecut.ts 수정

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/matterLinecut.ts의 removeLine 함수를 수정해줘.

---

수정 1 (핵심): activeBody 제외

// 기존
const bodies = Matter.Composite.allBodies(engine.world)
  .filter(b => !b.isStatic && (b as any).kind);

// 수정: isActive=true인 블록(현재 조작 중인 블록)은 절대 자르지 않음
const bodies = Matter.Composite.allBodies(engine.world)
  .filter(b => !b.isStatic && (b as any).kind && !(b as any).isActive);

---

수정 2: fromVertices → Bodies.rectangle로 교체 (완전한 셀만)

완전히 위에 있는 셀은 반드시 Bodies.rectangle 사용:

} else if (partMaxY <= lineTop) {
  // 완전히 클리어 라인 위 → 원본 크기 유지하며 재생성
  const center = centroid(partVerts);

  // fromVertices 대신 rectangle 사용 (크기/위치 정확)
  const newCell = Matter.Bodies.rectangle(
    center.x, center.y, CELL_SIZE, CELL_SIZE,
    {
      angle: body.angle, // 원본 회전 각도 유지
      isStatic: false,
      frictionAir: 0.05,
      restitution: 0.1,
      friction: 0.3,
    }
  );
  (newCell as any).kind = kind;
  (newCell as any).color = color;
  Matter.Body.setVelocity(newCell, { x: 0, y: 0 });
  Matter.Composite.add(engine.world, newCell);
}

라인에 걸친 셀(클리핑 필요한 경우)도 수정:

} else if (partMinY < lineTop && partMaxY > lineTop) {
  // 클리어 라인에 걸침 → 위쪽만 클리핑
  const aboveVerts = clipVertsAboveLine(partVerts, lineTop);
  if (aboveVerts.length >= 3) {
    const center = centroid(aboveVerts);
    const w = Math.max(...aboveVerts.map(v => v.x)) - Math.min(...aboveVerts.map(v => v.x));
    const h = Math.max(...aboveVerts.map(v => v.y)) - Math.min(...aboveVerts.map(v => v.y));

    // 충분한 크기일 때만 재생성 (너무 작은 조각 방지)
    if (w > 2 && h > 2) {
      const newCell = Matter.Bodies.rectangle(
        center.x, center.y, Math.max(w, 4), Math.max(h, 4),
        {
          isStatic: false,
          frictionAir: 0.05,
          restitution: 0.1,
          friction: 0.3,
        }
      );
      (newCell as any).kind = kind;
      (newCell as any).color = color;
      Matter.Body.setVelocity(newCell, { x: 0, y: 0 });
      Matter.Composite.add(engine.world, newCell);
    }
  }
}

---

수정 3: CELL_SIZE import 추가

파일 상단에 추가:
import { CELL_SIZE } from './matterEngine';

---

전체 removeLine 함수 최종 형태:

export function removeLine(
  engine: Matter.Engine,
  row: number,
  cellSize: number,
): void {
  const lineTop = row * cellSize;
  const lineBottom = lineTop + cellSize;

  // isActive=true인 블록(현재 조작 중)은 제외 — 핵심 버그 수정
  const bodies = Matter.Composite.allBodies(engine.world)
    .filter(b => !b.isStatic && (b as any).kind && !(b as any).isActive);

  for (const body of bodies) {
    const allParts = body.parts.length > 1 ? body.parts.slice(1) : [body];
    const bodyVerts = allParts.flatMap(p => Array.from(p.vertices));

    const minY = Math.min(...bodyVerts.map(v => v.y));
    const maxY = Math.max(...bodyVerts.map(v => v.y));

    // 이 body가 클리어 라인과 겹치지 않으면 skip
    if (maxY <= lineTop || minY >= lineBottom) continue;

    const kind = (body as any).kind;
    const color = (body as any).color;

    // body 전체 제거
    Matter.Composite.remove(engine.world, body);

    // 각 part별로 위쪽 조각 재생성
    for (const part of allParts) {
      const partVerts = Array.from(part.vertices);
      const partMinY = Math.min(...partVerts.map(v => v.y));
      const partMaxY = Math.max(...partVerts.map(v => v.y));

      if (partMaxY <= lineTop) {
        // 완전히 클리어 라인 위 → rectangle로 정확하게 재생성
        const center = centroid(partVerts);
        const newCell = Matter.Bodies.rectangle(
          center.x, center.y, CELL_SIZE, CELL_SIZE,
          { angle: body.angle, isStatic: false, frictionAir: 0.05, restitution: 0.1, friction: 0.3 }
        );
        (newCell as any).kind = kind;
        (newCell as any).color = color;
        Matter.Body.setVelocity(newCell, { x: 0, y: 0 });
        Matter.Composite.add(engine.world, newCell);

      } else if (partMinY < lineTop && partMaxY > lineTop) {
        // 클리어 라인에 걸침 → 위쪽 클리핑
        const aboveVerts = clipVertsAboveLine(partVerts, lineTop);
        if (aboveVerts.length >= 3) {
          const center = centroid(aboveVerts);
          const w = Math.max(...aboveVerts.map(v => v.x)) - Math.min(...aboveVerts.map(v => v.x));
          const h = lineTop - partMinY;
          if (w > 2 && h > 2) {
            const newCell = Matter.Bodies.rectangle(
              center.x, center.y, Math.max(w, 4), Math.max(h, 4),
              { isStatic: false, frictionAir: 0.05, restitution: 0.1, friction: 0.3 }
            );
            (newCell as any).kind = kind;
            (newCell as any).color = color;
            Matter.Body.setVelocity(newCell, { x: 0, y: 0 });
            Matter.Composite.add(engine.world, newCell);
          }
        }
      }
      // partMinY >= lineBottom → 클리어 라인 아래 → 삭제 (추가 안 함)
    }
  }
}

한글 주석 필수.

완료 후 커밋:
fix(linecut): activeBody 클리어 제외 + Bodies.rectangle로 정확한 재생성
```

---

## Fix 2 — matterState.ts: 쿨다운 증가

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

matterState.ts에서 cuttingTimer를 0.3 → 1.5로 늘려줘.

newState = {
  ...newState,
  isCutting: true,
  cuttingTimer: 1.5,  // 0.3 → 1.5초: 파편이 충분히 정착할 시간 확보
};

완료 후 커밋:
fix(physics): 라인 클리어 쿨다운 1.5초로 증가
```
