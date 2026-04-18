import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { getCouponPromos, getEstablishments } from '../../services';

const BACKGROUND = '#F5F0E8';
const GREEN = '#2D4A1E';
const BROWN = '#3A2E22';
const GOLD = '#C8973A';
const MUTED = '#6B7280';
const DASH_GRAY = '#E5E7EB';
const CLAIMED_COUPONS_KEY = 'claimed_coupons';
const COUNTDOWN_MS = 20 * 60 * 1000;
const FAILED_RESET_MS = 24 * 60 * 60 * 1000;
const CLAIM_PENDING = 'pending';
const CLAIM_CLAIMED = 'claimed';
const CLAIM_FAILED = 'failed';
const TAB_ALL = 'all';
const TAB_NEAR = 'near';
const TAB_EXPIRING = 'expiring';
const TAB_REDEEMED = 'redeemed';

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveLogoText(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CF';
}

function dateFromAny(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const parsed = dateFromAny(value);
  if (!parsed) {
    return 'Date unavailable';
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isExpiringSoon(value) {
  const parsed = dateFromAny(value);
  if (!parsed) {
    return false;
  }
  const daysLeft = (parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysLeft >= 0 && daysLeft <= 3;
}

function distanceLabel(distanceKm) {
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) {
    return 'Unknown distance';
  }
  return `${distanceKm.toFixed(1)} km away`;
}

function buildPromoDiscountText(raw) {
  if (!raw) {
    return '';
  }

  const discountType = String(raw?.discount_type || raw?.type || '').trim().toLowerCase();
  const rawValue = raw?.discount_value ?? raw?.value ?? raw?.amount ?? raw?.fixed_amount;
  const numericValue = Number(rawValue);
  const hasNumericValue = Number.isFinite(numericValue);

  if (discountType === 'percentage' && hasNumericValue) {
    const normalized = Number.isInteger(numericValue)
      ? String(numericValue)
      : numericValue.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    return `${normalized}% off`;
  }

  if (['amount', 'fixed_amount', 'fixed'].includes(discountType) && hasNumericValue) {
    return `PHP ${numericValue.toFixed(2)} off`;
  }

  const explicit = String(raw?.discount_text || raw?.discount || '').trim();
  if (explicit) {
    return explicit;
  }

  return '';
}

function normalizePromo(raw, index, userLocation) {
  const establishment = raw?.establishment || raw?.cafe || raw?.shop || {};
  const establishmentType = String(establishment?.type || raw?.establishment_type || 'cafe').toLowerCase();
  const lat = Number(establishment?.latitude ?? raw?.latitude);
  const lng = Number(establishment?.longitude ?? raw?.longitude);
  const explicitDistance = Number(raw?.distance_km ?? raw?.distance);

  let computedDistance = Number.isFinite(explicitDistance) ? explicitDistance : null;
  if ((computedDistance === null || Number.isNaN(computedDistance)) && userLocation && Number.isFinite(lat) && Number.isFinite(lng)) {
    computedDistance = getDistance(userLocation.latitude, userLocation.longitude, lat, lng);
  }

  const validUntil = raw?.valid_until || raw?.expires_at || raw?.expiry_date;

  return {
    id: String(raw?.id ?? `promo-${index}`),
    status: String(raw?.status || '').toLowerCase(),
    title: raw?.title || raw?.name || 'Cafe Promo',
    description: raw?.description || raw?.discount_description || 'Enjoy a special coffee promo.',
    code: raw?.code || raw?.coupon_code || raw?.qr_code_token || `BREW-${String(index + 1).padStart(3, '0')}`,
    validUntil,
    distanceKm: typeof computedDistance === 'number' && !Number.isNaN(computedDistance) ? computedDistance : null,
    establishmentName: establishment?.name || raw?.establishment_name || 'Partner Cafe',
    establishmentVerified: Boolean(establishment?.is_verified || establishment?.verified || raw?.is_verified),
    establishmentType,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    qrPayload: raw?.qr_code_token || raw?.qr_data || raw?.qr_payload || raw?.code || raw?.coupon_code,
    claimedAt: raw?.claimed_at || null,
    discountText: buildPromoDiscountText(raw) || raw?.description || 'Exclusive in-store offer',
  };
}

function extractPromosFromEstablishmentsResponse(response) {
  const features = Array.isArray(response?.features)
    ? response.features
    : Array.isArray(response?.data?.features)
    ? response.data.features
    : [];

  const promos = [];

  features.forEach((feature, featureIndex) => {
    const source = feature?.properties || feature || {};
    const establishment = {
      id: source?.id,
      name: source?.name || source?.establishment_name,
      type: source?.type || 'cafe',
      latitude: source?.latitude,
      longitude: source?.longitude,
      is_verified: source?.is_verified || source?.verified || false,
    };

    const groups = [source?.active_promos, source?.coupon_promos, source?.promos];
    const rawPromos = groups.find((entry) => Array.isArray(entry)) || [];

    rawPromos.forEach((promo, promoIndex) => {
      promos.push({
        ...promo,
        id: promo?.id ?? `${source?.id || featureIndex}-promo-${promoIndex}`,
        establishment,
      });
    });
  });

  return promos;
}

function buildEmptyState(activeTab) {
  if (activeTab === TAB_NEAR) {
    return {
      icon: 'place',
      text: 'No nearby promos with location data available',
    };
  }
  if (activeTab === TAB_REDEEMED) {
    return {
      icon: 'check-circle',
      text: 'No redeemed promos yet',
    };
  }
  if (activeTab === TAB_EXPIRING) {
    return {
      icon: null,
      text: 'No promos expiring soon',
    };
  }
  return {
    icon: 'coffee',
    text: 'No cafe promos available right now',
  };
}

function getSectionTitle(activeTab) {
  if (activeTab === TAB_NEAR) {
    return 'Promos Near You';
  }
  if (activeTab === TAB_REDEEMED) {
    return 'Redeemed Promos';
  }
  if (activeTab === TAB_EXPIRING) {
    return 'Expiring Soon';
  }
  return 'All Promos';
}

function formatRemaining(ms) {
  if (!ms || ms <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function CouponPromosScreen({ route, navigation }) {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_ALL);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [claimedCoupons, setClaimedCoupons] = useState({});
  const [timerNow, setTimerNow] = useState(Date.now());

  const [claimTarget, setClaimTarget] = useState(null);
  const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);
  const [focusedPromoId, setFocusedPromoId] = useState(null);

  const listRef = useRef(null);
  const lastHandledFocusAtRef = useRef(null);
  const lastAnimatedFocusAtRef = useRef(null);
  const focusClearTimeoutRef = useRef(null);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const focusedPulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: true,
      })
    );

    if (loading) {
      shimmerAnim.setValue(0);
      shimmerLoop.start();
    }

    return () => shimmerLoop.stop();
  }, [loading, shimmerAnim]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await loadClaimedCoupons();
      const location = await requestLocation();
      if (mounted) {
        await fetchPromos({ location, isRefresh: false });
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (focusClearTimeoutRef.current) {
        clearTimeout(focusClearTimeoutRef.current);
      }
    };
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationPermissionDenied(true);
        setUserLocation(null);
        return null;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setLocationPermissionDenied(false);
      setUserLocation(coords);
      return coords;
    } catch {
      setLocationPermissionDenied(true);
      setUserLocation(null);
      return null;
    }
  }, []);

  const loadClaimedCoupons = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(CLAIMED_COUPONS_KEY);
      const parsed = value ? JSON.parse(value) : {};
      const migrated = Object.entries(parsed || {}).reduce((acc, [promoId, entry]) => {
        if (!entry || typeof entry !== 'object') {
          return acc;
        }

        acc[promoId] = {
          ...entry,
          status: entry.status || (entry.claimedAt ? CLAIM_CLAIMED : CLAIM_PENDING),
        };
        return acc;
      }, {});

      setClaimedCoupons(migrated);
    } catch {
      setClaimedCoupons({});
    }
  }, []);

  const saveClaimedCoupons = useCallback(async (next) => {
    setClaimedCoupons(next);
    try {
      await AsyncStorage.setItem(CLAIMED_COUPONS_KEY, JSON.stringify(next));
    } catch {
      // Silent storage failure keeps UI responsive.
    }
  }, []);

  useEffect(() => {
    const hasExpiredPending = Object.values(claimedCoupons).some((entry) => {
      return entry?.status === CLAIM_PENDING && Number(entry?.countdownEndsAt || 0) <= timerNow;
    });

    if (!hasExpiredPending) {
      return;
    }

    const next = { ...claimedCoupons };
    let changed = false;

    Object.keys(next).forEach((promoId) => {
      const entry = next[promoId];
      if (entry?.status === CLAIM_PENDING && Number(entry?.countdownEndsAt || 0) <= timerNow) {
        next[promoId] = {
          ...entry,
          status: CLAIM_FAILED,
          failedAt: timerNow,
        };
        changed = true;
      }
    });

    if (changed) {
      saveClaimedCoupons(next);
    }
  }, [claimedCoupons, saveClaimedCoupons, timerNow]);

  useEffect(() => {
    const hasRecoverableFailed = Object.values(claimedCoupons).some((entry) => {
      if (entry?.status !== CLAIM_FAILED) {
        return false;
      }

      const failedAt = Number(entry?.failedAt || entry?.countdownEndsAt || 0);
      if (!failedAt) {
        return true;
      }

      return timerNow - failedAt >= FAILED_RESET_MS;
    });

    if (!hasRecoverableFailed) {
      return;
    }

    const next = { ...claimedCoupons };
    let changed = false;

    Object.keys(next).forEach((promoId) => {
      const entry = next[promoId];
      if (entry?.status !== CLAIM_FAILED) {
        return;
      }

      const failedAt = Number(entry?.failedAt || entry?.countdownEndsAt || 0);
      if (!failedAt || timerNow - failedAt >= FAILED_RESET_MS) {
        delete next[promoId];
        changed = true;
      }
    });

    if (changed) {
      saveClaimedCoupons(next);
    }
  }, [claimedCoupons, saveClaimedCoupons, timerNow]);

  const fetchPromos = useCallback(
    async ({ location, isRefresh }) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const allResponse = await getCouponPromos();

        const toArray = (response) => {
          if (Array.isArray(response)) {
            return response;
          }
          if (Array.isArray(response?.data)) {
            return response.data;
          }
          if (Array.isArray(response?.promos)) {
            return response.promos;
          }
          return [];
        };

        const mergedMap = new Map();
        [...toArray(allResponse)].forEach((promo, index) => {
          const key = String(promo?.id ?? `merged-${index}`);
          if (!mergedMap.has(key)) {
            mergedMap.set(key, promo);
          }
        });

        if (!mergedMap.size) {
          const establishmentsResponse = await getEstablishments();
          const fallbackPromos = extractPromosFromEstablishmentsResponse(establishmentsResponse);
          fallbackPromos.forEach((promo, index) => {
            const key = String(promo?.id ?? `fallback-${index}`);
            if (!mergedMap.has(key)) {
              mergedMap.set(key, promo);
            }
          });
        }

        const items = Array.from(mergedMap.values());

        const normalized = items
          .map((item, index) => normalizePromo(item, index, location || userLocation))
          .filter((item) => item.establishmentType.includes('cafe') && item.status !== 'draft')
          .sort((a, b) => {
            const aDistance = typeof a.distanceKm === 'number' ? a.distanceKm : Number.POSITIVE_INFINITY;
            const bDistance = typeof b.distanceKm === 'number' ? b.distanceKm : Number.POSITIVE_INFINITY;
            return aDistance - bDistance;
          })
          .filter((promo, index, list) => {
            const signature = [
              String(promo.establishmentName || '').trim().toLowerCase(),
              String(promo.title || '').trim().toLowerCase(),
              String(promo.code || '').trim().toLowerCase(),
            ].join('|');

            return (
              list.findIndex((entry) => {
                const entrySignature = [
                  String(entry.establishmentName || '').trim().toLowerCase(),
                  String(entry.title || '').trim().toLowerCase(),
                  String(entry.code || '').trim().toLowerCase(),
                ].join('|');
                return entrySignature === signature;
              }) === index
            );
          });

        const promoById = normalized.reduce((acc, promo) => {
          acc[promo.id] = promo;
          return acc;
        }, {});

        const nextClaims = Object.entries(claimedCoupons || {}).reduce((acc, [promoId, claim]) => {
          const match = promoById[promoId];
          if (!match || !claim || typeof claim !== 'object') {
            return acc;
          }

          const claimCode = String(claim.code || '').trim();
          const claimTitle = String(claim.title || '').trim().toLowerCase();
          const promoCode = String(match.code || '').trim();
          const promoTitle = String(match.title || '').trim().toLowerCase();

          const sameCode = !claimCode || !promoCode || claimCode === promoCode;
          const sameTitle = !claimTitle || !promoTitle || claimTitle === promoTitle;

          if (sameCode && sameTitle) {
            acc[promoId] = claim;
          }

          return acc;
        }, {});

        if (Object.keys(nextClaims).length !== Object.keys(claimedCoupons || {}).length) {
          await saveClaimedCoupons(nextClaims);
        }

        setPromos(normalized);
      } catch {
        setPromos([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [claimedCoupons, saveClaimedCoupons, userLocation]
  );

  const filteredPromos = useMemo(() => {
    const getStatus = (item) => {
      const localClaim = claimedCoupons[item.id];
      if (localClaim?.status) {
        return localClaim.status;
      }
      if (item.claimedAt) {
        return CLAIM_CLAIMED;
      }
      return null;
    };

    const isRedeemedPromo = (item) => {
      return getStatus(item) === CLAIM_CLAIMED;
    };

    const getSortRank = (item) => {
      const localClaim = claimedCoupons[item.id];
      if (localClaim?.status === CLAIM_PENDING) {
        const remainingMs = Math.max(0, Number(localClaim.countdownEndsAt || 0) - timerNow);
        return remainingMs > 0 ? -1 : 2;
      }

      if (localClaim?.status === CLAIM_FAILED) {
        return 2;
      }

      return 0;
    };

    let base = promos;

    if (activeTab === TAB_NEAR) {
      base = promos.filter((item) => typeof item.distanceKm === 'number');
    }
    if (activeTab === TAB_REDEEMED) {
      base = promos.filter((item) => isRedeemedPromo(item));
    }
    if (activeTab === TAB_EXPIRING) {
      base = promos.filter((item) => isExpiringSoon(item.validUntil));
    }

    return base
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const rankDiff = getSortRank(a.item) - getSortRank(b.item);
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }, [activeTab, claimedCoupons, promos, timerNow]);

  const nearYou = useMemo(() => {
    return promos.filter((item) => typeof item.distanceKm === 'number').slice(0, 3);
  }, [promos]);

  const listPromos = useMemo(() => {
    if (loading) {
      return [];
    }

    if (activeTab !== TAB_ALL && activeTab !== TAB_NEAR) {
      return filteredPromos;
    }

    const nearIds = new Set(nearYou.map((item) => item.id));
    return filteredPromos.filter((item) => !nearIds.has(item.id));
  }, [activeTab, filteredPromos, loading, nearYou]);

  const emptyStateData = useMemo(() => buildEmptyState(activeTab), [activeTab]);
  const sectionTitle = useMemo(() => getSectionTitle(activeTab), [activeTab]);
  const focusPromoTitle = String(route?.params?.focusPromoTitle || '').trim().toLowerCase();
  const focusEstablishmentName = String(route?.params?.focusEstablishmentName || '').trim().toLowerCase();
  const focusAt = route?.params?.focusAt;

  useEffect(() => {
    if (!focusPromoTitle || !focusAt) {
      return;
    }

    if (lastHandledFocusAtRef.current === focusAt) {
      return;
    }

    lastHandledFocusAtRef.current = focusAt;

    if (activeTab !== TAB_ALL) {
      setActiveTab(TAB_ALL);
    }
  }, [activeTab, focusAt, focusPromoTitle]);

  useEffect(() => {
    if (!focusPromoTitle || !focusAt || !filteredPromos.length) {
      return;
    }

    if (lastHandledFocusAtRef.current !== focusAt) {
      return;
    }

    if (lastAnimatedFocusAtRef.current === focusAt) {
      return;
    }

    const findPromoMatch = (item) => {
      const title = String(item?.title || '').trim().toLowerCase();
      const establishment = String(item?.establishmentName || '').trim().toLowerCase();

      const titleMatch = title === focusPromoTitle || title.includes(focusPromoTitle) || focusPromoTitle.includes(title);
      const establishmentMatch = !focusEstablishmentName || establishment === focusEstablishmentName;

      return titleMatch && establishmentMatch;
    };

    const targetPromo = filteredPromos.find(findPromoMatch);

    if (!targetPromo) {
      return;
    }

    lastAnimatedFocusAtRef.current = focusAt;
    setFocusedPromoId(targetPromo.id);
    focusedPulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(focusedPulseAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(focusedPulseAnim, {
        toValue: 0,
        duration: 4580,
        useNativeDriver: true,
      }),
    ]).start();

    const targetIndexInList = listPromos.findIndex((item) => item.id === targetPromo.id);
    if (targetIndexInList >= 0) {
      listRef.current?.scrollToIndex?.({
        index: targetIndexInList,
        animated: true,
        viewPosition: 0.2,
      });
    } else {
      listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    }

    if (focusClearTimeoutRef.current) {
      clearTimeout(focusClearTimeoutRef.current);
    }

    focusClearTimeoutRef.current = setTimeout(() => {
      setFocusedPromoId(null);
      navigation?.setParams?.({
        focusPromoTitle: undefined,
        focusEstablishmentName: undefined,
        focusAt: undefined,
      });
    }, 5000);
  }, [filteredPromos, focusAt, focusEstablishmentName, focusPromoTitle, focusedPulseAnim, listPromos, navigation]);

  const handleRefresh = useCallback(async () => {
    let location = userLocation;
    if (!locationPermissionDenied && !location) {
      location = await requestLocation();
    }
    await fetchPromos({ location, isRefresh: true });
  }, [fetchPromos, locationPermissionDenied, requestLocation, userLocation]);

  const openClaimModal = useCallback((promo) => {
    setClaimTarget(promo);
    setIsClaimModalVisible(true);
  }, []);

  const startClaimCountdown = useCallback(
    async (promo) => {
      const current = claimedCoupons[promo.id];
      if (current?.status === CLAIM_CLAIMED) {
        return;
      }

      if (current?.status === CLAIM_FAILED) {
        const failedAt = Number(current?.failedAt || current?.countdownEndsAt || 0);
        if (failedAt && Date.now() - failedAt < FAILED_RESET_MS) {
          return;
        }
      }

      if (current?.status === CLAIM_FAILED && (!current?.failedAt && !current?.countdownEndsAt)) {
        return;
      }

      if (current?.status === CLAIM_PENDING && Number(current?.countdownEndsAt || 0) > Date.now()) {
        return;
      }

      const now = Date.now();
      const next = {
        ...claimedCoupons,
        [promo.id]: {
          status: CLAIM_PENDING,
          claimedAt: null,
          startedAt: now,
          countdownEndsAt: now + COUNTDOWN_MS,
          code: promo.code,
          title: promo.title,
        },
      };
      await saveClaimedCoupons(next);
    },
    [claimedCoupons, saveClaimedCoupons]
  );

  const finalizeClaimed = useCallback(
    async (promo, claimedAt) => {
      const claimedMs = claimedAt ? dateFromAny(claimedAt)?.getTime() || Date.now() : Date.now();
      const existing = claimedCoupons[promo.id] || {};
      const next = {
        ...claimedCoupons,
        [promo.id]: {
          ...existing,
          status: CLAIM_CLAIMED,
          claimedAt: claimedMs,
          countdownEndsAt: claimedMs + COUNTDOWN_MS,
          code: promo.code,
          title: promo.title,
        },
      };

      await saveClaimedCoupons(next);
    },
    [claimedCoupons, saveClaimedCoupons]
  );

  const getClaimStatus = useCallback(
    (promo) => {
      const claim = claimedCoupons[promo.id];
      if (claim) {
        const remainingMs = Math.max(0, Number(claim.countdownEndsAt || 0) - timerNow);
        if (claim.status === CLAIM_CLAIMED) {
          return { status: CLAIM_CLAIMED, isClaimed: true, isPending: false, isFailed: false, remainingMs, claimedAt: claim.claimedAt || null };
        }

        if (claim.status === CLAIM_FAILED) {
          const failedAt = Number(claim?.failedAt || claim?.countdownEndsAt || 0);
          const resetRemainingMs = failedAt ? Math.max(0, failedAt + FAILED_RESET_MS - timerNow) : 0;

          if (failedAt && resetRemainingMs <= 0) {
            return { status: null, isClaimed: false, isPending: false, isFailed: false, remainingMs: 0, resetRemainingMs: 0, claimedAt: null };
          }

          return {
            status: CLAIM_FAILED,
            isClaimed: false,
            isPending: false,
            isFailed: true,
            remainingMs: 0,
            resetRemainingMs,
            claimedAt: claim.claimedAt || null,
          };
        }

        if (remainingMs <= 0) {
          return { status: CLAIM_FAILED, isClaimed: false, isPending: false, isFailed: true, remainingMs: 0, resetRemainingMs: FAILED_RESET_MS, claimedAt: claim.claimedAt || null };
        }

        return { status: CLAIM_PENDING, isClaimed: false, isPending: true, isFailed: false, remainingMs, resetRemainingMs: 0, claimedAt: null };
      }

      const serverClaimedAt = dateFromAny(promo.claimedAt);
      if (!serverClaimedAt) {
        return { status: null, isClaimed: false, isPending: false, isFailed: false, remainingMs: 0, resetRemainingMs: 0, claimedAt: null };
      }

      const remainingMs = Math.max(0, serverClaimedAt.getTime() + COUNTDOWN_MS - timerNow);
      return { status: CLAIM_CLAIMED, isClaimed: true, isPending: false, isFailed: false, remainingMs, resetRemainingMs: 0, claimedAt: serverClaimedAt.toISOString() };
    },
    [claimedCoupons, timerNow]
  );

  const handleCopyCode = useCallback(async (code) => {
    if (!code) {
      return;
    }
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Coupon code copied to clipboard.');
  }, []);

  const renderCard = ({ item, index, showNearestBadge, isFocused }) => {
    const claimStatus = getClaimStatus(item);
    const isViewEnabled = claimStatus.status === CLAIM_CLAIMED || claimStatus.status === CLAIM_PENDING;
    const focusedScale = focusedPulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.03],
    });
    const focusedOpacity = focusedPulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    return (
      <Animated.View
        style={[
          styles.couponCardWrap,
          isFocused
            ? {
                transform: [{ scale: focusedScale }],
              }
            : null,
        ]}
      >
      <View style={[styles.couponCard, isFocused && styles.highlightCard]}>
        {isFocused ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.focusGlowOverlay, { opacity: focusedOpacity }]}
          />
        ) : null}
        <View style={styles.leftStrip} />
        <View style={styles.notchLeft} />
        <View style={styles.notchRight} />
        <Pressable
          style={[styles.viewPill, !isViewEnabled && styles.viewPillDisabled]}
          disabled={!isViewEnabled}
          onPress={isViewEnabled ? () => openClaimModal(item) : undefined}
        >
          <Text style={[styles.viewPillText, !isViewEnabled && styles.viewPillTextDisabled]}>View</Text>
        </Pressable>

        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{resolveLogoText(item.establishmentName)}</Text>
          </View>

          <View style={styles.topMain}>
            <Text numberOfLines={1} style={styles.cafeName}>
              {item.establishmentName}
            </Text>

            <View style={styles.topBadges}>
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceBadgeText}>{distanceLabel(item.distanceKm)}</Text>
              </View>
              {item.establishmentVerified ? (
                <View style={styles.verifiedBadge}>
                  <MaterialIcons name="verified" size={12} color="#1D4ED8" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : null}
              {showNearestBadge && index === 0 ? (
                <View style={styles.nearestBadge}>
                  <Text style={styles.nearestBadgeText}>Nearest</Text>
                </View>
              ) : null}
              {isFocused ? (
                <View style={styles.focusedBadge}>
                  <Text style={styles.focusedBadgeText}>Focused</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.cardMiddle}>
          <Text style={styles.promoTitle}>{item.title}</Text>
          <Text style={styles.promoDescription}>{item.discountText || item.description}</Text>
          <View style={styles.codePill}>
            <Text style={styles.codePillText}>{item.code}</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View>
            <Text style={styles.validLabel}>Valid until</Text>
            <Text style={[styles.validDate, isExpiringSoon(item.validUntil) && styles.validDateExpiring]}>
              {formatDate(item.validUntil)}
            </Text>
          </View>

          {claimStatus.isClaimed ? (
            <View style={styles.cardActionStack}>
              <Text style={styles.claimedText}>Redeemed ✓</Text>
              <Pressable style={styles.viewActionButton} onPress={() => openClaimModal(item)}>
                <Text style={styles.viewActionButtonText}>View</Text>
              </Pressable>
            </View>
          ) : claimStatus.isFailed ? (
            <View style={styles.cardActionStack}>
              <Text style={styles.failedText}>
                {claimStatus.resetRemainingMs > 0
                  ? `Failed • resets in ${Math.max(1, Math.ceil(claimStatus.resetRemainingMs / (1000 * 60 * 60)))}h`
                  : 'Failed'}
              </Text>
            </View>
          ) : claimStatus.isPending ? (
            <View style={styles.cardActionStack}>
              <Text style={styles.pendingText}>{formatRemaining(claimStatus.remainingMs)}</Text>
              <Pressable style={styles.viewActionButton} onPress={() => openClaimModal(item)}>
                <Text style={styles.viewActionButtonText}>View</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.claimButton, pressed && styles.claimButtonPressed]}
              onPress={() => {
                if (!claimStatus.isPending) {
                  startClaimCountdown(item);
                }
                openClaimModal(item);
              }}
            >
              <Text style={styles.claimButtonText}>Claim</Text>
            </Pressable>
          )}
        </View>
      </View>
      </Animated.View>
    );
  };

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 240],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={listPromos}
          keyExtractor={(item) => item.id}
          onScrollToIndexFailed={({ index }) => {
            const fallbackOffset = Math.max(0, index) * 220;
            listRef.current?.scrollToOffset?.({ offset: fallbackOffset, animated: true });
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={GREEN} />}
          ListHeaderComponent={
            <View>
              <Text style={styles.headerTitle}>Cafe Promos</Text>
              <Text style={styles.headerSubtitle}>Exclusive deals for you</Text>

              <View style={styles.tabsRow}>
                <Pressable style={styles.tabButton} onPress={() => setActiveTab(TAB_ALL)}>
                  <Text style={[styles.tabText, activeTab === TAB_ALL && styles.tabTextActive]}>All</Text>
                  {activeTab === TAB_ALL ? <View style={styles.tabIndicator} /> : null}
                </Pressable>
                <Pressable style={styles.tabButton} onPress={() => setActiveTab(TAB_NEAR)}>
                  <Text style={[styles.tabText, activeTab === TAB_NEAR && styles.tabTextActive]}>Near Me</Text>
                  {activeTab === TAB_NEAR ? <View style={styles.tabIndicator} /> : null}
                </Pressable>
                <Pressable style={styles.tabButton} onPress={() => setActiveTab(TAB_EXPIRING)}>
                  <Text style={[styles.tabText, activeTab === TAB_EXPIRING && styles.tabTextActive]}>Expiring Soon</Text>
                  {activeTab === TAB_EXPIRING ? <View style={styles.tabIndicator} /> : null}
                </Pressable>
                <Pressable style={styles.tabButton} onPress={() => setActiveTab(TAB_REDEEMED)}>
                  <Text style={[styles.tabText, activeTab === TAB_REDEEMED && styles.tabTextActive]}>Redeemed</Text>
                  {activeTab === TAB_REDEEMED ? <View style={styles.tabIndicator} /> : null}
                </Pressable>
              </View>

              {loading ? (
                <View style={styles.loadingWrap}>
                  {[0, 1, 2].map((card) => (
                    <View key={`skeleton-${card}`} style={styles.skeletonCard}>
                      <Animated.View
                        style={[
                          styles.shimmer,
                          {
                            transform: [{ translateX: shimmerTranslate }],
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              ) : (activeTab === TAB_ALL || activeTab === TAB_NEAR) && nearYou.length ? (
                <View style={styles.nearYouSection}>
                  <Text style={styles.nearYouTitle}>{sectionTitle}</Text>
                  {nearYou.map((item, idx) => (
                    <View key={`near-${item.id}`}>
                      {renderCard({ item, index: idx, showNearestBadge: true, isFocused: item.id === focusedPromoId })}
                    </View>
                  ))}
                </View>
              ) : null}

              {!loading && (activeTab === TAB_EXPIRING || activeTab === TAB_REDEEMED) ? (
                <View style={styles.filteredLabelWrap}>
                  <Text style={styles.nearYouTitle}>{sectionTitle}</Text>
                </View>
              ) : null}

              {!loading && !filteredPromos.length ? (
                <View style={styles.emptyState}>
                  {emptyStateData.icon ? (
                    <MaterialIcons name={emptyStateData.icon} size={18} color={MUTED} />
                  ) : null}
                  <Text style={styles.emptyStateText}>{emptyStateData.text}</Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={(props) => renderCard({ ...props, showNearestBadge: false, isFocused: props.item.id === focusedPromoId })}
          ListFooterComponent={loading ? null : <View style={{ height: 110 }} />}
        />
      </View>

      <Modal
        transparent
        visible={isClaimModalVisible}
        animationType="slide"
        onRequestClose={() => setIsClaimModalVisible(false)}
      >
        <View style={styles.claimSheetBackdrop}>
          <Pressable style={styles.claimSheetDismiss} onPress={() => setIsClaimModalVisible(false)} />
          <View style={styles.claimSheet}>
            {claimTarget ? (
              <>
                {(() => {
                  const claimStatus = getClaimStatus(claimTarget);
                  return (
                    <>
                <View style={styles.claimHeaderRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{resolveLogoText(claimTarget.establishmentName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.claimCafe}>{claimTarget.establishmentName}</Text>
                    <Text style={styles.claimTitle}>{claimTarget.title}</Text>
                  </View>
                </View>

                <View style={styles.claimCodeBox}>
                  <Text style={styles.claimCodeText}>{claimTarget.code}</Text>
                </View>

                <Pressable style={styles.copyButton} onPress={() => handleCopyCode(claimTarget.code)}>
                  <Text style={styles.copyButtonText}>Copy Code</Text>
                </Pressable>

                <View style={styles.qrWrap}>
                  <QRCode
                    value={String(claimTarget.qrPayload || claimTarget.code || claimTarget.id)}
                    size={160}
                    color={GREEN}
                    backgroundColor="#FFFFFF"
                  />
                </View>

                <Text style={styles.claimInstruction}>Show this QR at the cafe to redeem</Text>
                <Text style={[styles.claimValidDate, isExpiringSoon(claimTarget.validUntil) && styles.validDateExpiring]}>
                  Valid until {formatDate(claimTarget.validUntil)}
                </Text>
                {claimStatus.isClaimed || claimStatus.isPending ? (
                  <Text style={styles.claimModalStatus}>
                    {claimStatus.isPending
                      ? `Claim in ${formatRemaining(claimStatus.remainingMs)}`
                      : claimStatus.remainingMs > 0
                      ? `Redeemed • Redeem in ${formatRemaining(claimStatus.remainingMs)}`
                      : 'Redeemed ✓'}
                  </Text>
                ) : null}
                {claimStatus.claimedAt ? (
                  <Text style={styles.claimedAtTextCenter}>Redeemed on {formatDate(claimStatus.claimedAt)}</Text>
                ) : null}
                {claimStatus.isFailed ? (
                  <Text style={styles.claimModalFailed}>Failed to claim coupon promo within the allotted time.</Text>
                ) : null}

                <Pressable style={styles.closeButton} onPress={() => setIsClaimModalVisible(false)}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
                    </>
                  );
                })()}
              </>
            ) : (
              <ActivityIndicator color={GREEN} />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 30,
    color: BROWN,
    fontFamily: 'PoppinsBold',
    marginTop: 8,
  },
  headerSubtitle: {
    marginTop: 4,
    color: MUTED,
    fontFamily: 'PoppinsRegular',
    fontSize: 14,
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locationRowText: {
    flex: 1,
    color: '#374151',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
  },
  changeLink: {
    color: GREEN,
    textDecorationLine: 'underline',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#DED7CC',
    marginBottom: 12,
  },
  tabButton: {
    paddingVertical: 10,
    marginRight: 18,
  },
  tabText: {
    color: MUTED,
    fontFamily: 'PoppinsMedium',
    fontSize: 14,
  },
  tabTextActive: {
    color: GREEN,
    fontFamily: 'PoppinsBold',
  },
  tabIndicator: {
    marginTop: 6,
    height: 2,
    width: '100%',
    backgroundColor: GREEN,
  },
  loadingWrap: {
    gap: 12,
  },
  skeletonCard: {
    height: 168,
    borderRadius: 18,
    backgroundColor: '#EAE2D6',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 130,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  nearYouSection: {
    marginTop: 10,
    marginBottom: 4,
  },
  filteredLabelWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  nearYouTitle: {
    fontSize: 18,
    color: BROWN,
    fontFamily: 'PoppinsBold',
    marginBottom: 8,
  },
  couponCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: DASH_GRAY,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 9,
    elevation: 3,
  },
  couponCardWrap: {
    marginBottom: 12,
  },
  highlightCard: {
    borderColor: GOLD,
    borderWidth: 2,
    backgroundColor: '#FFF7EA',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
  focusGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F6C760',
    backgroundColor: 'rgba(246, 199, 96, 0.15)',
  },
  focusedBadge: {
    backgroundColor: '#FDE9B7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  focusedBadgeText: {
    color: '#7A4B0A',
    fontFamily: 'PoppinsBold',
    fontSize: 10,
    lineHeight: 13,
  },
  leftStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 6,
    backgroundColor: BROWN,
  },
  notchLeft: {
    position: 'absolute',
    left: -8,
    top: '48%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BACKGROUND,
  },
  notchRight: {
    position: 'absolute',
    right: -8,
    top: '48%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BACKGROUND,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 64,
  },
  viewPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 2,
  },
  viewPillText: {
    color: BROWN,
    fontFamily: 'PoppinsMedium',
    fontSize: 11,
  },
  viewPillDisabled: {
    backgroundColor: 'rgba(229, 231, 235, 0.75)',
    borderColor: '#D1D5DB',
  },
  viewPillTextDisabled: {
    color: '#9CA3AF',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F0DF',
    borderWidth: 1,
    borderColor: '#D4DEC9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: GREEN,
    fontFamily: 'PoppinsBold',
    fontSize: 14,
  },
  topMain: {
    flex: 1,
  },
  cafeName: {
    color: '#1C1C1C',
    fontFamily: 'PoppinsBold',
    fontSize: 15,
  },
  topBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  distanceBadge: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsMedium',
    fontSize: 11,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 2,
  },
  verifiedText: {
    color: '#1E40AF',
    fontFamily: 'PoppinsMedium',
    fontSize: 10,
  },
  nearestBadge: {
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nearestBadgeText: {
    color: '#8A5A16',
    fontFamily: 'PoppinsBold',
    fontSize: 10,
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: DASH_GRAY,
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  cardMiddle: {
    gap: 4,
  },
  promoTitle: {
    color: GREEN,
    fontFamily: 'PoppinsBold',
    fontSize: 18,
  },
  promoDescription: {
    color: MUTED,
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
  },
  codePill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  codePillText: {
    fontFamily: 'monospace',
    color: '#374151',
    fontSize: 13,
  },
  cardBottom: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  validLabel: {
    color: MUTED,
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
  },
  validDate: {
    color: MUTED,
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
  },
  validDateExpiring: {
    color: '#DC2626',
  },
  timerText: {
    marginTop: 2,
    color: '#0F766E',
    fontFamily: 'PoppinsMedium',
    fontSize: 11,
  },
  claimedAtText: {
    marginTop: 1,
    color: MUTED,
    fontFamily: 'PoppinsRegular',
    fontSize: 10,
  },
  failedClaimText: {
    marginTop: 2,
    color: '#DC2626',
    fontFamily: 'PoppinsRegular',
    fontSize: 10,
    maxWidth: 190,
  },
  claimButton: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  claimButtonPressed: {
    opacity: 0.85,
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
  },
  cardActionStack: {
    alignItems: 'flex-end',
    gap: 6,
  },
  viewActionButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  viewActionButtonText: {
    color: BROWN,
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 15,
  },
  viewActionButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  viewActionButtonTextDisabled: {
    color: '#9CA3AF',
  },
  pendingText: {
    color: '#0F766E',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
  },
  claimedText: {
    color: '#16A34A',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
  },
  failedText: {
    color: '#DC2626',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
  },
  emptyState: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: MUTED,
    textAlign: 'center',
    fontFamily: 'PoppinsMedium',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  radiusModalCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  radiusTitle: {
    color: '#111827',
    fontFamily: 'PoppinsBold',
    fontSize: 16,
    marginBottom: 10,
  },
  radiusOption: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  radiusOptionActive: {
    borderColor: GREEN,
    backgroundColor: '#EEF4E8',
  },
  radiusOptionText: {
    color: '#374151',
    fontFamily: 'PoppinsMedium',
    fontSize: 14,
  },
  radiusOptionTextActive: {
    color: GREEN,
    fontFamily: 'PoppinsBold',
  },
  claimSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  claimSheetDismiss: {
    flex: 1,
  },
  claimSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 26,
  },
  claimHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  claimCafe: {
    color: '#111827',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
  },
  claimTitle: {
    color: GREEN,
    fontFamily: 'PoppinsBold',
    fontSize: 18,
  },
  claimCodeBox: {
    marginTop: 8,
    backgroundColor: BACKGROUND,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  claimCodeText: {
    fontFamily: 'monospace',
    color: '#1F2937',
    fontSize: 24,
    fontWeight: '700',
  },
  copyButton: {
    marginTop: 10,
    backgroundColor: GOLD,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 14,
  },
  qrWrap: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
  },
  claimInstruction: {
    marginTop: 12,
    textAlign: 'center',
    color: '#4B5563',
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
  },
  claimValidDate: {
    marginTop: 6,
    textAlign: 'center',
    color: MUTED,
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
  },
  claimModalStatus: {
    marginTop: 6,
    textAlign: 'center',
    color: '#0F766E',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
  },
  claimedAtTextCenter: {
    marginTop: 3,
    textAlign: 'center',
    color: MUTED,
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
  },
  claimModalFailed: {
    marginTop: 6,
    textAlign: 'center',
    color: '#DC2626',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
  },
  closeButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#374151',
    fontFamily: 'PoppinsMedium',
    fontSize: 14,
  },
});
