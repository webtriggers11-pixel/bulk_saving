# FEAT-025 — plan (ADR-0035 at T1)

Backend:
1. `packages/shared`: `Page<T>`, `PageQuery { limit?, cursor? }`, `PAGE_LIMIT_DEFAULT/MAX`.
   Backend `common/pagination.ts`: `PageQueryDto` (class-validator), `paginate()` helper
   (take = limit + 1 → `nextCursor`), `pageOf()`.
2. Services: rounds (`listForSociety`, `listMine`), catalog (`listForSociety`), rounds-admin
   (`listRounds`), catalog-admin (`listServices`), vendors (`list`) — add `[..., { id }]` to
   every orderBy, cursor + skip 1, a parallel `count` for `total`.
3. Controllers: query DTOs extend `PageQueryDto`; response = `Page<T>`.
4. Integration tests per endpoint (AC5).

Web:
5. `lib/pages.ts`: `usePagedQuery` (useInfiniteQuery wrapper: `pages → items`, `total`,
   `hasMore`, `loadMore`). `components/ui/show-more.tsx`.
6. Consumers: RoundsPage (+Summary), MyRequestsPage, ServicesPage, AdminRoundsPage, Admin
   services/vendors pages, AdminNewRoundPage (service picker), Home lead (FEAT-023). Tests.
7. e2e-smoke.mjs `.items`.
