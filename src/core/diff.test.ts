import { describe, it, expect } from "vitest";
import { diff } from "./diff";
import type { VNode } from "../../contracts";

function v(type: string, props: Record<string, any> = {}, children: (VNode | string)[] = [], key?: string | number): VNode {
  return { type, props, children, key };
}

describe("diff", () => {
  it("CREATE: null → VNode", () => {
    const result = diff(null, v("div"));
    expect(result.patches).toHaveLength(1);
    expect(result.patches[0].type).toBe("CREATE");
  });

  it("REMOVE: VNode → null", () => {
    const result = diff(v("div"), null);
    expect(result.patches).toHaveLength(1);
    expect(result.patches[0].type).toBe("REMOVE");
  });

  it("REPLACE: 다른 type", () => {
    const result = diff(v("div"), v("span"));
    expect(result.patches).toHaveLength(1);
    expect(result.patches[0].type).toBe("REPLACE");
  });

  it("UPDATE_PROPS: 같은 type, 다른 props", () => {
    const result = diff(
      v("div", { id: "a" }),
      v("div", { id: "b" })
    );
    expect(result.patches.some((p) => p.type === "UPDATE_PROPS")).toBe(true);
    expect(result.patches.find((p) => p.type === "UPDATE_PROPS")!.props).toEqual({ id: "b" });
  });

  it("UPDATE_CHILDREN: 같은 type, 다른 children", () => {
    const result = diff(
      v("div", {}, ["hello"]),
      v("div", {}, ["world"])
    );
    expect(result.patches.some((p) => p.type === "UPDATE_CHILDREN")).toBe(true);
  });

  it("둘 다 null이면 변경 없음", () => {
    const result = diff(null, null);
    expect(result.patches).toHaveLength(0);
  });

  it("동일한 VNode이면 변경 없음", () => {
    const result = diff(
      v("div", { id: "a" }, ["hello"]),
      v("div", { id: "a" }, ["hello"])
    );
    expect(result.patches).toHaveLength(0);
  });

  it("key 기반 비교: 삭제된 key 감지", () => {
    const oldChildren = [v("div", {}, [], 1), v("div", {}, [], 2), v("div", {}, [], 3)];
    const newChildren = [v("div", {}, [], 1), v("div", {}, [], 3)];
    const result = diff(
      v("div", {}, oldChildren),
      v("div", {}, newChildren)
    );
    expect(result.patches.some((p) => p.type === "UPDATE_CHILDREN")).toBe(true);
  });

  it("key 기반 비교: 추가된 key 감지", () => {
    const oldChildren = [v("div", {}, [], 1)];
    const newChildren = [v("div", {}, [], 1), v("div", {}, [], 2)];
    const result = diff(
      v("div", {}, oldChildren),
      v("div", {}, newChildren)
    );
    expect(result.patches.some((p) => p.type === "UPDATE_CHILDREN")).toBe(true);
  });
});
