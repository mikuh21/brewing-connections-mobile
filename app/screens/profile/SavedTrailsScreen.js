import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer, SectionCard } from '../../components';
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

export default function SavedTrailsScreen({ navigation }) {
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
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={18} color="#3A2E22" />
          <Text style={styles.backText}>Profile</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Saved Trails</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 6,
  },
  backText: {
    color: '#3A2E22',
    fontFamily: theme.fonts.body,
    fontWeight: '600',
    fontSize: 13,
  },
  headerTitle: {
    fontSize: theme.fontSizes.xl,
    fontWeight: '700',
    color: theme.colors.sidebar,
    fontFamily: theme.fonts.display,
  },
  scrollContent: {
    paddingBottom: theme.spacing.lg,
  },
});