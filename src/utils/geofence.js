// Browser Geolocation helpers used by the BSE attendance geofence.
// Kept dependency-free — the browser's Geolocation API + a haversine
// implementation are enough for a single anchor-and-radius check.

// Wrap navigator.geolocation.getCurrentPosition in a Promise. Uses
// high-accuracy mode (GPS where available), 15s timeout, and forces a
// fresh reading (`maximumAge: 0`) so a stale cached position doesn't
// falsely pass the geofence check.
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationError('unsupported', 'Geolocation is not supported in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => {
        const kind = err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : 'timeout'
        const msg = kind === 'denied'
          ? 'Location access was blocked. Enable it in your browser settings and try again.'
          : kind === 'unavailable'
            ? 'Could not determine your location. Move to an area with better signal and try again.'
            : 'Timed out reading your location. Please try again.'
        reject(new GeolocationError(kind, msg))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

// Great-circle distance between two lat/lng points, in metres.
// R = 6371 km — same as cii-gis, converted to metres.
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Format a metre distance for a user-facing message: "82 m" / "1.4 km".
export function formatDistance(m) {
  if (!Number.isFinite(m)) return '—'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`
}

export class GeolocationError extends Error {
  constructor(kind, message) {
    super(message)
    this.name = 'GeolocationError'
    this.kind = kind
  }
}
