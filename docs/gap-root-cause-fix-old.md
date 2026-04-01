# 블록 갭 근본 원인 수정 프롬프트

> 코드 실행으로 확인된 버그
> 브랜치: feat/physics

---

## 확인된 버그

```
removeLineFromPieces에서 분리된 조각의 y 위치 계산 오류

원본 J-piece cells: rows 13, 14, 15
row 14 클리어 → 남은 cells: rows 13, 15

현재 코드 (y: minY=13):
  → getRotatedCells 결과: rows 12, 14  ← 1행 위로 올라감!

수정 (y: minY + cy = 13 + 1 = 14):
  → getRotatedCells 결과: rows 13, 15  ← 정확한 위치!
```

getRotatedCells는 `cell.y = Math.round(piece.y + (rowIndex - cy))`를 계산한다.
y=minY로 설정하면 cy 오프셋만큼 위로 올라가서 위치가 틀어진다.

이로 인해:
1. 클리어 후 조각이 1행 위에 렌더링됨
2. isUnsupported가 발동 → 조각이 바닥까지 추락
3. 2~3칸 갭 발생

---

## Fix — gameState.ts 수정 (feat/physics)

```
CLAUDE.md를 참조해서 작업해줘.

현재 브랜치는 feat/physics야.

src/physics/gameState.ts의 removeLineFromPieces 함수에서
조각의 x, y 위치 계산을 수정해줘.

현재 코드 (잘못됨):
result.push({ ...piece, shape, x: minX, y: minY, angle: 0, vy: 0, vx: 0 });

수정:
// getRotatedCells는 cell.y = Math.round(piece.y + (rowIndex - cy)) 계산
// piece.y = minY + cy 로 설정해야 첫 번째 행이 minY에 배치됨
const cx = (width - 1) / 2;
const cy = (height - 1) / 2;
result.push({
  ...piece,
  shape,
  x: minX + cx,    // 기존: minX (cx 오프셋 누락)
  y: minY + cy,    // 기존: minY (cy 오프셋 누락)
  angle: 0,
  vy: 0,
  vx: 0,
});

완료 후 테스트 실행:
npx vitest run src/physics/gameState.test.ts

완료 후 커밋:
fix(physics): removeLineFromPieces 조각 위치 계산 수정 (y=minY+cy)
```
