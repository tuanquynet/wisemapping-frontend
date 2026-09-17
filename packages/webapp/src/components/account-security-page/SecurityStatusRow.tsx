import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export interface SecurityStatusRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Reusable primitive for security panels (UX-DR15, UX-DR16).
 *
 * Left slot: Title with real heading semantics + secondary explanation.
 * Right slot: Status chip and action button.
 * Wraps cleanly on mobile (below sm breakpoint) without fixed heights.
 */
export const SecurityStatusRow: React.FC<SecurityStatusRowProps> = ({
  title,
  description,
  status,
  action,
}) => (
  <Stack
    direction="row"
    justifyContent="space-between"
    alignItems="center"
    flexWrap="wrap"
    sx={{ py: 1.5, gap: 2 }}
  >
    <Box sx={{ flex: 1, minWidth: 240 }}>
      <Typography variant="subtitle1" component="h3" fontWeight={600}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
    </Box>
    {(status || action) && (
      <Stack direction="row" spacing={1.5} alignItems="center">
        {status}
        {action}
      </Stack>
    )}
  </Stack>
);

export default SecurityStatusRow;
