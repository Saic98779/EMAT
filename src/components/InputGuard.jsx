import { useEffect, useState } from 'react'
import { Alert, Snackbar } from '@mui/material'
import { allowedHint, badChars, charsetForElement, formatChars, stripBadChars } from '../inputCharsets'

// App-wide guard: stops disallowed characters (see inputCharsets.js) from
// being typed, pasted or dropped into ANY text input or textarea, so every
// form — schema-driven, react-hook-form or hand-rolled — gets the same rule
// without per-field wiring. Mount once near the root.
export default function InputGuard() {
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const warn = (chars, charset) => setNotice({
      key: Date.now(),
      msg: `${formatChars(chars)} not allowed here — use ${allowedHint(charset)}.`,
    })

    const onBeforeInput = (e) => {
      if (e.isComposing || !e.inputType?.startsWith('insert') || !e.data) return
      const charset = charsetForElement(e.target)
      if (!charset) return
      const bad = badChars(e.data, charset)
      if (!bad.length) return
      e.preventDefault()
      // Multi-character inserts (paste, autocorrect, IME): keep the rest.
      const clean = stripBadChars(e.data, charset)
      if (clean) document.execCommand('insertText', false, clean)
      warn(bad, charset)
    }

    // Some browsers report paste / drop through these events with no
    // `data` on beforeinput, so handle them directly as well.
    const onTransfer = (e) => {
      const charset = charsetForElement(e.target)
      if (!charset) return
      const dt = e.clipboardData || e.dataTransfer
      const text = dt?.getData('text/plain') ?? dt?.getData('text')
      if (!text) return
      const bad = badChars(text, charset)
      if (!bad.length) return
      e.preventDefault()
      if (e.type === 'drop') e.target.focus()
      const clean = stripBadChars(text, charset)
      if (clean) document.execCommand('insertText', false, clean)
      warn(bad, charset)
    }

    document.addEventListener('beforeinput', onBeforeInput, true)
    document.addEventListener('paste', onTransfer, true)
    document.addEventListener('drop', onTransfer, true)
    return () => {
      document.removeEventListener('beforeinput', onBeforeInput, true)
      document.removeEventListener('paste', onTransfer, true)
      document.removeEventListener('drop', onTransfer, true)
    }
  }, [])

  return (
    <Snackbar
      key={notice?.key}
      open={!!notice}
      autoHideDuration={7000}
      onClose={(_, reason) => { if (reason !== 'clickaway') setNotice(null) }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="warning" variant="filled" onClose={() => setNotice(null)} sx={{ fontWeight: 500 }}>
        {notice?.msg}
      </Alert>
    </Snackbar>
  )
}
