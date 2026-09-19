import { memo, useDeferredValue, useMemo, useState } from 'react'
import { InputAdornment, MenuItem } from '@mui/material'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell,
  EMAIL_RE, PHONE_RE,
  FormTextField, SHRINK_LABEL, useFieldHandlers,
} from './_shared'
import { createContent, DIA_ENDPOINTS } from '../../apis/diaContent'

// Stable inputProps / InputProps references shared by the FieldRenderer
// so FormTextField's memoization holds — otherwise every keystroke in
// any field would mint a fresh literal for every date/number/currency
// row and defeat React.memo.
const NUMBER_INPUT_PROPS = { min: 0 }
const CURRENCY_INPUT_PROPS = { min: 0, step: '0.01' }
const CURRENCY_ADORNMENT = {
  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
}

// DIA — PBSP Onboarding (Panel BDS Provider)
// GT_PMU raises; SIDBI HO Checker approves. Fields mirror the backend
// `CreateBdsServiceProvidersOnboardingRequest` DTO 1:1 — see `backend`
// column in the FIELDS map.

const CONSTITUTION_OPTIONS = [
  'Society', 'Trust', 'Section 8 Company', 'Private Limited Company',
  'Public Limited Company', 'LLP', 'Partnership', 'Proprietorship', 'Other',
]
const IA_NATURE_OPTIONS = ['For-profit', 'Not-for-profit']
const YES_NO = ['Yes', 'No']
const PIN_RE = /^\d{6}$/

// Frontend field key → { backend field, label, control config }.
// `backend` is the exact JSON field name the DTO expects; `type` controls
// which input we render and how we coerce the value at submit time.
const FIELDS = {
  providerName:          { backend: 'bdsProviderName',                label: 'BDS provider name',              required: true },
  doi:                   { backend: 'doi',                            label: 'Date of incorporation',          required: true, type: 'date' },
  constitution:          { backend: 'constitution',                   label: 'Constitution',                   required: true, type: 'select', options: CONSTITUTION_OPTIONS },
  address:               { backend: 'address',                        label: 'Address',                        required: true, multiline: true },
  state:                 { backend: 'state',                          label: 'State',                          required: true },
  district:              { backend: 'district',                       label: 'District',                       required: true },
  pinCode:               { backend: 'pinCode',                        label: 'PIN code',                       required: true },
  iaNature:              { backend: 'iaNature',                       label: 'Nature of IA',                   required: true, type: 'select', options: IA_NATURE_OPTIONS },
  noOfOffices:           { backend: 'noOfOffices',                    label: 'Number of offices',              required: true, type: 'number' },
  identifiedClusterFlag: { backend: 'catTo242IdenClusterFlag',        label: 'Catering to any of the 242 identified clusters', required: true, type: 'yesNo' },
  clusterName:           { backend: 'clusterName',                    label: 'Cluster name', showIf: (v) => v.identifiedClusterFlag === 'Yes' },
  otherClusterIA:        { backend: 'otherClusterIndusIa',            label: 'Other cluster / industry association' },
  totIaMembers:          { backend: 'totIaMembers',                   label: 'Total IA members',               type: 'number' },
  totMsmeIaMembers:      { backend: 'totMsmeIaMembers',               label: 'Total MSME IA members',          type: 'number' },
  sector:                { backend: 'sector',                         label: 'Sector',                         required: true },
  ownAssociationIaFlag:  { backend: 'ownAssociationIaFlag',           label: 'Runs own association / IA',      type: 'yesNo' },
  itInfra:               { backend: 'availOfItInfra',                 label: 'IT infrastructure available',    type: 'yesNo' },
  secretariatStaff:      { backend: 'availOfSecretariatStaffFlag',    label: 'Secretariat staff available',    type: 'yesNo' },
  mainExecutiveName:     { backend: 'mainExecutiveName',              label: 'Main executive name',            required: true },
  executiveContactNo:    { backend: 'executiveContactNo',             label: 'Executive contact number',       required: true, validate: 'phone' },
  nodalContactName:      { backend: 'nodalContactName',               label: 'Nodal contact name',             required: true },
  contactNumber:         { backend: 'contactNumber',                  label: 'Nodal contact number',           required: true, validate: 'phone' },
  emailId:               { backend: 'emailId',                        label: 'Email ID',                       required: true, validate: 'email' },
  areaOfExpertise:       { backend: 'areaOfExpertise',                label: 'Area of expertise',              required: true, multiline: true },
  totLeadCasesGen:       { backend: 'totLeadCasesGen',                label: 'Total lead cases generated',     type: 'number' },
  casesSanctionedAmt:    { backend: 'casesSanctionedAmt',             label: 'Cases sanctioned amount',        type: 'currency' },
  casesDisbursedAmt:     { backend: 'casesDisbursedAmt',              label: 'Cases disbursed amount',         type: 'currency' },
  sidbiRoMappedWith:     { backend: 'associateNameSidbiRoMappedWith', label: 'SIDBI regional office mapped with' },
  sidbiBoMappedWith:     { backend: 'associateNameSidbiBoMappedWith', label: 'SIDBI branch office mapped with' },
  sidbiBseName:          { backend: 'sidbiBseName',                   label: 'SIDBI BSE name' },
  bseContactNumber:      { backend: 'bseContactNumber',               label: 'BSE contact number',             validate: 'phone' },
  bseEmailId:            { backend: 'bseEmailId',                     label: 'BSE email ID',                   validate: 'email' },
}

const SECTIONS = [
  { title: 'Identity',                fields: ['providerName', 'doi', 'constitution', 'iaNature', 'sector'] },
  { title: 'Address',                 fields: ['address', 'state', 'district', 'pinCode'] },
  { title: 'Coverage & membership',   fields: ['noOfOffices', 'identifiedClusterFlag', 'clusterName', 'otherClusterIA', 'totIaMembers', 'totMsmeIaMembers', 'ownAssociationIaFlag'] },
  { title: 'Infrastructure',          fields: ['itInfra', 'secretariatStaff'] },
  { title: 'Contacts',                fields: ['mainExecutiveName', 'executiveContactNo', 'nodalContactName', 'contactNumber', 'emailId', 'areaOfExpertise'] },
  { title: 'Performance',             fields: ['totLeadCasesGen', 'casesSanctionedAmt', 'casesDisbursedAmt'] },
  { title: 'SIDBI mapping',           fields: ['sidbiRoMappedWith', 'sidbiBoMappedWith', 'sidbiBseName', 'bseContactNumber', 'bseEmailId'] },
]

const INITIAL = Object.keys(FIELDS).reduce((acc, k) => { acc[k] = ''; return acc }, {})

export default function DiaPbspOnboarding() {
  const [values, setValues] = useState(INITIAL)
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { set, blur } = useFieldHandlers(setValues, setTouched)
  // Defer validation so 32-field validate() runs off the critical path —
  // without this, every keystroke re-validates every field including
  // regex checks. Same pattern the IA registration form uses.
  const deferredValues = useDeferredValue(values)
  const errors = useMemo(() => validate(deferredValues), [deferredValues])
  const errFor = (name) => (showAllErrors || touched[name]) ? errors[name] : ''

  const reset = () => { setValues(INITIAL); setTouched({}); setShowAllErrors(false) }

  const submit = async (e) => {
    e.preventDefault()
    setShowAllErrors(true)
    if (Object.keys(errors).length > 0) {
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }
    setSubmitting(true)
    try {
      await createContent(DIA_ENDPOINTS.PBSP, buildPayload(values))
      setToast({ severity: 'success', msg: 'Submitted. Sent to SIDBI HO Checker for approval.' })
      reset()
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PmuFormShell
      title="PBSP Onboarding"
      subtitle="Add a Panel BDS Provider — submits to SIDBI HO Checker for approval."
      onSubmit={submit} onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      {SECTIONS.map((section, sIdx) => (
        <PmuSection key={section.title} first={sIdx === 0} title={section.title}>
          <FieldRow>
            {section.fields.map((key) => {
              const spec = FIELDS[key]
              if (!spec) return null
              if (typeof spec.showIf === 'function' && !spec.showIf(values)) return null
              return (
                <FieldCell key={key} span={cellSpan(spec)}>
                  <FieldRenderer
                    spec={spec}
                    value={values[key]}
                    onChange={set(key)}
                    onBlur={blur(key)}
                    error={errFor(key)}
                  />
                </FieldCell>
              )
            })}
          </FieldRow>
        </PmuSection>
      ))}
    </PmuFormShell>
  )
}

function cellSpan(spec) {
  if (spec.multiline) return 12
  return { xs: 12, md: 6 }
}

// Memoised so typing in one of the ~30 fields only re-renders that
// one field, not the whole PBSP form. Each render's props are compared
// shallowly by FormTextField already; wrapping the renderer in memo
// keeps the enclosing FieldCell subtree from repainting either.
const FieldRenderer = memo(function FieldRenderer({ spec, value, onChange, onBlur, error }) {
  const commonProps = {
    fullWidth: true,
    required: !!spec.required,
    label: spec.label,
    value, onChange, onBlur,
    error: !!error, helperText: error,
  }
  if (spec.type === 'select') {
    return (
      <FormTextField {...commonProps} select>
        <MenuItem value=""><em>— Select —</em></MenuItem>
        {spec.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </FormTextField>
    )
  }
  if (spec.type === 'yesNo') {
    return (
      <FormTextField {...commonProps} select>
        <MenuItem value=""><em>— Select —</em></MenuItem>
        {YES_NO.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </FormTextField>
    )
  }
  if (spec.type === 'date') {
    return <FormTextField {...commonProps} type="date" InputLabelProps={SHRINK_LABEL} />
  }
  if (spec.type === 'number') {
    return <FormTextField {...commonProps} type="number" inputProps={NUMBER_INPUT_PROPS} />
  }
  if (spec.type === 'currency') {
    return (
      <FormTextField
        {...commonProps} type="number" inputProps={CURRENCY_INPUT_PROPS}
        InputProps={CURRENCY_ADORNMENT}
      />
    )
  }
  return <FormTextField {...commonProps} multiline={!!spec.multiline} minRows={spec.multiline ? 2 : undefined} />
})

// Convert the form's UI representation to the backend DTO shape:
// - yes/no → boolean
// - number / integer → parsed Number
// - blanks on optional fields → null (backend accepts null; empty string
//   would break the numeric parses on the server side)
function buildPayload(values) {
  const out = {}
  for (const [name, spec] of Object.entries(FIELDS)) {
    if (typeof spec.showIf === 'function' && !spec.showIf(values)) continue
    const raw = values[name]
    const str = raw == null ? '' : String(raw).trim()
    if (spec.type === 'yesNo') {
      out[spec.backend] = str === 'Yes' ? true : str === 'No' ? false : null
      continue
    }
    if (spec.type === 'number' || spec.type === 'currency') {
      out[spec.backend] = str === '' ? null : Number(str)
      continue
    }
    out[spec.backend] = str === '' ? null : str
  }
  return out
}

function validate(v) {
  const errs = {}
  for (const [name, spec] of Object.entries(FIELDS)) {
    if (typeof spec.showIf === 'function' && !spec.showIf(v)) continue
    const raw = v[name]
    const str = raw == null ? '' : String(raw).trim()
    if (spec.required && !str) { errs[name] = 'Required.'; continue }
    if (!str) continue
    if (spec.validate === 'email' && !EMAIL_RE.test(str)) errs[name] = 'Enter a valid email address.'
    if (spec.validate === 'phone' && !PHONE_RE.test(str)) errs[name] = 'Enter a valid phone number.'
    if (name === 'pinCode' && !PIN_RE.test(str)) errs[name] = 'PIN must be 6 digits.'
    if (spec.type === 'number' && Number(str) < 0) errs[name] = 'Must be zero or more.'
  }
  return errs
}
