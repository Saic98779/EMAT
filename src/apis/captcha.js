import { apiFetch } from '../api'

// GET /captcha — public (no JWT). Backend generates a fresh challenge and
// returns:
//   {
//     captchaId: "uuid",
//     image:     "data:image/png;base64,..."  ← ready to drop into <img src>
//   }
// The image is a distorted rendering of a short text the user has to type.
// The `captchaId` opaquely references the backend-stored expected answer
// (single-use, ~2 min TTL per Sameer's design). Callers pair the id with
// the user's typed answer in the /users/login body.
export function fetchCaptcha({ signal } = {}) {
  return apiFetch('/captcha', { signal })
}
