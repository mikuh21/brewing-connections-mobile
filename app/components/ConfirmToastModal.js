import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export default function ConfirmToastModal({
	visible,
	title,
	message,
	onCancel,
	onConfirm,
	cancelLabel = 'No',
	confirmLabel = 'Yes',
}) {
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const translateY = useRef(new Animated.Value(24)).current;

	useEffect(() => {
		if (visible) {
			Animated.parallel([
				Animated.timing(fadeAnim, {
					toValue: 1,
					duration: 180,
					useNativeDriver: true,
				}),
				Animated.spring(translateY, {
					toValue: 0,
					friction: 8,
					tension: 70,
					useNativeDriver: true,
				}),
			]).start();
			return;
		}

		fadeAnim.setValue(0);
		translateY.setValue(24);
	}, [visible, fadeAnim, translateY]);

	return (
		<Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
			<View style={styles.overlay}>
				<Pressable style={StyleSheet.absoluteFillObject} onPress={onCancel} />
				<Animated.View
					style={[
						styles.toastCard,
						{ opacity: fadeAnim, transform: [{ translateY }] },
					]}
				>
					<Text style={styles.title}>{title}</Text>
					{message ? <Text style={styles.message}>{message}</Text> : null}
					<View style={styles.actionRow}>
						<Pressable style={styles.cancelButton} onPress={onCancel}>
							<Text style={styles.cancelText}>{cancelLabel}</Text>
						</Pressable>
						<Pressable style={styles.confirmButton} onPress={onConfirm}>
							<Text style={styles.confirmText}>{confirmLabel}</Text>
						</Pressable>
					</View>
				</Animated.View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0,0,0,0.22)',
		padding: 14,
		paddingBottom: 24,
	},
	toastCard: {
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#D7CFC4',
		backgroundColor: '#FFFDF9',
		paddingHorizontal: 14,
		paddingTop: 14,
		paddingBottom: 12,
		shadowColor: '#000000',
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.14,
		shadowRadius: 14,
		elevation: 7,
	},
	title: {
		color: '#2D4A1E',
		fontFamily: 'PoppinsBold',
		fontSize: 15,
		lineHeight: 20,
	},
	message: {
		marginTop: 6,
		color: '#6B7280',
		fontFamily: 'PoppinsRegular',
		fontSize: 13,
		lineHeight: 18,
	},
	actionRow: {
		marginTop: 12,
		flexDirection: 'row',
		gap: 8,
	},
	cancelButton: {
		flex: 1,
		minHeight: 40,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#D7CFC4',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#FFFFFF',
	},
	cancelText: {
		color: '#4B5563',
		fontFamily: 'PoppinsMedium',
		fontSize: 13,
		lineHeight: 17,
	},
	confirmButton: {
		flex: 1,
		minHeight: 40,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#2D4A1E',
	},
	confirmText: {
		color: '#FFFFFF',
		fontFamily: 'PoppinsBold',
		fontSize: 13,
		lineHeight: 17,
	},
});