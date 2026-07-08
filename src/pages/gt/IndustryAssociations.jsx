import { useNavigate } from 'react-router-dom'
import {
  Card, Table, TableHead, TableBody, TableRow, TableCell, Box, Typography, Button,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import EditNoteIcon from '@mui/icons-material/EditNote'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { useData } from '../../store'

// Contextual primary action per IA status (GT).
function rowAction(ia, navigate, basePath) {
  const go = (path) => (e) => { e.stopPropagation(); navigate(path) }
  const view = (
    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />} onClick={go(`${basePath}/${ia.id}`)}>View</Button>
  )
  if (!basePath.startsWith('/gt')) return view
  if (ia.status === 'Detailed Pending')
    return <Button size="small" variant="contained" startIcon={<AssignmentTurnedInIcon />} onClick={go(`/gt/ias/${ia.id}/appraisal`)}>Detailed appraisal</Button>
  if (ia.status === 'Changes Requested')
    return <Button size="small" variant="contained" color="secondary" startIcon={<EditNoteIcon />} onClick={go(`/gt/ias/${ia.id}/appraisal`)}>Revise</Button>
  return view
}

export default function IndustryAssociations({ basePath = '/gt/ias' }) {
  const navigate = useNavigate()
  const { ias } = useData()
  const isGt = basePath.startsWith('/gt')

  return (
    <Box>
      <PageHeader
        title={isGt ? 'Industry Association Onboarding' : 'Industry Associations'}
        subtitle={`${ias.length} associations across the appraisal pipeline`}
        action={isGt && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/gt/ias/new')}>In-Principle Approval</Button>
        )}
      />

      <Card>
        <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Association</TableCell>
              <TableCell>Sector</TableCell>
              <TableCell>SIDBI Branch</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ias.map((ia) => (
              <TableRow key={ia.id} hover onClick={() => navigate(`${basePath}/${ia.id}`)} sx={{ cursor: 'pointer' }}>
                <TableCell>
                  <Typography fontWeight={700} fontSize="0.95rem">{ia.name}</Typography>
                  <Mono>{ia.id} · {ia.city} · {ia.state}</Mono>
                </TableCell>
                <TableCell><Typography variant="body2">{ia.sector}</Typography></TableCell>
                <TableCell><Typography variant="body2">{ia.branch}</Typography></TableCell>
                <TableCell><StatusChip status={ia.status} /></TableCell>
                <TableCell align="right">{rowAction(ia, navigate, basePath)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  )
}
