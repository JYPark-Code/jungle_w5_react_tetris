// ============================================================
// flamegraph.ts — Flamegraph 메트릭 패널
// Canvas를 사용하여 컴포넌트 렌더링 성능을 시각화한다.
// ============================================================

import type { FlamegraphEntry, FlamegraphPanel } from '../../contracts';

// ------------------------------------------------------------
// 색상 보간 유틸리티
// ------------------------------------------------------------

/**
 * duration에 따라 초록(빠름) ~ 노란색(느림) 사이의 색상을 반환한다.
 *
 * 동작 원리:
 * 1. duration을 0~maxDuration 범위로 정규화(0~1)한다.
 * 2. 초록(#4ecdc4)과 노란색(#ffe66d) 사이를 선형 보간한다.
 * 3. RGB 각 채널별로 보간하여 hex 색상 문자열을 반환한다.
 */
function getDurationColor(duration: number, maxDuration: number): string {
  const t = Math.min(duration / Math.max(maxDuration, 1), 1);

  // 초록: #4ecdc4 → rgb(78, 205, 196)
  // 노란: #ffe66d → rgb(255, 230, 109)
  const r = Math.round(78 + (255 - 78) * t);
  const g = Math.round(205 + (230 - 205) * t);
  const b = Math.round(196 + (109 - 196) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

// ------------------------------------------------------------
// FlamegraphPanel 구현
// ------------------------------------------------------------

/**
 * Flamegraph 패널을 생성한다.
 *
 * 동작 원리:
 * - record(): 렌더링 데이터(FlamegraphEntry)를 내부 배열에 누적한다.
 * - render(): Canvas에 Flamegraph를 그린다.
 *   → 가로축: 시간순 렌더링 횟수 (renderIndex / commit 순서)
 *   → 세로축: 컴포넌트 트리 깊이 (같은 renderIndex 내에서의 순서)
 *   → 색상: duration 짧을수록 초록, 길수록 노란색
 *   → 각 막대 hover 시 컴포넌트명과 duration 툴팁 표시
 * - clear(): 누적 데이터를 초기화한다.
 */
export function createFlamegraphPanel(): FlamegraphPanel {
  let entries: FlamegraphEntry[] = [];

  return {
    /**
     * 렌더링 데이터를 누적한다.
     * 각 entry는 하나의 컴포넌트 렌더링 기록을 나타낸다.
     */
    record(entry: FlamegraphEntry): void {
      entries.push(entry);
    },

    /**
     * Canvas에 Flamegraph를 그린다.
     *
     * 동작 원리:
     * 1. 데이터를 renderIndex 기준으로 그룹핑한다.
     * 2. 각 renderIndex 그룹을 하나의 열(column)로 배치한다.
     * 3. 그룹 내 순서를 세로 깊이(depth)로 사용한다.
     * 4. 각 막대를 duration에 따른 색상으로 칠한다.
     * 5. mousemove 이벤트로 hover 시 툴팁을 표시한다.
     */
    render(container: HTMLElement): void {
      if (entries.length === 0) return;

      // Canvas 생성
      const canvas = document.createElement('canvas');
      const width = 400;
      const height = 300;
      canvas.width = width;
      canvas.height = height;
      canvas.style.border = '1px solid #333';
      canvas.style.background = '#1a1a2e';

      const ctx = canvas.getContext('2d');

      // 툴팁 요소 생성
      const tooltip = document.createElement('div');
      tooltip.style.cssText =
        'position:absolute;display:none;background:#222;color:#fff;' +
        'padding:4px 8px;border-radius:4px;font-size:12px;pointer-events:none;' +
        'white-space:nowrap;z-index:1000;';

      // 컨테이너에 추가 (ctx 없어도 DOM 구조는 유지)
      container.innerHTML = '';
      container.style.position = 'relative';
      container.appendChild(canvas);
      container.appendChild(tooltip);

      if (!ctx) return;

      // renderIndex 기준으로 그룹핑
      const groups = new Map<number, FlamegraphEntry[]>();
      for (const entry of entries) {
        const group = groups.get(entry.renderIndex) ?? [];
        group.push(entry);
        groups.set(entry.renderIndex, group);
      }

      const renderIndices = Array.from(groups.keys()).sort((a, b) => a - b);
      const maxDepth = Math.max(
        ...Array.from(groups.values()).map((g) => g.length)
      );
      const maxDuration = Math.max(...entries.map((e) => e.duration));

      // 그리기 상수
      const PADDING = 20;
      const barWidth =
        (width - PADDING * 2) / Math.max(renderIndices.length, 1);
      const barHeight = (height - PADDING * 2) / Math.max(maxDepth, 1);

      // 막대 위치 기록 (hover용)
      const barRects: {
        x: number;
        y: number;
        w: number;
        h: number;
        entry: FlamegraphEntry;
      }[] = [];

      // 축 라벨
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.fillText('← commit 순서 →', width / 2 - 40, height - 4);
      ctx.save();
      ctx.translate(10, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('← 깊이 →', -20, 0);
      ctx.restore();

      // 막대 그리기
      for (let col = 0; col < renderIndices.length; col++) {
        const group = groups.get(renderIndices[col])!;
        for (let depth = 0; depth < group.length; depth++) {
          const entry = group[depth];

          const x = PADDING + col * barWidth;
          const y = PADDING + depth * barHeight;
          const w = barWidth - 1;
          const h = barHeight - 1;

          // duration 기반 색상
          ctx.fillStyle = getDurationColor(entry.duration, maxDuration);
          ctx.fillRect(x, y, w, h);

          // 막대가 충분히 크면 컴포넌트명 표시
          if (w > 30 && h > 12) {
            ctx.fillStyle = '#000';
            ctx.font = '10px monospace';
            ctx.fillText(
              entry.componentName.slice(0, Math.floor(w / 6)),
              x + 2,
              y + h / 2 + 4
            );
          }

          barRects.push({ x, y, w, h, entry });
        }
      }

      // Hover 이벤트: 마우스 위치의 막대를 찾아 툴팁 표시
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const hit = barRects.find(
          (b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h
        );

        if (hit) {
          tooltip.textContent = `${hit.entry.componentName}: ${hit.entry.duration.toFixed(1)}ms`;
          tooltip.style.display = 'block';
          tooltip.style.left = `${e.clientX + 10}px`;
          tooltip.style.top = `${e.clientY - 20}px`;
        } else {
          tooltip.style.display = 'none';
        }
      });

      canvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });

    },

    /**
     * 누적 데이터를 초기화한다.
     */
    clear(): void {
      entries = [];
    },
  };
}
