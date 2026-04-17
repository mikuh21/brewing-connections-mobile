import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { resetPasswordWithOtp } from '../../services';

export default function ResetPasswordScreen({ navigation, route }) {
  const initialEmail = route?.params?.email ? String(route.params.email).trim().toLowerCase() : '';
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ password: '', confirmPassword: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validatePassword = (value) => {
    const hasSpecialCharacter = /[@$!%*#?&]/.test(value);

    if (!value) {
      return 'Password is required.';
    }

    if (value.length < 8 || value.length > 16) {
      return 'Password must be between 8 and 16 characters.';
    }

    if (!hasSpecialCharacter) {
      return 'Password must include at least one special character.';
    }

    return '';
  };

  const validateConfirmPassword = (value, currentPassword) => {
    if (!value) {
      return 'Confirm Password is required.';
    }

    if (value !== currentPassword) {
      return 'Password confirmation does not match.';
    }

    return '';
  };

  const validatePasswordFields = () => {
    const nextErrors = {
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
    };

    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const isDisabled = useMemo(() => {
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, password);

    return (
      isSubmitting ||
      !email.trim() ||
      otp.trim().length !== 6 ||
      Boolean(passwordError) ||
      Boolean(confirmPasswordError)
    );
  }, [confirmPassword, email, isSubmitting, otp, password]);

  const onResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const isPasswordValid = validatePasswordFields();

    if (!isPasswordValid) {
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await resetPasswordWithOtp({
        email: normalizedEmail,
        otp: otp.trim(),
        password,
        password_confirmation: confirmPassword,
      });

      setSuccess(response?.message || 'Password reset successfully.');
      navigation.navigate('Login');
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError.message || 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code from your email and your new password.</Text>

          <TextInput
            style={styles.input}
            placeholder="Registered Email"
            placeholderTextColor="#808080"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="6-digit Code"
            placeholderTextColor="#808080"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/[^0-9]/g, ''))}
          />

          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="New Password"
              placeholderTextColor="#808080"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(value) => {
                setPassword(value);

                setFieldErrors((prev) => ({
                  ...prev,
                  password: prev.password ? validatePassword(value) : prev.password,
                  confirmPassword:
                    confirmPassword && prev.confirmPassword
                      ? validateConfirmPassword(confirmPassword, value)
                      : prev.confirmPassword,
                }));
              }}
              onBlur={() =>
                setFieldErrors((prev) => ({
                  ...prev,
                  password: validatePassword(password),
                }))
              }
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
          {fieldErrors.password ? <Text style={styles.inlineError}>{fieldErrors.password}</Text> : null}

          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="Confirm New Password"
              placeholderTextColor="#808080"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);

                setFieldErrors((prev) => ({
                  ...prev,
                  confirmPassword: prev.confirmPassword
                    ? validateConfirmPassword(value, password)
                    : prev.confirmPassword,
                }));
              }}
              onBlur={() =>
                setFieldErrors((prev) => ({
                  ...prev,
                  confirmPassword: validateConfirmPassword(confirmPassword, password),
                }))
              }
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword((prev) => !prev)}
              hitSlop={10}
            >
              <MaterialIcons
                name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color="#6F5948"
              />
            </Pressable>
          </View>
          {fieldErrors.confirmPassword ? <Text style={styles.inlineError}>{fieldErrors.confirmPassword}</Text> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.message}>{success}</Text> : null}

          <Pressable
            disabled={isDisabled}
            onPress={onResetPassword}
            style={({ pressed }) => [styles.button, isDisabled && styles.buttonDisabled, pressed && styles.buttonPressed]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </Pressable>

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.secondaryAction}>
            <Text style={styles.secondaryText}>Need a new code?</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3E9D7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#D8C3A7',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6F5948',
    fontFamily: 'PoppinsRegular',
    marginBottom: 18,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#3A2E22',
    borderRadius: 15,
    backgroundColor: '#E8E8E8',
    paddingHorizontal: 15,
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
    top: 14,
  },
  inlineError: {
    marginTop: -6,
    marginBottom: 10,
    fontSize: 13,
    color: '#9B3E3E',
    fontFamily: 'PoppinsRegular',
  },
  error: {
    fontSize: 13,
    color: '#9B3E3E',
    fontFamily: 'PoppinsRegular',
  },
  message: {
    fontSize: 13,
    color: '#2E5A3D',
    fontFamily: 'PoppinsMedium',
  },
  button: {
    marginTop: 16,
    width: '100%',
    height: 50,
    backgroundColor: '#2E5A3D',
    borderWidth: 1,
    borderColor: '#3A2E22',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'PoppinsMedium',
  },
  secondaryAction: {
    marginTop: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#3A2E22',
    fontSize: 14,
    fontFamily: 'PoppinsMedium',
  },
});
