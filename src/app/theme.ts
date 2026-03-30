import { alpha, createTheme } from '@mui/material/styles';

export type PosThemeMode = 'light' | 'dark';

export function createPosTheme(mode: PosThemeMode = 'dark') {
  const isDark = mode === 'dark';

  const palette = {
    mode,
    primary: {
      main: '#1978da',
      light: '#2887ec',
      dark: '#1569c1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: isDark ? '#31c9c2' : '#1b968b',
    },
    warning: {
      main: '#f4b73d',
    },
    error: {
      main: '#ef5d66',
    },
    success: {
      main: '#31c9c2',
    },
    background: isDark
      ? {
          default: '#181a1e',
          paper: '#21242a',
        }
      : {
          default: '#f1e7d8',
          paper: '#fcf6ed',
        },
    text: isDark
      ? {
          primary: '#f3f5f8',
          secondary: '#959aa3',
        }
      : {
          primary: '#2f3944',
          secondary: '#6f7782',
        },
    divider: isDark ? 'rgba(255, 255, 255, 0.038)' : 'rgba(40, 51, 65, 0.09)',
  } as const;

  return createTheme({
    palette,
    shape: {
      borderRadius: 3,
    },
    typography: {
      fontFamily: '"Inter", "DM Sans Variable", sans-serif',
      h3: { fontWeight: 650, letterSpacing: '-0.018em' },
      h4: { fontWeight: 650, letterSpacing: '-0.018em' },
      h5: { fontWeight: 650, letterSpacing: '-0.01em' },
      h6: { fontWeight: 650 },
      subtitle1: { fontWeight: 650 },
      button: {
        textTransform: 'none',
        fontWeight: 650,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: isDark ? 'dark' : 'light',
          },
          'html, body, #root': {
            height: '100%',
          },
          html: {
            overflow: 'hidden',
          },
          body: {
            backgroundColor: palette.background.default,
            color: palette.text.primary,
            minHeight: '100dvh',
            overflow: 'hidden',
            backgroundImage: isDark
              ? 'linear-gradient(180deg, #191b1f 0%, #17191d 100%)'
              : 'linear-gradient(180deg, #f5ecdf 0%, #eadfce 100%)',
          },
          '::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(40, 51, 65, 0.18)',
            borderRadius: 999,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 52,
            borderRadius: 14,
            boxShadow: 'none',
          },
          containedPrimary: {
            background: 'linear-gradient(180deg, #1f8cf8 0%, #1773dc 100%)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 14,
            boxShadow: isDark ? '0 16px 36px rgba(0, 0, 0, 0.26)' : '0 18px 42px rgba(65, 46, 24, 0.10)',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: isDark ? alpha('#ffffff', 0.025) : alpha('#ffffff', 0.7),
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 18,
            backgroundColor: palette.background.paper,
            border: `1px solid ${palette.divider}`,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: `1px solid ${palette.divider}`,
            minWidth: 220,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: palette.divider,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
    },
  });
}
