import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FullScreenModal({
  visible,
  onRequestClose,
  children,
  animationType = 'fade',
  backdropStyle,
  contentContainerStyle,
  dismissOnBackdrop = true,
  statusBarTranslucent = true,
}) {
  const insets = useSafeAreaInsets();

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onRequestClose}
      statusBarTranslucent={statusBarTranslucent}
    >
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }, backdropStyle]}>
        {dismissOnBackdrop ? <Pressable style={StyleSheet.absoluteFillObject} onPress={onRequestClose} /> : null}
        <View style={[styles.contentContainer, contentContainerStyle]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 14, 11, 0.46)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
