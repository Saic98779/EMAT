import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Stepper, Step, StepLabel,
  Divider, Chip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { StatusChip, SectionCard, Mono } from '../../components/shared'
import { industryAssociations } from '../../data'
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
  const ia = industryAssociations.find((x) => x.id === id)

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
          </Stack>
          <Mono>{ia.id} · {ia.sector} · est. {ia.est}</Mono>
          <Stepper activeStep={ia.stage} alternativeLabel sx={{ mt: 3 }}>
            {STEPS.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
          </Stepper>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2.5}>
            <SectionCard title="Association details">
              <Grid container spacing={3}>
                <Grid size={6}><Field label="Year of incorporation">{ia.est}</Field></Grid>
                <Grid size={6}><Field label="Sector">{ia.sector}</Field></Grid>
                <Grid size={12}><Field label="Registered address">{ia.address}</Field></Grid>
                <Grid size={6}><Field label="Nearest SIDBI branch">{ia.branch}</Field></Grid>
                <Grid size={6}><Field label="Location">{ia.city}, {ia.state}</Field></Grid>
              </Grid>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={3}>
                <Contact label="Apex office holder" person={ia.apex} />
                <Contact label="Nodal person" person={ia.nodal} />
              </Stack>
            </SectionCard>

            {d && (
              <SectionCard title={<>Detailed proposal <Chip label="Level 2" size="small" color="info" sx={{ ml: 1, bgcolor: 'info.light', color: 'info.dark' }} /></>}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 6, sm: 4 }}><Field label="Member units">{d.memberUnits}</Field></Grid>
                  <Grid size={{ xs: 6, sm: 4 }}><Field label="Annual turnover">{d.turnover}</Field></Grid>
                  <Grid size={{ xs: 6, sm: 4 }}><Field label="Funding ask">{d.fundingAsk}</Field></Grid>
                  <Grid size={{ xs: 6, sm: 4 }}><Field label="Employment">{d.employment}</Field></Grid>
                  <Grid size={{ xs: 6, sm: 4 }}><Field label="Women workforce">{d.womenWorkforce}</Field></Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Field label="Purpose / utilisation">{d.purpose}</Field>
              </SectionCard>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
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
        </Grid>
      </Grid>
    </Box>
  )
}
