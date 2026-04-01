// ============================================================
// Tab 2 — 🧩 Why Tetris (주제 선정 이유)
// ============================================================

/**
 * Why Tetris 탭의 HTML 구조를 생성한다.
 * 일반 테트리스 vs 물리 테트리스 비교 + 컴포넌트 트리 시각화
 */
export function createWhyTab(): HTMLElement {
  const container = document.createElement('div');

  container.innerHTML = `
    <div class="info-section">
      <h2>왜 물리 테트리스인가?</h2>
      <div class="comparison-grid">
        <div class="comparison-col">
          <h4>일반 테트리스</h4>
          <p>블록 = 그리드 단위 이동</p>
          <p>회전 = 90도 단위</p>
          <p>라인 = 행 전체 삭제</p>
        </div>
        <div class="comparison-col">
          <h4>물리 테트리스</h4>
          <p>블록 = <strong>Component</strong></p>
          <p>State = 위치/각도/속도</p>
          <p>useEffect = 게임 루프</p>
          <p>useMemo = 충돌 캐싱</p>
        </div>
      </div>
    </div>

    <div class="info-section">
      <h2>컴포넌트 트리 시각화</h2>
      <div class="tree-view"><span class="component">&lt;TetrisApp&gt;</span>          ← 루트: State 소유 (Lifting State Up)
├── <span class="component">&lt;Board /&gt;</span>        ← <span class="props">props: board</span>
├── <span class="component">&lt;Block /&gt;</span>        ← <span class="props">props: x, y, angle, color</span>
├── <span class="component">&lt;Score /&gt;</span>        ← <span class="props">props: score, level</span>
├── <span class="component">&lt;Preview /&gt;</span>      ← <span class="props">props: nextPiece</span>
└── <span class="component">&lt;HoldPanel /&gt;</span>    ← <span class="props">props: heldPiece</span></div>
      <p style="margin-top: 12px; color: #ffffff; font-size: 16px;">
        → State는 TetrisApp(루트)에서만 관리<br>
        → 자식은 props만 받는 순수 함수
      </p>
    </div>

    <div class="info-section">
      <h2>라인 절단 — 핵심 차별점</h2>
      <p style="color: #ffffff; font-size: 16px; line-height: 1.8;">
        기울어진 블록이 완성된 라인에 걸쳐있을 때,<br>
        <strong style="color: #00ff88">cutPieceAtLine()</strong>이 블록을 수평으로 절단합니다.<br>
        절단된 위 조각은 다시 중력과 충돌의 영향을 받아 떨어집니다.<br><br>
        이것이 일반 테트리스와의 결정적 차이이며,<br>
        복잡한 상태 변화를 <strong style="color: #ffe66d">선언적으로 처리</strong>할 수 있는 이유를 증명합니다.
      </p>
    </div>
  `;

  return container;
}
