export interface EmailGateSheetProps {
  /** Whether the bottom sheet is visible. */
  visible:   boolean;
  /**
   * Called after the user successfully links their email.
   * The caller should then proceed with the queued IAP purchase.
   */
  onLinked:  () => void;
  /** Called when the user taps Cancel or dismisses the sheet. */
  onDismiss: () => void;
}
