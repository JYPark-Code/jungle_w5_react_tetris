# 착지 + 점수 최종 수정 프롬프트

> 브랜치: feat/app

---

## 원인 추적

```
resolveBodyCollisions: 충돌 시 블록을 0.4 * depth(px) 위로 밀어냄
checkLanding:          1px 아래 예측 → depth가 2.5px 이상이면 감지 실패

예시:
  depth = 3px → 보정 = 1.2px 위로
  checkLanding testPos = position + 1px
  = 1.2px 위에서 1px 아래 = 0.2px 위 → 충돌 없음 → landed = false
  → lockTimer = 0 리셋 → 무한 반복 → 블록 영원히 고정 안 됨
```

---

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

아래 수정을 적용해줘. 한글 주석 필수.

===================================================
수정 1: src/physics/engine.ts — checkLanding 예측 거리 증가
===================================================

// 기존
const testPos: Vec2 = { x: body.position.x, y: body.position.y + 1 };

// 수정: resolveBodyCollisions 보정값(0.4 * depth)보다 커야 안정적으로 감지
// depth 최대 ~5px 가정 → 보정 최대 2px → 3px 여유 충분
const testPos: Vec2 = { x: body.position.x, y: body.position.y + 3 };

===================================================
수정 2: src/physics/gameState.ts — lockTimer 리셋 제거
===================================================

// 기존: landed=false이면 lockTimer를 0으로 리셋
} else {
  lockTimer = 0;  // ← 이 리셋이 문제
}

// 수정: lockTimer가 한번 시작되면 landed 여부와 무관하게 계속 카운트다운
// (충돌 보정으로 순간적으로 떠도 타이머 유지)
} // else 블록 전체 삭제 — lockTimer 리셋 없음

// 단, 새 블록 생성 시 lockTimer는 0으로 초기화됨 (기존 코드에 이미 있음)

===================================================
수정 3: 착지 확인 콘솔 로그 임시 추가 (동작 확인용)
===================================================

lockTimer <= 0 블록 고정 직전에:
console.log('[Lock]', 'score:', score, 'lines:', linesCleared);

완료 후 커밋:
fix(physics): checkLanding 3px 예측 + lockTimer 리셋 제거로 착지/점수 수정
```
