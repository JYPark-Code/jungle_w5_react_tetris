# UI 복원 + 자동 이동 버그 + 블록 결합 수정

> 브랜치: feat/app (또는 dev)

---

## Fix 1: play.ts UI 복원

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/app/tabs/play.ts에서 score 패널과 버튼 HTML을 복원해줘.
현재 score-panel 영역이 비어 있는데, TetrisApp 컴포넌트가 마운트되기 전에
보이는 초기 HTML이 필요함.

아래 내용으로 교체:

// 보드 크기 상수 복원
const CELL_SIZE = 28;
const BOARD_COLS = 10;
const BOARD_ROWS = 20;
const BOARD_WIDTH = CELL_SIZE * BOARD_COLS;   // 280px
const BOARD_HEIGHT = CELL_SIZE * BOARD_ROWS;  // 560px

// score-panel 내부에 초기 HTML 복원 (TetrisApp이 마운트되기 전 보여줄 내용)
// panel-box score-panel 부분:
<div class="panel-box score-panel">
  <div class="score-display">
    SCORE<span class="value" id="score-value">0</span>
    <div style="display:flex;gap:16px;margin-top:4px;">
      <div>LEVEL<span class="value small" id="level-value">1</span></div>
      <div>LINES<span class="value small" id="lines-value">0</span></div>
    </div>
  </div>
</div>
<div class="panel-box">
  <div class="game-buttons">
    <button class="game-btn" id="start-btn">▶ START</button>
    <button class="game-btn pause" id="pause-btn">⏸ PAUSE</button>
  </div>
</div>

완료 후 커밋:
fix(app): play.ts UI 복원 — score 패널 및 버튼 HTML 재추가
```

---

## Fix 2: 자동 왼쪽 이동 버그 (TetrisApp.ts)

### 원인
```js
// setTimeout 클로저가 cleanup 후에도 pressedKeys를 참조
// cleanup이 실행되어 리스너가 제거돼도
// setTimeout 콜백은 150ms 후 pressedKeys.has() 체크 → interval 시작
// 이 interval은 새 cleanup에서 clearInterval되지 않음
```

### 수정

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

src/app/TetrisApp.ts의 키보드 useEffect를 수정해줘.

---

핵심 수정: setTimeout 대신 keydown 시 즉시 interval 시작 방식으로 교체
그리고 cleanup에서 pressedKeys를 반드시 clear

// 기존 (buggy)
const onKeyDown = (e) => {
  pressedKeys.add(e.key);
  setGameState(...);
  const capturedKey = e.key;
  setTimeout(() => {                    // ← cleanup 후에도 실행됨
    if (pressedKeys.has(capturedKey)) {
      moveInterval = setInterval(...);
    }
  }, 150);
};

// 수정 (safe)
const onKeyDown = (e: KeyboardEvent) => {
  // ArrowLeft/Right 외 키에서 preventDefault 제거 (탭 이동 등 방해 방지)
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
    e.preventDefault();
  }

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      if (pressedKeys.has(e.key)) return;  // 중복 keydown 무시
      pressedKeys.add(e.key);
      const dir = e.key === 'ArrowLeft' ? 'left' as const : 'right' as const;

      // 즉시 1회 이동
      setGameState((prev: NotTetrisState) => moveActive(prev, dir));

      // 기존 interval 클리어 후 새로 시작 (150ms 딜레이 없이 바로)
      if (moveInterval) clearInterval(moveInterval);
      moveInterval = null;

      // 250ms 후 연속 이동 시작 (key가 아직 눌려있을 때만)
      // setTimeout 대신 interval + 첫 실행 지연을 counter로 관리
      let delayCounter = 0;
      moveInterval = setInterval(() => {
        delayCounter++;
        if (delayCounter < 5) return;  // 처음 5번(250ms) 무시 → 딜레이 효과
        if (pressedKeys.has(e.key!)) {
          setGameState((prev: NotTetrisState) => moveActive(prev, dir));
        } else {
          clearInterval(moveInterval!);
          moveInterval = null;
        }
      }, 50);
      break;
    }
    case 'ArrowUp':
      setGameState((prev: NotTetrisState) => snapRotate(prev)); break;
    case 'ArrowDown':
      setGameState((prev: NotTetrisState) => softDrop(prev)); break;
    case ' ':
      setGameState((prev: NotTetrisState) => hardDrop(prev)); break;
    case 'q': case 'Q':
      setGameState((prev: NotTetrisState) => applyRotation(prev, 'ccw')); break;
    case 'e': case 'E':
      setGameState((prev: NotTetrisState) => applyRotation(prev, 'cw')); break;
    case 'r': case 'R':
      setGameState((prev: NotTetrisState) => holdPiece(prev)); break;
  }
};

const onKeyUp = (e: KeyboardEvent) => {
  pressedKeys.delete(e.key);
  // 좌우 키 모두 떼면 interval 즉시 중단
  if (!pressedKeys.has('ArrowLeft') && !pressedKeys.has('ArrowRight')) {
    if (moveInterval) { clearInterval(moveInterval); moveInterval = null; }
  }
};

// cleanup: 반드시 pressedKeys 비우기 (setTimeout 클로저 방지)
return () => {
  pressedKeys.clear();                  // ← 핵심 추가
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  if (moveInterval) { clearInterval(moveInterval); moveInterval = null; }
};

완료 후 커밋:
fix(app): 자동 이동 버그 수정 — pressedKeys.clear() + setTimeout 제거
```

---

## Fix 3: 블록 결합 — isLanded 허용 오차 + 렌더링 오버랩

### 원인
`.bak`의 `engine2d.ts`에서 `isLanded` 오차 6px인데
블록이 실제로 닿기 전에 판정되거나, 닿아도 1-2px 공백이 남음.

### 수정

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

두 가지를 수정해줘.

---

수정 1: src/physics/engine2d.ts — isLanded 허용 오차 증가

// 기존
const yTouch = Math.abs(maxY - sMinY) < 6;

// 수정: 허용 오차를 CELL_SIZE의 절반으로
const yTouch = Math.abs(maxY - sMinY) < 14;  // 28px 셀의 50%

---

수정 2: src/physics/renderer.ts — 블록 렌더링 시 1px 확장

블록 사이 시각적 틈을 없애기 위해
drawBody에서 다각형을 1px 확장해서 그림.

function drawBody(ctx, body, isActive) {
  const verts = getWorldVertices(body);
  if (!verts || verts.length < 3) return;

  // 중심 계산
  const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
  const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;

  // 각 꼭짓점을 중심에서 1px 바깥으로 확장 (시각적 틈 제거)
  const EXPAND = 1.2;
  const expandedVerts = verts.map(v => ({
    x: cx + (v.x - cx) * EXPAND,
    y: cy + (v.y - cy) * EXPAND,
  }));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(expandedVerts[0].x, expandedVerts[0].y);
  for (let i = 1; i < expandedVerts.length; i++) {
    ctx.lineTo(expandedVerts[i].x, expandedVerts[i].y);
  }
  ctx.closePath();

  ctx.fillStyle = body.color;
  ctx.fill();

  // active 블록은 테두리 강조
  if (isActive) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

완료 후 커밋:
fix(physics): isLanded 허용 오차 14px + 렌더링 1px 확장으로 블록 결합
```
