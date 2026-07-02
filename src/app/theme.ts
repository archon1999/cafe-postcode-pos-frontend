import { alpha, createTheme } from '@mui/material/styles';

export type PosThemeMode = 'light' | 'dark';
export type PosThemeColor = 'blue' | 'mint' | 'amber' | 'rose';

type PosThemeModePalette = {
  primary: {
    main: string;
    light: string;
    dark: string;
    contrastText: string;
    gradient: string;
  };
  secondary: string;
  warning: string;
  error: string;
  success: string;
  background: {
    default: string;
    paper: string;
    gradient: string;
    input: string;
  };
  text: {
    primary: string;
    secondary: string;
  };
  divider: string;
  scrollbar: string;
  cardShadow: string;
  shared: {
    actionBg: string;
    actionHoverBg: string;
    actionBorder: string;
    actionShadow: string;
    dockActiveBg: string;
    dockIdleBg: string;
    dockActiveBorder: string;
    dockIdleBorder: string;
    dockActiveShadow: string;
    dockIdleShadow: string;
    dockOverlayActive: string;
    dockOverlayIdle: string;
    dockHoverBorder: string;
    tabActiveBg: string;
    tabIdleBg: string;
    tabActiveColor: string;
    tabIdleColor: string;
    tabActiveShadow: string;
    tabActiveHoverBg: string;
    tabIdleHoverBg: string;
    segmentBg: string;
    segmentBorder: string;
    segmentActiveBg: string;
    segmentActiveColor: string;
    legendBg: string;
    checkCardBg: string;
    checkCardSelectedBg: string;
    checkCardAvatarBg: string;
    checkCardEmptyBg: string;
    menuItemPriceBg: string;
    orderPanelBg: string;
    contentPanelBg: string;
    contentPanelShadow: string;
    orderAvatarBg: string;
    cartItemBg: string;
    cartItemHoverBg: string;
    cartActionBg: string;
    cartActionHoverBg: string;
    menuProductCardBg: string;
    menuProductCardHoverBg: string;
    menuProductPriceBg: string;
    mobileSummaryBg: string;
    mobileSummaryShadow: string;
    secondaryActionBg: string;
    paymentItemBg: string;
    paymentOptionBg: string;
    paymentOptionHoverBg: string;
    debugPanelBg: string;
  };
};

export type PosThemeColorOption = {
  id: PosThemeColor;
  label: string;
  swatch: {
    light: string;
    dark: string;
  };
  modes: Partial<Record<PosThemeMode, PosThemeModePalette>>;
};

const blueShared = {
  light: {
    actionBg: 'rgba(255,255,255,0.84)',
    actionHoverBg: 'rgba(255,255,255,0.92)',
    actionBorder: 'rgba(255,255,255,0.22)',
    actionShadow: '0 10px 24px rgba(67,47,28,0.12)',
    dockActiveBg: 'linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(248,241,233,0.76) 100%)',
    dockIdleBg: 'linear-gradient(180deg, rgba(255,255,255,0.58) 0%, rgba(242,233,220,0.42) 100%)',
    dockActiveBorder: 'rgba(255,255,255,0.62)',
    dockIdleBorder: 'rgba(255,255,255,0.34)',
    dockActiveShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 18px 32px rgba(112,79,43,0.18)',
    dockIdleShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 14px 26px rgba(112,79,43,0.14)',
    dockOverlayActive:
      'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.04) 52%, rgba(255,255,255,0.12) 100%)',
    dockOverlayIdle:
      'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.04) 52%, rgba(255,255,255,0.08) 100%)',
    dockHoverBorder: 'rgba(255,255,255,0.62)',
    tabActiveBg: '#1978da',
    tabIdleBg: '#ede7dc',
    tabActiveColor: '#ffffff',
    tabIdleColor: '#6f7782',
    tabActiveShadow: '0 10px 18px rgba(27,132,236,0.2)',
    tabActiveHoverBg: '#1569c1',
    tabIdleHoverBg: '#e4ddcf',
    segmentBg: '#e7ddcf',
    segmentBorder: 'rgba(41,47,56,0.04)',
    segmentActiveBg: '#5c5c5c',
    segmentActiveColor: '#ffffff',
    legendBg: '#eee6d9',
    checkCardBg: 'rgba(255,255,255,0.76)',
    checkCardSelectedBg: '#efe7db',
    checkCardAvatarBg: '#d8d0c2',
    checkCardEmptyBg: 'rgba(255,255,255,0.75)',
    menuItemPriceBg: '#d7cebf',
    orderPanelBg: '#f6f0e7',
    contentPanelBg: '#f8f1e8',
    contentPanelShadow: '0 18px 38px rgba(121,87,44,0.1)',
    orderAvatarBg: '#dad2c4',
    cartItemBg: '#ede5d8',
    cartItemHoverBg: '#e7ded1',
    cartActionBg: '#f5efe5',
    cartActionHoverBg: '#ffffff',
    menuProductCardBg: '#f1e7da',
    menuProductCardHoverBg: '#ebe1d3',
    menuProductPriceBg: '#d9d0c2',
    mobileSummaryBg: 'rgba(250,244,234,0.96)',
    mobileSummaryShadow: '0 16px 30px rgba(98,70,38,0.14)',
    secondaryActionBg: '#d8cfbf',
    paymentItemBg: '#ede4d7',
    paymentOptionBg: '#ece4d7',
    paymentOptionHoverBg: '#e2d7c8',
    debugPanelBg: '#f0ece5',
  },
  dark: {
    actionBg: 'rgba(43,46,51,0.58)',
    actionHoverBg: 'rgba(53,57,66,0.7)',
    actionBorder: 'rgba(255,255,255,0.08)',
    actionShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 22px rgba(0,0,0,0.2)',
    dockActiveBg:
      'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.025) 18%, rgba(20,22,26,0.1) 100%), linear-gradient(180deg, rgba(126,130,137,0.88) 0%, rgba(87,91,98,0.74) 52%, rgba(57,60,66,0.82) 100%)',
    dockIdleBg:
      'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.018) 18%, rgba(16,18,21,0.12) 100%), linear-gradient(180deg, rgba(67,70,76,0.62) 0%, rgba(47,50,56,0.62) 52%, rgba(32,35,40,0.76) 100%)',
    dockActiveBorder: 'rgba(255,255,255,0.24)',
    dockIdleBorder: 'rgba(255,255,255,0.12)',
    dockActiveShadow:
      'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -14px 20px rgba(0,0,0,0.12), 0 14px 26px rgba(0,0,0,0.24)',
    dockIdleShadow:
      'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -14px 20px rgba(0,0,0,0.1), 0 10px 20px rgba(0,0,0,0.18)',
    dockOverlayActive:
      'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.02) 26%, rgba(255,255,255,0) 58%, rgba(255,255,255,0.06) 100%)',
    dockOverlayIdle:
      'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 26%, rgba(255,255,255,0) 58%, rgba(255,255,255,0.03) 100%)',
    dockHoverBorder: 'rgba(255,255,255,0.28)',
    tabActiveBg: '#1978da',
    tabIdleBg: '#292c31',
    tabActiveColor: '#ffffff',
    tabIdleColor: '#a4a8ae',
    tabActiveShadow: '0 10px 18px rgba(27,132,236,0.2)',
    tabActiveHoverBg: '#1569c1',
    tabIdleHoverBg: '#31343a',
    segmentBg: '#17181b',
    segmentBorder: 'rgba(255,255,255,0.03)',
    segmentActiveBg: '#4a4a4a',
    segmentActiveColor: '#ffffff',
    legendBg: '#2a2d31',
    checkCardBg: '#292929',
    checkCardSelectedBg: '#343434',
    checkCardAvatarBg: '#565656',
    checkCardEmptyBg: '#252525',
    menuItemPriceBg: '#383c42',
    orderPanelBg: '#222222',
    contentPanelBg: '#1f2125',
    contentPanelShadow: '0 20px 40px rgba(0,0,0,0.24)',
    orderAvatarBg: '#4b4b4b',
    cartItemBg: '#2d2d2d',
    cartItemHoverBg: '#333438',
    cartActionBg: '#272a2f',
    cartActionHoverBg: '#2f343a',
    menuProductCardBg: '#26282c',
    menuProductCardHoverBg: '#2d3035',
    menuProductPriceBg: '#4f555d',
    mobileSummaryBg: 'rgba(35,38,43,0.94)',
    mobileSummaryShadow: '0 18px 32px rgba(0,0,0,0.3)',
    secondaryActionBg: '#4d535a',
    paymentItemBg: '#2c2f34',
    paymentOptionBg: '#2c2f34',
    paymentOptionHoverBg: '#34383f',
    debugPanelBg: '#101114',
  },
} as const;

function createAccentShared(mode: PosThemeMode, primary: string, primaryDark: string, accent: string) {
  const isDark = mode === 'dark';

  return {
    actionBg: isDark
      ? `linear-gradient(180deg, ${alpha(accent, 0.095)} 0%, rgba(29,35,40,0.82) 100%)`
      : `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, ${alpha(accent, 0.085)} 100%)`,
    actionHoverBg: isDark
      ? `linear-gradient(180deg, ${alpha(accent, 0.14)} 0%, rgba(29,35,40,0.94) 100%)`
      : `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${alpha(accent, 0.13)} 100%)`,
    actionBorder: isDark ? alpha('#ffffff', 0.1) : alpha('#17212b', 0.08),
    actionShadow: isDark
      ? `inset 0 1px 0 ${alpha(accent, 0.1)}, 0 10px 22px rgba(0,0,0,0.22)`
      : `0 10px 24px ${alpha(accent, 0.1)}`,
    dockActiveBg: isDark
      ? `linear-gradient(180deg, ${alpha(accent, 0.18)} 0%, ${alpha(accent, 0.095)} 28%, rgba(29,35,40,0.92) 100%)`
      : `linear-gradient(180deg, rgba(255,255,255,0.96) 0%, ${alpha(accent, 0.16)} 100%)`,
    dockIdleBg: isDark
      ? `linear-gradient(180deg, ${alpha(accent, 0.045)} 0%, rgba(29,35,40,0.72) 100%)`
      : `linear-gradient(180deg, rgba(255,255,255,0.72) 0%, ${alpha(accent, 0.045)} 100%)`,
    dockActiveBorder: isDark ? alpha(accent, 0.22) : alpha(accent, 0.2),
    dockIdleBorder: isDark ? alpha('#ffffff', 0.1) : alpha('#17212b', 0.12),
    dockActiveShadow: isDark
      ? `inset 0 1px 0 ${alpha(accent, 0.18)}, inset 0 -14px 20px rgba(0,0,0,0.12), 0 16px 28px ${alpha(accent, 0.12)}`
      : `inset 0 1px 0 rgba(255,255,255,0.78), 0 18px 32px ${alpha(accent, 0.14)}`,
    dockIdleShadow: isDark
      ? 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -14px 20px rgba(0,0,0,0.1), 0 10px 20px rgba(0,0,0,0.18)'
      : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 14px 26px rgba(23,33,43,0.08)',
    dockOverlayActive: isDark
      ? `linear-gradient(180deg, ${alpha(accent, 0.16)} 0%, rgba(255,255,255,0.02) 26%, rgba(255,255,255,0) 58%, ${alpha(accent, 0.08)} 100%)`
      : `linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.04) 52%, ${alpha(accent, 0.14)} 100%)`,
    dockOverlayIdle: isDark
      ? `linear-gradient(180deg, ${alpha(accent, 0.06)} 0%, rgba(255,255,255,0.02) 26%, rgba(255,255,255,0) 58%, ${alpha(accent, 0.03)} 100%)`
      : `linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.04) 52%, ${alpha(accent, 0.06)} 100%)`,
    dockHoverBorder: isDark ? alpha(accent, 0.22) : alpha(accent, 0.2),
    tabActiveBg: primary,
    tabIdleBg: isDark ? alpha(accent, 0.095) : alpha(accent, 0.085),
    tabActiveColor: '#ffffff',
    tabIdleColor: isDark ? '#a4a8ae' : '#56616d',
    tabActiveShadow: `0 10px 18px ${alpha(primary, 0.22)}`,
    tabActiveHoverBg: primaryDark,
    tabIdleHoverBg: isDark ? alpha(accent, 0.14) : alpha(accent, 0.13),
    segmentBg: isDark ? alpha(accent, 0.095) : alpha(accent, 0.085),
    segmentBorder: isDark ? alpha('#ffffff', 0.03) : alpha(accent, 0.2),
    segmentActiveBg: isDark ? alpha(accent, 0.22) : alpha(accent, 0.2),
    segmentActiveColor: isDark ? '#ffffff' : '#17212b',
    legendBg: isDark ? alpha(accent, 0.095) : alpha(accent, 0.085),
    checkCardBg: isDark ? '#292929' : 'rgba(255,255,255,0.76)',
    checkCardSelectedBg: isDark ? '#343434' : alpha(accent, 0.11),
    checkCardAvatarBg: isDark ? '#565656' : alpha(accent, 0.18),
    checkCardEmptyBg: isDark ? '#252525' : 'rgba(255,255,255,0.75)',
    menuItemPriceBg: isDark ? '#383c42' : '#e8eef5',
    orderPanelBg: isDark ? '#222222' : '#ffffff',
    contentPanelBg: isDark ? '#1f2125' : '#ffffff',
    contentPanelShadow: isDark ? '0 20px 40px rgba(0,0,0,0.24)' : '0 18px 38px rgba(23,33,43,0.1)',
    orderAvatarBg: isDark ? '#4b4b4b' : '#e4ebf2',
    cartItemBg: isDark ? '#2d2d2d' : '#f8fbff',
    cartItemHoverBg: isDark ? '#333438' : '#eef4fa',
    cartActionBg: isDark ? '#272a2f' : '#ffffff',
    cartActionHoverBg: isDark ? '#2f343a' : '#ffffff',
    menuProductCardBg: isDark ? '#26282c' : '#ffffff',
    menuProductCardHoverBg: isDark ? '#2d3035' : '#f8fbff',
    menuProductPriceBg: isDark ? '#4f555d' : '#e4ebf2',
    mobileSummaryBg: isDark ? 'rgba(35,38,43,0.94)' : 'rgba(255,255,255,0.96)',
    mobileSummaryShadow: isDark ? '0 18px 32px rgba(0,0,0,0.3)' : '0 16px 30px rgba(23,33,43,0.12)',
    secondaryActionBg: isDark ? '#4d535a' : '#d7e0ea',
    paymentItemBg: isDark ? '#2c2f34' : '#f8fbff',
    paymentOptionBg: isDark ? '#2c2f34' : '#e8eef5',
    paymentOptionHoverBg: isDark ? '#34383f' : '#d7e0ea',
    debugPanelBg: isDark ? '#101114' : '#f8fbff',
  };
}

const amberShared = {
  light: {
    ...createAccentShared('light', '#b66b18', '#8e4f10', '#3f8c78'),
    actionBg: 'linear-gradient(180deg, rgba(255,250,241,0.96) 0%, rgba(244,224,191,0.58) 100%)',
    actionHoverBg: 'linear-gradient(180deg, #fffaf2 0%, rgba(238,207,161,0.72) 100%)',
    actionBorder: 'rgba(118,76,28,0.11)',
    actionShadow: '0 10px 24px rgba(132,86,31,0.13)',
    dockActiveBg: 'linear-gradient(180deg, rgba(255,251,244,0.98) 0%, rgba(242,216,179,0.76) 100%)',
    dockIdleBg: 'linear-gradient(180deg, rgba(255,250,242,0.7) 0%, rgba(238,225,207,0.54) 100%)',
    dockActiveBorder: 'rgba(194,129,45,0.24)',
    dockIdleBorder: 'rgba(126,89,48,0.14)',
    dockActiveShadow: 'inset 0 1px 0 rgba(255,255,255,0.82), 0 18px 32px rgba(150,98,37,0.18)',
    dockIdleShadow: 'inset 0 1px 0 rgba(255,255,255,0.56), 0 14px 26px rgba(117,80,39,0.12)',
    tabIdleBg: '#efe1cc',
    tabIdleColor: '#725b43',
    tabIdleHoverBg: '#e6d3b7',
    segmentBg: '#ecdbc1',
    segmentBorder: 'rgba(119,76,28,0.1)',
    segmentActiveBg: '#a65f16',
    segmentActiveColor: '#fff8ec',
    legendBg: '#ead7bb',
    checkCardBg: 'rgba(255,250,242,0.8)',
    checkCardSelectedBg: '#efe2cd',
    checkCardAvatarBg: '#dfc6a0',
    checkCardEmptyBg: 'rgba(255,250,242,0.72)',
    menuItemPriceBg: '#dcc39d',
    orderPanelBg: '#f5eadb',
    contentPanelBg: '#f7efe3',
    contentPanelShadow: '0 18px 38px rgba(117,78,35,0.13)',
    orderAvatarBg: '#dfc6a0',
    cartItemBg: '#f0dfc8',
    cartItemHoverBg: '#e8d3b3',
    cartActionBg: '#f9f0e2',
    cartActionHoverBg: '#fffaf2',
    menuProductCardBg: '#f4e6d1',
    menuProductCardHoverBg: '#edd9bd',
    menuProductPriceBg: '#dbc197',
    mobileSummaryBg: 'rgba(249,240,226,0.96)',
    mobileSummaryShadow: '0 16px 30px rgba(121,82,39,0.16)',
    secondaryActionBg: '#dac09a',
    paymentItemBg: '#ecd9bd',
    paymentOptionBg: '#ead4b0',
    paymentOptionHoverBg: '#dfc398',
    debugPanelBg: '#f2e5d2',
  },
  dark: {
    ...createAccentShared('dark', '#f0a33a', '#b96918', '#64c7af'),
    actionBg: 'linear-gradient(180deg, rgba(104,70,31,0.42) 0%, rgba(37,29,22,0.88) 100%)',
    actionHoverBg: 'linear-gradient(180deg, rgba(130,85,35,0.5) 0%, rgba(43,33,24,0.96) 100%)',
    actionBorder: 'rgba(255,205,124,0.13)',
    dockActiveBg:
      'linear-gradient(180deg, rgba(255,198,101,0.18) 0%, rgba(120,78,30,0.28) 36%, rgba(42,32,23,0.9) 100%)',
    dockIdleBg: 'linear-gradient(180deg, rgba(92,61,29,0.22) 0%, rgba(33,27,22,0.82) 100%)',
    dockActiveBorder: 'rgba(255,198,101,0.24)',
    dockIdleBorder: 'rgba(255,219,164,0.09)',
    tabIdleBg: '#332820',
    tabIdleColor: '#b89d7e',
    tabIdleHoverBg: '#3e3025',
    segmentBg: '#33271f',
    segmentBorder: 'rgba(255,214,154,0.05)',
    segmentActiveBg: '#6e451c',
    segmentActiveColor: '#fff4df',
    legendBg: '#352a21',
    checkCardBg: '#2b231c',
    checkCardSelectedBg: '#352a20',
    checkCardAvatarBg: '#5a4732',
    checkCardEmptyBg: '#231d18',
    menuItemPriceBg: '#514231',
    orderPanelBg: '#261f19',
    contentPanelBg: '#292018',
    orderAvatarBg: '#5a4732',
    cartItemBg: '#332920',
    cartItemHoverBg: '#3b2f24',
    cartActionBg: '#2e251e',
    cartActionHoverBg: '#413326',
    menuProductCardBg: '#2d241d',
    menuProductCardHoverBg: '#362b22',
    menuProductPriceBg: '#5a4935',
    mobileSummaryBg: 'rgba(40,32,25,0.94)',
    secondaryActionBg: '#574331',
    paymentItemBg: '#342a21',
    paymentOptionBg: '#3b2f24',
    paymentOptionHoverBg: '#4a3929',
    debugPanelBg: '#191511',
  },
} as const;

const roseShared = {
  light: {
    ...createAccentShared('light', '#b84f68', '#8f394f', '#6f69b8'),
    actionBg: 'linear-gradient(180deg, rgba(255,249,251,0.96) 0%, rgba(241,219,229,0.62) 100%)',
    actionHoverBg: 'linear-gradient(180deg, #fffafd 0%, rgba(235,204,218,0.76) 100%)',
    actionBorder: 'rgba(104,48,64,0.1)',
    actionShadow: '0 10px 24px rgba(122,58,76,0.12)',
    dockActiveBg: 'linear-gradient(180deg, rgba(255,250,252,0.98) 0%, rgba(240,216,226,0.78) 100%)',
    dockIdleBg: 'linear-gradient(180deg, rgba(255,250,253,0.72) 0%, rgba(237,226,233,0.54) 100%)',
    dockActiveBorder: 'rgba(184,79,104,0.2)',
    dockIdleBorder: 'rgba(105,68,82,0.13)',
    dockActiveShadow: 'inset 0 1px 0 rgba(255,255,255,0.82), 0 18px 32px rgba(126,63,82,0.15)',
    dockIdleShadow: 'inset 0 1px 0 rgba(255,255,255,0.56), 0 14px 26px rgba(94,58,73,0.11)',
    tabIdleBg: '#eee0e7',
    tabIdleColor: '#6c5661',
    tabIdleHoverBg: '#e6d0db',
    segmentBg: '#ead8e2',
    segmentBorder: 'rgba(112,58,76,0.1)',
    segmentActiveBg: '#7d6bc2',
    segmentActiveColor: '#ffffff',
    legendBg: '#eadbe3',
    checkCardBg: 'rgba(255,250,253,0.78)',
    checkCardSelectedBg: '#f0dfe8',
    checkCardAvatarBg: '#e0c9d4',
    checkCardEmptyBg: 'rgba(255,250,253,0.72)',
    menuItemPriceBg: '#ddc7d2',
    orderPanelBg: '#f7edf2',
    contentPanelBg: '#faf1f5',
    contentPanelShadow: '0 18px 38px rgba(105,58,76,0.12)',
    orderAvatarBg: '#e0c9d4',
    cartItemBg: '#f0e0e8',
    cartItemHoverBg: '#e8d4df',
    cartActionBg: '#fbf1f6',
    cartActionHoverBg: '#fffafd',
    menuProductCardBg: '#f5e6ee',
    menuProductCardHoverBg: '#edd9e4',
    menuProductPriceBg: '#ddc6d2',
    mobileSummaryBg: 'rgba(251,241,246,0.96)',
    mobileSummaryShadow: '0 16px 30px rgba(105,58,76,0.14)',
    secondaryActionBg: '#ddc5d1',
    paymentItemBg: '#eddce5',
    paymentOptionBg: '#ead5df',
    paymentOptionHoverBg: '#dfc2d0',
    debugPanelBg: '#f3e6ed',
  },
  dark: {
    ...createAccentShared('dark', '#ef7893', '#bd4966', '#8f83ff'),
    actionBg: 'linear-gradient(180deg, rgba(102,47,70,0.42) 0%, rgba(31,24,32,0.9) 100%)',
    actionHoverBg: 'linear-gradient(180deg, rgba(129,55,84,0.5) 0%, rgba(39,28,39,0.96) 100%)',
    actionBorder: 'rgba(255,190,207,0.12)',
    dockActiveBg:
      'linear-gradient(180deg, rgba(255,136,163,0.18) 0%, rgba(107,63,91,0.26) 36%, rgba(38,29,38,0.92) 100%)',
    dockIdleBg: 'linear-gradient(180deg, rgba(83,48,69,0.22) 0%, rgba(31,25,33,0.84) 100%)',
    dockActiveBorder: 'rgba(255,155,181,0.23)',
    dockIdleBorder: 'rgba(255,213,226,0.08)',
    tabIdleBg: '#332633',
    tabIdleColor: '#bea1b0',
    tabIdleHoverBg: '#3f2d3d',
    segmentBg: '#352736',
    segmentBorder: 'rgba(255,210,225,0.05)',
    segmentActiveBg: '#5f4aa0',
    segmentActiveColor: '#fff6fa',
    legendBg: '#362938',
    checkCardBg: '#2e2430',
    checkCardSelectedBg: '#3a2b3b',
    checkCardAvatarBg: '#5a4051',
    checkCardEmptyBg: '#281f2a',
    menuItemPriceBg: '#50394a',
    orderPanelBg: '#281e28',
    contentPanelBg: '#2a202b',
    orderAvatarBg: '#5a4051',
    cartItemBg: '#332736',
    cartItemHoverBg: '#3d2e3f',
    cartActionBg: '#2f2530',
    cartActionHoverBg: '#443346',
    menuProductCardBg: '#2f2531',
    menuProductCardHoverBg: '#392b3a',
    menuProductPriceBg: '#594155',
    mobileSummaryBg: 'rgba(42,32,43,0.94)',
    secondaryActionBg: '#573f52',
    paymentItemBg: '#372a38',
    paymentOptionBg: '#3d2e3f',
    paymentOptionHoverBg: '#4c394e',
    debugPanelBg: '#191219',
  },
} as const;

export const POS_THEME_COLORS: PosThemeColorOption[] = [
  {
    id: 'blue',
    label: 'Blue',
    swatch: {
      light: '#1978da',
      dark: '#54a8ff',
    },
    modes: {
      light: {
        primary: {
          main: '#1978da',
          light: '#2887ec',
          dark: '#1569c1',
          contrastText: '#ffffff',
          gradient: 'linear-gradient(180deg, #1f8cf8 0%, #1773dc 100%)',
        },
        secondary: '#1b968b',
        warning: '#d58a16',
        error: '#d84f5a',
        success: '#169b82',
        background: {
          default: '#f1e7d8',
          paper: '#fcf6ed',
          gradient: 'linear-gradient(180deg, #f5ecdf 0%, #eadfce 100%)',
          input: '#ffffff',
        },
        text: {
          primary: '#2f3944',
          secondary: '#6f7782',
        },
        divider: 'rgba(40, 51, 65, 0.09)',
        scrollbar: 'rgba(40, 51, 65, 0.18)',
        cardShadow: '0 18px 42px rgba(65, 46, 24, 0.10)',
        shared: blueShared.light,
      },
      dark: {
        primary: {
          main: '#54a8ff',
          light: '#7dc0ff',
          dark: '#1978da',
          contrastText: '#07111f',
          gradient: 'linear-gradient(180deg, #5db0ff 0%, #2382e8 100%)',
        },
        secondary: '#31c9c2',
        warning: '#f4b73d',
        error: '#ef5d66',
        success: '#31c9c2',
        background: {
          default: '#181a1e',
          paper: '#21242a',
          gradient: 'linear-gradient(180deg, #191b1f 0%, #17191d 100%)',
          input: 'rgba(255, 255, 255, 0.025)',
        },
        text: {
          primary: '#f3f5f8',
          secondary: '#959aa3',
        },
        divider: 'rgba(255, 255, 255, 0.038)',
        scrollbar: 'rgba(255, 255, 255, 0.18)',
        cardShadow: '0 16px 36px rgba(0, 0, 0, 0.26)',
        shared: blueShared.dark,
      },
    },
  },
  {
    id: 'mint',
    label: 'Mint',
    swatch: {
      light: '#168f7d',
      dark: '#3fd3c4',
    },
    modes: {
      light: {
        primary: {
          main: '#168f7d',
          light: '#22aa97',
          dark: '#0f6f62',
          contrastText: '#ffffff',
          gradient: 'linear-gradient(180deg, #21b29e 0%, #148b7a 100%)',
        },
        secondary: '#2f7ec6',
        warning: '#ca8618',
        error: '#d4505b',
        success: '#138b72',
        background: {
          default: '#eef3f8',
          paper: '#ffffff',
          gradient: 'linear-gradient(180deg, #f7faff 0%, #e8eef5 100%)',
          input: '#ffffff',
        },
        text: {
          primary: '#17212b',
          secondary: '#56616d',
        },
        divider: 'rgba(23, 33, 43, 0.14)',
        scrollbar: 'rgba(40, 51, 65, 0.18)',
        cardShadow: '0 16px 34px rgba(23, 33, 43, 0.12)',
        shared: createAccentShared('light', '#168f7d', '#0f6f62', '#2f7ec6'),
      },
      dark: {
        primary: {
          main: '#3fd3c4',
          light: '#77e5da',
          dark: '#199d90',
          contrastText: '#041715',
          gradient: 'linear-gradient(180deg, #54ddcf 0%, #20a89a 100%)',
        },
        secondary: '#64aef2',
        warning: '#f1b84c',
        error: '#f06a73',
        success: '#3fd3c4',
        background: {
          default: '#141d1d',
          paper: '#1d2929',
          gradient: 'linear-gradient(180deg, #152020 0%, #111a1a 100%)',
          input: 'rgba(255, 255, 255, 0.03)',
        },
        text: {
          primary: '#f1f8f7',
          secondary: '#91a5a1',
        },
        divider: 'rgba(210, 255, 248, 0.055)',
        scrollbar: 'rgba(210, 255, 248, 0.2)',
        cardShadow: '0 16px 36px rgba(0, 0, 0, 0.28)',
        shared: createAccentShared('dark', '#3fd3c4', '#199d90', '#64aef2'),
      },
    },
  },
  {
    id: 'amber',
    label: 'Saffron',
    swatch: {
      light: '#b66b18',
      dark: '#f0a33a',
    },
    modes: {
      light: {
        primary: {
          main: '#b66b18',
          light: '#d98a2c',
          dark: '#8e4f10',
          contrastText: '#ffffff',
          gradient: 'linear-gradient(180deg, #dd8e32 0%, #ad6115 100%)',
        },
        secondary: '#3f8c78',
        warning: '#bf741e',
        error: '#c85c4e',
        success: '#247c68',
        background: {
          default: '#f1e5d3',
          paper: '#fbf3e8',
          gradient: 'linear-gradient(180deg, #f8eddd 0%, #ead9bf 100%)',
          input: '#fffaf2',
        },
        text: {
          primary: '#302419',
          secondary: '#715a40',
        },
        divider: 'rgba(91, 61, 29, 0.14)',
        scrollbar: 'rgba(108, 73, 34, 0.22)',
        cardShadow: '0 16px 34px rgba(93, 61, 27, 0.13)',
        shared: amberShared.light,
      },
      dark: {
        primary: {
          main: '#f0a33a',
          light: '#ffc978',
          dark: '#b96918',
          contrastText: '#211405',
          gradient: 'linear-gradient(180deg, #ffbd62 0%, #cf7b21 100%)',
        },
        secondary: '#64c7af',
        warning: '#f0a33a',
        error: '#ed7467',
        success: '#58bca2',
        background: {
          default: '#1b1712',
          paper: '#272016',
          gradient: 'linear-gradient(180deg, #201a13 0%, #17130f 100%)',
          input: 'rgba(255, 218, 168, 0.035)',
        },
        text: {
          primary: '#fbf2e3',
          secondary: '#b59c7d',
        },
        divider: 'rgba(255, 214, 154, 0.06)',
        scrollbar: 'rgba(255, 214, 154, 0.2)',
        cardShadow: '0 16px 36px rgba(0, 0, 0, 0.32)',
        shared: amberShared.dark,
      },
    },
  },
  {
    id: 'rose',
    label: 'Plum',
    swatch: {
      light: '#b84f68',
      dark: '#ef7893',
    },
    modes: {
      light: {
        primary: {
          main: '#b84f68',
          light: '#d66d86',
          dark: '#8f394f',
          contrastText: '#ffffff',
          gradient: 'linear-gradient(180deg, #d96f88 0%, #ac465f 100%)',
        },
        secondary: '#6f69b8',
        warning: '#b97828',
        error: '#b84f68',
        success: '#238875',
        background: {
          default: '#f1e6ec',
          paper: '#fbf3f7',
          gradient: 'linear-gradient(180deg, #fbf0f6 0%, #eadce5 100%)',
          input: '#fffafd',
        },
        text: {
          primary: '#2e2028',
          secondary: '#6c5661',
        },
        divider: 'rgba(86, 42, 58, 0.13)',
        scrollbar: 'rgba(102, 55, 72, 0.2)',
        cardShadow: '0 16px 34px rgba(86, 42, 58, 0.12)',
        shared: roseShared.light,
      },
      dark: {
        primary: {
          main: '#ef7893',
          light: '#ffa6b8',
          dark: '#bd4966',
          contrastText: '#230911',
          gradient: 'linear-gradient(180deg, #fb8faa 0%, #d85f7c 100%)',
        },
        secondary: '#8f83ff',
        warning: '#e8b25c',
        error: '#ef7893',
        success: '#4bc3ac',
        background: {
          default: '#1c151d',
          paper: '#281f2a',
          gradient: 'linear-gradient(180deg, #211821 0%, #171118 100%)',
          input: 'rgba(255, 218, 229, 0.035)',
        },
        text: {
          primary: '#fbf1f5',
          secondary: '#b99dad',
        },
        divider: 'rgba(255, 210, 225, 0.06)',
        scrollbar: 'rgba(255, 210, 225, 0.2)',
        cardShadow: '0 16px 36px rgba(0, 0, 0, 0.32)',
        shared: roseShared.dark,
      },
    },
  },
];

export const DEFAULT_POS_THEME_COLOR: PosThemeColor = 'blue';

export function getPosThemeColorOptions(mode: PosThemeMode) {
  return POS_THEME_COLORS.filter((option) => Boolean(option.modes[mode]));
}

export function getPosThemeColorOption(
  color: PosThemeColor = DEFAULT_POS_THEME_COLOR,
  mode: PosThemeMode = 'dark',
) {
  const modeOptions = getPosThemeColorOptions(mode);

  return modeOptions.find((option) => option.id === color) ?? modeOptions[0] ?? POS_THEME_COLORS[0];
}

export function isPosThemeColor(value: string | null): value is PosThemeColor {
  return POS_THEME_COLORS.some((option) => option.id === value);
}

export function createPosTheme(mode: PosThemeMode = 'dark', color: PosThemeColor = DEFAULT_POS_THEME_COLOR) {
  const isDark = mode === 'dark';
  const themeColors = getPosThemeColorOption(color, mode).modes[mode] as PosThemeModePalette;
  const accentColor = themeColors.secondary;
  const shellBackground = themeColors.background.gradient;
  const sharedColors = themeColors.shared;

  const palette = {
    mode,
    primary: themeColors.primary,
    secondary: {
      main: themeColors.secondary,
    },
    warning: {
      main: themeColors.warning,
    },
    error: {
      main: themeColors.error,
    },
    success: {
      main: themeColors.success,
    },
    background: {
      default: themeColors.background.default,
      paper: themeColors.background.paper,
    },
    text: themeColors.text,
    divider: themeColors.divider,
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
            '--pos-shell-background': shellBackground,
            '--pos-primary-gradient': themeColors.primary.gradient,
            '--pos-accent': accentColor,
            '--pos-accent-surface': sharedColors.segmentBg,
            '--pos-accent-surface-hover': sharedColors.tabIdleHoverBg,
            '--pos-accent-surface-strong': sharedColors.segmentActiveBg,
            '--pos-accent-border': sharedColors.segmentBorder,
            '--pos-surface': themeColors.background.paper,
            '--pos-surface-muted': themeColors.background.default,
            '--pos-divider': themeColors.divider,
            '--pos-action-bg': sharedColors.actionBg,
            '--pos-action-hover-bg': sharedColors.actionHoverBg,
            '--pos-action-border': sharedColors.actionBorder,
            '--pos-action-shadow': sharedColors.actionShadow,
            '--pos-dock-active-bg': sharedColors.dockActiveBg,
            '--pos-dock-idle-bg': sharedColors.dockIdleBg,
            '--pos-dock-border-active': sharedColors.dockActiveBorder,
            '--pos-dock-border-idle': sharedColors.dockIdleBorder,
            '--pos-dock-active-shadow': sharedColors.dockActiveShadow,
            '--pos-dock-idle-shadow': sharedColors.dockIdleShadow,
            '--pos-dock-overlay-active': sharedColors.dockOverlayActive,
            '--pos-dock-overlay-idle': sharedColors.dockOverlayIdle,
            '--pos-dock-hover-border': sharedColors.dockHoverBorder,
            '--pos-tab-active-bg': sharedColors.tabActiveBg,
            '--pos-tab-idle-bg': sharedColors.tabIdleBg,
            '--pos-tab-active-color': sharedColors.tabActiveColor,
            '--pos-tab-idle-color': sharedColors.tabIdleColor,
            '--pos-tab-active-shadow': sharedColors.tabActiveShadow,
            '--pos-tab-active-hover-bg': sharedColors.tabActiveHoverBg,
            '--pos-tab-idle-hover-bg': sharedColors.tabIdleHoverBg,
            '--pos-segment-bg': sharedColors.segmentBg,
            '--pos-segment-border': sharedColors.segmentBorder,
            '--pos-segment-active-bg': sharedColors.segmentActiveBg,
            '--pos-segment-active-color': sharedColors.segmentActiveColor,
            '--pos-legend-bg': sharedColors.legendBg,
            '--pos-check-card-bg': sharedColors.checkCardBg,
            '--pos-check-card-selected-bg': sharedColors.checkCardSelectedBg,
            '--pos-check-card-avatar-bg': sharedColors.checkCardAvatarBg,
            '--pos-check-card-empty-bg': sharedColors.checkCardEmptyBg,
            '--pos-menu-item-price-bg': sharedColors.menuItemPriceBg,
            '--pos-order-panel-bg': sharedColors.orderPanelBg,
            '--pos-content-panel-bg': sharedColors.contentPanelBg,
            '--pos-content-panel-shadow': sharedColors.contentPanelShadow,
            '--pos-order-avatar-bg': sharedColors.orderAvatarBg,
            '--pos-cart-item-bg': sharedColors.cartItemBg,
            '--pos-cart-item-hover-bg': sharedColors.cartItemHoverBg,
            '--pos-cart-action-bg': sharedColors.cartActionBg,
            '--pos-cart-action-hover-bg': sharedColors.cartActionHoverBg,
            '--pos-menu-product-card-bg': sharedColors.menuProductCardBg,
            '--pos-menu-product-card-hover-bg': sharedColors.menuProductCardHoverBg,
            '--pos-menu-product-price-bg': sharedColors.menuProductPriceBg,
            '--pos-mobile-summary-bg': sharedColors.mobileSummaryBg,
            '--pos-mobile-summary-shadow': sharedColors.mobileSummaryShadow,
            '--pos-secondary-action-bg': sharedColors.secondaryActionBg,
            '--pos-payment-item-bg': sharedColors.paymentItemBg,
            '--pos-payment-option-bg': sharedColors.paymentOptionBg,
            '--pos-payment-option-hover-bg': sharedColors.paymentOptionHoverBg,
            '--pos-debug-panel-bg': sharedColors.debugPanelBg,
            '--pos-shadow-soft': themeColors.cardShadow,
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
            backgroundImage: shellBackground,
          },
          '::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '::-webkit-scrollbar-thumb': {
            background: themeColors.scrollbar,
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
            background: themeColors.primary.gradient,
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
            boxShadow: themeColors.cardShadow,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: isDark ? themeColors.background.input : alpha(themeColors.background.input, 0.88),
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
