// ============================================================
// Tab 4 — ⚙️ 학습 (우리가 발견한 것들)
// ============================================================

/**
 * Lifecycle 탭의 HTML 구조를 생성한다.
 * Hook 배치 매핑 + 문제 발견 → 해결 서사 + 구현 대응표
 */
export function createLifecycleTab(): HTMLElement {
  const container = document.createElement('div');

  container.innerHTML = `
    <div class="info-section">
      <h2>Hook을 게임에 어떻게 배치했나?</h2>
      <div class="tree-view">
<span class="component">useState</span>
├── 게임 전체 상태 (<span class="props">PhysicsState</span>)
├── 다음 블록 (<span class="props">nextPiece</span>)
└── 보관 블록 (<span class="props">heldPiece</span>, 1개 제한)

<span class="component">useEffect</span>
├── 게임 루프 시작 (mount 시)
├── 블록 착지 감지
├── 키보드 이벤트 등록
│   (<span class="props">←→ 이동, ↑ 90도회전, Q/E 자유회전, ↓ 소프트드롭, SPC 하드드롭, R 홀드</span>)
└── cleanup → 루프/이벤트 해제

<span class="component">useMemo</span>
└── 충돌 감지 결과 캐싱 (블록 위치 바뀔 때만 재계산)

<span class="component">Batching → Fiber 스케줄러</span>
└── 이동(x) + 중력(y) + 회전(angle)
    setState 3번 → 렌더링 1번
    urgent(키 입력) > normal(UI) > idle(메트릭)</div>
    </div>

    <div class="info-section">
      <h2>개발하면서 발견한 문제들</h2>

      <div class="problem-card">
        <div class="title">🔴 문제 1. 블록이 움직일 때마다 버벅임</div>
        <div class="cause">원인: setState 3번 → 렌더링 3번</div>
        <div class="solution">해결: Batching 구현 → 같은 tick 안의 setState 묶어서 1번</div>
      </div>

      <div class="problem-card">
        <div class="title">🔴 문제 2. 게임 재시작 시 루프 중복 실행</div>
        <div class="cause">원인: useEffect cleanup 미구현</div>
        <div class="solution">해결: cleanup에서 cancelAnimationFrame → mount/unmount 생명주기 완성</div>
      </div>

      <div class="problem-card">
        <div class="title">🔴 문제 3. 60fps에서 충돌 계산 과부하</div>
        <div class="cause">원인: 매 프레임 전체 블록 충돌 재계산</div>
        <div class="solution">해결: useMemo로 deps 변경 시만 재계산</div>
      </div>

      <div class="problem-card">
        <div class="title">🔴 문제 4. hooks[] 순서 꼬임</div>
        <div class="cause">원인: hookIndex 초기화 누락</div>
        <div class="solution">해결: mount/update 시 hookIndex = 0 → "함수가 매번 실행돼도 상태 유지"의 핵심</div>
      </div>

      <div class="problem-card">
        <div class="title">🔴 문제 5. R키 연속 입력 시 블록 무한 교체</div>
        <div class="cause">원인: canHold 플래그 없음</div>
        <div class="solution">해결: 착지 시 canHold = true 복원 → 실제 테트리스 룰과 동일한 제약</div>
      </div>

      <div class="problem-card">
        <div class="title">🔴 문제 6. 게임 루프와 UI 업데이트 경쟁</div>
        <div class="cause">원인: BatchScheduler가 모든 setState를 동일 우선순위로 처리</div>
        <div class="solution">해결: Fiber 스케줄러 → urgent(키입력) > normal(UI) > idle(메트릭)</div>
      </div>
    </div>

    <div class="info-section">
      <h2>실제 React와 비교해서 배운 것</h2>
      <table class="mapping-table">
        <thead>
          <tr>
            <th>우리 구현체</th>
            <th>실제 React 대응</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>FunctionComponent</td><td>함수형 컴포넌트</td></tr>
          <tr><td>hooks[] + hookIndex</td><td>Fiber.memoizedState</td></tr>
          <tr><td>mount() / update()</td><td>Reconciler</td></tr>
          <tr><td>Batching</td><td>automatic batching (React 18)</td></tr>
          <tr><td>useEffect cleanup</td><td>componentWillUnmount</td></tr>
          <tr><td>Fiber 스케줄러</td><td>Fiber 우선순위 큐</td></tr>
        </tbody>
      </table>
      <p style="margin-top: 16px; color: #ffe66d; font-size: 14px; text-align: center;">
        "우리가 겪은 문제가 React가 이 기능을 만든 이유와 동일했습니다"
      </p>
    </div>
  `;

  return container;
}
