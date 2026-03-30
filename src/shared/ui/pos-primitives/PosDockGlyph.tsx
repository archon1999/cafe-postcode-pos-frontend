import { Box } from '@mui/material';

export function PosDockGlyph({
  itemKey,
  active,
  mode,
}: {
  itemKey: string;
  active: boolean;
  mode: 'light' | 'dark';
}) {
  const stroke =
    mode === 'dark'
      ? active
        ? '#f4f7fb'
        : 'rgba(244, 247, 251, 0.62)'
      : active
        ? '#2f3944'
        : 'rgba(47, 57, 68, 0.52)';
  const fill =
    mode === 'dark'
      ? active
        ? 'rgba(244, 247, 251, 0.14)'
        : 'rgba(244, 247, 251, 0.05)'
      : active
        ? 'rgba(47, 57, 68, 0.12)'
        : 'rgba(47, 57, 68, 0.06)';
  const steam =
    mode === 'dark'
      ? active
        ? '#f8fbff'
        : 'rgba(248, 251, 255, 0.72)'
      : active
        ? '#2f3944'
        : 'rgba(47, 57, 68, 0.56)';

  return (
    <Box component="svg" viewBox="0 0 64 64" sx={{ display: 'block', width: '100%', height: '100%' }}>
      {itemKey === 'halls' ? (
        <>
          <path
            d="M32 10 49 19.2 32 28.4 15 19.2 32 10Z"
            fill="none"
            stroke={stroke}
            strokeWidth="3.1"
            strokeLinejoin="round"
          />
          <path
            d="M32 23.5 46 31 32 38.5 18 31 32 23.5Z"
            fill="none"
            stroke={stroke}
            strokeWidth="3.1"
            strokeLinejoin="round"
          />
          <path
            d="M32 37 43 43 32 49 21 43 32 37Z"
            fill="none"
            stroke={stroke}
            strokeWidth="3.1"
            strokeLinejoin="round"
          />
        </>
      ) : null}

      {itemKey === 'menu' ? (
        <>
          <path
            d="M18 31.5h28c0 10.2-6.3 16.7-14 16.7s-14-6.5-14-16.7Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="3.1"
            strokeLinejoin="round"
          />
          <path d="M24 48.5h16" stroke={stroke} strokeWidth="3.1" strokeLinecap="round" />
          <path d="M26.5 14.5c-1.8 3.9 2.7 5.5 1 10" stroke={steam} strokeWidth="3.1" strokeLinecap="round" />
          <path d="M37.5 12c-2 4.4 2.7 6 1 11.3" stroke={steam} strokeWidth="3.1" strokeLinecap="round" />
        </>
      ) : null}

      {itemKey === 'builder' ? (
        <>
          <rect x="18" y="14" width="28" height="36" rx="9" fill={fill} stroke={stroke} strokeWidth="3" />
          <path d="M25 24h14M25 32h14M25 40h10" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}

      {itemKey === 'kitchen' ? (
        <>
          <g transform="rotate(-37 21 33)">
            <ellipse cx="21" cy="17.5" rx="5.6" ry="8.6" fill={fill} stroke={stroke} strokeWidth="3.1" />
            <rect x="18.9" y="24.5" width="4.2" height="29" rx="2.1" fill={stroke} />
          </g>
          <g transform="rotate(36 43 34)">
            <path d="M37 12v12M41 12v12M45 12v12" stroke={stroke} strokeWidth="3.1" strokeLinecap="round" />
            <path d="M37 24c0 2.6 1.8 4.2 4 4.2s4-1.6 4-4.2" stroke={stroke} strokeWidth="3.1" strokeLinecap="round" />
            <rect x="38.9" y="28" width="4.2" height="25.5" rx="2.1" fill={stroke} />
          </g>
        </>
      ) : null}

      {itemKey === 'bills' ? (
        <>
          <path
            d="M23 14h18c3.3 0 6 2.7 6 6v25.8l-4.8-3.6-4.1 3.1-4.1-3.1-4.1 3.1-4.1-3.1-4.8 3.6V20c0-3.3 2.7-6 6-6Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="3.1"
            strokeLinejoin="round"
          />
          <path d="M28 24.5h8M28 31h14M28 37.5h14" stroke={stroke} strokeWidth="3.1" strokeLinecap="round" />
        </>
      ) : null}
    </Box>
  );
}
