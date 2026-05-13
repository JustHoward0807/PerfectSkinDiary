export interface HeaderProps {
  title: string;
  /** Defaults to router.back() when omitted */
  onBack?: () => void;
}
