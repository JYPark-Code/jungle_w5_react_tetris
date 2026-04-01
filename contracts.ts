// ============================================================
// contracts.ts
// 팀 공유 인터페이스 계약 파일
// 이 파일을 기준으로 모든 팀원이 병렬 개발을 진행합니다.
// 수정이 필요할 경우 반드시 지용에게 먼저 공유하세요.
// ============================================================

// ------------------------------------------------------------
// [민철 담당] VDOM + Diff + Patch + FunctionComponent
// ------------------------------------------------------------

export interface VNode {
  type: string | null;
  props: Record<string, any>;
  children: (VNode | string)[];
  key?: string | number;
}

export function createVNode(
  type: string | null,
  props: Record<string, any> | null,
  ...children: (VNode | string)[]
): VNode {
  return {
    type,
    props: props ?? {},
    children: children.flat(),
  };
}

export type PatchType =
  | "CREATE"
  | "REMOVE"
  | "REPLACE"
  | "UPDATE_PROPS"
  | "UPDATE_CHILDREN";

export interface Patch {
  type: PatchType;
  node?: VNode;
  props?: Record<string, any>;
  children?: (VNode | string)[];
}

export interface DiffResult {
  patches: Patch[];
}

/** 두 VNode 트리를 비교해 변경사항을 반환합니다 */
export type DiffFn = (oldVNode: VNode | null, newVNode: VNode | null) => DiffResult;

/** 변경사항을 실제 DOM에 반영합니다 */
export type PatchFn = (container: HTMLElement, patches: Patch[]) => void;

export interface RenderMetric {
  componentName: string;
  renderCount: number;
  lastDuration: number;   // ms
  timestamp: number;      // performance.now()
}

export interface FunctionComponentClass {
  hooks: HookState[];
  metrics: RenderMetric;
  mount(container: HTMLElement): void;
  update(): void;
}

export interface HookState {
  value: any;
  deps?: any[];
}

// ------------------------------------------------------------
// [명석 담당] useState + useEffect + useMemo + Batching
// ------------------------------------------------------------

/** 현재 렌더링 중인 FunctionComponent 인스턴스 */
export interface CurrentComponent {
  instance: FunctionComponentClass | null;
  hookIndex: number;
}

export type SetStateAction<T> = T | ((prev: T) => T);
export type UseStateTuple<T> = [T, (action: SetStateAction<T>) => void];

/** 상태를 선언하고 변경 함수를 반환합니다 */
export type UseStateFn = <T>(initialValue: T) => UseStateTuple<T>;

/** 의존성 배열이 바뀔 때 사이드 이펙트를 실행합니다 */
export type UseEffectFn = (
  callback: () => void | (() => void),
  deps?: any[]
) => void;

/** 의존성 배열이 바뀔 때만 값을 재계산합니다 */
export type UseMemoFn = <T>(factory: () => T, deps: any[]) => T;

/**
 * Batching: 동일 tick 내 여러 setState 호출을 모아
 * 단 한 번만 update()를 실행합니다
 */
export interface BatchScheduler {
  schedule(updateFn: () => void): void;
  flush(): void;
}

// ------------------------------------------------------------
// [지용님 담당] 물리 테트리스 로직
// ------------------------------------------------------------

export type TetrominoShape = number[][];

export interface Tetromino {
  shape: TetrominoShape;
  x: number;
  y: number;
  angle: number;       // 물리 기반 회전각 (degree)
  vx: number;          // x 속도
  vy: number;          // y 속도
  angularVelocity: number;
  color: string;
}

export type Board = (string | null)[][];

export interface PhysicsState {
  board: Board;
  currentPiece: Tetromino | null;
  nextPiece: Tetromino | null;
  heldPiece: Tetromino | null;   // R키로 보관한 블록
  canHold: boolean;               // 착지 전 재사용 방지
  score: number;
  level: number;
  isGameOver: boolean;
  linesCleared: number;
}

/** 중력 적용 후 새 Tetromino 반환 */
export type ApplyGravityFn = (piece: Tetromino, board: Board) => Tetromino;

/** 충돌 여부 반환 */
export type CheckCollisionFn = (piece: Tetromino, board: Board) => boolean;

/** 기울어진 블록을 라인 기준으로 절단 */
export type CutPieceAtLineFn = (
  piece: Tetromino,
  lineY: number
) => { top: Tetromino | null; bottom: Tetromino | null };

/** 완성된 라인을 제거하고 새 보드 반환 */
export type ClearLinesFn = (
  board: Board
) => { board: Board; linesCleared: number };

/** 회전 방향 */
export type RotateDirection = 'cw' | 'ccw';

/**
 * 물리 기반 회전: angularVelocity 충격량을 가해 부드럽게 회전
 * - Q키: 반시계방향(ccw), E키: 시계방향(cw)
 * - 마찰에 의해 점차 감속하는 자연스러운 회전
 */
export type RotatePieceFn = (piece: Tetromino, direction: RotateDirection) => Tetromino;

/**
 * 90도 즉시 회전 (↑키)
 * - 전통 테트리스 스타일의 즉시 90도 회전
 * - 충돌 시 회전 무시
 */
export type SnapRotateFn = (piece: Tetromino, board: Board) => Tetromino;

/** 소프트 드롭: vy를 즉시 높여 빠르게 낙하 (↓키) */
export type SoftDropFn = (state: PhysicsState) => PhysicsState;

/**
 * 현재 블록을 보관함에 저장 (R키)
 * - heldPiece 없으면: currentPiece → held, nextPiece → current
 * - heldPiece 있으면: currentPiece ↔ heldPiece 교체
 * - 착지 전 연속 사용 불가 (canHold = false)
 * - 새 블록 착지 시 canHold = true 로 초기화
 */
export type HoldPieceFn = (state: PhysicsState) => PhysicsState;

// ------------------------------------------------------------
// [지용님 담당] Not Tetris 2 — 2D 강체 물리
// ------------------------------------------------------------

/** 2D 벡터 */
export interface Vec2 {
  x: number;
  y: number;
}

/** 강체 블록 (Not Tetris 2 방식) */
export interface RigidBody {
  position: Vec2;           // 블록 중심 (픽셀 좌표)
  velocity: Vec2;           // 선속도 (픽셀/초)
  angle: number;            // 회전각 (라디안)
  angularVelocity: number;  // 각속도 (라디안/초)
  localVertices: Vec2[];    // 중심 기준 꼭짓점 (회전 전)
  color: string;
  isStatic: boolean;        // 착지 후 true
}

/** Not Tetris 2 게임 상태 */
export interface NotTetrisState {
  bodies: RigidBody[];          // 고정된 모든 강체
  activeBody: RigidBody | null; // 현재 떨어지는 블록
  heldBody: RigidBody | null;   // 보관 블록
  nextBody: RigidBody;          // 다음 블록
  canHold: boolean;
  score: number;
  level: number;
  linesCleared: number;
  isGameOver: boolean;
  boardWidth: number;
  boardHeight: number;
}

// ------------------------------------------------------------
// [지용님 담당] Flamegraph 메트릭
// ------------------------------------------------------------

export interface FlamegraphEntry {
  componentName: string;
  duration: number;      // ms
  timestamp: number;     // performance.now()
  renderIndex: number;   // 몇 번째 렌더링인지
}

export interface FlamegraphPanel {
  record(entry: FlamegraphEntry): void;
  render(container: HTMLElement): void;
  clear(): void;
}
