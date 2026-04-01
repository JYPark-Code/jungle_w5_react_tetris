# Claude Code CLI 프롬프트 가이드

> 지용님 전용 단계별 작업 프롬프트입니다.
> Claude Code CLI에서 순서대로 실행하세요.

---

## 사전 작업 — 브랜치 셋업

> 터미널에서 직접 실행하세요.

```bash
# dev 브랜치 기준으로 시작
git checkout dev

# 기존 feat/physics-flamegraph 브랜치가 있다면 삭제
git branch -d feat/physics-flamegraph
git push origin --delete feat/physics-flamegraph

# 새 브랜치 3개 생성 및 푸시
git checkout -b feat/physics
git push origin feat/physics

git checkout dev
git checkout -b feat/flamegraph
git push origin feat/flamegraph

git checkout dev
git checkout -b feat/app
git push origin feat/app

# 작업 시작 브랜치로 이동
git checkout feat/physics
```

---

## M1 — 물리 엔진 기반 함수

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/engine.ts 파일을 생성하고,
contracts.ts의 타입을 기준으로 아래 순수 함수들을 구현해줘.
각 함수마다 한글 주석으로 동작 원리를 설명해줘.

구현할 함수:
- applyGravity(piece, board): 중력 적용 후 새 Tetromino 반환
- checkCollision(piece, board): 충돌 여부 반환
- rotatePiece(piece): 물리 기반 회전 (각도 기반, 90도 단위가 아닌 실제 각도)

완료 후 유닛 테스트를 src/physics/engine.test.ts에 작성해줘.
테스트 통과 확인 후 아래 컨벤션으로 커밋하고 feat/physics에 푸시해줘.

커밋 형식 (Angular Convention, body 한글):
feat(physics): 물리 엔진 기반 함수 구현
```

---

## M2 — 라인 절단 및 클리어

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/engine.ts에 아래 함수를 추가해줘.
contracts.ts 타입 기준으로 구현하고, 한글 주석 필수야.

구현할 함수:
- cutPieceAtLine(piece, lineY): 기울어진 블록을 수평선 기준으로 절단
  → 위 조각은 유지, 아래 조각은 제거
  → 블록이 기울어진 상태에서 라인에 걸쳐있는 경우를 반드시 처리해야 해
- clearLines(board): 완성된 라인 제거 후 새 보드 반환
  → 제거된 라인 수도 함께 반환

cutPieceAtLine이 이 프로젝트의 핵심 차별점이야.
기울어진 블록이 라인에 걸쳐있을 때 정확하게 절단되어야 해.

완료 후 유닛 테스트를 src/physics/engine.test.ts에 추가하고,
테스트 통과 확인 후 커밋하고 feat/physics에 푸시해줘.

커밋 형식 (Angular Convention, body 한글):
feat(physics): 라인 절단 및 클리어 로직 구현
```

---

## M3 — 게임 상태 관리

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/gameState.ts 파일을 생성해줘.
contracts.ts의 PhysicsState 타입을 기준으로 아래를 구현해줘.
한글 주석 필수야.

구현할 함수:
- initState(): 초기 게임 상태 반환
- nextTick(state): 매 프레임 호출
  → 중력 적용 → 충돌 감지 → 라인 클리어를 순서대로 처리
- movePiece(state, direction): 블록 좌우 이동
- hardDrop(state): 블록 즉시 낙하

모든 함수는 순수 함수로 작성해줘 (state를 직접 변경하지 않고 새 state 반환).

완료 후 유닛 테스트를 src/physics/gameState.test.ts에 작성하고,
테스트 통과 확인 후 커밋하고 feat/physics에 푸시해줘.
그 다음 feat/physics → dev로 PR을 생성해줘.

커밋 형식 (Angular Convention, body 한글):
feat(physics): 게임 상태 관리 로직 구현
```

---

## M4 — Flamegraph 메트릭 패널

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/flamegraph야.
브랜치를 먼저 변경해줘: git checkout feat/flamegraph

src/metrics/flamegraph.ts 파일을 생성해줘.
contracts.ts의 FlamegraphEntry, FlamegraphPanel 타입 기준으로
Canvas를 사용해서 구현해줘. 한글 주석 필수야.

구현할 메서드:
- record(entry): 렌더링 데이터 누적
- render(container): Canvas에 Flamegraph 그리기
  → 가로축: 시간순 렌더링 횟수 (commit 순서)
  → 세로축: 컴포넌트 트리 깊이
  → 색상: duration 짧을수록 초록(#4ecdc4), 길수록 노란색(#ffe66d)
  → 각 막대 hover 시 컴포넌트명과 duration 툴팁 표시
- clear(): 누적 데이터 초기화

먼저 아래 mock data로 동작을 확인해줘:
[
  { componentName: 'Board', duration: 12, timestamp: 1, renderIndex: 0 },
  { componentName: 'Block', duration: 3, timestamp: 2, renderIndex: 0 },
  { componentName: 'Score', duration: 1, timestamp: 3, renderIndex: 0 },
]

유닛 테스트를 src/metrics/flamegraph.test.ts에 작성하고,
테스트 통과 확인 후 커밋하고 feat/flamegraph에 푸시해줘.
그 다음 feat/flamegraph → dev로 PR을 생성해줘.

커밋 형식 (Angular Convention, body 한글):
feat(metrics): Flamegraph 메트릭 패널 구현
```

---

## M5 — 전체 통합 (Core 완성 후 진행)

> 민철(feat/vdom-diff)과 명석(feat/hooks) PR이 dev에 merge된 후 진행하세요.

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.
브랜치를 먼저 변경하고 dev 최신화해줘:
git checkout feat/app
git merge dev

src/app/index.ts에서 전체를 통합해줘.
contracts.ts 타입을 기준으로 연결하고 한글 주석 필수야.

통합 순서:
1. FunctionComponent로 루트 Tetris 컴포넌트 구성
2. useState로 PhysicsState 관리
3. useEffect로 게임 루프 (requestAnimationFrame) 실행
   → 매 프레임 nextTick(state) 호출
4. 키보드 이벤트 연결 (← → ↓ space)
5. Flamegraph 패널을 게임 우측에 배치
   → FunctionComponent의 렌더링 시간을 record()로 전달

레이아웃:
[ 테트리스 보드 ] [ Flamegraph 패널 ]

완료 후 커밋하고 feat/app에 푸시해줘.
그 다음 feat/app → dev로 PR을 생성해줘.

커밋 형식 (Angular Convention, body 한글):
feat(app): 물리 테트리스 전체 통합
```

---

## 최종 — dev → main merge

```bash
# dev 최종 확인
git checkout dev
npx tsc --noEmit  # 타입 에러 확인

# main으로 merge (Merge Commit 방식 — contributor 보존)
git checkout main
git merge --no-ff dev -m "feat: 물리 테트리스 최종 통합"
git push origin main
```
