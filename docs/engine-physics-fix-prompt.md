# 물리 엔진 핵심 버그 수정 프롬프트

> 브랜치: feat/app

---

## 근본 원인 5가지 분석

```
1. 공중 정지:  위치보정 0.5×2회=1px 위 > 중력 0.5px 아래 → 블록 뜸
2. 착지 판정:  거리 4px 기준 → 회전 블록 오판 → 다음 블록 안 나옴
3. 파편 미착지: fragment isStatic=false 유지 → 라인 클리어 집계 안 됨 → 점수 0
4. 미리보기:   사각형만 그림 → 블록 모양 안 보임
5. PAUSE:     keys가 useEffect deps → 키 누를 때마다 루프 재시작
```

---

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/app이야.

아래 5개 수정을 순서대로 적용해줘. 한글 주석 필수.

===================================================
수정 1: src/physics/engine.ts
===================================================

1a. resolveBodyCollisions 위치 보정 0.5 → 0.08

// 기존 (너무 강해서 중력을 이김)
if (!a.isStatic) result[i].position = v2.sub(result[i].position, v2.scale(corr, 0.5));
if (!b.isStatic) result[j].position = v2.add(result[j].position, v2.scale(corr, 0.5));

// 수정 (약하게 → 중력 항상 우선)
if (!a.isStatic) result[i].position = v2.sub(result[i].position, v2.scale(corr, 0.08));
if (!b.isStatic) result[j].position = v2.add(result[j].position, v2.scale(corr, 0.08));

1b. 반복 횟수 3 → 1

for (let iter = 0; iter < 1; iter++) {

1c. checkLanding 예측 충돌 방식으로 교체 (함수 전체 교체)

// 기존: 거리 기반(4px) — 회전 블록에서 오판
// 수정: 1px 아래 가상 이동 후 SAT 충돌 여부로 판정
export function checkLanding(body: Body, statics: Body[]): boolean {
  if (body.isStatic) return false;

  // 1px 아래 테스트 위치
  const testPos: Vec2 = { x: body.position.x, y: body.position.y + 1 };

  // 바닥 체크
  const testVerts = body.parts.flatMap(p => getWorldVerts(p, testPos, body.angle));
  if (Math.max(...testVerts.map(v => v.y)) >= BOARD_HEIGHT) return true;

  // static body와 SAT 충돌 체크
  for (const s of statics) {
    for (const pa of body.parts) {
      const wva = getWorldVerts(pa, testPos, body.angle);
      for (const pb of s.parts) {
        const wvb = getWorldVerts(pb, s.position, s.angle);
        if (checkCollision(wva, wvb).colliding) return true;
      }
    }
  }
  return false;
}

===================================================
수정 2: src/physics/gameState.ts
===================================================

nextTick에서 물리 스텝 이후, 파편(non-active dynamic body)도
착지 판정 후 isStatic으로 전환 추가.

// 물리 스텝 4개(applyGravity, integratePosition, resolveBodyCollisions, applyWallConstraints) 이후:

// 파편 착지 처리 (라인 클리어 집계 위해 필수)
const allStaticsNow = bodies.filter(b => b.isStatic);
bodies = bodies.map(b => {
  if (b.isStatic || b.id === state.activeId) return b;
  if (checkLanding(b, allStaticsNow)) {
    return { ...b, isStatic: true, velocity: { x:0, y:0 }, angularVelocity: 0 };
  }
  return b;
});

===================================================
수정 3: src/physics/renderer.ts
===================================================

renderPreview 함수 전체 교체 — 실제 테트로미노 모양 렌더링.
createTetromino와 getWorldVerts를 import해서 사용.

import { createTetromino, getWorldVerts } from './engine';  // 상단 import에 추가

export function renderPreview(
  canvas: HTMLCanvasElement,
  kind: number | null,
  colors: Record<number, string>
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!kind) return;

  // 임시 body로 모양 계산
  const dummy = createTetromino(kind, 0, 0);
  const allVerts = dummy.parts.flatMap(p =>
    getWorldVerts(p, dummy.position, 0)
  );

  // 바운딩 박스
  const minX = Math.min(...allVerts.map(v => v.x));
  const maxX = Math.max(...allVerts.map(v => v.x));
  const minY = Math.min(...allVerts.map(v => v.y));
  const maxY = Math.max(...allVerts.map(v => v.y));
  const w = maxX - minX || 1, h = maxY - minY || 1;

  const padding = 10;
  const scale = Math.min(
    (canvas.width - padding * 2) / w,
    (canvas.height - padding * 2) / h
  );
  const offsetX = canvas.width / 2 - (minX + w / 2) * scale;
  const offsetY = canvas.height / 2 - (minY + h / 2) * scale;

  ctx.fillStyle = colors[kind] ?? '#888';
  for (const part of dummy.parts) {
    const verts = getWorldVerts(part, dummy.position, 0);
    ctx.beginPath();
    ctx.moveTo(verts[0].x * scale + offsetX, verts[0].y * scale + offsetY);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x * scale + offsetX, verts[i].y * scale + offsetY);
    }
    ctx.closePath();
    ctx.fill();
  }
}

===================================================
수정 4: src/app/TetrisApp.ts
===================================================

4a. keys를 모듈 레벨 전역 객체로 분리 (useState 제거)
    → useEffect deps에서 keys 제거 → 키 입력 시 루프 재시작 방지

// TetrisAppFn 함수 바깥 (모듈 상단):
const _keys = { left:false, right:false, rotateLeft:false, rotateRight:false, down:false };

// TetrisAppFn 내부에서:
// const [keys, setKeys] = useState 제거

// useEffect 게임 루프:
useEffect(() => {
  if (!isRunning || isPaused) return;
  let last = 0, id = 0;
  const loop = (t: number) => {
    const dt = last > 0 ? Math.min((t - last) / 1000, 0.05) : 1 / 60;
    last = t;
    setGameState(prev => nextTick(prev, dt, _keys)); // 전역 _keys 참조
    id = requestAnimationFrame(loop);
  };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}, [isRunning, isPaused]); // keys 의존성 제거!

// useEffect 키보드:
const onDown = (e: KeyboardEvent) => {
  ...
  // setKeys 대신 _keys 직접 수정
  _keys.left = pressed.has('ArrowLeft');
  _keys.right = pressed.has('ArrowRight');
  _keys.rotateLeft = pressed.has('q') || pressed.has('Q');
  _keys.rotateRight = pressed.has('e') || pressed.has('E');
  _keys.down = pressed.has('ArrowDown');
};

4b. PAUSE 버튼 onclick 단순화

// 기존
onclick: () => { if (isRunning) setIsPaused((p: boolean) => !p); },

// 수정 (isRunning 조건 제거 — 항상 토글, 루프 deps로 제어)
onclick: () => setIsPaused((p: boolean) => !p),

===================================================
최종 확인
===================================================

[ ] 블록이 다른 블록 위에 착지 → 다음 블록 스폰
[ ] 파편이 착지 후 isStatic → 라인 클리어 트리거
[ ] 점수/라인 수 증가
[ ] 미리보기에 테트로미노 모양 표시
[ ] PAUSE/RESUME 토글 정상
[ ] 블록이 공중에 안 뜸

완료 후 커밋:
fix(physics): 착지 예측충돌 방식 + 파편 착지 + 미리보기 + PAUSE 수정
```
