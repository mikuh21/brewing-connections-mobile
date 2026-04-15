import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ScreenContainer, SectionCard } from '../../components';
import { useAuth } from '../../context';
import theme from '../../theme';

const SAVED_TRAILS_KEY = 'saved_coffee_trails';

function formatDateLabel(isoDate) {
  if (!isoDate) {
    return 'Saved recently';
  }

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'Saved recently';
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatEta(minutesValue) {
  const totalMinutes = Math.max(0, Math.round(Number(minutesValue) || 0));
  if (totalMinutes < 60) {
    return `${totalMinutes} mins`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }

  return `${hours} hr${hours > 1 ? 's' : ''} ${minutes} mins`;
}

export default function ProfileScreen() {
	const { user, signOut } = useAuth();
	const [savedTrails, setSavedTrails] = useState([]);

	useFocusEffect(
		useCallback(() => {
			let isMounted = true;

			const loadSavedTrails = async () => {
				try {
					const raw = await AsyncStorage.getItem(SAVED_TRAILS_KEY);
					const parsed = JSON.parse(raw || '[]');

					if (!isMounted) {
						return;
					}

					setSavedTrails(Array.isArray(parsed) ? parsed : []);
				} catch {
					if (!isMounted) {
						return;
					}
					setSavedTrails([]);
				}
			};

			loadSavedTrails();

			return () => {
				isMounted = false;
			};
		}, [])
	);

	return (
		<ScreenContainer>
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<Text style={styles.title}>Profile</Text>
				<SectionCard
					title={user?.name || 'Coffee Explorer'}
					description={user?.email || 'No email available'}
					footer="Lipa City, Batangas"
				/>

				<Text style={styles.sectionTitle}>Saved Trails</Text>
				{savedTrails.length ? (
					savedTrails.map((trail, index) => {
						const stopCount = Array.isArray(trail?.trailStops) ? trail.trailStops.length : 0;
						const distance = Number(trail?.trailTotals?.totalDistanceKm || 0);
						const eta = Number(trail?.trailTotals?.totalEtaMinutes || 0);

						return (
							<SectionCard
								key={`${trail?.id || 'saved-trail'}-${index}`}
								title={`Trail ${index + 1}: ${stopCount} stop${stopCount === 1 ? '' : 's'}`}
								description={`${distance.toFixed(1)} km • ${formatEta(eta)}`}
								footer={formatDateLabel(trail?.savedAt)}
							/>
						);
					})
				) : (
					<SectionCard
						title="No saved trails yet"
						description="Generate a trail and tap Save Trail to keep it here."
					/>
				)}

				<Pressable style={styles.signOutButton} onPress={signOut}>
					<Text style={styles.signOutText}>Sign Out</Text>
				</Pressable>
			</ScrollView>
		</ScreenContainer>
	);
}

const styles = StyleSheet.create({
	scrollContent: {
		paddingBottom: theme.spacing.lg,
	},
	title: {
		fontSize: theme.fontSizes.xl,
		fontWeight: '700',
		color: theme.colors.sidebar,
		marginBottom: theme.spacing.md,
		fontFamily: theme.fonts.display,
	},
	sectionTitle: {
		marginTop: theme.spacing.sm,
		marginBottom: theme.spacing.sm,
		fontSize: theme.fontSizes.lg,
		fontWeight: '700',
		color: theme.colors.sidebar,
		fontFamily: theme.fonts.display,
	},
	signOutButton: {
		marginTop: theme.spacing.md,
		backgroundColor: theme.colors.accentGold,
		borderRadius: theme.borderRadius.md,
		alignItems: 'center',
		paddingVertical: theme.spacing.sm,
	},
	signOutText: {
		color: theme.colors.white,
		fontWeight: '700',
		fontSize: theme.fontSizes.md,
		fontFamily: theme.fonts.body,
	},
});
