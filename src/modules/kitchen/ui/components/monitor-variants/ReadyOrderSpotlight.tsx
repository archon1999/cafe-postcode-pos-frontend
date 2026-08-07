/* eslint-disable i18next/no-literal-string */
import { Box, Typography, alpha, keyframes } from '@mui/material';

import type { KitchenAnnouncement } from 'modules/kitchen/domain';

const spotlightEntrance = keyframes`
  0% { opacity: 0; transform: translate3d(-14vw, 0, 0) scale(0.72); filter: blur(3px); }
  65% { opacity: 1; transform: translate3d(0, 0, 0) scale(1.04); filter: blur(0); }
  100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
`;

const spotlightGlow = keyframes`
  0% { opacity: 0.42; transform: scale(0.88); }
  100% { opacity: 0.86; transform: scale(1.12); }
`;

const spotlightPulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.025); }
`;

export function ReadyOrderSpotlight({
  announcement,
  compactLayout,
  dark,
}: {
  announcement: KitchenAnnouncement;
  compactLayout: boolean;
  dark: boolean;
}) {
  const readyColor = dark ? '#1ec1a2' : '#168a73';
  const textColor = dark ? '#f5f7fb' : '#27313b';

  return (
    <Box
      aria-live="polite"
      data-testid="ready-order-spotlight"
      sx={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', display: 'grid', placeItems: 'center' }}>
      <Box
        sx={{
          position: 'absolute',
          width: compactLayout ? '42vw' : 620,
          height: compactLayout ? '42vw' : 620,
          minWidth: 260,
          minHeight: 260,
          maxWidth: 620,
          maxHeight: 620,
          borderRadius: '50%',
          background: dark
            ? 'radial-gradient(circle, rgba(77, 235, 194, 0.34), rgba(77, 235, 194, 0.08) 48%, transparent 72%)'
            : 'radial-gradient(circle, rgba(22, 138, 115, 0.28), rgba(22, 138, 115, 0.08) 50%, transparent 74%)',
          animation: `${spotlightGlow} 1.2s ease-in-out infinite alternate`,
        }}
      />
      <Box
        sx={{
          position: 'relative',
          width: compactLayout ? '84vw' : 580,
          minWidth: 260,
          maxWidth: 680,
          px: compactLayout ? 3.5 : 9,
          py: compactLayout ? 3 : 6.75,
          borderRadius: compactLayout ? 3.25 : 5.25,
          textAlign: 'center',
          backgroundColor: dark ? alpha('#111820', 0.94) : alpha('#ffffff', 0.97),
          border: `1px solid ${dark ? alpha('#7df5d7', 0.36) : alpha('#168a73', 0.28)}`,
          boxShadow: dark
            ? '0 0 86px rgba(77, 235, 194, 0.34), 0 26px 90px rgba(0, 0, 0, 0.42)'
            : '0 0 72px rgba(47, 177, 141, 0.24), 0 26px 90px rgba(31, 72, 61, 0.2)',
          animation: `${spotlightEntrance} 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards, ${spotlightPulse} 1.35s 520ms ease-in-out infinite`,
        }}>
        <Typography
          sx={{
            color: readyColor,
            fontSize: compactLayout ? 18 : 30,
            fontWeight: 800,
            lineHeight: 1,
            mb: compactLayout ? 1.1 : 1.6,
            textTransform: 'uppercase',
          }}>
          Tayyor
        </Typography>
        <Typography
          sx={{
            color: textColor,
            fontSize: compactLayout ? 72 : 168,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            textShadow: dark ? '0 0 34px rgba(125, 245, 215, 0.28)' : '0 0 26px rgba(47, 177, 141, 0.24)',
          }}>
          {announcement.displayName.trim() || String(announcement.orderNumber)}
        </Typography>
      </Box>
    </Box>
  );
}
