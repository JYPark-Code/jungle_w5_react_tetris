/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { patch } from "./patch";
import type { VNode } from "../../contracts";

function v(
  type: string,
  props: Record<string, any> = {},
  children: (VNode | string)[] = [],
  key?: string | number
): VNode {
  return { type, props, children, key };
}

describe("patch", () => {
  it("CREATE: 새 노드를 컨테이너에 추가한다", () => {
    const container = document.createElement("div");

    patch(container, [{ type: "CREATE", node: v("p", {}, ["hello"]) }]);

    expect(container.children).toHaveLength(1);
    expect(container.querySelector("p")?.textContent).toBe("hello");
  });

  it("REMOVE: 컨테이너의 마지막 자식 노드를 제거한다", () => {
    const container = document.createElement("div");
    const first = document.createElement("div");
    const second = document.createElement("span");
    container.appendChild(first);
    container.appendChild(second);

    patch(container, [{ type: "REMOVE" }]);

    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(first);
  });

  it("REPLACE: 첫 번째 자식 노드를 새 노드로 교체한다", () => {
    const container = document.createElement("div");
    container.appendChild(document.createElement("div"));

    patch(container, [{ type: "REPLACE", node: v("section", {}, ["new"]) }]);

    expect(container.firstElementChild?.tagName).toBe("SECTION");
    expect(container.textContent).toContain("new");
  });

  it("UPDATE_PROPS: 속성/스타일/className을 반영하고 null 속성은 제거한다", () => {
    const container = document.createElement("div");
    const root = document.createElement("div");
    root.setAttribute("data-remove", "x");
    container.appendChild(root);

    patch(container, [
      {
        type: "UPDATE_PROPS",
        props: {
          id: "app",
          className: "board",
          style: { color: "red" },
          "data-remove": null,
        },
      },
    ]);

    expect(root.id).toBe("app");
    expect(root.getAttribute("class")).toBe("board");
    expect(root.style.color).toBe("red");
    expect(root.hasAttribute("data-remove")).toBe(false);
  });

  it("UPDATE_PROPS: 이벤트 리스너를 교체하고 중복 등록을 방지한다", () => {
    const container = document.createElement("div");
    const root = document.createElement("button");
    container.appendChild(root);

    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    patch(container, [
      { type: "UPDATE_PROPS", props: { onClick: firstHandler } },
    ]);
    root.click();
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(0);

    patch(container, [
      { type: "UPDATE_PROPS", props: { onClick: secondHandler } },
    ]);
    root.click();
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledTimes(1);

    patch(container, [{ type: "UPDATE_PROPS", props: { onClick: null } }]);
    root.click();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it("UPDATE_CHILDREN: key 없는 children은 전체 교체한다", () => {
    const container = document.createElement("div");
    const root = document.createElement("div");
    root.appendChild(document.createElement("p"));
    container.appendChild(root);

    patch(container, [
      {
        type: "UPDATE_CHILDREN",
        children: [v("span", {}, ["a"]), "b"],
      },
    ]);

    expect(root.childNodes).toHaveLength(2);
    expect(root.firstChild).toBeInstanceOf(HTMLElement);
    expect((root.firstChild as HTMLElement).tagName).toBe("SPAN");
    expect(root.textContent).toBe("ab");
  });

  it("UPDATE_CHILDREN: key가 있으면 순서 변경을 반영한다", () => {
    const container = document.createElement("div");
    const root = document.createElement("div");
    container.appendChild(root);

    patch(container, [
      {
        type: "UPDATE_CHILDREN",
        children: [v("li", {}, ["A"], 1), v("li", {}, ["B"], 2)],
      },
    ]);
    patch(container, [
      {
        type: "UPDATE_CHILDREN",
        children: [v("li", {}, ["B"], 2), v("li", {}, ["A"], 1)],
      },
    ]);

    const keyedChildren = Array.from(root.children);
    expect(keyedChildren).toHaveLength(2);
    expect(keyedChildren[0].getAttribute("data-key")).toBe("2");
    expect(keyedChildren[1].getAttribute("data-key")).toBe("1");
  });
});
