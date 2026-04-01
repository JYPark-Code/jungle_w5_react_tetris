// ============================================================
// Tab 4 — ⚙️ 학습 (우리가 개발하며 발견한 것들)
// Apple Watch 스타일 스크롤 섹션 (Why 패널과 동일 구조)
// ============================================================

/** IntersectionObserver로 섹션 진입 시 visible 클래스 추가 */
function observeSection(section: HTMLElement): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      }
    },
    { threshold: 0.3 },
  );
  observer.observe(section);
}

// ============================================================
// 섹션 0: 인트로
// ============================================================

function createIntroSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'learn-section learn-intro';

  section.innerHTML = `
    <h1 class="learn-title">우리가 개발하며 발견한 것들</h1>
    <p class="learn-subtitle">구현하다 보니 이런 문제가 생겼고,<br>그걸 해결하기 위해 이 기능을 추가했습니다</p>
    <div class="learn-scroll-hint">아래로 스크롤 ↓</div>
  `;

  observeSection(section);
  return section;
}

// ============================================================
// 섹션 1: Hook 배치
// ============================================================

function createHookMappingSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'learn-section learn-two-col';

  // 왼쪽: 설명
  const left = document.createElement('div');
  left.className = 'learn-col-text';
  left.innerHTML = `
    <h2 class="learn-heading">Hook을 게임에<br>어떻게 배치했나?</h2>
    <div class="learn-hook-list">
      <div class="learn-hook-item">
        <span class="learn-hook-label" style="color:#00ff88">useState</span>
        <span class="learn-hook-desc">게임 전체 상태 / 다음 블록 / 보관 블록(1개)</span>
      </div>
      <div class="learn-hook-item">
        <span class="learn-hook-label" style="color:#4ecdc4">useEffect</span>
        <span class="learn-hook-desc">게임 루프 시작 / 키보드 이벤트 / cleanup → 해제</span>
      </div>
      <div class="learn-hook-item">
        <span class="learn-hook-label" style="color:#ffe66d">useMemo</span>
        <span class="learn-hook-desc">충돌 캐싱</span>
      </div>
      <div class="learn-hook-item">
        <span class="learn-hook-label" style="color:#f44">Batching</span>
        <span class="learn-hook-desc">setState 묶기</span>
      </div>
    </div>
  `;

  // 오른쪽: 코드 블록
  const right = document.createElement('div');
  right.className = 'learn-col-code';
  right.innerHTML = `
    <pre class="learn-code"><span style="color:#666">// 실제 App.ts 코드</span>
<span style="color:#00ff88">const</span> [state, setState]
  = <span style="color:#00ff88">useState</span>(initState());

<span style="color:#4ecdc4">useEffect</span>(() => {
  <span style="color:#666">// mount: 게임 루프 시작</span>
  <span style="color:#00ff88">const</span> id =
    requestAnimationFrame(gameLoop);

  <span style="color:#666">// cleanup: 루프 해제</span>
  <span style="color:#f44">return</span> () =>
    cancelAnimationFrame(id);
}, []);

<span style="color:#00ff88">const</span> collision =
  <span style="color:#ffe66d">useMemo</span>(() =>
    calcCollision(state),
    [state.activeBody]
  );</pre>
  `;

  section.appendChild(left);
  section.appendChild(right);
  observeSection(section);
  return section;
}

// ============================================================
// 문제 섹션 공통 빌더
// ============================================================

interface ProblemConfig {
  num: number;
  title: string;
  cause: string;
  solution: string;
  visualHTML: string;
  reversed?: boolean;
}

function createProblemSection(config: ProblemConfig): HTMLElement {
  const section = document.createElement('section');
  section.className = `learn-section learn-two-col${config.reversed ? ' learn-two-col-reverse' : ''}`;

  // 시각 영역
  const visual = document.createElement('div');
  visual.className = 'learn-col-visual';
  visual.innerHTML = config.visualHTML;

  // 텍스트 영역
  const text = document.createElement('div');
  text.className = 'learn-col-text';
  text.innerHTML = `
    <div class="learn-problem-badge">문제 ${config.num}</div>
    <h2 class="learn-problem-title">${config.title}</h2>
    <div class="learn-problem-divider"></div>
    <div class="learn-problem-detail">
      <div class="learn-problem-cause">
        <strong>원인</strong><br>${config.cause}
      </div>
      <div class="learn-problem-solution">
        <strong>해결</strong><br>${config.solution}
      </div>
    </div>
  `;

  section.appendChild(visual);
  section.appendChild(text);
  observeSection(section);
  return section;
}

// ============================================================
// 섹션 2: Batching
// ============================================================

function createBatchingSection(): HTMLElement {
  const section = createProblemSection({
    num: 1,
    title: '블록 이동 시 버벅임',
    cause: '이동(x) + 중력(y) + 회전(angle)을<br>각각 setState로 호출 → 렌더링 3회',
    solution: 'Batching으로 묶어서<br>렌더링 1회로 처리',
    visualHTML: `
      <div class="learn-counter-demo">
        <div class="learn-counter-box learn-counter-off">
          <div class="learn-counter-label">Batching OFF</div>
          <div class="learn-counter-detail">setState 3번 → 렌더링 3번</div>
          <div class="learn-counter-num" style="color:#f44">3</div>
        </div>
        <div class="learn-counter-box learn-counter-on">
          <div class="learn-counter-label">Batching ON</div>
          <div class="learn-counter-detail">setState 3번 → 렌더링 1번</div>
          <div class="learn-counter-num" style="color:#00ff88">1</div>
        </div>
      </div>
    `,
  });
  return section;
}

// ============================================================
// 섹션 3: useEffect cleanup
// ============================================================

function createCleanupSection(): HTMLElement {
  return createProblemSection({
    num: 2,
    title: '게임 재시작 시 루프 중복 실행',
    cause: 'useEffect cleanup 미구현 →<br>이전 루프가 계속 실행',
    solution: 'return () => cancelAnimationFrame(id)<br>→ mount/unmount 생명주기 완성',
    reversed: true,
    visualHTML: `
      <div class="learn-cleanup-demo">
        <div class="learn-cleanup-box learn-cleanup-bad">
          <div class="learn-cleanup-title">cleanup 없음</div>
          <div class="learn-cleanup-loops">
            <span class="learn-loop-bar" style="background:#f44;width:80%">루프 1</span>
            <span class="learn-loop-bar" style="background:#f44;width:80%">루프 2</span>
          </div>
          <div class="learn-cleanup-result">→ 블록 2배 속도</div>
        </div>
        <div class="learn-cleanup-box learn-cleanup-good">
          <div class="learn-cleanup-title">cleanup 추가</div>
          <div class="learn-cleanup-loops">
            <span class="learn-loop-bar" style="background:#00ff88;width:80%">루프 1</span>
          </div>
          <div class="learn-cleanup-result">→ 정상 속도</div>
        </div>
      </div>
    `,
  });
}

// ============================================================
// 섹션 4: useMemo
// ============================================================

function createMemoSection(): HTMLElement {
  return createProblemSection({
    num: 3,
    title: '60fps 충돌 계산 과부하',
    cause: '매 프레임 모든 블록 충돌 재계산',
    solution: 'useMemo로 deps 변경 시에만 재계산',
    visualHTML: `
      <div class="learn-counter-demo">
        <div class="learn-counter-box learn-counter-off">
          <div class="learn-counter-label">useMemo OFF</div>
          <div class="learn-counter-detail">매 프레임 전체 계산</div>
          <div class="learn-counter-num" style="color:#f44">847회/초</div>
        </div>
        <div class="learn-counter-box learn-counter-on">
          <div class="learn-counter-label">useMemo ON</div>
          <div class="learn-counter-detail">변경 시만 계산</div>
          <div class="learn-counter-num" style="color:#00ff88">43회/초</div>
        </div>
      </div>
    `,
  });
}

// ============================================================
// 섹션 5: hooks 순서
// ============================================================

function createHookOrderSection(): HTMLElement {
  return createProblemSection({
    num: 4,
    title: 'hooks[] 순서 꼬임',
    cause: 'hookIndex 초기화 누락',
    solution: 'mount/update 시 hookIndex = 0 리셋<br>"함수가 매번 실행돼도 상태 유지되는 이유"',
    reversed: true,
    visualHTML: `
      <div class="learn-hooks-demo">
        <div class="learn-hooks-box learn-hooks-correct">
          <div class="learn-hooks-title" style="color:#00ff88">올바른 순서</div>
          <div class="learn-hooks-slots">
            <div class="learn-hook-slot" style="border-color:#00ff88">hooks[0] <span style="color:#00ff88">useState</span></div>
            <div class="learn-hook-slot" style="border-color:#4ecdc4">hooks[1] <span style="color:#4ecdc4">useEffect</span></div>
            <div class="learn-hook-slot" style="border-color:#ffe66d">hooks[2] <span style="color:#ffe66d">useMemo</span></div>
          </div>
          <div class="learn-hooks-result">→ 게임 정상 작동</div>
        </div>
        <div class="learn-hooks-box learn-hooks-wrong">
          <div class="learn-hooks-title" style="color:#f44">잘못된 순서</div>
          <div class="learn-hooks-slots">
            <div class="learn-hook-slot" style="border-color:#f44">hooks[0] <span style="color:#4ecdc4">useEffect</span></div>
            <div class="learn-hook-slot" style="border-color:#f44">hooks[1] <span style="color:#00ff88">useState</span></div>
          </div>
          <div class="learn-hooks-result" style="color:#f44">→ 상태 오염 발생</div>
        </div>
      </div>
    `,
  });
}

// ============================================================
// 섹션 6: Fiber 스케줄러
// ============================================================

function createFiberSection(): HTMLElement {
  return createProblemSection({
    num: 5,
    title: '게임 루프와 UI 경쟁',
    cause: 'BatchScheduler가 모든 setState를<br>동일 우선순위로 처리',
    solution: 'Fiber 스케줄러 도입<br>urgent > normal > idle',
    visualHTML: `
      <div class="learn-fiber-demo">
        <div class="learn-fiber-box">
          <div class="learn-fiber-title">Batching만</div>
          <div class="learn-fiber-queue">
            <div class="learn-fiber-item" style="background:#555">키입력 → 대기</div>
            <div class="learn-fiber-item" style="background:#555">UI업데이트 → 대기</div>
            <div class="learn-fiber-item" style="background:#555">메트릭 → 대기</div>
          </div>
          <div class="learn-fiber-note">순서 보장 없음</div>
        </div>
        <div class="learn-fiber-box">
          <div class="learn-fiber-title" style="color:#4ecdc4">Fiber 스케줄러</div>
          <div class="learn-fiber-queue">
            <div class="learn-fiber-item" style="background:#f44">urgent: 키입력</div>
            <div class="learn-fiber-item" style="background:#c8a000">normal: UI</div>
            <div class="learn-fiber-item" style="background:#555">idle: 메트릭</div>
          </div>
          <div class="learn-fiber-note" style="color:#00ff88">우선순위 보장</div>
        </div>
      </div>
    `,
  });
}

// ============================================================
// 섹션 7: 실제 React와 비교
// ============================================================

function createComparisonSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'learn-section learn-comparison';

  section.innerHTML = `
    <h2 class="learn-comparison-title">
      우리가 겪은 문제가<br>React가 이 기능을 만든 이유였습니다
    </h2>
    <table class="learn-table">
      <thead>
        <tr>
          <th>우리 구현체</th>
          <th>실제 React 대응</th>
          <th>소스</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>FunctionComponent</td>
          <td>함수형 컴포넌트</td>
          <td></td>
        </tr>
        <tr>
          <td>hooks[] + hookIndex</td>
          <td>Fiber.memoizedState</td>
          <td><a href="https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberHooks.js" target="_blank" rel="noopener">GitHub →</a></td>
        </tr>
        <tr>
          <td>mount() / update()</td>
          <td>Reconciler</td>
          <td><a href="https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberBeginWork.js" target="_blank" rel="noopener">GitHub →</a></td>
        </tr>
        <tr>
          <td>Batching</td>
          <td>automatic batching (React 18)</td>
          <td><a href="https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js" target="_blank" rel="noopener">GitHub →</a></td>
        </tr>
        <tr>
          <td>useEffect cleanup</td>
          <td>componentWillUnmount</td>
          <td><a href="https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberCommitWork.js" target="_blank" rel="noopener">GitHub →</a></td>
        </tr>
        <tr>
          <td>Fiber 스케줄러</td>
          <td>Fiber 우선순위 큐</td>
          <td><a href="https://github.com/facebook/react/blob/main/packages/scheduler/src/forks/Scheduler.js" target="_blank" rel="noopener">GitHub →</a></td>
        </tr>
      </tbody>
    </table>
  `;

  observeSection(section);
  return section;
}

// ============================================================
// 메인 export
// ============================================================

/**
 * 학습 탭 전체 구조를 생성한다.
 * Why 패널과 동일한 Apple Watch 스타일 스크롤 섹션 (8개)
 */
export function createLifecycleTab(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'learn-container';

  container.appendChild(createIntroSection());
  container.appendChild(createHookMappingSection());
  container.appendChild(createBatchingSection());
  container.appendChild(createCleanupSection());
  container.appendChild(createMemoSection());
  container.appendChild(createHookOrderSection());
  container.appendChild(createFiberSection());
  container.appendChild(createComparisonSection());

  return container;
}
