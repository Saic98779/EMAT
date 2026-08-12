import { apiFetch } from '../api'

// Backend `vendor-controller`. Endpoints are singular `/vendor` (not
// `/vendors`) per the OpenAPI spec.
const PATH = '/vendor'

// GET /vendor → all vendors
export function listVendors({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// GET /vendor/{uuid} → single vendor
export function getVendor(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { signal })
}

// GET /vendor/user/{userId} → the vendor record linked to a given user id.
// Used by the MPA workspace to resolve "my vendor" without downloading the
// full vendor list and filtering client-side.
export function getVendorByUser(userId, { signal } = {}) {
  return apiFetch(`${PATH}/user/${encodeURIComponent(userId)}`, { signal })
}

// POST /vendor — feeds the SDE Vendor Management page.
export function createVendor(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

// PUT /vendor/{uuid} — edit an existing vendor. All fields sent (full
// replacement), so the caller should pass the merged record.
export function updateVendor(uuid, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

// DELETE /vendor/{uuid}
export function deleteVendor(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { method: 'DELETE', signal })
}

// GET /vendor/dropdown → `[{ uuid, name }]` — used by the BSE candidate
// form to pick who will send the offer letter.
export function listVendorsDropdown({ signal } = {}) {
  return apiFetch(`${PATH}/dropdown`, { signal })
}

// Frontend form values → backend `VendorRequest`. Field names on the form
// are already close to the backend contract, so this adapter is a thin
// null-coercion pass. `active` defaults to true on create.
export function toPayload(v = {}) {
  return {
    vendorName: str(v.vendorName),
    companyName: str(v.companyName),
    spocName: str(v.spocName),
    spocMobileNo: str(v.spocMobileNo),
    email: str(v.email),
    mobileNo: str(v.mobileNo),
    gstNo: str(v.gstNo),
    panNo: str(v.panNo),
    address: str(v.address),
    district: str(v.district),
    state: str(v.state),
    pinCode: str(v.pinCode),
    bankName: str(v.bankName),
    accountNumber: str(v.accountNumber),
    ifscCode: str(v.ifscCode),
    branchName: str(v.branchName),
    active: v.active == null ? true : !!v.active,
  }
}

const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)
