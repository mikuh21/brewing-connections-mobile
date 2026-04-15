import { StyleSheet, Text } from 'react-native';
import { ScreenContainer, SectionCard } from '../../components';
import theme from '../../theme';

export default function MarketplaceScreen() {
	return (
		<ScreenContainer>
			<Text style={styles.title}>Marketplace</Text>
			<SectionCard
				title="Fresh Batangas Beans"
				description="500g single-origin arabica from partner farms in Lipa."
				footer="PHP 480"
			/>
			<SectionCard
				title="Cold Brew Starter Kit"
				description="Includes dripper, reusable filter, and local roasted beans."
				footer="PHP 1,250"
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
