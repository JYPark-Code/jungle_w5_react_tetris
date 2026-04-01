import type {
  VNode,
  FunctionComponentClass,
  HookState,
  RenderMetric,
} from "../../contracts";
import { current } from "./hooks";
import { createElement } from "./vdom";
import { diff } from "./diff";
import { patch } from "./patch";

type FunctionComponent<P = Record<string, any>> = (props: P) => VNode;

export class Component<P = Record<string, any>> implements FunctionComponentClass {
  hooks: HookState[] = [];
  metrics: RenderMetric;

  private fn: FunctionComponent<P>;
  private props: P;
  private container: HTMLElement | null = null;
  private prevVNode: VNode | null = null;

  constructor(fn: FunctionComponent<P>, props: P, componentName: string) {
    this.fn = fn;
    this.props = props;
    this.metrics = {
      componentName,
      renderCount: 0,
      lastDuration: 0,
      timestamp: 0,
    };
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.update();
  }

  update(): void {
    if (!this.container) return;

    const startTime = performance.now();

    // render 직전
    current.instance = this;
    current.hookIndex = 0;

    const newVNode = this.fn(this.props);

    const { patches } = diff(this.prevVNode, newVNode);

    if (this.prevVNode === null) {
      const el = createElement(newVNode);
      this.container.appendChild(el);
    } else {
      patch(this.container, patches);
    }

    this.prevVNode = newVNode;

    const duration = performance.now() - startTime;
    this.metrics.renderCount += 1;
    this.metrics.lastDuration = duration;
    this.metrics.timestamp = performance.now();
  }
}
