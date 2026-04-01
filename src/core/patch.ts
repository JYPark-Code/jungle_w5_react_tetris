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
        // 자식 전체를 새로 그림 (간단한 전략)
        // 성능 최적화가 필요하면 key 기반 비교로 개선 가능
        if (p.children && container.firstChild instanceof HTMLElement) {
          const parentEl = container.firstChild;
          // 기존 자식 모두 제거
          while (parentEl.firstChild) {
            parentEl.removeChild(parentEl.firstChild);
          }
          // 새 자식 추가
          for (const child of p.children) {
            parentEl.appendChild(createElement(child));
          }
        }
        break;
    }
  }
};

/**
 * 변경된 props를 실제 DOM 엘리먼트에 적용합니다.
 *
 * - 값이 null이면 해당 속성을 제거
 * - "on"으로 시작하면 이벤트 리스너 등록
 * - "className"이면 class 속성으로 변환
 * - "style" 객체면 el.style에 병합
 * - 그 외는 setAttribute로 설정
 *
 * @param el    대상 DOM 엘리먼트
 * @param props 변경된 props 객체 (key: 속성명, value: 새 값 또는 null)
 */
function applyProps(el: HTMLElement, props: Record<string, any>): void {
  for (const [key, value] of Object.entries(props)) {
    if (value === null) {
      // null이면 속성 제거
      el.removeAttribute(key === "className" ? "class" : key);
    } else if (key.startsWith("on") && typeof value === "function") {
      // 이벤트 핸들러 등록 (예: onClick → click)
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value);
    } else if (key === "className") {
      el.setAttribute("class", value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value);
    } else {
      el.setAttribute(key, value);
    }
  }
}
