// Centralised query-key catalogue + hooks. All React Query interactions in
// the app should go through here so mutations know which caches to invalidate
// after an update.
//
// Key shape convention:
//   [entity, kind, ...selectors]
// e.g. ['ias', 'list'], ['ias', 'detail', id], ['appraisals', 'byRegistration', regId]
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
  updateVendorDisbursement, reviewerUpdateVendorDisbursement,
  deleteVendorDisbursement,
} from './apis/vendorDisbursements'
import {
  listBseAttendance, getBseAttendance, createBseAttendance,
  updateBseAttendance, deleteBseAttendance,
  listBseAttendanceByRecommendation,
} from './apis/bseAttendance'
import {
  listBseAttendanceManualRequests, getBseAttendanceManualRequest,
  listBseAttendanceManualRequestsByRecommendation,
  listBseAttendanceManualRequestsByStatus,
  createBseAttendanceManualRequest, updateBseAttendanceManualRequest,
  deleteBseAttendanceManualRequest,
  approveBseAttendanceManualRequest, rejectBseAttendanceManualRequest,
} from './apis/bseAttendanceManualRequest'
import {
  listDisbursementCapex, getDisbursementCapex,
  listDisbursementCapexByRegistration,
  createDisbursementCapex, updateDisbursementCapex, deleteDisbursementCapex,
} from './apis/disbursementCapex'
import {
  listEligibilityMatrix, getEligibilityMatrix,
  listEligibilityMatrixRegistrationsDropdown,
  getEligibilityMatrixByRegistration,
  createEligibilityMatrix, updateEligibilityMatrix, deleteEligibilityMatrix,
} from './apis/eligibilityMatrix'
import {
  getSustainabilityMatrix,
  getSustainabilityMatrixByAppraisal,
  createSustainabilityMatrix, updateSustainabilityMatrix, deleteSustainabilityMatrix,
} from './apis/sustainabilityMatrix'

// ── Key catalogue ─────────────────────────────────────────────────────────
export const keys = {
  ias: {
    all: ['ias'],
    lists: () => ['ias', 'list'],
    // Normalise to string — the id arrives as a number from DTOs (setQueryData
    // in useApproveIA / useUpdateIA) and as a string from useParams (useIA on
    // detail pages). Without coercion the two write / read at different
    // cache slots and the post-approve UI stays stale.
    detail: (id) => ['ias', 'detail', String(id)],
  },
  appraisals: {
    all: ['appraisals'],
    lists: () => ['appraisals', 'list'],
    detail: (id) => ['appraisals', 'detail', String(id)],
    byRegistration: (regId) => ['appraisals', 'byRegistration', String(regId)],
  },
  bse: {
    all: ['bse'],
    lists: () => ['bse', 'list'],
    detail: (id) => ['bse', 'detail', id],
    search: (name) => ['bse', 'search', name],
    byGtStatus: (status) => ['bse', 'gt-status', status],
    byPmuStatus: (status) => ['bse', 'pmu-status', status],
    byHoStatus: (status) => ['bse', 'ho-status', status],
    byMappedStatus: (status) => ['bse', 'mapped', status],
    byRegistration: (regId) => ['bse', 'byRegistration', regId],
    byUserSelected: (userId) => ['bse', 'byUserSelected', String(userId)],
    // Cached lookup for "the recommendation belonging to the logged-in BSE
    // user" — resolved via bseName search + email/mobile disambiguation.
    forBseLogin: (id) => ['bse', 'forBseLogin', String(id)],
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
    byBranch: (branchId) => ['sdes', 'byBranch', branchId],
  },
  vendors: {
    all: ['vendors'],
    lists: () => ['vendors', 'list'],
    detail: (id) => ['vendors', 'detail', id],
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
    detail: (id) => ['capex', 'detail', id],
    byRegistration: (regId) => ['capex', 'byRegistration', regId],
  },
  eligibility: {
    all: ['eligibility'],
    lists: () => ['eligibility', 'list'],
    detail: (id) => ['eligibility', 'detail', id],
    byRegistration: (regId) => ['eligibility', 'byRegistration', regId],
    registrationsDropdown: () => ['eligibility', 'registrationsDropdown'],
  },
  sustainability: {
    all: ['sustainability'],
    detail: (id) => ['sustainability', 'detail', id],
    byAppraisal: (appraisalId) => ['sustainability', 'byAppraisal', appraisalId],
  },
  files: {
    byRegistration: (regId) => ['files', 'byRegistration', regId],
  },
  bseAttendance: {
    all: ['bse-attendance'],
    lists: () => ['bse-attendance', 'list'],
    detail: (id) => ['bse-attendance', 'detail', String(id)],
    byRecommendation: (recId) => ['bse-attendance', 'byRecommendation', recId],
  },
  bseAttendanceManualRequest: {
    all: ['bse-attendance-manual-request'],
    lists: () => ['bse-attendance-manual-request', 'list'],
    detail: (id) => ['bse-attendance-manual-request', 'detail', String(id)],
    byRecommendation: (recId) => ['bse-attendance-manual-request', 'byRecommendation', recId],
    byStatus: (status) => ['bse-attendance-manual-request', 'byStatus', status],
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
// appraisal — so we fetch both in parallel and join by registrationId.
export function useIAs({ enabled = true } = {}) {
  return useQuery({
    queryKey: keys.ias.lists(),
    enabled,
    // Big joined payload (registrations + appraisals). Every IA mutation
    // already invalidates the cache, so a long stale window here only
    // skips redundant refetches during idle navigation — the data isn't
    // actually stale, we just stop re-hitting two big endpoints on every
    // page mount of the sidebar's live-badge hook.
    staleTime: 5 * 60 * 1000,   // 5 min
    gcTime: 30 * 60 * 1000,     // keep in memory 30 min after last use
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const [regsRaw, apprsRaw] = await Promise.all([
        listIndustryAssociations({ signal }),
        listAppraisals({ signal }).catch(() => []),
      ])
      const regs = unwrapList(regsRaw)
      const apprs = unwrapList(apprsRaw)
      // NOTE: `apprs` here is the raw list from listAppraisals — the DTO
      // shape (registrationId + id), not the fromDto-mapped version. Same
      // for `regs`, which is why we look up by `r.id`.
      const byReg = new Map(apprs.map((a) => [a.registrationId, a]).filter(([k]) => !!k))
      return regs.map((r) => iaFromDto(r, byReg.get(r.id) || null))
    },
  })
}

export function useIA(id, options = {}) {
  return useQuery({
    queryKey: keys.ias.detail(id),
    enabled: !!id && (options.enabled ?? true),
    queryFn: async ({ signal }) => {
      const [reg, appr] = await Promise.all([
        getIndustryAssociation(id, { signal }),
        getAppraisalByRegistration(id, { signal }).catch(() => null),
      ])
      return iaFromDto(reg, appr || null)
    },
  })
}

export function useApproveIA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isSidbeApproved = true }) =>
      approveIndustryAssociation(id, { isSidbeApproved }),
    onSuccess: (updated, { id }) => {
      // Push the response into the detail cache immediately so the page
      // reflects the new state without another network round-trip.
      if (updated) {
        qc.setQueryData(keys.ias.detail(id), (prev) =>
          iaFromDto(updated, prev?.appraisal ?? null),
        )
      }
      // Also invalidate the detail so any subscriber that happens to hold
      // a different key shape still re-fetches.
      qc.invalidateQueries({ queryKey: keys.ias.detail(id) })
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })
    },
  })
}

// SDE edit — PUT the full IA registration. Used pre-L1-approval to correct
// any field GT captured. On success we swap the detail cache with the
// returned DTO so the review page shows the edits without a re-fetch.
export function useUpdateIA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values, extra }) => updateIndustryAssociation(id, values, extra),
    onSuccess: (updated, { id }) => {
      if (updated) {
        qc.setQueryData(keys.ias.detail(id), (prev) =>
          iaFromDto(updated, prev?.appraisal ?? null),
        )
      }
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })
    },
  })
}

// ── IA appraisals (Level 2) ───────────────────────────────────────────────
export function useAppraisals({ enabled = true } = {}) {
  return useQuery({
    queryKey: keys.appraisals.lists(),
    enabled,
    // Same rationale as useIAs — cache aggressively; mutations invalidate.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => listAppraisals({ signal }).then((d) => unwrapList(d).map(appraisalFromDto)),
  })
}

export function useAppraisal(id) {
  return useQuery({
    queryKey: keys.appraisals.detail(id),
    enabled: !!id,
    queryFn: ({ signal }) => getAppraisal(id, { signal }).then(appraisalFromDto),
  })
}

// Returns the raw appraisal DTO (not fromDto-mapped) — the GT Appraisal form
// needs the full backend field set to prefill.
export function useAppraisalByRegistration(regId) {
  return useQuery({
    queryKey: keys.appraisals.byRegistration(regId),
    enabled: !!regId,
    queryFn: ({ signal }) => getAppraisalByRegistration(regId, { signal }).catch(() => null),
  })
}

// GT submits the detailed appraisal for the first time. On success we
// invalidate the parent IA (status flips to "Final Review (L2)") + lists.
// registrationId is read from the *request* body — we can't rely on the
// response echoing it back.
export function useCreateAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => createAppraisal(body),
    onSuccess: (created, body) => {
      const regId = body?.registrationId || created?.registrationId
      if (created && regId) qc.setQueryData(keys.appraisals.byRegistration(regId), created)
      qc.invalidateQueries({ queryKey: keys.appraisals.lists(), refetchType: 'all' })
      if (regId) qc.invalidateQueries({ queryKey: keys.ias.detail(regId) })
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })
    },
  })
}

// GT revises an existing appraisal (or Cluster Expert adds comments).
// registrationId preferred from the request; falls back to response.
export function useUpdateAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }) => updateAppraisal(id, body),
    onSuccess: (updated, { id, body }) => {
      const regId = body?.registrationId || updated?.registrationId
      if (updated) qc.setQueryData(keys.appraisals.detail(id), appraisalFromDto(updated))
      if (updated && regId) qc.setQueryData(keys.appraisals.byRegistration(regId), updated)
      if (regId) qc.invalidateQueries({ queryKey: keys.ias.detail(regId) })
      qc.invalidateQueries({ queryKey: keys.appraisals.lists(), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })
    },
  })
}

// SDE grants L2 sanction. Callers should pass `registrationId` in the
// variables so we can invalidate the parent IA even if the response omits
// it. `registrationId` is optional but strongly recommended.
export function useApproveAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isSidbeApproved = true }) =>
      approveAppraisal(id, { isSidbeApproved }),
    onSuccess: (updated, { id, registrationId }) => {
      const regId = registrationId || updated?.registrationId
      if (updated) qc.setQueryData(keys.appraisals.detail(id), appraisalFromDto(updated))
      if (updated && regId) qc.setQueryData(keys.appraisals.byRegistration(regId), updated)
      if (regId) qc.invalidateQueries({ queryKey: keys.ias.detail(regId) })
      qc.invalidateQueries({ queryKey: keys.appraisals.lists(), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })
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

export function useBse(id) {
  return useQuery({
    queryKey: keys.bse.detail(id),
    enabled: !!id,
    queryFn: ({ signal }) => getBseRecommendation(id, { signal }),
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

export function useBseByRegistration(regId) {
  return useQuery({
    queryKey: keys.bse.byRegistration(regId),
    enabled: !!regId,
    queryFn: ({ signal }) => listBseRecommendationsByRegistration(regId, { signal }).then((d) => unwrapList(d).map(bseFromDto)),
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

// Resolves the BSE recommendation belonging to the currently logged-in
// BSE user. The backend does not model a direct BSE-user → recommendation
// link (userId on the DTO points to the MANPOWER_AGENCY vendor, not the
// BSE), so we hit `/bse-recommendations/search?bseName=…` and disambiguate
// on email or mobile — either uniquely identifies the record.
//
// `me` is the auth user object: { userId, email, contactNo?, name? }.
export function useMyBseRecommendation(me) {
  const fullName = (me?.name || '').trim()
  const email = (me?.email || '').trim().toLowerCase()
  const mobile = (me?.contactNo || me?.mobile || '').trim()
  return useQuery({
    queryKey: keys.bse.forBseLogin(me?.userId ?? ''),
    enabled: !!me?.userId && !!fullName,
    queryFn: async ({ signal }) => {
      const raw = await searchBseRecommendations(fullName, { signal })
      const rows = unwrapList(raw)
      if (!rows.length) return null
      // Prefer email match, then mobile, then a single-name-match fallback.
      const byEmail = email
        ? rows.find((r) => String(r.emailId || '').trim().toLowerCase() === email)
        : null
      if (byEmail) return byEmail
      const byMobile = mobile
        ? rows.find((r) => String(r.mobileNumber || '').trim() === mobile)
        : null
      if (byMobile) return byMobile
      return rows.length === 1 ? rows[0] : null
    },
  })
}

export function useCreateBse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, registrationId }) => createBseRecommendation(values, registrationId),
    onSuccess: (_created, { registrationId }) => {
      qc.invalidateQueries({ queryKey: keys.bse.lists() })
      if (registrationId) qc.invalidateQueries({ queryKey: keys.bse.byRegistration(registrationId) })
    },
  })
}

export function useUpdateBse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => updateBseRecommendation(id, patch),
    onSuccess: (updated, { id }) => {
      if (updated) qc.setQueryData(keys.bse.detail(id), updated)
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
// SIDBI branch list for a given state. Returns `[{ id, branchName }]`.
export function useBranchesByState(state) {
  return useQuery({
    queryKey: keys.branches.byState(state),
    enabled: !!state,
    queryFn: ({ signal }) => listBranchesByState(state, { signal }),
  })
}

// Bulk variant — fetches branch dropdowns for every unique state in the
// input list and returns a single Map<branchId, branchName>. Useful for
// list views that render `sidbiBranch` ids from many different states.
//
// Result key is `byId` (backend switched from uuid → id Aug '26). Callers
// that previously destructured `byUuid` need to rename their reference.
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
      const byId = new Map()
      for (const r of results) {
        if (Array.isArray(r.data)) for (const b of r.data) byId.set(b.id, b.branchName)
      }
      return { byId, isLoading: results.some((r) => r.isLoading) }
    },
  })
}

// SDEs posted at a given branch. Returns `[{ id, name }]`.
export function useSdesByBranch(branchId) {
  return useQuery({
    queryKey: keys.sdes.byBranch(branchId),
    enabled: !!branchId,
    queryFn: ({ signal }) => listSdesByBranch(branchId, { signal }),
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

export function useVendor(id) {
  return useQuery({
    queryKey: keys.vendors.detail(id),
    enabled: !!id,
    queryFn: ({ signal }) => getVendor(id, { signal }),
  })
}

// Dropdown-only slice (`{ id, name }[]`) used by the BSE candidate form.
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
    mutationFn: ({ id, values }) => updateVendor(id, values),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: keys.vendors.all })
      qc.invalidateQueries({ queryKey: keys.vendors.detail(id) })
    },
  })
}

export function useDeleteVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteVendor(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.vendors.all }) },
  })
}

// ── Files ─────────────────────────────────────────────────────────────────
// All files attached to a registration (IA / BSE / etc.). Returns the raw
// UploadedFileResponse[] from the backend — callers decode the slug-prefixed
// filenames via decodeFilename() from fileFieldLabels.js.
export function useFilesByRegistration(regId) {
  return useQuery({
    queryKey: keys.files.byRegistration(regId),
    enabled: !!regId,
    queryFn: ({ signal }) => listFiles(regId, { signal }),
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

// Minimal PUT for reviewer roles (GT, HO). Sends only the reviewer's
// changed fields; assumes backend does merge-on-PUT.
export function useReviewerUpdateVendorDisbursement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => reviewerUpdateVendorDisbursement(id, patch),
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

export function useDisbursementCapexOne(id) {
  return useQuery({
    queryKey: keys.capex.detail(id),
    enabled: !!id,
    queryFn: ({ signal }) => getDisbursementCapex(id, { signal }),
  })
}

// Backend currently returns a single object (not a list) — Swagger types
// it that way and the handler uses findOne semantics. We DON'T unwrap here
// because unwrapList would turn a plain object into `[]`. The component
// coerces single-vs-list itself. Once backend fixes the endpoint to
// always return a list, restore `.then(unwrapList)`.
export function useDisbursementCapexByRegistration(registrationId) {
  return useQuery({
    queryKey: keys.capex.byRegistration(registrationId),
    enabled: !!registrationId,
    queryFn: ({ signal }) => listDisbursementCapexByRegistration(registrationId, { signal }),
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
    mutationFn: ({ id, values }) => updateDisbursementCapex(id, values),
    onSuccess: (updated, { id }) => {
      if (updated) qc.setQueryData(keys.capex.detail(id), updated)
      qc.invalidateQueries({ queryKey: keys.capex.all })
    },
  })
}

export function useDeleteDisbursementCapex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteDisbursementCapex(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.capex.all }),
  })
}

// ── Eligibility Matrix (GT Field Team assessment) ─────────────────────────

export function useEligibilityMatrix() {
  return useQuery({
    queryKey: keys.eligibility.lists(),
    queryFn: ({ signal }) => listEligibilityMatrix({ signal }).then(unwrapList),
  })
}

// IAs with an eligibility matrix on record — populates the "pick an IA"
// dropdown that gates the In-Principle form. Cached generously since the
// list only changes when a new matrix is submitted (which invalidates
// keys.eligibility.all anyway).
export function useEligibilityRegistrationsDropdown({ enabled = true } = {}) {
  return useQuery({
    queryKey: keys.eligibility.registrationsDropdown(),
    enabled,
    staleTime: 60 * 1000,
    queryFn: ({ signal }) => listEligibilityMatrixRegistrationsDropdown({ signal }).then(unwrapList),
  })
}

export function useEligibilityMatrixOne(id) {
  return useQuery({
    queryKey: keys.eligibility.detail(id),
    enabled: !!id,
    queryFn: ({ signal }) => getEligibilityMatrix(id, { signal }),
  })
}

// Backend may return single object or list — caller coerces defensively.
export function useEligibilityMatrixByRegistration(registrationId) {
  return useQuery({
    queryKey: keys.eligibility.byRegistration(registrationId),
    enabled: !!registrationId,
    queryFn: ({ signal }) => getEligibilityMatrixByRegistration(registrationId, { signal }),
  })
}

export function useCreateEligibilityMatrix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values) => createEligibilityMatrix(values),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.eligibility.all }),
  })
}

export function useUpdateEligibilityMatrix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }) => updateEligibilityMatrix(id, values),
    onSuccess: (updated, { id }) => {
      if (updated) qc.setQueryData(keys.eligibility.detail(id), updated)
      qc.invalidateQueries({ queryKey: keys.eligibility.all })
    },
  })
}

export function useDeleteEligibilityMatrix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteEligibilityMatrix(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.eligibility.all }),
  })
}


// ── Sustainability Matrix (post In-Principle, pre Detailed Appraisal) ────

export function useSustainabilityMatrixOne(id) {
  return useQuery({
    queryKey: keys.sustainability.detail(id),
    enabled: !!id,
    queryFn: ({ signal }) => getSustainabilityMatrix(id, { signal }),
  })
}

// Used to check whether the matrix has already been submitted for this
// IA's appraisal — gates the flow into Detailed Appraisal.
export function useSustainabilityMatrixByAppraisal(appraisalId) {
  return useQuery({
    queryKey: keys.sustainability.byAppraisal(appraisalId),
    enabled: !!appraisalId,
    queryFn: ({ signal }) => getSustainabilityMatrixByAppraisal(appraisalId, { signal }).catch(() => null),
  })
}

export function useCreateSustainabilityMatrix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values) => createSustainabilityMatrix(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.sustainability.all })
      // Row action on the IAs list changes once sustainability is done
      // (Sustainability → Continue Appraisal). Force refetch even when
      // the list is currently inactive so the user sees the updated CTA
      // when they navigate back.
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.appraisals.lists(), refetchType: 'all' })
    },
  })
}

export function useUpdateSustainabilityMatrix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }) => updateSustainabilityMatrix(id, values),
    onSuccess: (updated, { id }) => {
      if (updated) qc.setQueryData(keys.sustainability.detail(id), updated)
      qc.invalidateQueries({ queryKey: keys.sustainability.all })
    },
  })
}

export function useDeleteSustainabilityMatrix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteSustainabilityMatrix(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sustainability.all }),
  })
}


// ── BSE attendance ────────────────────────────────────────────────────────
// One record = one day of presence for one BSE. Vendor-filled from the MPA
// "View Attendance of My Resources" page.

export function useBseAttendanceByRecommendation(recommendationId) {
  return useQuery({
    queryKey: keys.bseAttendance.byRecommendation(recommendationId),
    enabled: !!recommendationId,
    queryFn: ({ signal }) => listBseAttendanceByRecommendation(recommendationId, { signal }).then(unwrapList),
  })
}

// Parallel per-BSE attendance fetch. Used by MpaRaiseDisbursement's
// Annexure I so each selected BSE gets its own attendance count for the
// working-days column. Returns an object of results keyed by BSE id,
// plus an aggregate `isLoading` flag.
export function useBseAttendanceForRecommendations(recommendationIds = []) {
  const ids = recommendationIds.filter(Boolean)
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: keys.bseAttendance.byRecommendation(id),
      queryFn: ({ signal }) => listBseAttendanceByRecommendation(id, { signal }).then(unwrapList),
    })),
  })
  const byId = {}
  ids.forEach((id, i) => { byId[id] = results[i]?.data || [] })
  const isLoading = results.some((r) => r.isLoading)
  return { byId, isLoading }
}

export function useBseAttendanceList() {
  return useQuery({
    queryKey: keys.bseAttendance.lists(),
    queryFn: ({ signal }) => listBseAttendance({ signal }).then(unwrapList),
  })
}

export function useBseAttendance(id) {
  return useQuery({
    queryKey: keys.bseAttendance.detail(id),
    enabled: id != null,
    queryFn: ({ signal }) => getBseAttendance(id, { signal }),
  })
}

export function useCreateBseAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values) => createBseAttendance(values),
    onSuccess: (_data, values) => {
      qc.invalidateQueries({ queryKey: keys.bseAttendance.all })
      if (values?.bseRecommendationId) {
        qc.invalidateQueries({
          queryKey: keys.bseAttendance.byRecommendation(values.bseRecommendationId),
        })
      }
    },
  })
}

export function useUpdateBseAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }) => updateBseAttendance(id, values),
    onSuccess: (_data, { values }) => {
      qc.invalidateQueries({ queryKey: keys.bseAttendance.all })
      if (values?.bseRecommendationId) {
        qc.invalidateQueries({
          queryKey: keys.bseAttendance.byRecommendation(values.bseRecommendationId),
        })
      }
    },
  })
}

export function useDeleteBseAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => deleteBseAttendance(id),
    onSuccess: (_data, { recommendationId }) => {
      qc.invalidateQueries({ queryKey: keys.bseAttendance.all })
      if (recommendationId) {
        qc.invalidateQueries({
          queryKey: keys.bseAttendance.byRecommendation(recommendationId),
        })
      }
    },
  })
}

// ── BSE attendance — manual requests ──────────────────────────────────────
// Backdated / missed-day attendance the BSE files themselves, subject to
// approval. Same shape as bse-attendance + `reason` + approval fields.

export function useBseAttendanceManualRequestsByRecommendation(recommendationId) {
  return useQuery({
    queryKey: keys.bseAttendanceManualRequest.byRecommendation(recommendationId),
    enabled: !!recommendationId,
    queryFn: ({ signal }) =>
      listBseAttendanceManualRequestsByRecommendation(recommendationId, { signal }).then(unwrapList),
  })
}

export function useBseAttendanceManualRequestsByStatus(status) {
  return useQuery({
    queryKey: keys.bseAttendanceManualRequest.byStatus(status),
    enabled: !!status,
    queryFn: ({ signal }) =>
      listBseAttendanceManualRequestsByStatus(status, { signal }).then(unwrapList),
  })
}

export function useBseAttendanceManualRequestList({ enabled = true } = {}) {
  return useQuery({
    queryKey: keys.bseAttendanceManualRequest.lists(),
    enabled,
    queryFn: ({ signal }) => listBseAttendanceManualRequests({ signal }).then(unwrapList),
  })
}

export function useBseAttendanceManualRequest(id) {
  return useQuery({
    queryKey: keys.bseAttendanceManualRequest.detail(id),
    enabled: !!id,
    queryFn: ({ signal }) => getBseAttendanceManualRequest(id, { signal }),
  })
}

// Small helper to invalidate every read of this entity at once — the four
// mutations below all need it, so keeping it in one place avoids drift.
function invalidateManualRequests(qc, recommendationId) {
  qc.invalidateQueries({ queryKey: keys.bseAttendanceManualRequest.all })
  if (recommendationId) {
    qc.invalidateQueries({
      queryKey: keys.bseAttendanceManualRequest.byRecommendation(recommendationId),
    })
  }
}

export function useCreateBseAttendanceManualRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values) => createBseAttendanceManualRequest(values),
    onSuccess: (_data, values) => invalidateManualRequests(qc, values?.bseRecommendationId),
  })
}

export function useUpdateBseAttendanceManualRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }) => updateBseAttendanceManualRequest(id, values),
    onSuccess: (_data, { values }) => invalidateManualRequests(qc, values?.bseRecommendationId),
  })
}

export function useDeleteBseAttendanceManualRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => deleteBseAttendanceManualRequest(id),
    onSuccess: (_data, { recommendationId }) => invalidateManualRequests(qc, recommendationId),
  })
}

export function useApproveBseAttendanceManualRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approvedBy }) => approveBseAttendanceManualRequest(id, { approvedBy }),
    onSuccess: (_data, { recommendationId }) => {
      invalidateManualRequests(qc, recommendationId)
      // Approving a request effectively becomes attendance — invalidate
      // the primary attendance cache so calendars/counts refresh too.
      qc.invalidateQueries({ queryKey: keys.bseAttendance.all })
    },
  })
}

export function useRejectBseAttendanceManualRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approvedBy }) => rejectBseAttendanceManualRequest(id, { approvedBy }),
    onSuccess: (_data, { recommendationId }) => invalidateManualRequests(qc, recommendationId),
  })
}
