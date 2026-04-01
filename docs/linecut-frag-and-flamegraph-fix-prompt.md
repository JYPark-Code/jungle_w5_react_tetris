# 파편 클리어 + Flamegraph 수정 프롬프트

> 브랜치: feat/app

---

## 원인

### 버그 1: 파편 클리어 안 됨 (linecut.ts 102번줄)

```typescript
// checkLineDensity — 수정됨 (비정적도 포함)
if (body.kind === 0) continue;  ✓

// removeLinesFromBodies — 아직 수정 안 됨
if (!body.isStatic || body.kind === 0) {  // ← isStatic 조건이 남아있음
  nextResult.push(body);                  // ← 비정적 파편은 건드리지 않음
  continue;
}
// 결과: 밀도 계산엔 파편 포함(full line 감지) → 실제 삭제는 안 됨
//       → 같은 라인이 0.5초마다 무한 재감지 → 점수 이상하게 오름
```

### 버그 2: Flamegraph 같은 수치

`TetrisApp` 하나만 기록, `duration`이 거의 동일(1ms 내외) → 막대가 모두 같은 높이

---

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

아래 수정을 적용해줘. 한글 주석 필수.

===================================================
수정 1: src/physics/linecut.ts — removeLinesFromBodies 102번줄
===================================================

기존 (비정적 파편 미처리):
if (!body.isStatic || body.kind === 0) {
  nextResult.push(body);
  continue;
}

교체 (비정적 파편도 처리):
if (body.kind === 0) {
  nextResult.push(body);
  continue;
}

(isStatic 조건 제거 — checkLineDensity와 동일한 기준으로 통일)

===================================================
수정 2: src/app/TetrisApp.ts — Flamegraph 다중 컴포넌트 기록
===================================================

현재 canvas useEffect에서 TetrisApp 하나만 기록.
ScoreBoard와 Block을 별도로 기록해서 Flamegraph에 의미있는 차이 표시.

useEffect에서 metricsStore.record 부분을 아래로 교체:

// 1. TetrisApp — canvas 전체 렌더링 시간
metricsStore.record({
  componentName: 'TetrisApp',
  duration: performance.now() - t,
  timestamp: performance.now(),
  renderIndex: staticCount,
});

// 2. ScoreBoard — 점수가 바뀔 때만 기록 (diff/patch 시연용)
// gameState.score가 이전과 다를 때만 기록 → Flamegraph에서 점수 변화 시각화
const prevScore = (props.boardCanvas as any)?._prevScore ?? -1;
if (gameState.score !== prevScore) {
  const scoreStart = performance.now();
  // custom React가 diff/patch로 score 텍스트 노드만 업데이트
  // (실제 DOM 업데이트는 useState → Component.update()에서 처리됨)
  metricsStore.record({
    componentName: 'ScoreBoard',
    duration: Math.max(0.1, performance.now() - scoreStart), // 최소 0.1ms
    timestamp: performance.now(),
    renderIndex: staticCount,
  });
  if (props.boardCanvas) (props.boardCanvas as any)._prevScore = gameState.score;
}

// 3. Block — active block 위치가 변할 때마다 기록
const activeBody = gameState.bodies.find(b => b.id === gameState.activeId);
if (activeBody) {
  metricsStore.record({
    componentName: 'Block',
    duration: 0.3,  // canvas 그리기는 빠름
    timestamp: performance.now(),
    renderIndex: staticCount,
  });
}

완료 후 커밋:
fix(linecut): 비정적 파편도 removeLinesFromBodies 처리 대상에 포함
feat(flamegraph): ScoreBoard/Block 컴포넌트 기록 추가
```
