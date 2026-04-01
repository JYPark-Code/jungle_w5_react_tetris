# 학습 패널 리디자인 프롬프트

> Why 패널과 동일한 스크롤 섹션 스타일 적용
> 내용은 기존 유지 + React GitHub 소스 링크 추가
> 브랜치: feat/app

---

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

tabs/lifecycle.ts를 Why 패널(tabs/why.ts)과
동일한 스크롤 섹션 스타일로 전면 개편해줘.

---

공통 구현 방식 (why.ts와 동일):
- 각 섹션 높이: 100vh
- scroll-snap-type: y mandatory
- scroll-snap-align: start
- IntersectionObserver로 섹션 진입 시 애니메이션 시작
- 배경: #0d0d0d, 텍스트: #ffffff (회색 금지)
- 섹션 간 padding: 0 80px (양옆 충분히)

---

## 섹션 0: 인트로

레이아웃: 중앙 정렬

┌─────────────────────────────────────────────┐
│                                             │
│         우리가 개발하며 발견한 것들           │  font-size: 36px
│                                             │
│  "구현하다 보니 이런 문제가 생겼고,           │  font-size: 20px
│   그걸 해결하기 위해 이 기능을 추가했습니다"  │  흰색
│                                             │
│  [아래로 스크롤 ↓]                           │
│                                             │
└─────────────────────────────────────────────┘

---

## 섹션 1: Hook 배치

레이아웃: 좌(제목+설명) - 우(코드 블록) 2컬럼

┌──────────────────────┬──────────────────────────┐
│                      │                          │
│  Hook을 게임에        │  // 실제 App.ts 코드     │
│  어떻게 배치했나?     │  const [state, setState] │
│                      │  = useState(initState()) │
│  useState            │                          │
│  → 게임 전체 상태     │  useEffect(() => {       │
│  → 다음 블록         │    const id =            │
│  → 보관 블록(1개)    │    requestAnimationFrame │
│                      │    (gameLoop);           │
│  useEffect           │    return () =>          │
│  → 게임 루프 시작    │    cancelAnimationFrame  │
│  → 키보드 이벤트     │    (id);                 │
│  → cleanup → 해제   │  }, []);                 │
│                      │                          │
│  useMemo             │  const collision =       │
│  → 충돌 캐싱        │  useMemo(() =>           │
│                      │    calcCollision(state), │
│  Batching            │    [state.activeBody]    │
│  → setState 묶기    │  );                      │
│                      │                          │
└──────────────────────┴──────────────────────────┘

코드 블록 스타일:
- 배경: #1a1a2e
- 폰트: Consolas monospace 14px
- 흰색 텍스트

---

## 섹션 2~6: 발견한 문제들 (문제 1개당 섹션 1개)

레이아웃: 좌(시각 요소) - 우(설명) 2컬럼
Why 패널의 각 섹션과 동일한 구조

### 섹션 2: 문제 1 — Batching

┌──────────────────────┬──────────────────────────┐
│  before / after      │  🔴 문제 1               │
│  카운터 시각화        │                          │
│                      │  블록 이동 시 버벅임      │  font-size: 24px
│  [Batching OFF]      │                          │
│  setState 3번        │  원인:                   │
│  → 렌더링 3번        │  이동(x) + 중력(y) +     │
│  카운터: 3           │  회전(angle)을 각각       │
│                      │  setState로 호출          │
│  [Batching ON]       │  → 렌더링 3회            │
│  setState 3번        │                          │
│  → 렌더링 1번        │  해결:                   │
│  카운터: 1           │  Batching으로 묶어서      │
│                      │  렌더링 1회로 처리        │
└──────────────────────┴──────────────────────────┘

시각화: 두 개의 카운터 박스 (OFF/ON) 애니메이션

### 섹션 3: 문제 2 — useEffect cleanup

┌──────────────────────┬──────────────────────────┐
│  Canvas 애니메이션    │  🔴 문제 2               │
│                      │                          │
│  [재시작] 버튼 클릭  │  게임 재시작 시           │
│  → 루프가 2개        │  루프 중복 실행           │
│  → 블록 2배 속도     │                          │
│                      │  원인:                   │
│  cleanup 추가 후      │  useEffect cleanup       │
│  [재시작] 버튼 클릭  │  미구현 →                │
│  → 루프 1개          │  이전 루프가 계속 실행   │
│  → 정상 속도         │                          │
│                      │  해결:                   │
│                      │  return () =>            │
│                      │  cancelAnimationFrame    │
└──────────────────────┴──────────────────────────┘

### 섹션 4: 문제 3 — useMemo

┌──────────────────────┬──────────────────────────┐
│  충돌 계산 카운터     │  🔴 문제 3               │
│  실시간 표시         │                          │
│                      │  60fps 충돌 과부하        │
│  useMemo OFF:        │                          │
│  계산 847회/초       │  원인:                   │
│  (빨간색 숫자)       │  매 프레임 모든 블록      │
│                      │  충돌 재계산             │
│  useMemo ON:         │                          │
│  계산 43회/초        │  해결:                   │
│  (초록색 숫자)       │  useMemo로 deps 변경      │
│                      │  시에만 재계산            │
└──────────────────────┴──────────────────────────┘

### 섹션 5: 문제 4 — hooks 순서

┌──────────────────────┬──────────────────────────┐
│  hooks[] 배열 시각화  │  🔴 문제 4               │
│                      │                          │
│  올바른 순서:         │  hooks[] 순서 꼬임       │
│  hooks[0] useState  │                          │
│  hooks[1] useEffect │  원인:                   │
│  hooks[2] useMemo   │  hookIndex 초기화 누락    │
│  → 게임 정상 작동    │                          │
│                      │  해결:                   │
│  잘못된 순서:         │  mount/update 시         │
│  hooks[0] useEffect │  hookIndex = 0 리셋      │
│  hooks[1] useState  │                          │
│  → 상태 오염 발생    │  "함수가 매번 실행돼도    │
│                      │  상태 유지되는 이유"      │
└──────────────────────┴──────────────────────────┘

hooks[] 배열 시각화: 색상 박스로 각 훅 표시

### 섹션 6: 문제 5 — Fiber 스케줄러

┌──────────────────────┬──────────────────────────┐
│  우선순위 큐 시각화   │  🔴 문제 5               │
│                      │                          │
│  Batching만:         │  게임 루프와 UI 경쟁      │
│  키입력 → 대기       │                          │
│  UI업데이트 → 대기   │  원인:                   │
│  메트릭 → 대기       │  BatchScheduler가 모든    │
│  (순서 보장 없음)    │  setState를 동일 우선순위 │
│                      │  로 처리                 │
│  Fiber 스케줄러:     │                          │
│  🔴 urgent: 키입력  │  해결:                   │
│  🟡 normal: UI      │  Fiber 스케줄러 도입      │
│  ⚪ idle: 메트릭    │  urgent > normal > idle  │
└──────────────────────┴──────────────────────────┘

---

## 섹션 7: 실제 React와 비교

레이아웃: 전체 너비 테이블

┌─────────────────────────────────────────────────────────────┐
│  우리가 겪은 문제가 React가 이 기능을 만든 이유였습니다       │
│  font-size: 28px, 흰색                                       │
├──────────────────┬────────────────────┬─────────────────────┤
│  우리 구현체      │  실제 React 대응   │  소스 링크          │
├──────────────────┼────────────────────┼─────────────────────┤
│ FunctionComponent│ 함수형 컴포넌트    │                     │
│ hooks[]+hookIndex│ Fiber.memoizedState│ [GitHub →]          │
│ mount()/update() │ Reconciler         │ [GitHub →]          │
│ Batching         │ automatic batching │ [GitHub →]          │
│ useEffect cleanup│ componentWillUnmount│[GitHub →]          │
│ Fiber 스케줄러   │ Fiber 우선순위 큐  │ [GitHub →]          │
└──────────────────┴────────────────────┴─────────────────────┘

링크 URL (직접 삽입):
- Fiber.memoizedState:
  https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberHooks.js
- Reconciler:
  https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberBeginWork.js
- automatic batching:
  https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js
- componentWillUnmount (cleanup):
  https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberCommitWork.js
- Fiber 스케줄러:
  https://github.com/facebook/react/blob/main/packages/scheduler/src/forks/Scheduler.js

링크 스타일:
- 텍스트: "GitHub →"
- 색상: #4ecdc4
- font-size: 14px
- target="_blank" rel="noopener"
- hover 시 밑줄

---

## 구현 공통 사항

Why 패널과 완전히 동일한 방식:

// 각 섹션 컨테이너
.learning-panel {
  height: 100%;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
}

.learning-section {
  height: 100vh;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  padding: 0 80px;
  box-sizing: border-box;
  color: #ffffff;
}

// IntersectionObserver로 섹션 진입 시 fade-in
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // 섹션별 애니메이션 시작
      }
    });
  },
  { threshold: 0.3 }
);

한글 주석 필수.

완료 후 커밋:
feat(app): 학습 패널 Why 패널 동일 스크롤 스타일로 개편 + React 소스 링크
```
