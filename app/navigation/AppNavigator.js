import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  More: 'more-horiz',
};

function MorePlaceholderScreen() {
  return <View style={styles.morePlaceholder} />;
}

function MainTabNavigator({ navigation }) {
  const insets = useSafeAreaInsets();
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);

  const closeMoreMenu = () => {
    setIsMoreMenuVisible(false);
  };

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
          listeners={{
            tabPress: closeMoreMenu,
          }}
        />
        <Tab.Screen
          name="Trail"
          component={TrailScreen}
          listeners={{
            tabPress: closeMoreMenu,
          }}
        />
        <Tab.Screen
          name="Rating"
          component={RatingScreen}
          listeners={{
            tabPress: closeMoreMenu,
          }}
        />
        <Tab.Screen
          name="Promos"
          component={PromosScreen}
          listeners={{
            tabPress: closeMoreMenu,
          }}
        />
        <Tab.Screen
          name="More"
          component={MorePlaceholderScreen}
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              setIsMoreMenuVisible((prev) => !prev);
            },
          }}
        />
      </Tab.Navigator>

      {isMoreMenuVisible ? (
        <>
          <Pressable style={styles.moreBackdrop} onPress={closeMoreMenu} />
          <View style={[styles.moreMenuCard, { bottom: Math.max(insets.bottom + 78, 90) }]}> 
            <Pressable
              style={({ pressed }) => [styles.moreMenuItem, pressed && styles.moreMenuItemPressed]}
              android_ripple={{ color: 'rgba(45, 74, 30, 0.10)' }}
              onPress={() => {
                closeMoreMenu();
                navigation.navigate('Marketplace');
              }}
            >
              <MaterialIcons name="shopping-bag" size={16} color="#2D4A1E" />
              <Text style={styles.moreMenuItemText}>Marketplace</Text>
            </Pressable>

            <View style={styles.moreMenuDivider} />

            <Pressable
              style={({ pressed }) => [styles.moreMenuItem, pressed && styles.moreMenuItemPressed]}
              android_ripple={{ color: 'rgba(45, 74, 30, 0.10)' }}
              onPress={() => {
                closeMoreMenu();
                navigation.navigate('Profile');
              }}
            >
              <MaterialIcons name="person" size={16} color="#2D4A1E" />
              <Text style={styles.moreMenuItemText}>Profile</Text>
            </Pressable>
          </View>
        </>
      ) : null}
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
      <Stack.Screen name="Profile" component={ProfileScreen} />
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
  morePlaceholder: {
    flex: 1,
    backgroundColor: '#F3E9D7',
  },
  moreBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  moreMenuCard: {
    position: 'absolute',
    right: 12,
    width: 176,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D2C5B3',
    backgroundColor: '#FFFDF8',
    paddingVertical: 4,
    zIndex: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  moreMenuItem: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  moreMenuItemPressed: {
    backgroundColor: 'rgba(45, 74, 30, 0.08)',
  },
  moreMenuDivider: {
    marginHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5DACB',
  },
  moreMenuItemText: {
    color: '#2D4A1E',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 17,
  },
});
