# 물리 테트리스 수정 프롬프트

> Not Tetris 2 (https://stabyourself.net/nottetris2/) 스타일 구현
> 현재 문제: 그리드 기반 이동 + angle 값만 붙인 상태
> 목표: 실제 2D 강체 물리 시뮬레이션

---

## 현재 문제 진단

```
현재 구현 (잘못된 방향)          목표 (Not Tetris 2 방식)
─────────────────────────────   ──────────────────────────
블록 = 그리드 셀 배열            블록 = 2D 강체(Rigid Body)
이동 = 셀 인덱스 변경            이동 = 연속 좌표 (x, y)
회전 = 셀 배열 재배치            회전 = 각도(angle) + 꼭짓점 변환
충돌 = 셀 겹침 여부              충돌 = 다각형 SAT(분리축 정리)
렌더링 = 셀 grid                렌더링 = Canvas + 폴리곤 transform
```

---

## Step 1 — 물리 엔진 핵심 구조 교체

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

지금 src/physics/engine.ts는 그리드 기반으로 구현되어 있어.
이걸 Not Tetris 2 스타일의 2D 강체 물리로 완전히 교체해야 해.

핵심 개념:
- 블록은 픽셀 좌표계에서 움직이는 다각형 강체(Rigid Body)야
- 그리드가 없어. x, y는 픽셀 단위 연속 좌표야
- 회전은 0~360도 연속 각도고, 블록의 꼭짓점을 회전 행렬로 변환해

아래 타입으로 engine.ts를 처음부터 다시 작성해줘:

// 2D 벡터
interface Vec2 { x: number; y: number }

// 강체 블록 (Not Tetris 2 방식)
interface RigidBody {
  // 위치 (블록 중심, 픽셀 단위)
  position: Vec2;
  // 선속도 (픽셀/초)
  velocity: Vec2;
  // 회전각 (라디안, 0 ~ 2π)
  angle: number;
  // 각속도 (라디안/초)
  angularVelocity: number;
  // 블록 모양 (중심 기준 꼭짓점 오프셋, 회전 전)
  localVertices: Vec2[];
  // 색상
  color: string;
  // 고정 여부 (착지 후 true)
  isStatic: boolean;
}

구현할 함수들:

1. getWorldVertices(body: RigidBody): Vec2[]
   - localVertices를 angle만큼 회전 행렬 적용 후 position에 더해 반환
   - 회전 행렬: x' = x*cos - y*sin, y' = x*sin + y*cos

2. applyGravity(body: RigidBody, dt: number, gravity: number): RigidBody
   - velocity.y += gravity * dt
   - position += velocity * dt
   - angle += angularVelocity * dt
   - angularVelocity에 감쇠(damping) 적용: *= 0.98

3. checkWallCollision(body: RigidBody, boardWidth: number): RigidBody
   - getWorldVertices로 꼭짓점 구하기
   - 왼쪽/오른쪽 벽 벗어나면 position.x 보정 + velocity.x 반전(반발계수 0.3)
   - 바닥 닿으면 isStatic = true, velocity = {0,0}, angularVelocity = 0

4. checkBodyCollision(a: RigidBody, b: RigidBody): boolean
   - SAT(분리축 정리)로 두 다각형 충돌 여부 반환
   - 각 다각형의 모서리를 법선 벡터로 사용
   - 두 다각형의 투영이 겹치지 않는 축이 하나라도 있으면 false

5. resolveCollision(active: RigidBody, statics: RigidBody[]): RigidBody
   - active 블록이 static 블록들과 충돌하면
   - 충돌 방향으로 position 보정
   - velocity 반전 + 감쇠 적용 (반발계수 0.3)
   - angularVelocity 유지 (블록이 기울어진 채로 쌓임)
   - 속도가 충분히 작으면 isStatic = true

한글 주석으로 각 수식의 의미를 설명해줘.
테스트는 src/physics/engine.test.ts에 작성해줘.

완료 후 커밋하고 feat/physics에 푸시해줘:
feat(physics): 그리드 기반 → 2D 강체 물리 엔진으로 교체
```

---

## Step 2 — 테트로미노 정의 교체

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

기존 테트로미노 정의는 2D 셀 배열이야.
이걸 RigidBody의 localVertices 형태로 교체해야 해.

src/physics/tetrominos.ts 파일을 새로 만들어줘.

테트로미노 7종류 (I, J, L, O, S, Z, T)를 각각
중심(0,0) 기준 꼭짓점 배열(localVertices)로 정의해줘.

예시 (O 블록, 한 변이 40px인 정사각형):
localVertices: [
  { x: -20, y: -20 },
  { x:  20, y: -20 },
  { x:  20, y:  20 },
  { x: -20, y:  20 },
]

예시 (I 블록, 4x1 직사각형, 셀 크기 40px):
localVertices: [
  { x: -80, y: -20 },
  { x:  80, y: -20 },
  { x:  80, y:  20 },
  { x: -80, y:  20 },
]

나머지 5종류 (J, L, S, Z, T)도 동일하게 꼭짓점으로 정의해줘.
셀 크기는 40px 기준으로 계산해줘.

블록 색상도 포함해줘:
I: '#00f0f0', J: '#0000f0', L: '#f0a000',
O: '#f0f000', S: '#00f000', Z: '#f00000', T: '#a000f0'

createRandomBody(spawnX: number, spawnY: number): RigidBody 함수도 만들어줘.
랜덤 테트로미노 선택 후 RigidBody로 반환.

한글 주석 필수.

완료 후 커밋:
feat(physics): 테트로미노 강체 정의로 교체
```

---

## Step 3 — 라인 클리어 (핵심: 다각형 절단)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

Not Tetris 2의 핵심 기능: 기울어진 블록을 수평선으로 절단.

src/physics/linecut.ts 파일을 새로 만들어줘.

구현할 함수:

1. isLineFull(bodies: RigidBody[], lineY: number, boardWidth: number): boolean
   - 특정 y 좌표에서 보드 전체 너비를 블록들이 덮고 있는지 확인
   - 각 블록의 worldVertices를 구해서 해당 y에서의 x 범위를 계산
   - 모든 x 범위의 합집합이 boardWidth 이상이면 true

2. cutBodyAtLine(body: RigidBody, lineY: number): {
     above: RigidBody | null,
     below: RigidBody | null
   }
   - Sutherland-Hodgman 알고리즘으로 다각형을 수평선 기준으로 절단
   - lineY 위쪽 꼭짓점 → above 다각형
   - lineY 아래쪽 꼭짓점 → below 다각형
   - 선분이 lineY를 교차하는 점 계산해서 절단면에 추가
   - above, below 각각 새 RigidBody로 반환 (중심 재계산)
   - 다각형이 lineY 완전히 위/아래에 있으면 null 반환

3. clearFullLines(
     bodies: RigidBody[],
     boardHeight: number,
     boardWidth: number,
     cellSize: number
   ): { bodies: RigidBody[], linesCleared: number }
   - 각 행(y 좌표)을 체크
   - 꽉 찬 행의 아래쪽 조각 제거, 위쪽 조각은 유지
   - 제거된 행 수만큼 위쪽 조각에 중력 재적용 (isStatic = false)
   - 라인 클리어 수 반환

Sutherland-Hodgman 핵심 로직:
- 입력: 다각형 꼭짓점 배열, 클리핑 선(y = lineY)
- 각 모서리에 대해:
  - 두 점이 모두 inside: 끝점 추가
  - 시작만 inside: 교차점 추가
  - 끝만 inside: 교차점 + 끝점 추가
  - 둘 다 outside: 추가 없음

한글 주석으로 각 단계 설명 필수.
테스트는 src/physics/linecut.test.ts에 작성.

완료 후 커밋:
feat(physics): Sutherland-Hodgman 다각형 절단 구현
```

---

## Step 4 — Canvas 렌더러 구현

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

기존 DOM/그리드 렌더링을 Canvas 기반으로 교체해야 해.

src/physics/renderer.ts 파일을 새로 만들어줘.

구현할 함수:

1. createCanvas(container: HTMLElement, width: number, height: number): HTMLCanvasElement
   - container에 canvas 생성 후 반환

2. renderFrame(
     ctx: CanvasRenderingContext2D,
     bodies: RigidBody[],
     boardWidth: number,
     boardHeight: number
   ): void
   - 매 프레임 호출
   - ctx.clearRect로 전체 지우기
   - 보드 경계선 그리기 (흰 테두리)
   - 각 body에 대해:
     - ctx.save()
     - ctx.translate(position.x, position.y)
     - ctx.rotate(angle)
     - ctx.beginPath()
     - localVertices로 path 그리기
     - ctx.fillStyle = body.color
     - ctx.fill()
     - ctx.strokeStyle = 'rgba(0,0,0,0.5)'
     - ctx.stroke()
     - ctx.restore()

3. renderLineClearEffect(
     ctx: CanvasRenderingContext2D,
     lineY: number,
     boardWidth: number
   ): void
   - 라인 클리어 시 수평선 flash 애니메이션
   - 흰색 반투명 수평선이 0.3초 동안 깜빡

DOM 기반 Board 컴포넌트 대신 이 renderer를 useEffect 안에서 사용해.
한글 주석 필수.

완료 후 커밋:
feat(physics): Canvas 기반 강체 렌더러 구현
```

---

## Step 5 — 게임 루프 교체

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/gameState.ts를 Not Tetris 2 방식으로 교체해줘.

PhysicsState 타입:
interface NotTetrisState {
  bodies: RigidBody[];          // 화면에 있는 모든 강체
  activeBodies: RigidBody[];    // 현재 떨어지는 블록 (1개)
  heldBody: RigidBody | null;   // 보관 블록
  nextBody: RigidBody;          // 다음 블록
  canHold: boolean;
  score: number;
  level: number;
  linesCleared: number;
  isGameOver: boolean;
}

구현할 함수:

1. initNotTetrisState(boardWidth, boardHeight): NotTetrisState
   - 초기 상태 반환

2. nextTick(state: NotTetrisState, dt: number): NotTetrisState
   - 순서:
     a. activeBody에 applyGravity 적용
     b. checkWallCollision 적용
     c. static bodies와 충돌 체크 (checkBodyCollision)
     d. 충돌 시 resolveCollision 적용
     e. 속도 충분히 작으면 isStatic = true → bodies에 추가
     f. 새 activeBody 생성 (nextBody → active, 새 랜덤 → next)
     g. clearFullLines 체크
     h. 게임오버 체크 (spawn 위치에 충돌 있으면)

3. moveActive(state, direction: 'left' | 'right'): NotTetrisState
   - activeBody.position.x ±= 이동량
   - 벽 충돌 체크 후 반환

4. snapRotate(state): NotTetrisState
   - activeBody.angle += Math.PI / 2 (90도 즉시 회전)

5. applyRotation(state, direction: 'cw' | 'ccw'): NotTetrisState
   - activeBody.angularVelocity += direction === 'cw' ? 0.1 : -0.1
   - Q/E 키 입력 시 각속도 추가 (자연스러운 회전)

6. softDrop(state): NotTetrisState
   - activeBody.velocity.y += 200

7. hardDrop(state): NotTetrisState
   - 충돌할 때까지 position.y 증가
   - 즉시 isStatic = true

8. holdPiece(state): NotTetrisState
   - canHold 체크
   - heldBody ↔ activeBody 교체

dt는 requestAnimationFrame의 delta time (초 단위, 약 0.016).

한글 주석 필수.
테스트는 gameState.test.ts에 추가.

완료 후 커밋:
feat(physics): Not Tetris 2 방식 게임 루프 구현
```

---

## 수정 후 확인 사항

```bash
# 로컬에서 바로 테스트
npx serve -l 3000

# 확인할 것:
# 1. 블록이 픽셀 단위로 자연스럽게 낙하하는가
# 2. Q/E 키로 블록이 원형으로 부드럽게 회전하는가
# 3. 기울어진 채로 다른 블록 위에 쌓이는가
# 4. 라인이 꽉 차면 블록이 수평으로 절단되는가
# 5. 절단된 위 조각이 다시 낙하하는가
```

---

## 참고: Not Tetris 2 핵심 차이점

| 일반 테트리스 | Not Tetris 2 |
|---|---|
| 그리드 셀 이동 | 픽셀 좌표 연속 이동 |
| 0/90/180/270도 회전 | 0~360도 연속 회전 |
| 셀 겹침 충돌 | SAT 다각형 충돌 |
| 행 전체 삭제 | 수평선으로 다각형 절단 |
| DOM grid 렌더링 | Canvas 폴리곤 렌더링 |
