import { Icon } from '@iconify/react';
import {
  Box,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
  alpha,
} from '@mui/material';

import { getPosThemeColorOptions, type PosThemeColor } from 'app/theme';
import { SystemHealthPanel } from 'shared/system-health';

import type { PosLocale } from '../../locale/copy';
import { getPosCopy, localeLabels } from '../../locale/copy';

export function PosSettingsMenu({
  anchorEl,
  locale,
  onClose,
  onLocaleChange,
  onShift,
  onLock,
  onRefresh,
  onThemeToggle,
  onThemeColorChange,
  onSignOut,
  themeColor,
  themeMode,
}: {
  anchorEl: HTMLElement | null;
  locale: PosLocale;
  onClose: () => void;
  onLocaleChange: (locale: PosLocale) => void;
  onShift?: () => void;
  onLock?: () => void;
  onRefresh?: () => void;
  onThemeToggle: () => void;
  onThemeColorChange: (color: PosThemeColor) => void;
  onSignOut: () => void;
  themeColor: PosThemeColor;
  themeMode: 'light' | 'dark';
}) {
  const copy = getPosCopy(locale);
  const themeOptions = getPosThemeColorOptions(themeMode);
  const selectedThemeColor = themeOptions.some((option) => option.id === themeColor) ? themeColor : themeOptions[0]?.id;

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      <SystemHealthPanel enabled={Boolean(anchorEl)} locale={locale} onRequestCloseMenu={() => {}} />
      <Divider />

      <MenuItem
        onClick={() => {
          onThemeToggle();
          onClose();
        }}>
        <ListItemIcon>
          <Icon icon={themeMode === 'dark' ? 'solar:sun-2-bold-duotone' : 'solar:moon-stars-bold-duotone'} width={22} />
        </ListItemIcon>
        <ListItemText primary={copy.theme} secondary={themeMode === 'dark' ? copy.lightMode : copy.darkMode} />
      </MenuItem>

      <Box sx={{ px: 2, pb: 1.5 }}>
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
            {copy.themeColor}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {themeOptions.map((option) => {
              const selected = option.id === selectedThemeColor;
              const preview = option.modes[themeMode];

              if (!preview) {
                return null;
              }

              return (
                <ButtonBase
                  key={option.id}
                  aria-label={option.label}
                  aria-pressed={selected}
                  onClick={() => onThemeColorChange(option.id)}
                  sx={(theme) => ({
                    width: 72,
                    height: 48,
                    borderRadius: 1.7,
                    p: 0.45,
                    display: 'block',
                    background: preview.background.gradient,
                    border: `2px solid ${selected ? preview.primary.main : alpha(theme.palette.text.primary, 0.14)}`,
                    boxShadow: selected ? `0 0 0 3px ${alpha(preview.primary.main, 0.18)}` : 'none',
                    transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: `0 0 0 3px ${alpha(preview.primary.main, selected ? 0.22 : 0.12)}`,
                    },
                  })}>
                  <Box
                    sx={{
                      height: '100%',
                      borderRadius: 1.35,
                      overflow: 'hidden',
                      backgroundColor: preview.background.paper,
                      border: `1px solid ${preview.divider}`,
                    }}>
                    <Box
                      sx={{
                        height: 9,
                        display: 'flex',
                        alignItems: 'center',
                        px: 0.6,
                        gap: 0.35,
                        borderBottom: `1px solid ${preview.divider}`,
                        backgroundColor:
                          themeMode === 'dark' ? alpha(preview.text.primary, 0.03) : alpha(preview.text.primary, 0.02),
                      }}>
                      <Box sx={{ width: 23, height: 3.5, borderRadius: 99, backgroundColor: preview.primary.main }} />
                      <Box sx={{ flex: 1 }} />
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: preview.primary.dark }} />
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: preview.secondary }} />
                    </Box>
                    <Box sx={{ px: 0.65, py: 0.5 }}>
                      <Box
                        sx={{
                          height: 10,
                          borderRadius: 1,
                          border: `2px solid ${alpha(preview.text.secondary, 0.32)}`,
                          backgroundColor: themeMode === 'dark' ? alpha('#ffffff', 0.025) : alpha('#ffffff', 0.62),
                        }}
                      />
                      <Box
                        sx={{
                          mt: 0.5,
                          width: 34,
                          height: 7,
                          borderRadius: 1,
                          backgroundColor: preview.shared.menuItemPriceBg,
                        }}
                      />
                    </Box>
                  </Box>
                </ButtonBase>
              );
            })}
          </Stack>
        </Stack>
      </Box>

      <Divider />

      {Object.entries(localeLabels).map(([localeCode, label]) => (
        <MenuItem
          key={localeCode}
          selected={locale === localeCode}
          onClick={() => {
            onLocaleChange(localeCode as PosLocale);
            onClose();
          }}>
          <ListItemIcon>
            <Icon icon="solar:global-line-duotone" width={22} />
          </ListItemIcon>
          <ListItemText primary={label} secondary={copy.language} />
        </MenuItem>
      ))}

      {onRefresh || onLock || onShift ? <Divider /> : null}

      {onShift ? (
        <MenuItem
          onClick={() => {
            onShift();
            onClose();
          }}>
          <ListItemIcon>
            <Icon icon="solar:clock-circle-bold-duotone" width={22} />
          </ListItemIcon>
          <ListItemText primary={copy.shift} />
        </MenuItem>
      ) : null}

      {onRefresh ? (
        <MenuItem
          onClick={() => {
            onRefresh();
            onClose();
          }}>
          <ListItemIcon>
            <Icon icon="solar:refresh-bold-duotone" width={22} />
          </ListItemIcon>
          <ListItemText primary={copy.refresh} />
        </MenuItem>
      ) : null}

      {onLock ? (
        <MenuItem
          onClick={() => {
            onLock();
            onClose();
          }}>
          <ListItemIcon>
            <Icon icon="solar:lock-password-bold-duotone" width={22} />
          </ListItemIcon>
          <ListItemText primary={copy.lockScreen} />
        </MenuItem>
      ) : null}

      <Divider />

      <MenuItem
        onClick={() => {
          onSignOut();
          onClose();
        }}>
        <ListItemIcon>
          <Icon icon="solar:logout-3-bold-duotone" width={22} />
        </ListItemIcon>
        <ListItemText primary={copy.signOut} />
      </MenuItem>
    </Menu>
  );
}
