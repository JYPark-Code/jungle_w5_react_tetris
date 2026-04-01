# Hold Piece 추가 업데이트

> M4까지 완성된 상태에서 holdPiece 기능 추가 작업입니다.
> 영향 범위: contracts.ts, claude-prompts.md M5, app-design.md
> 팀원 A (feat/vdom-diff), 팀원 B (feat/hooks) 영향 없음

---

## 1. contracts.ts 수정

### PhysicsState에 2개 필드 추가

```typescript
// 기존
export interface PhysicsState {
  board: Board;
  currentPiece: Tetromino | null;
  nextPiece: Tetromino | null;
  score: number;
  level: number;
  isGameOver: boolean;
  linesCleared: number;
}

// 변경
export interface PhysicsState {
  board: Board;
  currentPiece: Tetromino | null;
  nextPiece: Tetromino | null;
  heldPiece: Tetromino | null;   // ← 추가: R키로 보관한 블록
  canHold: boolean;               // ← 추가: 착지 전 재사용 방지
  score: number;
  level: number;
  isGameOver: boolean;
  linesCleared: number;
}
```

### holdPiece 함수 타입 추가

```typescript
/**
 * 현재 블록을 보관함에 저장 (R키)
 * - heldPiece 없으면: currentPiece → held, nextPiece → current
 * - heldPiece 있으면: currentPiece ↔ heldPiece 교체
 * - 착지 전 연속 사용 불가 (canHold = false)
 * - 새 블록 착지 시 canHold = true 로 초기화
 */
export type HoldPieceFn = (state: PhysicsState) => PhysicsState;
```

---

## 2. claude-prompts.md M3 프롬프트 수정

### M3에 holdPiece 함수 추가

기존 M3 프롬프트의 "구현할 함수" 항목에 아래 추가:

```
- holdPiece(state): R키 블록 보관
  → heldPiece가 null이면: currentPiece를 held로, nextPiece를 current로
  → heldPiece가 있으면: currentPiece ↔ heldPiece 교체
  → 교체 후 canHold = false
  → 새 블록 착지(nextTick에서 착지 감지) 시 canHold = true 복원
  → canHold가 false인 상태에서 holdPiece 호출 시 무시

엣지케이스:
- 연속 R키 입력 방지 (canHold 플래그)
- hold 직후 game over 조건 체크 필요
```

### M3 커밋 메시지 수정

```
feat(physics): 게임 상태 관리 + hold piece 로직 구현
```

---

## 3. Claude Code CLI 추가 프롬프트 (M4 완성 후 바로 실행)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

contracts.ts에 아래 두 가지를 추가해줘:

1. PhysicsState 인터페이스에 필드 추가
   - heldPiece: Tetromino | null
   - canHold: boolean

2. HoldPieceFn 타입 추가
   - 위 contracts.ts 수정 내용 참고

그 다음 src/physics/gameState.ts에 holdPiece 함수를 추가해줘:
- heldPiece가 null이면: currentPiece → held, nextPiece → current
- heldPiece가 있으면: currentPiece ↔ heldPiece 교체
- 교체 후 canHold = false
- nextTick에서 블록 착지 감지 시 canHold = true 복원
- canHold가 false이면 holdPiece 호출 무시

엣지케이스 반드시 처리:
- 연속 R키 입력 방지 (canHold 플래그)
- hold 직후 game over 조건 체크

기존 유닛 테스트가 깨지지 않는지 확인하고,
holdPiece 유닛 테스트를 src/physics/gameState.test.ts에 추가해줘.

완료 후 커밋하고 feat/physics에 푸시해줘.

feat(physics): hold piece 기능 추가
```

---

## 4. app-design.md 수정 사항

### Tab 1 레이아웃에 HOLD 패널 추가

```
기존:
│  NEXT
│  [ 다음 블록 미리보기 ]

변경:
│  HOLD (R키)             │  NEXT
│  [ 보관 블록 표시 ]      │  [ 다음 블록 미리보기 ]
│  없으면 빈 칸            │
```

### Tab 4 useState 매핑에 추가

```
기존:
useState → 게임 전체 상태 (PhysicsState)
           다음 블록 (nextPiece)
           보관 블록 (heldPiece, 1개 제한)  ← 이미 언급됨 ✅

문제 발견 목록에 추가:
🔴 문제 5. R키 연속 입력 시 블록 무한 교체
   원인: canHold 플래그 없음
   해결: 착지 시 canHold = true 복원
   → 실제 테트리스 룰과 동일한 제약
```
