export interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (uri: string) => void;
}
