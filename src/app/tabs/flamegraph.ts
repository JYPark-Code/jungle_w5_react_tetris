// ============================================================
// Tab 3 — 📊 Flamegraph (렌더링 메트릭 패널)
// ============================================================

import { createFlamegraphPanel } from '../../metrics/flamegraph';
import type { FlamegraphPanel } from '../../../contracts';

// 싱글톤 패널 인스턴스 (Tab 1에서도 record()로 접근)
let panelInstance: FlamegraphPanel | null = null;

/**
 * Flamegraph 패널 싱글톤을 반환한다.
 * Tab 1(Play)에서 렌더링 시간을 record()하고,
 * Tab 3에서 render()로 시각화한다.
 */
export function getFlamegraphPanel(): FlamegraphPanel {
  if (!panelInstance) {
    panelInstance = createFlamegraphPanel();
  }
  return panelInstance;
}

/**
 * Flamegraph 탭의 HTML 구조를 생성한다.
 */
export function createFlamegraphTab(): HTMLElement {
  const container = document.createElement('div');

  container.innerHTML = `
    <div class="info-section">
      <h2>렌더링 메트릭 (게임 실행 중 실시간 반영)</h2>
      <div class="flamegraph-container">
        <div class="flamegraph-canvas-wrapper" id="flamegraph-mount"></div>
      </div>
      <div style="text-align: center; margin: 12px 0;">
        <button class="game-btn" id="flamegraph-refresh-btn">새로고침</button>
        <button class="game-btn pause" id="flamegraph-clear-btn">초기화</button>
      </div>
    </div>

    <div class="info-section">
      <h2>핵심 관찰</h2>
      <div class="observation">
        <strong>Block</strong>만 매 프레임 렌더링됨<br>
        <strong>Score</strong>는 점수 바뀔 때만 렌더링됨<br>
        <strong>Board</strong>는 블록 고정 시에만 렌더링됨<br><br>
        → <strong>Component 분리 = 불필요한 렌더링 제거</strong>
      </div>
    </div>
  `;

  return container;
}

/**
 * Flamegraph 탭이 활성화될 때 Canvas를 렌더링한다.
 */
export function refreshFlamegraph(): void {
  const mount = document.getElementById('flamegraph-mount');
  if (mount) {
    getFlamegraphPanel().render(mount);
  }
}
