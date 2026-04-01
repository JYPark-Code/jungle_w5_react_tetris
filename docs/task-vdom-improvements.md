# 작업 지시: VDOM 코어 개선

> 담당: 민철
> 브랜치: `feat/vdom-diff`
> 기존 구현 위에 개선 작업을 진행합니다. 기존 코드 구조를 유지하면서 수정해주세요.

---

## 배경

현재 vdom/diff/patch/component 기본 구현은 잘 되어 있습니다.
하지만 M5(전체 통합) 단계에서 테트리스 게임과 연결하면 아래 문제들이 발생합니다.
**우선순위 순서대로** 작업해주세요.

---

## 1. 이벤트 리스너 누수 수정 (patch.ts) — 우선순위 ★★★★

### 문제

`applyProps()`에서 새 이벤트 리스너를 추가할 때 **이전 리스너를 제거하지 않습니다.**
키보드 이벤트(`keydown`)가 update될 때마다 중복 등록되어 입력이 2배, 3배로 처리됩니다.

### 해결

이벤트 리스너를 추적하는 Map을 엘리먼트에 저장하고, 새 리스너 등록 전에 이전 것을 제거합니다.

```typescript
// patch.ts — applyProps 수정

// 엘리먼트에 리스너 맵 저장 (WeakMap 또는 커스텀 프로퍼티)
const listenerMap = new WeakMap<HTMLElement, Map<string, EventListener>>();

function applyProps(el: HTMLElement, props: Record<string, any>): void {
  // 리스너 맵 초기화
  if (!listenerMap.has(el)) {
    listenerMap.set(el, new Map());
  }
  const listeners = listenerMap.get(el)!;

  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();

      // 이전 리스너 제거
      const prev = listeners.get(eventName);
      if (prev) {
        el.removeEventListener(eventName, prev);
      }

      // 새 리스너 등록
      el.addEventListener(eventName, value);
      listeners.set(eventName, value);
    }
    // ... 나머지 기존 코드 유지
  }
}
```

---

## 2. Key 기반 자식 비교 (diff.ts) — 우선순위 ★★★★

### 문제

`diffChildren()`이 인덱스 기반으로만 비교합니다.
테트리스에서 라인 클리어 시 행이 삭제되면, 변하지 않은 행까지 전부 교체됩니다.

```
예) 3행이 클리어되면:
인덱스 기반: 행 3~19 전부 "바뀜"으로 판정 → DOM 17개 재생성
Key 기반:   행 3만 "삭제"로 판정 → DOM 1개 제거 + 빈 행 1개 추가
```

### 해결

contracts.ts의 `VNode.key`를 활용해서 key 기반 비교를 구현합니다.

```typescript
// diff.ts — diffChildren 개선

function diffChildren(
  oldChildren: (VNode | string)[],
  newChildren: (VNode | string)[]
): boolean {
  // key가 있는 자식이 하나라도 있으면 key 기반 비교
  const hasKeys = newChildren.some(
    (c) => typeof c === "object" && c.key !== undefined
  );

  if (hasKeys) {
    return diffChildrenByKey(oldChildren, newChildren);
  }

  // key 없으면 기존 인덱스 기반 비교 유지
  // ... 기존 코드
}

function diffChildrenByKey(
  oldChildren: (VNode | string)[],
  newChildren: (VNode | string)[]
): boolean {
  // 1. old children을 key → VNode 맵으로 변환
  // 2. new children을 순회하며 같은 key의 old VNode와 비교
  // 3. old에만 있는 key → 삭제, new에만 있는 key → 추가
  // 4. 순서가 바뀐 경우도 감지
  // 구현해주세요
}
```

> 힌트: React의 reconcileChildrenArray와 유사한 로직입니다.
> 완벽하지 않아도 됩니다. key 매칭 + 삭제/추가 판별만 되면 충분합니다.

---

## 3. unmount 구현 (component.ts) — 우선순위 ★★★

### 문제

`Component` 클래스에 `unmount()`가 없어서:
- 게임 탭을 벗어날 때 `requestAnimationFrame` 루프가 계속 돌아감
- `keydown` 이벤트가 계속 살아있음
- useEffect cleanup이 실행되지 않음

### 해결

```typescript
// component.ts에 추가

unmount(): void {
  // 모든 useEffect의 cleanup 실행
  for (const hook of this.hooks) {
    if (hook.value && typeof hook.value === "function") {
      (hook.value as () => void)();
    }
  }

  // DOM에서 제거
  if (this.container) {
    this.container.innerHTML = "";
  }

  // 상태 초기화
  this.hooks = [];
  this.prevVNode = null;
}
```

---

## 4. props 업데이트 지원 (component.ts) — 우선순위 ★★★

### 문제

부모 컴포넌트에서 자식에게 새 props를 전달할 방법이 없습니다.
테트리스에서 `<Board board={state.board} />`처럼 state가 바뀔 때마다
자식의 props를 업데이트해야 합니다.

### 해결

```typescript
// component.ts에 추가

setProps(newProps: P): void {
  this.props = newProps;
  this.update();
}
```

---

## 5. UPDATE_CHILDREN 개선 (patch.ts) — 우선순위 ★★

### 현재

자식이 바뀌면 기존 자식을 **전부 삭제** 후 새로 추가합니다.
이 방식은 동작하지만, 20행 × 10열 보드에서 매 프레임 200개 DOM을 재생성하면 느립니다.

### 개선 (key 기반 diff와 연동)

diff에서 key 기반 비교 결과(추가/삭제/이동)를 받아서,
변경된 자식만 DOM에 반영하도록 개선합니다.

> 이건 #2 Key 기반 비교가 완성된 후 진행해주세요.

---

## 6. 테스트 작성 — 우선순위 ★★

아래 파일에 테스트를 작성해주세요:

### `src/core/vdom.test.ts`
- createVNode 기본 생성
- children 평탄화 (중첩 배열)
- null/undefined children 필터링

### `src/core/diff.test.ts`
- CREATE: null → VNode
- REMOVE: VNode → null
- REPLACE: 다른 type
- UPDATE_PROPS: 같은 type, 다른 props
- UPDATE_CHILDREN: 같은 type, 다른 children

### `src/core/component.test.ts` (jsdom 환경)
- mount 시 DOM에 엘리먼트 생성
- update 시 변경사항만 반영
- unmount 시 cleanup 실행

---

## 커밋 컨벤션

작업 단위별로 커밋해주세요:

```
fix(patch): 이벤트 리스너 누수 수정

- 이전 리스너 제거 후 새 리스너 등록
- WeakMap으로 엘리먼트별 리스너 추적
```

```
feat(diff): key 기반 자식 비교 구현

- VNode.key를 활용한 자식 매칭
- 삭제/추가/이동 판별
```

```
feat(component): unmount 및 setProps 구현

- unmount: useEffect cleanup 일괄 실행 + DOM 제거
- setProps: 부모→자식 props 업데이트 지원
```

---

## 작업 순서 요약

```
1. 이벤트 리스너 누수 수정 (patch.ts)     ← 가장 먼저, 간단
2. unmount + setProps (component.ts)       ← M5 통합에 필수
3. Key 기반 비교 (diff.ts)                ← 성능에 중요하지만 복잡
4. UPDATE_CHILDREN 개선 (patch.ts)         ← #3 완료 후
5. 테스트 작성                             ← 각 단계마다 같이 작성하면 best
```

---

## 질문 있으면

작업 중 막히는 부분이 있으면 지용에게 바로 공유해주세요.
특히 key 기반 비교는 난이도가 있으니, 30분 이상 막히면 바로 연락주세요.
