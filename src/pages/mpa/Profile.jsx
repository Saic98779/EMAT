import {
  Box, Card, CardContent, Grid, Typography, Alert, CircularProgress, Chip, Stack,
  Avatar, Divider, Tooltip,
} from '@mui/material'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { PageHeader } from '../../components/shared'
import { useAuth } from '../../auth'
import { useMyVendor } from '../../queries'
import { monoFont } from '../../theme'

// Vendor / Consultancy profile. Combines the logged-in user's account details
// (from the session) with their linked vendor record (from useMyVendor).
// Fully read-only — edits are managed by SDE via the Vendor Management page.

export default function Profile() {
  const { user, roleInfo } = useAuth()
  const vendorQ = useMyVendor(user?.email)
  const v = vendorQ.data

  if (vendorQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }

  const displayName = v?.vendorName || user?.name || user?.username || '—'
  const initials = (user?.initials || displayName.slice(0, 2).toUpperCase()) || 'MA'
  const roleLabel = roleInfo?.label || 'Manpower Agency'

  return (
    <Box>
      <PageHeader
        title="Profile"
        subtitle="Your account and vendor record. Edits are managed by SIDBI SDE."
      />

      {/* ── Identity banner ─────────────────────────────────────────────── */}
      <Card sx={{
        mb: 2.5,
        background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
        color: 'primary.contrastText',
      }}>
        <CardContent sx={{ py: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}>
            <Avatar sx={{
              width: 72, height: 72,
              bgcolor: 'primary.contrastText', color: 'primary.dark',
              fontSize: '1.6rem', fontWeight: 700,
              border: '3px solid rgba(255,255,255,0.35)',
            }}>
              {initials}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ opacity: 0.75, letterSpacing: '0.14em' }}>
                {roleLabel}
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.25, fontWeight: 700 }}>{displayName}</Typography>
              {v?.companyName && v.companyName !== displayName && (
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>{v.companyName}</Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
              {v && (
                <Chip
                  size="small"
                  label={v.active ? 'Active vendor' : 'Inactive vendor'}
                  color={v.active ? 'success' : 'default'}
                  sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'inherit', fontWeight: 700 }}
                />
              )}
              <Tooltip title="Read-only. Contact SDE to update.">
                <Chip
                  size="small"
                  icon={<LockOutlinedIcon />}
                  label="Read-only"
                  sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'inherit', fontWeight: 600 }}
                />
              </Tooltip>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {!v && (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          Your login isn&apos;t linked to a vendor record on the SDE side yet.
          Ask SIDBI SDE to add a vendor whose email matches your login (<strong>{user?.email}</strong>).
          Until then, only your account details are shown.
        </Alert>
      )}

      {/* ── Sections ────────────────────────────────────────────────────── */}
      <Grid container spacing={2.5}>
        {/* Account (session) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ProfileCard icon={<BadgeOutlinedIcon />} title="Account" subtitle="From your login session.">
            <FieldRow label="Username" value={user?.username} mono />
            <FieldRow label="Email" value={user?.email} mono />
            <FieldRow label="Role" value={roleLabel} />
            <FieldRow label="Posting"
              value={[user?.district, user?.state].filter(Boolean).join(', ') || null} />
          </ProfileCard>
        </Grid>

        {/* Company & Contact (vendor) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ProfileCard icon={<BusinessOutlinedIcon />} title="Company & Contact" subtitle="From your vendor record.">
            <FieldRow label="Vendor / Consultancy" value={v?.vendorName} />
            <FieldRow label="Legal / Company Name" value={v?.companyName} />
            <FieldRow label="Contact Person" value={v?.contactPerson} />
            <FieldRow label="Mobile" value={v?.mobileNo} mono />
          </ProfileCard>
        </Grid>

        {/* Tax IDs */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ProfileCard icon={<ReceiptLongOutlinedIcon />} title="Tax IDs">
            <FieldRow label="GSTIN" value={v?.gstNo} mono />
            <FieldRow label="PAN" value={v?.panNo} mono />
          </ProfileCard>
        </Grid>

        {/* Address */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ProfileCard icon={<PlaceOutlinedIcon />} title="Address">
            <FieldRow label="Address" value={v?.address} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}><FieldRow label="District" value={v?.district} /></Box>
              <Box sx={{ flex: 1 }}><FieldRow label="State" value={v?.state} /></Box>
              <Box sx={{ flex: 1 }}><FieldRow label="Pincode" value={v?.pinCode} mono /></Box>
            </Stack>
          </ProfileCard>
        </Grid>

        {/* Bank */}
        <Grid size={12}>
          <ProfileCard icon={<AccountBalanceOutlinedIcon />} title="Bank Details"
            subtitle="Used for salary disbursement transfers from SIDBI.">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><FieldRow label="Bank Name" value={v?.bankName} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><FieldRow label="Branch Name" value={v?.branchName} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><FieldRow label="Account Number" value={v?.accountNumber} mono /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><FieldRow label="IFSC Code" value={v?.ifscCode} mono /></Grid>
            </Grid>
          </ProfileCard>
        </Grid>
      </Grid>
    </Box>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────

function ProfileCard({ icon, title, subtitle, children }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar variant="rounded" sx={{ width: 34, height: 34, bgcolor: 'primary.light', color: 'primary.dark' }}>
            {icon}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            )}
          </Box>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1.75}>
          {children}
        </Stack>
      </CardContent>
    </Card>
  )
}

// ── Label / value row ────────────────────────────────────────────────────────

function FieldRow({ label, value, mono }) {
  const empty = value == null || value === ''
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ display: 'block', color: 'text.secondary', letterSpacing: '0.06em', mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 500,
          color: empty ? 'text.disabled' : 'text.primary',
          fontFamily: mono ? monoFont : undefined,
          fontSize: mono ? '0.92rem' : undefined,
          wordBreak: 'break-word',
        }}
      >
        {empty ? '—' : value}
      </Typography>
    </Box>
  )
}
