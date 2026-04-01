// ============================================================
// src/core/hooks.ts
// 담당: 명석
// 구현 항목: useState, useEffect, useMemo, BatchScheduler
// contracts.ts의 타입을 기준으로 구현합니다.
// ============================================================

import type {
  CurrentComponent,
  HookState,
  SetStateAction,
  UseStateTuple,
  UseStateFn,
  UseEffectFn,
  UseMemoFn,
  BatchScheduler,
} from '../../contracts';

// -------------------------------------------------------
// 전역 렌더링 컨텍스트
// 현재 렌더링 중인 컴포넌트 인스턴스와 hookIndex를 추적합니다.
// -------------------------------------------------------
export const current: CurrentComponent = {
  instance: null,
  hookIndex: 0,
};

// -------------------------------------------------------
// BatchScheduler
// 동일 tick(마이크로태스크) 내 여러 setState 호출을 모아
// 단 한 번만 update()를 실행합니다.
// -------------------------------------------------------
let isBatchPending = false;
const updateQueue: Set<() => void> = new Set();

export const batchScheduler: BatchScheduler = {
  schedule(updateFn: () => void): void {
    updateQueue.add(updateFn);
    if (!isBatchPending) {
      isBatchPending = true;
      // 마이크로태스크로 flush를 예약 → 같은 tick의 모든 setState가 큐에 쌓인 뒤 한번에 처리
      Promise.resolve().then(() => batchScheduler.flush());
    }
  },

  flush(): void {
    isBatchPending = false;
    const fns = [...updateQueue];
    updateQueue.clear();
    fns.forEach((fn) => fn());
  },
};

// -------------------------------------------------------
// useState
// 컴포넌트 인스턴스의 hooks 배열에 상태를 저장합니다.
// setState 호출 시 BatchScheduler를 통해 update()를 예약합니다.
// -------------------------------------------------------
export const useState: UseStateFn = <T>(initialValue: T): UseStateTuple<T> => {
  const instance = current.instance!;
  const index = current.hookIndex++;

  // 첫 마운트 시에만 초기값 설정
  if (instance.hooks[index] === undefined) {
    instance.hooks[index] = { value: initialValue };
  }

  const hookState = instance.hooks[index] as HookState;

  const setState = (action: SetStateAction<T>): void => {
    const prev = hookState.value as T;
    const next =
      typeof action === 'function'
        ? (action as (prev: T) => T)(prev)
        : action;

    // 값이 동일하면 리렌더링 생략
    if (Object.is(prev, next)) return;

    hookState.value = next;
    batchScheduler.schedule(() => instance.update());
  };

  return [hookState.value as T, setState];
};

// -------------------------------------------------------
// useEffect
// deps 배열이 변경됐을 때만 callback을 실행합니다.
// callback이 함수를 반환하면 다음 실행 전에 cleanup으로 호출합니다.
// -------------------------------------------------------
export const useEffect: UseEffectFn = (
  callback: () => void | (() => void),
  deps?: any[]
): void => {
  const instance = current.instance!;
  const index = current.hookIndex++;

  const prev = instance.hooks[index] as HookState | undefined;

  const hasChanged =
    !prev ||
    !deps ||
    !prev.deps ||
    deps.length !== prev.deps.length ||
    deps.some((dep, i) => !Object.is(dep, prev.deps![i]));

  if (hasChanged) {
    // 이전 effect의 cleanup 실행
    if (prev?.value && typeof prev.value === 'function') {
      (prev.value as () => void)();
    }

    const cleanup = callback();
    instance.hooks[index] = {
      value: typeof cleanup === 'function' ? cleanup : undefined,
      deps,
    };
  } else {
    // deps 변경 없으면 hookState 그대로 유지
    instance.hooks[index] = prev;
  }
};

// -------------------------------------------------------
// useMemo
// deps 배열이 변경됐을 때만 factory를 재실행해 값을 메모이제이션합니다.
// -------------------------------------------------------
export const useMemo: UseMemoFn = <T>(factory: () => T, deps: any[]): T => {
  const instance = current.instance!;
  const index = current.hookIndex++;

  const prev = instance.hooks[index] as HookState | undefined;

  const hasChanged =
    !prev ||
    !prev.deps ||
    deps.length !== prev.deps.length ||
    deps.some((dep, i) => !Object.is(dep, prev.deps![i]));

  if (hasChanged) {
    const value = factory();
    instance.hooks[index] = { value, deps };
    return value;
  }

  return prev!.value as T;
};
