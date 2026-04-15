import { useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { ScreenContainer } from '../../components';
import { useAuth } from '../../context';
import theme from '../../theme';

export default function AuthScreen() {
	const { signIn } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const handleSubmit = async () => {
		setLoading(true);
		setError('');

		try {
			await signIn({ email, password });
		} catch (submitError) {
			setError(submitError.message || 'Unable to sign in.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<ScreenContainer>
			<View style={styles.container}>
				<Text style={styles.title}>BrewHub</Text>
				<Text style={styles.subtitle}>
					Discover coffee farms, cafes, and resellers in Lipa City.
				</Text>

				<TextInput
					style={styles.input}
					placeholder="Email"
					autoCapitalize="none"
					keyboardType="email-address"
					value={email}
					onChangeText={setEmail}
				/>
				<TextInput
					style={styles.input}
					placeholder="Password"
					secureTextEntry
					value={password}
					onChangeText={setPassword}
				/>

				{error ? <Text style={styles.error}>{error}</Text> : null}

				<Pressable
					disabled={loading || !email || !password}
					onPress={handleSubmit}
					style={({ pressed }) => [
						styles.button,
						(loading || !email || !password) && styles.buttonDisabled,
						pressed && styles.buttonPressed,
					]}
				>
					{loading ? (
						<ActivityIndicator color={theme.colors.white} />
					) : (
						<Text style={styles.buttonText}>Sign In</Text>
					)}
				</Pressable>
			</View>
		</ScreenContainer>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		gap: theme.spacing.sm,
	},
	title: {
		fontSize: 36,
		fontWeight: '800',
		color: theme.colors.primary,
		fontFamily: theme.fonts.display,
	},
	subtitle: {
		fontSize: theme.fontSizes.md,
		color: theme.colors.textMuted,
		marginBottom: theme.spacing.md,
		fontFamily: theme.fonts.body,
	},
	input: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.borderRadius.md,
		backgroundColor: theme.colors.white,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		fontSize: theme.fontSizes.md,
		fontFamily: theme.fonts.body,
	},
	button: {
		marginTop: theme.spacing.sm,
		backgroundColor: theme.colors.primary,
		borderRadius: theme.borderRadius.md,
		paddingVertical: theme.spacing.sm,
		alignItems: 'center',
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonPressed: {
		opacity: 0.85,
	},
	buttonText: {
		color: theme.colors.white,
		fontSize: theme.fontSizes.md,
		fontWeight: '700',
		fontFamily: theme.fonts.body,
	},
	error: {
		color: theme.colors.accentGold,
		fontSize: theme.fontSizes.sm,
		fontFamily: theme.fonts.body,
	},
});
