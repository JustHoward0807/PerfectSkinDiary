import type { ReactNode } from 'react';

export interface HeaderProps {
  title: string;
  /** Defaults to router.back() when omitted */
  onBack?: () => void;
  /** Optional element rendered in the trailing (right) slot */
  trailing?: ReactNode;
}
