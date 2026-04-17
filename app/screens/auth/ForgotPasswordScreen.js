import { useState } from 'react';
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
import { requestPasswordReset } from '../../services';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const onSendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await requestPasswordReset(normalizedEmail);
      setMessage(response?.message || 'If your email is registered, a reset code has been sent.');
      navigation.navigate('ResetPassword', { email: normalizedEmail });
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError.message || 'Unable to send reset code.');
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
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Enter your registered email to receive a reset code.</Text>

          <TextInput
            style={styles.input}
            placeholder="Registered Email"
            placeholderTextColor="#808080"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            disabled={isSubmitting || !email.trim()}
            onPress={onSendCode}
            style={({ pressed }) => [
              styles.button,
              (isSubmitting || !email.trim()) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send Code</Text>}
          </Pressable>

          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryAction}>
            <Text style={styles.secondaryText}>Back to Login</Text>
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
  },
  error: {
    marginTop: 10,
    fontSize: 13,
    color: '#9B3E3E',
    fontFamily: 'PoppinsRegular',
  },
  message: {
    marginTop: 10,
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
