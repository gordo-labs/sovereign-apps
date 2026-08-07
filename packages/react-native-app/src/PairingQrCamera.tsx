import React from 'react';
import { CameraScreen } from 'react-native-camera-kit';

export type PairingQrCameraProps = {
  onScan: (value: string) => void;
  onCancel?: () => void;
};

/**
 * Minimal host example. Install/link `react-native-camera-kit` in the native
 * app and request camera permission before rendering this component.
 */
export function PairingQrCamera({ onScan, onCancel }: PairingQrCameraProps): React.JSX.Element {
  return (
    <CameraScreen
      scanBarcode
      showFrame
      onReadCode={(event: { nativeEvent?: { codeStringValue?: string } }) => {
        const value = event.nativeEvent?.codeStringValue?.trim();
        if (value) onScan(value);
      }}
      onBottomButtonPressed={onCancel ? () => onCancel() : undefined}
    />
  );
}
