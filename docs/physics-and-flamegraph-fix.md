# 물리 + Flamegraph 수정 프롬프트

---

## Fix 1 — 낙하 물리 로직 수정 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

스크린샷 기준 현재 상태 정확한 진단:
- 블록들이 서로 심하게 겹쳐서 쌓임 (충돌 감지가 전혀 동작 안 함)
- 라인 소거 후 파편(above 조각)이 허공에 떠있음
  (직사각형처럼 보이는 건 렌더링 버그가 아니라 파편이 제자리에 고정된 것)
- 초록 블록(I 테트로미노)만 렌더링 끝부분이 투명하게 잘림
- 블록이 착지 즉시 고정되어 사용자가 위치 수정 불가
- 낙하 속도 점점 빨라짐
- 3줄 클리어 후 게임 오버 (너무 이른 게임 오버)

아래 문제들을 순서대로 수정해줘.

---

문제 0 (최우선): 블록들이 서로 완전히 겹침

원인: SAT 충돌 감지가 동작하지 않거나
      resolveCollision이 실제로 위치 보정을 하지 않음

해결:
- checkBodyCollision(a, b)이 실제로 두 다각형 겹침을 감지하는지
  console.log로 먼저 확인
- resolveCollision에서 MTV(minimum translation vector)를 계산해서
  activeBody.position을 겹치지 않는 위치로 반드시 보정
- 보정 방향: SAT에서 가장 얕은 침투축으로 position 밀어내기
- 보정 후 velocity 반전(반발계수 0.2) + 감쇠

단순 테스트:
- 블록 2개를 위아래 배치했을 때
  위 블록이 아래 블록 위에 얹혀야 함
  겹치면 충돌 감지 구현이 잘못된 것

---

문제 1: 낙하 속도가 점점 빨라짐

원인: velocity.y에 매 프레임 중력을 누적하고 있음
해결:
- activeBody.position.y += dropSpeed * dt
- dropSpeed 고정값 (level 1 = 80px/초)
- velocity.y 누적 방식 제거
- 소프트드롭(↓)만 dropSpeed 2배 일시 적용

---

문제 2: 착지 즉시 고정 — Lock Delay 구현

현재: 블록이 바닥/블록에 닿는 순간 isStatic = true
목표: 착지 후 일정 시간(lockDelay) 동안 사용자가 위치/회전 수정 가능

구현:
- FunctionComponent 또는 gameState에 lockTimer 상태 추가
- 착지 감지 시 isStatic = true 대신 lockTimer 시작
- lockDelay = 500ms (0.5초)
- lockTimer 동안:
  - 블록이 착지면에 닿아있지만 고정 안 됨
  - ← → 이동 또는 Q/E/↑ 회전 입력 시 lockTimer 리셋 (최대 5회까지)
  - 키 입력 없이 lockDelay 경과 시 isStatic = true 확정
- 시각 피드백: lockTimer 동안 블록 테두리 깜빡임 또는 색상 변화

---

문제 3: 라인 소거 후 파편이 허공에 떠있음

원인: cutPieceAtLine 후 above 조각이 isStatic = true로 처리됨

해결:
- above 조각: isStatic = false, velocity = {x:0, y:0}으로 초기화
- position.y를 절단선(lineY) 바로 위로 보정
- 이후 정상 중력 적용으로 아래로 낙하

---

문제 4: 초록 블록(I 테트로미노) 렌더링 끝부분 투명하게 잘림

원인: I 블록의 localVertices가 canvas 너비를 벗어나거나
      ctx.clip() 또는 canvas 경계 처리 문제

해결:
- renderer.ts에서 I 블록 그릴 때
  worldVertices 중 canvas 범위 벗어나는 꼭짓점 확인
- ctx.save() → ctx.beginPath() → path 그리기 → ctx.fill() → ctx.restore()
  순서에서 clip 영역이 블록을 자르는지 확인
- canvas에 clip 설정이 있다면 제거하거나 보드 크기에 맞게 조정

---

문제 5: 3줄 클리어 후 게임 오버

해결:
- 게임 오버 조건 엄격화:
  spawn 위치에서 새 블록이 기존 static body와 50% 이상 겹칠 때만 true
- spawn 직후 500ms grace period 동안 게임 오버 체크 유예
- 체크 타이밍: 새 블록 생성 직후에만

---

문제 6: 블록이 기울어진 채로 빈 공간으로 미끄러지지 않음

해결:
- lockTimer 동안(착지 후 고정 전) angularVelocity 남아있으면
  기울기에 따라 좌우 미끄러짐 허용
- isStatic = true 전환 조건:
  1. Math.abs(velocity.y) < 10
  2. Math.abs(angularVelocity) < 0.05
  3. 바닥 또는 static body와 충돌 중
  4. lockTimer 만료

완료 후 테스트하고 커밋:
fix(physics): 충돌 감지, lock delay, 파편 재낙하, I블록 렌더링, 게임 오버 조건 수정
```

---

## Fix 2 — UI 크기 개선 (feat/app)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

아래 두 가지 크기 문제를 수정해줘.

---

문제 1: 테트리스 플레이 창이 너무 작음

수정:
- 게임 보드 Canvas: width 400px → width 480px 이상
- height: 화면 전체 높이에서 탭바(48px)만 빼고 최대화
  height = calc(100vh - 48px)
- 보드 비율은 너비:높이 = 1:2 유지
  (width 480이면 height 960, 화면 넘으면 화면 기준으로 조정)

---

문제 2: Next 미리보기가 너무 작아서 블록 식별 불가

수정:
- NEXT canvas 크기: 기존 80×80px → 140×140px
- HOLD canvas 크기: 동일하게 140×140px
- 블록을 canvas 중앙에 그릴 때 padding 10px 확보
- 블록 색상 + 테두리 명확하게 (stroke 2px)

완료 후 커밋:
style(app): 게임 보드 및 Next/Hold 미리보기 크기 확대
```

---

## Fix 3 — Flamegraph 근본 문제 수정 (feat/flamegraph)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/flamegraph야.

현재 Flamegraph에 2가지 근본적인 문제가 있어.

---

문제 1: GameLoop 하나만 잡히고 Block, Board, Score가 안 잡힘

원인: metricsStore.record()가 FunctionComponent 개별 컴포넌트가
      아니라 게임 루프 전체에서만 호출되고 있음

해결:
- FunctionComponent의 update() 내부에서
  컴포넌트 이름(this.name)과 함께 record() 호출해야 함
- 각 자식 컴포넌트(Board, Block, Score, Preview, HoldPanel)도
  FunctionComponent를 상속하거나 wrapping해서
  각자 렌더링 시 record()가 개별적으로 호출되어야 함
- record() 호출 시 componentName을 반드시 구분해야 함:
  { componentName: 'Block', duration: X, ... }
  { componentName: 'Score', duration: X, ... }

확인: record() 호출 시 componentName이 최소
  TetrisApp, Block, Board, Score, Preview, HoldPanel
  6종류로 구분되어야 함

---

문제 2: 초록 막대 끝부분이 투명하게 잘림

원인: Canvas 너비가 entries 수보다 작아서 마지막 막대가 잘리거나
      ctx.clearRect 범위가 맞지 않음

해결:
- 막대 너비(barWidth)를 entries 수에 따라 동적 계산:
  barWidth = Math.max(2, Math.floor(canvasWidth / maxEntries))
- entries가 canvas 너비를 넘으면 오래된 것부터 잘라서 최신 N개만 표시
- canvas 전체를 ctx.fillRect(0,0,width,height)로 배경 채운 후 막대 그리기
- 마지막 막대가 canvas 경계를 넘지 않도록 x + barWidth <= canvasWidth 체크

---

문제 3: 보는 사람이 뭘 봐야 할지 모름

현재 화면에서 부족한 것:
- 컴포넌트별 행이 구분되어 있지 않음 (GameLoop 하나만 있음)
- "색칠된 칸이 뭔지" 설명이 없음
- 결론 문장이 너무 일반적임 ("Component 분리를 통해 불필요한 렌더링...")

수정:
1. Flamegraph 왼쪽에 컴포넌트명 레이블 추가
   - 각 행 높이 30px
   - 왼쪽 80px: 컴포넌트명 텍스트
   - 오른쪽: 해당 컴포넌트 막대들

2. 상단에 범례 한 줄 추가 (canvas 밖, HTML로)
   "■ 색칠 = 렌더링 발생   □ 빈칸 = 렌더링 없음(최적화)"
   "초록 = 빠름  주황 = 보통  노랑 = 느림"

3. 결론 문장을 데이터 기반으로 자동 생성:
   - Block 렌더링 횟수 vs Score 렌더링 횟수 비교
   - 예: "블록이 500번 움직이는 동안 Score는 8번만 렌더링됐습니다 (98% 절감)"
   - 이 문장을 핵심 인사이트 섹션 첫 줄에 굵게 표시

한글 주석 필수.

완료 후 커밋:
fix(metrics): 컴포넌트별 개별 record 수정 + canvas 렌더링 버그 + 범례 추가
```
