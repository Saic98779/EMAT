import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  findDistrictsForPincode, listPincodeDistricts, listPincodes, listPincodeStates, matchState,
} from '../apis/pincodes'

// The pincode master only changes with backend data loads.
const FOREVER = { staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000 }
const PIN_RE = /^[1-9]\d{5}$/
// Districts fetched in parallel per round of the scan. Telangana has ~160
// "districts" (local bodies) in the master; 20 at a time keeps a full scan
// to ~8 round trips, and every list is cached for the session after.
const SCAN_BATCH = 20

// Resolves a pincode against the IA's state using the pincode master:
//   { status: 'idle' }                          — no complete pincode / state yet
//   { status: 'loading' }
//   { status: 'ok', districts: [...] }          — pincode is in the state
//   { status: 'mismatch', state }               — pincode not in the state
//   { status: 'unavailable', message }          — master couldn't be reached;
//                                                 callers fall back to manual entry
export default function usePincodeLookup(state, pincode) {
  const qc = useQueryClient()
  const [result, setResult] = useState({ status: 'idle' })
  const pin = String(pincode ?? '').trim()

  useEffect(() => {
    if (!state || !PIN_RE.test(pin)) { setResult({ status: 'idle' }); return undefined }
    let cancelled = false
    setResult({ status: 'loading' })
    ;(async () => {
      try {
        const states = await qc.fetchQuery({
          queryKey: ['pincodes', 'states'],
          queryFn: ({ signal }) => listPincodeStates({ signal }),
          ...FOREVER,
        })
        const canonical = matchState(states, state) || state
        // `/pincodes?state=` without a district returns [] on prod
        // (2026-09-28), so the state-wide list can only short-circuit a
        // mismatch when it actually has data. Otherwise the district scan
        // below is the source of truth: no district holds the pincode →
        // it isn't in this state.
        const statePins = await qc.fetchQuery({
          queryKey: ['pincodes', 'list', canonical, null],
          queryFn: ({ signal }) => listPincodes({ state: canonical, signal }),
          ...FOREVER,
        })
        if (cancelled) return
        const stateListUsable = statePins.length > 0
        if (stateListUsable && !statePins.includes(pin)) { setResult({ status: 'mismatch', state }); return }
        const districts = await qc.fetchQuery({
          queryKey: ['pincodes', 'districts', canonical],
          queryFn: ({ signal }) => listPincodeDistricts(canonical, { signal }),
          ...FOREVER,
        })
        const hits = await findDistrictsForPincode(districts, pin, (d) => qc.fetchQuery({
          queryKey: ['pincodes', 'list', canonical, d],
          queryFn: ({ signal }) => listPincodes({ state: canonical, district: d, signal }),
          ...FOREVER,
        }), SCAN_BATCH)
        if (cancelled) return
        if (hits.length === 0 && !stateListUsable) { setResult({ status: 'mismatch', state }); return }
        setResult({ status: 'ok', districts: hits })
      } catch (err) {
        if (!cancelled) setResult({ status: 'unavailable', message: err?.message || 'Pincode lookup failed' })
      }
    })()
    return () => { cancelled = true }
  }, [qc, state, pin])

  return result
}
