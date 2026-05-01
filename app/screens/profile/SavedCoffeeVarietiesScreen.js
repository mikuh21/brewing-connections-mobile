import { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ConfirmToastModal, ScreenContainer } from '../../components';
import theme from '../../theme';

const DOWNLOADED_VARIETIES_KEY = 'offline_saved_varieties';

const ABOUT_VARIETY_CONTENT = [
  {
    key: 'arabica',
    title: 'Arabica',
    scientificName: 'Coffea arabica',
    color: '#8B1A1A',
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
    color: '#B8860B',
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
    color: '#4A6741',
    imageSource: require('../../../assets/LIBERICA.png'),
    overview:
      'Liberica is a rare coffee species globally but holds cultural and agricultural importance in the Philippines. It is known for its distinctive aroma and unique flavor that sets it apart from more common varieties.',
    tasteProfile: ['Smoky, woody, sometimes floral', 'Unique, complex flavor', 'Slightly fruity with a bold body'],
    characteristics: ['Large, irregular beans', 'Thrives in tropical climates', 'Limited production worldwide'],
    reference: 'Philippine Coffee Board; PCAARRD-DOST',
  },
  {
    key: 'robusta',
    title: 'Robusta',
    scientificName: 'Coffea canephora',
    color: '#6B3A2A',
    imageSource: require('../../../assets/ROBUSTA.png'),
    overview:
      'Robusta is known for its strong, bold flavor and is commonly used in instant coffee and espresso blends. It is easier to grow and more resilient, making it a practical choice for large-scale production.',
    tasteProfile: ['Bold, strong, and bitter', 'Notes: earthy, nutty, woody', 'Less acidity'],
    characteristics: ['Higher caffeine content', 'Grows in lower altitudes', 'More resistant to pests and diseases'],
    reference: 'Philippine Coffee Board; CoffeeBeans.ph',
  },
];

export default function SavedCoffeeVarietiesScreen({ navigation }) {
  const [downloadedVarieties, setDownloadedVarieties] = useState([]);
  const [confirmState, setConfirmState] = useState({
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Remove',
    onConfirm: null,
  });

  const savedVarietyCards = useMemo(() => {
    const savedSet = new Set(
      downloadedVarieties.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    );

    return ABOUT_VARIETY_CONTENT.filter((item) => savedSet.has(String(item.title).toLowerCase()));
  }, [downloadedVarieties]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadSavedVarieties = async () => {
        try {
          const raw = await AsyncStorage.getItem(DOWNLOADED_VARIETIES_KEY);
          const parsed = JSON.parse(raw || '[]');

          if (!isMounted) {
            return;
          }

          setDownloadedVarieties(Array.isArray(parsed) ? parsed : []);
        } catch {
          if (isMounted) {
            setDownloadedVarieties([]);
          }
        }
      };

      loadSavedVarieties();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const removeSavedVariety = async (varietyTitle) => {
    const key = String(varietyTitle || '').trim();
    if (!key) {
      return;
    }

    const next = downloadedVarieties.filter(
      (item) => String(item || '').trim().toLowerCase() !== key.toLowerCase()
    );

    setDownloadedVarieties(next);

    try {
      await AsyncStorage.setItem(DOWNLOADED_VARIETIES_KEY, JSON.stringify(next));
    } catch {
      // Keep screen responsive even when local persistence fails.
    }
  };

  const openConfirm = ({ title, message, confirmLabel = 'Remove', onConfirm }) => {
    setConfirmState({
      visible: true,
      title,
      message,
      confirmLabel,
      onConfirm,
    });
  };

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, visible: false, onConfirm: null }));
  };

  const handleConfirm = () => {
    const action = confirmState.onConfirm;
    closeConfirm();
    if (typeof action === 'function') {
      void action();
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Saved Coffee Varieties</Text>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={16} color={theme.colors.white} />
          <Text style={styles.backText}>Profile</Text>
        </Pressable>
      </View>
      <Text style={styles.headerSubtitle}>Review your saved variety cards</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {savedVarietyCards.length ? (
          savedVarietyCards.map((variety) => (
            <View
              key={variety.key}
              style={[
                styles.varietyCard,
                {
                  borderColor: `${variety.color}66`,
                  borderLeftColor: variety.color,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{variety.title}</Text>
                <View style={styles.cardHeaderActions}>
                  <View style={styles.beanPreviewWrap}>
                    <Image source={variety.imageSource} style={styles.beanPreviewImage} resizeMode="contain" />
                  </View>
                </View>
              </View>

              <Text style={styles.scientificName}>{variety.scientificName}</Text>

              <Text style={styles.sectionLabel}>Overview</Text>
              <Text style={styles.bodyText}>{variety.overview}</Text>

              <Text style={styles.sectionLabel}>Taste Profile</Text>
              {variety.tasteProfile.map((item, idx) => (
                <Text key={`${variety.key}-taste-${idx}`} style={styles.bulletText}>• {item}</Text>
              ))}

              <Text style={styles.sectionLabel}>Characteristics</Text>
              {variety.characteristics.map((item, idx) => (
                <Text key={`${variety.key}-characteristics-${idx}`} style={styles.bulletText}>• {item}</Text>
              ))}

              <Text style={styles.referenceText}>Reference: {variety.reference}</Text>

              <View style={styles.cardActionsRow}>
                <Pressable
                  style={[styles.cardActionButton, styles.removeButton]}
                  onPress={() =>
                    openConfirm({
                      title: 'Remove Saved Variety',
                      message: `Remove ${variety.title} from saved coffee varieties?`,
                      confirmLabel: 'Remove',
                      onConfirm: () => removeSavedVariety(variety.title),
                    })
                  }
                >
                  <MaterialIcons name="bookmark-remove" size={14} color="#A33939" />
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <MaterialIcons name="coffee" size={22} color="#2D4A1E" />
            <Text style={styles.emptyTitle}>No saved varieties yet.</Text>
            <Text style={styles.emptyDescription}>Save a variety from the About Coffee Varieties guide to see it here.</Text>
          </View>
        )}
      </ScrollView>

      <ConfirmToastModal
        visible={confirmState.visible}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  varietyCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 14,
    backgroundColor: '#FFFDFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 15,
    lineHeight: 20,
  },
  beanPreviewWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CCBC',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beanPreviewImage: {
    width: 30,
    height: 30,
  },
  scientificName: {
    marginTop: 1,
    color: '#695A46',
    fontFamily: 'PoppinsItalic',
    fontSize: 12,
    lineHeight: 16,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 2,
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 12,
    lineHeight: 16,
  },
  bodyText: {
    color: '#4D3F31',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
  },
  bulletText: {
    color: '#4D3F31',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  referenceText: {
    marginTop: 8,
    color: '#76624B',
    fontFamily: 'PoppinsItalic',
    fontSize: 11,
    lineHeight: 15,
  },
  cardActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  cardActionButton: {
    width: '100%',
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  removeButton: {
    borderColor: 'rgba(163, 57, 57, 0.35)',
    backgroundColor: 'rgba(163, 57, 57, 0.10)',
  },
  removeButtonText: {
    color: '#A33939',
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