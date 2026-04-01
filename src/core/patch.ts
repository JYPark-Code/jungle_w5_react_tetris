import type { Patch, PatchFn, VNode } from "../../contracts";
import { createElement } from "./vdom";

/**
 * [Patch란?]
 * diff.ts에서 "무엇이 바뀌었는지" 계산한 결과(Patch[])를
 * 실제 DOM에 반영하는 역할입니다.
 *
 * 흐름: VNode 비교(diff) → 패치 목록 생성 → 여기서 DOM 반영(patch)
 */

/**
 * 패치 목록을 받아 실제 DOM을 업데이트합니다.
 *
 * @param container 실제 DOM 컨테이너 (업데이트 대상의 부모 엘리먼트)
 * @param patches   diff에서 생성된 변경사항 목록
 */
export const patch: PatchFn = (
  container: HTMLElement,
  patches: Patch[]
): void => {
  for (const p of patches) {
    switch (p.type) {
      case "CREATE":
        // 새 노드 생성 후 컨테이너에 추가
        if (p.node) {
          const newEl = createElement(p.node);
          container.appendChild(newEl);
        }
        break;

      case "REMOVE":
        // 컨테이너의 마지막 자식 노드 제거
        if (container.lastChild) {
          container.removeChild(container.lastChild);
        }
        break;

      case "REPLACE":
        // 기존 노드를 새 노드로 교체
        // 첫 번째 자식을 새 엘리먼트로 대체
        if (p.node && container.firstChild) {
          const newEl = createElement(p.node);
          container.replaceChild(newEl, container.firstChild);
        }
        break;

      case "UPDATE_PROPS":
        // 변경된 props만 DOM에 적용
        if (p.props && container.firstChild instanceof HTMLElement) {
          applyProps(container.firstChild, p.props);
        }
        break;

      case "UPDATE_CHILDREN":
        // 자식 업데이트: key가 있으면 key 기반, 없으면 전체 교체
        if (p.children && container.firstChild instanceof HTMLElement) {
          const parentEl = container.firstChild;
          patchChildren(parentEl, p.children);
        }
        break;
    }
  }
};

/**
 * 자식 노드를 업데이트합니다.
 *
 * key가 있는 자식이 하나라도 있으면 key 기반으로 비교해서
 * 변경된 자식만 DOM에 반영합니다. (추가/삭제/이동)
 *
 * key가 없으면 기존처럼 전체 교체합니다.
 *
 * [성능 차이]
 * 전체 교체: 20행 보드에서 매 프레임 200개 DOM 재생성
 * Key 기반:  실제 바뀐 행만 DOM 조작 → 훨씬 빠름
 */
function patchChildren(
  parentEl: HTMLElement,
  newChildren: (VNode | string)[]
): void {
  // key가 있는 자식이 하나라도 있으면 key 기반 업데이트
  const hasKeys = newChildren.some(
    (c) => typeof c === "object" && c.key !== undefined
  );

  if (!hasKeys) {
    // key 없으면 기존 전체 교체 방식
    while (parentEl.firstChild) {
      parentEl.removeChild(parentEl.firstChild);
    }
    for (const child of newChildren) {
      parentEl.appendChild(createElement(child));
    }
    return;
  }

  // key 기반 업데이트
  // 1. 기존 DOM 자식들을 key → Element 맵으로 변환
  const oldKeyMap = new Map<string | number, Element>();
  for (const child of Array.from(parentEl.children)) {
    const key = child.getAttribute("data-key");
    if (key !== null) {
      oldKeyMap.set(key, child);
    }
  }

  // 2. 새 children 기준으로 DOM 재구성
  const newElements: Node[] = [];
  for (const child of newChildren) {
    if (typeof child === "object" && child.key !== undefined) {
      const existing = oldKeyMap.get(child.key);
      if (existing) {
        // 기존 DOM 재사용 (이동)
        newElements.push(existing);
        oldKeyMap.delete(child.key);
      } else {
        // 새로 추가
        const el = createElement(child);
        if (el instanceof HTMLElement) {
          el.setAttribute("data-key", String(child.key));
        }
        newElements.push(el);
      }
    } else {
      // key 없는 자식은 새로 생성
      newElements.push(createElement(child));
    }
  }

  // 3. 남은 old 요소들 제거 (삭제된 노드)
  for (const el of oldKeyMap.values()) {
    parentEl.removeChild(el);
  }

  // 4. 새 순서대로 DOM에 배치
  while (parentEl.firstChild) {
    parentEl.removeChild(parentEl.firstChild);
  }
  for (const el of newElements) {
    parentEl.appendChild(el);
  }
}

/**
 * 엘리먼트별 이벤트 리스너 추적용 WeakMap
 *
 * 왜 필요한가?
 * - update 시 applyProps가 반복 호출되면, 이전 리스너를 안 지우고 새 리스너만 추가됨
 * - 결과: keydown 이벤트가 2배, 3배로 중복 실행되는 버그 발생
 * - WeakMap으로 엘리먼트별 이전 리스너를 기억해두고, 새 것 등록 전 이전 것을 제거
 *
 * WeakMap을 쓰는 이유:
 * - 엘리먼트가 DOM에서 제거되면 자동으로 GC됨 (메모리 누수 방지)
 */
const listenerMap = new WeakMap<HTMLElement, Map<string, EventListener>>();

/**
 * 변경된 props를 실제 DOM 엘리먼트에 적용합니다.
 *
 * - 값이 null이면 해당 속성을 제거
 * - "on"으로 시작하면 이벤트 리스너 등록 (이전 리스너 자동 제거)
 * - "className"이면 class 속성으로 변환
 * - "style" 객체면 el.style에 병합
 * - 그 외는 setAttribute로 설정
 *
 * @param el    대상 DOM 엘리먼트
 * @param props 변경된 props 객체 (key: 속성명, value: 새 값 또는 null)
 */
function applyProps(el: HTMLElement, props: Record<string, any>): void {
  // 리스너 맵 초기화
  if (!listenerMap.has(el)) {
    listenerMap.set(el, new Map());
  }
  const listeners = listenerMap.get(el)!;

  for (const [key, value] of Object.entries(props)) {
    if (value === null) {
      // null이면 속성 제거
      if (key.startsWith("on")) {
        // 이벤트 리스너도 제거
        const eventName = key.slice(2).toLowerCase();
        const prev = listeners.get(eventName);
        if (prev) {
          el.removeEventListener(eventName, prev);
          listeners.delete(eventName);
        }
      } else {
        el.removeAttribute(key === "className" ? "class" : key);
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();

      // 이전 리스너 제거 (중복 등록 방지)
      const prev = listeners.get(eventName);
      if (prev) {
        el.removeEventListener(eventName, prev);
      }

      // 새 리스너 등록 및 추적
      el.addEventListener(eventName, value);
      listeners.set(eventName, value);
    } else if (key === "className") {
      el.setAttribute("class", value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value);
    } else {
      el.setAttribute(key, value);
    }
  }
}
