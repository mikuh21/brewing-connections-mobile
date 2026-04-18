import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context';
import { login as loginRequest } from '../../services';
import theme from '../../theme';

const logoImage = require('../../../assets/auth/brewing-connections-logo.png');
const googleIcon = require('../../../assets/auth/google-icon.png');

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const data = await loginRequest(email, password);
      const token = data?.token ?? data?.access_token ?? null;
      const user = data?.user ?? null;

      if (!token) {
        throw new Error('Login did not return a token.');
      }

      await login(token, user);
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError.message || 'Unable to login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />

            <View style={styles.formArea}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#808080"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder="Password"
                  placeholderTextColor="#808080"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={10}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color="#6F5948"
                  />
                </Pressable>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable style={styles.forgotWrap} onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>

              <Pressable
                disabled={isSubmitting || !email || !password}
                onPress={onSubmit}
                style={({ pressed }) => [
                  styles.button,
                  (isSubmitting || !email || !password) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Log In</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable style={styles.googleButton}>
                <Image source={googleIcon} style={styles.googleIcon} resizeMode="contain" />
                <Text style={styles.googleText}>Google</Text>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Register')} style={styles.signupWrap}>
                <Text style={styles.signupText}>
                  Don’t have an account? <Text style={styles.signupTextBold}>Sign Up</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3E9D7',
  },
  keyboardWrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 26,
    justifyContent: 'center',
  },
  logo: {
    width: 178,
    height: 172,
    marginBottom: 18,
  },
  formArea: {
    width: '100%',
    maxWidth: 312,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    height: 46,
    borderWidth: 1,
    borderColor: '#3A2E22',
    borderRadius: 15,
    backgroundColor: '#E8E8E8',
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#3A2E22',
    fontFamily: 'PoppinsRegular',
    marginBottom: 12,
  },
  inputWrapper: {
    width: '100%',
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 11,
  },
  forgotWrap: {
    marginTop: 2,
    marginBottom: 28,
  },
  forgotText: {
    fontSize: 14,
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
  },
  button: {
    width: '100%',
    height: 51,
    backgroundColor: '#2D4A1E',
    borderWidth: 1,
    borderColor: '#3A2E22',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontFamily: 'PoppinsMedium',
  },
  error: {
    width: '100%',
    marginBottom: 8,
    fontSize: 13,
    color: '#9B3E3E',
    textAlign: 'left',
    fontFamily: 'PoppinsRegular',
  },
  dividerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  dividerLine: {
    width: 95,
    height: 1,
    backgroundColor: '#3A2E22',
  },
  dividerText: {
    fontSize: 14,
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
  },
  googleButton: {
    width: '100%',
    height: 51,
    backgroundColor: '#E8E8E8',
    borderWidth: 1,
    borderColor: '#3A2E22',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 34,
  },
  googleIcon: {
    width: 28,
    height: 39,
  },
  googleText: {
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
  },
  signupWrap: {
    marginTop: 2,
  },
  signupText: {
    fontSize: 16,
    letterSpacing: -0.8,
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
  },
  signupTextBold: {
    fontFamily: 'PoppinsBold',
  },
});
