import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Callout, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { API_CONFIG, api, getEstablishments } from '../../services';

const LIPA_REGION = {
  latitude: 13.9411,
  longitude: 121.1631,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const LIPA_BOUNDS = {
  minLatitude: 13.5,
  maxLatitude: 14.4,
  minLongitude: 120.7,
  maxLongitude: 121.8,
};

const MAP_DELTA_LIMITS = {
  // Mirror web-side zoom constraints roughly: minZoom 10, maxZoom 18.
  minDelta: 0.0015,
  maxDelta: 0.36,
};

const TYPE_FILTER_OPTIONS = [
  { key: 'all', label: 'All', color: '#3A2E22' },
  { key: 'farm', label: 'Farms', color: '#2D4A1E' },
  { key: 'cafe', label: 'Cafes', color: '#8B4513' },
  { key: 'roaster', label: 'Roasters', color: '#C8973A' },
  { key: 'reseller', label: 'Resellers', color: '#1E40AF' },
];

const TYPE_PIN_COLORS = {
  farm: '#2D4A1E',
  cafe: '#8B4513',
  roaster: '#C8973A',
  reseller: '#1E40AF',
};

const TYPE_PILL_THEME = {
  farm: { bg: 'rgba(45, 74, 30, 0.14)', border: 'rgba(45, 74, 30, 0.35)', text: '#2D4A1E' },
  cafe: { bg: 'rgba(139, 69, 19, 0.2)', border: 'rgba(139, 69, 19, 0.5)', text: '#6D3408' },
  roaster: { bg: 'rgba(200, 151, 58, 0.18)', border: 'rgba(160, 114, 18, 0.4)', text: '#8A5F0F' },
  reseller: { bg: 'rgba(30, 64, 175, 0.13)', border: 'rgba(30, 64, 175, 0.35)', text: '#1E40AF' },
};

const BRAND = {
  bg: '#F3E9D7',
  text: '#3A2E22',
  accent: '#2E5A3D',
  accentDark: '#1E3A2A',
  border: '#D9C9B2',
  white: '#FFFFFF',
  muted: '#9E8C78',
};

const VARIETY_COLOR_MAP = {
  liberica: '#4A6741',
  excelsa: '#B8860B',
  robusta: '#6B3A2A',
  arabica: '#8B1A1A',
};

function resolveMapImageUrl(pathOrUrl) {
  if (!pathOrUrl) {
    return null;
  }

  const raw = String(pathOrUrl).trim();
  if (!raw) {
    return null;
  }

  const runtimeApiBase = process.env.EXPO_PUBLIC_API_URL || API_CONFIG?.baseUrl;
  const baseUrl = String(runtimeApiBase || '').replace(/\/+$/, '');
  const apiOriginMatch = baseUrl.match(/^(https?:\/\/[^/]+)/i);
  const apiOrigin = apiOriginMatch ? apiOriginMatch[1] : baseUrl;

  if (/^https?:\/\//i.test(raw)) {
    const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//i.test(raw);
    if (!isLocalhostUrl || !apiOrigin) {
      return raw;
    }

    const pathOnly = raw.replace(/^https?:\/\/[^/]+/i, '');
    const normalizedPath = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    return `${apiOrigin}${normalizedPath}`;
  }

  if (!apiOrigin) {
    return raw;
  }

  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  if (/^\/storage\//i.test(normalizedPath)) {
    return `${apiOrigin}${normalizedPath}`;
  }

  const storagePath = raw.replace(/^\/+/, '');
  return `${apiOrigin}/storage/${storagePath}`;
}

function normalizeEstablishment(item, index) {
  const source = item?.properties || item;
  const geometryCoords = item?.geometry?.coordinates;

  const longitude = Number(source.longitude ?? geometryCoords?.[0]);
  const latitude = Number(source.latitude ?? geometryCoords?.[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const type = String(source.type || '').toLowerCase();
  const displayType = type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : 'Establishment';
  const barangay = source.barangay ? `, ${source.barangay}` : '';
  const varieties = Array.isArray(source.coffee_varieties)
    ? source.coffee_varieties.filter(Boolean)
    : [];
  const recentReviews = Array.isArray(source.recent_reviews)
    ? source.recent_reviews.filter(Boolean)
    : [];
  const activePromos = getActivePromosFromSource(source);

  return {
    id: `${type || 'establishment'}-${String(source.id ?? index)}`,
    name: source.name || 'Establishment',
    type,
    displayType,
    latitude,
    longitude,
    address: `${source.address || 'No address provided'}${barangay}`,
    rating: Number(source.rating_average ?? source.average_rating ?? 0),
    image: resolveMapImageUrl(source.image || source.photo_url || source.image_url || null),
    description: source.description || '',
    contactNumber: source.contact_number || '',
    email: source.email || '',
    website: source.website || '',
    visitHours: source.visit_hours || '',
    activities: source.activities || '',
    reviewCount: Number(source.review_count ?? 0),
    tasteAvg: Number(source.taste_avg ?? 0),
    environmentAvg: Number(source.environment_avg ?? 0),
    cleanlinessAvg: Number(source.cleanliness_avg ?? 0),
    serviceAvg: Number(source.service_avg ?? 0),
    coffeeVarieties: varieties,
    recentReviews,
    activePromos,
    raw: source,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function constrainRegion(region) {
  const latitudeDelta = clamp(
    Number(region.latitudeDelta) || LIPA_REGION.latitudeDelta,
    MAP_DELTA_LIMITS.minDelta,
    MAP_DELTA_LIMITS.maxDelta
  );
  const longitudeDelta = clamp(
    Number(region.longitudeDelta) || LIPA_REGION.longitudeDelta,
    MAP_DELTA_LIMITS.minDelta,
    MAP_DELTA_LIMITS.maxDelta
  );

  const halfLat = latitudeDelta / 2;
  const halfLng = longitudeDelta / 2;

  const latitude = clamp(
    Number(region.latitude) || LIPA_REGION.latitude,
    LIPA_BOUNDS.minLatitude + halfLat,
    LIPA_BOUNDS.maxLatitude - halfLat
  );
  const longitude = clamp(
    Number(region.longitude) || LIPA_REGION.longitude,
    LIPA_BOUNDS.minLongitude + halfLng,
    LIPA_BOUNDS.maxLongitude - halfLng
  );

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

function regionHasMeaningfulDiff(a, b) {
  return (
    Math.abs(a.latitude - b.latitude) > 0.00001 ||
    Math.abs(a.longitude - b.longitude) > 0.00001 ||
    Math.abs(a.latitudeDelta - b.latitudeDelta) > 0.00001 ||
    Math.abs(a.longitudeDelta - b.longitudeDelta) > 0.00001
  );
}

function decodePolyline(encoded) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}

function buildFallbackRoute(origin, destination) {
  if (!origin || !destination) {
    return [];
  }

  return [
    {
      latitude: origin.latitude,
      longitude: origin.longitude,
    },
    {
      latitude: destination.latitude,
      longitude: destination.longitude,
    },
  ];
}

function formatStars(ratingValue) {
  const rounded = Math.max(0, Math.min(5, Number(ratingValue) || 0));
  const filled = Math.round(rounded);
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)} ${rounded.toFixed(1)}`;
}

function metricStars(ratingValue) {
  const rounded = Math.max(0, Math.min(5, Number(ratingValue) || 0));
  const filled = Math.round(rounded);
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`;
}

function getVarietyColor(varietyName) {
  const key = String(varietyName || '').trim().toLowerCase();
  return VARIETY_COLOR_MAP[key] || '#9E8C78';
}

function getActivePromosFromSource(source) {
  const promoGroups = [source?.active_promos, source?.coupon_promos, source?.promos];
  const rawPromos = promoGroups.find((entry) => Array.isArray(entry)) || [];

  return rawPromos
    .map((promo) => {
      if (!promo) {
        return null;
      }

      if (typeof promo === 'string') {
        return promo.trim() || null;
      }

      return String(promo.title || promo.name || promo.code || promo.description || '').trim() || null;
    })
    .filter(Boolean);
}

function getTypePillTheme(type) {
  return TYPE_PILL_THEME[String(type || '').toLowerCase()] || {
    bg: 'rgba(90, 72, 54, 0.13)',
    border: 'rgba(90, 72, 54, 0.3)',
    text: '#5A4836',
  };
}

function getTypeDisplayLabel(item) {
  if (item?.displayType) {
    return item.displayType;
  }
  const type = String(item?.type || '').trim().toLowerCase();
  if (!type) {
    return 'Establishment';
  }
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

function getSearchMatchScore(item, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    return 0;
  }

  const name = String(item.name || '').toLowerCase();
  const type = String(item.displayType || '').toLowerCase();
  const address = String(item.address || '').toLowerCase();
  const barangay = String(item.raw?.barangay || '').toLowerCase();
  const varieties = (item.coffeeVarieties || []).map((v) => String(v).toLowerCase());

  if (name === q) {
    return 120;
  }

  if (name.startsWith(q)) {
    return 100;
  }

  if (name.includes(q)) {
    return 80;
  }

  if (type.startsWith(q) || barangay.startsWith(q)) {
    return 60;
  }

  if (type.includes(q) || barangay.includes(q)) {
    return 50;
  }

  if (varieties.some((v) => v.includes(q))) {
    return 40;
  }

  if (address.includes(q)) {
    return 30;
  }

  return 0;
}

function getDistance(lat1, lon1, lat2, lon2) {
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

function formatDistanceKm(value) {
  return `${Math.max(0, Number(value) || 0).toFixed(1)} km`;
}

function formatEtaMinutes(value) {
  const mins = Math.max(0, Math.round(Number(value) || 0));
  if (mins < 60) {
    return `${mins} mins`;
  }

  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (!rem) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hr${hours > 1 ? 's' : ''} ${rem} mins`;
}

function estimateEtaFromDistance(distanceKm) {
  const averageKph = 22;
  const minutes = (Math.max(0, distanceKm) / averageKph) * 60;
  return Math.max(1, Math.round(minutes));
}

const TRAIL_REROUTE_MIN_DISTANCE_KM = 0.05;
const TRAIL_REROUTE_MIN_INTERVAL_MS = 10000;
const TRAIL_RESET_SIGNAL_KEY = 'trail_reset_signal_at';

function shouldRefreshTrailLeg(previousPoint, nextPoint, lastRefreshAt) {
  if (!previousPoint || !lastRefreshAt) {
    return true;
  }

  const movedKm = getDistance(
    previousPoint.latitude,
    previousPoint.longitude,
    nextPoint.latitude,
    nextPoint.longitude
  );
  const elapsedMs = Date.now() - lastRefreshAt;

  return movedKm >= TRAIL_REROUTE_MIN_DISTANCE_KM && elapsedMs >= TRAIL_REROUTE_MIN_INTERVAL_MS;
}

function normalizeTrailStop(stop, index) {
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
    id: source?.establishment_id ?? source?.id ?? stop?.id ?? index,
    name: source?.name || stop?.name || `Stop ${index + 1}`,
    type: String(source?.type || stop?.type || 'establishment').toLowerCase(),
    address: source?.address || stop?.address || 'Address not available',
    barangay,
    latitude: Number(source?.latitude ?? stop?.latitude),
    longitude: Number(source?.longitude ?? stop?.longitude),
    distance_km: Number(source?.distance_km ?? stop?.distance_km ?? 0),
    eta_minutes: Number(source?.eta_minutes ?? stop?.eta_minutes ?? 0),
    why_recommended: source?.why_recommended || stop?.why_recommended || '',
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

export default function MapScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const sheetScrollRef = useRef(null);
  const ignoreMapPressUntilRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocationBusy, setIsLocationBusy] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState('');
  const [navigationError, setNavigationError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedVarieties, setSelectedVarieties] = useState([]);
  const [openFilterMenu, setOpenFilterMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [establishments, setEstablishments] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [trailState, setTrailState] = useState('not_started');
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [trailLegOrigin, setTrailLegOrigin] = useState(null);
  const [distanceRemaining, setDistanceRemaining] = useState('0.0 km');
  const [etaRemaining, setEtaRemaining] = useState('0 mins');
  const [showDestinationReachedModal, setShowDestinationReachedModal] = useState(false);
  const lastRerouteRef = useRef({
    point: null,
    at: 0,
  });

  const locationWatchRef = useRef(null);
  const trailPulseAnim = useRef(new Animated.Value(1)).current;
  const destinationPulseAnim = useRef(new Animated.Value(1)).current;

  const rawTrailStops = route?.params?.trailStops;
  const rawTrailOrigin = route?.params?.trailOrigin;
  const isTrailMode = Boolean(route?.params?.isTrailMode && Array.isArray(rawTrailStops) && rawTrailStops.length);

  const trailOrigin = useMemo(() => {
    const latitude = Number(rawTrailOrigin?.latitude ?? rawTrailOrigin?.lat);
    const longitude = Number(rawTrailOrigin?.longitude ?? rawTrailOrigin?.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  }, [rawTrailOrigin]);

  const trailStops = useMemo(
    () => (Array.isArray(rawTrailStops) ? rawTrailStops.map((stop, idx) => normalizeTrailStop(stop, idx)).filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)) : []),
    [rawTrailStops]
  );

  const currentTrailStop = useMemo(() => trailStops[currentStopIndex] || null, [trailStops, currentStopIndex]);
  const isOnLastTrailStop = currentStopIndex >= Math.max(trailStops.length - 1, 0);
  const isFinalDestinationFlow = trailState === 'arrived' && isOnLastTrailStop;
  const shouldHideTrailOverlays = showDestinationReachedModal || isFinalDestinationFlow;

  const trailItineraryCoordinates = useMemo(() => {
    const stopsCoordinates = trailStops.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude }));
    const origin = userLocation || trailOrigin;

    if (!origin) {
      return stopsCoordinates;
    }

    return [origin, ...stopsCoordinates];
  }, [trailStops, userLocation, trailOrigin]);

  const trailTotalDistance = useMemo(
    () => trailStops.reduce((sum, stop) => sum + (Number(stop.distance_km) || 0), 0),
    [trailStops]
  );
  const trailTotalEtaMinutes = useMemo(
    () =>
      trailStops.reduce((sum, stop) => {
        const stopEta = Number(stop.eta_minutes) || 0;
        if (stopEta > 0) {
          return sum + stopEta;
        }
        return sum + estimateEtaFromDistance(Number(stop.distance_km) || 0);
      }, 0),
    [trailStops]
  );
  const cafeTrailStops = useMemo(
    () => trailStops.filter((stop) => String(stop?.type || '').toLowerCase() === 'cafe'),
    [trailStops]
  );
  const shouldDisableNextStop = false;

  const panelAnimation = useRef(new Animated.Value(160)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const selectedEstablishment = useMemo(
    () => establishments.find((item) => item.id === selectedEstablishmentId) || null,
    [establishments, selectedEstablishmentId]
  );

  const availableVarieties = useMemo(() => {
    const set = new Set();
    establishments.forEach((item) => {
      (item.coffeeVarieties || []).forEach((v) => set.add(String(v).trim()));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [establishments]);

  const filteredEstablishments = useMemo(() => {
    const activeVarieties = selectedVarieties.map((v) => String(v).toLowerCase());
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return establishments.filter((item) => {
      const typeMatch = filter === 'all' ? true : item.type === filter;

      if (!typeMatch) {
        return false;
      }

      if (!activeVarieties.length) {
        if (!normalizedSearch) {
          return true;
        }
      }

      const searchText = [
        item.name,
        item.displayType,
        item.address,
        item.raw?.barangay,
        ...(item.coffeeVarieties || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const searchMatch = normalizedSearch ? searchText.includes(normalizedSearch) : true;

      if (!searchMatch) {
        return false;
      }

      if (!activeVarieties.length) {
        return true;
      }

      const varieties = (item.coffeeVarieties || []).map((v) => String(v).toLowerCase());
      return activeVarieties.some((variety) => varieties.includes(variety));
    });
  }, [establishments, filter, selectedVarieties, searchQuery]);

  useEffect(() => {
    let isMounted = true;

    const requestLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission?.granted) {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          setUserLocation({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
        }
      } catch {
        // Keep map usable even if location access fails.
      } finally {
        if (isMounted) {
          setIsLocationBusy(false);
        }
      }
    };

    requestLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    Animated.spring(panelAnimation, {
      toValue: selectedEstablishment ? 0 : 160,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
    dragY.setValue(0);
  }, [panelAnimation, selectedEstablishment]);

  useEffect(() => {
    if (!isTrailMode) {
      setTrailState('not_started');
      setCurrentStopIndex(0);
      setTrailLegOrigin(null);
      setDistanceRemaining('0.0 km');
      setEtaRemaining('0 mins');
      return;
    }

    setTrailState('not_started');
    setCurrentStopIndex(0);
    setTrailLegOrigin(userLocation || trailOrigin || null);
    setIsDetailsExpanded(false);
    setSelectedEstablishmentId(null);
    setOpenFilterMenu(null);
    setRouteCoordinates([]);
  }, [isTrailMode, trailOrigin]);

  useEffect(() => {
    if (!isTrailMode || !trailStops.length || !mapRef.current) {
      return;
    }

    if (trailState === 'navigating' && routeCoordinates.length > 1) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 130, right: 50, bottom: 220, left: 50 },
        animated: true,
      });
      return;
    }

    mapRef.current.fitToCoordinates(trailItineraryCoordinates, {
      edgePadding: { top: 130, right: 50, bottom: 220, left: 50 },
      animated: true,
    });
  }, [isTrailMode, trailItineraryCoordinates, trailState, routeCoordinates]);

  useEffect(() => {
    if (!(isTrailMode && trailState === 'not_started' && currentTrailStop)) {
      return;
    }

    const origin = userLocation || trailOrigin;
    const seedDistance = origin
      ? getDistance(origin.latitude, origin.longitude, currentTrailStop.latitude, currentTrailStop.longitude)
      : Number(currentTrailStop.distance_km) || 0;

    setDistanceRemaining(formatDistanceKm(seedDistance));
    setEtaRemaining(formatEtaMinutes(estimateEtaFromDistance(seedDistance)));
  }, [isTrailMode, trailState, currentTrailStop, userLocation, trailOrigin]);

  const fetchDirectionPolyline = async (origin, destination) => {
    const response = await api.post('/api/mobile/navigation/directions', {
      origin: {
        lat: origin.latitude,
        lng: origin.longitude,
      },
      destination: {
        lat: destination.latitude,
        lng: destination.longitude,
      },
    });

    const polyline = response?.data?.polyline;
    if (!polyline) {
      throw new Error('No route data returned.');
    }

    const decoded = decodePolyline(polyline);
    return decoded.length > 1 ? decoded : buildFallbackRoute(origin, destination);
  };

  useEffect(() => {
    if (!(isTrailMode && trailState === 'navigating' && currentTrailStop)) {
      return;
    }

    const origin = trailLegOrigin || userLocation || trailOrigin;
    if (!origin) {
      return;
    }

    let isMounted = true;

    const loadTrailLegPolyline = async () => {
      try {
        const nextRoute = await fetchDirectionPolyline(origin, {
          latitude: currentTrailStop.latitude,
          longitude: currentTrailStop.longitude,
        });

        if (!isMounted) {
          return;
        }

        setRouteCoordinates(nextRoute);
      } catch {
        if (!isMounted) {
          return;
        }

        setRouteCoordinates(
          buildFallbackRoute(origin, {
            latitude: currentTrailStop.latitude,
            longitude: currentTrailStop.longitude,
          })
        );
      }
    };

    loadTrailLegPolyline();

    return () => {
      isMounted = false;
    };
  }, [isTrailMode, trailState, currentTrailStop, trailLegOrigin, trailOrigin, userLocation]);

  useEffect(() => {
    if (!(isTrailMode && trailState === 'navigating')) {
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
      return;
    }

    let isMounted = true;
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
        timeInterval: 4000,
      },
      (position) => {
        if (!isMounted) {
          return;
        }

        const nextUser = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(nextUser);

        if (shouldRefreshTrailLeg(lastRerouteRef.current.point, nextUser, lastRerouteRef.current.at)) {
          setTrailLegOrigin(nextUser);
          lastRerouteRef.current = {
            point: nextUser,
            at: Date.now(),
          };
        }

        if (!currentTrailStop) {
          return;
        }

        const remainingKm = getDistance(
          nextUser.latitude,
          nextUser.longitude,
          currentTrailStop.latitude,
          currentTrailStop.longitude
        );

        setDistanceRemaining(formatDistanceKm(remainingKm));
        setEtaRemaining(formatEtaMinutes(estimateEtaFromDistance(remainingKm)));

        if (remainingKm < 0.1) {
          setRouteCoordinates([]);
          setTrailState('arrived');
        }
      }
    )
      .then((subscription) => {
        if (!isMounted) {
          subscription.remove();
          return;
        }
        locationWatchRef.current = subscription;
      })
      .catch(() => {
        setNavigationError('Unable to track location for trail navigation.');
      });

    return () => {
      isMounted = false;
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
    };
  }, [isTrailMode, trailState, currentTrailStop]);

  useEffect(() => {
    if (!(isTrailMode && trailState === 'navigating')) {
      trailPulseAnim.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(trailPulseAnim, {
          toValue: 1.22,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(trailPulseAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [isTrailMode, trailState, trailPulseAnim]);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isVertical && Math.abs(gestureState.dy) > 6;
      },
      onPanResponderMove: (_, gestureState) => {
        // Resist overscroll upwards while still allowing pull-down gesture.
        const limitedDy = Math.max(-120, Math.min(220, gestureState.dy));
        dragY.setValue(limitedDy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;

        if (dy < -45 || vy < -0.8) {
          setIsDetailsExpanded(true);
        } else if (dy > 45 || vy > 0.8) {
          setIsDetailsExpanded(false);
        }

        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 6,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 6,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    fetchEstablishments();
  }, []);

  useEffect(() => {
    if (!route?.params?.highlightId || !establishments.length || isTrailMode) {
      return;
    }

    const highlight = establishments.find(
      (item) => String(item.raw?.id ?? '').trim() === String(route.params.highlightId).trim()
    );

    if (!highlight) {
      return;
    }

    handleMarkerSelect(highlight);
    mapRef.current?.animateToRegion(
      constrainRegion({
        latitude: highlight.latitude,
        longitude: highlight.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }),
      320
    );
  }, [route?.params?.highlightId, establishments, isTrailMode]);

  const handleRegionChangeComplete = (region) => {
    const constrained = constrainRegion(region);
    if (regionHasMeaningfulDiff(region, constrained) && mapRef.current) {
      mapRef.current.animateToRegion(constrained, 120);
    }
  };

  const fetchEstablishments = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await getEstablishments();
      const payload = Array.isArray(response)
        ? response
        : response?.features || response?.data || response?.establishments || [];

      const normalized = payload
        .map((item, index) => normalizeEstablishment(item, index))
        .filter(Boolean);

      setEstablishments(normalized);
      setSelectedEstablishmentId((current) =>
        current && normalized.some((item) => item.id === current) ? current : null
      );
    } catch (fetchError) {
      setError(fetchError?.message || 'Failed to load establishments.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigatePress = async (item) => {
    setNavigationError('');

    if (isDetailsExpanded) {
      setIsDetailsExpanded(false);
    }

    sheetScrollRef.current?.scrollTo({ y: 0, animated: true });

    if (!userLocation) {
      setNavigationError('Location is required to navigate. Please allow location access.');
      return;
    }

    setIsNavigating(true);

    try {
      const nextRoute = await fetchDirectionPolyline(userLocation, {
        latitude: item.latitude,
        longitude: item.longitude,
      });

      setRouteCoordinates(nextRoute);

      if (nextRoute.length > 1 && mapRef.current) {
        mapRef.current.fitToCoordinates(nextRoute, {
          edgePadding: { top: 90, right: 40, bottom: 300, left: 40 },
          animated: true,
        });
      }
    } catch (navigateError) {
      const status = navigateError?.response?.status;
      const message = navigateError?.response?.data?.message || navigateError?.message;

      if (status === 401) {
        setNavigationError('Session expired. Please log in again.');
      } else {
        setNavigationError(message || 'Unable to load in-app navigation route.');
      }
    } finally {
      setIsNavigating(false);
    }
  };

  const handleViewDetails = (item) => {
    setSelectedEstablishmentId(item.id);
    setIsDetailsExpanded(true);
  };

  const handleMarkerSelect = (item) => {
    ignoreMapPressUntilRef.current = Date.now() + 320;
    setSelectedEstablishmentId(item.id);
    setIsDetailsExpanded(false);
    setOpenFilterMenu(null);
  };

  const handleDismissSheet = () => {
    setSelectedEstablishmentId(null);
    setNavigationError('');
    setIsDetailsExpanded(false);
  };

  const toggleVarietyFilter = (varietyName) => {
    const key = String(varietyName).toLowerCase();
    setSelectedVarieties((prev) => {
      const has = prev.some((item) => String(item).toLowerCase() === key);
      if (has) {
        return prev.filter((item) => String(item).toLowerCase() !== key);
      }
      return [...prev, varietyName];
    });
  };

  const handleMapPress = () => {
    Keyboard.dismiss();
    setOpenFilterMenu(null);

    if (Date.now() < ignoreMapPressUntilRef.current) {
      return;
    }

    handleDismissSheet();
  };

  const handleClearRoute = () => {
    setRouteCoordinates([]);

    if (!mapRef.current || !selectedEstablishment) {
      return;
    }

    const fallbackRegion = constrainRegion({
      latitude: selectedEstablishment.latitude,
      longitude: selectedEstablishment.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    });

    if (userLocation) {
      mapRef.current.fitToCoordinates(
        [
          userLocation,
          {
            latitude: selectedEstablishment.latitude,
            longitude: selectedEstablishment.longitude,
          },
        ],
        {
          edgePadding: { top: 90, right: 40, bottom: 300, left: 40 },
          animated: true,
        }
      );
      return;
    }

    mapRef.current.animateToRegion(fallbackRegion, 220);
  };

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
    setOpenFilterMenu(null);

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return;
    }

    const rankedMatches = filteredEstablishments
      .map((item) => ({ item, score: getSearchMatchScore(item, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const bestMatch = rankedMatches[0]?.item;

    if (!bestMatch || !mapRef.current) {
      return;
    }

    setRouteCoordinates([]);
    setNavigationError('');
    setSelectedEstablishmentId(bestMatch.id);
    setIsDetailsExpanded(false);
    ignoreMapPressUntilRef.current = Date.now() + 360;

    const targetRegion = constrainRegion({
      latitude: bestMatch.latitude,
      longitude: bestMatch.longitude,
      latitudeDelta: 0.022,
      longitudeDelta: 0.022,
    });

    mapRef.current.animateToRegion(targetRegion, 360);
  };

  const handleRecenterPress = async () => {
    Keyboard.dismiss();
    setOpenFilterMenu(null);
    handleDismissSheet();
    sheetScrollRef.current?.scrollTo({ y: 0, animated: true });

    let nextLocation = userLocation;

    try {
      if (!nextLocation) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission?.granted) {
          setNavigationError('Location permission is needed to recenter map.');
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        nextLocation = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };

        setUserLocation(nextLocation);
      }

      if (!mapRef.current || !nextLocation) {
        return;
      }

      setNavigationError('');

      const region = constrainRegion({
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        latitudeDelta: 0.018,
        longitudeDelta: 0.018,
      });

      mapRef.current.animateToRegion(region, 340);
    } catch {
      setNavigationError('Unable to get your current location.');
    }
  };

  const handleStartTrail = () => {
    if (!trailStops.length) {
      return;
    }

    const firstStop = trailStops[0];
    const origin = userLocation || trailOrigin;

    setCurrentStopIndex(0);
    setTrailLegOrigin(origin || null);
    if (origin) {
      lastRerouteRef.current = {
        point: origin,
        at: Date.now(),
      };
    }
    setTrailState('navigating');

    const seedDistance = origin
      ? getDistance(origin.latitude, origin.longitude, firstStop.latitude, firstStop.longitude)
      : Number(firstStop.distance_km) || 0;

    setDistanceRemaining(formatDistanceKm(seedDistance));
    setEtaRemaining(formatEtaMinutes(estimateEtaFromDistance(seedDistance)));
  };

  const handleOpenNativeMaps = async () => {
    if (!currentTrailStop) {
      return;
    }

    const origin = userLocation || trailOrigin;
    const originQuery = origin ? `${origin.latitude},${origin.longitude}` : null;
    const destinationQuery = `${currentTrailStop.latitude},${currentTrailStop.longitude}`;

    const url = Platform.select({
      ios: originQuery
        ? `maps://app?saddr=${originQuery}&daddr=${destinationQuery}`
        : `maps://app?daddr=${destinationQuery}`,
      android: `google.navigation:q=${destinationQuery}`,
      default: originQuery
        ? `https://www.google.com/maps/dir/?api=1&origin=${originQuery}&destination=${destinationQuery}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`,
    });

    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      setNavigationError('Unable to open native maps app.');
    }
  };

  const resetTrailMode = async () => {
    try {
      await AsyncStorage.setItem(TRAIL_RESET_SIGNAL_KEY, String(Date.now()));
    } catch {
      // Avoid blocking trail exit if persisting reset signal fails.
    }

    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }

    setTrailState('not_started');
    setCurrentStopIndex(0);
    setTrailLegOrigin(null);
    setRouteCoordinates([]);
    lastRerouteRef.current = {
      point: null,
      at: 0,
    };
    setDistanceRemaining('0.0 km');
    setEtaRemaining('0 mins');
    setNavigationError('');

    navigation?.setParams?.({
      isTrailMode: false,
      trailStops: undefined,
      highlightId: undefined,
    });
  };

  const handleStopTrail = () => {
    Alert.alert('Stop Trail?', 'Are you sure you want to stop your coffee trail?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => {
          void resetTrailMode();
        },
      },
    ]);
  };

  const handleLastStopReached = () => {
    if (!currentTrailStop) {
      return;
    }

    setDistanceRemaining('0.0 km');
    setEtaRemaining('0 mins');
    setTrailLegOrigin({
      latitude: currentTrailStop.latitude,
      longitude: currentTrailStop.longitude,
    });
    setRouteCoordinates([]);
    setTrailState('arrived');
  };

  useEffect(() => {
    if (!(isTrailMode && trailState === 'arrived' && isOnLastTrailStop)) {
      setShowDestinationReachedModal(false);
      destinationPulseAnim.setValue(1);
      return;
    }

    setShowDestinationReachedModal(true);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(destinationPulseAnim, {
          toValue: 1.08,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(destinationPulseAnim, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    const timerId = setTimeout(() => {
      setShowDestinationReachedModal(false);
      void resetTrailMode();

      if (cafeTrailStops.length) {
        navigation?.navigate?.('Rating', { trailStops: cafeTrailStops });
        return;
      }

      navigation?.navigate?.('Trail');
    }, 6000);

    return () => {
      clearTimeout(timerId);
      pulse.stop();
      destinationPulseAnim.setValue(1);
    };
  }, [isTrailMode, trailState, isOnLastTrailStop, destinationPulseAnim, cafeTrailStops, navigation]);

  const handleNextDestination = () => {
    if (currentStopIndex >= trailStops.length - 1) {
      return;
    }

    const nextIndex = currentStopIndex + 1;
    const previousStop = trailStops[currentStopIndex];
    const nextStop = trailStops[nextIndex];
    const previousStopOrigin =
      Number.isFinite(previousStop?.latitude) && Number.isFinite(previousStop?.longitude)
        ? {
            latitude: previousStop.latitude,
            longitude: previousStop.longitude,
          }
        : null;
    const origin = previousStopOrigin || userLocation || trailOrigin;

    setCurrentStopIndex(nextIndex);
    setTrailLegOrigin(origin || null);
    if (origin) {
      lastRerouteRef.current = {
        point: origin,
        at: Date.now(),
      };
    }
    setTrailState('navigating');

    const seedDistance = origin
      ? getDistance(origin.latitude, origin.longitude, nextStop.latitude, nextStop.longitude)
      : Number(nextStop.distance_km) || 0;

    setDistanceRemaining(formatDistanceKm(seedDistance));
    setEtaRemaining(formatEtaMinutes(estimateEtaFromDistance(seedDistance)));
  };

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={LIPA_REGION}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {!isTrailMode && routeCoordinates.length > 1 ? (
          <>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#FFFFFF"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
              zIndex={9}
            />
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#378ADD"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              zIndex={10}
            />
          </>
        ) : null}

        {isTrailMode && trailState === 'navigating' && routeCoordinates.length > 1 ? (
          <>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#FFFFFF"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
              zIndex={9}
            />
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#2D4A1E"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              zIndex={10}
            />
          </>
        ) : null}

        {isTrailMode && (trailState === 'not_started' || (trailState === 'navigating' && routeCoordinates.length <= 1)) && trailItineraryCoordinates.length > 1 ? (
          <>
            {currentStopIndex > 0 ? (
              <Polyline
                coordinates={trailItineraryCoordinates.slice(
                  0,
                  Math.min(currentStopIndex + 1, trailItineraryCoordinates.length)
                )}
                strokeColor="#6B7280"
                strokeWidth={3}
                lineDashPattern={[10, 5]}
                zIndex={7}
              />
            ) : null}
            <Polyline
              coordinates={trailItineraryCoordinates.slice(
                Math.min(currentStopIndex, Math.max(trailItineraryCoordinates.length - 1, 0))
              )}
              strokeColor="#2D4A1E"
              strokeWidth={3}
              lineDashPattern={[10, 5]}
              zIndex={8}
            />
          </>
        ) : null}

        {isTrailMode
          ? trailStops.map((stop, idx) => {
              const isCurrent = idx === currentStopIndex;

              return (
                <Marker
                  key={`trail-stop-${stop.id}-${idx}`}
                  coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                  tracksViewChanges={false}
                >
                  <Animated.View
                    style={[
                      styles.trailMarker,
                      isCurrent && trailState === 'navigating'
                        ? { transform: [{ scale: trailPulseAnim }] }
                        : null,
                      isCurrent ? styles.trailMarkerCurrent : null,
                    ]}
                  >
                    <Text style={styles.trailMarkerText}>{idx + 1}</Text>
                  </Animated.View>
                </Marker>
              );
            })
          : filteredEstablishments.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            pinColor={TYPE_PIN_COLORS[item.type] || BRAND.accent}
            onPress={() => handleMarkerSelect(item)}
            onSelect={() => handleMarkerSelect(item)}
          >
            <Callout onPress={() => handleViewDetails(item)}>
              <View style={styles.calloutWrap}>
                <Text style={styles.calloutName}>{item.name}</Text>
                <Text
                  style={[
                    styles.calloutTypePillText,
                    {
                      backgroundColor: getTypePillTheme(item.type).bg,
                      borderColor: getTypePillTheme(item.type).border,
                      color: getTypePillTheme(item.type).text,
                    },
                  ]}
                >
                  {getTypeDisplayLabel(item)}
                </Text>

                {item.type === 'cafe' ? (
                  <View style={styles.calloutInfoRow}>
                    <Text style={styles.calloutInfoLabel}>Overall Avg:</Text>
                    <Text style={styles.calloutRatingValue}>
                      ★ {item.reviewCount > 0 ? item.rating.toFixed(1) : '0.0'}
                    </Text>
                  </View>
                ) : null}

                {item.type === 'cafe' ? (
                  <View style={styles.calloutInfoRow}>
                    <Text style={styles.calloutInfoLabel}>Active Promo:</Text>
                    <Text style={styles.calloutPromoValue} numberOfLines={1} ellipsizeMode="tail">
                      {item.activePromos?.[0] || 'No active promo'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Callout>
          </Marker>
            ))}
      </MapView>

      {isTrailMode && !shouldHideTrailOverlays ? (
        <View style={[styles.trailTopBanner, { top: Math.max(insets.top + 8, 16) }]}>
          <View style={styles.trailTopHeaderRow}>
            <View style={styles.trailTopLeftWrap}>
              <Text style={styles.trailTopTitle}>Your Coffee Trail</Text>
              <Text style={styles.trailActiveStopLabel}>Current destination</Text>
              <Text style={styles.trailActiveStopText} numberOfLines={1}>
                {currentTrailStop?.name || 'Ready to start'}
              </Text>
            </View>

            <View style={styles.trailTopStatsWrap}>
              <Text style={styles.trailTopStopsText}>{trailStops.length} stops</Text>

              <View style={styles.trailTopMetaRow}>
                <View style={styles.trailKmMetaWrap}>
                  <MaterialIcons name="directions-car" size={13} color="#E8EDE6" />
                  <Text style={styles.trailTopMeta}>{trailTotalDistance.toFixed(1)} km total</Text>
                </View>

                <View style={styles.trailKmMetaWrap}>
                  <MaterialIcons name="access-time" size={13} color="#E8EDE6" />
                  <Text style={styles.trailTopMeta}>{formatEtaMinutes(trailTotalEtaMinutes)} overall</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {!isTrailMode && !isDetailsExpanded ? (
        <View style={[styles.overlayTop, { top: Math.max(insets.top + 6, 16) }]}> 
          <View style={styles.searchBarWrap}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, barangay, address..."
              placeholderTextColor="#8B7C6A"
              returnKeyType="search"
              blurOnSubmit
              onSubmitEditing={handleSearchSubmit}
              onFocus={() => setOpenFilterMenu(null)}
            />
            {searchQuery.trim().length ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                style={styles.searchClearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Text style={styles.searchClearText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterBar}>
            <Pressable
              style={styles.filterDropdownButton}
              onPress={() => {
                Keyboard.dismiss();
                setOpenFilterMenu((prev) => (prev === 'type' ? null : 'type'));
              }}
            >
              <Text style={styles.filterDropdownText}>
                Type: {TYPE_FILTER_OPTIONS.find((item) => item.key === filter)?.label || 'All'}
              </Text>
              <Text style={styles.filterDropdownChevron}>{openFilterMenu === 'type' ? '▲' : '▼'}</Text>
            </Pressable>

            <Pressable
              style={styles.filterDropdownButton}
              onPress={() => {
                Keyboard.dismiss();
                setOpenFilterMenu((prev) => (prev === 'variety' ? null : 'variety'));
              }}
            >
              <Text style={styles.filterDropdownText}>
                Varieties: {selectedVarieties.length ? selectedVarieties.length : 'All'}
              </Text>
              <Text style={styles.filterDropdownChevron}>{openFilterMenu === 'variety' ? '▲' : '▼'}</Text>
            </Pressable>
          </View>

          {openFilterMenu === 'type' ? (
            <View style={styles.dropdownPanel}>
              {TYPE_FILTER_OPTIONS.map((item) => {
                const isActive = filter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setFilter(item.key);
                      setOpenFilterMenu(null);
                    }}
                  >
                    <View style={[styles.dropdownDot, { backgroundColor: item.color }]} />
                    <Text style={styles.dropdownItemText}>{item.label}</Text>
                    {isActive ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {openFilterMenu === 'variety' ? (
            <View style={styles.dropdownPanel}>
              <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
                {availableVarieties.map((variety) => {
                  const color = getVarietyColor(variety);
                  const isActive = selectedVarieties.some(
                    (item) => String(item).toLowerCase() === String(variety).toLowerCase()
                  );
                  return (
                    <Pressable
                      key={variety}
                      style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                      onPress={() => {
                        Keyboard.dismiss();
                        toggleVarietyFilter(variety);
                      }}
                    >
                      <View style={[styles.dropdownDot, { backgroundColor: color }]} />
                      <Text style={styles.dropdownItemText}>{variety}</Text>
                      {isActive ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                style={styles.dropdownResetButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setSelectedVarieties([]);
                  setOpenFilterMenu(null);
                }}
              >
                <Text style={styles.dropdownResetText}>Reset Filters</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.resultCountWrap}>
            <Text style={styles.resultCountText}>
              Showing {filteredEstablishments.length} out of {establishments.length}
            </Text>
          </View>
        </View>
      ) : null}

      {openFilterMenu ? null : (
        <Pressable
          style={[
            styles.recenterButton,
            {
              top: isTrailMode
                ? Math.max(insets.top + 122, 128)
                : Math.max(insets.top + (isDetailsExpanded ? 10 : 172), isDetailsExpanded ? 14 : 156),
            },
          ]}
          onPress={handleRecenterPress}
          accessibilityRole="button"
          accessibilityLabel="Re-center to my location"
        >
          <MaterialIcons name="my-location" size={20} style={styles.recenterIcon} />
        </Pressable>
      )}

      {(isLoading || isLocationBusy) && (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={BRAND.accent} />
          <Text style={styles.stateText}>Loading map data...</Text>
        </View>
      )}

      {!isLoading && error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Unable to load map</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchEstablishments}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!isTrailMode ? (
        <Animated.View
        style={[
          styles.bottomSheet,
          isDetailsExpanded && styles.bottomSheetExpanded,
          { transform: [{ translateY: Animated.add(panelAnimation, dragY) }] },
        ]}
      >
        {selectedEstablishment ? (
          <>
            <View style={styles.dragHandleWrap} {...sheetPanResponder.panHandlers}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.sheetImageWrap}>
              {selectedEstablishment.image ? (
                <Image
                  source={{ uri: selectedEstablishment.image }}
                  style={[styles.sheetImage, isDetailsExpanded && styles.sheetImageExpanded]}
                />
              ) : (
                <View
                  style={[
                    styles.sheetImage,
                    styles.sheetImagePlaceholder,
                    isDetailsExpanded && styles.sheetImageExpanded,
                  ]}
                >
                  <Text style={styles.sheetImagePlaceholderText}>No Photo</Text>
                </View>
              )}

              <Pressable style={styles.sheetCloseButton} onPress={handleDismissSheet}>
                <Text style={styles.sheetCloseText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={sheetScrollRef}
              style={styles.sheetScrollView}
              contentContainerStyle={[
                styles.sheetContent,
                isDetailsExpanded && styles.sheetContentExpanded,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetTitle}>{selectedEstablishment.name}</Text>
              <Text style={styles.sheetAddress}>{selectedEstablishment.address}</Text>
              {selectedEstablishment.type === 'cafe' ? (
                <Text style={styles.sheetRating}>{formatStars(selectedEstablishment.rating)}</Text>
              ) : null}
              {!isDetailsExpanded && selectedEstablishment.type === 'cafe' ? (
                <View style={styles.sheetPromoWrap}>
                  <Text style={styles.sheetPromoLabel}>Active Promo:</Text>
                  <Text style={styles.sheetPromoValue} numberOfLines={1} ellipsizeMode="tail">
                    {selectedEstablishment.activePromos?.[0] || 'No active promo'}
                  </Text>
                </View>
              ) : null}
              {navigationError ? <Text style={styles.navigationError}>{navigationError}</Text> : null}

              <View style={styles.sheetActions}>
                <Pressable
                  style={[styles.actionButton, styles.directionsButton]}
                  onPress={() => handleNavigatePress(selectedEstablishment)}
                  disabled={isNavigating}
                >
                  <Text style={styles.actionButtonText}>
                    {isNavigating ? 'Getting directions...' : 'Navigate'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, styles.detailsButton]}
                  onPress={() => {
                    if (isDetailsExpanded) {
                      setIsDetailsExpanded(false);
                      return;
                    }

                    handleViewDetails(selectedEstablishment);
                  }}
                >
                  <Text style={[styles.actionButtonText, styles.detailsButtonText]}>
                    {isDetailsExpanded ? 'Show Less' : 'View Details'}
                  </Text>
                </Pressable>
              </View>

              {routeCoordinates.length > 1 ? (
                <Pressable style={styles.clearRouteButton} onPress={handleClearRoute}>
                  <Text style={styles.clearRouteText}>Clear Route</Text>
                </Pressable>
              ) : null}

              {isDetailsExpanded ? (
                <View style={styles.fullDetailsWrap}>
                  {selectedEstablishment.description ? (
                    <View style={styles.sectionBlock}>
                      <Text style={styles.sectionTitle}>Description</Text>
                      <Text style={styles.detailText}>{selectedEstablishment.description}</Text>
                    </View>
                  ) : null}

                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Information</Text>
                    <View style={styles.detailTypeRow}>
                      <Text style={styles.detailText}>Type:</Text>
                      <View
                        style={[
                          styles.typePill,
                          styles.typePillCompact,
                          {
                            backgroundColor: getTypePillTheme(selectedEstablishment.type).bg,
                            borderColor: getTypePillTheme(selectedEstablishment.type).border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typePillText,
                            styles.typePillCompactText,
                            { color: getTypePillTheme(selectedEstablishment.type).text },
                          ]}
                        >
                          {getTypeDisplayLabel(selectedEstablishment)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.detailText}>
                      Contact: {selectedEstablishment.contactNumber || 'N/A'}
                    </Text>
                    <Text style={styles.detailText}>Email: {selectedEstablishment.email || 'N/A'}</Text>
                    <Text style={styles.detailText}>Website: {selectedEstablishment.website || 'N/A'}</Text>
                    <Text style={styles.detailText}>
                      Visit Hours: {selectedEstablishment.visitHours || 'N/A'}
                    </Text>
                    <Text style={styles.detailText}>
                      Activities: {selectedEstablishment.activities || 'N/A'}
                    </Text>
                  </View>

                  {selectedEstablishment.type === 'cafe' ? (
                    <View style={styles.sectionBlock}>
                      <Text style={styles.sectionTitle}>Ratings</Text>
                      <Text style={styles.detailText}>
                        Average: {selectedEstablishment.rating.toFixed(1)} ({selectedEstablishment.reviewCount}{' '}
                        ratings)
                      </Text>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Taste:</Text>
                        <Text style={styles.metricStars}>{metricStars(selectedEstablishment.tasteAvg)}</Text>
                        <Text style={styles.metricValue}>{selectedEstablishment.tasteAvg.toFixed(1)}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Environment:</Text>
                        <Text style={styles.metricStars}>
                          {metricStars(selectedEstablishment.environmentAvg)}
                        </Text>
                        <Text style={styles.metricValue}>{selectedEstablishment.environmentAvg.toFixed(1)}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Cleanliness:</Text>
                        <Text style={styles.metricStars}>
                          {metricStars(selectedEstablishment.cleanlinessAvg)}
                        </Text>
                        <Text style={styles.metricValue}>{selectedEstablishment.cleanlinessAvg.toFixed(1)}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Service:</Text>
                        <Text style={styles.metricStars}>{metricStars(selectedEstablishment.serviceAvg)}</Text>
                        <Text style={styles.metricValue}>{selectedEstablishment.serviceAvg.toFixed(1)}</Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Coffee Varieties</Text>
                    {selectedEstablishment.coffeeVarieties.length ? (
                      <View style={styles.varietyChipsWrap}>
                        {selectedEstablishment.coffeeVarieties.map((variety) => {
                          const chipColor = getVarietyColor(variety);
                          return (
                            <View
                              key={variety}
                              style={[
                                styles.varietyChip,
                                {
                                  borderColor: `${chipColor}66`,
                                  borderLeftColor: chipColor,
                                  backgroundColor: `${chipColor}22`,
                                },
                              ]}
                            >
                              <View style={[styles.varietyDot, { backgroundColor: chipColor }]} />
                              <Text style={styles.varietyChipText}>{variety}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.detailText}>No varieties listed.</Text>
                    )}
                  </View>

                  {selectedEstablishment.type === 'cafe' ? (
                    <View style={styles.sectionBlock}>
                      <Text style={styles.sectionTitle}>Recent Ratings</Text>
                      {selectedEstablishment.recentReviews.length ? (
                        selectedEstablishment.recentReviews.map((review, index) => (
                          <View key={`${review.id || review.reviewer}-${index}`} style={styles.reviewCard}>
                            <Text style={styles.reviewAuthor}>{review.reviewer || 'Anonymous'}</Text>
                            <Text style={styles.reviewMeta}>
                              Taste: {Number(review.taste_rating || 0).toFixed(0)} | Environment: {Number(review.environment_rating || 0).toFixed(0)} | Cleanliness: {Number(review.cleanliness_rating || 0).toFixed(0)} | Service: {Number(review.service_rating || 0).toFixed(0)}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.detailText}>No recent ratings available.</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}

            </ScrollView>
          </>
        ) : null}
        </Animated.View>
      ) : null}

      {isTrailMode && currentTrailStop && !shouldHideTrailOverlays ? (
        <View style={[styles.trailBottomPanel, { paddingBottom: Math.max(insets.bottom + 10, 16) }]}>
          {trailState === 'navigating' ? (
            <Text style={styles.trailNavHeader}>
              Navigating to Stop {Math.min(currentStopIndex + 1, trailStops.length)} of {trailStops.length}
            </Text>
          ) : null}

          <View style={styles.trailStopRow}>
            <View style={styles.trailStopBadge}>
              <Text style={styles.trailStopBadgeText}>{Math.min(currentStopIndex + 1, trailStops.length)}</Text>
            </View>
            <View style={styles.trailStopTextWrap}>
              <Text style={styles.trailStopName}>{currentTrailStop.name}</Text>
              <Text style={styles.trailStopAddress}>
                {formatAddressWithBarangay(currentTrailStop.address, currentTrailStop.barangay)}
              </Text>
            </View>
          </View>

          <View style={styles.trailMetaRow}>
            <View style={styles.trailMetaWithIcon}>
              <MaterialIcons name="directions-car" size={14} color="#2D4A1E" />
              <Text style={styles.trailMetaText}>{distanceRemaining}</Text>
            </View>
            <View style={styles.trailMetaWithIcon}>
              <MaterialIcons name="access-time" size={14} color="#2D4A1E" />
              <Text style={styles.trailMetaText}>{etaRemaining}</Text>
            </View>
          </View>

          {trailState === 'not_started' ? (
            <Pressable style={styles.trailPrimaryBtn} onPress={handleStartTrail}>
              <Text style={styles.trailPrimaryBtnText}>Start Trail</Text>
            </Pressable>
          ) : null}

          {trailState === 'navigating' ? (
            <View style={styles.trailActionsRow}>
              {!isOnLastTrailStop ? (
                <Pressable style={styles.trailStopBtn} onPress={handleStopTrail}>
                  <Text style={styles.trailStopBtnText}>Stop</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.trailPrimaryBtn, shouldDisableNextStop && styles.trailPrimaryBtnDisabled]}
                onPress={isOnLastTrailStop ? handleLastStopReached : handleNextDestination}
                disabled={shouldDisableNextStop}
              >
                <View style={styles.trailButtonContentRow}>
                  <Text style={styles.trailPrimaryBtnText}>{isOnLastTrailStop ? 'Reached Destination' : 'Next Stop'}</Text>
                  <MaterialIcons
                    name={isOnLastTrailStop ? 'check-circle' : 'arrow-forward'}
                    size={16}
                    color="#FFFFFF"
                  />
                </View>
              </Pressable>
            </View>
          ) : null}

          {trailState === 'arrived' ? (
            <>
              <Text style={styles.arrivedTitle}>You've arrived! ☕</Text>
              <Text style={styles.arrivedName}>{currentTrailStop.name}</Text>

              {currentStopIndex < trailStops.length - 1 ? (
                <View style={styles.trailActionsRow}>
                  <Pressable style={styles.trailStopBtn} onPress={handleStopTrail}>
                    <Text style={styles.trailStopBtnText}>Stop Trail</Text>
                  </Pressable>
                  <Pressable style={styles.trailPrimaryBtn} onPress={handleNextDestination}>
                    <Text style={styles.trailPrimaryBtnText}>Next Destination →</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.completeTitle}>Yay! You have reached your destination.</Text>
                  <Text style={styles.completeText}>Preparing your quick rating flow...</Text>
                  <View style={styles.trailActionsRow}>
                    <Pressable style={styles.trailStopBtnFull} onPress={handleStopTrail}>
                      <Text style={styles.trailStopBtnText}>Stop</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </>
          ) : null}
        </View>
      ) : null}

      <Modal visible={showDestinationReachedModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.destinationModalBackdrop}>
          <View style={styles.destinationModalCard}>
            <Animated.View
              style={[
                styles.destinationModalIconWrap,
                { transform: [{ scale: destinationPulseAnim }] },
              ]}
            >
              <MaterialIcons name="celebration" size={22} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.destinationModalTitle}>Yay! You have reached your destination.</Text>
            <Text style={styles.destinationModalSubtitle}>
              {cafeTrailStops.length ? 'Opening ratings...' : 'Returning to trail...'}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  overlayTop: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
  },
  trailTopBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 16,
    backgroundColor: '#2D4A1E',
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  trailTopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  trailTopLeftWrap: {
    flex: 1,
    minWidth: 0,
  },
  trailTopTitle: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 15,
    lineHeight: 20,
  },
  trailTopStatsWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  trailTopStopsText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 17,
    lineHeight: 21,
  },
  trailTopMeta: {
    color: '#E8EDE6',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  trailTopMetaRow: {
    alignItems: 'flex-end',
    gap: 3,
  },
  trailKmMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trailActiveStopLabel: {
    marginTop: 7,
    color: 'rgba(255, 255, 255, 0.78)',
    fontFamily: 'PoppinsMedium',
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  trailActiveStopText: {
    marginTop: 4,
    color: '#C8973A',
    fontFamily: 'PoppinsBold',
    fontSize: 14,
    lineHeight: 19,
  },
  trailMarker: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  trailMarkerCurrent: {
    width: 34,
    height: 34,
  },
  trailMarkerText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 14,
  },
  trailBottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#D9D2C8',
    paddingHorizontal: 14,
    paddingTop: 13,
    zIndex: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  trailNavHeader: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 16,
    marginBottom: 8,
  },
  trailStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trailStopBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailStopBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 14,
  },
  trailStopTextWrap: {
    flex: 1,
  },
  trailStopName: {
    color: '#1C1C1C',
    fontFamily: 'PoppinsBold',
    fontSize: 14,
    lineHeight: 18,
  },
  trailStopAddress: {
    marginTop: 3,
    color: '#6B7280',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 16,
  },
  trailStopBarangay: {
    marginTop: 2,
    color: '#2D4A1E',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
  },
  trailMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  trailMetaWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trailMetaText: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
  },
  trailActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  trailPrimaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 0,
  },
  trailPrimaryBtnDisabled: {
    opacity: 0.55,
  },
  trailButtonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trailPrimaryBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 16,
  },
  trailStopBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  trailStopBtnFull: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  trailStopBtnText: {
    color: '#DC2626',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 16,
  },
  trailSecondaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 0,
  },
  trailSecondaryBtnText: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 16,
  },
  arrivedTitle: {
    marginTop: 12,
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
  },
  arrivedName: {
    marginTop: 4,
    color: '#1C1C1C',
    fontFamily: 'PoppinsBold',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  completeTitle: {
    marginTop: 12,
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  completeText: {
    marginTop: 4,
    color: '#6B7280',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
  },
  destinationModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 21, 14, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  destinationModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9D2C8',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  destinationModalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationModalTitle: {
    marginTop: 12,
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  destinationModalSubtitle: {
    marginTop: 6,
    color: '#6B7280',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  recenterButton: {
    position: 'absolute',
    right: 12,
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(46, 90, 61, 0.38)',
    backgroundColor: 'rgba(46, 90, 61, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 21,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  recenterIcon: {
    color: BRAND.accentDark,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D2C5B3',
    backgroundColor: 'rgba(243, 233, 215, 0.96)',
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    color: BRAND.text,
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 6,
  },
  searchClearButton: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    paddingHorizontal: 2,
  },
  searchClearText: {
    color: BRAND.accent,
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  filterDropdownButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D2C5B3',
    backgroundColor: 'rgba(243, 233, 215, 0.96)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterDropdownText: {
    color: BRAND.text,
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
  },
  filterDropdownChevron: {
    color: '#6A5A4B',
    fontFamily: 'PoppinsBold',
    fontSize: 11,
    lineHeight: 14,
  },
  dropdownPanel: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D2C5B3',
    backgroundColor: 'rgba(243, 233, 215, 0.98)',
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  dropdownList: {
    maxHeight: 180,
  },
  dropdownItem: {
    minHeight: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dropdownItemActive: {
    backgroundColor: '#EFE2CF',
  },
  dropdownDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  dropdownItemText: {
    flex: 1,
    color: BRAND.text,
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 16,
  },
  dropdownCheck: {
    color: '#2E5A3D',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 16,
  },
  dropdownResetButton: {
    marginTop: 4,
    marginHorizontal: 10,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E5A3D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F2EA',
  },
  dropdownResetText: {
    color: '#2E5A3D',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  resultCountWrap: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  resultCountText: {
    color: BRAND.accent,
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
    backgroundColor: 'rgba(46, 90, 61, 0.14)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(46, 90, 61, 0.32)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  centerState: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '40%',
    borderRadius: 16,
    backgroundColor: 'rgba(243, 233, 215, 0.96)',
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 18,
    alignItems: 'center',
  },
  stateText: {
    marginTop: 8,
    color: BRAND.text,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'PoppinsRegular',
  },
  errorTitle: {
    color: BRAND.text,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'PoppinsBold',
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: BRAND.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: BRAND.white,
    fontSize: 14,
    fontFamily: 'PoppinsMedium',
  },
  calloutWrap: {
    minWidth: 210,
    maxWidth: 250,
    paddingVertical: 6,
  },
  calloutName: {
    color: BRAND.text,
    fontFamily: 'PoppinsBold',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 3,
  },
  typePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 7,
  },
  typePillText: {
    fontFamily: 'PoppinsBold',
    fontSize: 11,
    lineHeight: 14,
  },
  typePillCompact: {
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  typePillCompactText: {
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 15,
  },
  calloutTypePillText: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 7,
    fontFamily: 'PoppinsBold',
    fontSize: 11,
    lineHeight: 14,
    overflow: 'hidden',
  },
  detailTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calloutInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  calloutInfoLabel: {
    color: '#6A5B4C',
    fontFamily: 'PoppinsMedium',
    fontSize: 11,
    lineHeight: 14,
  },
  calloutInfoValue: {
    color: BRAND.text,
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  calloutRatingValue: {
    color: '#8B4513',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 15,
  },
  calloutPromoValue: {
    flex: 1,
    color: BRAND.accentDark,
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BRAND.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: BRAND.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  bottomSheetExpanded: {
    maxHeight: '84%',
  },
  dragHandleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#EFE2CF',
  },
  dragHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#B8A894',
  },
  sheetImage: {
    width: '100%',
    height: 132,
    backgroundColor: '#D8D2C6',
  },
  sheetImageExpanded: {
    height: 170,
  },
  sheetImageWrap: {
    position: 'relative',
  },
  sheetCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 20,
    lineHeight: 20,
    marginTop: -1,
  },
  sheetImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetImagePlaceholderText: {
    color: BRAND.text,
    fontFamily: 'PoppinsMedium',
    fontSize: 14,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  sheetContentExpanded: {
    paddingBottom: 26,
  },
  sheetScrollView: {
    maxHeight: 520,
  },
  sheetTitle: {
    color: BRAND.text,
    fontFamily: 'PoppinsBold',
    fontSize: 19,
    lineHeight: 24,
  },
  sheetAddress: {
    marginTop: 4,
    color: BRAND.text,
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 18,
  },
  sheetRating: {
    marginTop: 8,
    color: '#8B4513',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 18,
  },
  sheetPromoWrap: {
    marginTop: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(46, 90, 61, 0.25)',
    backgroundColor: 'rgba(46, 90, 61, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetPromoLabel: {
    color: BRAND.accentDark,
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  sheetPromoValue: {
    flex: 1,
    color: BRAND.accent,
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 15,
  },
  sheetActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  navigationError: {
    marginTop: 8,
    color: '#9B3E3E',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 16,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  directionsButton: {
    backgroundColor: BRAND.accent,
  },
  detailsButton: {
    backgroundColor: BRAND.white,
    borderWidth: 1,
    borderColor: BRAND.accent,
  },
  actionButtonText: {
    color: BRAND.white,
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 16,
  },
  detailsButtonText: {
    color: BRAND.accent,
    fontFamily: 'PoppinsMedium',
  },
  clearRouteButton: {
    marginTop: 10,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearRouteText: {
    color: '#8B4513',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
  fullDetailsWrap: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#DDCFBD',
    paddingTop: 12,
    gap: 14,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 18,
  },
  detailText: {
    color: '#4B3B2D',
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    width: 86,
    color: '#4B3B2D',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
  },
  metricStars: {
    color: '#F5C518',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  metricValue: {
    color: '#6A5A4B',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 16,
  },
  varietyChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  varietyChip: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  varietyDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  varietyChipText: {
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  reviewCard: {
    marginTop: 6,
    backgroundColor: '#F7F2EA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9C9B2',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reviewAuthor: {
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
  },
  reviewMeta: {
    marginTop: 2,
    color: '#6A5A4B',
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
    lineHeight: 15,
  },
});
