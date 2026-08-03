import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Chip, Divider,
  CircularProgress, Snackbar, Alert, TextField, MenuItem,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { SectionCard } from '../../components/shared'
import DocUpload from '../../components/DocUpload'
import { useBse, useUpdateBse } from '../../queries'
import { toUpdatePayload, fromDto } from '../../apis/bseRecommendations'

const RECOMMENDATION_OPTIONS = ['Recommended', 'Not Recommended', 'Hold']

const todayIso = () => new Date().toISOString().slice(0, 10)

// Colour for the header status chip — mirrors BseTeam / BseCandidateDetail.
function statusColor(status) {
  switch (status) {
    case 'Onboarded': return 'success'
    case 'Committee reviewed':
    case 'HO reviewed': return 'info'
    case 'PMU reviewed': return 'warning'
    case 'Proposed by GT': return 'primary'
    default: return 'default'
  }
}

// SIDBI HO Maker workspace for a single BSE recommendation.
//
// Layout:
//   ① Candidate profile (read-only, from GT)
//   ② Upstream recommendations (GT, PMU — read-only)
//   ③ HO recommendation  (editable — HO Maker owns)
//   ④ Committee decision (editable — with MoM filename)
//   ⑤ Onboarding block   (revealed after Committee = "Recommended")
//   + Supporting documents sidebar (upload/download, MoM lives here too)
export default function HoBseReview() {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const bseQ = useBse(uuid)
  const updateM = useUpdateBse()
  const dto = bseQ.data
  const view = useMemo(() => (dto ? fromDto(dto) : null), [dto])

  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [savingBlock, setSavingBlock] = useState(null) // 'ho' | 'committee' | 'onboarding'

  // Local drafts per block so HO can edit without triggering re-fetches.
  const [ho, setHo] = useState({ recommendation: '', date: '', remarks: '' })
  const [committee, setCommittee] = useState({ recommendation: '', date: '', remarks: '', mom: '' })
  const [onboarding, setOnboarding] = useState({
    approvedSalary: '', approvedTravelAllowance: '', dateOfJoining: '', iaMapped: false,
  })

  // Seed drafts from the fetched record.
  useEffect(() => {
    if (!dto) return
    setHo({
      recommendation: dto.hoRecommendation || '',
      date: (dto.hoRecommendationDate || '').slice(0, 10),
      remarks: dto.hoRemarks || '',
    })
    setCommittee({
      recommendation: dto.committeeRecommendation || '',
      date: (dto.committeeDate || '').slice(0, 10),
      remarks: dto.committeeRemarks || '',
      mom: dto.committeeMom || '',
    })
    setOnboarding({
      approvedSalary: dto.approvedSalary ?? '',
      approvedTravelAllowance: dto.approvedTravelAllowance ?? '',
      dateOfJoining: (dto.dateOfJoining || '').slice(0, 10),
      iaMapped: !!dto.iaMapped,
    })
  }, [dto])

  const saveBlock = async (block, patchSource) => {
    setSavingBlock(block)
    try {
      const patch = toUpdatePayload(patchSource)
      await updateM.mutateAsync({ uuid, patch })
      setToast({ severity: 'success', msg: `${labelFor(block)} saved.` })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save.' })
    } finally {
      setSavingBlock(null)
    }
  }

  const saveHo = () => saveBlock('ho', {
    hoRecommendation: ho.recommendation,
    hoRecommendationDate: ho.date || todayIso(),
    hoRemarks: ho.remarks,
  })

  const saveCommittee = () => saveBlock('committee', {
    committeeRecommendation: committee.recommendation,
    committeeDate: committee.date || todayIso(),
    committeeRemarks: committee.remarks,
    committeeMom: committee.mom,
  })

  const saveOnboarding = () => saveBlock('onboarding', {
    approvedSalary: onboarding.approvedSalary,
    approvedTravelAllowance: onboarding.approvedTravelAllowance,
    dateOfJoining: onboarding.dateOfJoining || todayIso(),
    iaMapped: onboarding.iaMapped,
  })

  if (bseQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (bseQ.error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/bse-approvals')} sx={{ mb: 2 }}>BSE Approvals</Button>
        <Alert severity="error">{bseQ.error.message || 'Failed to load candidate'}</Alert>
      </Box>
    )
  }
  if (!view) return null

  // Onboarding is only meaningful after Committee has recommended the candidate.
  const committeeApproved = committee.recommendation === 'Recommended'

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/bse-approvals')} sx={{ mb: 2 }}>BSE Approvals</Button>

      {/* Header */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
            <Typography variant="h5">{view.name}</Typography>
            <Chip size="small" color={statusColor(view.status)} label={view.status} />
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Submitted {view.submitted} · {view.ia}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            {/* ① Candidate profile (read-only) */}
            <SectionCard title="Candidate profile" subtitle="Captured by GT Field Manager.">
              <Grid container spacing={2}>
                <ReadField label="Mobile" value={view.mobile} />
                <ReadField label="Email" value={view.email} />
                <ReadField label="Qualification" value={view.qualification} />
                <ReadField label="Experience" value={view.experience} />
                <ReadField label="Employment status" value={view.employmentStatus} />
                <ReadField label="Current salary" value={view.currentSalary != null ? `₹${view.currentSalary}` : '—'} />
                <ReadField label="Notice period" value={view.noticePeriod != null ? `${view.noticePeriod}d` : '—'} />
                <ReadField label="Last drawn salary" value={view.lastDrawnSalary != null ? `₹${view.lastDrawnSalary}` : '—'} />
                <ReadField label="Expected salary" value={view.expectedSalary ? `₹${view.expectedSalary}` : '—'} />
                <ReadField label="Resume status" value={view.resumeStatus} />
              </Grid>
            </SectionCard>

            {/* ② Upstream recommendations (read-only) */}
            <SectionCard title="Upstream recommendations" subtitle="GT and PMU have already reviewed this candidate.">
              <Stack divider={<Divider flexItem />} spacing={2}>
                <StageRow
                  label="GT Field"
                  status={dto.gtRecommendation}
                  date={dto.gtRecommendationDate}
                  remarks={dto.gtRemarks}
                />
                <StageRow
                  label="GT PMU"
                  status={dto.pmuRecommendation}
                  date={dto.pmuRecommendationDate}
                  remarks={dto.pmuRemarks}
                />
              </Stack>
            </SectionCard>

            {/* ③ HO recommendation (editable) */}
            <SectionCard title="HO recommendation" subtitle="Your review at the SIDBI HO stage.">
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select fullWidth size="small" label="Recommendation"
                    value={ho.recommendation}
                    onChange={(e) => setHo((p) => ({ ...p, recommendation: e.target.value }))}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {RECOMMENDATION_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    fullWidth size="small" type="date" label="Date"
                    InputLabelProps={{ shrink: true }}
                    value={ho.date}
                    onChange={(e) => setHo((p) => ({ ...p, date: e.target.value }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField
                    fullWidth size="small" label="Remarks"
                    value={ho.remarks}
                    onChange={(e) => setHo((p) => ({ ...p, remarks: e.target.value }))}
                  />
                </Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end" mt={1.5}>
                <Button size="small" variant="contained"
                  startIcon={savingBlock === 'ho' ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                  disabled={savingBlock === 'ho'}
                  onClick={saveHo}>
                  {savingBlock === 'ho' ? 'Saving…' : 'Save HO recommendation'}
                </Button>
              </Stack>
            </SectionCard>

            {/* ④ Committee decision (editable) */}
            <SectionCard title="Committee decision" subtitle="Recorded by SIDBI HO Maker on behalf of the committee.">
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select fullWidth size="small" label="Committee status"
                    value={committee.recommendation}
                    onChange={(e) => setCommittee((p) => ({ ...p, recommendation: e.target.value }))}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {RECOMMENDATION_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    fullWidth size="small" type="date" label="Committee date"
                    InputLabelProps={{ shrink: true }}
                    value={committee.date}
                    onChange={(e) => setCommittee((p) => ({ ...p, date: e.target.value }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField
                    fullWidth size="small" label="MoM file / reference"
                    placeholder="e.g. committee_mom_2026-08-03.pdf"
                    helperText="Upload the actual PDF via the Supporting Documents panel; paste the filename here."
                    value={committee.mom}
                    onChange={(e) => setCommittee((p) => ({ ...p, mom: e.target.value }))}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth size="small" label="Committee remarks" multiline minRows={2}
                    value={committee.remarks}
                    onChange={(e) => setCommittee((p) => ({ ...p, remarks: e.target.value }))}
                  />
                </Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end" mt={1.5}>
                <Button size="small" variant="contained"
                  startIcon={savingBlock === 'committee' ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                  disabled={savingBlock === 'committee'}
                  onClick={saveCommittee}>
                  {savingBlock === 'committee' ? 'Saving…' : 'Save committee decision'}
                </Button>
              </Stack>
            </SectionCard>

            {/* ⑤ Onboarding (revealed only after Committee = Recommended) */}
            {committeeApproved && (
              <SectionCard
                title="Onboarding"
                subtitle="Confirm salary, travel allowance, joining date and IA mapping."
                action={<Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="Committee approved" />}
              >
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TextField
                      fullWidth size="small" type="number" label="Approved salary (₹/month)"
                      InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> }}
                      value={onboarding.approvedSalary}
                      onChange={(e) => setOnboarding((p) => ({ ...p, approvedSalary: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TextField
                      fullWidth size="small" type="number" label="Approved TA (₹/month)"
                      InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> }}
                      value={onboarding.approvedTravelAllowance}
                      onChange={(e) => setOnboarding((p) => ({ ...p, approvedTravelAllowance: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TextField
                      fullWidth size="small" type="date" label="Date of joining"
                      InputLabelProps={{ shrink: true }}
                      value={onboarding.dateOfJoining}
                      onChange={(e) => setOnboarding((p) => ({ ...p, dateOfJoining: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TextField
                      select fullWidth size="small" label="IA Mapped"
                      value={onboarding.iaMapped ? 'yes' : 'no'}
                      onChange={(e) => setOnboarding((p) => ({ ...p, iaMapped: e.target.value === 'yes' }))}
                    >
                      <MenuItem value="no">No</MenuItem>
                      <MenuItem value="yes">Yes</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
                <Stack direction="row" justifyContent="flex-end" mt={1.5}>
                  <Button size="small" variant="contained" color="success"
                    startIcon={savingBlock === 'onboarding' ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                    disabled={savingBlock === 'onboarding'}
                    onClick={saveOnboarding}>
                    {savingBlock === 'onboarding' ? 'Saving…' : 'Save onboarding details'}
                  </Button>
                </Stack>
              </SectionCard>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2.5} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
            {/* Supporting docs — HO can attach the MoM here too. */}
            <DocUpload registrationUuid={dto.registrationUuid} />
          </Stack>
        </Grid>
      </Grid>

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

function ReadField({ label, value }) {
  return (
    <Grid size={{ xs: 6, sm: 4, md: 3 }}>
      <Typography variant="overline" color="text.secondary" display="block">{label}</Typography>
      <Typography fontWeight={500}>{value ?? '—'}</Typography>
    </Grid>
  )
}

// Single upstream-stage row: status chip + date + remarks. Compact, read-only.
function StageRow({ label, status, date, remarks }) {
  const decided = !!status
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
      <Typography variant="subtitle2" sx={{ minWidth: 100 }}>{label}</Typography>
      <Chip size="small"
        color={status === 'Recommended' ? 'success' : status === 'Not Recommended' ? 'error' : 'default'}
        label={decided ? status : 'Pending'}
        sx={{ fontWeight: 600 }} />
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
        {date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
      </Typography>
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        {remarks || <Box component="span" sx={{ color: 'text.disabled' }}>No remarks</Box>}
      </Typography>
    </Stack>
  )
}

function labelFor(block) {
  if (block === 'ho') return 'HO recommendation'
  if (block === 'committee') return 'Committee decision'
  if (block === 'onboarding') return 'Onboarding details'
  return 'Section'
}
