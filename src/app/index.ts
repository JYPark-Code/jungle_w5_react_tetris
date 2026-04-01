// ============================================================
// src/app/index.ts — 4탭 SPA 진입점
// custom React Component 마운트 + 탭 전환
// ============================================================

import { Component } from '../core/component';
import { TetrisAppFn } from './TetrisApp';
import { createPlayTab } from './tabs/play';
import { createWhyTab } from './tabs/why';
import { createFlamegraphTab, refreshFlamegraph } from './tabs/flamegraph';
import { createLifecycleTab } from './tabs/lifecycle';
import { metricsStore } from './metricsStore';

// ─── 탭 전환 ─────────────────────────────────────────────────
type TabId = 'play' | 'why' | 'flamegraph' | 'lifecycle';

const TABS: { id: TabId; label: string }[] = [
  { id: 'play', label: '🎮 Play' },
  { id: 'why', label: '🧩 Why' },
  { id: 'flamegraph', label: '📊 Flame' },
  { id: 'lifecycle', label: '⚙️ 학습' },
];

function getCurrentTab(): TabId {
  const hash = window.location.hash.replace('#', '') as TabId;
  return TABS.some((t) => t.id === hash) ? hash : 'play';
}

function switchTab(tabId: TabId): void {
  document.querySelectorAll('.tab-content').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((el) => el.classList.remove('active'));
  document.getElementById(`tab-${tabId}`)?.classList.add('active');
  document.getElementById(`btn-${tabId}`)?.classList.add('active');
  if (tabId === 'flamegraph') refreshFlamegraph();
  window.location.hash = tabId;
}

// ─── 앱 초기화 ────────────────────────────────────────────────
function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // 네비게이션 바
  const nav = document.createElement('nav');
  nav.className = 'nav-tabs';
  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.id = `btn-${tab.id}`;
    btn.textContent = tab.label;
    btn.addEventListener('click', () => switchTab(tab.id));
    nav.appendChild(btn);
  }
  app.appendChild(nav);

  // 탭 콘텐츠
  const tabConfigs: { id: TabId; create: () => HTMLElement }[] = [
    { id: 'play', create: createPlayTab },
    { id: 'why', create: createWhyTab },
    { id: 'flamegraph', create: createFlamegraphTab },
    { id: 'lifecycle', create: createLifecycleTab },
  ];

  for (const { id, create } of tabConfigs) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tab-content';
    wrapper.id = `tab-${id}`;
    wrapper.appendChild(create());
    app.appendChild(wrapper);
  }

  // ─── custom React Component 마운트 ───────────────────────
  const el = document.querySelector('.score-panel') as HTMLElement;
  if (el) {
    new Component(TetrisAppFn, {
      boardCanvas: document.getElementById('board-canvas') as HTMLCanvasElement,
      nextCanvas: document.getElementById('next-canvas') as HTMLCanvasElement,
      holdCanvas: document.getElementById('hold-canvas') as HTMLCanvasElement,
    }, 'TetrisApp').mount(el);
  }

  // Flamegraph 버튼
  document.getElementById('flamegraph-refresh-btn')?.addEventListener('click', refreshFlamegraph);
  document.getElementById('flamegraph-clear-btn')?.addEventListener('click', () => {
    metricsStore.clear();
    refreshFlamegraph();
  });

  switchTab(getCurrentTab());
  window.addEventListener('hashchange', () => switchTab(getCurrentTab()));
}

document.addEventListener('DOMContentLoaded', initApp);
