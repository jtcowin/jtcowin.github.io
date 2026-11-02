// Drawn touring props for the memorabilia board (decorative, aria-hidden): SVG
// strings, so the Astro component can set them with set:html. Each is drawn
// top-down, lit from the upper left, in the board's palette.

export const sticks = `<svg viewBox="0 0 420 70" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="rb-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ecd09f"/><stop offset=".45" stop-color="#d4a467"/><stop offset="1" stop-color="#9c6b39"/>
    </linearGradient>
    <linearGradient id="rb-wood-tip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f1d8ad"/><stop offset="1" stop-color="#a7743f"/>
    </linearGradient>
  </defs>
  <g transform="translate(0 6)">
    <path d="M14 4 H262 C312 4.6 350 8 380 10.4 L380 15.6 C350 18 312 21.4 262 22 H14 A9 9 0 0 1 14 4 Z" fill="url(#rb-wood)"/>
    <ellipse cx="392" cy="13" rx="13" ry="6.6" fill="url(#rb-wood-tip)"/>
    <path d="M30 9 H250 M40 16 H230" stroke="#7a4f27" stroke-opacity=".18" stroke-width=".8"/>
    <g fill="#5a3618" fill-opacity=".38"><ellipse cx="292" cy="9" rx="7" ry="2"/><ellipse cx="318" cy="15" rx="5" ry="1.6"/><ellipse cx="270" cy="17" rx="4" ry="1.4"/><ellipse cx="343" cy="11.5" rx="4" ry="1.3"/></g>
    <g fill="#fff3dc" fill-opacity=".5"><ellipse cx="300" cy="8" rx="5" ry="1.1"/><ellipse cx="330" cy="10" rx="3" ry=".8"/></g>
  </g>
  <g transform="translate(18 38) rotate(-2.5 200 13)">
    <path d="M14 4 H262 C312 4.6 350 8 380 10.4 L380 15.6 C350 18 312 21.4 262 22 H14 A9 9 0 0 1 14 4 Z" fill="url(#rb-wood)"/>
    <ellipse cx="392" cy="13" rx="13" ry="6.6" fill="url(#rb-wood-tip)"/>
    <path d="M30 9 H250 M40 16 H230" stroke="#7a4f27" stroke-opacity=".18" stroke-width=".8"/>
    <g fill="#5a3618" fill-opacity=".4"><ellipse cx="286" cy="12" rx="8" ry="2.2"/><ellipse cx="312" cy="9" rx="4" ry="1.4"/><ellipse cx="336" cy="15" rx="6" ry="1.6"/></g>
    <g fill="#fff3dc" fill-opacity=".45"><ellipse cx="296" cy="8.5" rx="4" ry="1"/></g>
  </g>
</svg>`;

export const drumKey = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="rb-steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eef0f1"/><stop offset=".5" stop-color="#a9afb4"/><stop offset="1" stop-color="#5f666c"/>
    </linearGradient>
  </defs>
  <path d="M6 14 C6 8 12 6 18 8 L28 12 H36 L46 8 C52 6 58 8 58 14 C58 20 52 22 46 20 L38 18 V44 C38 48 35 50 32 50 C29 50 26 48 26 44 V18 L18 20 C12 22 6 20 6 14 Z" fill="url(#rb-steel)" stroke="#4d5358" stroke-width="1"/>
  <circle cx="32" cy="15" r="3" fill="#3c4146"/>
  <rect x="28.5" y="40" width="7" height="7" rx="1" fill="#2e3236"/>
  <path d="M10 12 C12 10 16 10 20 11.5" stroke="#fff" stroke-opacity=".6" stroke-width="1.2" fill="none"/>
</svg>`;

export const felt = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <defs>
    <filter id="rb-fuzz" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/>
      <feColorMatrix values="0 0 0 0 .2  0 0 0 0 .19  0 0 0 0 .18  0 0 0 .55 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
      <feBlend in="SourceGraphic" mode="multiply"/>
    </filter>
    <linearGradient id="rb-nut" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f2f3f4"/><stop offset="1" stop-color="#6b7177"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="34" r="26" fill="#4a4541" filter="url(#rb-fuzz)"/>
  <circle cx="32" cy="34" r="26" fill="none" stroke="#2f2b28" stroke-opacity=".5"/>
  <g transform="rotate(-28 32 34)">
    <path d="M30 31 L14 24.5 C10.5 23.2 9 26 10 28.8 C11 31.6 14 32.6 17 32.4 L30 33 Z" fill="url(#rb-nut)" stroke="#4d5358" stroke-width=".7"/>
    <path d="M34 31 L50 24.5 C53.5 23.2 55 26 54 28.8 C53 31.6 50 32.6 47 32.4 L34 33 Z" fill="url(#rb-nut)" stroke="#4d5358" stroke-width=".7"/>
    <circle cx="32" cy="33" r="5.6" fill="url(#rb-nut)" stroke="#4d5358" stroke-width=".7"/>
    <circle cx="32" cy="33" r="2.6" fill="#8d9399" stroke="#4d5358" stroke-width=".5"/>
  </g>
</svg>`;

export const cable = `<svg viewBox="0 0 300 220" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="rb-jack" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f4f5f6"/><stop offset=".5" stop-color="#9aa1a7"/><stop offset="1" stop-color="#4f565c"/>
    </linearGradient>
  </defs>
  <g fill="none" stroke-linecap="round">
    <g stroke="#141414" stroke-width="10">
      <ellipse cx="170" cy="128" rx="112" ry="74"/>
      <ellipse cx="164" cy="122" rx="104" ry="70"/>
      <ellipse cx="176" cy="134" rx="98" ry="64"/>
      <ellipse cx="168" cy="126" rx="90" ry="58"/>
      <path d="M62 118 C40 112 26 96 8 90"/>
    </g>
    <g stroke="#ffffff" stroke-opacity=".14" stroke-width="2.2">
      <ellipse cx="168" cy="125" rx="112" ry="74"/>
      <ellipse cx="162" cy="119" rx="104" ry="70"/>
      <ellipse cx="174" cy="131" rx="98" ry="64"/>
      <ellipse cx="166" cy="123" rx="90" ry="58"/>
    </g>
  </g>
  <g transform="translate(10 88) rotate(-152)">
    <rect x="0" y="-7" width="40" height="14" rx="3" fill="url(#rb-jack)"/>
    <rect x="40" y="-4.5" width="22" height="9" fill="url(#rb-jack)"/>
    <path d="M62 -3 H72 L76 0 L72 3 H62 Z" fill="url(#rb-jack)"/>
    <rect x="66" y="-3.4" width="2" height="6.8" fill="#2a2e31"/>
  </g>
</svg>`;

export const wristband = `<svg viewBox="0 0 260 48" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="rb-band" width="26" height="48" patternUnits="userSpaceOnUse" patternTransform="skewX(-28)">
      <rect width="26" height="48" fill="#ece5d6"/>
      <rect x="0" width="13" height="48" fill="#2f6f69"/>
      <rect x="13" y="30" width="13" height="18" fill="#3e8a80" fill-opacity=".55"/>
    </pattern>
    <linearGradient id="rb-crinkle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".18" stop-color="#000" stop-opacity=".12"/>
      <stop offset=".33" stop-color="#fff" stop-opacity=".2"/><stop offset=".52" stop-color="#000" stop-opacity=".1"/>
      <stop offset=".7" stop-color="#fff" stop-opacity=".16"/><stop offset=".86" stop-color="#000" stop-opacity=".14"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".1"/>
    </linearGradient>
  </defs>
  <path d="M4 10 L58 7 L120 11 L182 6 L232 9 L256 8 L252 40 L200 42 L140 38 L80 43 L30 39 L6 41 Z" fill="url(#rb-band)"/>
  <path d="M4 10 L58 7 L120 11 L182 6 L232 9 L256 8 L252 40 L200 42 L140 38 L80 43 L30 39 L6 41 Z" fill="url(#rb-crinkle)"/>
  <path d="M232 9 L256 8 L252 40 L228 41 Z" fill="#f2ecdf"/>
</svg>`;

export const tag = `<svg viewBox="0 0 80 150" aria-hidden="true" focusable="false">
  <path d="M40 22 C30 -4 58 -10 70 -30" fill="none" stroke="#8a7a5c" stroke-width="1.6"/>
  <path d="M12 6 H68 L78 20 V146 H2 V20 Z" fill="#d9c59c"/>
  <path d="M12 6 H68 L78 20 V146 H2 V20 Z" fill="none" stroke="#b7a07a" stroke-width="1"/>
  <circle cx="40" cy="22" r="9" fill="#c8b083"/>
  <circle cx="40" cy="22" r="4" fill="#efe8da"/>
  <path d="M12 52 H68 M12 120 H68" stroke="#9c865f" stroke-width=".8"/>
</svg>`;

// The credential's lanyard: two strap runs rising from the clip and leaving the
// board at its edge, with the swivel clip at their foot.
export const lanyard = `<svg viewBox="0 0 160 220" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="rb-clip" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f5f6"/><stop offset="1" stop-color="#6b7177"/>
    </linearGradient>
  </defs>
  <path d="M86 196 C84 150 52 110 -10 82" fill="none" stroke="#1d1f20" stroke-width="15"/>
  <path d="M94 196 C98 140 70 70 -10 20" fill="none" stroke="#222526" stroke-width="15"/>
  <path d="M86 196 C84 150 52 110 -10 82" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="2"/>
  <path d="M94 196 C98 140 70 70 -10 20" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="2"/>
  <rect x="78" y="186" width="24" height="12" rx="3" fill="url(#rb-clip)"/>
  <path d="M90 198 v8 a7 7 0 1 0 0.1 0" fill="none" stroke="url(#rb-clip)" stroke-width="3.2"/>
</svg>`;
