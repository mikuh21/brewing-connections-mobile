import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components';
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

function formatDistance(kmValue) {
  return `${Math.max(0, Number(kmValue) || 0).toFixed(1)} km`;
}

function formatAddressWithBarangay(address, barangay) {
  const baseAddress = String(address || 'Address not available').trim();
  const normalizedBarangay = String(barangay || '').trim();

  if (!normalizedBarangay) {
    return baseAddress;
  }

  if (baseAddress.toLowerCase().includes(normalizedBarangay.toLowerCase())) {
    return baseAddress;
  }

  return `${baseAddress}, ${normalizedBarangay}`;
}

function getTypeLabel(type) {
  const key = String(type || '').toLowerCase();
  if (!key) {
    return 'Establishment';
  }

  return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

export default function SavedTrailsScreen({ navigation }) {
  const [savedTrails, setSavedTrails] = useState([]);

  const handleUnsaveTrail = async (trailIndex) => {
    const next = savedTrails.filter((_, index) => index !== trailIndex);
    setSavedTrails(next);

    try {
      await AsyncStorage.setItem(SAVED_TRAILS_KEY, JSON.stringify(next));
    } catch {
      // Keep UI responsive even when local save fails.
    }
  };

  const handleNavigateAgain = (trail) => {
    const trailStops = Array.isArray(trail?.trailStops) ? trail.trailStops : [];
    if (!trailStops.length) {
      return;
    }

    navigation.navigate('Map', {
      trailStops,
      trailOrigin: trail?.trailOrigin || trail?.origin || null,
      isTrailMode: true,
    });
  };

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
        <Text style={styles.headerTitle}>Saved Trails</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={16} color={theme.colors.white} />
          <Text style={styles.backText}>Profile</Text>
        </Pressable>
      </View>
      <Text style={styles.headerSubtitle}>Review your saved routes</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {savedTrails.length ? (
          savedTrails.map((trail, index) => {
            const stopCount = Array.isArray(trail?.trailStops) ? trail.trailStops.length : 0;
            const distance = Number(trail?.trailTotals?.totalDistanceKm || 0);
            const eta = Number(trail?.trailTotals?.totalEtaMinutes || 0);
            const preferences = trail?.preferences || {};
            const trailStops = Array.isArray(trail?.trailStops) ? trail.trailStops : [];

            return (
              <View key={`${trail?.id || 'saved-trail'}-${index}`} style={styles.trailCard}>
                <View style={styles.trailCardHeader}>
                  <Text style={styles.trailCardTitle}>Trail {index + 1}</Text>
                  <Text style={styles.trailCardDate}>{formatDateLabel(trail?.savedAt)}</Text>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <MaterialIcons name="flag" size={14} color="#2D4A1E" />
                    <Text style={styles.metaText}>{stopCount} stop{stopCount === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialIcons name="directions-car" size={14} color="#2D4A1E" />
                    <Text style={styles.metaText}>{formatDistance(distance)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialIcons name="access-time" size={14} color="#2D4A1E" />
                    <Text style={styles.metaText}>{formatEta(eta)}</Text>
                  </View>
                </View>

                <View style={styles.preferencesWrap}>
                  <Text style={styles.preferencesTitle}>Preferences</Text>
                  <Text style={styles.preferencesText}>
                    Varieties: {(preferences?.varieties || []).length ? preferences.varieties.join(', ') : 'N/A'}
                  </Text>
                  <Text style={styles.preferencesText}>
                    Types: {(preferences?.types || []).length ? preferences.types.map(getTypeLabel).join(', ') : 'N/A'}
                  </Text>
                  <Text style={styles.preferencesText}>Max stops: {Number(preferences?.maxStops) || stopCount || 0}</Text>
                </View>

                <View style={styles.stopsWrap}>
                  {trailStops.map((stop, stopIndex) => (
                    <View key={`${trail?.id || 'trail'}-stop-${stop?.establishment_id || stopIndex}`} style={styles.stopRow}>
                      <View style={styles.stopBadge}>
                        <Text style={styles.stopBadgeText}>{stopIndex + 1}</Text>
                      </View>
                      <View style={styles.stopTextWrap}>
                        <Text style={styles.stopName}>{stop?.name || 'Coffee Stop'}</Text>
                        <Text style={styles.stopAddress}>{formatAddressWithBarangay(stop?.address, stop?.barangay)}</Text>
                        {stop?.why_recommended ? (
                          <Text style={styles.stopReason}>{stop.why_recommended}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.cardActionsRow}>
                  <Pressable style={[styles.cardActionButton, styles.unsaveButton]} onPress={() => handleUnsaveTrail(index)}>
                    <MaterialIcons name="bookmark-remove" size={14} color="#A33939" />
                    <Text style={styles.unsaveButtonText}>Unsave</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.cardActionButton, styles.navigateAgainButton]}
                    onPress={() => handleNavigateAgain(trail)}
                    disabled={!trailStops.length}
                  >
                    <MaterialIcons name="navigation" size={14} color="#FFFFFF" />
                    <Text style={styles.navigateAgainButtonText}>Navigate Again</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <MaterialIcons name="route" size={22} color="#2D4A1E" />
            <Text style={styles.emptyTitle}>No saved trails yet</Text>
            <Text style={styles.emptyDescription}>Generate a trail and tap Save Trail to keep it here.</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    marginBottom: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: '#2D4A1E',
  },
  backText: {
    color: theme.colors.white,
    fontFamily: 'PoppinsMedium',
    fontSize: theme.fontSizes.sm,
  },
  headerTitle: {
    fontSize: theme.fontSizes.xl,
    fontWeight: '700',
    color: theme.colors.sidebar,
    fontFamily: 'PoppinsBold',
  },
  headerSubtitle: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
    fontFamily: 'PoppinsRegular',
  },
  scrollContent: {
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  trailCard: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: '#D7CFC4',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  trailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  trailCardTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 17,
  },
  trailCardDate: {
    color: '#826D54',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#D8CCBE',
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F9F4EC',
  },
  metaText: {
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
  },
  preferencesWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5DDD2',
    borderRadius: 10,
    backgroundColor: '#FFFCF8',
    padding: 10,
    gap: 4,
  },
  preferencesTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
  },
  preferencesText: {
    color: '#6B5B4A',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 16,
  },
  stopsWrap: {
    marginTop: 10,
    gap: 8,
  },
  stopRow: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5DDD2',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  stopBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
  },
  stopTextWrap: {
    flex: 1,
    gap: 3,
  },
  stopName: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
  },
  stopAddress: {
    color: '#6B5B4A',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
  },
  stopReason: {
    color: '#826D54',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  cardActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  cardActionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  unsaveButton: {
    borderColor: 'rgba(163, 57, 57, 0.35)',
    backgroundColor: 'rgba(163, 57, 57, 0.10)',
  },
  unsaveButtonText: {
    color: '#A33939',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
  },
  navigateAgainButton: {
    borderColor: '#2D4A1E',
    backgroundColor: '#2D4A1E',
  },
  navigateAgainButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
  },
  emptyCard: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#D7CFC4',
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 15,
  },
  emptyDescription: {
    color: '#826D54',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    textAlign: 'center',
  },
});