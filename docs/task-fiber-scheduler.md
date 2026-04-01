# 작업 지시: Fiber 스케줄러 구현

> 담당: 명석
> 브랜치: `feat/hooks`
> 기존 `batchScheduler`는 그대로 유지하고, 별도 파일로 Fiber 스케줄러를 추가합니다.

---

## 배경

현재 `batchScheduler`는 **마이크로태스크(Promise.resolve)** 기반으로 동작합니다.
이 방식은 모든 setState를 동일 우선순위로 처리하기 때문에,
게임 루프(60fps)처럼 **긴급한 업데이트와 덜 긴급한 업데이트가 섞이면 프레임 드롭**이 발생합니다.

React가 Fiber를 만든 이유가 정확히 이것입니다:
> "모든 업데이트를 동일하게 처리하면 안 된다. 우선순위가 필요하다."

발표에서 **"BatchScheduler로 만들었더니 이런 한계 → Fiber로 해결"** 스토리를 보여줄 것입니다.

---

## 구현 위치

```
src/core/
├── hooks.ts          # 기존 코드 유지 (수정 최소화)
└── scheduler.ts      # ← 새로 생성
```

---

## 구현 요구사항

### 1. `src/core/scheduler.ts` 생성

```typescript
// contracts.ts의 BatchScheduler 인터페이스를 확장하는 형태로 구현

export type Priority = 'urgent' | 'normal' | 'idle';

export interface FiberTask {
  id: number;
  priority: Priority;
  callback: () => void;
  expirationTime: number;  // 작업 만료 시간 (ms)
}

export interface FiberScheduler {
  // 우선순위와 함께 작업 예약
  schedule(callback: () => void, priority?: Priority): void;

  // 예약된 작업 실행 (시간 슬라이싱)
  flush(): void;

  // 현재 큐에 있는 작업 수 반환 (디버깅/메트릭용)
  pendingCount(): number;
}
```

### 2. 우선순위별 만료 시간

| Priority | 만료 시간 | 용도 |
|----------|----------|------|
| `urgent` | 즉시 (0ms) | 키 입력, 블록 이동/회전 |
| `normal` | 100ms | 점수 업데이트, UI 반영 |
| `idle` | 500ms | Flamegraph 기록, 비필수 UI |

### 3. 시간 슬라이싱 (Time Slicing)

```
flush() 동작:
1. 우선순위 높은 순서로 정렬
2. 만료된 작업은 즉시 실행
3. 시간 예산(5ms) 내에서 작업 처리
4. 예산 초과 시 남은 작업은 다음 프레임으로 양보 (requestIdleCallback 또는 setTimeout)
```

**핵심**: `performance.now()`로 경과 시간을 측정하고,
5ms를 넘기면 중단 → 다음 프레임에서 이어서 처리.

### 4. hooks.ts 연동

`hooks.ts`의 `useState`에서 `batchScheduler.schedule()` 대신
`fiberScheduler.schedule()`을 사용할 수 있도록 **선택적 연동**합니다.

```typescript
// hooks.ts 수정 (최소 변경)
import { fiberScheduler } from './scheduler';

// useState 내부의 setState에서:
// 기존: batchScheduler.schedule(updateJob);
// 변경: fiberScheduler.schedule(updateJob, 'urgent');
```

> batchScheduler 코드는 삭제하지 말고 주석 또는 export로 남겨주세요.
> 발표에서 둘을 비교할 예정입니다.

---

## 테스트 작성

`src/core/scheduler.test.ts`에 아래 케이스를 포함해주세요:

1. urgent 작업이 normal보다 먼저 실행되는지
2. 같은 우선순위 내에서 FIFO 순서 유지
3. 만료된 작업이 즉시 실행되는지
4. 시간 예산 초과 시 남은 작업이 다음 flush로 넘어가는지
5. pendingCount가 정확한지

---

## 커밋 컨벤션

```
feat(hooks): Fiber 기반 우선순위 스케줄러 구현

- urgent/normal/idle 3단계 우선순위 스케줄링
- 시간 슬라이싱(5ms)으로 프레임 드롭 방지
- useState와 연동하여 기존 batchScheduler 대체
- batchScheduler 코드는 비교용으로 보존
```

---

## 참고: 발표에서 이 작업이 쓰이는 곳

```
Tab 4 — ⚙️ 학습 (우리가 발견한 것들)

🔴 문제 6. 게임 루프와 UI 업데이트가 경쟁하며 프레임 드롭
   원인: BatchScheduler가 모든 setState를 동일 우선순위로 처리
   해결: Fiber 스케줄러 — urgent(키 입력) > normal(UI) > idle(메트릭)
   → React가 Fiber를 만든 이유와 동일한 문제를 직접 경험
```

---

## 질문 있으면

작업 중 막히는 부분이 있으면 지용에게 바로 공유해주세요.
특히 `requestIdleCallback` 브라우저 호환성 이슈는 `setTimeout(fn, 0)` 폴백으로 처리하면 됩니다.
