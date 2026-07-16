import Box from '@mui/material/Box';
import type { BoxProps } from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { useId } from 'react';

const FONT_FAMILY = '"Inter", "DM Sans Variable", sans-serif';
const BRAND_NAME = 'Cafe Postcode';

export type PosLogoProps = BoxProps & {
  isSingle?: boolean;
};

export function PosLogo({ sx, isSingle = true, ...other }: PosLogoProps) {
  const theme = useTheme();
  const uniqueId = useId();

  const TEXT_PRIMARY = theme.palette.text.primary;
  const PRIMARY_MAIN = theme.palette.primary.main;
  const PRIMARY_DARK = theme.palette.primary.dark;
  const SECONDARY_MAIN = theme.palette.secondary.main;
  const WARNING_MAIN = theme.palette.warning.main;

  const gradientId = `${uniqueId}-pos-gradient`;
  const glowId = `${uniqueId}-pos-glow`;

  const mark = (
    <>
      <defs>
        <linearGradient id={gradientId} x1="10" y1="10" x2="55" y2="57" gradientUnits="userSpaceOnUse">
          <stop stopColor={PRIMARY_DARK} />
          <stop offset="0.55" stopColor={PRIMARY_MAIN} />
          <stop offset="1" stopColor={SECONDARY_MAIN} />
        </linearGradient>
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(44 16) rotate(126) scale(32 30)">
          <stop stopColor="#FFFFFF" stopOpacity="0.3" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="6" y="6" width="52" height="52" rx="16" fill={`url(#${gradientId})`} />
      <rect x="6.75" y="6.75" width="50.5" height="50.5" rx="15.25" fill={`url(#${glowId})`} />

      <path
        fill="#FFFFFF"
        d="M32 14C23.716 14 17 20.716 17 29C17 42.374 29.297 50.835 32 54C34.703 50.835 47 42.374 47 29C47 20.716 40.284 14 32 14Z"
      />

      <path
        fill={PRIMARY_DARK}
        d="M25.8 28.2H36.6C37.4837 28.2 38.2 28.9163 38.2 29.8V33C38.2 37.3078 34.7078 40.8 30.4 40.8H30C25.6922 40.8 22.2 37.3078 22.2 33V31.8C22.2 29.863 23.763 28.3 25.7 28.2Z"
      />
      <path
        d="M38.3 31.1H39.25C41.1554 31.1 42.7 32.6446 42.7 34.55C42.7 36.4554 41.1554 38 39.25 38H38.3"
        stroke={PRIMARY_DARK}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M26 43.4H38" stroke={PRIMARY_DARK} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M28 24C28 22.75 28.9 21.9 28.9 20.55" stroke={PRIMARY_DARK} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32.1 23.1C32.1 21.8 33 20.9 33 19.55" stroke={PRIMARY_DARK} strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M36.2 24C36.2 22.75 37.1 21.9 37.1 20.55"
        stroke={PRIMARY_DARK}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      <rect x="39" y="11" width="14" height="14" rx="5" fill={WARNING_MAIN} />
      <rect x="42" y="14.6" width="7.8" height="1.9" rx="0.95" fill="#FFFFFF" />
      <rect x="42" y="18" width="2.2" height="2.2" rx="0.8" fill="#FFFFFF" />
      <rect x="46" y="18" width="2.2" height="2.2" rx="0.8" fill="#FFFFFF" />
    </>
  );

  const singleLogo = (
    <svg width="100%" height="100%" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {mark}
    </svg>
  );

  const fullLogo = (
    <svg width="100%" height="100%" viewBox="0 0 252 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0 4)">{mark}</g>

      <text
        x="78"
        y="24"
        fill={PRIMARY_MAIN}
        fontFamily={FONT_FAMILY}
        fontSize="10.5"
        fontWeight="800"
        letterSpacing="1.4">
        POS
      </text>

      <text
        x="76"
        y="54"
        fill={TEXT_PRIMARY}
        fontFamily={FONT_FAMILY}
        fontSize="22"
        fontWeight="700"
        letterSpacing="-0.5">
        {BRAND_NAME}
      </text>
    </svg>
  );

  return (
    <Box
      sx={[
        {
          width: 44,
          height: 44,
          display: 'inline-flex',
          flexShrink: 0,
          ...(!isSingle && { width: 176, height: 50 }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}>
      {isSingle ? singleLogo : fullLogo}
    </Box>
  );
}
