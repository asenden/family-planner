"use client";

export interface FeelingFaceProps {
  feeling: "happy" | "neutral" | "sad" | "angry" | "excited" | "none";
  size?: number;
  color?: string;
}

const FEELING_COLORS: Record<string, string> = {
  happy: "#fbbf24",
  neutral: "#94a3b8",
  sad: "#60a5fa",
  angry: "#f87171",
  excited: "#7c8db5", // "tired" — mapped to excited in DB enum
  none: "#3d3552",
};

export function FeelingFace({ feeling, size = 48, color }: FeelingFaceProps) {
  const baseColor = color ?? FEELING_COLORS[feeling] ?? FEELING_COLORS.none;
  const darkColor = darken(baseColor, 0.28);
  const gradId = `fg-${feeling}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={gradId} cx="38%" cy="32%" r="65%" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={lighten(baseColor, 0.18)} />
          <stop offset="100%" stopColor={baseColor} />
        </radialGradient>
      </defs>

      {/* Face circle */}
      <circle cx="24" cy="24" r="22" fill={`url(#${gradId})`} />

      {/* Inner shadow ring */}
      <circle cx="24" cy="24" r="22" fill="none" stroke={darkColor} strokeWidth="1" opacity="0.35" />

      {feeling === "happy" && <HappyFeatures darkColor={darkColor} />}
      {feeling === "neutral" && <NeutralFeatures darkColor={darkColor} />}
      {feeling === "sad" && <SadFeatures darkColor={darkColor} baseColor={baseColor} />}
      {feeling === "angry" && <AngryFeatures darkColor={darkColor} />}
      {feeling === "excited" && <ExcitedFeatures darkColor={darkColor} />}
      {feeling === "none" && <NoneFeatures />}
    </svg>
  );
}

function HappyFeatures({ darkColor }: { darkColor: string }) {
  return (
    <>
      {/* Eyes */}
      <circle cx="17" cy="20" r="2.5" fill={darkColor} />
      <circle cx="31" cy="20" r="2.5" fill={darkColor} />
      {/* Eye shine */}
      <circle cx="18.2" cy="18.8" r="0.9" fill="rgba(255,255,255,0.55)" />
      <circle cx="32.2" cy="18.8" r="0.9" fill="rgba(255,255,255,0.55)" />
      {/* Smile arc */}
      <path
        d="M 15 26 Q 24 34 33 26"
        stroke={darkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Cheek blush */}
      <ellipse cx="13" cy="29" rx="3.5" ry="2" fill={darkColor} opacity="0.15" />
      <ellipse cx="35" cy="29" rx="3.5" ry="2" fill={darkColor} opacity="0.15" />
    </>
  );
}

function NeutralFeatures({ darkColor }: { darkColor: string }) {
  return (
    <>
      {/* Eyes */}
      <circle cx="17" cy="21" r="2.5" fill={darkColor} />
      <circle cx="31" cy="21" r="2.5" fill={darkColor} />
      {/* Eye shine */}
      <circle cx="18.2" cy="19.8" r="0.9" fill="rgba(255,255,255,0.55)" />
      <circle cx="32.2" cy="19.8" r="0.9" fill="rgba(255,255,255,0.55)" />
      {/* Straight mouth */}
      <line
        x1="16"
        y1="29"
        x2="32"
        y2="29"
        stroke={darkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  );
}

function SadFeatures({ darkColor, baseColor }: { darkColor: string; baseColor: string }) {
  return (
    <>
      {/* Eyes — slightly drooped */}
      <circle cx="17" cy="21" r="2.5" fill={darkColor} />
      <circle cx="31" cy="21" r="2.5" fill={darkColor} />
      {/* Eye shine */}
      <circle cx="18.2" cy="19.8" r="0.9" fill="rgba(255,255,255,0.55)" />
      <circle cx="32.2" cy="19.8" r="0.9" fill="rgba(255,255,255,0.55)" />
      {/* Downturned mouth */}
      <path
        d="M 15 31 Q 24 24 33 31"
        stroke={darkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Single teardrop */}
      <ellipse cx="33" cy="25.5" rx="1.6" ry="2.2" fill={lighten(baseColor, 0.3)} opacity="0.85" />
      <path
        d="M 33 23.3 Q 34.4 24.8 33 27.7 Q 31.6 24.8 33 23.3 Z"
        fill={lighten(baseColor, 0.3)}
        opacity="0.85"
      />
    </>
  );
}

function AngryFeatures({ darkColor }: { darkColor: string }) {
  return (
    <>
      {/* V-shaped eyebrows */}
      <path
        d="M 13 16.5 L 20 19.5"
        stroke={darkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M 35 16.5 L 28 19.5"
        stroke={darkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Eyes — narrowed */}
      <circle cx="17" cy="22" r="2.5" fill={darkColor} />
      <circle cx="31" cy="22" r="2.5" fill={darkColor} />
      {/* Eye shine */}
      <circle cx="18.2" cy="20.8" r="0.9" fill="rgba(255,255,255,0.55)" />
      <circle cx="32.2" cy="20.8" r="0.9" fill="rgba(255,255,255,0.55)" />
      {/* Frown */}
      <path
        d="M 15 32 Q 24 25 33 32"
        stroke={darkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function ExcitedFeatures({ darkColor }: { darkColor: string }) {
  // "Tired/Sleepy" face — half-closed eyes, small yawn mouth
  return (
    <>
      {/* Half-closed eyes (arcs instead of circles) */}
      <path
        d="M 13.5 21 Q 17 18 20.5 21"
        stroke={darkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 27.5 21 Q 31 18 34.5 21"
        stroke={darkColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Small oval yawn/sigh mouth */}
      <ellipse cx="24" cy="30" rx="3.5" ry="2.5" fill={darkColor} opacity="0.7" />
      {/* Zzz */}
      <text
        x="36"
        y="14"
        fontSize="7"
        fontWeight="700"
        fill={darkColor}
        opacity="0.5"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        z
      </text>
      <text
        x="39"
        y="10"
        fontSize="5"
        fontWeight="700"
        fill={darkColor}
        opacity="0.35"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        z
      </text>
    </>
  );
}

function NoneFeatures() {
  return (
    <>
      {/* Question mark */}
      <text
        x="24"
        y="29"
        textAnchor="middle"
        fontSize="16"
        fontWeight="600"
        fill="rgba(255,255,255,0.4)"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        ?
      </text>
    </>
  );
}

// Simple color helpers — work on hex colors like #rrggbb
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function lighten(hex: string, amount: number): string {
  try {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
  } catch {
    return hex;
  }
}

function darken(hex: string, amount: number): string {
  try {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
  } catch {
    return hex;
  }
}

export { FEELING_COLORS };
