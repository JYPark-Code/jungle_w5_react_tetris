# 물리 엔진 확정 수정 프롬프트

> 코드 직접 분석으로 확인된 근본 원인
> 브랜치: feat/physics, feat/app

---

## 확인된 근본 원인

```
rotatePiece: ANGULAR_IMPULSE = 45도/프레임

Q/E 키 입력 시:
1. angularVelocity += 45
2. applyGravity: newAngle = piece.angle + 38.25 (감쇠 후)
3. 회전된 셀이 인접 블록에 조금이라도 닿으면 checkCollision = true
4. 반환: { ...piece, vy: 0, angularVelocity: 0 }
5. nextTick: movedPiece.y === piece.y AND vy === 0 → isLanded = true!
6. 블록이 허공에서 즉시 고정!

→ 회전이 충돌을 감지하면 낙하 중인 블록이 허공에서 잠김
→ 사용자가 Q/E를 누를 때마다 블록이 현재 위치에서 고정됨
```

---

## Fix 1 — engine.ts 수정 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/engine.ts를 수정해줘.

---

수정 1: applyGravity에서 회전 충돌과 낙하 충돌 분리

현재 코드는 회전+이동을 한 번에 계산해서 하나의 충돌 감지로 처리하는 문제가 있어.
회전이 충돌을 일으켜도 vy=0이 되어 isLanded가 true가 됨.

다음과 같이 수정해줘:

export const applyGravity: ApplyGravityFn = (
  piece: Tetromino,
  board: Board
): Tetromino => {
  const GRAVITY = 0.05;
  const MAX_VY = 1.0;
  const FRICTION = 0.9;
  const ANGULAR_FRICTION = 0.85;

  // === 1단계: 회전만 먼저 적용 ===
  // 회전이 충돌을 일으키면 회전만 취소 (vy는 유지)
  const newAngularVelocity = piece.angularVelocity * ANGULAR_FRICTION;
  const newAngle = piece.angle + newAngularVelocity;

  const withRotation: Tetromino = {
    ...piece,
    angle: newAngle,
    angularVelocity: newAngularVelocity,
  };

  // 회전 충돌 체크
  const rotationCollides = checkCollision(withRotation, board);

  // 회전 충돌 시 회전만 취소, 속도 유지
  const safeAngle = rotationCollides ? piece.angle : newAngle;
  const safeAngularVelocity = rotationCollides ? 0 : newAngularVelocity;

  // === 2단계: 낙하 적용 ===
  const newVy = Math.min(piece.vy + GRAVITY, MAX_VY);
  const newVx = piece.vx * FRICTION;
  const newY = piece.y + newVy;
  const newX = piece.x + newVx;

  const moved: Tetromino = {
    ...piece,
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
    angle: safeAngle,
    angularVelocity: safeAngularVelocity,
  };

  // 낙하 충돌 체크 (회전 제외, 위치만)
  if (checkCollision(moved, board)) {
    // 낙하만 취소, 회전 상태는 유지
    return {
      ...piece,
      angle: safeAngle,
      angularVelocity: safeAngularVelocity,
      vx: 0,
      vy: 0,
      // x는 유지 (좌우 이동 중 벽 충돌한 경우도 포함)
    };
  }

  return moved;
};

---

수정 2: ANGULAR_IMPULSE 조정

rotatePiece 함수에서:

// 기존 (너무 큼 — 45도/프레임)
const ANGULAR_IMPULSE = 45;

// 수정 (적당한 회전 속도)
const ANGULAR_IMPULSE = 15;

45도/프레임이면 첫 프레임에 바로 38도 회전해서
인접 블록에 거의 항상 충돌함.
15도/프레임으로 줄이면 부드럽게 회전하면서 충돌 오작동 방지.

완료 후 테스트 실행하고 커밋:
fix(physics): 회전-낙하 충돌 분리, ANGULAR_IMPULSE 15도로 조정
```

---

## Fix 2 — gameState.ts isLanded 수정 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/gameState.ts의 nextTick을 수정해줘.

현재 isLanded 판정:
const isLanded =
  movedPiece.x === piece.x &&
  movedPiece.y === piece.y &&
  movedPiece.vy === 0;

문제: engine.ts Fix 1 적용 후에도
낙하 충돌 시 returned piece의 y === 원래 y이고 vy === 0이라
이 조건이 맞음. 이건 올바른 동작.

하지만 추가 안전 조건으로 수정:

const isLanded =
  movedPiece.vy === 0 &&
  movedPiece.y === piece.y &&
  // 실제로 아래로 이동이 막혀있는지 확인
  checkCollision({ ...movedPiece, y: movedPiece.y + 1 }, state.board);

이렇게 하면 "아래로 이동 시 충돌이 있을 때만" 착지로 판단.
회전 취소로 vy=0이 됐지만 아래가 비어있으면 isLanded = false.

완료 후 커밋:
fix(physics): isLanded 조건에 아래 충돌 확인 추가
```

---

## Fix 3 — HOLD/NEXT 블록 중앙 정렬 (feat/app)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/app/tabs/play.ts의 renderPreview 함수를 수정해줘.

현재 문제: HOLD, NEXT 미리보기 캔버스에서
블록이 좌상단에 치우쳐 있음.

수정 방향:
renderPreview에서 블록을 canvas 정중앙에 그리도록:

export function renderPreview(
  canvas: HTMLCanvasElement,
  piece: Tetromino | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!piece) return;

  const previewSize = 24; // 각 셀 크기
  const rows = piece.shape.length;
  const cols = piece.shape[0].length;

  // 블록 전체 크기
  const blockWidth = cols * previewSize;
  const blockHeight = rows * previewSize;

  // canvas 정중앙 기준 offset
  const offsetX = Math.floor((canvas.width - blockWidth) / 2);
  const offsetY = Math.floor((canvas.height - blockHeight) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (piece.shape[r][c]) {
        const px = offsetX + c * previewSize;
        const py = offsetY + r * previewSize;
        const size = previewSize - 1;

        ctx.fillStyle = piece.color;
        ctx.fillRect(px, py, size, size);

        // 하이라이트
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(px, py, size, 2);
        ctx.fillRect(px, py, 2, size);
      }
    }
  }
}

완료 후 커밋:
fix(app): HOLD/NEXT 미리보기 블록 정중앙 정렬
```
