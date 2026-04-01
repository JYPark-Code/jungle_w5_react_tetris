/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createFlamegraphPanel } from './flamegraph';
import type { FlamegraphEntry, FlamegraphPanel } from '../../contracts';

// Mock data (Prompt0.md에서 제공된 데이터)
const mockEntries: FlamegraphEntry[] = [
  { componentName: 'Board', duration: 12, timestamp: 1, renderIndex: 0 },
  { componentName: 'Block', duration: 3, timestamp: 2, renderIndex: 0 },
  { componentName: 'Score', duration: 1, timestamp: 3, renderIndex: 0 },
];

describe('FlamegraphPanel', () => {
  let panel: FlamegraphPanel;

  beforeEach(() => {
    panel = createFlamegraphPanel();
  });

  describe('record', () => {
    it('entry를 기록할 수 있어야 한다', () => {
      // record 호출 시 에러가 발생하지 않아야 한다
      expect(() => panel.record(mockEntries[0])).not.toThrow();
    });

    it('여러 entry를 순서대로 기록할 수 있어야 한다', () => {
      for (const entry of mockEntries) {
        expect(() => panel.record(entry)).not.toThrow();
      }
    });
  });

  describe('render', () => {
    it('컨테이너에 Canvas를 생성해야 한다', () => {
      for (const entry of mockEntries) {
        panel.record(entry);
      }

      const container = document.createElement('div');
      panel.render(container);

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas!.width).toBe(400);
      expect(canvas!.height).toBe(300);
    });

    it('데이터가 없으면 Canvas를 생성하지 않아야 한다', () => {
      const container = document.createElement('div');
      panel.render(container);

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeNull();
    });

    it('툴팁 요소를 생성해야 한다', () => {
      for (const entry of mockEntries) {
        panel.record(entry);
      }

      const container = document.createElement('div');
      panel.render(container);

      // 컨테이너에 tooltip div가 있어야 한다
      const children = container.children;
      expect(children.length).toBe(2); // canvas + tooltip
    });

    it('여러 renderIndex의 데이터를 처리할 수 있어야 한다', () => {
      panel.record({ componentName: 'Board', duration: 12, timestamp: 1, renderIndex: 0 });
      panel.record({ componentName: 'Board', duration: 10, timestamp: 4, renderIndex: 1 });
      panel.record({ componentName: 'Block', duration: 2, timestamp: 5, renderIndex: 1 });

      const container = document.createElement('div');
      expect(() => panel.render(container)).not.toThrow();

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('clear 후 render 시 Canvas를 생성하지 않아야 한다', () => {
      for (const entry of mockEntries) {
        panel.record(entry);
      }

      panel.clear();

      const container = document.createElement('div');
      panel.render(container);

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeNull();
    });

    it('clear 후 다시 record/render가 정상 동작해야 한다', () => {
      panel.record(mockEntries[0]);
      panel.clear();
      panel.record(mockEntries[1]);

      const container = document.createElement('div');
      panel.render(container);

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });
  });

  describe('mock data 검증', () => {
    it('제공된 mock data로 정상 렌더링되어야 한다', () => {
      // Prompt0.md에서 제공된 정확한 mock data 사용
      const entries: FlamegraphEntry[] = [
        { componentName: 'Board', duration: 12, timestamp: 1, renderIndex: 0 },
        { componentName: 'Block', duration: 3, timestamp: 2, renderIndex: 0 },
        { componentName: 'Score', duration: 1, timestamp: 3, renderIndex: 0 },
      ];

      for (const entry of entries) {
        panel.record(entry);
      }

      const container = document.createElement('div');
      expect(() => panel.render(container)).not.toThrow();

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas!.width).toBe(400);
      expect(canvas!.height).toBe(300);
    });
  });
});
