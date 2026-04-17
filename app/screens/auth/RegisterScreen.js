import { useState } from 'react';
import {
  ActivityIndicator,
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
import { register as registerRequest } from '../../services';
import theme from '../../theme';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validateName = (value) => {
    const trimmed = value.trim();

    if (!trimmed) {
      return 'Full Name is required.';
    }

    if (trimmed.length < 2) {
      return 'Full Name must be at least 2 characters.';
    }

    return '';
  };

  const validateEmail = (value) => {
    const trimmed = value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmed) {
      return 'Email is required.';
    }

    if (!emailPattern.test(trimmed)) {
      return 'Please enter a valid email address.';
    }

    return '';
  };

  const validatePassword = (value) => {
    const hasUppercase = /[A-Z]/.test(value);
    const hasLowercase = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);

    if (!value) {
      return 'Password is required.';
    }

    if (value.length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return 'Use uppercase, lowercase, number, and special character.';
    }

    return '';
  };

  const validateConfirmPassword = (value, currentPassword) => {
    if (!value) {
      return 'Confirm Password is required.';
    }

    if (value !== currentPassword) {
      return 'Passwords do not match.';
    }

    return '';
  };

  const validateAllFields = () => {
    const nextErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
    };

    setFieldErrors(nextErrors);

    return !Object.values(nextErrors).some(Boolean);
  };

  const updateFieldError = (key, message) => {
    setFieldErrors((prev) => ({
      ...prev,
      [key]: message,
    }));
  };

  const onSubmit = async () => {
    setFormError('');
    setIsSubmitting(true);
    setSuccessMessage('');

    const isValid = validateAllFields();

    if (!isValid) {
      setIsSubmitting(false);
      return;
    }

    try {
      await registerRequest(name, email, password);
      setSuccessMessage('Registration successful. Please login.');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 500);
    } catch (submitError) {
      setFormError(
        submitError?.response?.data?.message || submitError.message || 'Unable to register.'
      );
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
            <View style={styles.titleWrap}>
              <Text style={styles.titleTop}>Join the</Text>
              <Text style={styles.titleBottom}>Brew!</Text>
            </View>

            <Text style={styles.subtitle}>
              Create your account to explore coffee establishments, coffee trails, and coupon promos.
            </Text>

            <View style={styles.fieldBlock}>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#808080"
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (fieldErrors.name) {
                    updateFieldError('name', validateName(value));
                  }
                }}
                onBlur={() => updateFieldError('name', validateName(name))}
              />
              <View style={styles.errorSlot}>
                <Text style={styles.inlineError}>{fieldErrors.name || ' '}</Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#808080"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (fieldErrors.email) {
                    updateFieldError('email', validateEmail(value));
                  }
                }}
                onBlur={() => updateFieldError('email', validateEmail(email))}
              />
              <View style={styles.errorSlot}>
                <Text style={styles.inlineError}>{fieldErrors.email || ' '}</Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#808080"
                secureTextEntry
                value={password}
                onChangeText={(value) => {
                  setPassword(value);

                  if (fieldErrors.password) {
                    updateFieldError('password', validatePassword(value));
                  }

                  if (confirmPassword) {
                    updateFieldError(
                      'confirmPassword',
                      validateConfirmPassword(confirmPassword, value)
                    );
                  }
                }}
                onBlur={() => updateFieldError('password', validatePassword(password))}
              />
              <View style={styles.errorSlot}>
                <Text style={styles.inlineError}>{fieldErrors.password || ' '}</Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#808080"
                secureTextEntry
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  if (fieldErrors.confirmPassword) {
                    updateFieldError('confirmPassword', validateConfirmPassword(value, password));
                  }
                }}
                onBlur={() =>
                  updateFieldError('confirmPassword', validateConfirmPassword(confirmPassword, password))
                }
              />
              <View style={styles.errorSlot}>
                <Text style={styles.inlineError}>{fieldErrors.confirmPassword || ' '}</Text>
              </View>
            </View>

            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

            <Pressable
              disabled={isSubmitting}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.button,
                isSubmitting && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkTextBold}>Log In</Text>
              </Text>
            </Pressable>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },
  titleWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 18,
  },
  titleTop: {
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -2.4,
    color: '#3A2E22',
    fontFamily: 'PlayfairDisplayMedium',
  },
  titleBottom: {
    marginTop: -6,
    fontSize: 58,
    lineHeight: 66,
    letterSpacing: -2.4,
    color: '#3A2E22',
    fontFamily: 'PlayfairDisplayMediumItalic',
  },
  subtitle: {
    width: '100%',
    maxWidth: 350,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 21,
    color: '#3A2E22',
    letterSpacing: -0.3,
    fontFamily: 'PoppinsMedium',
    marginBottom: 20,
  },
  fieldBlock: {
    width: '100%',
    maxWidth: 312,
    marginBottom: 4,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#3A2E22',
    borderRadius: 15,
    backgroundColor: '#E8E8E8',
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 21,
    color: '#3A2E22',
    letterSpacing: -0.8,
    fontFamily: 'PoppinsRegular',
  },
  errorSlot: {
    minHeight: 20,
    justifyContent: 'center',
  },
  inlineError: {
    width: '100%',
    fontSize: 13,
    lineHeight: 16,
    color: '#9B3E3E',
    marginBottom: 0,
    paddingLeft: 4,
    fontFamily: 'PoppinsRegular',
  },
  button: {
    width: '100%',
    maxWidth: 312,
    height: 51,
    marginTop: 12,
    backgroundColor: '#2E5A3D',
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
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.5,
    fontFamily: 'PoppinsMedium',
  },
  error: {
    width: '100%',
    maxWidth: 312,
    color: '#9B3E3E',
    fontSize: 13,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 2,
    textAlign: 'left',
    fontFamily: 'PoppinsRegular',
  },
  success: {
    width: '100%',
    maxWidth: 312,
    color: '#2E5A3D',
    fontSize: 13,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 2,
    textAlign: 'left',
    fontFamily: 'PoppinsRegular',
  },
  linkWrap: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  linkTextBold: {
    fontFamily: 'PoppinsBold',
  },
});
