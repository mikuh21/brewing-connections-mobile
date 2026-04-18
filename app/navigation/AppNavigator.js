import { MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View } from 'react-native';
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

function MainTabNavigator() {
  const insets = useSafeAreaInsets();

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
});
