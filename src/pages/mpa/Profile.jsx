import { Box, Card, CardContent, Grid, Typography, Alert, CircularProgress, Chip, Stack } from '@mui/material'
import { PageHeader } from '../../components/shared'
import { useAuth } from '../../auth'
import { useMyVendor } from '../../queries'

// Vendor / Consultancy — read-only view of the vendor record. SDE remains
// the source of truth for edits (see `pages/sde/Vendors.jsx`). If we later
// let vendors self-edit a subset (contact person, mobile, bank details),
// promote a couple of Fields to editable and add a save button.
export default function Profile() {
  const { user } = useAuth()
  const vendorQ = useMyVendor(user?.email)
  const v = vendorQ.data

  if (vendorQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }

  if (!v) {
    return (
      <Box>
        <PageHeader title="Profile" subtitle="Your vendor / consultancy record." />
        <Alert severity="warning">
          Your login isn&apos;t linked to a vendor record on the SDE side yet.
          Ask SDE to add a vendor whose email matches your login.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Profile"
        subtitle="Your vendor / consultancy record. Edits are managed by SIDBI SDE."
      />

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
            <Typography variant="h5">{v.vendorName || '—'}</Typography>
            <Chip size="small"
              color={v.active ? 'success' : 'default'}
              variant={v.active ? 'filled' : 'outlined'}
              label={v.active ? 'Active' : 'Inactive'} />
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {v.companyName || '—'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ProfileSection title="Company & Contact">
            <Field label="Vendor Name" value={v.vendorName} />
            <Field label="Company Name" value={v.companyName} />
            <Field label="Contact Person" value={v.contactPerson} />
            <Field label="Email" value={v.email} mono />
            <Field label="Mobile" value={v.mobileNo} mono />
          </ProfileSection>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ProfileSection title="Tax IDs">
            <Field label="GSTIN" value={v.gstNo} mono />
            <Field label="PAN" value={v.panNo} mono />
          </ProfileSection>

          <Box sx={{ mt: 2.5 }}>
            <ProfileSection title="Address">
              <Field label="Address" value={v.address} />
              <Field label="District" value={v.district} />
              <Field label="State" value={v.state} />
              <Field label="Pincode" value={v.pinCode} mono />
            </ProfileSection>
          </Box>
        </Grid>

        <Grid size={12}>
          <ProfileSection title="Bank Details">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><Field label="Bank Name" value={v.bankName} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><Field label="Branch Name" value={v.branchName} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><Field label="Account Number" value={v.accountNumber} mono /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><Field label="IFSC Code" value={v.ifscCode} mono /></Grid>
            </Grid>
          </ProfileSection>
        </Grid>
      </Grid>
    </Box>
  )
}

function ProfileSection({ title, children }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.25, letterSpacing: '0.12em' }}>
          {title}
        </Typography>
        <Stack spacing={1.5}>
          {children}
        </Stack>
      </CardContent>
    </Card>
  )
}

function Field({ label, value, mono }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography fontWeight={500} sx={mono ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.9rem' } : undefined}>
        {value || '—'}
      </Typography>
    </Box>
  )
}
