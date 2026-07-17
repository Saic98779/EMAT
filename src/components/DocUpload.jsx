import { Card, CardContent, Stack, Typography, Button, Chip, Box, Avatar } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'

// Attach supporting documents (Invoice, attendance, etc.). Demo: stores file names only.
export default function DocUpload({ docs, setDocs, accent = 'primary' }) {
  const onPick = (e) => {
    const names = Array.from(e.target.files || []).map((f) => f.name)
    if (names.length) setDocs((prev) => [...prev, ...names])
    e.target.value = ''
  }
  const remove = (i) => setDocs((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1.5}
        sx={{ px: 2.5, py: 1.25, bgcolor: (t) => `${t.palette[accent].main}14`, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Avatar sx={{ bgcolor: `${accent}.main`, color: '#fff', width: 28, height: 28 }}><UploadFileIcon sx={{ fontSize: 18 }} /></Avatar>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>Supporting Documents</Typography>
      </Stack>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="body2" color="text.secondary" mb={2}>Attach the Invoice and any supporting files (PDF, images, spreadsheets).</Typography>
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
          Attach documents
          <input type="file" hidden multiple onChange={onPick} />
        </Button>
        {docs.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            {docs.map((name, i) => (
              <Chip key={i} icon={<DescriptionOutlinedIcon />} label={name} onDelete={() => remove(i)} variant="outlined" />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
