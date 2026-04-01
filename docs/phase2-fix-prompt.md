# Phase 2 수정 프롬프트

> 스크린샷 기준 현재 상태 반영
> 물리 엔진 개선 + Why/Flamegraph/학습 패널 UI 전면 개편

---

## Fix 1 — 파편 고정 + 회전 물리 개선 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

스크린샷에서 확인된 2가지 문제를 수정해줘.

---

문제 1: 라인 소거 후 파편이 허공에 고정되어 공간을 막음

현재 증상:
- 라인이 소거된 후 위 조각(above fragment)이
  허공에 isStatic = true 상태로 떠있음
- 아래 블록들은 정상적으로 쌓이는데 파편이 보이지 않는 벽처럼 작동

수정:
- clearFullLines 실행 후 남은 모든 above 조각은
  반드시 isStatic = false, velocity = {x:0, y:0}로 초기화
- 단순히 flag만 바꾸는 게 아니라 nextTick 루프에서
  isStatic = false인 조각들도 activeBody와 동일하게
  중력 + 충돌 처리를 받아야 함
- 구현 방법: bodies 배열을 static/dynamic으로 분리
  - staticBodies: 완전히 착지 확정된 블록들
  - dynamicBodies: 파편 포함 아직 낙하 중인 블록들
  - nextTick에서 dynamicBodies 전체에 물리 적용

---

문제 2: 회전 시 가속도 누적 + 기운 상태로 멈춤

현재 증상:
- Q/E 키를 누를 때마다 angularVelocity가 계속 누적되어
  점점 빠르게 회전함 (가속도 느낌)
- 회전 후 기운 각도(예: 45도)에서 그냥 멈춤
  → 기운 상태에서도 중력이 계속 작용해서 아래로 떨어져야 함

수정 방향:

A. 회전 속도 누적 제거
- Q/E 키 입력 시 angularVelocity를 더하는 게 아니라
  고정값으로 설정:
  Q: angularVelocity = -2.0 (반시계, 라디안/초)
  E: angularVelocity = +2.0 (시계, 라디안/초)
- 키를 계속 누르고 있어도 동일한 속도 유지 (누적 X)
- 키를 떼면 angularVelocity에 감쇠 적용 (*= 0.85/프레임)
  → 자연스럽게 회전이 멈춤

B. 기운 상태에서 중력 계속 작용
- isStatic = true 조건에서 angle 조건 제거
- 블록이 기울어져 있어도 바닥/블록에 충분히 안정되면 착지
- 착지 판정: velocity.y < 5 AND 바닥/블록과 접촉 중
  (angularVelocity 조건 제거 — 기울어진 채로도 착지 가능)
- 착지 후 angularVelocity가 남아있으면
  블록이 기울어진 방향으로 살짝 미끄러지다 멈춤

완료 후 커밋:
fix(physics): 파편 재낙하 동적 처리 + 회전 속도 고정 + 기운 채로 착지 허용
```

---

## Fix 2 — Why / Flamegraph / 학습 패널 UI 전면 개편 (feat/app)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

현재 Why, Flamegraph, 학습 패널 공통 문제:
1. 글씨가 너무 작음
2. 카드가 중앙에 몰려있고 양옆 여백이 너무 넓음
3. 회색 글씨 사용 → 흰색으로 교체
4. 전체 너비를 충분히 활용하지 못함

아래 공통 CSS 규칙을 style.css에 추가하고
각 탭 파일을 수정해줘.

---

공통 CSS 수정:

/* 패널 공통 */
.panel-content {
  width: 100%;
  max-width: 100%;          /* 기존 max-width 제한 제거 */
  padding: 32px 48px;       /* 양옆 여백 확보 */
  box-sizing: border-box;
  color: #ffffff;           /* 회색 → 흰색 */
}

/* 섹션 제목 */
.section-title {
  font-size: 24px;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 16px;
}

/* 본문 텍스트 */
.body-text {
  font-size: 16px;
  line-height: 1.7;
  color: #ffffff;           /* #666, #888 등 회색 전부 #ffffff로 */
}

/* 강조 텍스트 */
.highlight-text {
  font-size: 18px;
  color: #00ff88;
  font-weight: bold;
}

/* 카드 */
.card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 24px;
  width: 100%;              /* 너비 꽉 채우기 */
}

---

Tab 2 (Why Tetris) 수정:

레이아웃: 카드 중앙 집중 → 좌우 2컬럼 전체 너비 활용

┌─────────────────────────────────────────────────────┐
│  왜 물리 테트리스인가?                                │  font-size: 28px
├──────────────────────┬──────────────────────────────┤
│  일반 테트리스        │  물리 테트리스               │
│  font-size: 16px     │  font-size: 16px             │
│  흰색 텍스트         │  흰색 텍스트                 │
│  좌우 각 50% 너비    │  강조색(#00ff88)으로 포인트  │
├──────────────────────┴──────────────────────────────┤
│  컴포넌트 트리 시각화  (전체 너비)                    │
│  font-size: 15px, 흰색                              │
├─────────────────────────────────────────────────────┤
│  라인 클리어 시연  (전체 너비)                        │
└─────────────────────────────────────────────────────┘

---

Tab 3 (Flamegraph) 수정:

- 범례 박스: font-size 15px, 흰색 텍스트
- Flamegraph canvas: 전체 너비(padding 제외) 사용
- 바 차트: 전체 너비 사용, font-size 15px, 흰색
- 결론 문장: font-size 20px, 흰색, bold

---

Tab 4 (학습) 수정:

레이아웃: 좌우 2컬럼 (Hook 배치 | 발견한 문제들)

┌──────────────────────┬──────────────────────────────┐
│  Hook 배치           │  개발하며 발견한 문제들       │
│  font-size: 15px     │  font-size: 15px             │
│  흰색                │  흰색                        │
├──────────────────────┴──────────────────────────────┤
│  실제 React와 비교  (전체 너비)                       │
│                                                     │
│  우리 구현체          실제 React 대응   소스 링크     │
│  ─────────────────────────────────────────────────  │
│  FunctionComponent   함수형 컴포넌트                 │
│  hooks[]+hookIndex   Fiber.memoizedState   [🔗 링크] │
│  mount()/update()    Reconciler            [🔗 링크] │
│  Batching            automatic batching    [🔗 링크] │
│  useEffect cleanup   componentWillUnmount  [🔗 링크] │
│  Fiber 스케줄러      Fiber 우선순위 큐     [🔗 링크] │
└─────────────────────────────────────────────────────┘

React 공식 GitHub 링크 (실제 URL 사용):
- Fiber.memoizedState:
  https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberHooks.js
- Reconciler:
  https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberBeginWork.js
- commitWork (Patch 대응):
  https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberCommitWork.js
- automatic batching:
  https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js
- Fiber 스케줄러:
  https://github.com/facebook/react/blob/main/packages/scheduler/src/forks/Scheduler.js

링크 스타일:
- 텍스트: "GitHub →"
- 색상: #4ecdc4 (청록)
- hover 시 밑줄
- target="_blank" rel="noopener"

완료 후 커밋:
style(app): Why/Flamegraph/학습 패널 전체 너비 + 흰색 텍스트 + React 소스 링크
```

---

## 수정 순서

```
Fix 1 (feat/physics) → 테스트 확인 → PR → dev merge
Fix 2 (feat/app)     → 테스트 확인 → PR → dev merge
```
