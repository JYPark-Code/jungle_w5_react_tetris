// ============================================================
// Tab 2 — 🧩 Why React (Apple Watch 스타일 스크롤 섹션)
// 블록 애니메이션 + Hook 설명을 섹션별로 보여주는 스크롤 페이지
// ============================================================

/** 셀 크기 (블록 렌더링용) */
const CELL = 28;

/** 블록 색상 */
const COLORS = {
  T: '#a000f0',
  L: '#f0a000',
  I: '#00f0f0',
  S: '#00f000',
  Z: '#f00000',
  O: '#f0f000',
  J: '#0000f0',
};

// T 블록 셀 오프셋 (4칸)
const T_CELLS = [
  { x: -1, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
];

// L 블록 셀 오프셋
const L_CELLS = [
  { x: -1, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: -1 },
];

// I 블록 셀 오프셋
const I_CELLS = [
  { x: -1.5, y: 0 },
  { x: -0.5, y: 0 },
  { x: 0.5, y: 0 },
  { x: 1.5, y: 0 },
];

/** 캔버스에 테트리스 블록을 그린다 (회전 지원) */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  cells: { x: number; y: number }[],
  color: string,
  size: number = CELL,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  for (const cell of cells) {
    const x = cell.x * size;
    const y = cell.y * size;
    ctx.fillStyle = color;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  }
  ctx.restore();
}

/** IntersectionObserver로 뷰포트 진입 시 애니메이션 시작/정지 */
function observeCanvas(
  section: HTMLElement,
  startFn: () => void,
  stopFn: () => void,
): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          startFn();
        } else {
          stopFn();
        }
      }
    },
    { threshold: 0.3 },
  );
  observer.observe(section);
}

// ============================================================
// 섹션 0: 인트로 — 회전하는 T 블록
// ============================================================

function createIntroSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'why-section why-intro';

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  canvas.className = 'why-canvas';

  const textDiv = document.createElement('div');
  textDiv.className = 'why-intro-text';
  textDiv.innerHTML = `
    <h1 class="why-title">왜 React가 필요한가?</h1>
    <p class="why-subtitle">이 블록 하나를 움직이려면<br>세 가지 기능이 반드시 필요합니다</p>
    <div class="why-scroll-hint">아래로 스크롤 ↓</div>
  `;

  section.appendChild(canvas);
  section.appendChild(textDiv);

  // 애니메이션
  let angle = 0;
  let rafId: number | null = null;

  function animate(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 400, 400);
    angle += 0.01;
    drawBlock(ctx, 200, 200, angle, T_CELLS, COLORS.T, 56);
    rafId = requestAnimationFrame(animate);
  }

  observeCanvas(
    section,
    () => {
      if (!rafId) rafId = requestAnimationFrame(animate);
    },
    () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  );

  return section;
}

// ============================================================
// 섹션 1: useState — 블록 이동 + 좌표 표시
// ============================================================

function createUseStateSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'why-section why-two-col';

  // 왼쪽: 캔버스
  const left = document.createElement('div');
  left.className = 'why-col-visual';
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 560;
  canvas.className = 'why-canvas';
  left.appendChild(canvas);

  // 오른쪽: 설명
  const right = document.createElement('div');
  right.className = 'why-col-text';
  right.innerHTML = `
    <h2 class="why-hook-name" style="color:#00ff88">useState</h2>
    <p class="why-hook-desc">값 변경 + 화면 업데이트를<br>연결</p>
    <div class="why-divider"></div>
    <div class="why-compare">
      <div class="why-compare-bad">
        <strong>일반 변수:</strong><br>
        <code>x = 240</code><br>
        → 값만 바뀌고 끝 ❌<br>
        → 화면은 그대로
      </div>
      <div class="why-compare-good">
        <strong>useState:</strong><br>
        <code>const [x, setX] = useState(240)</code><br>
        <code>setX(300)</code><br>
        → 값 변경 + update()함수 호출 + 화면 렌더링 ✅
      </div>
    </div>
  `;

  section.appendChild(left);
  section.appendChild(right);

  // 애니메이션: L 블록이 좌→우 이동
  let blockX = 80;
  let blockY = 280;
  let dx = 1.5;
  let angle = 0;
  let rafId: number | null = null;
  const BLK = 50;

  function animate(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 500, 560);

    // 배경 그리드
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < 500; gx += BLK) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, 560);
      ctx.stroke();
    }
    for (let gy = 0; gy < 560; gy += BLK) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(500, gy);
      ctx.stroke();
    }

    // 블록 이동
    blockX += dx;
    if (blockX > 420 || blockX < 80) dx = -dx;
    angle += 0.005;

    drawBlock(ctx, blockX, blockY, angle, L_CELLS, COLORS.L, BLK);

    // 좌표 표시
    ctx.fillStyle = '#00ff88';
    ctx.font = '24px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`x: ${Math.round(blockX)}px`, blockX, blockY + 90);
    ctx.fillText(`y: ${Math.round(blockY)}px`, blockX, blockY + 120);
    ctx.fillText(`angle: ${(((angle * 180) / Math.PI) % 360).toFixed(0)}°`, blockX, blockY + 150);

    rafId = requestAnimationFrame(animate);
  }

  observeCanvas(
    section,
    () => {
      if (!rafId) rafId = requestAnimationFrame(animate);
    },
    () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  );

  return section;
}

// ============================================================
// 섹션 2: useEffect — 블록 낙하 시작/정지
// ============================================================

function createUseEffectSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'why-section why-two-col why-two-col-reverse';

  // 왼쪽: 설명
  const left = document.createElement('div');
  left.className = 'why-col-text';
  left.innerHTML = `
    <h2 class="why-hook-name" style="color:#4ecdc4">useEffect</h2>
    <p class="why-hook-desc">게임 시작 시 useEffect를 실행하여<br>낙하 루프를 시작</p>
    <div class="why-divider"></div>
    <p class="why-hook-detail">
      <strong style="color:#f44">cleanup이 없으면:</strong><br>
      <em>재시작할 때마다 루프가 점점 쌓임<br>
      → 한 프레임당 움직이는 속도가<br>
      쌓인만큼 빨라진다</em>
    </p>
    <p class="why-hook-detail" style="margin-top:16px"> 
      <strong style="color:#00ff88">cleanup이 있으면:</strong><br>
      <em>이전 루프를 먼저 해제한 뒤<br>
      새 루프를 시작</em>
    </p>
  `;

  // 오른쪽: 캔버스 + 버튼
  const right = document.createElement('div');
  right.className = 'why-col-visual';
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 560;
  canvas.className = 'why-canvas';

  const btnGroup = document.createElement('div');
  btnGroup.className = 'why-btn-group';
  const startBtn = document.createElement('button');
  startBtn.className = 'why-btn why-btn-start';
  startBtn.textContent = '▶ 시작 (mount)';
  const stopBtn = document.createElement('button');
  stopBtn.className = 'why-btn why-btn-stop';
  stopBtn.textContent = '■ 정지 (cleanup)';

  btnGroup.appendChild(startBtn);
  btnGroup.appendChild(stopBtn);
  right.appendChild(canvas);
  right.appendChild(btnGroup);

  section.appendChild(left);
  section.appendChild(right);

  // 애니메이션: I 블록 낙하
  let blockY = 60;
  let falling = false;
  let rafId: number | null = null;
  let sectionVisible = false;
  const BLK = 50;

  function draw(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 500, 560);

    // 배경 그리드
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < 500; gx += BLK) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, 560);
      ctx.stroke();
    }
    for (let gy = 0; gy < 560; gy += BLK) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(500, gy);
      ctx.stroke();
    }

    if (falling) {
      blockY += 1.5;
      if (blockY > 520) blockY = 60; // 리셋
    }

    drawBlock(ctx, 250, blockY, 0, I_CELLS, COLORS.I, BLK);

    // 상태 표시
    ctx.fillStyle = falling ? '#00ff88' : '#f44';
    ctx.font = '24px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(falling ? 'useEffect 실행 중...' : '대기 중', 250, 545);

    if (sectionVisible) {
      rafId = requestAnimationFrame(draw);
    }
  }

  startBtn.addEventListener('click', () => {
    falling = true;
    blockY = 30;
  });

  stopBtn.addEventListener('click', () => {
    falling = false;
  });

  observeCanvas(
    section,
    () => {
      sectionVisible = true;
      if (!rafId) rafId = requestAnimationFrame(draw);
    },
    () => {
      sectionVisible = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      falling = false;
    },
  );

  return section;
}

// ============================================================
// 섹션 3: useMemo — 충돌 계산 횟수 비교
// ============================================================

function createUseMemoSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'why-section why-two-col';

  // 왼쪽: 캔버스
  const left = document.createElement('div');
  left.className = 'why-col-visual';
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 560;
  canvas.className = 'why-canvas';

  const btnGroup = document.createElement('div');
  btnGroup.className = 'why-btn-group';
  const offBtn = document.createElement('button');
  offBtn.className = 'why-btn why-btn-stop';
  offBtn.textContent = 'useMemo OFF';
  const onBtn = document.createElement('button');
  onBtn.className = 'why-btn why-btn-start';
  onBtn.textContent = 'useMemo ON';
  btnGroup.appendChild(offBtn);
  btnGroup.appendChild(onBtn);
  left.appendChild(canvas);
  left.appendChild(btnGroup);

  // 오른쪽: 설명
  const right = document.createElement('div');
  right.className = 'why-col-text';
  right.innerHTML = `
    <h2 class="why-hook-name" style="color:#ffe66d">useMemo</h2>
    <p class="why-hook-desc">변경된 부분만<br>다시 계산합니다</p>
    <div class="why-divider"></div>
    <p class="why-hook-detail">
      <strong style="color:#f44">OFF:</strong>
      <em>충돌 계산을 처음부터 끝까지<br>매 프레임 전부 수행</em>
    </p>
    <p class="why-hook-detail" style="margin-top:16px">
      <strong style="color:#00ff88">ON:</strong>
      <em>충돌 직전부터만 계산 시작<br>
      → OFF보다 현저히 적은 계산 횟수</em>
    </p>
  `;

  section.appendChild(left);
  section.appendChild(right);

  // 애니메이션: 쌓인 블록 + 새 블록 낙하 + 충돌 점
  let useMemoOn = true;
  let calcCountOff = 0;
  let calcCountOn = 0;
  let frameCount = 0;
  let fallingY = 40;
  let rafId: number | null = null;
  const BLK = 50;

  // 바닥에 쌓인 블록 위치들
  const stackedBlocks = [
    { x: 100, y: 500 },
    { x: 150, y: 500 },
    { x: 200, y: 500 },
    { x: 250, y: 500 },
    { x: 300, y: 500 },
    { x: 350, y: 500 },
    { x: 400, y: 500 },
    { x: 150, y: 450 },
    { x: 200, y: 450 },
    { x: 250, y: 450 },
    { x: 300, y: 450 },
    { x: 350, y: 450 },
  ];

  offBtn.addEventListener('click', () => {
    useMemoOn = false;
    calcCountOff = 0;
    calcCountOn = 0;
    frameCount = 0;
    fallingY = 40;
  });

  onBtn.addEventListener('click', () => {
    useMemoOn = true;
    calcCountOff = 0;
    calcCountOn = 0;
    frameCount = 0;
    fallingY = 40;
  });

  function animate(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 500, 560);

    frameCount++;
    fallingY += 1;
    if (fallingY > 400) fallingY = 40;

    // 쌓인 블록 그리기
    for (const b of stackedBlocks) {
      ctx.fillStyle = '#333';
      ctx.fillRect(b.x - BLK / 2, b.y - BLK / 2, BLK, BLK);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x - BLK / 2, b.y - BLK / 2, BLK, BLK);
    }

    // 낙하 블록
    drawBlock(ctx, 250, fallingY, 0, T_CELLS, COLORS.T, BLK);

    // 충돌 계산 시각화
    if (!useMemoOn) {
      // OFF: 매 프레임 모든 블록에 빨간 점
      calcCountOff++;
      for (const b of stackedBlocks) {
        ctx.fillStyle = 'rgba(255, 68, 68, 0.8)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // ON: 낙하 블록 근처만 빨간 점 (가까운 블록만)
      const nearBlocks = stackedBlocks.filter(
        (b) => Math.abs(b.x - 250) < 100 && Math.abs(b.y - fallingY) < 140,
      );
      if (nearBlocks.length > 0) calcCountOn++;
      for (const b of nearBlocks) {
        ctx.fillStyle = 'rgba(0, 255, 136, 0.8)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 카운터 표시
    ctx.fillStyle = '#fff';
    ctx.font = '22px Consolas, monospace';
    ctx.textAlign = 'left';
    if (!useMemoOn) {
      ctx.fillStyle = '#f44';
      ctx.fillText(`useMemo OFF — 충돌 계산: ${calcCountOff}회`, 16, 30);
    } else {
      ctx.fillStyle = '#00ff88';
      ctx.fillText(`useMemo ON — 충돌 계산: ${calcCountOn}회`, 16, 30);
    }

    rafId = requestAnimationFrame(animate);
  }

  observeCanvas(
    section,
    () => {
      if (!rafId) rafId = requestAnimationFrame(animate);
    },
    () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  );

  return section;
}

// ============================================================
// 섹션 4: Component 분리 — 컴포넌트 트리 + 하이라이트
// ============================================================

function createComponentSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'why-section why-component';

  const header = document.createElement('div');
  header.className = 'why-component-header';
  header.innerHTML = `
    <h2 class="why-hook-name" style="color:#4ecdc4">왜 함수형 컴포넌트로 나눠서 만들까?</h2>
    <p class="why-hook-desc">블록만 움직이면<br>diff가 Block만 바뀌었다고 판단합니다</p>
  `;

  const body = document.createElement('div');
  body.className = 'why-component-body';

  // 왼쪽: 캔버스
  const left = document.createElement('div');
  left.className = 'why-col-visual';
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 560;
  canvas.className = 'why-canvas';
  left.appendChild(canvas);

  // 오른쪽: 컴포넌트 트리 (DOM)
  const right = document.createElement('div');
  right.className = 'why-col-text why-tree';
  right.innerHTML = `
    <div class="why-tree-node why-tree-root">TetrisApp <span style="color:#666">← State 소유</span></div>
    <div class="why-tree-node" id="why-tree-block">├── Block <span class="why-tree-badge why-badge-red">🔴 렌더링</span></div>
    <div class="why-tree-node" id="why-tree-board">├── Board <span class="why-tree-badge why-badge-gray">⚪ 건너뜀</span></div>
    <div class="why-tree-node" id="why-tree-score">├── Score <span class="why-tree-badge why-badge-gray">⚪ 건너뜀</span></div>
    <div class="why-tree-node" id="why-tree-hold">└── Hold <span class="why-tree-badge why-badge-gray">⚪ 건너뜀</span></div>
    <p class="why-tree-note">Block만 바뀌었으므로<br>나머지는 렌더링하지 않고 건너뜁니다</p>
  `;

  body.appendChild(left);
  body.appendChild(right);
  section.appendChild(header);
  section.appendChild(body);

  // 애니메이션: 블록 이동 + 트리 노드 깜빡임
  let blockX = 140;
  let blockDx = 1.2;
  let blinkTimer = 0;
  let rafId: number | null = null;
  const BLK = 50;

  function animate(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 500, 560);

    // 배경 그리드
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < 500; gx += BLK) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, 560);
      ctx.stroke();
    }
    for (let gy = 0; gy < 560; gy += BLK) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(500, gy);
      ctx.stroke();
    }

    // 바닥 블록들
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = '#333';
      ctx.fillRect(i * BLK, 510, BLK, BLK);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(i * BLK, 510, BLK, BLK);
    }

    // 이동하는 블록
    blockX += blockDx;
    if (blockX > 400 || blockX < 100) blockDx = -blockDx;
    drawBlock(ctx, blockX, 280, 0, T_CELLS, COLORS.T, BLK);

    // 트리 노드 깜빡임
    blinkTimer++;
    const blockNode = document.getElementById('why-tree-block');
    if (blockNode) {
      if (blinkTimer % 30 < 15) {
        blockNode.style.color = '#f44';
        blockNode.style.textShadow = '0 0 8px rgba(255,68,68,0.5)';
      } else {
        blockNode.style.color = '#fff';
        blockNode.style.textShadow = 'none';
      }
    }

    rafId = requestAnimationFrame(animate);
  }

  observeCanvas(
    section,
    () => {
      if (!rafId) rafId = requestAnimationFrame(animate);
    },
    () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  );

  return section;
}

// ============================================================
// 메인 export
// ============================================================

/**
 * Why 탭 전체 구조를 생성한다.
 * Apple Watch 스타일 스크롤 섹션 (5개)
 */
export function createWhyTab(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'why-container';

  container.appendChild(createIntroSection());
  container.appendChild(createUseStateSection());
  container.appendChild(createUseEffectSection());
  container.appendChild(createUseMemoSection());
  container.appendChild(createComponentSection());

  return container;
}
