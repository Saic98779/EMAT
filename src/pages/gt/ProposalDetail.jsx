import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Stepper, Step, StepLabel,
  Divider, Chip, CircularProgress, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { StatusChip, SectionCard, Mono } from '../../components/shared'
import DocUpload from '../../components/DocUpload'
import AppraisalForm from '../../components/AppraisalForm'
import {
  useIA, useApproveIA, useApproveAppraisal,
  useBranchesByState, useSdesByBranch,
} from '../../queries'
import { useAuth } from '../../auth'
import { monoFont } from '../../theme'

const STEPS = ['Basic appraisal (L1)', 'Detailed proposal', 'Final approval (L2)']

function Field({ label, children }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" display="block">{label}</Typography>
      <Typography fontWeight={500}>{children}</Typography>
    </Box>
  )
}

function Contact({ label, person }) {
  return (
    <Card sx={{ bgcolor: 'background.default', flex: 1 }}>
      <CardContent>
        <Typography variant="overline" color="secondary.main">{label}</Typography>
        <Typography fontWeight={700}>{person.name}</Typography>
        <Typography variant="body2" color="text.secondary" mb={1}>{person.role}</Typography>
        <Typography sx={{ fontFamily: monoFont, fontSize: '0.8rem' }}>{person.phone}</Typography>
        <Typography sx={{ fontFamily: monoFont, fontSize: '0.8rem', color: 'text.secondary' }}>{person.email}</Typography>
      </CardContent>
    </Card>
  )
}

export default function ProposalDetail({ backPath = '/gt/ias' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isGt = backPath.startsWith('/gt')
  const isSde = backPath.startsWith('/sde')

  const { rawRole } = useAuth()
  const isClusterExpert = rawRole === 'CLUSTER_EXPERT'

  const iaQ = useIA(id)
  const approveL1 = useApproveIA()
  const approveL2 = useApproveAppraisal()

  const [toast, setToast] = useState({ severity: '', msg: '' })
  // Open dialog carries both the stage (1 = L1 registration, 2 = L2 appraisal)
  // and the intent (approve / reject) — both flow through the same PATCH
  // endpoint with `isSidbeApproved: true|false`.
  const [decisionOpen, setDecisionOpen] = useState(null) // { level: 1|2, action: 'approve'|'reject' } | null

  const ia0 = iaQ.data
  // Hide DecisionCard once a decision has already been recorded, whether
  // approved or rejected. `isSidbeApproved !== null` means the SDE has
  // acted on the record.
  const l1Decided = ia0?.raw?.isSidbeApproved != null
  const l2Decided = ia0?.appraisal?.isSidbeApproved != null
  const canApproveL1 = isSde && ia0?.stage === 0 && !l1Decided
  const canApproveL2 = isSde && ia0?.stage === 1 && ia0?.appraisal && !l2Decided
  const approving = approveL1.isPending || approveL2.isPending

  // SDE decisions — both mutations swap the detail cache in place, so this
  // page updates without a follow-up GET.
  const runDecision = async () => {
    if (approving || !ia0 || !decisionOpen) return
    const { level, action } = decisionOpen
    const isSidbeApproved = action === 'approve'
    try {
      if (level === 1) {
        await approveL1.mutateAsync({ uuid: ia0.uuid, isSidbeApproved })
      } else if (level === 2 && ia0.appraisal?.uuid) {
        await approveL2.mutateAsync({
          uuid: ia0.appraisal.uuid,
          registrationUuid: ia0.uuid,
          isSidbeApproved,
        })
      }
      setToast({
        severity: 'success',
        msg: `${ia0.name} — ${action === 'approve' ? 'approved' : 'rejected'} (L${level}).`,
      })
      setDecisionOpen(null)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || `Failed to ${action}.` })
    }
  }

  if (iaQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (iaQ.error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>Industry Associations</Button>
        <Alert severity="error">{iaQ.error.message || 'Failed to load Industry Association'}</Alert>
      </Box>
    )
  }
  const ia = iaQ.data
  if (!ia) return <Typography>Association not found.</Typography>
  const d = ia.detailed

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>Industry Associations</Button>

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" mb={3}>
            <Typography variant="h5">{ia.name}</Typography>
            <StatusChip status={ia.status} />
            {isSde && ia.stage === 0 && (
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} sx={{ ml: 'auto' }}
                onClick={() => navigate(`/sde/ias/${ia.id}/edit`)}>
                Edit registration
              </Button>
            )}
            {isGt && ia.stage === 1 && (
              <Button variant="contained" endIcon={<EastIcon />} sx={{ ml: 'auto' }}
                onClick={() => navigate(`/gt/ias/${ia.id}/appraisal`)}>
                {ia.status === 'Changes Requested' ? 'Revise detailed appraisal' : 'Continue detailed appraisal'}
              </Button>
            )}
            {isClusterExpert && ia.appraisal && !ia.appraisal.isSidbeApproved && (
              <Button variant="contained" endIcon={<EastIcon />} sx={{ ml: 'auto' }}
                onClick={() => navigate(`/sde/ias/${ia.id}/appraisal`)}>
                Review & add comments
              </Button>
            )}
          </Stack>
          <Mono>{[ia.sector, ia.est && `est. ${ia.est}`].filter((x) => x && x !== '—').join(' · ') || '—'}</Mono>
          <Stepper activeStep={ia.stage} alternativeLabel sx={{ mt: 3 }}>
            {STEPS.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
          </Stepper>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            {isSde ? (
              <SectionCard title="Detailed appraisal & Due Diligence" subtitle="Modify GT-submitted fields and add your Due Diligence comments. Saves via PUT to the appraisal.">
                <AppraisalForm
                  registrationUuid={ia.uuid}
                  onSaved={(msg, severity) => setToast({ severity, msg })}
                />
              </SectionCard>
            ) : (
              <>
                <RegistrationDetailsResolved ia={ia} />
                {ia.appraisal && <AppraisalDetails appraisal={ia.appraisal} />}
              </>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2.5} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
            {(canApproveL1 || canApproveL2) && (
              <DecisionCard
                level={canApproveL1 ? 1 : 2}
                approving={approving}
                onApprove={() => setDecisionOpen({ level: canApproveL1 ? 1 : 2, action: 'approve' })}
                onReject={() => setDecisionOpen({ level: canApproveL1 ? 1 : 2, action: 'reject' })}
              />
            )}
            <DocUpload registrationUuid={ia.uuid} />
            <SectionCard title="Appraisal trail">
            <Stack spacing={0}>
              {ia.trail.map((t, i) => (
                <Stack key={i} direction="row" spacing={2}>
                  <Stack alignItems="center">
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'secondary.main', mt: 0.5 }} />
                    {i < ia.trail.length - 1 && <Box sx={{ flexGrow: 1, width: 2, bgcolor: 'divider', my: 0.5 }} />}
                  </Stack>
                  <Box sx={{ pb: 3 }}>
                    <Typography fontWeight={700} fontSize="0.92rem">{t.title}</Typography>
                    <Mono>{t.by} · {t.date}</Mono>
                    {t.note && (
                      <Box sx={{ mt: 1, p: 1.25, borderLeft: '3px solid', borderColor: 'secondary.light', bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2">{t.note}</Typography>
                      </Box>
                    )}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      <Dialog
        open={!!decisionOpen}
        onClose={() => !approving && setDecisionOpen(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '6px' } }}
      >
        <DialogTitle sx={{ pb: 0.5, fontWeight: 700 }}>
          {decisionOpen?.action === 'reject'
            ? (decisionOpen?.level === 1 ? 'Reject In-Principle (L1)?' : 'Reject Final (L2)?')
            : (decisionOpen?.level === 1 ? 'Approve In-Principle (L1)?' : 'Approve Final (L2)?')}
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography fontWeight={600}>{ia.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {[ia.city, ia.state].filter((x) => x && x !== '—').join(', ') || '—'} · Submitted {ia.submitted}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDecisionOpen(null)} disabled={approving} color="inherit" size="small">
            Cancel
          </Button>
          <Button
            variant="contained"
            color={decisionOpen?.action === 'reject' ? 'error' : 'primary'}
            size="small"
            onClick={runDecision}
            disabled={approving}
            startIcon={approving ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {approving
              ? (decisionOpen?.action === 'reject' ? 'Rejecting…' : 'Approving…')
              : (decisionOpen?.action === 'reject' ? 'Reject' : 'Approve')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3000}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity || 'info'} variant="filled" onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// Small sidebar action card. Label + Approve + Reject.
function DecisionCard({ level, approving, onApprove, onReject }) {
  return (
    <Card>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {level === 1 ? 'In-Principle Approval' : 'Final Approval'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="error"
            disableElevation
            onClick={onReject}
            disabled={approving}
            sx={{ flex: 1 }}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            color="primary"
            disableElevation
            onClick={onApprove}
            disabled={approving}
            sx={{ flex: 1 }}
          >
            {approving ? '…' : `Approve L${level}`}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

// ── Rich-detail sections ────────────────────────────────────────────────────
// The In-Principle DTO has 60+ fields; the SDE needs to see every one before
// approving. Sections are grouped by concern; empty groups render "—".

function yesNo(v) {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  return '—'
}
function fmt(v) {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  return String(v)
}
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMoney(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : String(v)
}
// Grant proposed is stored as the full rupee amount. Show ₹ formatted with
// the Indian grouping (e.g. ₹12,60,000), and also the Lakhs equivalent as a
// secondary hint when it's a whole/near-whole number of lakhs.
function fmtLakhs(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const rupees = n.toLocaleString('en-IN')
  const lakhs = n / 100000
  return `₹${rupees} (₹${Number(lakhs.toFixed(2))} Lakhs)`
}

// One "field row" in the compact key/value grid.
function Row({ label, value, span = { xs: 12, sm: 6, md: 4 } }) {
  return (
    <Grid size={span}>
      <Typography variant="overline" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>{label}</Typography>
      <Typography fontWeight={500} sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Grid>
  )
}

// Named group of rows, with an inline subheading + divider.
function Group({ title, children }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5, mt: 1 }}>
        <Typography variant="overline" color="secondary.dark" sx={{ whiteSpace: 'nowrap' }}>{title}</Typography>
        <Divider sx={{ flexGrow: 1 }} />
      </Stack>
      <Grid container spacing={2}>{children}</Grid>
    </Box>
  )
}

// Fetches the branch + SDE dropdown lists needed to resolve UUIDs stored on
// the registration DTO to their display names, then delegates to
// RegistrationDetails with a raw object whose UUID fields have been swapped
// for names. If a lookup misses, the original value stays (safe fallback).
function RegistrationDetailsResolved({ ia }) {
  const r = ia.raw || {}
  const branchesQ = useBranchesByState(r.state)
  const branchName = branchesQ.data?.find((b) => b.uuid === r.sidbiBranch)?.branchName
  const sdesQ = useSdesByBranch(r.sidbiBranch)
  const sdeName = sdesQ.data?.find((s) => s.uuid === r.sde)?.name

  const resolved = {
    ...ia,
    raw: {
      ...r,
      sidbiBranch: branchName || r.sidbiBranch,
      sde: sdeName || r.sde,
    },
  }
  return <RegistrationDetails ia={resolved} />
}

function RegistrationDetails({ ia }) {
  const r = ia.raw || {}
  return (
    <SectionCard title="Registration details">
      <Stack spacing={2}>
        <Group title="Identity">
          <Row label="Association name" value={fmt(r.industryAssociationName)} span={{ xs: 12, sm: 8 }} />
          <Row label="Type" value={fmt(r.iaType)} span={{ xs: 12, sm: 4 }} />
          <Row label="Constitution" value={
            r.constitutionType === 'Other'
              ? `Other — ${fmt(r.constitutionOther)}`
              : fmt(r.constitutionType)
          } />
          <Row label="Incorporation date" value={fmtDate(r.incorporationDate)} />
          <Row label="SIDBI branch" value={fmt(r.sidbiBranch)} />
        </Group>

        <Group title="Address">
          <Row label="State" value={fmt(r.state)} />
          <Row label="District" value={fmt(r.district)} />
          <Row label="Pincode" value={fmt(r.pincode)} />
          <Row label="Address proof" value={
            r.addressProofType ? `${r.addressProofType} · ${fmt(r.addressProof)}` : '—'
          } span={{ xs: 12, sm: 6 }} />
          <Row label="ID proof" value={
            r.idProofType ? `${r.idProofType} · ${fmt(r.idProof)}` : '—'
          } span={{ xs: 12, sm: 6 }} />
        </Group>

        <Group title="Apex office holder">
          <Row label="Name" value={fmt(r.apexHolderName)} />
          <Row label="Designation" value={fmt(r.apexHolderDesignation)} />
          <Row label="Mobile" value={fmt(r.apexHolderMobile)} />
          <Row label="Email" value={fmt(r.apexHolderEmail)} span={{ xs: 12, sm: 8, md: 8 }} />
        </Group>

        <Group title="Nodal person">
          <Row label="Name" value={fmt(r.nodalName)} />
          <Row label="Designation" value={fmt(r.nodalDesignation)} />
          <Row label="Mobile" value={fmt(r.nodalMobile)} />
          <Row label="Email" value={fmt(r.nodalEmail)} span={{ xs: 12, sm: 8, md: 8 }} />
        </Group>

        <Group title="Cluster & MSME footprint">
          <Row label="Mapped to a cluster" value={yesNo(r.mappedWithCluster)} />
          <Row label="Cluster name" value={fmt(r.clusterName)} />
          <Row label="Mapped to important district" value={yesNo(r.mappedWithImportantDistrict)} />
          <Row label="MSMEs (without traders) in district" value={fmt(r.msmeCountWithoutTraders ?? r.districtMsmeCount)} />
          <Row label="Active members > 200" value={yesNo(r.activeMembersAbove200)} />
          <Row label="Active member count" value={fmt(r.activeMembersCount)} />
          <Row label="Member directory available" value={yesNo(r.memberDirectoryAvailable)} />
          <Row label="Justification" value={fmt(r.justification)} span={12} />
        </Group>

        <Group title="Infrastructure & operations">
          <Row label="Building type" value={fmt(r.buildingType)} />
          <Row label="Declaration signed" value={yesNo(r.declarationSigned)} />
          <Row label="IT infrastructure" value={yesNo(r.itInfrastructureAvailable)} />
          <Row label="Infra details" value={fmt(r.infrastructureType)} span={{ xs: 12, sm: 8 }} />
          <Row label="Secretariat staff" value={yesNo(r.secretariatStaffAvailable)} />
          <Row label="Website" value={yesNo(r.websiteAvailable)} />
          <Row label="Website URL" value={fmt(r.websiteUrl)} span={{ xs: 12, sm: 8 }} />
          <Row label="Paid services" value={yesNo(r.paidServicesAvailable)} />
          <Row label="Adverse remarks" value={yesNo(r.adverseRemarksAvailable)} />
          <Row label="Adverse details" value={fmt(r.adverseRemarks)} span={12} />
        </Group>

        <Group title="Selection & willingness">
          <Row label="Basis of selection" value={fmt(r.selectionCriteria)} span={12} />
          <Row label="Worked with SIDBI before" value={yesNo(r.workedWithSidbiBefore)} />
          <Row label="Willingness comments" value={fmt(r.willingnessComments)} span={{ xs: 12, sm: 8 }} />
        </Group>

        <Group title="Grant & envisaged impact">
          <Row label="Grant proposed" value={fmtLakhs(r.grantProposed)} />
          <Row label="Grant details" value={fmt(r.grantDetails)} span={{ xs: 12, sm: 8 }} />
          <Row label="Envisaged output" value={fmt(r.envisagedOutput)} span={12} />
          <Row label="Envisaged outcome" value={fmt(r.envisagedOutcome)} span={12} />
          <Row label="Envisaged impact" value={fmt(r.envisagedImpact)} span={12} />
        </Group>

        <Group title="SDE assignment & metadata">
          <Row label="Assigned SDE" value={fmt(r.sde)} span={{ xs: 12, sm: 8 }} />
          <Row label="SIDBI approved" value={yesNo(r.isSidbeApproved)} />
          <Row label="Approved by" value={fmt(r.sidbeApprovedByUsername)} />
          <Row label="Created by" value={fmt(r.createdBy)} />
          <Row label="Created" value={fmtDate(r.createdAt)} />
          <Row label="Updated" value={fmtDate(r.updatedAt)} />
        </Group>
      </Stack>
    </SectionCard>
  )
}

function AppraisalDetails({ appraisal }) {
  const a = appraisal || {}
  return (
    <SectionCard
      title={<>Detailed appraisal <Chip label="Level 2" size="small" color="info" sx={{ ml: 1, bgcolor: 'info.light', color: 'info.dark' }} /></>}
    >
      <Stack spacing={2}>
        <Group title="CIBIL">
          <Row label="Report ref no." value={fmt(a.cibilReportReferenceNo)} />
          <Row label="Report date" value={fmtDate(a.cibilReportDate)} />
          <Row label="Ranking" value={fmt(a.cibilRanking)} />
          <Row label="Remarks" value={fmt(a.cibilRemarks)} span={12} />
          <Row label="Beneficial owner CIBIL remarks" value={fmt(a.beneficialOwnerCibilRemarks)} span={12} />
        </Group>

        <Group title="SMART report">
          <Row label="Report ref no." value={fmt(a.smartReportReferenceNo)} />
          <Row label="Report date" value={fmtDate(a.smartReportDate)} />
          <Row label="Remarks" value={fmt(a.smartReportRemarks)} span={{ xs: 12, sm: 6 }} />
          <Row label="Beneficial owner SMART remarks" value={fmt(a.beneficialOwnerSmartRemarks)} span={12} />
        </Group>

        <Group title="Statutory checks">
          <Row label="NGO Darpan number" value={fmt(a.ngoDarpanNumber)} />
          <Row label="NABARD blacklisted" value={yesNo(a.nabardBlacklisted)} />
          <Row label="Web search verified" value={yesNo(a.webSearchVerified)} />
          <Row label="Web search document" value={fmt(a.webSearchDocument)} span={{ xs: 12, sm: 8 }} />
        </Group>

        <Group title="Sector & scope">
          <Row label="Major sources of income" value={fmt(a.majorSourcesOfIncome)} span={12} />
          <Row label="Activities last year" value={fmt(a.activitiesLastYear)} span={12} />
          <Row label="Top three sectors" value={fmt(a.topThreeSectors)} span={12} />
          <Row label="Financing scope" value={fmt(a.financingScope)} span={{ xs: 12, sm: 6 }} />
          <Row label="Project location" value={fmt(a.projectLocation)} span={{ xs: 12, sm: 6 }} />
        </Group>

        <Group title="IA readiness">
          <Row label="Formalization comments" value={fmt(a.formalizationComments)} span={12} />
          <Row label="Referral arrangement comments" value={fmt(a.referralArrangementComments)} span={12} />
          <Row label="BSE readiness comments" value={fmt(a.bseReadinessComments)} span={12} />
        </Group>

        <Group title="Cluster Expert">
          <Row label="Comments" value={fmt(a.clusterExpertComments)} span={12} />
        </Group>

        <Group title="Budget & terms">
          <Row label="Budget allocated" value={fmtMoney(a.budgetAllocated)} />
          <Row label="Utilized amount" value={fmtMoney(a.utilizedAmount)} />
          <Row label="Available budget" value={fmtMoney(a.availableBudget)} />
          <Row label="DoP date" value={fmtDate(a.dopDate)} />
          <Row label="Terms & conditions" value={fmt(a.termsAndConditions)} span={12} />
        </Group>

        <Group title="Recommendation">
          <Row label="Recommendation" value={fmt(a.recommendation)} />
          <Row label="Remarks" value={fmt(a.recommendationRemarks)} span={{ xs: 12, sm: 8 }} />
          <Row label="SIDBI approved (L2)" value={yesNo(a.isSidbeApproved)} />
          <Row label="Approved by" value={fmt(a.sidbeApprovedByUsername)} />
          <Row label="Created by" value={fmt(a.createdBy)} />
          <Row label="Updated" value={fmtDate(a.updatedAt)} />
        </Group>
      </Stack>
    </SectionCard>
  )
}
