import { useNavigate } from 'react-router-dom'
import {
  Card, Table, TableHead, TableBody, TableRow, TableCell, Box, Typography, Button, Stack,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { industryAssociations } from '../../data'

export default function IndustryAssociations({ basePath = '/gt/ias' }) {
  const navigate = useNavigate()
  const isGt = basePath.startsWith('/gt')

  return (
    <Box>
      <PageHeader
        title="Industry Associations"
        subtitle={`${industryAssociations.length} associations across the appraisal pipeline`}
        action={isGt && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/gt/ias/new')}>New Basic Proposal</Button>
        )}
      />

      <Card>
        <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Association</TableCell>
              <TableCell>Sector</TableCell>
              <TableCell>SIDBI Branch</TableCell>
              <TableCell align="right">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {industryAssociations.map((ia) => (
              <TableRow
                key={ia.id} hover onClick={() => navigate(`${basePath}/${ia.id}`)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  <Typography fontWeight={700} fontSize="0.95rem">{ia.name}</Typography>
                  <Mono>{ia.id} · {ia.city} · {ia.state}</Mono>
                </TableCell>
                <TableCell><Typography variant="body2">{ia.sector}</Typography></TableCell>
                <TableCell><Typography variant="body2">{ia.branch}</Typography></TableCell>
                <TableCell align="right"><StatusChip status={ia.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  )
}
