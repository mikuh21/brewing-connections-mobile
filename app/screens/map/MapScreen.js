import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Callout, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context';
import {
  api,
  getCouponPromos,
  getApiErrorMessage,
  getLocationChecks,
  getEstablishments,
  getProducts,
  submitLocationCheck,
  trackMapMarkerView,
} from '../../services';

const LIPA_REGION = {
  latitude: 13.9411,
  longitude: 121.1631,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const LIPA_BOUNDS = {
  minLatitude: 4.5,
  maxLatitude: 21.5,
  minLongitude: 116.0,
  maxLongitude: 127.0,
};

const MAP_DELTA_LIMITS = {
  // Mirror web-side zoom constraints roughly: minZoom 10, maxZoom 18.
  minDelta: 0.0015,
  maxDelta: 0.36,
};

const TYPE_FILTER_OPTIONS = [
  { key: 'all', label: 'All', color: '#3A2E22', icon: 'place', iconLibrary: 'material' },
  { key: 'farm', label: 'Farms', color: '#2D4A1E', icon: 'eco', iconLibrary: 'material' },
  { key: 'cafe', label: 'Cafes', color: '#8B4513', icon: 'local-cafe', iconLibrary: 'material' },
  { key: 'roaster', label: 'Roasters', color: '#C8973A', icon: 'local-fire-department', iconLibrary: 'material' },
  { key: 'reseller', label: 'Resellers', color: '#1E40AF', icon: 'seed', iconLibrary: 'community' },
];

const TYPE_PIN_COLORS = {
  farm: '#2D4A1E',
  cafe: '#8B4513',
  roaster: '#C8973A',
  reseller: '#1E40AF',
};

const TYPE_MARKER_ICONS = {
  farm: { icon: 'eco', iconLibrary: 'material' },
  cafe: { icon: 'local-cafe', iconLibrary: 'material' },
  roaster: { icon: 'local-fire-department', iconLibrary: 'material' },
  reseller: { icon: 'seed', iconLibrary: 'community' },
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

const ABOUT_VARIETY_CONTENT = [
  {
    key: 'arabica',
    title: 'Arabica',
    scientificName: 'Coffea arabica',
    color: VARIETY_COLOR_MAP.arabica,
    imageSource: require('../../../assets/ARABICA.png'),
    overview:
      'Arabica is the most widely consumed coffee species in the world, prized for its superior quality and complex flavors. It is often considered premium coffee due to its smooth, balanced, and aromatic profile.',
    tasteProfile: ['Smooth, mild, and aromatic', 'Notes: fruity, floral, slightly sweet', 'Lower bitterness'],
    characteristics: ['Grown in high altitudes', 'Lower caffeine content than Robusta', 'More delicate and harder to cultivate'],
    reference: 'Philippine Coffee Board; CoffeeBeans.ph',
  },
  {
    key: 'excelsa',
    title: 'Excelsa',
    scientificName: 'Coffea excelsa / Liberica var.',
    color: VARIETY_COLOR_MAP.excelsa,
    imageSource: require('../../../assets/EXCELSA.png'),
    overview:
      'Excelsa is often classified as a variety of Liberica and is valued for adding depth and complexity to coffee blends. It is less commonly consumed on its own but plays an important role in enhancing flavor profiles.',
    tasteProfile: ['Tart, fruity, and slightly dark', 'Notes: berry-like, tangy', 'Adds complexity to blends'],
    characteristics: ['Grown mostly in Southeast Asia', 'Contributes depth rather than used alone', 'Distinct light-to-dark flavor contrast'],
    reference: 'CoffeeBeans.ph',
  },
  {
    key: 'liberica',
    title: 'Liberica',
    scientificName: 'Coffea liberica',
    color: VARIETY_COLOR_MAP.liberica,
    imageSource: require('../../../assets/LIBERICA.png'),
    overview:
      'Liberica is a rare coffee species globally but holds cultural and agricultural importance in the Philippines. It is known for its distinctive aroma and unique flavor that sets it apart from more common varieties.',
    tasteProfile: ['Smoky, woody, sometimes floral', 'Unique, complex flavor', 'Slightly fruity with a bold body'],
    characteristics: ['Large, irregular beans', 'Thrives in tropical climates', 'Limited production worldwide'],
    reference: 'CoffeeBeans.ph',
  },
  {
    key: 'robusta',
    title: 'Robusta',
    scientificName: 'Coffea canephora',
    color: VARIETY_COLOR_MAP.robusta,
    imageSource: require('../../../assets/ROBUSTA.png'),
    overview:
      'Robusta is known for its strong, bold flavor and is commonly used in instant coffee and espresso blends. It is easier to grow and more resilient, making it a practical choice for large-scale production.',
    tasteProfile: ['Bold, strong, and bitter', 'Notes: earthy, nutty, woody', 'Less acidity'],
    characteristics: ['Higher caffeine content', 'Grows in lower altitudes', 'More resistant to pests and diseases'],
    reference: 'CoffeeBeans.ph',
  },
];
;

// Decode an encoded Google polyline string into an array of {latitude, longitude}
// See: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];

  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = null;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
}

function clamp(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return Number.isFinite(min) ? min : 0;
  }
  if (Number.isFinite(min) && numericValue < min) {
    return min;
  }
  if (Number.isFinite(max) && numericValue > max) {
    return max;
  }
  return numericValue;
}

function parseCoordinate(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value || '').trim();
  if (!s) return null;
  // Allow comma decimals, strip non-numeric characters except dot, minus, plus, and exponent
  const cleaned = s.replace(/,/g, '.').replace(/[^0-9+\-\.eE]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function constrainRegion(region) {
  if (!region || typeof region !== 'object') {
    return LIPA_REGION;
  }

  const latitude = Number(region.latitude ?? region.lat ?? LIPA_REGION.latitude);
  const longitude = Number(region.longitude ?? region.lng ?? LIPA_REGION.longitude);
  const latitudeDelta = clamp(region.latitudeDelta ?? region.latDelta ?? MAP_DELTA_LIMITS.maxDelta, MAP_DELTA_LIMITS.minDelta, MAP_DELTA_LIMITS.maxDelta);
  const longitudeDelta = clamp(region.longitudeDelta ?? region.lngDelta ?? MAP_DELTA_LIMITS.maxDelta, MAP_DELTA_LIMITS.minDelta, MAP_DELTA_LIMITS.maxDelta);

  return {
    latitude: Number.isFinite(latitude) ? latitude : LIPA_REGION.latitude,
    longitude: Number.isFinite(longitude) ? longitude : LIPA_REGION.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

function regionHasMeaningfulDiff(original, constrained) {
  if (!original || !constrained) {
    return false;
  }

  return (
    Math.abs((original.latitude ?? 0) - (constrained.latitude ?? 0)) > 0.000001 ||
    Math.abs((original.longitude ?? 0) - (constrained.longitude ?? 0)) > 0.000001 ||
    Math.abs((original.latitudeDelta ?? 0) - (constrained.latitudeDelta ?? 0)) > 0.000001 ||
    Math.abs((original.longitudeDelta ?? 0) - (constrained.longitudeDelta ?? 0)) > 0.000001
  );
}

async function geocodePhilippines(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) {
    return null;
  }

  const normalizedQuery = query
    .replace(/\b(city|lipa|batangas|philippines)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const mapboxToken = String(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '').trim();
  if (mapboxToken) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedQuery)}.json?access_token=${encodeURIComponent(mapboxToken)}&country=ph&autocomplete=true&limit=5&language=en`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Mapbox geocode failed: ${response.status}`);
      }
      const json = await response.json();
      const feature = Array.isArray(json?.features) ? json.features[0] : null;
      if (feature && Array.isArray(feature.center) && feature.center.length >= 2) {
        const [lng, lat] = feature.center;
        return {
          lat: Number(lat),
          lng: Number(lng),
          placeName: String(feature.place_name || feature.text || query),
          bounds:
            Array.isArray(feature.bbox) && feature.bbox.length >= 4
              ? {
                  west: Number(feature.bbox[0]),
                  south: Number(feature.bbox[1]),
                  east: Number(feature.bbox[2]),
                  north: Number(feature.bbox[3]),
                }
              : null,
        };
      }
    } catch {
      // Fallback to Nominatim below.
    }
  }

  return geocodePhilippinesNominatim(query);
}

async function geocodePhilippinesNominatim(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&countrycodes=ph&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BrewingConnectionsApp/1.0 (+https://brewing-hub.online)',
      },
    });
    if (!response.ok) {
      throw new Error('Nominatim geocode failed');
    }
    const results = await response.json();
    if (!Array.isArray(results) || !results.length) {
      return null;
    }
    const entry = results[0];
    const lat = Number(entry.lat);
    const lng = Number(entry.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return {
      lat,
      lng,
      placeName: String(entry.display_name || query),
      bounds:
        Array.isArray(entry.boundingbox) && entry.boundingbox.length === 4
          ? {
              south: Number(entry.boundingbox[0]),
              north: Number(entry.boundingbox[1]),
              west: Number(entry.boundingbox[2]),
              east: Number(entry.boundingbox[3]),
            }
          : null,
    };
  } catch {
    return null;
  }
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

function buildPromoDiscountText(promo) {
  if (!promo) {
    return '';
  }

  const discountType = String(promo.discount_type || promo.type || '').trim().toLowerCase();
  const rawValue = promo.discount_value ?? promo.value ?? promo.amount ?? promo.fixed_amount;
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

  const explicit = String(promo.discount_text || promo.discount || '').trim();
  if (explicit) {
    return explicit;
  }

  return '';
}

function getActivePromoDetailsFromSource(source) {
  const promoGroups = [source?.active_promos, source?.coupon_promos, source?.promos];
  const rawPromos = promoGroups.find((entry) => Array.isArray(entry)) || [];

  return rawPromos
    .map((promo, promoIndex) => {
      if (!promo) {
        return null;
      }

      if (typeof promo === 'string') {
        const title = promo.trim();
        if (!title) {
          return null;
        }

        return {
          id: title,
          title,
          discount: '',
          description: '',
        };
      }

      const title = String(promo.title || promo.name || promo.code || '').trim();
      const discount = buildPromoDiscountText(promo);
      const description = String(promo.description || promo.discount_description || '').trim();

      if (!title && !discount && !description) {
        return null;
      }

      return {
        id: String(promo.id || promo.code || title || description || `promo-${promoIndex}`),
        title: title || description || 'Active Promo',
        discount,
        description,
      };
    })
    .filter((promo, index, list) => {
      const signature = `${String(promo.title || '').toLowerCase()}|${String(promo.discount || '').toLowerCase()}|${String(promo.description || '').toLowerCase()}`;
      return (
        list.findIndex((entry) => {
          const entrySignature = `${String(entry.title || '').toLowerCase()}|${String(entry.discount || '').toLowerCase()}|${String(entry.description || '').toLowerCase()}`;
          return entrySignature === signature;
        }) === index
      );
    });
}

function getActivePromosFromSource(source) {
  return getActivePromoDetailsFromSource(source)
    .map((promo) => promo.title)
    .filter(Boolean);
}

function buildPromoIndexByEstablishment(promos) {
  if (!Array.isArray(promos)) {
    return {};
  }

  return promos.reduce((index, promo, promoIndex) => {
    if (!promo) {
      return index;
    }

    const establishmentId =
      promo?.establishment_id ??
      promo?.establishment?.id ??
      promo?.establishmentId ??
      promo?.establishment?.establishment_id;

    if (establishmentId === undefined || establishmentId === null || establishmentId === '') {
      return index;
    }

    const key = String(establishmentId);
    const title = String(promo?.title || promo?.name || promo?.code || promo?.coupon_code || promo?.qr_code_token || promo?.description || 'Active Promo').trim();
    const description = String(promo?.description || promo?.discount_description || promo?.discount_text || '').trim();

    const normalizedPromo = {
      id: String(promo?.id ?? promo?.code ?? promo?.coupon_code ?? promo?.qr_code_token ?? `promo-${key}-${promoIndex}`),
      title: title || 'Active Promo',
      discount: buildPromoDiscountText(promo),
      description,
      raw: promo,
    };

    if (!index[key]) {
      index[key] = [];
    }

    index[key].push(normalizedPromo);
    return index;
  }, {});
}

function normalizeEstablishment(item, index, promoIndexByEstablishment = {}) {
  const source = item?.properties || item || {};
  const raw = source?.raw || item || {};

  const id =
    source?.id ??
    source?.establishment_id ??
    raw?.id ??
    raw?.establishment_id ??
    index;

  const type = String(source?.type || source?.establishment_type || 'establishment').trim().toLowerCase();

  const latitude = parseCoordinate(
    source?.latitude ?? source?.lat ?? raw?.latitude ?? raw?.lat ?? 
    item?.geometry?.coordinates?.[1]
  );
  const longitude = parseCoordinate(
    source?.longitude ?? source?.lng ?? raw?.longitude ?? raw?.lng ?? 
    item?.geometry?.coordinates?.[0]
  );

  const promoIdKey = String(id);
  const externalActivePromoDetails = promoIndexByEstablishment[promoIdKey] || [];
  const sourceActivePromoDetails = getActivePromoDetailsFromSource(source);
  const activePromoDetails = [...sourceActivePromoDetails, ...externalActivePromoDetails].filter(Boolean);

  const uniquePromoDetails = activePromoDetails.filter((promo, promoIndex, list) => {
    const signature = `${String(promo.id || promo.title || promo.description || promo.discount).toLowerCase()}|${String(promo.title || '').toLowerCase()}|${String(promo.description || '').toLowerCase()}`;
    return list.findIndex((other) => {
      const otherSignature = `${String(other.id || other.title || other.description || other.discount).toLowerCase()}|${String(other.title || '').toLowerCase()}|${String(other.description || '').toLowerCase()}`;
      return otherSignature === signature;
    }) === promoIndex;
  });

  return {
    id,
    raw: source,
    name: source?.name || source?.establishment_name || raw?.name || 'Establishment',
    type,
    address: source?.address || source?.location || 'Address not available',
    barangay: source?.barangay || source?.barangay_name || source?.barangayName || raw?.barangay || raw?.barangay_name || raw?.barangayName || '',
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    image: source?.image || source?.photo || source?.image_url || source?.imageUrl || null,
    imageCandidates: [source?.image, source?.photo, source?.image_url, source?.imageUrl].filter(Boolean),
    description: source?.description || raw?.description || '',
    contactNumber: source?.contact_number || source?.phone || source?.contact || '',
    email: source?.email || '',
    website: source?.website || source?.url || '',
    visitHours: source?.visit_hours || source?.hours || '',
    activities: source?.activities || '',
    rating: Number(source?.rating_average ?? source?.rating ?? source?.average_rating ?? 0) || 0,
    reviewCount: Number(source?.review_count ?? source?.reviews_count ?? 0) || 0,
    tasteAvg: Number(source?.taste_avg ?? source?.taste_rating ?? 0) || 0,
    environmentAvg: Number(source?.environment_avg ?? source?.environment_rating ?? 0) || 0,
    cleanlinessAvg: Number(source?.cleanliness_avg ?? source?.cleanliness_rating ?? 0) || 0,
    serviceAvg: Number(source?.service_avg ?? source?.service_rating ?? 0) || 0,
    productRatings: Array.isArray(source?.product_ratings) ? source.product_ratings : [],
    recentReviews: Array.isArray(source?.recent_reviews) ? source.recent_reviews : [],
    coffeeVarieties: Array.isArray(source?.coffee_varieties) ? source.coffee_varieties : [],
    activePromos: uniquePromoDetails.map((promo) => promo.title).filter(Boolean),
    activePromoDetails: uniquePromoDetails,
  };
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

function getProductsByType(type) {
  const normalizedType = String(type || '').trim().toLowerCase();

  if (normalizedType === 'cafe') {
    return ['Iced Coffee', 'Hot Coffee', 'Food'];
  }

  return ['Coffee Beans', 'Ground Coffee'];
}

const BREWING_HUB_INFO_URL = 'https://brewing-hub.online';

function getEstablishmentRecipientId(source) {
  const candidates = [
    source?.seller_id,
    source?.owner_id,
    source?.user_id,
    source?.owner_user_id,
    source?.establishment_owner_id,
    source?.seller?.user_id,
    source?.seller?.id,
    source?.owner?.id,
    source?.user?.id,
    source?.raw?.seller_id,
    source?.raw?.owner_id,
    source?.raw?.user_id,
    source?.raw?.owner_user_id,
    source?.raw?.establishment_owner_id,
    source?.raw?.seller?.user_id,
    source?.raw?.seller?.id,
    source?.raw?.owner?.id,
    source?.raw?.user?.id,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function getEstablishmentParticipantName(source) {
  const candidates = [
    source?.seller_name,
    source?.owner_name,
    source?.user_name,
    source?.seller?.name,
    source?.owner?.name,
    source?.user?.name,
    source?.raw?.seller_name,
    source?.raw?.owner_name,
    source?.raw?.user_name,
    source?.raw?.seller?.name,
    source?.raw?.owner?.name,
    source?.raw?.user?.name,
    source?.name,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function renderTypeIcon(icon, iconLibrary, color, size = 12) {
  if (iconLibrary === 'community') {
    return <MaterialCommunityIcons name={icon} size={size} color={color} />;
  }

  return <MaterialIcons name={icon} size={size} color={color} />;
}

// Lightweight memoized Marker component to avoid re-renders when unrelated state changes.
const MemoMarker = React.memo(function MemoMarker({ item, isSelected, onSelect, onViewDetails, markerRenderScope, tracksViewChanges = false }) {
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);
  const handleViewDetailsPress = useCallback(() => onViewDetails(item), [onViewDetails, item]);

  return (
    <Marker
      key={`${markerRenderScope}-${item.id}-${Platform.OS}`}
      coordinate={{ latitude: item.latitude, longitude: item.longitude }}
      tracksViewChanges={tracksViewChanges}
      onPress={handlePress}
      onSelect={handlePress}
    >
      <View
        style={[
          styles.establishmentMarker,
          { backgroundColor: TYPE_PIN_COLORS[item.type] || BRAND.accent },
        ]}
      >
        {renderTypeIcon(
          TYPE_MARKER_ICONS[item.type]?.icon || 'place',
          TYPE_MARKER_ICONS[item.type]?.iconLibrary || 'material',
          '#FFFFFF',
          TYPE_MARKER_ICONS[item.type]?.iconLibrary === 'community' ? 15 : 16
        )}
      </View>
      {Platform.OS === 'ios' ? (
        <Callout onPress={() => onViewDetails(item)}>
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
      ) : null}
    </Marker>
  );
}, (prev, next) => {
  // Only re-render when id, selection or render-scope changes
  return (
    prev.item.id === next.item.id &&
    prev.item.latitude === next.item.latitude &&
    prev.item.longitude === next.item.longitude &&
    prev.isSelected === next.isSelected &&
    prev.markerRenderScope === next.markerRenderScope &&
    prev.tracksViewChanges === next.tracksViewChanges
  );
});

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

const ROUTE_CONSUME_MAX_SNAP_DISTANCE_KM = 0.15;
const ROUTE_CONSUME_ARRIVAL_DISTANCE_KM = 0.05;
const TRAIL_REROUTE_MIN_DISTANCE_KM = 0.05;
const TRAIL_REROUTE_MIN_INTERVAL_MS = 10000;
const TRAIL_ARRIVAL_RADIUS_KM = 0.1;
const TRAIL_RESET_SIGNAL_KEY = 'trail_reset_signal_at';
const TRAIL_ACTIVE_STATE_KEY_PREFIX = 'coffee_trail_active_state:';
const SAVED_ESTABLISHMENTS_KEY = 'saved_establishments';
const DOWNLOADED_VARIETIES_KEY = 'offline_saved_varieties';

function projectPointOnSegment(point, start, end) {
  const segmentLat = end.latitude - start.latitude;
  const segmentLng = end.longitude - start.longitude;
  const segmentLengthSquared = segmentLat * segmentLat + segmentLng * segmentLng;

  if (segmentLengthSquared <= 0) {
    return start;
  }

  const projectedRatio = clamp(
    ((point.latitude - start.latitude) * segmentLat +
      (point.longitude - start.longitude) * segmentLng) /
      segmentLengthSquared,
    0,
    1
  );

  return {
    latitude: start.latitude + segmentLat * projectedRatio,
    longitude: start.longitude + segmentLng * projectedRatio,
  };
}

function getNearestRouteProjection(route, point) {
  if (!Array.isArray(route) || route.length < 2 || !point) {
    return null;
  }

  let bestMatch = null;

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index];
    const end = route[index + 1];
    const projectedPoint = projectPointOnSegment(point, start, end);
    const distanceKm = getDistance(
      point.latitude,
      point.longitude,
      projectedPoint.latitude,
      projectedPoint.longitude
    );

    if (!bestMatch || distanceKm < bestMatch.distanceKm) {
      bestMatch = {
        segmentIndex: index,
        projectedPoint,
        distanceKm,
      };
    }
  }

  return bestMatch;
}

function dedupeConsecutiveCoordinates(coordinates) {
  return coordinates.filter((point, index, collection) => {
    if (!point) {
      return false;
    }

    if (index === 0) {
      return true;
    }

    const previous = collection[index - 1];
    return (
      Math.abs(point.latitude - previous.latitude) > 0.000001 ||
      Math.abs(point.longitude - previous.longitude) > 0.000001
    );
  });
}

function trimConsumedRoute(route, currentLocation, destination) {
  if (!Array.isArray(route) || route.length < 2 || !currentLocation) {
    return route;
  }

  const nearestMatch = getNearestRouteProjection(route, currentLocation);
  if (!nearestMatch || nearestMatch.distanceKm > ROUTE_CONSUME_MAX_SNAP_DISTANCE_KM) {
    return route;
  }

  const remainingRoute = dedupeConsecutiveCoordinates([
    currentLocation,
    ...route.slice(nearestMatch.segmentIndex + 1),
  ]);

  if (!destination || !remainingRoute.length) {
    return remainingRoute.length > 1 ? remainingRoute : route;
  }

  const lastPoint = remainingRoute[remainingRoute.length - 1];
  const destinationDistanceKm = getDistance(
    lastPoint.latitude,
    lastPoint.longitude,
    destination.latitude,
    destination.longitude
  );

  if (destinationDistanceKm <= 0.005) {
    return remainingRoute.length > 1 ? remainingRoute : route;
  }

  const completedRoute = dedupeConsecutiveCoordinates([...remainingRoute, destination]);
  return completedRoute.length > 1 ? completedRoute : route;
}

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
    establishment_id: source?.establishment_id ?? source?.establishmentId ?? source?.id ??
      raw?.establishment_id ?? raw?.id ?? stop?.establishment_id ?? stop?.establishmentId ?? stop?.id ?? null,
    sequence: Number(source?.sequence ?? stop?.sequence ?? index + 1),
    trivia_history: getTrailTriviaHistory(
      source?.trivia_history,
      source?.establishment?.trivia_history,
      source?.raw?.trivia_history,
      raw?.trivia_history,
      stop?.trivia_history,
      stop?.establishment?.trivia_history
    ),
    raw: source?.raw || source,
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

function getProductsList(response) {
  let result = response;
  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(result)) {
      return result;
    }
    if (Array.isArray(result?.products)) {
      return result.products;
    }
    if (Array.isArray(result?.data)) {
      return result.data;
    }
    result = result?.data;
  }
  return [];
}

function getTrailTriviaHistory(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function getTrailVarieties(establishment) {
  const varieties =
    establishment?.varieties ??
    establishment?.coffee_varieties ??
    establishment?.coffeeVarieties ??
    establishment?.variety ??
    [];
  const list = Array.isArray(varieties) ? varieties : [varieties];
  return list
    .map((variety) => {
      if (typeof variety === 'string' || typeof variety === 'number') {
        return String(variety).trim();
      }
      return String(
        variety?.name ?? variety?.variety_name ?? variety?.varietyName ?? variety?.title ?? ''
      ).trim();
    })
    .filter(Boolean);
}

function getProductEstablishmentId(product) {
  return (
    product?.establishment_id ??
    product?.establishmentId ??
    product?.establishment?.id ??
    product?.establishment?.establishment_id ??
    product?.raw?.establishment_id ??
    null
  );
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

function normalizeWebsiteUrl(websiteValue) {  
  const raw = String(websiteValue || '').trim();
  if (!raw) {
    return '';
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}

export default function MapScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { logout } = useAuth();
  const authLogoutRef = useRef(logout);
  authLogoutRef.current = logout;
  const mapRef = useRef(null);
  const sheetScrollRef = useRef(null);
  const ignoreMapPressUntilRef = useRef(0);
  const mapSessionIdRef = useRef(`map-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const lastTrackedMarkerRef = useRef({ id: null, at: 0 });
  const lastAnimateRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocationBusy, setIsLocationBusy] = useState(false);
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
  const [androidCalloutPos, setAndroidCalloutPos] = useState(null);
  const [androidCalloutLayout, setAndroidCalloutLayout] = useState(null);
  const [trailState, setTrailState] = useState('not_started');
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isTrailRestoring, setIsTrailRestoring] = useState(false);
  const [locationChecks, setLocationChecks] = useState([]);
  const [isLocationChecksLoading, setIsLocationChecksLoading] = useState(false);
  const [locationChecksError, setLocationChecksError] = useState('');
  const [selectedLocationResponse, setSelectedLocationResponse] = useState(null);
  const [isSavingLocationCheck, setIsSavingLocationCheck] = useState(false);
  const [locationCheckError, setLocationCheckError] = useState('');
  const [locationCheckNotice, setLocationCheckNotice] = useState('');
  const [locationTrackingStatus, setLocationTrackingStatus] = useState('');
  const [locationTrackingRetry, setLocationTrackingRetry] = useState(0);
  const [trailLegOrigin, setTrailLegOrigin] = useState(null);
  const [distanceRemaining, setDistanceRemaining] = useState('0.0 km');
  const [etaRemaining, setEtaRemaining] = useState('0 mins');
  const [activeSheetImageUri, setActiveSheetImageUri] = useState(null);
  const [activeSheetImageIndex, setActiveSheetImageIndex] = useState(0);
  const [savedEstablishments, setSavedEstablishments] = useState([]);
  const [downloadedVarieties, setDownloadedVarieties] = useState([]);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [savedToastMessage, setSavedToastMessage] = useState('Saved to Favorites');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showBeanPreviewModal, setShowBeanPreviewModal] = useState(false);
  const [beanPreviewSource, setBeanPreviewSource] = useState(ABOUT_VARIETY_CONTENT[0]?.imageSource || null);
  const [showTrailTriviaPanel, setShowTrailTriviaPanel] = useState(false);
  const [trailTriviaRecord, setTrailTriviaRecord] = useState(null);
  const [trailTriviaRecordId, setTrailTriviaRecordId] = useState(null);
  const [trailTriviaProducts, setTrailTriviaProducts] = useState([]);
  const [isTrailTriviaLoading, setIsTrailTriviaLoading] = useState(false);
  const [trailTriviaError, setTrailTriviaError] = useState('');
  const [trailTriviaRequestVersion, setTrailTriviaRequestVersion] = useState(0);
  const [trailBottomPanelHeight, setTrailBottomPanelHeight] = useState(220);
  const trailTriviaProductsCacheRef = useRef(null);
  const trailTriviaProductsRequestRef = useRef(null);
  const lastRerouteRef = useRef({
    point: null,
    at: 0,
  });
  const trailResumeLoadedKeyRef = useRef(null);
  const arrivalStopKeyRef = useRef(null);
  const locationCheckSubmissionRef = useRef(false);
  const trailAdvanceRef = useRef(false);
  const savedToastTimeoutRef = useRef(null);
  const navigationDestinationRef = useRef(null);

  const locationWatchRef = useRef(null);
  const trailPulseAnim = useRef(new Animated.Value(1)).current;
  const heartTapAnim = useRef(new Animated.Value(1)).current;
  const savedToastOpacity = useRef(new Animated.Value(0)).current;
  const aboutPulseAnim = useRef(new Animated.Value(1)).current;
  const beanPreviewAnim = useRef(new Animated.Value(0)).current;
  const trailTriviaSlideAnim = useRef(new Animated.Value(1)).current;
  const locationValidationAnim = useRef(new Animated.Value(0)).current;
  const trailTriviaRequestIdRef = useRef(0);
  const locationChecksRequestIdRef = useRef(0);
  const loadTrailTriviaProducts = useCallback(() => {
    if (Array.isArray(trailTriviaProductsCacheRef.current)) {
      return Promise.resolve(trailTriviaProductsCacheRef.current);
    }

    if (!trailTriviaProductsRequestRef.current) {
      trailTriviaProductsRequestRef.current = getProducts()
        .then((response) => {
          const products = getProductsList(response);
          trailTriviaProductsCacheRef.current = products;
          return products;
        })
        .finally(() => {
          trailTriviaProductsRequestRef.current = null;
        });
    }

    return trailTriviaProductsRequestRef.current;
  }, []);

  const rawTrailStops = route?.params?.trailStops;
  const rawTrailOrigin = route?.params?.trailOrigin;
  const trailId = route?.params?.trailId ?? route?.params?.trail_id ?? null;
  const isTrailMode = Boolean(route?.params?.isTrailMode && Array.isArray(rawTrailStops) && rawTrailStops.length);
  const activeTrailStorageKey = trailId === null || trailId === undefined
    ? null
    : `${TRAIL_ACTIVE_STATE_KEY_PREFIX}${trailId}`;
  const trailPositionStorageKey = activeTrailStorageKey || 'coffee_trail_active_state:unpersisted';
  const isTrailPositionReady =
    !isTrailMode || trailResumeLoadedKeyRef.current === trailPositionStorageKey;

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
  const currentStopSequence = Number(currentTrailStop?.sequence ?? currentStopIndex + 1);
  const currentLocationCheck = locationChecks.find(
    (check) =>
      String(check?.trail_id ?? check?.coffee_trail_id ?? '') === String(trailId ?? '') &&
      Number(check?.stop_sequence) === currentStopSequence &&
      String(check?.establishment_id ?? '') === String(currentTrailStop?.establishment_id ?? '')
  ) || null;
  const isCurrentLocationCheckSaved = Boolean(currentLocationCheck?.response);
  const shouldDisableNextStop =
    isTrailRestoring ||
    !isTrailPositionReady ||
    isLocationChecksLoading ||
    isSavingLocationCheck ||
    (trailState === 'arrived' && !isCurrentLocationCheckSaved);
  const refreshLocationChecks = useCallback(async () => {
    const requestId = locationChecksRequestIdRef.current + 1;
    locationChecksRequestIdRef.current = requestId;

    if (!trailId) {
      setLocationChecks([]);
      setLocationChecksError('This trail is missing its saved server ID. Please generate a new trail before verifying locations.');
      setIsLocationChecksLoading(false);
      return;
    }

    setIsLocationChecksLoading(true);
    setLocationChecksError('');
    try {
      const response = await getLocationChecks(trailId);
      if (locationChecksRequestIdRef.current === requestId) {
        setLocationChecks(response);
      }
    } catch (requestError) {
      if (locationChecksRequestIdRef.current === requestId) {
        if (requestError?.response?.status === 401) {
          void authLogoutRef.current().catch((logoutError) => {
            console.warn('Unable to clear expired mobile session', logoutError);
          });
        }
        setLocationChecksError(getApiErrorMessage(requestError, 'load saved location checks'));
      }
    } finally {
      if (locationChecksRequestIdRef.current === requestId) {
        setIsLocationChecksLoading(false);
      }
    }
  }, [trailId]);

  useEffect(() => {
    if (!isTrailMode) {
      locationChecksRequestIdRef.current += 1;
      setLocationChecks([]);
      setLocationChecksError('');
      setIsLocationChecksLoading(false);
      return;
    }

    void refreshLocationChecks();
  }, [isTrailMode, refreshLocationChecks]);

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
  const shouldRenderCoffeeTrailMarkers = Boolean(isTrailMode && Array.isArray(trailStops) && trailStops.length);
  const coffeeTrailMarkerStops = useMemo(() => {
    const markerStops = (Array.isArray(trailStops) ? trailStops : []).map((stop, index) => {
      const candidateLatitude = Number(
        stop?.latitude ??
          stop?.lat ??
          stop?.location?.latitude ??
          stop?.coordinates?.latitude ??
          stop?.properties?.latitude ??
          stop?.establishment?.latitude ??
          stop?.establishment?.coords?.latitude ??
          0
      );
      const candidateLongitude = Number(
        stop?.longitude ??
          stop?.lng ??
          stop?.location?.longitude ??
          stop?.coordinates?.longitude ??
          stop?.properties?.longitude ??
          stop?.establishment?.longitude ??
          stop?.establishment?.coords?.longitude ??
          0
      );
      const latitude = Number(candidateLatitude);
      const longitude = Number(candidateLongitude);
      const id = stop?.establishment_id ?? stop?.establishmentId ?? stop?.id ?? stop?.establishment?.id ?? index;
      const name = stop?.name ?? stop?.establishment?.name ?? `Stop ${index + 1}`;

      return {
        index,
        number: index + 1,
        id,
        name,
        latitude,
        longitude,
      };
    });

    return markerStops.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude));
  }, [trailStops]);

  const panelAnimation = useRef(new Animated.Value(160)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const aboutDragY = useRef(new Animated.Value(0)).current;
  const isDetailsExpandedRef = useRef(false);
  const lastMapRegionRef = useRef(LIPA_REGION);

  const selectedEstablishment = useMemo(
    () => establishments.find((item) => item.id === selectedEstablishmentId) || null,
    [establishments, selectedEstablishmentId]
  );

  useEffect(() => {
    // On Android, compute screen point for the selected establishment so we can render
    // an absolute overlay outside the MapView (prevent native callout clipping).
    if (Platform.OS !== 'android') {
      setAndroidCalloutPos(null);
      return;
    }

    let mounted = true;
    const updatePosition = async () => {
      try {
        if (!mapRef.current || !selectedEstablishment) {
          if (mounted) setAndroidCalloutPos(null);
          return;
        }

        const coord = { latitude: Number(selectedEstablishment.latitude), longitude: Number(selectedEstablishment.longitude) };
        if (typeof mapRef.current.pointForCoordinate === 'function') {
          const point = await mapRef.current.pointForCoordinate(coord);
          if (mounted) setAndroidCalloutPos(point || null);
          return;
        }

        // Fallback: clear position if projection not available.
        if (mounted) setAndroidCalloutPos(null);
      } catch (err) {
        if (mounted) setAndroidCalloutPos(null);
      }
    };

    // compute once and also when map size changes
    updatePosition();

    return () => {
      mounted = false;
    };
  }, [selectedEstablishmentId, selectedEstablishment]);

  useEffect(() => {
    isDetailsExpandedRef.current = isDetailsExpanded;
  }, [isDetailsExpanded]);

  useEffect(() => {
    const nextCandidates = selectedEstablishment?.imageCandidates || [];
    setActiveSheetImageIndex(0);
    setActiveSheetImageUri(nextCandidates[0] || selectedEstablishment?.image || null);
  }, [selectedEstablishment]);

  const handleSheetImageError = () => {
    const candidates = selectedEstablishment?.imageCandidates || [];
    const nextIndex = activeSheetImageIndex + 1;

    if (nextIndex < candidates.length) {
      setActiveSheetImageIndex(nextIndex);
      setActiveSheetImageUri(candidates[nextIndex]);
      return;
    }

    setActiveSheetImageUri(null);
  };

  const availableVarieties = useMemo(() => {
    const set = new Set();
    establishments.forEach((item) => {
      (item.coffeeVarieties || []).forEach((v) => set.add(String(v).trim()));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [establishments]);

  const selectedVarietiesLabel = useMemo(() => {
    if (!selectedVarieties.length) {
      return 'All';
    }

    const normalizedSelected = selectedVarieties.map((item) => String(item).toLowerCase());
    const selectedNames = availableVarieties.filter((item) =>
      normalizedSelected.includes(String(item).toLowerCase())
    );

    const names = selectedNames.length
      ? selectedNames
      : selectedVarieties.map((item) => String(item).trim()).filter(Boolean);

    if (!names.length) {
      return 'All';
    }

    const uniqueNames = Array.from(new Set(names));
    const allSelected =
      availableVarieties.length > 0 && uniqueNames.length >= availableVarieties.length;

    if (allSelected) {
      return 'All';
    }

    if (uniqueNames.length === 1) {
      return uniqueNames[0];
    }

    if (uniqueNames.length === 2) {
      return `${uniqueNames[0]}, ${uniqueNames[1]}`;
    }

    if (uniqueNames.length === 3) {
      return `${uniqueNames[0]}, ${uniqueNames[1]}, ${uniqueNames[2]}`;
    }

    return `${uniqueNames[0]}, ${uniqueNames[1]} +${uniqueNames.length - 2}`;
  }, [selectedVarieties, availableVarieties]);

  // markerRenderScope and markerTracksViewChanges removed — markers will be
  // rendered directly to ensure Android renders custom view markers reliably.

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

  const isSelectedEstablishmentSaved = useMemo(() => {
    if (!selectedEstablishment) {
      return false;
    }

    return savedEstablishments.some((item) => item?.id === selectedEstablishment.id);
  }, [savedEstablishments, selectedEstablishment]);

  // Markers will be rendered inline below inside the MapView.

  // Development-only: log counts and the first filtered item to trace where markers disappear.
  useEffect(() => {
    try {
      const establishmentsCount = Array.isArray(establishments) ? establishments.length : 0;
      const filteredCount = Array.isArray(filteredEstablishments) ? filteredEstablishments.length : 0;
      console.log('Establishments:', establishmentsCount);
      console.log('filtered:', filteredCount);
      if (filteredCount > 0) {
        console.log('filtered first item:', filteredEstablishments[0]);
        console.log(
          'filtered items:',
          filteredEstablishments.map((e) => ({
            id: e.id,
            name: e.name,
            latitude: e.latitude,
            longitude: e.longitude,
          }))
        );
      }
    } catch (e) {
      // ignore
    }
  }, [establishments, filteredEstablishments]);

  useEffect(() => {
    let isMounted = true;

    const loadSavedEstablishments = async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_ESTABLISHMENTS_KEY);
        if (!isMounted) {
          return;
        }

        const parsed = JSON.parse(raw || '[]');
        setSavedEstablishments(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (isMounted) {
          setSavedEstablishments([]);
        }
      }
    };

    loadSavedEstablishments();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadDownloadedVarieties = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DOWNLOADED_VARIETIES_KEY);
      const parsed = JSON.parse(raw || '[]');
      setDownloadedVarieties(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDownloadedVarieties([]);
    }
  }, []);

  useEffect(() => {
    loadDownloadedVarieties();
  }, [loadDownloadedVarieties]);

  useFocusEffect(
    useCallback(() => {
      loadDownloadedVarieties();
    }, [loadDownloadedVarieties])
  );

  useEffect(() => {
    if (showAboutModal) {
      loadDownloadedVarieties();
    }
  }, [showAboutModal, loadDownloadedVarieties]);

  useEffect(() => {
    return () => {
      if (savedToastTimeoutRef.current) {
        clearTimeout(savedToastTimeoutRef.current);
      }
    };
  }, []);

  const requestCurrentLocation = useCallback(async () => {
    try {
      setIsLocationBusy(true);

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission?.status !== 'granted') {
        setNavigationError('');
        Alert.alert('Permission Required', 'Location permission is required to find nearby coffee shops and farms.');
        setUserLocation(null);
        return null;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextLocation = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setUserLocation(nextLocation);
      return nextLocation;
    } catch {
      setNavigationError('Unable to get your current location.');
      setUserLocation(null);
      return null;
    } finally {
      setIsLocationBusy(false);
    }
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
    let isActive = true;

    if (!isTrailMode) {
      setTrailState('not_started');
      setCurrentStopIndex(0);
      setTrailLegOrigin(null);
      setDistanceRemaining('0.0 km');
      setEtaRemaining('0 mins');
      setIsTrailRestoring(false);
      trailResumeLoadedKeyRef.current = null;
      return () => {
        isActive = false;
      };
    }

    const storageKey = activeTrailStorageKey || 'coffee_trail_active_state:unpersisted';
    if (trailResumeLoadedKeyRef.current === storageKey) {
      return () => {
        isActive = false;
      };
    }
    trailResumeLoadedKeyRef.current = null;
    setIsTrailRestoring(true);

    setTrailState('not_started');
    setCurrentStopIndex(0);
    setTrailLegOrigin(userLocation || trailOrigin || null);
    setIsDetailsExpanded(false);
    setSelectedEstablishmentId(null);
    setOpenFilterMenu(null);
    setRouteCoordinates([]);

    const restoreActiveTrail = async () => {
      if (!activeTrailStorageKey) {
        trailResumeLoadedKeyRef.current = storageKey;
        setIsTrailRestoring(false);
        return;
      }

      try {
        const savedValue = await AsyncStorage.getItem(activeTrailStorageKey);
        if (!isActive) {
          return;
        }
        const savedState = JSON.parse(savedValue || 'null');
        const savedIndex = Number(savedState?.currentStopIndex);
        if (
          Number.isInteger(savedIndex) &&
          savedIndex >= 0 &&
          savedIndex < trailStops.length &&
          ['navigating', 'arrived'].includes(savedState?.trailState)
        ) {
          if (['yes', 'no'].includes(savedState?.selectedLocationResponse)) {
            setSelectedLocationResponse(savedState.selectedLocationResponse);
          }
          setCurrentStopIndex(savedIndex);
          setTrailState(savedState.trailState);
          const restoredStop = trailStops[savedIndex];
          setTrailLegOrigin(
            savedState?.trailLegOrigin ||
            (savedIndex > 0
              ? {
                  latitude: trailStops[savedIndex - 1].latitude,
                  longitude: trailStops[savedIndex - 1].longitude,
                }
              : trailOrigin)
          );
          const distance = getDistance(
            userLocation?.latitude ?? trailOrigin?.latitude ?? restoredStop.latitude,
            userLocation?.longitude ?? trailOrigin?.longitude ?? restoredStop.longitude,
            restoredStop.latitude,
            restoredStop.longitude
          );
          setDistanceRemaining(formatDistanceKm(savedState.trailState === 'arrived' ? 0 : distance));
          setEtaRemaining(formatEtaMinutes(savedState.trailState === 'arrived' ? 0 : estimateEtaFromDistance(distance)));
        }
      } catch {
        setLocationTrackingStatus('Unable to restore your active trail position. You can retry location tracking.');
      } finally {
        if (isActive) {
          trailResumeLoadedKeyRef.current = storageKey;
          setIsTrailRestoring(false);
        }
      }
    };

    void restoreActiveTrail();

    return () => {
      isActive = false;
    };
  }, [isTrailMode, activeTrailStorageKey, trailStops, trailOrigin]);

  useEffect(() => {
    const storageKey = activeTrailStorageKey || 'coffee_trail_active_state:unpersisted';
    if (
      !isTrailMode ||
      !activeTrailStorageKey ||
      trailResumeLoadedKeyRef.current !== storageKey ||
      !['navigating', 'arrived'].includes(trailState)
    ) {
      return;
    }

    void AsyncStorage.setItem(
      activeTrailStorageKey,
      JSON.stringify({
        currentStopIndex,
        trailState,
        trailLegOrigin,
        selectedLocationResponse,
      })
    ).catch(() => {
      setLocationTrackingStatus('Unable to save trail progress on this device. Keep the app open to continue safely.');
    });
  }, [
    activeTrailStorageKey,
    currentStopIndex,
    isTrailMode,
    selectedLocationResponse,
    trailLegOrigin,
    trailState,
  ]);

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
    const trailDestination =
      isTrailMode && trailState === 'navigating' && currentTrailStop && !isTrailRestoring
        ? {
            latitude: currentTrailStop.latitude,
            longitude: currentTrailStop.longitude,
          }
        : null;
    const normalDestination =
      !isTrailMode && routeCoordinates.length > 1 ? navigationDestinationRef.current : null;
    const activeDestination = trailDestination || normalDestination;

    if (!activeDestination) {
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
      return;
    }

    let isMounted = true;
    const watchLocation = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!isMounted) {
          return;
        }
        if (permission?.status !== 'granted') {
          if (isTrailMode) {
            setLocationTrackingStatus('Location permission is required to confirm arrival. Tap Retry to allow location access.');
          } else {
            setNavigationError('Location permission is required to track your route.');
          }
          return;
        }

        setLocationTrackingStatus('');
        const subscription = await Location.watchPositionAsync(
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

            const distanceToDestinationKm = getDistance(
              nextUser.latitude,
              nextUser.longitude,
              activeDestination.latitude,
              activeDestination.longitude
            );

            if (!isTrailMode && distanceToDestinationKm < ROUTE_CONSUME_ARRIVAL_DISTANCE_KM) {
              setRouteCoordinates([]);
              return;
            }

            setRouteCoordinates((currentRoute) => trimConsumedRoute(currentRoute, nextUser, activeDestination));

            if (
              isTrailMode &&
              shouldRefreshTrailLeg(lastRerouteRef.current.point, nextUser, lastRerouteRef.current.at)
            ) {
              setTrailLegOrigin(nextUser);
              lastRerouteRef.current = {
                point: nextUser,
                at: Date.now(),
              };
            }

            if (!(isTrailMode && currentTrailStop)) {
              return;
            }

            const remainingKm = distanceToDestinationKm;
            const accuracyMeters = Number(position.coords.accuracy);
            setDistanceRemaining(formatDistanceKm(remainingKm));
            setEtaRemaining(formatEtaMinutes(estimateEtaFromDistance(remainingKm)));

            if (remainingKm <= TRAIL_ARRIVAL_RADIUS_KM) {
              if (
                !Number.isFinite(accuracyMeters) ||
                accuracyMeters <= 0 ||
                remainingKm + accuracyMeters / 1000 > TRAIL_ARRIVAL_RADIUS_KM
              ) {
                setLocationTrackingStatus('You are near this stop, but GPS accuracy is not sufficient to confirm arrival yet.');
                return;
              }

              const stopKey = `${trailId}:${currentStopSequence}:${currentTrailStop.establishment_id}`;
              if (arrivalStopKeyRef.current === stopKey) {
                return;
              }
              arrivalStopKeyRef.current = stopKey;
              setLocationTrackingStatus('');
              setDistanceRemaining('0.0 km');
              setEtaRemaining('0 mins');
              setRouteCoordinates([]);
              setTrailState('arrived');
            }
          }
        );

        if (!isMounted) {
          subscription.remove();
          return;
        }
        locationWatchRef.current = subscription;
      } catch {
        if (isMounted) {
          const message = 'Unable to track your GPS location. Check your location settings and retry.';
          if (isTrailMode) {
            setLocationTrackingStatus(message);
          } else {
            setNavigationError(message);
          }
        }
      }
    };
    void watchLocation();

    return () => {
      isMounted = false;
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
    };
  }, [
    activeTrailStorageKey,
    currentStopSequence,
    currentTrailStop,
    isTrailMode,
    isTrailRestoring,
    locationTrackingRetry,
    routeCoordinates.length,
    trailId,
    trailState,
  ]);

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

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(aboutPulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(aboutPulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    if (!showAboutModal && !showTrailTriviaPanel) {
      pulse.start();
    }

    return () => pulse.stop();
  }, [aboutPulseAnim, showAboutModal, showTrailTriviaPanel]);

  useEffect(() => {
    if (!showTrailTriviaPanel || !isTrailMode) {
      if (!isTrailMode) {
        setShowTrailTriviaPanel(false);
      }
      setTrailTriviaRecord(null);
      setTrailTriviaRecordId(null);
      setTrailTriviaProducts([]);
      setIsTrailTriviaLoading(false);
      setTrailTriviaError('');
      return undefined;
    }

    const stopId = currentTrailStop?.establishment_id;
    const requestId = ++trailTriviaRequestIdRef.current;
    let isActive = true;
    trailTriviaSlideAnim.setValue(1);
    Animated.spring(trailTriviaSlideAnim, {
      toValue: 0,
      speed: 16,
      bounciness: 2,
      useNativeDriver: true,
    }).start();

    const localEstablishment = establishments.find(
      (establishment) => String(establishment?.id) === String(stopId)
    );
    const localRecord = {
      ...(localEstablishment?.raw || {}),
      ...(currentTrailStop?.raw || {}),
      trivia_history: getTrailTriviaHistory(
        currentTrailStop?.trivia_history,
        currentTrailStop?.raw?.trivia_history,
        localEstablishment?.raw?.trivia_history
      ),
    };
    setTrailTriviaRecord(localRecord);
    setTrailTriviaRecordId(String(stopId));
    setTrailTriviaProducts(
      Array.isArray(localRecord?.products) ? localRecord.products : []
    );
    setTrailTriviaError('');

    if (!isTrailMode || stopId === null || stopId === undefined || String(stopId).trim() === '') {
      setIsTrailTriviaLoading(false);
      setTrailTriviaError('Details are unavailable for this destination.');
      return () => {
        isActive = false;
      };
    }

    setIsTrailTriviaLoading(true);
    loadTrailTriviaProducts()
      .then((catalog) => {
        if (!isActive || requestId !== trailTriviaRequestIdRef.current) {
          return;
        }

        const products = catalog.filter((product) => {
          const establishmentId = getProductEstablishmentId(product);
          return establishmentId !== null && String(establishmentId) === String(stopId);
        });
        setTrailTriviaProducts(products);
      })
      .catch(() => {
        if (isActive && requestId === trailTriviaRequestIdRef.current) {
          setTrailTriviaError('Some destination products could not be loaded. Available destination information is shown below.');
        }
      })
      .finally(() => {
        if (isActive && requestId === trailTriviaRequestIdRef.current) {
          setIsTrailTriviaLoading(false);
        }
      });

    return () => {
      isActive = false;
      if (requestId === trailTriviaRequestIdRef.current) {
        trailTriviaRequestIdRef.current += 1;
      }
    };
  }, [
    currentTrailStop?.establishment_id,
    currentTrailStop?.raw,
    establishments,
    isTrailMode,
    loadTrailTriviaProducts,
    showTrailTriviaPanel,
    trailTriviaRequestVersion,
    trailTriviaSlideAnim,
  ]);

  useEffect(() => {
    if (showAboutModal) {
      aboutDragY.setValue(0);
    }
  }, [aboutDragY, showAboutModal]);

  useEffect(() => {
    if (!showBeanPreviewModal) {
      return;
    }

    beanPreviewAnim.stopAnimation();
    beanPreviewAnim.setValue(0);
    Animated.timing(beanPreviewAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [beanPreviewAnim, showBeanPreviewModal]);

  const handleOpenBeanPreview = (imageSource) => {
    if (!imageSource) {
      return;
    }

    setBeanPreviewSource(imageSource);
    setShowBeanPreviewModal(true);
  };

  const handleCloseBeanPreview = () => {
    beanPreviewAnim.stopAnimation();
    Animated.timing(beanPreviewAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setShowBeanPreviewModal(false);
    });
  };

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
        const isStrongCloseSwipe = dy > 110 || vy > 1.05;

        if (dy < -45 || vy < -0.8) {
          setIsDetailsExpanded(true);
        } else if (dy > 45 || vy > 0.8) {
          if (isStrongCloseSwipe || !isDetailsExpandedRef.current) {
            setSelectedEstablishmentId(null);
            setNavigationError('');
            setIsDetailsExpanded(false);
          } else {
            setIsDetailsExpanded(false);
          }
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

  const aboutHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        aboutDragY.stopAnimation();
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isVertical && Math.abs(gestureState.dy) > 2;
      },
      onPanResponderMove: (_, gestureState) => {
        const limitedDy = Math.max(0, Math.min(360, gestureState.dy));
        aboutDragY.setValue(limitedDy);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        const shouldDismiss = gestureState.dy > 90 || gestureState.vy > 0.9;

        if (shouldDismiss) {
          Animated.timing(aboutDragY, {
            toValue: 420,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            aboutDragY.setValue(0);
            setShowAboutModal(false);
          });
          return;
        }

        Animated.spring(aboutDragY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 5,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(aboutDragY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 5,
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

  const handleRegionChangeComplete = useCallback((region) => {
    const constrained = constrainRegion(region);
    lastMapRegionRef.current = constrained;

    if (!regionHasMeaningfulDiff(region, constrained) || !mapRef.current) {
      if (Platform.OS === 'android' && selectedEstablishment && mapRef.current) {
        mapRef.current
          .pointForCoordinate({
            latitude: Number(selectedEstablishment.latitude),
            longitude: Number(selectedEstablishment.longitude),
          })
          .then((point) => {
            setAndroidCalloutPos(point || null);
          })
          .catch(() => {
            setAndroidCalloutPos(null);
          });
      }
      return;
    }

    const now = Date.now();
    if (now - lastAnimateRef.current < 200) {
      return;
    }
    lastAnimateRef.current = now;
    mapRef.current.animateToRegion(constrained, 120);

    if (Platform.OS === 'android' && selectedEstablishment && mapRef.current) {
      mapRef.current
        .pointForCoordinate({
          latitude: Number(selectedEstablishment.latitude),
          longitude: Number(selectedEstablishment.longitude),
        })
        .then((point) => {
          setAndroidCalloutPos(point || null);
        })
        .catch(() => {
          setAndroidCalloutPos(null);
        });
    }
  }, [selectedEstablishment]);

  const fetchEstablishments = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [establishmentsResponse, promosResponse] = await Promise.all([
        getEstablishments(),
        getCouponPromos().catch(() => []),
      ]);
      const payload = Array.isArray(establishmentsResponse)
        ? establishmentsResponse
        : establishmentsResponse?.features || establishmentsResponse?.data || establishmentsResponse?.establishments || [];
      const promosPayload = Array.isArray(promosResponse)
        ? promosResponse
        : promosResponse?.data || promosResponse?.promos || [];
      const promoIndexByEstablishment = buildPromoIndexByEstablishment(promosPayload);

      const normalized = payload
        .map((item, index) => normalizeEstablishment(item, index, promoIndexByEstablishment))
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

  const handleNavigatePress = useCallback(async (item) => {
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
    navigationDestinationRef.current = { latitude: item.latitude, longitude: item.longitude };

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
  }, [isDetailsExpanded, userLocation]);

  const handleViewDetails = useCallback((item) => {
    if (!item || !item.id) return;
    setSelectedEstablishmentId((current) => (current === item.id ? current : item.id));
    setIsDetailsExpanded(true);
  }, []);

  const handleMarkerSelect = useCallback(async (item) => {
    if (!item || !item.id) return;
    ignoreMapPressUntilRef.current = Date.now() + 320;
    setSelectedEstablishmentId((current) => (current === item.id ? current : item.id));
    setIsDetailsExpanded(false);
    setOpenFilterMenu(null);

    const establishmentId = Number(item?.raw?.id ?? item?.id);
    if (!Number.isFinite(establishmentId) || establishmentId <= 0) {
      return;
    }

    const now = Date.now();
    if (
      String(lastTrackedMarkerRef.current.id) === String(establishmentId)
      && now - Number(lastTrackedMarkerRef.current.at || 0) < 1500
    ) {
      return;
    }

    lastTrackedMarkerRef.current = { id: establishmentId, at: now };

    trackMapMarkerView({ establishment_id: establishmentId, map_session_id: mapSessionIdRef.current }).catch(() => {});

    const markerLat = Number(item.latitude);
    const markerLng = Number(item.longitude);
    if (!Number.isFinite(markerLat) || !Number.isFinite(markerLng) || !mapRef.current) {
      return;
    }

    const { height: screenHeight } = Dimensions.get('window');
    const usableTop = Math.max(insets.top + 88, 116);
    const usableBottom = Math.max(screenHeight - 180, usableTop + 220);
    const usableHeight = Math.max(220, usableBottom - usableTop);
    const desiredMarkerY = usableTop + usableHeight * 0.56;

    let projectedMarkerY = screenHeight * 0.56;
    try {
      const point = await mapRef.current.pointForCoordinate({ latitude: markerLat, longitude: markerLng });
      if (point) {
        projectedMarkerY = point.y;
      }
    } catch {
      projectedMarkerY = screenHeight * 0.56;
    }

    const baseRegion = lastMapRegionRef.current || LIPA_REGION;
    const latitudePerPixel = baseRegion.latitudeDelta / Math.max(screenHeight, 1);
    const latitudeOffset = (desiredMarkerY - projectedMarkerY) * latitudePerPixel;
    const targetRegion = constrainRegion({
      latitude: markerLat + latitudeOffset,
      longitude: markerLng,
      latitudeDelta: baseRegion.latitudeDelta,
      longitudeDelta: baseRegion.longitudeDelta,
    });

    lastMapRegionRef.current = targetRegion;
    mapRef.current.animateToRegion(targetRegion, 300);
  }, [insets.top]);

  const handleDismissSheet = useCallback(() => {
    setSelectedEstablishmentId(null);
    setNavigationError('');
    setIsDetailsExpanded(false);
  }, []);

  const toggleVarietyFilter = useCallback((varietyName) => {
    const key = String(varietyName).toLowerCase();
    setSelectedVarieties((prev) => {
      const has = prev.some((item) => String(item).toLowerCase() === key);
      if (has) {
        return prev.filter((item) => String(item).toLowerCase() !== key);
      }
      return [...prev, varietyName];
    });
  }, []);

  const handleToggleVarietyOffline = async (varietyTitle) => {
    const key = String(varietyTitle || '').trim();
    if (!key) {
      return;
    }

    const willDownload = !downloadedVarieties.includes(key);

    const next = downloadedVarieties.includes(key)
      ? downloadedVarieties.filter((item) => item !== key)
      : [...downloadedVarieties, key];

    setDownloadedVarieties(next);
    await AsyncStorage.setItem(DOWNLOADED_VARIETIES_KEY, JSON.stringify(next));
    showTransientToast(willDownload ? 'Saved to Profile' : 'Removed from Profile');
  };

  const handleMapPress = useCallback(() => {
    Keyboard.dismiss();
    setOpenFilterMenu(null);

    if (Date.now() < ignoreMapPressUntilRef.current) {
      return;
    }

    handleDismissSheet();
  }, [handleDismissSheet]);

  const animateHeartTap = () => {
    heartTapAnim.setValue(0.9);
    Animated.sequence([
      Animated.timing(heartTapAnim, {
        toValue: 1.18,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(heartTapAnim, {
        toValue: 1,
        speed: 16,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const showTransientToast = (message) => {
    if (savedToastTimeoutRef.current) {
      clearTimeout(savedToastTimeoutRef.current);
    }

    setSavedToastMessage(String(message || 'Saved'));
    setShowSavedToast(true);
    savedToastOpacity.setValue(0);
    Animated.timing(savedToastOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();

    savedToastTimeoutRef.current = setTimeout(() => {
      Animated.timing(savedToastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setShowSavedToast(false));
    }, 1300);
  };

  const handleToggleSaveEstablishment = useCallback(async (item) => {
    if (!item?.id) return;
    animateHeartTap();

    const establishmentId = String(item.id);

    setSavedEstablishments((prev) => {
      const exists = prev.some((entry) => String(entry?.id) === establishmentId);
      const next = exists
        ? prev.filter((entry) => String(entry?.id) !== establishmentId)
        : [
            ...prev,
            {
              id: establishmentId,
              name: item.name || 'Coffee Stop',
              address: item.address || 'Address not available',
              type: item.type || '',
              savedAt: new Date().toISOString(),
            },
          ];

      AsyncStorage.setItem(SAVED_ESTABLISHMENTS_KEY, JSON.stringify(next)).catch(() => {});

      // Side-effect: show toast only when newly saved
      if (!exists) {
        showTransientToast('Saved to Favorites');
      } else {
        setShowSavedToast(false);
        savedToastOpacity.setValue(0);
      }

      return next;
    });
  }, []);

  const handleClearRoute = () => {
    navigationDestinationRef.current = null;
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

  const handleSearchSubmit = useCallback(async () => {
    Keyboard.dismiss();
    setOpenFilterMenu(null);

    const query = searchQuery.trim();
    if (!query) {
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const rankedMatches = filteredEstablishments
      .map((item) => ({ item, score: getSearchMatchScore(item, normalizedQuery) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const bestMatch = rankedMatches[0]?.item;

    if (bestMatch && mapRef.current) {
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
      return;
    }

    if (!mapRef.current) {
      return;
    }

    const geocodeResult = await geocodePhilippines(query);
    if (!geocodeResult) {
      setNavigationError('No results found for that location.');
      return;
    }

    setRouteCoordinates([]);
    setNavigationError('');
    setSelectedEstablishmentId(null);
    setIsDetailsExpanded(false);

    const latitudeDelta = geocodeResult.bounds
      ? clamp(Math.abs(geocodeResult.bounds.north - geocodeResult.bounds.south) * 1.5, 0.02, 0.36)
      : 0.18;
    const longitudeDelta = geocodeResult.bounds
      ? clamp(Math.abs(geocodeResult.bounds.east - geocodeResult.bounds.west) * 1.5, 0.02, 0.36)
      : 0.18;

    const targetRegion = constrainRegion({
      latitude: geocodeResult.lat,
      longitude: geocodeResult.lng,
      latitudeDelta,
      longitudeDelta,
    });

    mapRef.current.animateToRegion(targetRegion, 360);
  }, [searchQuery, filteredEstablishments, mapRef, ignoreMapPressUntilRef]);

  const handleRecenterPress = useCallback(async () => {
    Keyboard.dismiss();
    setOpenFilterMenu(null);
    handleDismissSheet();
    sheetScrollRef.current?.scrollTo({ y: 0, animated: true });

    let nextLocation = userLocation;

    if (!nextLocation) {
      nextLocation = await requestCurrentLocation();
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
  }, [userLocation, requestCurrentLocation, handleDismissSheet, sheetScrollRef, mapRef]);

  const handleStartTrail = async () => {
    if (!trailStops.length) {
      return;
    }

    setLocationTrackingStatus('');
    const currentLocation = userLocation || (await requestCurrentLocation());
    if (!currentLocation) {
      setLocationTrackingStatus('Location permission or a current GPS position is required to start the trail.');
      return;
    }

    const firstStop = trailStops[0];
    const origin = currentLocation || trailOrigin;

    setCurrentStopIndex(0);
    setTrailLegOrigin(origin || null);
    arrivalStopKeyRef.current = null;
    setLocationCheckError('');
    setLocationCheckNotice('');
    setSelectedLocationResponse(null);
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

  const handleRetryLocationTracking = async () => {
    setLocationTrackingStatus('Checking location permission and GPS…');
    const location = await requestCurrentLocation();
    if (!location) {
      setLocationTrackingStatus('Location access is unavailable. Enable permission or GPS, then retry.');
      return;
    }
    setLocationTrackingStatus('');
    setLocationTrackingRetry((retry) => retry + 1);
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

  const handleContactPress = async (contactNumber) => {
    const raw = String(contactNumber || '').trim();
    if (!raw) {
      Alert.alert('Unavailable', 'No contact number available for this establishment.');
      return;
    }

    const sanitized = raw.replace(/[^\d+]/g, '');
    const telUrl = `tel:${sanitized || raw}`;

    try {
      const canOpen = await Linking.canOpenURL(telUrl);
      if (!canOpen) {
        Alert.alert('Unable to call', 'This device cannot place phone calls right now.');
        return;
      }

      await Linking.openURL(telUrl);
    } catch {
      Alert.alert('Unable to call', 'Could not open the phone app for this number.');
    }
  };

  const handleWebsitePress = async (website) => {
    const normalizedUrl = normalizeWebsiteUrl(website);
    if (!normalizedUrl) {
      Alert.alert('Unavailable', 'No website available for this establishment.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(normalizedUrl);
      if (!canOpen) {
        Alert.alert('Unable to open link', 'This website link is not supported on this device.');
        return;
      }

      await Linking.openURL(normalizedUrl);
    } catch {
      Alert.alert('Unable to open link', 'Could not open the website link.');
    }
  };

  const handleOpenBrewHubInfo = async () => {
    try {
      const canOpen = await Linking.canOpenURL(BREWING_HUB_INFO_URL);
      if (!canOpen) {
        Alert.alert('Unable to open link', 'This website link is not supported on this device.');
        return;
      }

      await Linking.openURL(BREWING_HUB_INFO_URL);
    } catch {
      Alert.alert('Unable to open link', 'Could not open the BrewHub website.');
    }
  };

  const handleOpenMarketplace = () => {
    try {
      const parentNavigation = navigation?.getParent?.();
      const parentRouteNames = parentNavigation?.getState?.()?.routeNames || [];

      if (parentNavigation && parentRouteNames.includes('Marketplace')) {
        parentNavigation.navigate('Marketplace');
        return;
      }

      navigation?.navigate?.('Marketplace');
    } catch {
      Alert.alert('Unable to open Store', 'Please try again in a moment.');
    }
  };

  const handleOpenEstablishmentChat = () => {
    if (!selectedEstablishment) {
      return;
    }

    const recipientId = getEstablishmentRecipientId(selectedEstablishment);
    const participantName = getEstablishmentParticipantName(selectedEstablishment);

    try {
      navigation?.navigate?.('Messages', {
        recipientId: recipientId || undefined,
        participantName: participantName || undefined,
        chatIntentAt: Date.now(),
      });
    } catch {
      Alert.alert('Unable to open chat', 'Please try again in a moment.');
    }
  };

  const handleOpenPromoInPromos = () => {
    const activePromo = selectedEstablishment?.activePromoDetails?.[0]?.title || selectedEstablishment?.activePromos?.[0] || '';

    if (!activePromo) {
      Alert.alert('No active promo', 'There is no active promo available right now.');
      return;
    }

    try {
      navigation?.navigate?.('Promos', {
        focusPromoTitle: activePromo,
        focusEstablishmentName: selectedEstablishment?.name || '',
        focusAt: Date.now(),
      });
    } catch {
      Alert.alert('Unable to open promos', 'Please try again in a moment.');
    }
  };

  const resetTrailMode = async () => {
    trailAdvanceRef.current = false;
    arrivalStopKeyRef.current = null;
    if (activeTrailStorageKey) {
      try {
        await AsyncStorage.removeItem(activeTrailStorageKey);
      } catch {
        setLocationTrackingStatus('Trail progress could not be cleared from this device.');
      }
    }
    trailTriviaRequestIdRef.current += 1;
    trailTriviaSlideAnim.stopAnimation();
    trailTriviaSlideAnim.setValue(1);
    setShowTrailTriviaPanel(false);
    setTrailTriviaRecord(null);
    setTrailTriviaRecordId(null);
    setTrailTriviaProducts([]);
    setTrailTriviaError('');
    setSelectedLocationResponse(null);
    setLocationCheckError('');
    setLocationCheckNotice('');
    setLocationTrackingStatus('');

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

  useEffect(() => {
    if (!(isTrailMode && trailState === 'arrived' && !showTrailTriviaPanel)) {
      locationValidationAnim.setValue(0);
      return;
    }

    locationValidationAnim.setValue(0);
    const validationAnimation = Animated.spring(locationValidationAnim, {
      toValue: 1,
      speed: 18,
      bounciness: 2,
      useNativeDriver: true,
    });
    validationAnimation.start();

    setLocationTrackingStatus('');
    setLocationCheckError('');
    return () => validationAnimation.stop();
  }, [isTrailMode, locationValidationAnim, showTrailTriviaPanel, trailState]);

  useEffect(() => {
    if (!(isTrailMode && trailState === 'arrived' && showTrailTriviaPanel)) {
      return;
    }

    Animated.timing(trailTriviaSlideAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowTrailTriviaPanel(false);
      }
    });
  }, [isTrailMode, showTrailTriviaPanel, trailState, trailTriviaSlideAnim]);

  useEffect(() => {
    trailAdvanceRef.current = false;
  }, [currentStopIndex, trailState]);

  const handleNextDestination = () => {
    if (trailAdvanceRef.current) {
      return;
    }
    if (trailState !== 'arrived') {
      setLocationCheckError('Reach the current destination before continuing.');
      return;
    }
    if (isLocationChecksLoading) {
      setLocationCheckError('Checking whether this location was already verified. Please wait.');
      return;
    }
    if (!isCurrentLocationCheckSaved) {
      setLocationCheckError('Please verify this location before continuing.');
      return;
    }
    if (currentStopIndex >= trailStops.length - 1) {
      return;
    }

    trailAdvanceRef.current = true;
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
    arrivalStopKeyRef.current = null;
    setSelectedLocationResponse(null);
    setLocationCheckError('');
    setLocationCheckNotice('');
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

  const handleCompleteTrail = async () => {
    if (trailAdvanceRef.current) {
      return;
    }
    if (trailState !== 'arrived' || !isCurrentLocationCheckSaved) {
      setLocationCheckError('Please verify this location before completing the trail.');
      return;
    }

    trailAdvanceRef.current = true;
    const completedTrailStops = trailStops;
    await resetTrailMode();
    if (cafeTrailStops.length) {
      navigation?.navigate?.('Rating', { trailStops: cafeTrailStops });
      return;
    }
    navigation?.navigate?.('Trail', { trailStops: completedTrailStops });
  };

  const handleSaveLocationCheck = async (response) => {
    if (locationCheckSubmissionRef.current || isCurrentLocationCheckSaved) {
      return;
    }
    if (!trailId || !currentTrailStop?.establishment_id) {
      setSelectedLocationResponse(response);
      setLocationCheckError('This trail cannot be verified because its saved trail details are unavailable.');
      return;
    }

    locationCheckSubmissionRef.current = true;
    setSelectedLocationResponse(response);
    setIsSavingLocationCheck(true);
    setLocationCheckError('');
    setLocationCheckNotice('');

    try {
      const result = await submitLocationCheck(trailId, {
        establishment_id: currentTrailStop.establishment_id,
        stop_sequence: currentStopSequence,
        response,
      });
      const savedCheck = result?.data ?? result;
      if (!savedCheck?.response) {
        throw new Error('The server did not confirm that the location check was saved.');
      }
      setLocationChecks((checks) => [
        savedCheck,
        ...checks.filter(
          (check) =>
            !(String(check?.trail_id ?? check?.coffee_trail_id) === String(trailId) &&
              Number(check?.stop_sequence) === currentStopSequence)
        ),
      ]);
      setSelectedLocationResponse(null);
      setLocationCheckNotice(
        response === 'no'
          ? 'Location reported for review. Your response has been saved.'
          : 'Your location check has been saved.'
      );
    } catch (error) {
      if (error?.response?.status === 401) {
        void authLogoutRef.current().catch((logoutError) => {
          console.warn('Unable to clear expired mobile session', logoutError);
        });
      }
      setLocationCheckError(getApiErrorMessage(error, 'save your location check'));
    } finally {
      locationCheckSubmissionRef.current = false;
      setIsSavingLocationCheck(false);
    }
  };

  const toggleTrailTriviaPanel = () => {
    if (showTrailTriviaPanel) {
      Animated.timing(trailTriviaSlideAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowTrailTriviaPanel(false);
        }
      });
      return;
    }

    setShowAboutModal(false);
    trailTriviaSlideAnim.setValue(1);
    setShowTrailTriviaPanel(true);
  };

  const isTrailTriviaForCurrentStop =
    trailTriviaRecordId !== null &&
    currentTrailStop?.establishment_id !== null &&
    currentTrailStop?.establishment_id !== undefined &&
    trailTriviaRecordId === String(currentTrailStop.establishment_id);
  const activeTrailTriviaHistory = isTrailTriviaForCurrentStop
    ? getTrailTriviaHistory(currentTrailStop?.trivia_history, trailTriviaRecord?.trivia_history)
    : '';
  const activeTrailVarieties = isTrailTriviaForCurrentStop
    ? getTrailVarieties(trailTriviaRecord)
    : [];
  const activeTrailProducts = isTrailTriviaForCurrentStop ? trailTriviaProducts : [];
  const hasTrailTriviaHistory = Boolean(activeTrailTriviaHistory);
  const hasTrailTriviaContent =
    hasTrailTriviaHistory || activeTrailVarieties.length > 0 || activeTrailProducts.length > 0;

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider="google"
        scrollEnabled={!selectedEstablishment}
        zoomEnabled={!selectedEstablishment}
        rotateEnabled={!selectedEstablishment}
        pitchEnabled={!selectedEstablishment}
        moveOnMarkerPress={false}
        initialRegion={LIPA_REGION}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
        cacheEnabled={false}
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

        {isTrailMode && coffeeTrailMarkerStops.length > 0
          ? coffeeTrailMarkerStops.map((stop, idx) => {
              const isCurrent = idx === currentStopIndex;

              console.log('[COFFEE TRAIL CUSTOM MARKER] rendering', {
                id: stop.id,
                number: stop.number,
                latitude: stop.latitude,
                longitude: stop.longitude,
              });

              return (
                <Marker
                  key={`coffee-trail-stop-${stop.id ?? idx}`}
                  coordinate={{
                    latitude: Number(stop.latitude),
                    longitude: Number(stop.longitude),
                  }}
                  tracksViewChanges={true}
                  collapsable={false}
                  zIndex={40}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View
                    collapsable={false}
                    style={[
                      styles.trailMarker,
                      isCurrent ? styles.trailMarkerCurrent : null,
                    ]}
                  >
                    <Text style={styles.trailMarkerText}>{stop.number}</Text>
                  </View>
                </Marker>
              );
            })
          : (Array.isArray(filteredEstablishments) ? filteredEstablishments
              .filter((it) => Number.isFinite(Number(it?.latitude)) && Number.isFinite(Number(it?.longitude)))
              .map((item) => (
                <Marker
                  key={String(item.id)}
                  coordinate={{ latitude: Number(item.latitude), longitude: Number(item.longitude) }}
                  tracksViewChanges={true}
                  zIndex={20}
                  onPress={() => handleMarkerSelect(item)}
                  onSelect={() => handleMarkerSelect(item)}
                >
                  <View
                    style={[
                      styles.establishmentMarker,
                      { backgroundColor: TYPE_PIN_COLORS[item.type] || BRAND.accent },
                    ]}
                  >
                    {renderTypeIcon(
                      TYPE_MARKER_ICONS[item.type]?.icon || 'place',
                      TYPE_MARKER_ICONS[item.type]?.iconLibrary || 'material',
                      '#FFFFFF',
                      TYPE_MARKER_ICONS[item.type]?.iconLibrary === 'community' ? 15 : 16
                    )}
                  </View>
                  {Platform.OS === 'ios' ? (
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
                  ) : null}
                </Marker>
              )) : null)}
      </MapView>

      {isTrailMode ? (
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

      {/* Android-only external callout overlay to avoid native MapView clipping. */}
      {Platform.OS === 'android' && androidCalloutPos && selectedEstablishment && !isDetailsExpanded ? (
        (() => {
          const { width: screenW, height: screenH } = Dimensions.get('window');
          const layout = androidCalloutLayout || { width: 220, height: 72 };
          const x = Math.round((androidCalloutPos.x || 0) - layout.width / 2);
          const markerRadius = 17;
          const tooltipGap = 12;
          const y = Math.round((androidCalloutPos.y || 0) - markerRadius - layout.height - tooltipGap);
          const left = Math.max(8, Math.min(x, screenW - layout.width - 8));
          const top = Math.max(12, y);

          return (
            <View
              pointerEvents="box-none"
              style={[
                styles.androidCalloutContainer,
                { left, top, width: layout.width, height: layout.height },
              ]}
            >
              <Pressable
                onPress={() => handleViewDetails(selectedEstablishment)}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  if (!androidCalloutLayout || androidCalloutLayout.width !== width || androidCalloutLayout.height !== height) {
                    setAndroidCalloutLayout({ width, height });
                  }
                }}
              >
                <View style={styles.calloutWrap}>
                  <Text style={styles.calloutName}>{selectedEstablishment.name}</Text>
                  <Text
                    style={[
                      styles.calloutTypePillText,
                      {
                        backgroundColor: getTypePillTheme(selectedEstablishment.type).bg,
                        borderColor: getTypePillTheme(selectedEstablishment.type).border,
                        color: getTypePillTheme(selectedEstablishment.type).text,
                      },
                    ]}
                  >
                    {getTypeDisplayLabel(selectedEstablishment)}
                  </Text>

                  {selectedEstablishment.type === 'cafe' ? (
                    <View style={styles.calloutInfoRow}>
                      <Text style={styles.calloutInfoLabel}>Overall Avg:</Text>
                      <Text style={styles.calloutRatingValue}>
                        ★ {selectedEstablishment.reviewCount > 0 ? selectedEstablishment.rating.toFixed(1) : '0.0'}
                      </Text>
                    </View>
                  ) : null}

                  {selectedEstablishment.type === 'cafe' ? (
                    <View style={styles.calloutInfoRow}>
                      <Text style={styles.calloutInfoLabel}>Active Promo:</Text>
                      <Text style={styles.calloutPromoValue} numberOfLines={1} ellipsizeMode="tail">
                        {selectedEstablishment.activePromos?.[0] || 'No active promo'}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.calloutArrow} />
                </View>
              </Pressable>
            </View>
          );
        })()
      ) : null}

      {!isTrailMode && !isDetailsExpanded ? (
        <View pointerEvents="box-none" style={[styles.overlayTop, { top: Math.max(insets.top + 6, 16) }]}> 
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
                Varieties: {selectedVarietiesLabel}
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
                    <View style={styles.dropdownTypeIconWrap}>
                      {renderTypeIcon(item.icon, item.iconLibrary, item.color, 13)}
                    </View>
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

      <Animated.View
        style={[
          styles.aboutButtonWrap,
          {
            bottom: isTrailMode ? Math.max(insets.bottom + 210, 220) : Math.max(insets.bottom + 86, 94),
            transform: [{ scale: aboutPulseAnim }],
          },
        ]}
      >
        <Pressable
          style={styles.aboutButton}
          onPress={() => {
            if (showTrailTriviaPanel) {
              toggleTrailTriviaPanel();
            }
            setShowAboutModal(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Open coffee varieties guide"
        >
          <MaterialIcons name="help-outline" size={28} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      {isTrailMode && currentTrailStop ? (
        <Animated.View
          style={[
            styles.aboutButtonWrap,
            {
              bottom: Math.max(insets.bottom + 274, 284),
              transform: [{ scale: aboutPulseAnim }],
            },
          ]}
        >
          <Pressable
            style={styles.aboutButton}
            onPress={toggleTrailTriviaPanel}
            accessibilityRole="button"
            accessibilityLabel={showTrailTriviaPanel ? 'Close Did you know panel' : 'Did you know?'}
            accessibilityState={{ expanded: showTrailTriviaPanel }}
          >
            <MaterialIcons name="lightbulb-outline" size={27} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      ) : null}

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
              {activeSheetImageUri ? (
                <Image
                  source={{ uri: activeSheetImageUri }}
                  style={[styles.sheetImage, isDetailsExpanded && styles.sheetImageExpanded]}
                  onError={handleSheetImageError}
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
              <View style={styles.sheetTitleRow}>
                <Text style={styles.sheetTitle}>{selectedEstablishment.name}</Text>
                <View style={styles.sheetSaveWrap}>
                  <Pressable
                    style={styles.sheetSaveButtonInline}
                    onPress={() => handleToggleSaveEstablishment(selectedEstablishment)}
                  >
                    <Animated.View style={{ transform: [{ scale: heartTapAnim }] }}>
                      <MaterialIcons
                        name={isSelectedEstablishmentSaved ? 'favorite' : 'favorite-border'}
                        size={18}
                        color={isSelectedEstablishmentSaved ? '#A33939' : '#6E6254'}
                      />
                    </Animated.View>
                  </Pressable>

                  {showSavedToast ? (
                    <Animated.View style={[styles.savedToastWrap, { opacity: savedToastOpacity }]}>
                      <Text style={styles.savedToastText}>{savedToastMessage}</Text>
                    </Animated.View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.sheetAddress}>{selectedEstablishment.address}</Text>
              {selectedEstablishment.type === 'cafe' ? (
                <Text style={styles.sheetRating}>{formatStars(selectedEstablishment.rating)}</Text>
              ) : null}
              {!isDetailsExpanded && selectedEstablishment.type === 'cafe' ? (
                <View style={styles.sheetPromoWrap}>
                  <Text style={styles.sheetPromoLabel}>Active Promo:</Text>
                  <Text style={styles.sheetPromoValue} numberOfLines={1} ellipsizeMode="tail">
                    {selectedEstablishment.activePromoDetails?.length ? 'One active promo' : 'No active promo'}
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
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionTitle}>Information</Text>
                      <Pressable
                        style={styles.infoChatButton}
                        onPress={handleOpenEstablishmentChat}
                        accessibilityRole="button"
                        accessibilityLabel="Open chat with this establishment"
                      >
                        <MaterialIcons name="chat-bubble-outline" size={16} color="#2D4A1E" />
                      </Pressable>
                    </View>
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
                      Contact:{' '}
                      {selectedEstablishment.contactNumber ? (
                        <Text
                          style={styles.detailLinkText}
                          onPress={() => handleContactPress(selectedEstablishment.contactNumber)}
                        >
                          {selectedEstablishment.contactNumber}
                        </Text>
                      ) : (
                        'N/A'
                      )}
                    </Text>
                    <Text style={styles.detailText}>Email: {selectedEstablishment.email || 'N/A'}</Text>
                    <Text style={styles.detailText}>
                      Website:{' '}
                      {selectedEstablishment.website ? (
                        <Text
                          style={styles.detailLinkText}
                          onPress={() => handleWebsitePress(selectedEstablishment.website)}
                        >
                          {selectedEstablishment.website}
                        </Text>
                      ) : (
                        'N/A'
                      )}
                    </Text>
                    <Text style={styles.detailText}>
                      Visit Hours: {selectedEstablishment.visitHours || 'N/A'}
                    </Text>
                    <Text style={styles.detailText}>
                      Activities: {selectedEstablishment.activities || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Products</Text>
                    {selectedEstablishment.type === 'farm' ? (
                      (Array.isArray(selectedEstablishment?.productRatings) && selectedEstablishment.productRatings.length) ? (
                        <View style={styles.productRatingsList}>
                          {(Array.isArray(selectedEstablishment?.productRatings) ? selectedEstablishment.productRatings : []).map((product) => (
                            <View key={`${product.id || product.name}`} style={styles.productRatingRow}>
                              <Text style={styles.productRatingName} numberOfLines={1}>
                                {product.name}
                              </Text>
                              <Text
                                style={[
                                  styles.productRatingStars,
                                  product.ratingCount > 0 ? null : styles.productRatingStarsMuted,
                                ]}
                              >
                                {product.ratingCount > 0 ? formatStars(product.averageRating) : 'No ratings yet'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.detailText}>No rated farm products available yet.</Text>
                      )
                    ) : (
                      <View style={styles.productsChipsWrap}>
                        {(Array.isArray(getProductsByType(selectedEstablishment.type)) ? getProductsByType(selectedEstablishment.type) : []).map((product) => (
                          <View key={product} style={styles.productChip}>
                            <Text style={styles.productChipText}>{product}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Pressable
                      style={styles.marketplaceInlineButton}
                      onPress={handleOpenMarketplace}
                    >
                      <MaterialIcons name="shopping-bag" size={15} color="#FFFFFF" />
                      <Text style={styles.marketplaceInlineButtonText}>Open Store</Text>
                    </Pressable>

                    {selectedEstablishment.type === 'farm' ? (
                      <Pressable
                        style={styles.infoLinkButton}
                        onPress={handleOpenBrewHubInfo}
                        accessibilityRole="link"
                        accessibilityLabel="Open BrewHub website for more details"
                      >
                        <MaterialIcons name="open-in-new" size={15} color="#2D4A1E" />
                        <Text style={styles.infoLinkButtonText}>More details on brewing-hub.online</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {selectedEstablishment.type === 'cafe' ? (
                    <View style={styles.sectionBlock}>
                      <Text style={styles.sectionTitle}>Promo</Text>
                      {selectedEstablishment.activePromoDetails?.[0] ? (
                        <Pressable
                          style={[styles.promoRow, styles.promoRowClickable]}
                          onPress={handleOpenPromoInPromos}
                          accessibilityRole="button"
                          accessibilityLabel="Open full promo details in promos screen"
                        >
                          <View style={styles.promoContentWrap}>
                            <Text style={styles.promoTitleText} numberOfLines={2}>
                              {selectedEstablishment.activePromoDetails[0].title}
                            </Text>
                            {selectedEstablishment.activePromoDetails[0].discount ? (
                              <Text style={styles.promoDiscountText} numberOfLines={1}>
                                {selectedEstablishment.activePromoDetails[0].discount}
                              </Text>
                            ) : null}
                            <Text style={styles.promoDescriptionText} numberOfLines={3}>
                              {selectedEstablishment.activePromoDetails[0].description || 'No promo description available.'}
                            </Text>
                            <Text style={styles.promoHintText}>Click to view full promo details</Text>
                          </View>

                          <View style={styles.promoCouponButton}>
                            <MaterialIcons name="local-offer" size={16} color="#FFFFFF" />
                          </View>
                        </Pressable>
                      ) : (
                        <Text style={styles.detailText}>No active promo</Text>
                      )}
                    </View>
                  ) : null}

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
                    {(Array.isArray(selectedEstablishment?.coffeeVarieties) && selectedEstablishment.coffeeVarieties.length) ? (
                      <View style={styles.varietyChipsWrap}>
                        {(Array.isArray(selectedEstablishment?.coffeeVarieties) ? selectedEstablishment.coffeeVarieties : []).map((variety) => {
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
                      {(Array.isArray(selectedEstablishment?.recentReviews) && selectedEstablishment.recentReviews.length) ? (
                        (Array.isArray(selectedEstablishment?.recentReviews) ? selectedEstablishment.recentReviews : []).map((review, index) => (
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

      {isTrailMode && currentTrailStop ? (
        <View
          style={[styles.trailBottomPanel, { paddingBottom: Math.max(insets.bottom + 10, 16) }]}
          onLayout={({ nativeEvent }) => setTrailBottomPanelHeight(nativeEvent.layout.height)}
        >
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
            <Pressable
              style={[
                styles.trailPrimaryBtn,
                (isTrailRestoring || !isTrailPositionReady || isLocationBusy) && styles.trailPrimaryBtnDisabled,
              ]}
              onPress={handleStartTrail}
              disabled={isTrailRestoring || !isTrailPositionReady || isLocationBusy}
            >
              <Text style={styles.trailPrimaryBtnText}>
                {isTrailRestoring || !isTrailPositionReady ? 'Restoring Trail…' : 'Start Trail'}
              </Text>
            </Pressable>
          ) : null}

          {trailState === 'navigating' ? (
            <View style={styles.trailActionsRow}>
              <Pressable style={styles.trailStopBtn} onPress={handleStopTrail}>
                <Text style={styles.trailStopBtnText}>Stop</Text>
              </Pressable>
              <Pressable
                style={[styles.trailPrimaryBtn, shouldDisableNextStop && styles.trailPrimaryBtnDisabled]}
                onPress={handleNextDestination}
                disabled={
                  isTrailRestoring ||
                  !isTrailPositionReady ||
                  isLocationChecksLoading ||
                  isSavingLocationCheck
                }
                accessibilityState={{
                  disabled:
                    isTrailRestoring ||
                    !isTrailPositionReady ||
                    isLocationChecksLoading ||
                    isSavingLocationCheck,
                }}
              >
                <View style={styles.trailButtonContentRow}>
                  <Text style={styles.trailPrimaryBtnText}>Next Stop</Text>
                  <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          ) : null}

          {trailState === 'arrived' ? (
            <>
              <Text style={styles.arrivedTitle}>You've arrived! ☕</Text>
              <Text style={styles.arrivedName}>{currentTrailStop.name}</Text>

              <View style={styles.trailActionsRow}>
                <Pressable style={styles.trailStopBtn} onPress={handleStopTrail}>
                  <Text style={styles.trailStopBtnText}>Stop Trail</Text>
                </Pressable>
                <Pressable
                  style={[styles.trailPrimaryBtn, shouldDisableNextStop && styles.trailPrimaryBtnDisabled]}
                  onPress={isOnLastTrailStop ? handleCompleteTrail : handleNextDestination}
                  disabled={
                    isTrailRestoring ||
                    !isTrailPositionReady ||
                    isLocationChecksLoading ||
                    isSavingLocationCheck
                  }
                  accessibilityState={{
                    disabled:
                      isTrailRestoring ||
                      !isTrailPositionReady ||
                      isLocationChecksLoading ||
                      isSavingLocationCheck,
                  }}
                >
                  <View style={styles.trailButtonContentRow}>
                    <Text style={styles.trailPrimaryBtnText}>{isOnLastTrailStop ? 'Complete Trail' : 'Next Stop'}</Text>
                    {!isOnLastTrailStop ? (
                      <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                    ) : null}
                  </View>
                </Pressable>
              </View>
            </>
          ) : null}

          {locationTrackingStatus && trailState === 'navigating' ? (
            <View style={styles.locationTrackingNotice}>
              <Text style={styles.locationTrackingNoticeText}>{locationTrackingStatus}</Text>
              <Pressable
                style={styles.locationTrackingRetry}
                onPress={handleRetryLocationTracking}
                disabled={isLocationBusy}
              >
                <Text style={styles.locationTrackingRetryText}>{isLocationBusy ? 'Checking…' : 'Retry'}</Text>
              </Pressable>
            </View>
          ) : null}
          {locationCheckError && trailState !== 'arrived' ? (
            <Text style={styles.locationValidationInlineError}>{locationCheckError}</Text>
          ) : null}
        </View>
      ) : null}

      {showTrailTriviaPanel && isTrailMode && currentTrailStop ? (
        <View pointerEvents={trailState === 'arrived' ? 'none' : 'box-none'} style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.trailTriviaPanel,
              {
                bottom: trailBottomPanelHeight + 12,
                maxHeight: Math.max(
                  80,
                  Math.min(
                    windowHeight * 0.48,
                    410,
                    Math.max(80, windowHeight - trailBottomPanelHeight - insets.top - 24)
                  )
                ),
                opacity: trailTriviaSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [
                  {
                    translateY: trailTriviaSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 420],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.trailTriviaHeader}>
              <View style={styles.trailTriviaHeaderText}>
                <Text style={styles.trailTriviaTitle}>Did you know?</Text>
                <Text style={styles.trailTriviaDestination} numberOfLines={1}>
                  {currentTrailStop.name}
                </Text>
              </View>
              <Pressable
                style={styles.trailTriviaCloseButton}
                onPress={toggleTrailTriviaPanel}
                accessibilityRole="button"
                accessibilityLabel="Close destination trivia and history"
              >
                <MaterialIcons name="close" size={20} color="#3A2E22" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.trailTriviaScroll}
              contentContainerStyle={styles.trailTriviaContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {isTrailTriviaLoading ? (
                <View style={styles.trailTriviaLoading}>
                  <ActivityIndicator size="small" color={BRAND.accent} />
                  <Text style={styles.trailTriviaMuted}>Loading destination details...</Text>
                </View>
              ) : null}

              {trailTriviaError ? (
                <View style={styles.trailTriviaErrorWrap}>
                  <Text style={styles.trailTriviaError}>{trailTriviaError}</Text>
                  {!isTrailTriviaLoading ? (
                    <Pressable
                      onPress={() => setTrailTriviaRequestVersion((version) => version + 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading destination details"
                    >
                      <Text style={styles.trailTriviaRetry}>Retry</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {hasTrailTriviaHistory ? (
                <View style={styles.trailTriviaSection}>
                  <Text style={styles.trailTriviaSectionTitle}>TRIVIA / HISTORY</Text>
                  <Text style={styles.trailTriviaText}>{activeTrailTriviaHistory}</Text>
                </View>
              ) : null}

              {activeTrailVarieties.length ? (
                <View style={styles.trailTriviaSection}>
                  <Text style={styles.trailTriviaSectionTitle}>COFFEE VARIETIES</Text>
                  <Text style={styles.trailTriviaText}>{activeTrailVarieties.join(' · ')}</Text>
                </View>
              ) : null}

              {activeTrailProducts.length ? (
                <View style={styles.trailTriviaSection}>
                  <Text style={styles.trailTriviaSectionTitle}>OFFERED PRODUCTS</Text>
                  {activeTrailProducts.map((product, index) => {
                    const productName =
                      product?.name ?? product?.product_name ?? product?.title ?? '';
                    const productDescription =
                      product?.description ?? product?.details ?? '';
                    const productKey = product?.id ?? `${productName || 'product'}-${index}`;
                    return (
                      <View key={String(productKey)} style={styles.trailTriviaProduct}>
                        {productName ? (
                          <Text style={styles.trailTriviaProductName}>{String(productName)}</Text>
                        ) : null}
                        {productDescription ? (
                          <Text style={styles.trailTriviaText}>{String(productDescription)}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {!isTrailTriviaLoading && !hasTrailTriviaContent ? (
                <Text style={styles.trailTriviaEmpty}>
                  No trivia, history, coffee varieties, or offered products are available for this destination yet.
                </Text>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}

      {isTrailMode && currentTrailStop && trailState === 'arrived' ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.locationValidationPanel,
              {
                bottom: trailBottomPanelHeight + 12,
                zIndex: 50,
                opacity: locationValidationAnim,
                transform: [
                  {
                    translateY: locationValidationAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
                maxHeight: Math.max(
                  80,
                  Math.min(
                    windowHeight * 0.46,
                    360,
                    Math.max(80, windowHeight - trailBottomPanelHeight - insets.top - 24)
                  )
                ),
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.locationValidationContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              <Text style={styles.locationValidationEyebrow}>VERIFY LOCATION</Text>
              <Text style={styles.locationValidationQuestion}>Is this the right pinned location?</Text>
              <Text style={styles.locationValidationEstablishment}>{currentTrailStop.name}</Text>
              {currentTrailStop.address ? (
                <Text style={styles.locationValidationAddress}>
                  {formatAddressWithBarangay(currentTrailStop.address, currentTrailStop.barangay)}
                </Text>
              ) : null}

              {isLocationChecksLoading ? (
                <View style={styles.locationValidationLoading}>
                  <ActivityIndicator size="small" color={BRAND.accent} />
                  <Text style={styles.locationValidationMessage}>Checking saved response…</Text>
                </View>
              ) : currentLocationCheck ? (
                <View
                  style={[
                    styles.locationValidationSaved,
                    currentLocationCheck.response === 'yes'
                      ? styles.locationValidationSavedCorrect
                      : styles.locationValidationSavedIncorrect,
                  ]}
                >
                  <MaterialIcons
                    name={currentLocationCheck.response === 'yes' ? 'thumb-up' : 'thumb-down'}
                    size={20}
                    color={currentLocationCheck.response === 'yes' ? '#2D4A1E' : '#A33939'}
                  />
                  <View style={styles.locationValidationSavedTextWrap}>
                    <Text style={styles.locationValidationSavedTitle}>
                      {(() => {
                        const resultLabel = String(currentLocationCheck.result || '').trim().toLowerCase();
                        if (['correct_location', 'correct location', 'yes'].includes(resultLabel)) return 'Correct location';
                        if (['incorrect_location', 'incorrect location', 'no'].includes(resultLabel)) return 'Incorrect location';
                        return currentLocationCheck.response === 'yes' ? 'Correct location' : 'Incorrect location';
                      })()}
                    </Text>
                    <Text style={styles.locationValidationMessage}>
                      {currentLocationCheck.response === 'no'
                        ? 'Your location report has been saved for review.'
                        : 'Your location check has been saved.'}
                    </Text>
                  </View>
                </View>
              ) : locationChecksError ? (
                <View style={styles.locationValidationErrorWrap}>
                  <Text style={styles.locationValidationError}>{locationChecksError}</Text>
                  <Pressable
                    style={styles.locationValidationRetry}
                    onPress={() => void refreshLocationChecks()}
                  >
                    <Text style={styles.locationValidationRetryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.locationValidationResponses}>
                  {[
                    { response: 'no', label: 'No, incorrect', icon: 'thumb-down' },
                    { response: 'yes', label: 'Yes, correct', icon: 'thumb-up' },
                  ].map((option) => {
                    const selected = selectedLocationResponse === option.response;
                    return (
                      <Pressable
                        key={option.response}
                        style={[
                          styles.locationValidationOption,
                          option.response === 'yes'
                            ? styles.locationValidationOptionCorrect
                            : styles.locationValidationOptionIncorrect,
                          selected && (option.response === 'yes'
                            ? styles.locationValidationOptionSelectedCorrect
                            : styles.locationValidationOptionSelectedIncorrect),
                        ]}
                        onPress={() => void handleSaveLocationCheck(option.response)}
                        disabled={isSavingLocationCheck || Boolean(currentLocationCheck)}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                          disabled: isSavingLocationCheck || Boolean(currentLocationCheck),
                        }}
                      >
                        {isSavingLocationCheck && selected ? (
                          <ActivityIndicator size="small" color="#2D4A1E" />
                        ) : (
                          <MaterialIcons
                            name={option.icon}
                            size={20}
                            color={option.response === 'yes' ? '#2D4A1E' : '#A33939'}
                          />
                        )}
                        <Text style={styles.locationValidationOptionText}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {locationCheckError ? (
                <View style={styles.locationValidationErrorWrap}>
                  <Text style={styles.locationValidationError}>{locationCheckError}</Text>
                  {selectedLocationResponse ? (
                    <Pressable
                      style={styles.locationValidationRetry}
                      onPress={() => void handleSaveLocationCheck(selectedLocationResponse)}
                      disabled={isSavingLocationCheck}
                    >
                      <Text style={styles.locationValidationRetryText}>
                        {isSavingLocationCheck ? 'Saving…' : 'Retry save'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {locationCheckNotice ? (
                <Text style={styles.locationValidationNotice}>{locationCheckNotice}</Text>
              ) : null}
              {locationTrackingStatus ? (
                <Text style={styles.locationValidationMessage}>{locationTrackingStatus}</Text>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}

      <Modal
        visible={showAboutModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View style={styles.aboutModalBackdrop}>
          <Pressable style={styles.aboutModalBackdropTap} onPress={() => setShowAboutModal(false)} />
          <Animated.View
            style={[
              styles.aboutModalSheet,
              {
                paddingBottom: Math.max(insets.bottom + 14, 20),
                transform: [{ translateY: aboutDragY }],
              },
            ]}
          >
            <View
              collapsable={false}
              style={styles.aboutHandleTouchArea}
              {...aboutHandlePanResponder.panHandlers}
            >
              <View style={styles.aboutHandle} />
            </View>

            <View style={styles.aboutHeaderRow}>
              <View style={styles.aboutHeaderTextWrap}>
                <Text style={styles.aboutTitle}>Coffee Variety Guide</Text>
                <Text style={styles.aboutSubtitle}>Explore the flavor identity and traits of each variety.</Text>
                {showSavedToast ? (
                  <Animated.View style={[styles.aboutToastWrap, { opacity: savedToastOpacity }]}>
                    <Text style={styles.aboutToastText}>{savedToastMessage}</Text>
                  </Animated.View>
                ) : null}
              </View>

              <Pressable style={styles.aboutCloseButton} onPress={() => setShowAboutModal(false)}>
                <MaterialIcons name="close" size={18} color="#3A2E22" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.aboutScroll}
              contentContainerStyle={styles.aboutScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {ABOUT_VARIETY_CONTENT.map((variety) => {
                const isDownloaded = downloadedVarieties.includes(variety.title);

                return (
                <View
                  key={variety.key}
                  style={[
                    styles.aboutVarietyCard,
                    {
                      borderColor: `${variety.color}66`,
                      borderLeftColor: variety.color,
                    },
                  ]}
                >
                  <View style={styles.aboutVarietyHeaderRow}>
                    <Text style={styles.aboutVarietyTitle}>{variety.title}</Text>
                    <View style={styles.aboutVarietyHeaderActions}>
                      <Pressable
                        style={[
                          styles.aboutOfflineButton,
                          isDownloaded && styles.aboutOfflineButtonActive,
                        ]}
                        onPress={() => handleToggleVarietyOffline(variety.title)}
                        accessibilityRole="button"
                        accessibilityLabel={`${isDownloaded ? 'Remove' : 'Download'} ${variety.title} for offline access`}
                      >
                        <MaterialIcons
                          name={isDownloaded ? 'check-circle' : 'download'}
                          size={19}
                          color={isDownloaded ? '#24563B' : '#6E6254'}
                        />
                      </Pressable>

                      <Pressable
                        style={styles.aboutBeanPreviewButton}
                        onPress={() => handleOpenBeanPreview(variety.imageSource || null)}
                        accessibilityRole="button"
                        accessibilityLabel={`Preview ${variety.title} coffee bean image`}
                      >
                        <Image source={variety.imageSource} style={styles.aboutBeanPreviewImage} resizeMode="contain" />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.aboutScientificName}>{variety.scientificName}</Text>

                  <Text style={styles.aboutSectionLabel}>Overview</Text>
                  <Text style={styles.aboutBodyText}>{variety.overview}</Text>

                  <Text style={styles.aboutSectionLabel}>Taste Profile</Text>
                  {variety.tasteProfile.map((item, idx) => (
                    <Text key={`${variety.key}-taste-${idx}`} style={styles.aboutBulletText}>• {item}</Text>
                  ))}

                  <Text style={styles.aboutSectionLabel}>Characteristics</Text>
                  {variety.characteristics.map((item, idx) => (
                    <Text key={`${variety.key}-characteristics-${idx}`} style={styles.aboutBulletText}>• {item}</Text>
                  ))}

                  <Text style={styles.aboutReference}>Reference: {variety.reference}</Text>
                </View>
                );
              })}
            </ScrollView>
          </Animated.View>

          {showBeanPreviewModal ? (
            <Animated.View style={[styles.aboutBeanModalBackdrop, { opacity: beanPreviewAnim }]}>
              <Pressable style={styles.aboutBeanModalBackdropTap} onPress={handleCloseBeanPreview} />
              <Animated.View
                style={[
                  styles.aboutBeanModalCard,
                  {
                    opacity: beanPreviewAnim,
                    transform: [
                      {
                        scale: beanPreviewAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {beanPreviewSource ? (
                  <Image source={beanPreviewSource} style={styles.aboutBeanModalImage} resizeMode="contain" fadeDuration={0} />
                ) : (
                  <MaterialCommunityIcons name="coffee-bean" size={128} color="#7A5D3A" />
                )}
              </Animated.View>
            </Animated.View>
          ) : null}
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
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'visible',
    position: 'relative',
    opacity: 1,
  },
  trailMarkerCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  trailMarkerText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  establishmentMarker: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 3,
    elevation: 3,
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
  trailTriviaPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9C9B2',
    backgroundColor: '#FFF9F0',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 40,
  },
  locationValidationPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9C9B2',
    backgroundColor: '#FFF9F0',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 14,
  },
  locationValidationContent: {
    gap: 8,
    paddingBottom: 8,
  },
  locationValidationEyebrow: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.6,
  },
  locationValidationQuestion: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 16,
    lineHeight: 22,
  },
  locationValidationEstablishment: {
    color: '#3A2E22',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 14,
    lineHeight: 19,
  },
  locationValidationAddress: {
    color: '#6A5A4B',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
  },
  locationValidationResponses: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  locationValidationOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  locationValidationOptionCorrect: {
    backgroundColor: '#FFFFFF',
    borderColor: '#B8CBAA',
  },
  locationValidationOptionIncorrect: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6B9B9',
  },
  locationValidationOptionSelectedCorrect: {
    backgroundColor: '#E9F2E3',
    borderColor: '#2D4A1E',
    borderWidth: 2,
  },
  locationValidationOptionSelectedIncorrect: {
    backgroundColor: '#FCECEC',
    borderColor: '#A33939',
    borderWidth: 2,
  },
  locationValidationOptionText: {
    color: '#3A2E22',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 11,
    lineHeight: 15,
    flexShrink: 1,
    textAlign: 'center',
  },
  locationValidationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  locationValidationMessage: {
    color: '#6A5A4B',
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
    lineHeight: 16,
    flexShrink: 1,
  },
  locationValidationSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
  },
  locationValidationSavedCorrect: {
    borderColor: '#B8CBAA',
    backgroundColor: '#E9F2E3',
  },
  locationValidationSavedIncorrect: {
    borderColor: '#E6B9B9',
    backgroundColor: '#FCECEC',
  },
  locationValidationSavedTextWrap: {
    flex: 1,
    gap: 2,
  },
  locationValidationSavedTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 17,
  },
  locationValidationNotice: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsMedium',
    fontSize: 11,
    lineHeight: 16,
  },
  locationValidationErrorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: '#F8EFE4',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locationValidationError: {
    flex: 1,
    color: '#80552F',
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
    lineHeight: 15,
  },
  locationValidationRetry: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  locationValidationRetryText: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 12,
  },
  locationTrackingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
    borderRadius: 10,
    backgroundColor: '#FFF9F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  locationTrackingNoticeText: {
    flex: 1,
    color: '#80552F',
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
    lineHeight: 15,
  },
  locationTrackingRetry: {
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  locationTrackingRetryText: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
  },
  locationValidationInlineError: {
    marginTop: 8,
    color: '#A33939',
    fontFamily: 'PoppinsMedium',
    fontSize: 11,
    lineHeight: 15,
  },
  trailTriviaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E4D8C8',
  },
  trailTriviaHeaderText: {
    flex: 1,
  },
  trailTriviaTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 16,
    lineHeight: 21,
  },
  trailTriviaDestination: {
    marginTop: 1,
    color: '#6A5A4B',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
  },
  trailTriviaCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0E7DA',
  },
  trailTriviaScroll: {
    flexShrink: 1,
  },
  trailTriviaContent: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  trailTriviaLoading: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  trailTriviaMuted: {
    color: '#6A5A4B',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
  },
  trailTriviaErrorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 10,
    backgroundColor: '#F8EFE4',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  trailTriviaError: {
    flex: 1,
    color: '#80552F',
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
    lineHeight: 15,
  },
  trailTriviaRetry: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 12,
  },
  trailTriviaSection: {
    gap: 4,
  },
  trailTriviaSectionTitle: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 13,
    lineHeight: 18,
  },
  trailTriviaText: {
    color: '#4B3B2D',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 18,
  },
  trailTriviaProduct: {
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#E4D8C8',
  },
  trailTriviaProductName: {
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 17,
  },
  trailTriviaEmpty: {
    paddingVertical: 10,
    color: '#6A5A4B',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
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
    ...StyleSheet.absoluteFillObject,
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
  aboutButtonWrap: {
    position: 'absolute',
    right: 12,
    zIndex: 22,
  },
  aboutButton: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
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
  dropdownTypeIconWrap: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    position: 'relative',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
  calloutArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  androidCalloutContainer: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 9999,
    // pointerEvents managed per element
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
    flex: 1,
    color: BRAND.text,
    fontFamily: 'PoppinsBold',
    fontSize: 19,
    lineHeight: 24,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetSaveWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  sheetSaveButtonInline: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CCBE',
    backgroundColor: '#F9F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  savedToastWrap: {
    borderWidth: 1,
    borderColor: '#D8CCBE',
    backgroundColor: '#FFFCF8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savedToastText: {
    color: '#6E6254',
    fontFamily: 'PoppinsMedium',
    fontSize: 10,
    lineHeight: 12,
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
    backgroundColor: '#2D4A1E',
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoChatButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CDBFAE',
    backgroundColor: '#F9F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    color: '#4B3B2D',
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 18,
  },
  detailLinkText: {
    color: '#1E40AF',
    fontFamily: 'PoppinsMedium',
    textDecorationLine: 'underline',
  },
  productsChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  productRatingsList: {
    marginTop: 2,
    gap: 8,
  },
  productRatingRow: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D2C5B3',
    backgroundColor: '#F7F2EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  productRatingName: {
    color: '#3A2E22',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 13,
    lineHeight: 17,
  },
  productRatingStars: {
    color: '#7A5A18',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 16,
  },
  productRatingStarsMuted: {
    color: '#8E7E6D',
  },
  productChip: {
    borderWidth: 1,
    borderColor: '#D2C5B3',
    backgroundColor: '#F7F2EA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  productChipText: {
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    lineHeight: 15,
  },
  marketplaceInlineButton: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  marketplaceInlineButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 16,
  },
  infoLinkButton: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B7C7AF',
    backgroundColor: '#EFF5EC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  infoLinkButtonText: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 13,
    lineHeight: 16,
  },
  promoRow: {
    marginTop: 2,
    minHeight: 84,
    borderWidth: 1,
    borderColor: '#D2C5B3',
    borderRadius: 12,
    backgroundColor: '#F7F2EA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  promoRowClickable: {
    borderColor: '#CDB99D',
  },
  promoContentWrap: {
    flex: 1,
    gap: 2,
  },
  promoTitleText: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 18,
  },
  promoDiscountText: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 12,
    lineHeight: 16,
  },
  promoDescriptionText: {
    color: '#6A5A4B',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 16,
  },
  promoHintText: {
    marginTop: 3,
    color: '#7B7B7B',
    fontFamily: 'PoppinsItalic',
    fontSize: 11,
    lineHeight: 15,
  },
  promoCouponButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#C8973A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
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
  aboutModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29, 23, 17, 0.34)',
    justifyContent: 'flex-end',
  },
  aboutModalBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  aboutModalSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#D8C8B1',
    backgroundColor: '#FFF9F0',
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  aboutHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#C7B49A',
    marginBottom: 10,
  },
  aboutHandleTouchArea: {
    alignSelf: 'stretch',
    minHeight: 28,
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 8,
  },
  aboutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  aboutHeaderTextWrap: {
    flex: 1,
  },
  aboutTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 19,
    lineHeight: 24,
  },
  aboutSubtitle: {
    marginTop: 3,
    color: '#645746',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
  },
  aboutToastWrap: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D8CCBE',
    backgroundColor: '#FFFCF8',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  aboutToastText: {
    color: '#6E6254',
    fontFamily: 'PoppinsMedium',
    fontSize: 10,
    lineHeight: 12,
  },
  aboutCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#F1E6D7',
    borderWidth: 1,
    borderColor: '#DCCDB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutScroll: {
    marginTop: 10,
  },
  aboutScrollContent: {
    gap: 10,
    paddingBottom: 4,
  },
  aboutVarietyCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 14,
    backgroundColor: '#FFFDFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  aboutVarietyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  aboutVarietyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutVarietyTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 15,
    lineHeight: 20,
  },
  aboutOfflineButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CCBC',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutOfflineButtonActive: {
    backgroundColor: '#E2F1D8',
    borderColor: '#B8D1A8',
  },
  aboutBeanPreviewButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CCBC',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutBeanPreviewImage: {
    width: 30,
    height: 30,
  },
  aboutScientificName: {
    marginTop: 1,
    color: '#695A46',
    fontFamily: 'PoppinsItalic',
    fontSize: 12,
    lineHeight: 16,
  },
  aboutSectionLabel: {
    marginTop: 8,
    marginBottom: 2,
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 16,
  },
  aboutBodyText: {
    color: '#4D3F31',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
  },
  aboutBulletText: {
    color: '#4D3F31',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  aboutReference: {
    marginTop: 8,
    color: '#76624B',
    fontFamily: 'PoppinsItalic',
    fontSize: 11,
    lineHeight: 15,
  },
  aboutBeanModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 18, 12, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 30,
  },
  aboutBeanModalBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  aboutBeanModalCard: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 31,
  },
  aboutBeanModalImage: {
    width: 280,
    height: 280,
  },
});
