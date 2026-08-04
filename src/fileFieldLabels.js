// Shared mapping between form file-field names and their human labels.
// Uploaded files are renamed to `<slug>__<originalName>` before hitting the
// file-controller, and DocUpload decodes the prefix back into a label so the
// user can see which upload slot each file belongs to.

export const FILE_FIELD_LABELS = {
  // IA In-Principle
  incorp_certificate: 'Incorporation Certificate',
  constitution_proof: 'Proof of Constitution',
  apex_kyc_file: 'KYC Document (Address Proof)',
  apex_id_file: 'ID Proof',
  electricity_bill: 'Electricity Bill',
  telephone_bill: 'Telephone Bill',
  members_justification_file: 'Approval Letter (SIDBI)',
  adverse_report: 'Adverse Report',
  // Appraisal
  web_search_document: 'Web Search Document',
  ngo_darpan_file: 'NGO Darpan Copy',
  nabard_blacklist_file: 'NABARD Blacklist Document',
  holder_cibil_file: 'Office Holder — CIBIL Report',
  owner_cibil_file: 'Beneficial Owner — CIBIL Report',
  // BSE candidate proposal (GT Field Manager) — these are the slugs used
  // by `makeBseCandidateSchema` field names.
  resume_file: 'Resume',
  salary_proof: 'Salary Slip / Bank Statement',
  resignation_doc: 'Resignation / Relieving Letter',
  candidate_cv: 'Candidate CV',
  // BSE committee stage (SIDBI HO Maker records on the committee's behalf).
  committee_mom: 'Committee MoM',
}

// Separator between slug and original filename. Chosen to be unlikely inside
// user-supplied filenames.
export const FILE_FIELD_SEP = '__'

// Renames a File so its uploaded name carries the slug prefix. Preserves
// original mime + last-modified. Returns the input unchanged if `slug` is
// falsy — safe to call on DocUpload's ad-hoc uploads.
export function encodeFilename(file, slug) {
  if (!slug || !file) return file
  const prefixed = `${slug}${FILE_FIELD_SEP}${file.name}`
  return new File([file], prefixed, { type: file.type, lastModified: file.lastModified })
}

// Splits a stored filename back into `{ label, name }`.
// - Known slug → uses the registered human label.
// - Unknown slug → title-cases the slug (e.g. "some_field" → "Some Field")
//   so the user still sees a slot label rather than the raw slug.
// - No slug prefix at all → `{ label: null, name: filename }`.
// Either way, `name` never carries the slug prefix.
export function decodeFilename(filename) {
  if (typeof filename !== 'string') return { label: null, name: String(filename ?? '') }
  const idx = filename.indexOf(FILE_FIELD_SEP)
  if (idx <= 0) return { label: null, name: filename }
  const slug = filename.slice(0, idx)
  const rest = filename.slice(idx + FILE_FIELD_SEP.length)
  const label = FILE_FIELD_LABELS[slug] || titleCase(slug)
  return { label, name: rest }
}

function titleCase(slug) {
  return slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
