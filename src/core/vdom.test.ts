import { describe, it, expect } from "vitest";
import { createVNode } from "./vdom";

describe("createVNode", () => {
  it("기본 VNode를 생성한다", () => {
    const vnode = createVNode("div", { id: "app" }, "hello");
    expect(vnode.type).toBe("div");
    expect(vnode.props).toEqual({ id: "app" });
    expect(vnode.children).toEqual(["hello"]);
  });

  it("props가 null이면 빈 객체로 대체한다", () => {
    const vnode = createVNode("span", null);
    expect(vnode.props).toEqual({});
  });

  it("중첩 배열 children을 평탄화한다", () => {
    const child1 = createVNode("span", null, "a");
    const child2 = createVNode("span", null, "b");
    const vnode = createVNode("div", null, [child1, child2] as any);
    expect(vnode.children).toHaveLength(2);
    expect(vnode.children[0]).toBe(child1);
    expect(vnode.children[1]).toBe(child2);
  });

  it("null/undefined children을 필터링한다", () => {
    const vnode = createVNode("div", null, "a", null as any, undefined as any, "b");
    expect(vnode.children).toEqual(["a", "b"]);
  });

  it("숫자 children을 문자열로 변환한다", () => {
    const vnode = createVNode("div", null, 42 as any);
    expect(vnode.children).toEqual(["42"]);
  });
});
