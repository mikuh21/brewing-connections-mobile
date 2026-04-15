import { StyleSheet, Text } from 'react-native';
import { ScreenContainer, SectionCard } from '../../components';
import theme from '../../theme';

export default function MessagesScreen() {
	return (
		<ScreenContainer>
			<Text style={styles.title}>Messages</Text>
			<SectionCard
				title="Lipa Roasters Cooperative"
				description="Your reserved beans are ready for pickup tomorrow."
				footer="2h ago"
			/>
			<SectionCard
				title="Cafe Poblacion Lipa"
				description="Thanks for your review. Enjoy 10% on your next order."
				footer="Yesterday"
			/>
		</ScreenContainer>
	);
}

const styles = StyleSheet.create({
	title: {
		fontSize: theme.fontSizes.xl,
		fontWeight: '700',
		color: theme.colors.sidebar,
		marginBottom: theme.spacing.md,
		fontFamily: theme.fonts.display,
	},
});
