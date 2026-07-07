// Brand emblem — celebrating figures inside a leafy ring, recreated as scalable SVG.
// Palette taken from the eMAT logo: orange / sky / red / navy figures, green wreath.

const C = {
  orange: '#F6A21E',
  sky: '#35AECB',
  red: '#E2381F',
  navy: '#2E5F8F',
  navyDark: '#123B5E',
  ringTop: '#39A9C4',
  ringBot: '#12466A',
  leafLight: '#7FC241',
  leafMid: '#43A047',
  leafDark: '#2E7D32',
}

// One "arms-raised" figure. Origin at torso centre.
function Figure({ x, y, s = 1, r = 0, color }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${r})`}>
      <circle cx="0" cy="-19" r="7.2" fill={color} />
      <path
        fill={color}
        d="M -3 -9 C -9 -13 -18 -22 -23 -19 C -19 -13 -11 -9 -5 -5 L -4 4
           L -9 23 L -3.5 23 L 0 9 L 3.5 23 L 9 23 L 4 4 L 5 -5
           C 11 -9 19 -13 23 -19 C 18 -22 9 -13 3 -9 Z"
      />
    </g>
  )
}

function Leaf({ x, y, r = 0, s = 1, color }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path fill={color} d="M0 0 C 7 -3 11 -10 8 -19 C 1 -15 -3 -7 0 0 Z" />
      <path stroke="rgba(255,255,255,0.55)" strokeWidth="0.7" fill="none" d="M1 -1 C 3 -6 5 -10 7 -16" />
    </g>
  )
}

export default function Logo({ size = 40, mono = false }) {
  const ringTop = mono ? 'currentColor' : C.ringTop
  const ringBot = mono ? 'currentColor' : C.ringBot
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="eMAT">
      <defs>
        <linearGradient id="emat-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ringTop} />
          <stop offset="100%" stopColor={ringBot} />
        </linearGradient>
      </defs>

      {/* ring */}
      <circle cx="60" cy="60" r="49" fill="none" stroke="url(#emat-ring)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray="250 58" transform="rotate(-108 60 60)" />

      {!mono && (
        <>
          {/* leafy wreath — clustered on the left / top like the source */}
          <Leaf x="16" y="52" r={-25} s={1.05} color={C.leafLight} />
          <Leaf x="22" y="34" r={-5} s={0.95} color={C.leafMid} />
          <Leaf x="34" y="22" r={20} s={0.9} color={C.leafLight} />
          <Leaf x="50" y="14" r={35} s={0.85} color={C.leafMid} />
          <Leaf x="70" y="12" r={-20} s={0.9} color={C.orange} />
          <Leaf x="92" y="22" r={40} s={0.95} color={C.leafDark} />
          <Leaf x="104" y="44" r={65} s={1} color={C.leafMid} />
          <Leaf x="104" y="74" r={110} s={1} color={C.leafDark} />
          <Leaf x="40" y="104" r={200} s={0.95} color={C.leafMid} />
          <Leaf x="20" y="86" r={165} s={0.9} color={C.leafLight} />
        </>
      )}

      {/* figures */}
      {mono ? (
        <>
          <Figure x={60} y={44} s={0.78} color="currentColor" />
          <Figure x={38} y={74} s={0.62} r={-16} color="currentColor" />
          <Figure x={82} y={74} s={0.62} r={16} color="currentColor" />
          <Figure x={60} y={82} s={0.8} color="currentColor" />
        </>
      ) : (
        <>
          <Figure x={60} y={44} s={0.8} color={C.orange} />
          <Figure x={37} y={74} s={0.64} r={-16} color={C.sky} />
          <Figure x={83} y={74} s={0.64} r={16} color={C.red} />
          <Figure x={60} y={82} s={0.82} color={C.navy} />
        </>
      )}
    </svg>
  )
}
