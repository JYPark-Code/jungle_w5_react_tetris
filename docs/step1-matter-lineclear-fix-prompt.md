# Step 1: Matter.js 라인 클리어 버그 수정

> activeBody가 라인 클리어에 포함되지 않는 버그
> 브랜치: feat/physics

---

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/matterLinecut.ts의 removeLine에서
activeBody가 라인 클리어에서 제외되는 버그를 수정해줘.

---

문제:
checkLineDensity: isActive 체크 없음 → activeBody 포함 계산 → 라인 풀 판정
removeLine:       !(b as any).isActive → activeBody 제외 → 기존 블록만 삭제

수정:
// 기존 (잘못됨)
.filter(b => !b.isStatic && (b as any).kind && !(b as any).isActive);

// 수정 (activeBody도 클리어 대상)
.filter(b => !b.isStatic && (b as any).kind);

---

그리고 matterState.ts의 updateMatter에서
removeLine 실행 후 activeBody가 world에서 제거됐는지 확인하고
없으면 새 블록을 스폰하는 로직 추가:

if (linesToClear.length > 0 && !state.isCutting) {
  for (const lineNo of linesToClear) {
    removeLine(state.engine, lineNo, CELL_SIZE);
  }

  // activeBody가 클리어로 제거됐는지 확인
  const stillInWorld = state.activeBody &&
    Matter.Composite.allBodies(state.engine.world)
      .some(b => b === state.activeBody || b === state.activeBody?.parent);

  const newActive = stillInWorld
    ? state.activeBody
    : createTetromino(state.engine, state.nextKind, BOARD_WIDTH / 2, CELL_SIZE * 1.5);

  const newNextKind = stillInWorld
    ? state.nextKind
    : Math.ceil(Math.random() * 7);

  const scoreAdd = calcScore(linesToClear.length, lineAreas, linesToClear, state.level);

  newState = {
    ...newState,
    activeBody: newActive,
    nextKind: newNextKind,
    score: state.score + scoreAdd,
    linesCleared: state.linesCleared + linesToClear.length,
    level: Math.floor((state.linesCleared + linesToClear.length) / 10) + 1,
    isCutting: true,
    cuttingTimer: 1.5,
  };
}

한글 주석 필수.

완료 후 커밋:
fix(physics): activeBody도 라인 클리어 포함
```
