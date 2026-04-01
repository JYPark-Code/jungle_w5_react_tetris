# 파편 낙하 + 점수 계산 수정 프롬프트

> 브랜치: feat/app

---

## 원인 분석

### 버그 1: 파편이 안 내려옴

```typescript
// gameState.ts — 현재 (문제)
if (state.clearCooldown > 0) {
  return { ...state, clearCooldown: state.clearCooldown - safeDt };
  // ↑ 물리 전체 skip → 파편도 공중에 0.5초 정지
}
```

### 버그 2: 점수 0

```typescript
// linecut.ts — checkLineDensity 현재 (문제)
if (!body.isStatic || body.kind === 0) continue;
// ↑ 파편(isStatic=false) 제외 → full line이어도 밀도 계산 안 됨
```

---

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

아래 2개 파일을 수정해줘. 한글 주석 필수.

===================================================
수정 1: src/physics/gameState.ts
===================================================

clearCooldown 중에도 파편 physics는 계속 실행.
active body만 대기(스폰 위치에서 고정).

기존:
if (state.clearCooldown > 0) {
  return { ...state, clearCooldown: state.clearCooldown - safeDt };
}

교체:
if (state.clearCooldown > 0) {
  // 쿨다운 중에도 파편(non-active) 낙하 물리 계속 실행
  let bodies = state.bodies.map(b =>
    b.id === state.activeId ? b : applyGravity(b)
  );
  bodies = bodies.map(b =>
    b.id === state.activeId ? b : integratePosition(b)
  );
  bodies = resolveBodyCollisions(bodies);
  bodies = bodies.map(b =>
    b.id === state.activeId ? b : applyWallConstraints(b)
  );

  // 파편 착지 → isStatic 전환
  const statics = bodies.filter(b => b.isStatic);
  bodies = bodies.map(b => {
    if (b.isStatic || b.id === state.activeId) return b;
    if (checkLanding(b, statics)) {
      return { ...b, isStatic: true, velocity: { x: 0, y: 0 }, angularVelocity: 0 };
    }
    return b;
  });

  return {
    ...state,
    bodies,
    clearCooldown: state.clearCooldown - safeDt,
  };
}

===================================================
수정 2: src/physics/linecut.ts — checkLineDensity
===================================================

기존:
if (!body.isStatic || body.kind === 0) continue;

교체 (isStatic 조건 제거):
if (body.kind === 0) continue;

완료 후 커밋:
fix(physics): 쿨다운 중 파편 낙하 + isStatic 무관 밀도 계산으로 점수 수정
```
