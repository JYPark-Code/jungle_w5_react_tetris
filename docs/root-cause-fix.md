# 근본 원인 수정 프롬프트

> 코드 직접 분석 결과
> 브랜치: feat/physics, feat/app

---

## 근본 원인 1: GRAVITY=0.5 × 60fps → 블록이 장애물을 건너뜀

### 문제

`engine.ts`의 `applyGravity`에서 매 프레임 vy += 0.5.
60fps 기준 8프레임 만에 보드 전체를 통과하는 속도:

```
frame 1: vy=0.5,  y=0.5
frame 2: vy=1.0,  y=1.5
frame 3: vy=1.5,  y=3.0
frame 4: vy=2.0,  y=5.0
frame 5: vy=2.5,  y=7.5
frame 6: vy=3.0,  y=10.5
frame 7: vy=3.5,  y=14.0  ← 여기서 다음 y는 18
frame 8: vy=4.0,  newY=18.0
```

y=14에서 T-piece 셀은 rows 13-14. board[15]에 블록이 있어도 cells가 row 14까지라 충돌 안 함.
다음 프레임 newY=18 → cells at rows 17-18 → board[15]를 완전히 건너뜀!

→ **블록이 다른 블록을 통과함 = 공중 부양처럼 보임**
→ **실제로는 안 채워진 줄이 채워진 것처럼 lockPiece되어 라인 소거**

---

## Fix 1 — engine.ts 수정 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/engine.ts의 applyGravity를 수정해줘.

---

문제: GRAVITY=0.5 × 60fps로 블록이 장애물을 건너뜀

수정 1: vy를 최대 1.0으로 제한

applyGravity 함수에서:

// 기존 (잘못됨)
const newVy = piece.vy + GRAVITY;

// 수정 (vy를 최대 1.0으로 제한)
const MAX_VY = 1.0; // 최대 낙하 속도: 1셀/프레임
const newVy = Math.min(piece.vy + GRAVITY, MAX_VY);

이렇게 하면 최대 1셀/프레임으로 이동하므로
장애물을 건너뛰는 현상이 없어짐.

---

수정 2: GRAVITY 값 조정

// 기존
const GRAVITY = 0.5; // 너무 빠름

// 수정
const GRAVITY = 0.05; // 0.05씩 증가, MAX_VY=1.0에 도달까지 20프레임
```

---

## Fix 2 — gameState.ts 수정 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/gameState.ts의 nextTick을 수정해줘.

---

문제 1: 블록 고정 위치가 1칸 높음

현재 isLanded 판정:
movedPiece.y === piece.y → 위치가 안 변하면 착지로 판단

수정: 1칸 아래로 이동 시 충돌 여부로 판정

const isLanded = checkCollision(
  { ...piece, y: Math.floor(piece.y) + 1 },
  state.board
);

이렇게 하면 "바로 아래에 충돌이 있을 때" 정확히 착지로 판단.

---

문제 2: 라인 클리어 오작동

현재 clearLines가 board를 기준으로 체크하는데,
블록이 board에 정확히 기록되는지 확인 필요.

lockPiece 함수에서 getRotatedCells로 float 좌표를 받아
board[cell.y][cell.x]에 기록하는데,
cell.y, cell.x가 유효 범위(0~19, 0~9)인지 체크하고 있음.

추가 체크:
function lockPiece(board: Board, piece: Tetromino): Board {
  const newBoard = board.map((row) => [...row]);
  const cells = getRotatedCells(piece);

  for (const cell of cells) {
    // 유효 범위 체크
    if (cell.y >= 0 && cell.y < BOARD_ROWS &&
        cell.x >= 0 && cell.x < BOARD_COLS) {
      // 이미 채워진 셀 위에 덮어쓰지 않음 (겹침 방지)
      if (newBoard[cell.y][cell.x] === null) {
        newBoard[cell.y][cell.x] = piece.color;
      }
    }
  }

  return newBoard;
}

---

문제 3: 하드드롭 후 게임 오버 오작동

hardDrop에서 1씩 증가하는 방식은 올바름.
하지만 게임 오버 체크:
  const isGameOver = newCurrent
    ? checkCollision(newCurrent, clearedBoard)
    : true;

newCurrent는 nextPiece인데, nextPiece의 초기 y=0.
y=0인 T-piece의 top cell은 Math.round(0 - 0.5) = Math.round(-0.5) = 0 (JS에서).
실제로 board[0]가 빈 상태에서 충돌 false → 게임 오버 아님. 정상.

하지만 만약 board[0]가 채워져 있으면 (실제 게임 오버 상황) → true.
이 로직은 맞음.

단, 수정: nextPiece가 null인 경우가 있으므로:
const isGameOver = !newCurrent ||
  checkCollision({ ...newCurrent, y: 0 }, clearedBoard);

완료 후 테스트 실행:
npm test (또는 npx vitest run)

테스트 통과 후 커밋:
fix(physics): GRAVITY 제한, 착지 판정 수정, lockPiece 겹침 방지
```

---

## Fix 3 — 얇은 선 아티팩트 (feat/physics, renderer)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/app/tabs/play.ts의 drawCell 함수를 수정해줘.

현재 drawCell:
function drawCell(ctx, x, y, color) {
  const px = x * CELL_SIZE;
  const py = y * CELL_SIZE;
  const size = CELL_SIZE - 1; // ← 1px 간격

  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);
  ...
}

문제: getRotatedCells가 float x,y를 반올림해서 반환하는데
x, y가 정확히 정수가 아닐 때 px = x * CELL_SIZE가
subpixel 위치에 그려져 얇은 선이 생김.

수정: 정수로 강제 변환
function drawCell(ctx, x, y, color) {
  const px = Math.floor(Math.round(x) * CELL_SIZE);
  const py = Math.floor(Math.round(y) * CELL_SIZE);
  const size = CELL_SIZE - 1;

  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);
  ...
}

또한 S/Z/I 블록의 getRotatedCells 반환값에
이미 Math.round가 적용되어 있으므로,
drawCell에서 추가 반올림은 안전함.

완료 후 커밋:
fix(renderer): subpixel 아티팩트 제거
```
