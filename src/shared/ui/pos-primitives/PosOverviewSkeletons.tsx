import { Box, Skeleton, Stack, alpha } from '@mui/material';

function PosOverviewCardSkeleton({ height = 160 }: { height?: number }) {
  return (
    <Box
      sx={(theme) => ({
        borderRadius: '20px',
        p: 2,
        minHeight: height,
        backgroundColor: theme.palette.mode === 'dark' ? '#26292e' : alpha('#ffffff', 0.76),
        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.3)}`,
      })}>
      <Stack spacing={1.2}>
        <Skeleton variant="rounded" width="58%" height={24} />
        <Skeleton variant="rounded" width="42%" height={18} />
        <Skeleton variant="rounded" width="100%" height={70} sx={{ mt: 0.5 }} />
        <Skeleton variant="rounded" width="68%" height={18} />
      </Stack>
    </Box>
  );
}

export function PosHallsPageSkeleton() {
  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.1, md: 1.5 }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="rounded" height={58} sx={{ borderRadius: '18px' }} />
        </Stack>
        <Stack
          direction="row"
          spacing={{ xs: 1, md: 1.5 }}
          sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
          <Skeleton variant="circular" width={48} height={48} />
          <Skeleton variant="circular" width={48} height={48} />
        </Stack>
      </Stack>

      <Box
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '28px',
          backgroundColor: theme.palette.mode === 'dark' ? '#1f2124' : alpha('#ffffff', 0.78),
          border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.03 : 0.34)}`,
          px: { xs: 1.9, md: 2.6 },
          py: { xs: 1.9, md: 2.45 },
        })}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.8}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          sx={{ mb: 3 }}>
          <Skeleton variant="rounded" width={220} height={38} />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" width={110} height={32} sx={{ borderRadius: '999px' }} />
            ))}
          </Stack>
        </Stack>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              xl: 'repeat(4, minmax(0, 1fr))',
            },
            gap: { xs: 1.5, md: 1.7 },
          }}>
          {Array.from({ length: 8 }).map((_, index) => (
            <PosOverviewCardSkeleton key={index} height={134} />
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

export function PosKitchenQueueSkeleton() {
  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="rounded" width="100%" height={64} sx={{ borderRadius: '16px' }} />
        </Stack>
        <Stack direction="row" spacing={{ xs: 1, md: 1.5 }}>
          <Skeleton variant="circular" width={48} height={48} />
          <Skeleton variant="circular" width={48} height={48} />
        </Stack>
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.55,
        }}>
        {Array.from({ length: 8 }).map((_, index) => (
          <PosOverviewCardSkeleton key={index} height={420} />
        ))}
      </Box>
    </Stack>
  );
}

function PosOpenChecksListSkeleton() {
  return (
    <Stack spacing={1.35} sx={{ height: '100%', minHeight: 0, overflowY: 'auto', pr: { xs: 0.2, md: 0.6 } }}>
      {Array.from({ length: 7 }).map((_, index) => (
        <Box
          key={index}
          sx={(theme) => ({
            borderRadius: '10px',
            px: 2,
            py: 1.65,
            backgroundColor: theme.palette.mode === 'dark' ? '#292929' : alpha('#ffffff', 0.76),
          })}>
          <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
            <Stack direction="row" spacing={1.75} alignItems="center">
              <Skeleton variant="rounded" width={56} height={56} sx={{ borderRadius: '9px' }} />
              <Stack spacing={0.6}>
                <Skeleton variant="rounded" width={120} height={24} />
                <Skeleton variant="rounded" width={88} height={18} />
                <Skeleton variant="rounded" width={96} height={18} />
              </Stack>
            </Stack>
            <Stack spacing={0.6} alignItems="flex-end">
              <Skeleton variant="rounded" width={92} height={24} />
              <Skeleton variant="rounded" width={74} height={18} />
            </Stack>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function PosOpenChecksDetailSkeleton() {
  return (
    <Box
      sx={(theme) => ({
        borderRadius: '14px',
        overflow: 'hidden',
        height: '100%',
        minHeight: 0,
        backgroundColor: 'var(--pos-order-panel-bg)',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.3)}`,
      })}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Skeleton variant="rounded" width={66} height={66} sx={{ borderRadius: '10px' }} />
          <Stack spacing={0.5}>
            <Skeleton variant="rounded" width={150} height={18} />
            <Skeleton variant="rounded" width={90} height={18} />
            <Skeleton variant="rounded" width={112} height={18} />
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ px: 2.5, pb: 2 }}>
        <Skeleton variant="rounded" width={124} height={36} sx={{ borderRadius: '999px' }} />
      </Box>
      <Box sx={{ px: 2.5, pb: 2, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={1.55}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Box
              key={index}
              sx={(theme) => ({
                borderRadius: '10px',
                p: 1.65,
                backgroundColor: 'var(--pos-cart-item-bg)',
              })}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Stack spacing={0.45} sx={{ flex: 1 }}>
                  <Skeleton variant="rounded" width="68%" height={20} />
                  <Skeleton variant="rounded" width="42%" height={16} />
                </Stack>
                <Skeleton variant="rounded" width={80} height={20} />
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
      <Stack spacing={1.4} sx={{ p: 2.5 }}>
        <Skeleton variant="rounded" width="100%" height={18} />
        <Skeleton variant="rounded" width="100%" height={18} />
        <Skeleton variant="rounded" width="78%" height={32} />
        <Skeleton variant="rounded" width="100%" height={48} sx={{ borderRadius: '12px' }} />
      </Stack>
    </Box>
  );
}

export function PosOpenChecksSkeleton({ mobile }: { mobile: boolean }) {
  return (
    <Stack spacing={2.5} sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
        <Skeleton variant="rounded" width={280} height={54} sx={{ borderRadius: '16px' }} />
        <Stack direction="row" spacing={1.5}>
          <Skeleton variant="circular" width={48} height={48} />
          <Skeleton variant="circular" width={48} height={48} />
        </Stack>
      </Stack>

      {mobile ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <PosOpenChecksListSkeleton />
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(0, 1fr) clamp(320px, 34vw, 370px)',
              xl: 'minmax(0, 1fr) clamp(380px, 24vw, 430px)',
            },
            gap: { xs: 1.5, md: 1.6, xl: 2.4 },
          }}>
          <PosOpenChecksListSkeleton />
          <PosOpenChecksDetailSkeleton />
        </Box>
      )}
    </Stack>
  );
}

function PosBuilderCartSkeleton() {
  return (
    <Box
      sx={(theme) => ({
        borderRadius: '14px',
        overflow: 'hidden',
        height: '100%',
        minHeight: 0,
        backgroundColor: 'var(--pos-order-panel-bg)',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${alpha('#ffffff', theme.palette.mode === 'dark' ? 0.04 : 0.3)}`,
      })}>
      <Box sx={{ p: 2.25 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
          <Skeleton variant="rounded" width={156} height={28} />
          <Skeleton variant="circular" width={40} height={40} />
        </Stack>
      </Box>
      <Box sx={{ px: 2.25, pb: 1.35 }}>
        <Skeleton variant="rounded" width="100%" height={42} sx={{ borderRadius: '999px' }} />
      </Box>
      <Box sx={{ px: 2.25, py: 1.5, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={1.35}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Box
              key={index}
              sx={(theme) => ({
                borderRadius: '12px',
                p: 1.5,
                backgroundColor: 'var(--pos-cart-item-bg)',
              })}>
              <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Skeleton variant="rounded" width="72%" height={20} />
                  <Skeleton variant="rounded" width="48%" height={16} />
                </Stack>
                <Skeleton variant="rounded" width={76} height={20} />
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
      <Stack spacing={1.2} sx={{ px: 2.25, py: 1.75 }}>
        <Skeleton variant="rounded" width="100%" height={56} sx={{ borderRadius: '14px' }} />
        <Skeleton variant="rounded" width="100%" height={18} />
        <Skeleton variant="rounded" width="100%" height={18} />
        <Skeleton variant="rounded" width="76%" height={30} />
        <Stack direction="row" spacing={1}>
          <Skeleton variant="rounded" width="100%" height={46} sx={{ borderRadius: '12px' }} />
          <Skeleton variant="rounded" width="100%" height={46} sx={{ borderRadius: '12px' }} />
        </Stack>
      </Stack>
    </Box>
  );
}

export function PosBuilderPageSkeleton({ mobile }: { mobile: boolean }) {
  return (
    <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.1, md: 1.5 }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="rounded" height={58} sx={{ borderRadius: '18px' }} />
        </Stack>
        <Stack
          direction="row"
          spacing={{ xs: 1, md: 1.5 }}
          sx={{ justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
          <Skeleton variant="circular" width={48} height={48} />
          <Skeleton variant="circular" width={48} height={48} />
          {!mobile ? <Skeleton variant="circular" width={48} height={48} /> : null}
        </Stack>
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(0, 1fr) clamp(320px, 34vw, 360px)',
            xl: 'minmax(0, 1fr) clamp(380px, 24vw, 430px)',
          },
          gap: { xs: 1.5, md: 1.6, xl: 2.4 },
        }}>
        <Stack spacing={2} sx={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <Skeleton variant="rounded" width={240} height={34} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
                '@media (min-width: 1800px)': {
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                },
              },
              gap: { xs: 1.1, md: 1.2, xl: 1.4 },
            }}>
            {Array.from({ length: 8 }).map((_, index) => (
              <PosOverviewCardSkeleton key={index} height={126} />
            ))}
          </Box>
        </Stack>

        {!mobile ? <PosBuilderCartSkeleton /> : null}
      </Box>
    </Stack>
  );
}
