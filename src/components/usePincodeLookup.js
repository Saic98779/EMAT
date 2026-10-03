import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  listPincodeDistricts, listPincodes, listPincodeStates, matchState,
} from '../apis/pincodes'

// The pincode master only changes with backend data loads.
const FOREVER = { staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000 }

// Fetches the pincode master lists needed to populate the Address form:
//   • the state's districts (for the District dropdown)
//   • the selected district's pincodes (for the Pincode dropdown)
//
// The user picks both from proper dropdowns — no manual typing, no
// after-the-fact validation. That means one API call when the state
// resolves and one more when the district is picked; both cached
// forever within the session.
//
// Return shape:
//   { status: 'idle' }
//   { status: 'loading', districts? }
//   { status: 'ok', districts, pincodes }        — full picture ready
//   { status: 'unavailable', message, districts? }
//
// `districts` is always surfaced as soon as state resolves so the
// District dropdown can populate before the district is picked.
export default function usePincodeLookup(state, district) {
  const qc = useQueryClient()
  const [result, setResult] = useState({ status: 'idle' })
  const dist = String(district ?? '').trim()

  useEffect(() => {
    if (!state) { setResult({ status: 'idle' }); return undefined }
    let cancelled = false
    // Preserve the previously-fetched districts array through the
    // loading transition — otherwise picking a district drops
    // `_pincode_districts` to null for the ~500ms of the pincode fetch,
    // which empties the district dropdown's options, and MUI's
    // TextField[select] clears the displayed value because the current
    // pick isn't in the (empty) options list. Net effect: user sees the
    // district vanish and reappear on every pick.
    setResult((prev) => ({ status: 'loading', districts: prev?.districts }))
    ;(async () => {
      try {
        // Fast path: assume `state` from the IA record is the canonical
        // backend spelling (it is 99% of the time — both the frontend
        // STATES list and the backend's states list share the same 34
        // Indian state names). Skip the extra /pincodes/states round-trip
        // and query directly. If districts come back empty, fall back
        // to canonicalising via matchState + retry.
        let canonical = state
        let districts = await qc.fetchQuery({
          queryKey: ['pincodes', 'districts', state],
          queryFn: ({ signal }) => listPincodeDistricts(state, { signal }),
          ...FOREVER,
        })
        if (!districts.length) {
          const states = await qc.fetchQuery({
            queryKey: ['pincodes', 'states'],
            queryFn: ({ signal }) => listPincodeStates({ signal }),
            ...FOREVER,
          })
          const alt = matchState(states, state)
          if (alt && alt !== state) {
            canonical = alt
            districts = await qc.fetchQuery({
              queryKey: ['pincodes', 'districts', canonical],
              queryFn: ({ signal }) => listPincodeDistricts(canonical, { signal }),
              ...FOREVER,
            })
          }
        }
        if (cancelled) return

        // No district picked yet — surface the districts list so the
        // dropdown can populate, leave pincodes empty.
        if (!dist) {
          setResult({ status: 'idle', districts })
          return
        }

        // Load the district's pincodes for the Pincode dropdown. One
        // call per unique {state, district}, cached forever.
        const pincodes = await qc.fetchQuery({
          queryKey: ['pincodes', 'list', canonical, dist],
          queryFn: ({ signal }) => listPincodes({ state: canonical, district: dist, signal }),
          ...FOREVER,
        })
        if (cancelled) return
        setResult({ status: 'ok', districts, pincodes, state: canonical, district: dist })
      } catch (err) {
        if (!cancelled) setResult({ status: 'unavailable', message: err?.message || 'Pincode lookup failed' })
      }
    })()
    return () => { cancelled = true }
  }, [qc, state, dist])

  return result
}
