import { useState } from 'react'
import { InputAdornment, MenuItem } from '@mui/material'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell,
  EMAIL_RE, PHONE_RE,
  RhfTextField, SHRINK_LABEL, useForm, useWatch,
} from './_shared'
import { createContent, DIA_ENDPOINTS } from '../../apis/diaContent'

// DIA — PBSP Onboarding (Panel BDS Provider)
// GT_PMU raises; SIDBI HO Checker approves. Fields mirror the backend
// `CreateBdsServiceProvidersOnboardingRequest` DTO 1:1 (see FIELDS.backend).

const CONSTITUTION_OPTIONS = [
  'Society', 'Trust', 'Section 8 Company', 'Private Limited Company',
  'Public Limited Company', 'LLP', 'Partnership', 'Proprietorship', 'Other',
]
const IA_NATURE_OPTIONS = ['For-profit', 'Not-for-profit']
const YES_NO = ['Yes', 'No']
const PIN_RE = /^\d{6}$/

const NUMBER_INPUT_PROPS = { min: 0 }
const CURRENCY_INPUT_PROPS = { min: 0, step: '0.01' }
const CURRENCY_ADORNMENT = {
  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
}

// Field spec — keeps the mapping from UI key → backend field name + type
// in one place. Used both by the render loop and buildPayload.
const FIELDS = {
  providerName:          { backend: 'bdsProviderName',                label: 'BDS provider name',              required: true },
  doi:                   { backend: 'doi',                            label: 'Date of incorporation',          required: true, type: 'date' },
  constitution:          { backend: 'constitution',                   label: 'Constitution',                   required: true, type: 'select', options: CONSTITUTION_OPTIONS },
  address:               { backend: 'address',                        label: 'Address',                        required: true, multiline: true },
  state:                 { backend: 'state',                          label: 'State',                          required: true },
  district:              { backend: 'district',                       label: 'District',                       required: true },
  pinCode:               { backend: 'pinCode',                        label: 'PIN code',                       required: true, validate: 'pin' },
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
  { title: 'Identity',              fields: ['providerName', 'doi', 'constitution', 'iaNature', 'sector'] },
  { title: 'Address',               fields: ['address', 'state', 'district', 'pinCode'] },
  { title: 'Coverage & membership', fields: ['noOfOffices', 'identifiedClusterFlag', 'clusterName', 'otherClusterIA', 'totIaMembers', 'totMsmeIaMembers', 'ownAssociationIaFlag'] },
  { title: 'Infrastructure',        fields: ['itInfra', 'secretariatStaff'] },
  { title: 'Contacts',              fields: ['mainExecutiveName', 'executiveContactNo', 'nodalContactName', 'contactNumber', 'emailId', 'areaOfExpertise'] },
  { title: 'Performance',           fields: ['totLeadCasesGen', 'casesSanctionedAmt', 'casesDisbursedAmt'] },
  { title: 'SIDBI mapping',         fields: ['sidbiRoMappedWith', 'sidbiBoMappedWith', 'sidbiBseName', 'bseContactNumber', 'bseEmailId'] },
]

const INITIAL = Object.keys(FIELDS).reduce((acc, k) => { acc[k] = ''; return acc }, {})

export default function DiaPbspOnboarding() {
  const methods = useForm({ mode: 'onSubmit', defaultValues: INITIAL })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (values) => {
    setSubmitting(true)
    try {
      await createContent(DIA_ENDPOINTS.PBSP, buildPayload(values))
      setToast({ severity: 'success', msg: 'Submitted. Sent to SIDBI HO Checker for approval.' })
      methods.reset(INITIAL)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => methods.reset(INITIAL)

  return (
    <PmuFormShell
      title="PBSP Onboarding"
      subtitle="Add a Panel BDS Provider — submits to SIDBI HO Checker for approval."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      {SECTIONS.map((section, sIdx) => (
        <PmuSection key={section.title} first={sIdx === 0} title={section.title}>
          <FieldRow>
            {section.fields.map((key) => <PbspField key={key} name={key} />)}
          </FieldRow>
        </PmuSection>
      ))}
    </PmuFormShell>
  )
}

// A single PBSP field. Renders the right control based on spec.type,
// and — for showIf fields — subscribes to the required trigger via
// useWatch so it appears/disappears without re-rendering the whole form.
function PbspField({ name }) {
  const spec = FIELDS[name]
  if (!spec) return null
  if (spec.showIf) {
    return <ConditionalField name={name} spec={spec} />
  }
  return (
    <FieldCell span={cellSpan(spec)}>
      <RhfField name={name} spec={spec} />
    </FieldCell>
  )
}

function ConditionalField({ name, spec }) {
  const flag = useWatch({ name: 'identifiedClusterFlag' })
  const visible = spec.showIf({ identifiedClusterFlag: flag })
  if (!visible) return null
  return (
    <FieldCell span={cellSpan(spec)}>
      <RhfField name={name} spec={spec} />
    </FieldCell>
  )
}

function RhfField({ name, spec }) {
  const common = {
    name,
    fullWidth: true,
    required: !!spec.required,
    label: spec.label,
    rules: buildRules(spec),
  }
  if (spec.type === 'select' || spec.type === 'yesNo') {
    const options = spec.type === 'yesNo' ? YES_NO : spec.options
    return (
      <RhfTextField {...common} select>
        <MenuItem value=""><em>— Select —</em></MenuItem>
        {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </RhfTextField>
    )
  }
  if (spec.type === 'date') {
    return <RhfTextField {...common} type="date" InputLabelProps={SHRINK_LABEL} />
  }
  if (spec.type === 'number') {
    return <RhfTextField {...common} type="number" inputProps={NUMBER_INPUT_PROPS} />
  }
  if (spec.type === 'currency') {
    return (
      <RhfTextField
        {...common} type="number"
        inputProps={CURRENCY_INPUT_PROPS}
        InputProps={CURRENCY_ADORNMENT}
      />
    )
  }
  return (
    <RhfTextField
      {...common}
      multiline={!!spec.multiline}
      minRows={spec.multiline ? 2 : undefined}
    />
  )
}

function cellSpan(spec) {
  return spec.multiline ? 12 : { xs: 12, md: 6 }
}

function buildRules(spec) {
  return {
    validate: (v) => {
      const s = v == null ? '' : String(v).trim()
      if (spec.required && !s) return 'Required.'
      if (!s) return true
      if (spec.validate === 'email' && !EMAIL_RE.test(s)) return 'Enter a valid email address.'
      if (spec.validate === 'phone' && !PHONE_RE.test(s)) return 'Enter a valid phone number.'
      if (spec.validate === 'pin' && !PIN_RE.test(s)) return 'PIN must be 6 digits.'
      if (spec.type === 'number' && Number(s) < 0) return 'Must be zero or more.'
      return true
    },
  }
}

// Convert UI values → backend DTO shape:
// - yes/no → boolean
// - number / currency → parsed Number
// - hidden showIf fields → null
// - blank optional fields → null (backend expects null, not empty string)
function buildPayload(values) {
  const out = {}
  for (const [name, spec] of Object.entries(FIELDS)) {
    if (spec.showIf && !spec.showIf(values)) { out[spec.backend] = null; continue }
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
