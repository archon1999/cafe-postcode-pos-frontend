# Agent Instructions

## General Module Architecture Guide

This guide defines a default architecture for all modules under `src/modules/*`.
Use it as the baseline unless a module has an explicit, approved exception.

### 1) Core Principles

1. Keep each module self-contained.
2. Keep `Page.tsx` components orchestration-only.
3. Keep business logic out of page containers.
4. Keep transport details (`apiClient`, DTO shapes) out of UI and domain.
5. Prefer predictable structure over creative structure.

### 2) Standard Module Structure

```text
src/modules/<module-name>/
  index.ts

  application/
    index.ts
    keys.ts
    queries.ts
    mutations.ts

  data-access/
    index.ts
    repository/
      <module>.repository.impl.ts
    mappers/
      index.ts
      *.mapper.ts
    mocks/                       # optional

  domain/
    index.ts
    contracts/
      index.ts
      <module>.repository.ts
    entities/
      index.ts
      *.types.ts
    enums/
      index.ts
      *.enums.ts
    utils/                       # optional, pure domain helpers

  ui/
    index.ts
    pages/
      <PageName>/
        <PageName>.tsx
        components/
        dialogs/
        widgets/
    shared/                      # module-local reusable ui/helpers
      index.ts
      components/
      helpers/
```

### 3) Layer Responsibilities

#### `domain/`

1. Define module business models and contracts.
2. No framework/network/UI code.
3. Export only through `domain/index.ts`.

#### `data-access/`

1. Implement domain contracts.
2. `apiClient` calls are allowed only in repository implementations.
3. Convert DTO <-> domain using mappers.
4. Keep API-specific query param serialization here.

#### `application/`

1. Expose use-cases through hooks and command/query functions.
2. Query keys are centralized in `keys.ts`.
3. React Query hooks call repository methods only.
4. Default rule: keep one `queries.ts` and one `mutations.ts` per module.
5. Export application API through `application/index.ts`.

#### `ui/`

1. Render and interaction only.
2. UI must not call `apiClient` directly.
3. Pages compose ready feature blocks and pass data/handlers.
4. Feature-specific UI stays with its page; reusable UI goes to `ui/shared`.

### 4) Page Composition Rules

1. `Page.tsx` keeps only orchestration state (selected tab, selected item, refresh token, bridge params).
2. Data-fetching and action logic should live in feature blocks/hooks used by the page.
3. If a section has its own backend calls + dialog + action flow, that section must be its own component.
4. Avoid monolithic pages; split into meaningful feature components.

### 5) Reuse and Placement Rules

Put code in module `ui/shared` when:

1. It is reused in 2+ places.
2. It is generic and likely to be reused in the same module.

Put code in global `src/shared/*` when:

1. It is used by multiple modules.
2. It is truly domain-agnostic.

Keep code page-local when:

1. It depends on one page's state/model.
2. Reuse is unclear or speculative.

### 6) Data Flow Standard

Use this direction consistently:

1. `ui -> application -> domain contract -> data-access repository -> apiClient`
2. Response mapping: `api DTO -> mapper -> domain entity -> ui`
3. Mutation payload mapping: `ui intent -> domain payload -> mapper -> api DTO`

### 7) Filters and Table Features (General)

For filterable/list pages:

1. Draft filter state and applied filter state must be separate when `Apply` UX is used.
2. Do not trigger backend filtering until user confirms apply (if UX requires explicit apply).
3. Show applied filter count badge on filter trigger button.
4. Render applied filters as removable chips (`FiltersResult` style).
5. Keep filter-to-query-param conversion in one place (single helper in feature component/file).

### 8) API Boundary Rules

1. `apiClient` must not appear in UI files.
2. `apiClient` must not appear in domain files.
3. `application` should not map DTO details; that belongs to mappers/repository.
4. If backend contract changes, update repository/mappers first, then application/UI.

### 9) Barrel Export Rules

1. Every layer should expose a stable barrel (`index.ts`).
2. Prefer importing from module barrels over deep internal paths.
3. Keep public API small and intentional.

### 10) Implementation Checklist (Before Merge)

1. Architecture path follows `ui -> application -> repository`.
2. No direct network calls in UI.
3. Domain types/constants are under `entities` / `enums`.
4. Lint passes for changed module files.
5. Type-check has no new module-level errors introduced by the change.
6. New components are placed by reuse rules, not by convenience.

### 11) Anti-Patterns to Avoid

1. Fat `Page.tsx` files with mixed rendering + business logic + API details.
2. Copy-pasted query/mutation logic across many components.
3. Scattered helper functions with unclear ownership.
4. Module-internal code dumped into global `shared` too early.
5. Premature over-layering that makes navigation harder.

### 12) Decision Rule for Splitting Files

Default:

1. Keep `queries.ts` and `mutations.ts` single-file per module.

Split only when:

1. File size/complexity clearly harms maintainability.
2. A stable subdomain boundary exists (for example, statement-details vs statement-list).
3. The split improves discoverability without adding unnecessary depth.
