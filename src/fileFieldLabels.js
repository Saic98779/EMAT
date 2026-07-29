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

// Splits a stored filename back into `{ label, name }`. Falls back to
// `{ label: null, name: filename }` when no slug prefix is present.
export function decodeFilename(filename) {
  if (typeof filename !== 'string') return { label: null, name: String(filename ?? '') }
  const idx = filename.indexOf(FILE_FIELD_SEP)
  if (idx <= 0) return { label: null, name: filename }
  const slug = filename.slice(0, idx)
  const rest = filename.slice(idx + FILE_FIELD_SEP.length)
  const label = FILE_FIELD_LABELS[slug]
  return label ? { label, name: rest } : { label: null, name: filename }
}
