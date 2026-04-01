# Git Merge 가이드

> 안전한 merge를 위한 단계별 명령어입니다.
> 반드시 순서대로 진행하세요.

---

## 기본 원칙

```
feat/* → dev (PR via GitHub)
dev → main (로컬에서 --no-ff)
```

- Squash merge 절대 금지 (contributor 사라짐)
- 항상 --no-ff (Merge Commit 방식)
- merge 전 반드시 tsc 타입 체크

---

## M1 — feat/physics → dev

```bash
# 1. 현재 작업 저장
git checkout feat/physics
git add .
git commit -m "chore(physics): merge 전 최종 저장"
git push origin feat/physics

# 2. dev 최신화
git checkout dev
git pull origin dev

# 3. 충돌 미리 확인
git diff feat/physics..dev

# 4. merge (로컬)
git merge --no-ff feat/physics -m "feat(physics): 물리 엔진 로직 통합"

# 5. 타입 체크
npx tsc --noEmit

# 6. 이상 없으면 push
git push origin dev
```

---

## M2 — feat/flamegraph → dev

```bash
# 1. 현재 작업 저장
git checkout feat/flamegraph
git add .
git commit -m "chore(metrics): merge 전 최종 저장"
git push origin feat/flamegraph

# 2. dev 최신화 (feat/physics merge 이후 내용 반영)
git checkout dev
git pull origin dev

# 3. 충돌 미리 확인
git diff feat/flamegraph..dev

# 4. merge
git merge --no-ff feat/flamegraph -m "feat(metrics): Flamegraph 패널 통합"

# 5. 타입 체크
npx tsc --noEmit

# 6. 이상 없으면 push
git push origin dev
```

---

## M3 — feat/vdom-diff → dev (민철)

```bash
# 1. dev 최신화
git checkout dev
git pull origin dev

# 2. 충돌 미리 확인
git diff feat/vdom-diff..dev

# 3. merge
git merge --no-ff feat/vdom-diff -m "feat(core): VDOM Diff Patch FunctionComponent 통합"

# 4. 타입 체크
npx tsc --noEmit

# 5. 충돌 발생 시
# → contracts.ts 기준으로 충돌 해결
# → 절대 임의로 타입 변경 금지, 지용에게 먼저 공유

# 6. 이상 없으면 push
git push origin dev
```

---

## M4 — feat/hooks → dev (명석)

```bash
# 1. dev 최신화 (feat/vdom-diff merge 이후 내용 반영)
git checkout dev
git pull origin dev

# 2. feat/hooks에 dev 최신화 반영
git checkout feat/hooks
git merge dev
# 충돌 발생 시 contracts.ts 기준으로 해결

# 3. push 후 dev로 merge
git push origin feat/hooks
git checkout dev
git merge --no-ff feat/hooks -m "feat(core): useState useEffect useMemo Batching 통합"

# 4. 타입 체크
npx tsc --noEmit

# 5. 이상 없으면 push
git push origin dev
```

---

## M5 — feat/app → dev

```bash
# 1. dev 최신화 (모든 feat merge 이후)
git checkout feat/app
git pull origin dev
git merge dev
# 충돌 발생 시 해결 후 진행

# 2. 전체 동작 확인
# 브라우저에서 직접 실행해서 테트리스 동작 확인

# 3. push
git push origin feat/app

# 4. dev로 merge
git checkout dev
git merge --no-ff feat/app -m "feat(app): 물리 테트리스 FE 전체 통합"

# 5. 타입 체크
npx tsc --noEmit

# 6. push
git push origin dev
```

---

## 최종 — dev → main

```bash
# 1. dev 최종 확인
git checkout dev
git pull origin dev

# 2. 전체 타입 체크
npx tsc --noEmit

# 3. main으로 이동
git checkout main
git pull origin main

# 4. 충돌 미리 확인
git diff dev..main

# 5. merge (--no-ff로 contributor 보존)
git merge --no-ff dev -m "feat: 물리 테트리스 최종 릴리즈"

# 6. push
git push origin main
```

---

## 충돌 발생 시 대응

```bash
# 충돌 파일 확인
git status

# contracts.ts 충돌 시 → 절대 임의 수정 금지
# 지용에게 먼저 공유 후 결정

# 일반 파일 충돌 시
# 1. 충돌 파일 열어서 <<<< ==== >>>> 구간 확인
# 2. contracts.ts 기준으로 올바른 쪽 선택
# 3. 저장 후
git add .
git commit -m "fix: merge 충돌 해결"
```

---

## 브랜치 최종 현황 확인

```bash
# 모든 브랜치 상태 확인
git log --oneline --graph --all
```
