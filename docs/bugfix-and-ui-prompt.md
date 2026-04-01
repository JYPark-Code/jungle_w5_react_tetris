# 버그 수정 + UI 개선 프롬프트

> 현재 발견된 치명적 버그 + UI 문제 + Flamegraph 개선을 순서대로 처리합니다.
> 브랜치: feat/physics (버그), feat/app (UI + Flamegraph)

---

## Step 1 — 치명적 버그 수정 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

지금 게임에 치명적인 버그가 3가지 있어. 순서대로 수정해줘.

---

버그 1: 빈 공간에서 블록이 멈추지 않음

원인 추정:
- checkBodyCollision이 static body와의 충돌만 체크하고
  실제 착지 조건(속도가 충분히 작아졌을 때)을 제대로 처리 못 함
- 또는 resolveCollision 후에도 isStatic = true 전환이 안 됨

수정 방향:
- nextTick에서 activeBody가 static body와 충돌 후
  velocity.y < 5 && angularVelocity < 0.1 이면 isStatic = true
- 바닥과 충돌 시에도 동일하게 isStatic = true
- isStatic = true가 된 프레임에서 즉시 bodies 배열에 추가하고
  새 activeBody 생성

---

버그 2: 블록 하나 착지 시 게임 오버

원인 추정:
- 게임 오버 체크가 너무 이른 시점에 실행됨
- spawn 위치(보드 상단)가 너무 좁게 설정되어 있음
- 또는 새 블록 생성 시 기존 블록과의 충돌을 게임 오버로 잘못 판정

수정 방향:
- 게임 오버 조건: 새로 생성된 activeBody가
  spawn 위치에서 이미 static body와 완전히 겹칠 때만 true
- 단순히 spawn Y 좌표에 블록이 있다고 게임 오버가 아님
- checkBodyCollision 결과가 true여도 penetration depth가
  블록 높이의 50% 미만이면 게임 오버 아님

---

버그 3: 충돌 감지 전반 검토

nextTick 실행 순서를 아래와 같이 명확히 고쳐줘:

1. dt 계산 (최대 0.05로 클램핑 — 탭 전환 후 큰 dt 방지)
2. activeBody에 중력 적용 (applyGravity)
3. 벽/바닥 충돌 체크 (checkWallCollision)
4. static bodies와 SAT 충돌 체크
5. 충돌 시 위치 보정 + 속도 감쇠
6. 착지 조건 체크 → isStatic 전환
7. isStatic이면 bodies에 추가 + 새 activeBody 생성
8. 라인 클리어 체크
9. 게임 오버 체크 (새 블록 생성 후에만)

dt 클램핑이 중요해:
const safeDt = Math.min(dt, 0.05);

완료 후 테스트 실행하고 커밋:
fix(physics): 착지 조건, 게임 오버, 충돌 감지 버그 수정
```

---

## Step 2 — UI 레이아웃 개선 (feat/app)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

현재 UI 문제:
1. 게임 화면이 너무 작음
2. 폰트가 너무 작음
3. 전체 레이아웃이 어색함

src/app/style.css와 tabs/play.ts를 수정해줘.

---

레이아웃 목표:

전체 화면을 꽉 채우는 구조 (100vw × 100vh):

┌─────────────────────────────────────────────────┐
│  [🎮Play] [🧩Why] [📊Flame] [⚙️학습] [💻Code]   │  48px 높이 탭 바
├────────────────────────┬────────────────────────┤
│                        │  HOLD        NEXT      │
│                        │  [ 블록 ]    [ 블록 ]  │
│    TETRIS BOARD        │                        │
│    Canvas              │  ────────────────────  │
│    (보드 세로:          │  SCORE                 │
│     화면 높이 - 탭바)  │  000000                │
│                        │  LEVEL  LINES          │
│                        │  01     000            │
│                        │  ────────────────────  │
│                        │  [▶ START]             │
│                        │  [⏸ PAUSE]            │
│                        │  ────────────────────  │
│                        │  ← → : 이동            │
│                        │  ↑   : 90도 회전       │
│                        │  Q/E : 자유 회전        │
│                        │  ↓   : 소프트 드롭      │
│                        │  SPC : 하드 드롭        │
│                        │  R   : 보관            │
└────────────────────────┴────────────────────────┘

CSS 수치:
- 탭 바: height 48px, font-size 16px
- 게임 보드: 캔버스 width 360px, height calc(100vh - 48px)
- 사이드 패널: width 240px, padding 20px
- SCORE 숫자: font-size 36px, font-weight bold
- LEVEL/LINES 숫자: font-size 24px
- 조작 안내: font-size 14px
- HOLD/NEXT 블록: 80×80px canvas

다크 테마:
- 배경: #0d0d0d
- 보드 테두리: #333
- 탭 바: #1a1a1a
- 탭 활성: #ffffff, 비활성: #666
- 텍스트: #ffffff
- SCORE: #00ff88 (초록 강조)

완료 후 커밋:
style(app): 게임 UI 레이아웃 및 폰트 크기 개선
```

---

## Step 3 — Flamegraph 실시간 + 정보 보강 (feat/flamegraph)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/flamegraph야.

현재 Flamegraph 패널 문제:
1. 게임 실행 중인지 끝난 후인지 불명확
2. 하나의 메트릭만 있어서 보는 사람이 뭘 봐야 할지 모름
3. 시각적으로 의미를 전달하지 못함

src/metrics/flamegraph.ts를 아래와 같이 개선해줘.

---

구조 변경: 3개 구역으로 분리

┌──────────────────────────────────────────────────┐
│  📊 렌더링 메트릭  [● LIVE]   [일시정지] [초기화]  │
├──────────────────────────────────────────────────┤
│  구역 1: Flamegraph (위쪽 60%)                    │
│                                                  │
│  commit →  1   2   3   4   5  6  7  8  ...       │
│  TetrisApp ████████████████████████████          │
│  Block     ████████████████████████████          │  ← 매 프레임
│  Board     ██              ██                    │  ← 착지 시만
│  Score                     ██        ██          │  ← 점수 변경 시만
│  Preview   ████                  ████            │
│  Hold              ████                          │
│                                                  │
│  노란색(>16ms) 주황(8~16ms) 초록(<8ms) 회색(0ms)  │
│                                                  │
├──────────────────────────────────────────────────┤
│  구역 2: 컴포넌트별 렌더링 횟수 바 차트 (가운데 20%)│
│                                                  │
│  Block     ████████████████████ 847회            │
│  TetrisApp ████████████████████ 847회            │
│  Board     ████                  43회            │
│  Preview   ██                    12회            │
│  Score     █                      8회            │
│  Hold      █                      3회            │
│                                                  │
│  → "Block이 전체 렌더링의 XX%를 차지합니다"        │
│                                                  │
├──────────────────────────────────────────────────┤
│  구역 3: 핵심 인사이트 텍스트 (아래 20%)           │
│                                                  │
│  🟢 평균 렌더링: 2.3ms   🔴 최대: 18.4ms         │
│  📦 총 commit: 847회     ⏱ 게임 시간: 00:32      │
│                                                  │
│  "Block 컴포넌트만 매 프레임 렌더링됩니다.         │
│   Score는 점수가 바뀔 때만 렌더링됩니다.           │
│   이것이 Component 분리의 이유입니다."             │
└──────────────────────────────────────────────────┘

구현 요구사항:

1. [● LIVE] 인디케이터
   - 게임 실행 중이면 빨간 점 깜빡임 + "LIVE" 텍스트
   - 게임 멈추면 회색 "PAUSED"

2. Flamegraph 색상 기준
   - 초록(#4ecdc4): duration < 8ms
   - 주황(#ff9f43): duration 8~16ms
   - 노란(#ffe66d): duration > 16ms (프레임 드롭 위험)
   - 회색(#333): 해당 commit에서 렌더링 안 됨

3. 바 차트
   - 최대값 기준으로 상대적 너비 계산
   - 횟수 숫자 우측 표시
   - 비율 텍스트 "(전체의 XX%)" 포함

4. 핵심 인사이트 텍스트
   - 게임 중 실시간으로 업데이트
   - 통계가 쌓이면서 문장이 자동 생성됨

5. Tab 1(게임)과 실시간 연동 구조
   - Tab 1에서 FunctionComponent.update() 호출 시
     → record(entry) 자동 호출
   - Tab 3으로 탭 전환해도 실시간 반영 유지
   - 전역 metricsStore에 데이터 누적

한글 주석 필수.

완료 후 커밋:
feat(metrics): Flamegraph 실시간 연동 + 3구역 구조로 개선
```

---

## Step 4 — Tab 1과 Flamegraph 실시간 연동 (feat/app)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.
dev merge 먼저 해줘: git merge dev

FunctionComponent가 렌더링할 때마다
자동으로 Flamegraph에 기록되도록 연동해야 해.

src/app/metricsStore.ts 파일을 새로 만들어줘:

// 전역 메트릭 저장소 (싱글톤)
const metricsStore = {
  entries: [] as FlamegraphEntry[],
  listeners: [] as ((entries: FlamegraphEntry[]) => void)[],

  record(entry: FlamegraphEntry) {
    this.entries.push(entry);
    // 최대 500개 유지 (메모리 관리)
    if (this.entries.length > 500) {
      this.entries = this.entries.slice(-500);
    }
    this.listeners.forEach(fn => fn(this.entries));
  },

  subscribe(fn: (entries: FlamegraphEntry[]) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }
};

FunctionComponent의 update() 호출 시:
const start = performance.now();
// ... 렌더링
const duration = performance.now() - start;
metricsStore.record({
  componentName: this.name,
  duration,
  timestamp: performance.now(),
  renderIndex: this.renderCount++,
});

Tab 3 Flamegraph 패널은 metricsStore.subscribe로
새 entry 올 때마다 자동으로 canvas 업데이트.

탭이 바뀌어도 metricsStore는 전역이라 데이터 유지됨.

완료 후 커밋:
feat(app): metricsStore로 게임-Flamegraph 실시간 연동
```
