# 블록 갭 + 좌우 이동 속도 수정 프롬프트

> 코드 분석 확인된 두 가지 버그
> 브랜치: feat/physics, feat/app (index.ts)

---

## 근본 원인

**블록 간 갭 문제:**
```
applyGravity에서 충돌 감지 시 piece.y(원래 위치) 반환
→ 착지 위치가 장애물 1칸 위에 멈춤

예시: piece.y=4.3 (cells at rows 4,5)
     아래 블록이 row 6에 있음
     vy=0.5 → newY=4.8 → cells at rows 4,5 → no collision
     vy=0.6 → newY=5.4 → cells at rows 5,6 → collision!
     → 반환: piece.y=4.8 (cells at rows 4,5)
     → 아래 블록(row 6)과 1칸 갭 발생
```

**key repeat 없음:**
```
handleKeyDown: 한 번만 1칸 이동
→ 꾹 눌러도 1칸만 이동
```

---

## Fix 1 — engine.ts: applyGravity 착지 위치 정밀화 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/engine.ts의 applyGravity에서
충돌 감지 시 정확한 착지 위치를 찾아 반환하도록 수정해줘.

현재 문제:
충돌 감지 시 piece.y (원래 위치)를 그대로 반환
→ 착지 위치가 장애물에서 0.5~1칸 위에 멈춤

수정: 충돌 직전 최대 y 위치를 찾아서 반환

// 낙하 충돌 체크 부분 수정
if (checkCollision(moved, board)) {
  // 충돌 감지 시: piece.y부터 newY까지 0.05 단위로
  // 충돌 없는 최대 y를 찾아 착지
  let landY = piece.y;
  const step = 0.05;
  while (true) {
    const testY = landY + step;
    if (testY >= newY) break;
    const test: Tetromino = {
      ...piece,
      y: testY,
      angle: safeAngle,
    };
    if (checkCollision(test, board)) break;
    landY = testY;
  }

  return {
    ...piece,
    y: landY,          // 정확한 착지 위치
    angle: safeAngle,
    angularVelocity: safeAngularVelocity,
    vx: 0,
    vy: 0,
  };
}

이렇게 하면 블록이 장애물 바로 위에 붙어서 착지함.

완료 후 커밋:
fix(physics): 착지 위치 정밀화 — 블록 간 갭 제거
```

---

## Fix 2 — index.ts: 좌우 이동 key repeat 구현 (feat/app)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/app/index.ts의 키보드 처리를 수정해줘.

현재 문제: ArrowLeft/Right가 keydown에서 단 1칸 이동
→ 꾹 눌러도 1칸만 이동

수정: key repeat 구현

// 기존 전역 변수 추가 위치에:
const pressedKeys = new Set<string>();
let moveInterval: ReturnType<typeof setInterval> | null = null;

// 이동 실행 함수
function executeMoveKeys(): void {
  if (!isRunning || isPaused || gameState.isGameOver) return;
  if (pressedKeys.has('ArrowLeft')) {
    gameState = moveActive(gameState, 'left');
    renderBoardCanvas();
  }
  if (pressedKeys.has('ArrowRight')) {
    gameState = moveActive(gameState, 'right');
    renderBoardCanvas();
  }
}

// handleKeyDown 수정:
function handleKeyDown(e: KeyboardEvent): void {
  if (!isRunning || isPaused || gameState.isGameOver) return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      if (pressedKeys.has(e.key)) return; // 이미 눌린 키는 무시 (OS repeat 방지)
      pressedKeys.add(e.key);
      // 즉시 1번 이동
      gameState = moveActive(gameState, e.key === 'ArrowLeft' ? 'left' : 'right');
      // 150ms 후 repeat 시작, 이후 50ms마다 반복
      if (moveInterval) clearInterval(moveInterval);
      setTimeout(() => {
        if (pressedKeys.has('ArrowLeft') || pressedKeys.has('ArrowRight')) {
          moveInterval = setInterval(executeMoveKeys, 50);
        }
      }, 150);
      break;

    case 'ArrowUp':
      e.preventDefault();
      gameState = snapRotate(gameState);
      break;

    // ... 나머지 키들 그대로 유지

  }
}

// handleKeyUp 추가 (document.addEventListener에 추가):
function handleKeyUp(e: KeyboardEvent): void {
  pressedKeys.delete(e.key);
  if (!pressedKeys.has('ArrowLeft') && !pressedKeys.has('ArrowRight')) {
    if (moveInterval) {
      clearInterval(moveInterval);
      moveInterval = null;
    }
  }
}

// initApp에서:
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);   // 추가

완료 후 커밋:
fix(app): 좌우 이동 key repeat 구현 (150ms 딜레이 후 50ms 간격)
```
