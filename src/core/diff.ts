import type { VNode, DiffResult, DiffFn, Patch } from "../../contracts";

/**
 * [Diff 알고리즘이란?]
 * 이전 VNode 트리(oldVNode)와 새 VNode 트리(newVNode)를 비교해서
 * "무엇이 바뀌었는지"를 Patch 목록으로 반환합니다.
 *
 * 이 Patch 목록은 patch.ts에서 실제 DOM에 반영됩니다.
 *
 * Patch 타입 정리:
 * - CREATE       : 새 노드가 추가됨
 * - REMOVE       : 기존 노드가 삭제됨
 * - REPLACE      : 노드 타입이 바뀌어서 통째로 교체
 * - UPDATE_PROPS : 같은 태그인데 속성(props)만 바뀜
 * - UPDATE_CHILDREN : 자식 노드에 변경이 있음
 */

/**
 * 두 VNode를 비교해서 DiffResult(패치 목록)를 반환합니다.
 *
 * @param oldVNode 이전 가상 DOM 트리 (null이면 처음 렌더링)
 * @param newVNode 새로운 가상 DOM 트리 (null이면 삭제)
 * @returns { patches: Patch[] } 변경사항 목록
 */
export const diff: DiffFn = (
  oldVNode: VNode | null,
  newVNode: VNode | null
): DiffResult => {
  const patches: Patch[] = [];

  // 1) 둘 다 없으면 변경 없음
  if (!oldVNode && !newVNode) {
    return { patches };
  }

  // 2) 이전 노드 없음 + 새 노드 있음 → 새로 생성
  if (!oldVNode && newVNode) {
    patches.push({ type: "CREATE", node: newVNode });
    return { patches };
  }

  // 3) 이전 노드 있음 + 새 노드 없음 → 삭제
  if (oldVNode && !newVNode) {
    patches.push({ type: "REMOVE" });
    return { patches };
  }

  // 여기서부터 oldVNode, newVNode 둘 다 존재
  const oldNode = oldVNode!;
  const newNode = newVNode!;

  // 4) 타입이 다르면 통째로 교체
  //    예) "div" → "span" 이면 기존 div를 버리고 span을 새로 만듦
  if (oldNode.type !== newNode.type) {
    patches.push({ type: "REPLACE", node: newNode });
    return { patches };
  }

  // 5) 같은 타입이면 props와 children을 각각 비교

  // props 비교 → 바뀐 속성만 추출
  const propPatches = diffProps(oldNode.props, newNode.props);
  if (propPatches) {
    patches.push({ type: "UPDATE_PROPS", props: propPatches });
  }

  // children 비교 → 자식에 변경이 있는지 확인
  if (diffChildren(oldNode.children, newNode.children)) {
    patches.push({ type: "UPDATE_CHILDREN", children: newNode.children });
  }

  return { patches };
};

/**
 * 이전 props와 새 props를 비교해서 바뀐 부분만 반환합니다.
 *
 * 예) old: { id: "a", class: "box" }
 *     new: { id: "a", class: "card", style: "color:red" }
 *     결과: { class: "card", style: "color:red" }  (id는 안 바뀌어서 제외)
 *
 * 삭제된 속성은 null로 표시합니다.
 * 예) old: { id: "a", class: "box" }
 *     new: { id: "a" }
 *     결과: { class: null }  (class가 삭제됨)
 */
function diffProps(
  oldProps: Record<string, any>,
  newProps: Record<string, any>
): Record<string, any> | null {
  const changed: Record<string, any> = {};
  let hasChange = false;

  // 추가되거나 변경된 props
  for (const key of Object.keys(newProps)) {
    if (oldProps[key] !== newProps[key]) {
      changed[key] = newProps[key];
      hasChange = true;
    }
  }

  // 삭제된 props (null로 표시)
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      changed[key] = null;
      hasChange = true;
    }
  }

  return hasChange ? changed : null;
}

/**
 * 이전 children과 새 children을 비교해서 변경 여부를 반환합니다.
 * 변경이 있으면 true, 없으면 false.
 *
 * - 개수가 다르면 바로 true
 * - 같은 위치의 자식끼리 비교 (텍스트, VNode 각각)
 * - VNode 자식은 재귀적으로 diff 수행
 */
function diffChildren(
  oldChildren: (VNode | string)[],
  newChildren: (VNode | string)[]
): boolean {
  if (oldChildren.length !== newChildren.length) return true;

  for (let i = 0; i < oldChildren.length; i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];

    // 타입 자체가 다르면 변경 (텍스트 ↔ VNode)
    if (typeof oldChild !== typeof newChild) return true;

    // 텍스트끼리 비교
    if (typeof oldChild === "string" && oldChild !== newChild) return true;

    // VNode끼리 비교 → 재귀적으로 diff 수행
    if (typeof oldChild === "object" && typeof newChild === "object") {
      const { patches } = diff(oldChild, newChild as VNode);
      if (patches.length > 0) return true;
    }
  }

  return false;
}
