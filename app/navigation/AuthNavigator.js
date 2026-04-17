import { createStackNavigator } from '@react-navigation/stack';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

const Stack = createStackNavigator();

const noAnimationInterpolator = () => ({
  cardStyle: {
    opacity: 1,
  },
});

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#F5F0E8' },
        cardStyleInterpolator: noAnimationInterpolator,
        animationEnabled: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
