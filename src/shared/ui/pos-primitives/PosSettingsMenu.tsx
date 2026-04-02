import { Icon } from '@iconify/react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';

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
  onSignOut,
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
  onSignOut: () => void;
  themeMode: 'light' | 'dark';
}) {
  const copy = getPosCopy(locale);

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
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
