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

/**
 * [FunctionComponent란?]
 * React의 함수형 컴포넌트와 동일한 개념입니다.
 * props를 받아서 VNode를 반환하는 함수입니다.
 *
 * 예)
 * const App = (props) => createVNode("div", null, "Hello " + props.name);
 */
type FunctionComponent<P = Record<string, any>> = (props: P) => VNode;

/**
 * [Component 클래스]
 * 함수형 컴포넌트를 감싸서 생명주기(mount, update)를 관리합니다.
 *
 * 동작 흐름:
 * 1. new Component(fn, props) → 컴포넌트 인스턴스 생성
 * 2. mount(container)         → 최초 렌더링 (DOM에 붙이기)
 * 3. update()                 → 상태 변경 시 재렌더링 (diff → patch)
 * 4. setProps(newProps)       → 부모로부터 새 props 전달 → 재렌더링
 * 5. unmount()                → cleanup 실행 + DOM 제거
 *
 * hooks 연동:
 * - update() 시 current.instance = this 를 설정해서
 *   hooks(useState 등)가 이 컴포넌트의 상태에 접근할 수 있게 합니다.
 */
export class Component<P = Record<string, any>> implements FunctionComponentClass {
  /** hooks.ts에서 관리하는 상태 저장소 (useState, useEffect 등) */
  hooks: HookState[] = [];

  /** 렌더링 성능 측정 데이터 (flamegraph 연동) */
  metrics: RenderMetric;

  /** 원본 함수형 컴포넌트 */
  private fn: FunctionComponent<P>;

  /** 컴포넌트에 전달된 props */
  private props: P;

  /** 마운트된 실제 DOM 컨테이너 */
  private container: HTMLElement | null = null;

  /** 이전 렌더링의 VNode (diff 비교용) */
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

  /**
   * 최초 렌더링: 컨테이너에 컴포넌트를 마운트합니다.
   * 내부적으로 update()를 호출해서 첫 VNode를 생성하고 DOM에 붙입니다.
   */
  mount(container: HTMLElement): void {
    this.container = container;
    this.update();
  }

  /**
   * 재렌더링: 상태 변경 시 호출됩니다.
   *
   * 순서:
   * 1. current에 자기 자신을 등록 (hooks가 이 컴포넌트를 인식하도록)
   * 2. 함수형 컴포넌트 실행 → 새 VNode 생성
   * 3. 이전 VNode와 비교(diff) → 변경사항(patches) 추출
   * 4. 변경사항을 실제 DOM에 반영(patch)
   * 5. 성능 메트릭 기록
   */
  update(): void {
    if (!this.container) return;

    const startTime = performance.now();

    // render 직전: hooks가 현재 컴포넌트를 인식할 수 있도록 등록
    current.instance = this;
    current.hookIndex = 0;

    // 함수형 컴포넌트 실행 → 새로운 VNode 트리 반환
    const newVNode = this.fn(this.props);

    // 이전 VNode와 비교해서 변경사항 추출
    const { patches } = diff(this.prevVNode, newVNode);

    if (this.prevVNode === null) {
      // 최초 렌더링: createElement로 DOM 생성 후 컨테이너에 추가
      const el = createElement(newVNode);
      this.container.appendChild(el);
    } else {
      // 업데이트: 변경된 부분만 DOM에 반영
      patch(this.container, patches);
    }

    // 다음 비교를 위해 현재 VNode 저장
    this.prevVNode = newVNode;

    // 성능 메트릭 기록 (flamegraph에서 사용)
    const duration = performance.now() - startTime;
    this.metrics.renderCount += 1;
    this.metrics.lastDuration = duration;
    this.metrics.timestamp = performance.now();
  }

  /**
   * 부모 컴포넌트에서 새 props를 전달할 때 호출합니다.
   *
   * 예) 테트리스에서 state가 바뀌면:
   *     boardComponent.setProps({ board: newBoard })
   *     → 자동으로 update() 호출 → diff → patch → DOM 반영
   */
  setProps(newProps: P): void {
    this.props = newProps;
    this.update();
  }

  /**
   * 컴포넌트를 DOM에서 제거하고 정리합니다.
   *
   * 하는 일:
   * 1. 모든 useEffect의 cleanup 함수 실행
   *    (예: keydown 이벤트 해제, requestAnimationFrame 취소)
   * 2. DOM에서 컨테이너 내용물 제거
   * 3. 내부 상태 초기화
   *
   * 이걸 안 하면:
   * - 게임 탭 벗어나도 키보드 이벤트가 계속 살아있음
   * - requestAnimationFrame 루프가 계속 돌아감
   */
  unmount(): void {
    // useEffect cleanup 일괄 실행
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
}
