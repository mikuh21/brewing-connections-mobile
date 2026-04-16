import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import { getCoffeeTrail, getCoffeeTrailHistory } from '../../services';

const VARIETY_OPTIONS = ['Liberica', 'Excelsa', 'Robusta', 'Arabica'];
const TYPE_OPTIONS = [
  { label: 'Farms', value: 'farm' },
  { label: 'Cafes', value: 'cafe' },
  { label: 'Roasters', value: 'roaster' },
  { label: 'Resellers', value: 'reseller' },
];

const COLORS = {
  bg: '#F5F0E8',
  card: '#FFFFFF',
  primary: '#2D4A1E',
  text: '#1C1C1C',
  muted: '#6B7280',
  accent: '#C8973A',
  border: '#D7CFC4',
};

const TRAIL_RESET_SIGNAL_KEY = 'trail_reset_signal_at';
const SAVED_TRAILS_KEY = 'saved_coffee_trails';
const TRAIL_TABS = {
  GENERATE: 'generate',
  HISTORY: 'history',
};

function getTrailSignature({ trailStops, trailOrigin, preferences }) {
  const stopPart = (Array.isArray(trailStops) ? trailStops : [])
    .map((stop) => `${stop?.establishment_id ?? stop?.id ?? ''}:${stop?.latitude ?? ''}:${stop?.longitude ?? ''}`)
    .join('|');
  const originPart = trailOrigin
    ? `${trailOrigin.latitude ?? ''},${trailOrigin.longitude ?? ''}`
    : 'no-origin';
  const prefPart = `${(preferences?.varieties || []).join(',')}|${(preferences?.types || []).join(',')}|${
    preferences?.maxStops ?? ''
  }`;

  return `${originPart}::${prefPart}::${stopPart}`;
}

const TYPE_BADGE_THEME = {
  farm: { bg: 'rgba(45, 74, 30, 0.14)', border: 'rgba(45, 74, 30, 0.35)', text: '#2D4A1E' },
  cafe: { bg: 'rgba(139, 69, 19, 0.20)', border: 'rgba(139, 69, 19, 0.50)', text: '#6D3408' },
  roaster: { bg: 'rgba(200, 151, 58, 0.18)', border: 'rgba(160, 114, 18, 0.40)', text: '#8A5F0F' },
  reseller: { bg: 'rgba(30, 64, 175, 0.13)', border: 'rgba(30, 64, 175, 0.35)', text: '#1E40AF' },
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDistance(kmValue) {
  return `${toNumber(kmValue).toFixed(1)} km`;
}

function formatEta(minutesValue) {
  const totalMinutes = Math.max(0, Math.round(toNumber(minutesValue)));
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

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function estimateEtaMinutes(distanceKm) {
  const averageKph = 22;
  const minutes = (Math.max(0, distanceKm) / averageKph) * 60;
  return Math.max(1, Math.round(minutes));
}

function withLegMetrics(stops, origin) {
  if (!Array.isArray(stops) || !stops.length || !origin) {
    return stops;
  }

  return stops.map((stop, index) => {
    const fromPoint =
      index === 0
        ? origin
        : {
            latitude: toNumber(stops[index - 1]?.latitude, 0),
            longitude: toNumber(stops[index - 1]?.longitude, 0),
          };

    const computedDistance = getDistanceKm(
      toNumber(fromPoint.latitude, 0),
      toNumber(fromPoint.longitude, 0),
      toNumber(stop.latitude, 0),
      toNumber(stop.longitude, 0)
    );

    const fallbackDistance = Number.isFinite(computedDistance) ? computedDistance : 0;
    const nextDistance = fallbackDistance;
    const nextEta = estimateEtaMinutes(nextDistance);

    return {
      ...stop,
      distance_km: nextDistance,
      eta_minutes: nextEta,
    };
  });
}

function normalizeTrailResponse(response) {
  const list = Array.isArray(response)
    ? response
    : response?.stops || response?.trail || response?.data || [];

  if (!Array.isArray(list)) {
    return {
      stops: [],
      totalDistanceKm: toNumber(response?.total_distance_km, 0),
      totalEtaMinutes: toNumber(response?.total_duration_min, 0),
    };
  }

  const stops = list
    .map((stop, index) => {
      const source = stop?.properties || stop;
      const raw = source?.raw || stop?.raw || {};
      const barangay =
        source?.barangay ||
        source?.barangay_name ||
        source?.barangayName ||
        source?.brgy ||
        raw?.barangay ||
        raw?.barangay_name ||
        raw?.barangayName ||
        raw?.brgy ||
        stop?.barangay ||
        stop?.barangay_name ||
        stop?.barangayName ||
        stop?.brgy ||
        '';

      return {
        establishment_id: source?.establishment_id ?? source?.id ?? stop?.id ?? index,
        name: source?.name || stop?.name || 'Coffee Stop',
        type: String(source?.type || stop?.type || 'establishment').toLowerCase(),
        address: source?.address || stop?.address || 'Address not available',
        barangay,
        latitude: toNumber(source?.latitude ?? stop?.latitude, 0),
        longitude: toNumber(source?.longitude ?? stop?.longitude, 0),
        distance_km: toNumber(source?.distance_km ?? source?.distance ?? stop?.distance_km ?? stop?.distance, 0),
        eta_minutes: toNumber(source?.eta_minutes ?? source?.eta ?? stop?.eta_minutes ?? stop?.eta, 0),
        why_recommended:
          source?.why_recommended ||
          stop?.why_recommended ||
          'Recommended based on your trail preferences.',
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km);

  return {
    stops,
    totalDistanceKm: toNumber(response?.total_distance_km, 0),
    totalEtaMinutes: toNumber(response?.total_duration_min, 0),
  };
}

function normalizeTrailHistoryResponse(response) {
  const rawHistory = Array.isArray(response)
    ? response
    : response?.history || response?.data || [];

  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory
    .map((trailItem, index) => {
      const normalized = normalizeTrailResponse(trailItem);
      const preferences = trailItem?.preferences || {};
      return {
        trailId: trailItem?.trail_id || trailItem?.id || `trail-${index}`,
        createdAt: trailItem?.created_at || trailItem?.savedAt || null,
        origin: {
          latitude: toNumber(trailItem?.origin?.latitude ?? trailItem?.trailOrigin?.latitude, 0),
          longitude: toNumber(trailItem?.origin?.longitude ?? trailItem?.trailOrigin?.longitude, 0),
        },
        preferences: {
          varieties: Array.isArray(preferences?.varieties) ? preferences.varieties : [],
          types: Array.isArray(preferences?.types) ? preferences.types : [],
          maxStops: toNumber(preferences?.max_stops ?? preferences?.maxStops, 0),
        },
        stops: normalized.stops,
        totalDistanceKm: normalized.totalDistanceKm,
        totalEtaMinutes: normalized.totalEtaMinutes,
      };
    })
    .filter((item) => item.stops.length > 0);
}

function formatTrailTimestamp(dateValue) {
  if (!dateValue) {
    return 'Unknown date';
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTypeBadge(type) {
  const key = String(type || '').toLowerCase();
  if (!key) {
    return 'Establishment';
  }
  return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

function getTypeBadgeTheme(type) {
  return TYPE_BADGE_THEME[String(type || '').toLowerCase()] || {
    bg: 'rgba(90, 72, 54, 0.13)',
    border: 'rgba(90, 72, 54, 0.30)',
    text: '#5A4836',
  };
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

export default function CoffeeTrailScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(TRAIL_TABS.GENERATE);
  const [step, setStep] = useState(1);
  const [selectedVarieties, setSelectedVarieties] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [maxStops, setMaxStops] = useState(2);
  const [trailData, setTrailData] = useState([]);
  const [trailTotals, setTrailTotals] = useState({ totalDistanceKm: 0, totalEtaMinutes: 0 });
  const [trailOrigin, setTrailOrigin] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingTrail, setIsSavingTrail] = useState(false);
  const [isTrailSaved, setIsTrailSaved] = useState(false);
  const [historyTrails, setHistoryTrails] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);
  const [historyErrorMessage, setHistoryErrorMessage] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const steamAnimA = useRef(new Animated.Value(0)).current;
  const steamAnimB = useRef(new Animated.Value(0)).current;
  const steamAnimC = useRef(new Animated.Value(0)).current;
  const [dotCount, setDotCount] = useState(1);
  const isGenerateDisabled =
    isGenerating || (selectedVarieties.length === 0 && selectedTypes.length === 0);
  const lastHandledResetSignalRef = useRef('');

  const clearGeneratedTrailState = () => {
    resetPreferences();
    setStep(1);
    setTrailData([]);
    setTrailOrigin(null);
    setTrailTotals({ totalDistanceKm: 0, totalEtaMinutes: 0 });
    setIsTrailSaved(false);
    setErrorMessage('');
  };

  useFocusEffect(
    useMemo(
      () => () => {
        let isActive = true;

        const consumeResetSignal = async () => {
          try {
            const resetSignal = await AsyncStorage.getItem(TRAIL_RESET_SIGNAL_KEY);
            if (!isActive || !resetSignal) {
              return;
            }

            if (resetSignal === lastHandledResetSignalRef.current) {
              return;
            }

            lastHandledResetSignalRef.current = resetSignal;
            clearGeneratedTrailState();
          } catch {
            // Keep trail screen usable even when reset-signal read fails.
          }
        };

        void consumeResetSignal();

        return () => {
          isActive = false;
        };
      },
      []
    )
  );

  useEffect(() => {
    if (step !== 2) {
      pulseAnim.setValue(1);
      steamAnimA.setValue(0);
      steamAnimB.setValue(0);
      steamAnimC.setValue(0);
      return undefined;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();

    const steamLoopA = Animated.loop(
      Animated.sequence([
        Animated.timing(steamAnimA, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(steamAnimA, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ])
    );

    const steamLoopB = Animated.loop(
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(steamAnimB, {
          toValue: 1,
          duration: 980,
          useNativeDriver: true,
        }),
        Animated.timing(steamAnimB, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ])
    );

    const steamLoopC = Animated.loop(
      Animated.sequence([
        Animated.delay(380),
        Animated.timing(steamAnimC, {
          toValue: 1,
          duration: 1040,
          useNativeDriver: true,
        }),
        Animated.timing(steamAnimC, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ])
    );

    steamLoopA.start();
    steamLoopB.start();
    steamLoopC.start();

    const dotTimer = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 350);

    return () => {
      pulseLoop.stop();
      steamLoopA.stop();
      steamLoopB.stop();
      steamLoopC.stop();
      clearInterval(dotTimer);
    };
  }, [step, pulseAnim, steamAnimA, steamAnimB, steamAnimC]);

  const trailSummary = useMemo(() => {
    if (!trailData.length) {
      return {
        totalStops: 0,
        totalDistanceKm: trailTotals.totalDistanceKm,
        totalEtaMinutes: trailTotals.totalEtaMinutes,
      };
    }

    const computedDistance = trailData.reduce((sum, stop) => sum + toNumber(stop.distance_km), 0);
    const computedEta = trailData.reduce((sum, stop) => sum + toNumber(stop.eta_minutes), 0);

    return {
      totalStops: trailData.length,
      totalDistanceKm: trailTotals.totalDistanceKm > 0 ? trailTotals.totalDistanceKm : computedDistance,
      totalEtaMinutes: trailTotals.totalEtaMinutes > 0 ? trailTotals.totalEtaMinutes : computedEta,
    };
  }, [trailData, trailTotals]);

  const loadTrailHistory = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setIsHistoryRefreshing(true);
      } else {
        setIsHistoryLoading(true);
      }

      setHistoryErrorMessage('');

      try {
        const response = await getCoffeeTrailHistory();
        const normalizedHistory = normalizeTrailHistoryResponse(response);
        setHistoryTrails(normalizedHistory);
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401) {
          setHistoryErrorMessage('Session expired. Please log in again to view trail history.');
        } else {
          setHistoryErrorMessage(
            error?.response?.data?.message || 'Unable to load your trail history right now.'
          );
        }
      } finally {
        setIsHistoryLoading(false);
        setIsHistoryRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab === TRAIL_TABS.HISTORY) {
      loadTrailHistory();
    }
  }, [activeTab, loadTrailHistory]);

  const togglePill = (value, current, setCurrent) => {
    const exists = current.includes(value);
    if (exists) {
      setCurrent(current.filter((item) => item !== value));
      return;
    }
    setCurrent([...current, value]);
  };

  const generateTrail = async (requestData) => {
    setErrorMessage('');
    setIsGenerating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert(
          'Location Permission Needed',
          'Please enable location access in your device settings to generate a coffee trail.'
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const payload = {
        varieties: requestData.varieties,
        types: requestData.types,
        max_stops: requestData.maxStops,
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      };

      setStep(2);

      const response = await getCoffeeTrail(payload);
      const normalized = normalizeTrailResponse(response);

      if (!normalized.stops.length) {
        throw new Error('No trail stops returned.');
      }

      const stopsWithLegMetrics = withLegMetrics(normalized.stops, {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      setTrailOrigin({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      setTrailData(stopsWithLegMetrics);
      setTrailTotals({
        totalDistanceKm: normalized.totalDistanceKm,
        totalEtaMinutes: normalized.totalEtaMinutes,
      });

      const trailSignature = getTrailSignature({
        trailStops: stopsWithLegMetrics,
        trailOrigin: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        },
        preferences: {
          varieties: selectedVarieties,
          types: selectedTypes,
          maxStops,
        },
      });

      try {
        const existingRaw = await AsyncStorage.getItem(SAVED_TRAILS_KEY);
        const existingParsed = JSON.parse(existingRaw || '[]');
        const existing = Array.isArray(existingParsed) ? existingParsed : [];
        const alreadySaved = existing.some((item) => {
          const itemSignature =
            item?.signature ||
            getTrailSignature({
              trailStops: item?.trailStops,
              trailOrigin: item?.trailOrigin,
              preferences: item?.preferences,
            });
          return itemSignature === trailSignature;
        });
        setIsTrailSaved(alreadySaved);
      } catch {
        setIsTrailSaved(false);
      }

      const normalizedHistoryEntry = normalizeTrailHistoryResponse({
        history: [
          {
            ...response,
            stops: stopsWithLegMetrics,
          },
        ],
      })[0];

      if (normalizedHistoryEntry) {
        setHistoryTrails((prev) => {
          const next = [normalizedHistoryEntry, ...prev.filter((item) => item.trailId !== normalizedHistoryEntry.trailId)];
          return next.slice(0, 30);
        });
      }

      setStep(3);
    } catch (error) {
      setStep(1);
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.errors)
          ? error.response.data.errors.join(', ')
          : null) ||
        error?.message ||
        null;

      if (status === 401) {
        setErrorMessage('Session expired. Please log in again, then generate your trail.');
      } else {
        setErrorMessage(message || 'We could not generate your trail right now. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const onGeneratePress = () => {
    const hasVariety = selectedVarieties.length > 0;
    const hasType = selectedTypes.length > 0;

    if (!hasVariety && !hasType) {
      setErrorMessage('Pick at least 1 coffee variety and visit type.');
      return;
    }

    if (!hasVariety) {
      setErrorMessage('Pick at least 1 coffee variety.');
      return;
    }

    if (!hasType) {
      setErrorMessage('Pick at least 1 visit type.');
      return;
    }

    generateTrail({
      varieties: selectedVarieties,
      types: selectedTypes,
      maxStops,
    });
  };

  const tabSwitch = (
    <View style={styles.tabSwitchWrap}>
      <Pressable
        style={[styles.tabSwitchItem, activeTab === TRAIL_TABS.GENERATE && styles.tabSwitchItemActive]}
        onPress={() => setActiveTab(TRAIL_TABS.GENERATE)}
      >
        <Text
          style={[
            styles.tabSwitchText,
            activeTab === TRAIL_TABS.GENERATE && styles.tabSwitchTextActive,
          ]}
        >
          Generate Trail
        </Text>
      </Pressable>
      <Pressable
        style={[styles.tabSwitchItem, activeTab === TRAIL_TABS.HISTORY && styles.tabSwitchItemActive]}
        onPress={() => setActiveTab(TRAIL_TABS.HISTORY)}
      >
        <Text
          style={[
            styles.tabSwitchText,
            activeTab === TRAIL_TABS.HISTORY && styles.tabSwitchTextActive,
          ]}
        >
          Trail History
        </Text>
      </Pressable>
    </View>
  );

  const resetPreferences = () => {
    setSelectedVarieties([]);
    setSelectedTypes([]);
    setMaxStops(2);
    setErrorMessage('');
  };

  const handleNavigateTrail = async () => {
    try {
      await AsyncStorage.removeItem(TRAIL_RESET_SIGNAL_KEY);
    } catch {
      // Do not block navigation when reset-signal cleanup fails.
    }

    navigation.navigate('Map', {
      trailStops: trailData,
      trailOrigin,
      isTrailMode: true,
    });
  };

  const handleSaveTrail = async () => {
    if (!trailData.length || isSavingTrail || isTrailSaved) {
      return;
    }

    setIsSavingTrail(true);
    setErrorMessage('');

    try {
      const signature = getTrailSignature({
        trailStops: trailData,
        trailOrigin,
        preferences: {
          varieties: selectedVarieties,
          types: selectedTypes,
          maxStops,
        },
      });

      const snapshot = {
        id: Date.now().toString(),
        savedAt: new Date().toISOString(),
        signature,
        trailStops: trailData,
        trailTotals,
        trailOrigin,
        preferences: {
          varieties: selectedVarieties,
          types: selectedTypes,
          maxStops,
        },
      };

      const existingRaw = await AsyncStorage.getItem(SAVED_TRAILS_KEY);
      const parsed = JSON.parse(existingRaw || '[]');
      const existing = Array.isArray(parsed) ? parsed : [];

      const withoutCurrent = existing.filter((item) => {
        const itemSignature =
          item?.signature ||
          getTrailSignature({
            trailStops: item?.trailStops,
            trailOrigin: item?.trailOrigin,
            preferences: item?.preferences,
          });
        return itemSignature !== signature;
      });

      const next = [snapshot, ...withoutCurrent].slice(0, 20);
      await AsyncStorage.setItem(SAVED_TRAILS_KEY, JSON.stringify(next));
      setIsTrailSaved(true);
    } catch {
      setErrorMessage('Unable to save trail right now. Please try again.');
    } finally {
      setIsSavingTrail(false);
    }
  };

  if (activeTab === TRAIL_TABS.HISTORY) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.historyContainer}>
          <View style={styles.historyTopRow}>
            <Text style={styles.title}>Your Trail History</Text>
            <Pressable
              style={styles.historyRefreshIconButton}
              onPress={() => loadTrailHistory({ silent: true })}
              disabled={isHistoryRefreshing}
            >
              {isHistoryRefreshing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <MaterialIcons name="refresh" size={18} color={COLORS.primary} />
              )}
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Every generated trail is saved here with recommendations</Text>
          {tabSwitch}

          {isHistoryLoading ? (
            <View style={styles.historyLoadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.historyLoadingText}>Loading saved trails...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.historyList}
              contentContainerStyle={styles.historyListContent}
              showsVerticalScrollIndicator={false}
            >
              {historyErrorMessage ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Unable to load history</Text>
                  <Text style={styles.errorText}>{historyErrorMessage}</Text>
                </View>
              ) : null}

              {!historyErrorMessage && historyTrails.length === 0 ? (
                <View style={styles.emptyHistoryCard}>
                  <MaterialIcons name="history" size={24} color={COLORS.primary} />
                  <Text style={styles.emptyHistoryTitle}>No trails yet</Text>
                  <Text style={styles.emptyHistoryText}>Generate your first coffee trail to start building your history.</Text>
                </View>
              ) : null}

              {historyTrails.map((trailItem) => (
                <View key={trailItem.trailId} style={styles.historyCard}>
                  <View style={styles.historyHeaderRow}>
                    <Text style={styles.historyCardTitle}>{trailItem.stops.length} Stops</Text>
                    <Text style={styles.historyDate}>{formatTrailTimestamp(trailItem.createdAt)}</Text>
                  </View>

                  <View style={styles.historyMetaRow}>
                    <MaterialIcons name="directions-car" size={14} color={COLORS.primary} />
                    <Text style={styles.historyMetaText}>{formatDistance(trailItem.totalDistanceKm)} total</Text>
                  </View>
                  <View style={styles.historyMetaRow}>
                    <MaterialIcons name="access-time" size={14} color={COLORS.primary} />
                    <Text style={styles.historyMetaText}>{formatEta(trailItem.totalEtaMinutes)}</Text>
                  </View>

                  <View style={styles.historyStopsWrap}>
                    {trailItem.stops.map((stop, index) => (
                      <View key={`${trailItem.trailId}-${stop.establishment_id}-${index}`} style={styles.historyStopRow}>
                        <Text style={styles.historyStopName}>{index + 1}. {stop.name}</Text>
                        <Text style={styles.historyStopReason}>{stop.why_recommended}</Text>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    style={styles.historyMapButton}
                    onPress={() =>
                      navigation.navigate('Map', {
                        trailStops: trailItem.stops,
                        trailOrigin: trailItem.origin,
                        isTrailMode: true,
                      })
                    }
                  >
                    <Text style={styles.historyMapButtonText}>Open Trail on Map</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 2) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <View style={styles.loadingCupWrap}>
          <Animated.View
            style={[
              styles.steamLine,
              {
                opacity: steamAnimA,
                transform: [
                  {
                    translateY: steamAnimA.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, -18],
                    }),
                  },
                  {
                    translateX: steamAnimA.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-6, -11],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.steamLine,
              styles.steamLineCenter,
              {
                opacity: steamAnimB,
                transform: [
                  {
                    translateY: steamAnimB.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, -20],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.steamLine,
              styles.steamLineRight,
              {
                opacity: steamAnimC,
                transform: [
                  {
                    translateY: steamAnimC.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, -17],
                    }),
                  },
                  {
                    translateX: steamAnimC.interpolate({
                      inputRange: [0, 1],
                      outputRange: [6, 11],
                    }),
                  },
                ],
              },
            ]}
          />

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <MaterialIcons name="local-cafe" size={62} color={COLORS.primary} />
          </Animated.View>
        </View>
        <Text style={styles.loadingTitle}>Brewing your perfect trail...</Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((idx) => (
            <Text key={idx} style={[styles.dot, { opacity: dotCount > idx ? 1 : 0.2 }]}>.
            </Text>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 3) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.resultsScreenContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTop}>{trailSummary.totalStops} Stops</Text>
            <View style={styles.distanceMetaRow}>
              <MaterialIcons name="directions-car" size={14} color="#FFFFFF" />
              <Text style={styles.summaryLine}>{trailSummary.totalDistanceKm.toFixed(1)} km total</Text>
            </View>
            <View style={styles.distanceMetaRow}>
              <MaterialIcons name="access-time" size={14} color="#FFFFFF" />
              <Text style={styles.summaryLine}>{formatEta(trailSummary.totalEtaMinutes)}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.resultsList}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
          >
            {trailData.map((stop, index) => (
              <View key={`${stop.establishment_id}-${index}`} style={styles.stopCard}>
                <View style={styles.stopHeader}>
                  <View style={styles.stopNumberBadge}>
                    <Text style={styles.stopNumberText}>{index + 1}</Text>
                  </View>

                  <View style={styles.stopHeaderTextWrap}>
                    <Text style={styles.stopName}>{stop.name}</Text>
                    <View
                      style={[
                        styles.typeBadge,
                        {
                          backgroundColor: getTypeBadgeTheme(stop.type).bg,
                          borderColor: getTypeBadgeTheme(stop.type).border,
                        },
                      ]}
                    >
                      <Text style={[styles.typeBadgeText, { color: getTypeBadgeTheme(stop.type).text }]}>
                        {getTypeBadge(stop.type)}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.stopAddress}>{formatAddressWithBarangay(stop.address, stop.barangay)}</Text>

                <View style={styles.distanceMetaRow}>
                  <MaterialIcons name="directions-car" size={14} color={COLORS.primary} />
                  <Text style={styles.metaText}>
                    {index === 0
                      ? `${formatDistance(stop.distance_km)} from your location`
                      : `${formatDistance(stop.distance_km)} from previous stop`}
                  </Text>
                </View>
                <View style={styles.distanceMetaRow}>
                  <MaterialIcons name="access-time" size={14} color={COLORS.primary} />
                  <Text style={styles.metaText}>
                    {index === 0
                      ? `${formatEta(stop.eta_minutes)} from your location`
                      : `${formatEta(stop.eta_minutes)} drive`}
                  </Text>
                </View>

                <Text style={styles.recommendText}>{stop.why_recommended}</Text>

                <View style={styles.separator} />

                <Pressable
                  style={styles.viewMapButton}
                  onPress={() =>
                    navigation.navigate('Map', {
                      highlightId: stop.establishment_id,
                    })
                  }
                >
                  <Text style={styles.viewMapButtonText}>View on Map</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actionsFooter}>
            <Pressable
              style={[styles.saveTrailButton, (isSavingTrail || isTrailSaved) && styles.saveTrailButtonDisabled]}
              onPress={handleSaveTrail}
              disabled={isSavingTrail || isTrailSaved}
            >
              <MaterialIcons name={isTrailSaved ? 'bookmark' : 'bookmark-border'} size={16} color={COLORS.primary} />
              <Text style={styles.saveTrailButtonText}>
                {isSavingTrail ? 'Saving Trail...' : isTrailSaved ? 'Saved' : 'Save Trail'}
              </Text>
            </Pressable>

            <View style={styles.bottomActions}>
              <Pressable
                style={[styles.bottomButton, styles.newTrailButton]}
                onPress={clearGeneratedTrailState}
              >
                <Text style={styles.newTrailButtonText}>Generate New Trail</Text>
              </Pressable>

              <Pressable style={[styles.bottomButton, styles.navigateTrailButton]} onPress={handleNavigateTrail}>
                <Text style={styles.navigateTrailButtonText}>Navigate Trail</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Generate Your Coffee Trail</Text>
        <Text style={styles.subtitle}>Discover Lipa's finest coffee spots</Text>
        {tabSwitch}

        <View style={styles.resetAllRow}>
          <Pressable style={styles.inlineResetButton} onPress={resetPreferences}>
            <Text style={styles.inlineResetButtonText}>Reset All</Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Coffee Varieties</Text>
            {selectedVarieties.length ? (
              <Pressable style={styles.inlineResetButton} onPress={() => setSelectedVarieties([])}>
                <Text style={styles.inlineResetButtonText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.pillsWrap}>
            {VARIETY_OPTIONS.map((item) => {
              const selected = selectedVarieties.includes(item);
              return (
                <Pressable
                  key={item}
                  style={[styles.pill, selected ? styles.pillSelected : styles.pillUnselected]}
                  onPress={() => togglePill(item, selectedVarieties, setSelectedVarieties)}
                >
                  <Text style={[styles.pillText, selected ? styles.pillTextSelected : styles.pillTextUnselected]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Visit Type</Text>
            {selectedTypes.length ? (
              <Pressable style={styles.inlineResetButton} onPress={() => setSelectedTypes([])}>
                <Text style={styles.inlineResetButtonText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.pillsWrap}>
            {TYPE_OPTIONS.map((item) => {
              const selected = selectedTypes.includes(item.value);
              return (
                <Pressable
                  key={item.value}
                  style={[styles.pill, selected ? styles.pillSelected : styles.pillUnselected]}
                  onPress={() => togglePill(item.value, selectedTypes, setSelectedTypes)}
                >
                  <Text style={[styles.pillText, selected ? styles.pillTextSelected : styles.pillTextUnselected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Number of Stops</Text>
            {maxStops !== 2 ? (
              <Pressable style={styles.inlineResetButton} onPress={() => setMaxStops(2)}>
                <Text style={styles.inlineResetButtonText}>Reset</Text>
              </Pressable>
            ) : null}
          </View>
          <Slider
            minimumValue={2}
            maximumValue={5}
            step={1}
            value={maxStops}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor="#D4C8B8"
            thumbTintColor={COLORS.accent}
            onValueChange={(value) => setMaxStops(value)}
          />
          <Text style={styles.maxStopsValue}>{maxStops}</Text>
        </View>

        <Pressable
          style={[styles.generateButton, isGenerateDisabled && styles.generateButtonDisabled]}
          onPress={onGeneratePress}
          disabled={isGenerateDisabled}
        >
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Generating...' : 'Generate My Trail'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  resultsScreenContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'PoppinsRegular',
  },
  tabSwitchWrap: {
    marginTop: 8,
    alignSelf: 'stretch',
    borderRadius: 999,
    padding: 3,
    backgroundColor: '#EDE3D4',
    borderWidth: 1,
    borderColor: '#D7CFC4',
    flexDirection: 'row',
    gap: 4,
  },
  tabSwitchItem: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabSwitchItemActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7CFC4',
  },
  tabSwitchText: {
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  tabSwitchTextActive: {
    color: '#2D4A1E',
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyRefreshIconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7CFC4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  historyLoadingText: {
    color: COLORS.primary,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'PoppinsMedium',
  },
  historyList: {
    marginTop: 12,
    flex: 1,
  },
  historyListContent: {
    paddingBottom: 16,
    gap: 10,
  },
  emptyHistoryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  emptyHistoryTitle: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 18,
    fontFamily: 'PoppinsBold',
  },
  emptyHistoryText: {
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'PoppinsRegular',
  },
  historyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 12,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  historyCardTitle: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'PoppinsBold',
  },
  historyDate: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'PoppinsRegular',
  },
  historyMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  historyMetaText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'PoppinsMedium',
  },
  historyStopsWrap: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2DACF',
    gap: 8,
  },
  historyStopRow: {
    gap: 2,
  },
  historyStopName: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PoppinsBold',
  },
  historyStopReason: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'PoppinsRegular',
  },
  historyMapButton: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyMapButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PoppinsBold',
  },
  errorCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8C9C9',
    backgroundColor: '#FFF4F4',
    padding: 12,
    gap: 6,
  },
  errorTitle: {
    color: '#8F2D2D',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'PoppinsBold',
  },
  errorText: {
    color: '#8F2D2D',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'PoppinsRegular',
  },
  section: {
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resetAllRow: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  inlineResetButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  inlineResetButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'PoppinsMedium',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'PoppinsBold',
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PoppinsMedium',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  pillTextUnselected: {
    color: COLORS.primary,
  },
  maxStopsValue: {
    marginTop: 6,
    textAlign: 'center',
    color: COLORS.primary,
    fontSize: 36,
    lineHeight: 42,
    fontFamily: 'PoppinsBold',
  },
  generateButton: {
    marginTop: 24,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'PoppinsBold',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  loadingCupWrap: {
    width: 96,
    height: 90,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  steamLine: {
    position: 'absolute',
    top: 8,
    width: 7,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(45, 74, 30, 0.36)',
  },
  steamLineCenter: {
    top: 4,
  },
  steamLineRight: {
    top: 8,
  },
  loadingTitle: {
    marginTop: 12,
    color: COLORS.primary,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'PoppinsBold',
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  dot: {
    color: COLORS.primary,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'PoppinsBold',
    marginHorizontal: 2,
  },
  summaryCard: {
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    padding: 14,
  },
  summaryTop: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'PoppinsBold',
  },
  summaryLine: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'PoppinsMedium',
  },
  distanceMetaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  resultsList: {
    marginTop: 12,
    flex: 1,
  },
  resultsContent: {
    paddingBottom: 12,
    gap: 10,
  },
  stopCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 12,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stopNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  stopNumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PoppinsBold',
  },
  stopHeaderTextWrap: {
    flex: 1,
    gap: 5,
  },
  stopName: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'PoppinsBold',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'PoppinsBold',
  },
  stopAddress: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PoppinsRegular',
  },
  metaText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'PoppinsMedium',
  },
  recommendText: {
    marginTop: 8,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'PoppinsRegular',
    fontStyle: 'italic',
  },
  separator: {
    marginTop: 10,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: '#D8CEC0',
  },
  viewMapButton: {
    marginTop: 10,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMapButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PoppinsBold',
  },
  saveTrailButton: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(200, 151, 58, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveTrailButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PoppinsBold',
  },
  saveTrailButtonDisabled: {
    opacity: 0.7,
  },
  actionsFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D7CFC4',
    backgroundColor: COLORS.bg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  bottomButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  newTrailButton: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  newTrailButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PoppinsBold',
  },
  navigateTrailButton: {
    backgroundColor: COLORS.primary,
  },
  navigateTrailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PoppinsBold',
  },
});
