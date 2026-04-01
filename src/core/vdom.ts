import type { VNode } from "../../contracts";

/**
 * [가상 DOM이란?]
 * 실제 DOM을 직접 조작하면 비용이 크기 때문에,
 * 먼저 JS 객체(VNode)로 DOM 구조를 표현해두고
 * 변경이 생겼을 때만 실제 DOM에 반영하는 방식입니다.
 *
 * VNode 구조:
 * {
 *   type: "div"           // HTML 태그명 (null이면 Fragment)
 *   props: { id: "app" } // HTML 속성들
 *   children: [...]      // 자식 VNode 또는 텍스트
 * }
 */

/**
 * VNode 객체를 생성합니다.
 *
 * JSX를 사용할 경우 트랜스파일러가 자동으로 이 함수를 호출합니다.
 * 예) <div id="app">hello</div>
 *  → createVNode("div", { id: "app" }, "hello")
 *
 * @param type     HTML 태그명 (예: "div", "span"). null이면 Fragment(빈 컨테이너)
 * @param props    HTML 속성 객체 (예: { id: "app", className: "box" })
 * @param children 자식 요소들. 중첩 배열도 허용 (flat 처리됨)
 */
export function createVNode(
  type: string | null,
  props: Record<string, any> | null,
  ...children: (VNode | string | (VNode | string)[])[]
): VNode {
  const flatChildren = children
    // 중첩 배열을 1단계 평탄화 (예: [[a, b], c] → [a, b, c])
    .flat()
    // null, undefined 제거 (조건부 렌더링에서 발생)
    .filter((child) => child !== null && child !== undefined)
    // 숫자는 문자열로 변환 (예: 42 → "42")
    .map((child) => (typeof child === "number" ? String(child) : child)) as (VNode | string)[];

  return {
    type,
    props: props ?? {}, // props가 null이면 빈 객체로 대체
    children: flatChildren,
  };
}

/**
 * VNode를 받아 실제 DOM 엘리먼트를 만들어 반환합니다.
 *
 * 최초 마운트 시(화면에 처음 그릴 때) 사용됩니다.
 * 이후 업데이트는 diff + patch가 담당합니다.
 *
 * @param vnode VNode 객체 또는 텍스트 문자열
 * @returns 실제 DOM 노드 (HTMLElement 또는 Text)
 */
export function createElement(vnode: VNode | string): HTMLElement | Text {
  // 문자열이면 텍스트 노드로 바로 생성
  // 예) "hello" → document.createTextNode("hello")
  if (typeof vnode === "string") {
    return document.createTextNode(vnode);
  }

  // type이 null이면 Fragment 처리
  // Fragment: 실제 태그 없이 자식들만 감싸는 용도
  // DocumentFragment는 반환 타입 제한이 있어서 div로 래핑
  if (vnode.type === null) {
    const fragment = document.createDocumentFragment();
    for (const child of vnode.children) {
      fragment.appendChild(createElement(child));
    }
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    return wrapper;
  }

  // 실제 DOM 엘리먼트 생성 (예: "div" → <div>)
  const el = document.createElement(vnode.type);

  // props를 순회하며 DOM에 적용
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key.startsWith("on") && typeof value === "function") {
      // "onClick" → "click" 이벤트로 등록
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value);
    } else if (key === "className") {
      // JSX에서 class 대신 className을 사용 (JS 예약어 충돌 방지)
      el.setAttribute("class", value);
    } else if (key === "style" && typeof value === "object") {
      // style은 객체로 전달됨 (예: { color: "red" })
      Object.assign(el.style, value);
    } else {
      // 그 외 일반 속성 (id, href, src 등)
      el.setAttribute(key, value);
    }
  }

  // 자식 노드들을 재귀적으로 생성해서 붙이기
  for (const child of vnode.children) {
    el.appendChild(createElement(child));
  }

  return el;
}
