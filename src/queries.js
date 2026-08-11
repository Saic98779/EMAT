// Centralised query-key catalogue + hooks. All React Query interactions in
// the app should go through here so mutations know which caches to invalidate
// after an update.
//
// Key shape convention:
//   [entity, kind, ...selectors]
// e.g. ['ias', 'list'], ['ias', 'detail', uuid], ['appraisals', 'byRegistration', regUuid]
//
// When you add a new endpoint:
//   1. Add its key here in queryKeys.
//   2. Add a `useX` (query) or `useXMutation` hook.
//   3. In the mutation's onSuccess, call qc.invalidateQueries({ queryKey: keys.X })
//      for anything that could be affected.
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  listIndustryAssociations,
  getIndustryAssociation,
  approveIndustryAssociation,
  updateIndustryAssociation,
  fromDto as iaFromDto,
} from './apis/industryAssociations'
import {
  listAppraisals,
  getAppraisal,
  getAppraisalByRegistration,
  createAppraisal,
  updateAppraisal,
  approveAppraisal,
  fromDto as appraisalFromDto,
} from './apis/industryAssociationAppraisals'
import {
  listBseRecommendations,
  getBseRecommendation,
  searchBseRecommendations,
  listBseRecommendationsByGtStatus,
  listBseRecommendationsByPmuStatus,
  listBseRecommendationsByHoStatus,
  listBseRecommendationsByMappedStatus,
  listBseRecommendationsByRegistration,
  listBseByUserSelected,
  createBseRecommendation,
  updateBseRecommendation,
  fromDto as bseFromDto,
} from './apis/bseRecommendations'
import { searchUsers, listUsersByRole, unwrapList as unwrapUsers } from './apis/users'
import { listBranchesByState, listSdesByBranch } from './apis/dropdowns'
import {
  listVendors, getVendor, getVendorByUser, createVendor, updateVendor, deleteVendor,
  listVendorsDropdown,
} from './apis/vendors'
import { listFiles } from './apis/files'
import {
  listVendorDisbursements, getVendorDisbursement,
  updateVendorDisbursement, deleteVendorDisbursement,
} from './apis/vendorDisbursements'
import {
  listDisbursementCapex, getDisbursementCapex,
  listDisbursementCapexByRegistration,
  createDisbursementCapex, updateDisbursementCapex, deleteDisbursementCapex,
} from './apis/disbursementCapex'

// ── Key catalogue ─────────────────────────────────────────────────────────
export const keys = {
  ias: {
    all: ['ias'],
    lists: () => ['ias', 'list'],
    detail: (uuid) => ['ias', 'detail', uuid],
  },
  appraisals: {
    all: ['appraisals'],
    lists: () => ['appraisals', 'list'],
    detail: (uuid) => ['appraisals', 'detail', uuid],
    byRegistration: (regUuid) => ['appraisals', 'byRegistration', regUuid],
  },
  bse: {
    all: ['bse'],
    lists: () => ['bse', 'list'],
    detail: (uuid) => ['bse', 'detail', uuid],
    search: (name) => ['bse', 'search', name],
    byGtStatus: (status) => ['bse', 'gt-status', status],
    byPmuStatus: (status) => ['bse', 'pmu-status', status],
    byHoStatus: (status) => ['bse', 'ho-status', status],
    byMappedStatus: (status) => ['bse', 'mapped', status],
    byRegistration: (regUuid) => ['bse', 'byRegistration', regUuid],
    byUserSelected: (userId) => ['bse', 'byUserSelected', String(userId)],
  },
  users: {
    all: ['users'],
    search: (params) => ['users', 'search', params],
    byRole: (role) => ['users', 'byRole', role],
  },
  branches: {
    byState: (state) => ['branches', 'byState', state],
  },
  sdes: {
    byBranch: (branchUuid) => ['sdes', 'byBranch', branchUuid],
  },
  vendors: {
    all: ['vendors'],
    lists: () => ['vendors', 'list'],
    detail: (uuid) => ['vendors', 'detail', uuid],
    byUser: (userId) => ['vendors', 'byUser', String(userId)],
    dropdown: () => ['vendors', 'dropdown'],
  },
  vendorDisbursements: {
    all: ['vendor-disbursements'],
    lists: () => ['vendor-disbursements', 'list'],
    detail: (id) => ['vendor-disbursements', 'detail', String(id)],
  },
  capex: {
    all: ['capex'],
    lists: () => ['capex', 'list'],
    detail: (uuid) => ['capex', 'detail', uuid],
    byRegistration: (regUuid) => ['capex', 'byRegistration', regUuid],
  },
  files: {
    byRegistration: (regUuid) => ['files', 'byRegistration', regUuid],
  },
}

// Backends may return a raw array, a Spring Page (`{ content: [] }`), or the
// generic `{ items: [] }` shape.
function unwrapList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  return []
}

// ── IA registrations ──────────────────────────────────────────────────────
// The list view derives its status from both the registration and its linked
// appraisal — so we fetch both in parallel and join by registrationUuid.
export function useIAs({ enabled = true } = {}) {
  return useQuery({
    queryKey: keys.ias.lists(),
    enabled,
    queryFn: async ({ signal }) => {
      const [regsRaw, apprsRaw] = await Promise.all([
        listIndustryAssociations({ signal }),
        listAppraisals({ signal }).catch(() => []),
      ])
      const regs = unwrapList(regsRaw)
      const apprs = unwrapList(apprsRaw)
      const byReg = new Map(apprs.map((a) => [a.registrationUuid, a]).filter(([k]) => !!k))
      return regs.map((r) => iaFromDto(r, byReg.get(r.uuid) || null))
    },
  })
}

export function useIA(uuid, options = {}) {
  return useQuery({
    queryKey: keys.ias.detail(uuid),
    enabled: !!uuid && (options.enabled ?? true),
    queryFn: async ({ signal }) => {
      const [reg, appr] = await Promise.all([
        getIndustryAssociation(uuid, { signal }),
        getAppraisalByRegistration(uuid, { signal }).catch(() => null),
      ])
      return iaFromDto(reg, appr || null)
    },
  })
}

export function useApproveIA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, isSidbeApproved = true }) =>
      approveIndustryAssociation(uuid, { isSidbeApproved }),
    onSuccess: (updated, { uuid }) => {
      // Push the response into the detail cache immediately so the page
      // reflects the new state without another network round-trip.
      if (updated) {
        qc.setQueryData(keys.ias.detail(uuid), (prev) =>
          iaFromDto(updated, prev?.appraisal ?? null),
        )
      }
      qc.invalidateQueries({ queryKey: keys.ias.lists() })
    },
  })
}

// SDE edit — PUT the full IA registration. Used pre-L1-approval to correct
// any field GT captured. On success we swap the detail cache with the
// returned DTO so the review page shows the edits without a re-fetch.
export function useUpdateIA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, values, extra }) => updateIndustryAssociation(uuid, values, extra),
    onSuccess: (updated, { uuid }) => {
      if (updated) {
        qc.setQueryData(keys.ias.detail(uuid), (prev) =>
          iaFromDto(updated, prev?.appraisal ?? null),
        )
      }
      qc.invalidateQueries({ queryKey: keys.ias.lists() })
    },
  })
}

// ── IA appraisals (Level 2) ───────────────────────────────────────────────
export function useAppraisals({ enabled = true } = {}) {
  return useQuery({
    queryKey: keys.appraisals.lists(),
    enabled,
    queryFn: ({ signal }) => listAppraisals({ signal }).then((d) => unwrapList(d).map(appraisalFromDto)),
  })
}

export function useAppraisal(uuid) {
  return useQuery({
    queryKey: keys.appraisals.detail(uuid),
    enabled: !!uuid,
    queryFn: ({ signal }) => getAppraisal(uuid, { signal }).then(appraisalFromDto),
  })
}

// Returns the raw appraisal DTO (not fromDto-mapped) — the GT Appraisal form
// needs the full backend field set to prefill.
export function useAppraisalByRegistration(regUuid) {
  return useQuery({
    queryKey: keys.appraisals.byRegistration(regUuid),
    enabled: !!regUuid,
    queryFn: ({ signal }) => getAppraisalByRegistration(regUuid, { signal }).catch(() => null),
  })
}

// GT submits the detailed appraisal for the first time. On success we
// invalidate the parent IA (status flips to "Final Review (L2)") + lists.
// registrationUuid is read from the *request* body — we can't rely on the
// response echoing it back.
export function useCreateAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => createAppraisal(body),
    onSuccess: (created, body) => {
      const regUuid = body?.registrationUuid || created?.registrationUuid
      if (created && regUuid) qc.setQueryData(keys.appraisals.byRegistration(regUuid), created)
      qc.invalidateQueries({ queryKey: keys.appraisals.lists() })
      if (regUuid) qc.invalidateQueries({ queryKey: keys.ias.detail(regUuid) })
      qc.invalidateQueries({ queryKey: keys.ias.lists() })
    },
  })
}

// GT revises an existing appraisal (or Cluster Expert adds comments).
// registrationUuid preferred from the request; falls back to response.
export function useUpdateAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, body }) => updateAppraisal(uuid, body),
    onSuccess: (updated, { uuid, body }) => {
      const regUuid = body?.registrationUuid || updated?.registrationUuid
      if (updated) qc.setQueryData(keys.appraisals.detail(uuid), appraisalFromDto(updated))
      if (updated && regUuid) qc.setQueryData(keys.appraisals.byRegistration(regUuid), updated)
      if (regUuid) qc.invalidateQueries({ queryKey: keys.ias.detail(regUuid) })
      qc.invalidateQueries({ queryKey: keys.appraisals.lists() })
      qc.invalidateQueries({ queryKey: keys.ias.lists() })
    },
  })
}

// SDE grants L2 sanction. Callers should pass `registrationUuid` in the
// variables so we can invalidate the parent IA even if the response omits
// it. `registrationUuid` is optional but strongly recommended.
export function useApproveAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, isSidbeApproved = true }) =>
      approveAppraisal(uuid, { isSidbeApproved }),
    onSuccess: (updated, { uuid, registrationUuid }) => {
      const regUuid = registrationUuid || updated?.registrationUuid
      if (updated) qc.setQueryData(keys.appraisals.detail(uuid), appraisalFromDto(updated))
      if (updated && regUuid) qc.setQueryData(keys.appraisals.byRegistration(regUuid), updated)
      if (regUuid) qc.invalidateQueries({ queryKey: keys.ias.detail(regUuid) })
      qc.invalidateQueries({ queryKey: keys.appraisals.lists() })
      qc.invalidateQueries({ queryKey: keys.ias.lists() })
    },
  })
}

// ── BSE recommendations ────────────────────────────────────────────────────
export function useBseList({ enabled = true } = {}) {
  return useQuery({
    queryKey: keys.bse.lists(),
    enabled,
    queryFn: ({ signal }) => listBseRecommendations({ signal }).then((d) => unwrapList(d).map(bseFromDto)),
  })
}

export function useBse(uuid) {
  return useQuery({
    queryKey: keys.bse.detail(uuid),
    enabled: !!uuid,
    queryFn: ({ signal }) => getBseRecommendation(uuid, { signal }),
  })
}

export function useBseSearch(name) {
  return useQuery({
    queryKey: keys.bse.search(name),
    enabled: !!name && name.length > 0,
    queryFn: ({ signal }) => searchBseRecommendations(name, { signal }).then((d) => unwrapList(d).map(bseFromDto)),
  })
}

export function useBseByGtStatus(status) {
  return useQuery({
    queryKey: keys.bse.byGtStatus(status),
    enabled: !!status,
    queryFn: ({ signal }) => listBseRecommendationsByGtStatus(status, { signal }).then((d) => unwrapList(d).map(bseFromDto)),
  })
}

export function useBseByPmuStatus(status) {
  return useQuery({
    queryKey: keys.bse.byPmuStatus(status),
    enabled: !!status,
    queryFn: ({ signal }) => listBseRecommendationsByPmuStatus(status, { signal }).then((d) => unwrapList(d).map(bseFromDto)),
  })
}

export function useBseByHoStatus(status) {
  return useQuery({
    queryKey: keys.bse.byHoStatus(status),
    enabled: !!status,
    queryFn: ({ signal }) => listBseRecommendationsByHoStatus(status, { signal }).then((d) => unwrapList(d).map(bseFromDto)),
  })
}

export function useBseByMappedStatus(status) {
  return useQuery({
    queryKey: keys.bse.byMappedStatus(status),
    enabled: status != null,
    queryFn: ({ signal }) => listBseRecommendationsByMappedStatus(status, { signal }).then((d) => unwrapList(d).map(bseFromDto)),
  })
}

export function useBseByRegistration(regUuid) {
  return useQuery({
    queryKey: keys.bse.byRegistration(regUuid),
    enabled: !!regUuid,
    queryFn: ({ signal }) => listBseRecommendationsByRegistration(regUuid, { signal }).then((d) => unwrapList(d).map(bseFromDto)),
  })
}

// Active BSE recommendations mapped to a vendor and marked as selected —
// the vendor's own resource pool (View My Resources + Raise Disbursement).
// Returns the raw DTOs (not `fromDto`-adapted) because we want the extra
// vendor-side fields like `iaSelected`, `vendorName`, `createdAt`.
export function useBseByUserSelected(userId) {
  return useQuery({
    queryKey: keys.bse.byUserSelected(userId),
    enabled: userId != null,
    queryFn: ({ signal }) => listBseByUserSelected(userId, { signal }).then(unwrapList),
  })
}

export function useCreateBse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, registrationUuid }) => createBseRecommendation(values, registrationUuid),
    onSuccess: (_created, { registrationUuid }) => {
      qc.invalidateQueries({ queryKey: keys.bse.lists() })
      if (registrationUuid) qc.invalidateQueries({ queryKey: keys.bse.byRegistration(registrationUuid) })
    },
  })
}

export function useUpdateBse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, patch }) => updateBseRecommendation(uuid, patch),
    onSuccess: (updated, { uuid }) => {
      if (updated) qc.setQueryData(keys.bse.detail(uuid), updated)
      qc.invalidateQueries({ queryKey: keys.bse.all })
    },
  })
}

// ── Users ─────────────────────────────────────────────────────────────────
export function useUsersSearch(params) {
  return useQuery({
    queryKey: keys.users.search(params),
    enabled: !!params && Object.values(params).some(Boolean),
    queryFn: ({ signal }) => searchUsers(params, { signal }).then((d) => unwrapUsers(d)),
  })
}

// All users with a given role — e.g. `MANPOWER_AGENCY` for the vendor picker
// on the BSE candidate form. Returns `[{ id, username, firstName, lastName,
// email, district, state, ... }]`.
export function useUsersByRole(role) {
  return useQuery({
    queryKey: keys.users.byRole(role),
    enabled: !!role,
    queryFn: ({ signal }) => listUsersByRole(role, { signal }).then((d) => unwrapUsers(d)),
    staleTime: 5 * 60_000,
  })
}

// ── Dropdown data (cascading in the In-Principle Approval form) ────────────
// SIDBI branch list for a given state. Returns `[{ uuid, branchName }]`.
export function useBranchesByState(state) {
  return useQuery({
    queryKey: keys.branches.byState(state),
    enabled: !!state,
    queryFn: ({ signal }) => listBranchesByState(state, { signal }),
  })
}

// Bulk variant — fetches branch dropdowns for every unique state in the
// input list and returns a single Map<branchUuid, branchName>. Useful for
// list views that render `sidbiBranch` UUIDs from many different states.
export function useBranchesByStates(states = []) {
  const unique = useMemo(
    () => Array.from(new Set((states || []).filter(Boolean))),
    [states],
  )
  return useQueries({
    queries: unique.map((state) => ({
      queryKey: keys.branches.byState(state),
      queryFn: ({ signal }) => listBranchesByState(state, { signal }),
      staleTime: 5 * 60_000,
    })),
    combine: (results) => {
      const byUuid = new Map()
      for (const r of results) {
        if (Array.isArray(r.data)) for (const b of r.data) byUuid.set(b.uuid, b.branchName)
      }
      return { byUuid, isLoading: results.some((r) => r.isLoading) }
    },
  })
}

// SDEs posted at a given branch. Returns `[{ uuid, name }]`.
export function useSdesByBranch(branchUuid) {
  return useQuery({
    queryKey: keys.sdes.byBranch(branchUuid),
    enabled: !!branchUuid,
    queryFn: ({ signal }) => listSdesByBranch(branchUuid, { signal }),
  })
}

// Resolve the vendor record for the logged-in Manpower Agency user.
// Now backed by `GET /vendor/user/{userId}` — a direct single-record fetch,
// so we no longer download the full vendor list to filter by email.
// Pass `user.userId` from the auth session.
export function useMyVendor(userId) {
  return useQuery({
    queryKey: keys.vendors.byUser(userId),
    enabled: userId != null,
    queryFn: ({ signal }) => getVendorByUser(userId, { signal }),
  })
}

// ── Vendors (SDE-managed) ─────────────────────────────────────────────────
// Third-party vendors that dispatch the BSE offer letter. Managed by SDE via
// the Vendor Management page.

export function useVendors() {
  return useQuery({
    queryKey: keys.vendors.lists(),
    queryFn: ({ signal }) => listVendors({ signal }).then(unwrapList),
  })
}

export function useVendor(uuid) {
  return useQuery({
    queryKey: keys.vendors.detail(uuid),
    enabled: !!uuid,
    queryFn: ({ signal }) => getVendor(uuid, { signal }),
  })
}

// Dropdown-only slice (`{ uuid, name }[]`) used by the BSE candidate form.
export function useVendorsDropdown() {
  return useQuery({
    queryKey: keys.vendors.dropdown(),
    queryFn: ({ signal }) => listVendorsDropdown({ signal }),
    staleTime: 15 * 60_000,
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values) => createVendor(values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.vendors.all }) },
  })
}

export function useUpdateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, values }) => updateVendor(uuid, values),
    onSuccess: (_data, { uuid }) => {
      qc.invalidateQueries({ queryKey: keys.vendors.all })
      qc.invalidateQueries({ queryKey: keys.vendors.detail(uuid) })
    },
  })
}

export function useDeleteVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uuid) => deleteVendor(uuid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.vendors.all }) },
  })
}

// ── Files ─────────────────────────────────────────────────────────────────
// All files attached to a registration (IA / BSE / etc.). Returns the raw
// UploadedFileResponse[] from the backend — callers decode the slug-prefixed
// filenames via decodeFilename() from fileFieldLabels.js.
export function useFilesByRegistration(regUuid) {
  return useQuery({
    queryKey: keys.files.byRegistration(regUuid),
    enabled: !!regUuid,
    queryFn: ({ signal }) => listFiles(regUuid, { signal }),
  })
}

// ── Vendor disbursements (HO Maker review) ────────────────────────────────
// MPA raises disbursements via `createVendorDisbursement`; HO Maker reviews
// them through the list + detail + PUT hooks below.

export function useVendorDisbursements() {
  return useQuery({
    queryKey: keys.vendorDisbursements.lists(),
    queryFn: ({ signal }) => listVendorDisbursements({ signal }).then(unwrapList),
  })
}

// Filtered view — only the disbursements raised by the currently signed-in
// user. Backend doesn't expose a "mine" endpoint yet, and `createdBy` is
// currently stamped with the auth admin (not the MPA username), so we fall
// back to the unfiltered list until backend threads the real user through.
// When backend adds `GET /bse-salary/mine` (or filters server-side by JWT),
// swap this hook's body — nothing else changes.
export function useMyVendorDisbursements(username) {
  const q = useVendorDisbursements()
  const uname = (username || '').toLowerCase()
  const all = q.data || []
  const matched = uname
    ? all.filter((d) => (d.createdBy || '').toLowerCase() === uname)
    : []
  // If nothing matches by createdBy, fall through to the full list so MPA
  // still sees their notes. Server-side scoping will replace this.
  return { ...q, data: matched.length > 0 ? matched : all }
}

export function useVendorDisbursement(id) {
  return useQuery({
    queryKey: keys.vendorDisbursements.detail(id),
    enabled: id != null,
    queryFn: ({ signal }) => getVendorDisbursement(id, { signal }),
  })
}

export function useUpdateVendorDisbursement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }) => updateVendorDisbursement(id, values),
    onSuccess: (updated, { id }) => {
      if (updated) qc.setQueryData(keys.vendorDisbursements.detail(id), updated)
      qc.invalidateQueries({ queryKey: keys.vendorDisbursements.all })
    },
  })
}

export function useDeleteVendorDisbursement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteVendorDisbursement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.vendorDisbursements.all }),
  })
}

// ── CAPEX disbursements (BSE raise → GT verify → SDE recommend) ───────────

export function useDisbursementCapex() {
  return useQuery({
    queryKey: keys.capex.lists(),
    queryFn: ({ signal }) => listDisbursementCapex({ signal }).then(unwrapList),
  })
}

export function useDisbursementCapexOne(uuid) {
  return useQuery({
    queryKey: keys.capex.detail(uuid),
    enabled: !!uuid,
    queryFn: ({ signal }) => getDisbursementCapex(uuid, { signal }),
  })
}

export function useDisbursementCapexByRegistration(registrationUuid) {
  return useQuery({
    queryKey: keys.capex.byRegistration(registrationUuid),
    enabled: !!registrationUuid,
    queryFn: ({ signal }) =>
      listDisbursementCapexByRegistration(registrationUuid, { signal }).then(unwrapList),
  })
}

export function useCreateDisbursementCapex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values) => createDisbursementCapex(values),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.capex.all }),
  })
}

export function useUpdateDisbursementCapex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, values }) => updateDisbursementCapex(uuid, values),
    onSuccess: (updated, { uuid }) => {
      if (updated) qc.setQueryData(keys.capex.detail(uuid), updated)
      qc.invalidateQueries({ queryKey: keys.capex.all })
    },
  })
}

export function useDeleteDisbursementCapex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uuid) => deleteDisbursementCapex(uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.capex.all }),
  })
}
