import { useMemo, useState } from 'react'
import {
  Box, Card, Table, TableHead, TableBody, TableRow, TableCell, Typography, Button,
  Alert, CircularProgress, TextField, InputAdornment, Chip,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import { PageHeader, Mono } from '../../components/shared'
import { useAuth } from '../../auth'
import { useMyVendor, useBseByUserSelected } from '../../queries'

// Manpower Agency workspace — "View My Resources".
// Grid per spec: S.No · IA Name · Resource Name · Mob No · Email · Selection Date.
// Source: GET /bse-recommendations/user/{userId}/selected — filtered
// to committee-selected BSEs mapped to the logged-in vendor.
export default function MyResources() {
  const { user } = useAuth()

  // Vendor is still resolved for the header display (name / logo etc.), but
  // the BSE list now keys off `user.userId` directly — backend switched from
  // vendor-linked to user-linked BSE assignment. No round-trip to /vendor is
  // needed to know which BSEs are ours.
  const vendorQ = useMyVendor(user?.email)
  const bsesQ = useBseByUserSelected(user?.userId)

  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const list = bsesQ.data || []
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter((r) => [r.bseName, r.industryAssociationName, r.emailId, r.mobileNumber]
      .some((f) => (f || '').toLowerCase().includes(term)))
  }, [bsesQ.data, q])

  const initialLoading = vendorQ.isLoading || (bsesQ.isLoading && !bsesQ.data)
  const refetching = bsesQ.isFetching && (bsesQ.data?.length ?? 0) > 0

  // Vendor not resolvable yet — either the vendor list is still loading, or
  // this MPA user isn't linked to a vendor record by email.
  const missingVendor = !vendorQ.isLoading && !vendorQ.data

  return (
    <Box>
      <PageHeader
        title="My Resources"
        subtitle={initialLoading ? 'Loading…' : `${rows.length} BSE${rows.length === 1 ? '' : 's'} assigned to ${vendorQ.data?.vendorName || 'you'}`}
        action={
          <Button variant="outlined"
            startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => bsesQ.refetch()}
            disabled={!user?.userId || bsesQ.isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <TextField
        size="small" placeholder="Search resource, IA, email, mobile…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {missingVendor && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your login isn&apos;t linked to a vendor record on the SDE side yet. Ask SDE to add
          a vendor whose email matches your login.
        </Alert>
      )}

      {bsesQ.error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => bsesQ.refetch()}>Retry</Button>}>
          {bsesQ.error.message || 'Failed to load resources'}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card>
          <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
            <TableHead>
              <TableRow>
                <TableCell width={72}>S.No</TableCell>
                <TableCell>IA Name</TableCell>
                <TableCell>Resource Name</TableCell>
                <TableCell>Mob No</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Selection Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && !bsesQ.error && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {q ? `No resources match “${q}”.` : 'No selected BSEs mapped to you yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow key={r.uuid} hover>
                  <TableCell><Mono>{i + 1}</Mono></TableCell>
                  <TableCell>{r.industryAssociationName || '—'}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{r.bseName || '—'}</Typography>
                    {r.iaSelected && <Chip size="small" color="success" label="Selected" sx={{ mt: 0.25, fontWeight: 600 }} />}
                  </TableCell>
                  <TableCell><Mono>{r.mobileNumber || '—'}</Mono></TableCell>
                  <TableCell><Mono>{r.emailId || '—'}</Mono></TableCell>
                  <TableCell>{formatDate(r.dateOfJoining || r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
