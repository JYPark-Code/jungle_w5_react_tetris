/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { Component } from "./component";
import type { VNode } from "../../contracts";

function v(type: string, props: Record<string, any> = {}, children: (VNode | string)[] = []): VNode {
  return { type, props, children };
}

describe("Component", () => {
  it("mount 시 DOM에 엘리먼트를 생성한다", () => {
    const container = document.createElement("div");
    const App = () => v("p", {}, ["hello"]);
    const comp = new Component(App, {}, "App");

    comp.mount(container);

    expect(container.querySelector("p")).not.toBeNull();
    expect(container.querySelector("p")!.textContent).toBe("hello");
  });

  it("update 시 변경사항만 반영한다", () => {
    const container = document.createElement("div");
    let count = 0;
    const App = () => v("p", {}, [String(count)]);
    const comp = new Component(App, {}, "App");

    comp.mount(container);
    expect(container.querySelector("p")!.textContent).toBe("0");

    count = 1;
    comp.update();
    // update 후 DOM이 반영됨
    expect(container.textContent).toContain("1");
  });

  it("unmount 시 DOM을 제거하고 상태를 초기화한다", () => {
    const container = document.createElement("div");
    const App = () => v("div", {}, ["test"]);
    const comp = new Component(App, {}, "App");

    comp.mount(container);
    expect(container.children.length).toBeGreaterThan(0);

    comp.unmount();
    expect(container.innerHTML).toBe("");
    expect(comp.hooks).toHaveLength(0);
  });

  it("setProps로 props를 업데이트하면 재렌더링된다", () => {
    const container = document.createElement("div");
    const App = (props: { name: string }) => v("span", {}, [props.name]);
    const comp = new Component(App, { name: "민철" }, "App");

    comp.mount(container);
    expect(container.textContent).toContain("민철");

    comp.setProps({ name: "지용" });
    expect(container.textContent).toContain("지용");
  });

  it("metrics가 렌더링 횟수를 추적한다", () => {
    const container = document.createElement("div");
    const App = () => v("div", {}, []);
    const comp = new Component(App, {}, "App");

    comp.mount(container);
    expect(comp.metrics.renderCount).toBe(1);

    comp.update();
    expect(comp.metrics.renderCount).toBe(2);
  });
});
