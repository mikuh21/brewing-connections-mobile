import { useMemo, useState } from 'react';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapScreen from '../screens/map';
import TrailScreen from '../screens/trail';
import PromosScreen from '../screens/promos';
import MarketplaceScreen from '../screens/marketplace';
import MarketplaceCartScreen from '../screens/marketplace/CartScreen';
import ProfileScreen from '../screens/profile';
import SavedTrailsScreen from '../screens/profile/SavedTrailsScreen';
import RatingScreen from '../screens/ratings';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const TAB_ICONS = {
  Map: 'map',
  Trail: 'coffee',
  Rating: 'star',
  Promos: 'local-offer',
  Profile: 'person',
};

const ESTABLISHMENT_LEGEND = [
  { key: 'farm', label: 'Farms', color: '#2D4A1E', icon: 'eco', iconLibrary: 'material' },
  { key: 'cafe', label: 'Cafes', color: '#8B4513', icon: 'local-cafe', iconLibrary: 'material' },
  { key: 'roaster', label: 'Roasters', color: '#C8973A', icon: 'local-fire-department', iconLibrary: 'material' },
  { key: 'reseller', label: 'Resellers', color: '#1E40AF', icon: 'seed', iconLibrary: 'community' },
];

const VARIETY_LEGEND = [
  { key: 'liberica', label: 'Liberica', color: '#4A6741' },
  { key: 'excelsa', label: 'Excelsa', color: '#B8860B' },
  { key: 'robusta', label: 'Robusta', color: '#6B3A2A' },
  { key: 'arabica', label: 'Arabica', color: '#8B1A1A' },
];

function renderLegendIcon(icon, iconLibrary, color) {
  if (iconLibrary === 'community') {
    return <MaterialCommunityIcons name={icon} size={15} color="#FFFFFF" />;
  }

  return <MaterialIcons name={icon} size={16} color="#FFFFFF" />;
}

function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const [showLegendModal, setShowLegendModal] = useState(true);
  const modalTopPadding = useMemo(() => Math.max(insets.top + 12, 26), [insets.top]);
  const modalBottomPadding = useMemo(() => Math.max(insets.bottom + 16, 24), [insets.bottom]);

  return (
    <View style={styles.tabShell}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: '#2E5A3D',
          tabBarInactiveTintColor: '#77695B',
          tabBarStyle: {
            height: 72,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 10),
            marginBottom: 6,
            backgroundColor: '#F3E9D7',
            borderTopColor: '#D2C5B3',
            borderTopWidth: 1,
          },
          tabBarItemStyle: {
            paddingTop: 1,
            paddingBottom: 3,
          },
          tabBarIconStyle: {
            marginTop: -2,
          },
          tabBarLabelStyle: {
            fontFamily: 'PoppinsMedium',
            fontSize: 11,
            lineHeight: 13,
            letterSpacing: -0.2,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialIcons
              name={TAB_ICONS[route.name]}
              color={color}
              size={focused ? size + 2 : size}
            />
          ),
        })}
      >
        <Tab.Screen
          name="Map"
          component={MapScreen}
        />
        <Tab.Screen
          name="Trail"
          component={TrailScreen}
        />
        <Tab.Screen
          name="Rating"
          component={RatingScreen}
        />
        <Tab.Screen
          name="Promos"
          component={PromosScreen}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
        />
      </Tab.Navigator>

      <Modal visible={showLegendModal} transparent animationType="fade" onRequestClose={() => setShowLegendModal(false)}>
        <View
          style={[
            styles.legendModalBackdrop,
            {
              paddingTop: modalTopPadding,
              paddingBottom: modalBottomPadding,
            },
          ]}
        >
          <View style={styles.legendModalCard}>
            <Text style={styles.legendModalTitle}>Map Legend</Text>
            <Text style={styles.legendModalSubtitle}>
              Quick guide for establishment markers and coffee variety colors.
            </Text>

            <Text style={styles.legendSectionTitle}>Establishment Types</Text>
            <View style={styles.legendGrid}>
              {ESTABLISHMENT_LEGEND.map((item) => (
                <View key={item.key} style={styles.legendRow}>
                  <View style={[styles.legendIconWrap, { backgroundColor: item.color }]}>
                    {renderLegendIcon(item.icon, item.iconLibrary, item.color)}
                  </View>
                  <Text style={styles.legendLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.legendSectionTitle}>Coffee Varieties</Text>
            <View style={styles.varietyLegendWrap}>
              {VARIETY_LEGEND.map((item) => (
                <View key={item.key} style={styles.varietyLegendRow}>
                  <View style={[styles.varietySwatch, { backgroundColor: item.color }]} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.legendDismissButton} onPress={() => setShowLegendModal(false)}>
              <Text style={styles.legendDismissButtonText}>Got it!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
      <Stack.Screen
        name="MarketplaceCart"
        component={MarketplaceCartScreen}
        options={{
          presentation: 'modal',
          gestureDirection: 'vertical',
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
          cardStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="SavedTrails"
        component={SavedTrailsScreen}
        options={{
          gestureDirection: 'horizontal',
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    flex: 1,
  },
  legendModalBackdrop: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: 'center',
    backgroundColor: 'rgba(39, 30, 20, 0.38)',
  },
  legendModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9CBB5',
    backgroundColor: '#FFF9F1',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  legendModalTitle: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsBold',
    fontSize: 20,
    lineHeight: 24,
  },
  legendModalSubtitle: {
    marginTop: 5,
    color: '#5F5244',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
  },
  legendSectionTitle: {
    marginTop: 12,
    marginBottom: 7,
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 17,
  },
  legendGrid: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  legendIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendLabel: {
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 17,
  },
  varietyLegendWrap: {
    marginTop: 1,
    gap: 7,
  },
  varietyLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  varietySwatch: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CCBB',
  },
  legendDismissButton: {
    marginTop: 15,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#2D4A1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDismissButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 14,
    lineHeight: 18,
  },
});
