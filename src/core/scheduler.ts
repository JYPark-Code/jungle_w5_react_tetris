// ============================================================
// src/core/scheduler.ts
// 담당: 명석
// Fiber 기반 우선순위 스케줄러
//
// 배경:
//   batchScheduler는 모든 setState를 동일 우선순위(microtask)로 처리 → 프레임 드롭
//   FiberScheduler는 urgent/normal/idle 3단계 우선순위 + 시간 슬라이싱으로 해결
//
// 스케줄링 방식 비교:
//   batchScheduler  → Promise.resolve() (microtask), 단순 Set 중복 방지
//   fiberScheduler  → urgent: microtask | normal/idle: setTimeout(macrotask)
//                     우선순위 정렬 + 5ms 시간 슬라이싱
// ============================================================

// -------------------------------------------------------
// 타입 정의
// -------------------------------------------------------

export type Priority = 'urgent' | 'normal' | 'idle';

export interface FiberTask {
  id: number;
  priority: Priority;
  callback: () => void;
  expirationTime: number; // performance.now() + 우선순위별 timeout (ms)
}

export interface FiberScheduler {
  /** 우선순위와 함께 작업 예약 */
  schedule(callback: () => void, priority?: Priority): void;
  /** 예약된 작업 실행 (시간 슬라이싱 포함) */
  flush(): void;
  /** 현재 큐에 있는 작업 수 반환 (디버깅/메트릭용) */
  pendingCount(): number;
}

// -------------------------------------------------------
// 상수
// -------------------------------------------------------

/** 우선순위별 만료 시간 (ms) */
const PRIORITY_TIMEOUT: Record<Priority, number> = {
  urgent: 0,   // 즉시 만료 → 항상 먼저 실행 (키 입력, 블록 이동/회전)
  normal: 100, // 100ms (점수 업데이트, UI 반영)
  idle: 500,   // 500ms (Flamegraph 기록, 비필수 UI)
};

/** 정렬 기준 (낮을수록 먼저 처리) */
const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  normal: 1,
  idle: 2,
};

/** 한 번의 flush에서 허용하는 최대 실행 시간 (ms) */
const TIME_SLICE_MS = 5;

// -------------------------------------------------------
// 팩토리 함수
// 테스트에서는 createFiberScheduler()로 독립 인스턴스를 만들어 사용합니다.
// 프로덕션에서는 아래의 fiberScheduler 싱글톤을 사용합니다.
// -------------------------------------------------------

export function createFiberScheduler(): FiberScheduler {
  let taskIdCounter = 0;
  const taskQueue: FiberTask[] = [];

  /**
   * 동일 콜백 중복 방지 Set
   * - 같은 tick에 setState가 여러 번 호출돼도 updateJob은 한 번만 실행됩니다.
   * - 작업 완료 시 제거하므로 재등록은 허용됩니다.
   */
  const pendingCallbacks = new Set<() => void>();

  // urgent: microtask(Promise.resolve) — batchScheduler와 동일한 timing
  //   → await flushMicrotask()로 테스트 가능, setState 직후 즉시 반영
  // normal/idle: macrotask(setTimeout/requestIdleCallback)
  //   → 게임 루프 프레임을 블로킹하지 않음
  let microtaskScheduled = false;
  let macrotaskScheduled = false;

  function scheduleUrgentFlush(): void {
    if (microtaskScheduled) return;
    microtaskScheduled = true;
    Promise.resolve().then(() => {
      microtaskScheduled = false;
      scheduler.flush();
    });
  }

  function scheduleDeferredFlush(): void {
    if (macrotaskScheduled) return;
    macrotaskScheduled = true;
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        macrotaskScheduled = false;
        scheduler.flush();
      });
    } else {
      // requestIdleCallback 미지원 환경 폴백 (Node.js, 구형 브라우저)
      setTimeout(() => {
        macrotaskScheduled = false;
        scheduler.flush();
      }, 0);
    }
  }

  const scheduler: FiberScheduler = {
    schedule(callback: () => void, priority: Priority = 'normal'): void {
      // 동일 콜백 중복 등록 방지
      // 같은 tick에 여러 번 setState → 첫 번째만 큐에 등록
      if (pendingCallbacks.has(callback)) return;

      const now = performance.now();
      const task: FiberTask = {
        id: taskIdCounter++,
        priority,
        callback,
        expirationTime: now + PRIORITY_TIMEOUT[priority],
      };
      taskQueue.push(task);
      pendingCallbacks.add(callback);

      // urgent: microtask(Promise.resolve) — batchScheduler와 동일한 timing
      // normal/idle: macrotask — 프레임 여유 시간에 처리
      if (priority === 'urgent') {
        scheduleUrgentFlush();
      } else {
        scheduleDeferredFlush();
      }
    },

    flush(): void {
      const startTime = performance.now();
      const deadline = startTime + TIME_SLICE_MS;

      // 1. 우선순위 → FIFO(id 오름차순) 기준으로 정렬
      taskQueue.sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.id - b.id;
      });

      // 2. 시간 예산 내에서 작업 처리
      while (taskQueue.length > 0) {
        const currentTime = performance.now();
        const task = taskQueue[0];
        const isExpired = task.expirationTime <= currentTime;

        // 만료되지 않았고 시간 예산 초과 → 다음 프레임으로 양보
        if (!isExpired && currentTime >= deadline) {
          break;
        }

        taskQueue.shift();
        pendingCallbacks.delete(task.callback); // 완료된 콜백은 중복 방지 Set에서 제거
        task.callback();
      }

      // 3. 남은 작업이 있으면 우선순위에 맞게 다음 flush 예약
      if (taskQueue.length > 0) {
        const hasUrgent = taskQueue.some((t) => t.priority === 'urgent');
        if (hasUrgent) {
          scheduleUrgentFlush();
        } else {
          scheduleDeferredFlush();
        }
      }
    },

    pendingCount(): number {
      return taskQueue.length;
    },
  };

  return scheduler;
}

/** 프로덕션용 싱글톤 */
export const fiberScheduler: FiberScheduler = createFiberScheduler();
