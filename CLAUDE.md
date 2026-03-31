# CLAUDE.md

> 이 파일은 Claude(AI)가 이 프로젝트에서 어떻게 동작해야 하는지를 정의합니다.
> 모든 팀원은 Claude에게 작업을 요청하기 전에 반드시 이 문서를 읽어주세요.

---

## 프로젝트 개요

커스텀 React 구현체 위에서 동작하는 **물리 기반 테트리스** 프로젝트입니다.
외부 프레임워크(React, Vue 등) 사용은 금지되며, 순수 TypeScript로 구현합니다.

---

## 역할 분담

| 담당자 | 작업 범위 |
|--------|-----------|
| 민철 | `src/core/vdom.ts`, `src/core/diff.ts`, `src/core/patch.ts`, `src/core/component.ts` |
| 명석 | `src/core/hooks.ts` (useState, useEffect, useMemo, Batching) |
| 지용 | `src/physics/`, `src/metrics/`, `src/app/`, 통합 및 버그 수정 |

> **자신의 담당 폴더 외 파일은 수정하지 않습니다.**
> 수정이 필요하면 반드시 팀장에게 먼저 공유하세요.

---

## 인터페이스 계약

`contracts.ts`를 **유일한 기준**으로 사용합니다.

- 타입, 함수 시그니처는 `contracts.ts`에서 import해서 사용합니다.
- `contracts.ts` 수정은 팀장 승인 없이 불가합니다.
- 구현 중 인터페이스가 부족하다고 느끼면 팀장에게 먼저 말하세요.

```typescript
import type { VNode, UseStateFn, PhysicsState } from '../../contracts';
```

---

## 폴더 구조

```
src/
├── core/
│   ├── vdom.ts          # 팀원 A
│   ├── diff.ts          # 팀원 A
│   ├── patch.ts         # 팀원 A
│   ├── component.ts     # 팀원 A
│   └── hooks.ts         # 팀원 B
├── physics/             # 지용님
├── metrics/             # 지용님
└── app/                 # 지용님 (통합)
contracts.ts             # 공용 인터페이스 (수정 금지)
```

---

## Git 규칙

### 브랜치 전략

```
main
└── dev
    ├── feat/vdom-diff        # 팀원 A
    ├── feat/hooks            # 팀원 B
    └── feat/physics-flamegraph  # 지용님
```

### 브랜치 시작 방법

```bash
git clone [repo]
git checkout dev
git checkout feat/[본인 브랜치명]
```

### Commit Convention

Angular Commit Convention을 사용합니다. **body는 반드시 한글로 작성합니다.**

```
<type>(<scope>): <subject>

<body - 한글>
```

**type 종류**

| type | 설명 |
|------|------|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 코드 리팩토링 |
| `test` | 테스트 추가/수정 |
| `docs` | 문서 수정 |
| `chore` | 빌드, 설정 변경 |

**예시**

```
feat(vdom): createVNode 함수 구현

- VNode 타입 정의에 따라 createVNode 구현
- children flat 처리 포함
- key props 지원 추가
```

```
fix(hooks): useState 초기값 중복 설정 버그 수정

- hookIndex 초기화 누락으로 인한 버그 수정
- mount 시 hookIndex를 0으로 리셋하도록 변경
```

### PR 규칙

- `feat/*` → `dev` 로 PR
- PR 제목도 commit convention 형식 사용
- PR은 팀장이 리뷰 후 merge

---

## Claude에게 요청하는 방법

### 좋은 요청 예시 ✅

```
contracts.ts의 DiffFn 타입을 기준으로
src/core/diff.ts에 diff 알고리즘을 구현해줘.
oldVNode와 newVNode를 비교해서 DiffResult를 반환해야 해.
```

### 나쁜 요청 예시 ❌

```
리액트 만들어줘
```

---

## 개발 우선순위

1. **구현 먼저** — 완성된 결과물을 만드는 것이 최우선
2. **이해는 나중** — 완성 후 코드 구조 파악
3. **막히면 즉시 팀장에게** — 혼자 30분 이상 막히면 바로 공유

---

## 기술 제한

- TypeScript (JS도 허용)
- HTML, CSS
- 외부 프레임워크 **사용 금지** (React, Vue 등)
- Canvas/SVG는 사용 가능
