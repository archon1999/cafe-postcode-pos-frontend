import Box from '@mui/material/Box';
import type { BoxProps } from '@mui/material/Box';

const LOGO_SRC = '/icons/pos-logo.webp';
const BRAND_NAME = 'Cafe Postcode';

export type PosLogoProps = BoxProps & {
  isSingle?: boolean;
};

export function PosLogo({ sx, isSingle = true, ...other }: PosLogoProps) {
  return (
    <Box
      sx={[
        {
          width: isSingle ? 44 : 176,
          height: isSingle ? 44 : 50,
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}>
      <img src={LOGO_SRC} alt="" width={isSingle ? 44 : 50} height={isSingle ? 44 : 50} draggable={false} />

      {!isSingle && (
        <Box component="span" sx={{ display: 'flex', flexDirection: 'column', ml: 1.25, lineHeight: 1 }}>
          <Box
            component="span"
            sx={{ color: 'primary.main', fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, lineHeight: 1.2 }}>
            POS
          </Box>

          <Box
            component="span"
            sx={{
              mt: 0.5,
              color: 'text.primary',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: -0.35,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}>
            {BRAND_NAME}
          </Box>
        </Box>
      )}
    </Box>
  );
}
