import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkEmailAvailability, register as registerRequest } from '../../services';
import theme from '../../theme';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [activeLegalDocument, setActiveLegalDocument] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsScrolledToEnd, setTermsScrolledToEnd] = useState(false);

  const openLegalDocument = (document) => {
    setActiveLegalDocument(document);
    if (document === 'terms') setTermsScrolledToEnd(false);
  };

  const closeLegalDocument = () => setActiveLegalDocument(null);

  const openExternalLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch {
      setFormError('Unable to open this link on your device.');
    }
  };

  const privacySections = [
    {
      title: '1. Personal information we collect',
      body: 'Depending on the account type and features used, BrewHub may collect your name, email address, account credentials, contact number, establishment name and type, barangay, street or business address, website, map location, and information you submit through listings, ratings, reservations, orders, messages, or other platform features. Do not submit information that is not required or relevant to the service.',
    },
    {
      title: '2. Why we use your information',
      body: 'Information may be used to create and secure your account; verify and manage establishment registrations; display establishment details and locations; provide mapping, coffee-trail, rating, recommendation, promotion, store, reservation, and order features; communicate service or account notices; prevent fraud, abuse, and security incidents; maintain records; and meet legal obligations. BrewHub should use information only for declared, legitimate purposes and in a manner proportionate to those purposes.',
    },
    {
      title: '3. Lawful basis and consent',
      body: 'Personal information is processed only where a lawful basis under applicable law exists, such as steps needed to provide the service you request, compliance with a legal obligation, legitimate interests where permitted, or your consent where required. Where consent is relied upon, it should be freely given, specific, informed, and evidenced appropriately.',
    },
    {
      title: '4. Sharing and disclosure',
      body: 'BrewHub may make establishment information you choose to publish visible to platform users and may use service providers that support hosting, storage, communications, security, and platform operation. Information may also be disclosed when required by law or to protect rights and platform security. Personal information should not be sold or disclosed for unrelated purposes without an appropriate lawful basis.',
    },
    {
      title: '5. Storage, security, and retention',
      body: 'BrewHub applies reasonable organizational, physical, and technical safeguards intended to protect personal information against unauthorized access, loss, misuse, alteration, or disclosure. Information is retained only for as long as reasonably necessary for the stated purposes, account administration, dispute resolution, security, and legal obligations, after which it should be securely deleted or anonymized where appropriate.',
    },
    {
      title: '6. Your data privacy rights',
      body: 'Subject to applicable law and its conditions, you may have the right to be informed about processing, access your personal information, request correction or erasure/blocking where justified, object to or withdraw consent from certain processing, request data portability where applicable, and lodge a complaint with the National Privacy Commission. These rights are not absolute and may be subject to legal exceptions.',
    },
  ];

  const termsSections = [
    {
      title: '1. Accurate Account Information',
      body: 'You must provide accurate, complete, and current account and business information. Keep your login credentials confidential and notify BrewHub if you believe your account has been accessed without permission. You are responsible for activity performed through your account.',
    },
    {
      title: '2. Establishment Profiles and Map Locations',
      body: 'Farm, coffee shop, and roaster owners are responsible for the accuracy of their establishment details, contact information, and map location. Only submit a location you are authorized to represent. Update your details when they change, and do not deliberately misrepresent an establishment or its products.',
    },
    {
      title: '3. Products, Listings, and Promotions',
      body: 'Where available, resellers are responsible for accurate product listings, descriptions, prices, stock information, and promotional claims. Listings and promotions must be coffee-related where required by BrewHub and must not be misleading, fraudulent, unlawful, or infringe another person’s rights.',
    },
    {
      title: '4. Orders and Transactions',
      body: 'If you use BrewHub features for orders, sales, or transactions, you must provide truthful information and handle your responsibilities promptly and professionally. Business owners and resellers are responsible for fulfilling commitments made to customers and communicating material changes or issues.',
    },
    {
      title: '5. Respectful Use of the Platform',
      body: 'Use BrewHub lawfully and respectfully. Do not harass other users, manipulate ratings or reviews, submit false information, interfere with platform operation, attempt unauthorized access, or misuse messaging, map, store, or promotional features.',
    },
    {
      title: '6. Privacy and Information',
      body: 'BrewHub uses account and establishment information to operate its features, support discovery, and facilitate interactions on the platform. Do not submit information you are not authorized to share. Information displayed in a public establishment profile may be visible to other users.',
    },
    {
      title: '7. Content and Platform Availability',
      body: 'You are responsible for the content you submit and must have the rights or permission needed to use it. BrewHub may modify, suspend, or discontinue features to maintain, improve, or protect the platform.',
    },
    {
      title: '8. Suspension and Termination',
      body: 'BrewHub may restrict, suspend, or terminate accounts or remove content when reasonably necessary to address violations of these terms, suspected fraud, security risks, unlawful activity, or harm to users or the platform.',
    },
    {
      title: '9. Changes to These Terms',
      body: 'BrewHub may update these Terms & Conditions as its services or requirements change. The current version will be made available through the platform. Continued use after an update constitutes acceptance of the revised terms where permitted by applicable law.',
    },
  ];

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

  useEffect(() => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || validateEmail(normalizedEmail)) {
      setEmailTaken(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const result = await checkEmailAvailability(normalizedEmail);
        if (cancelled) return;

        const taken = result?.available === false;
        setEmailTaken(taken);
        setFieldErrors((previous) => ({
          ...previous,
          email: taken
            ? 'This email is already registered. Please use another email.'
            : previous.email === 'This email is already registered. Please use another email.'
              ? ''
              : previous.email,
        }));
      } catch {
        // Availability checks are advisory; registration still validates email on the server.
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [email]);

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
      return 'Passwords do not match.';
    }

    return '';
  };

  const validateAllFields = () => {
    const nextErrors = {
      name: validateName(name),
      email: emailTaken
        ? 'This email is already registered. Please use another email.'
        : validateEmail(email),
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

    if (!termsAccepted) {
      setFormError('Please review and agree to the Terms & Conditions before signing up.');
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
      const emailError = submitError?.response?.data?.errors?.email;
      if (Array.isArray(emailError) && emailError.length > 0) {
        updateFieldError('email', emailError[0]);
        setEmailTaken(/already (been )?taken|already registered/i.test(emailError[0]));
        setFormError('');
      } else {
        setFormError(
          submitError?.response?.data?.message || submitError.message || 'Unable to register.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
                  setEmailTaken(false);
                  updateFieldError('email', validateEmail(value));
                }}
                onBlur={() => updateFieldError(
                  'email',
                  emailTaken
                    ? 'This email is already registered. Please use another email.'
                    : validateEmail(email)
                )}
              />
              <View style={styles.errorSlot}>
                <Text style={styles.inlineError}>{fieldErrors.email || ' '}</Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder="Password"
                  placeholderTextColor="#808080"
                  secureTextEntry={!showPassword}
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
              <View style={styles.errorSlot}>
                <Text style={styles.inlineError}>{fieldErrors.password || ' '}</Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder="Confirm Password"
                  placeholderTextColor="#808080"
                  secureTextEntry={!showConfirmPassword}
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
              <View style={styles.errorSlot}>
                <Text style={styles.inlineError}>{fieldErrors.confirmPassword || ' '}</Text>
              </View>
            </View>

            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

            <View style={styles.legalAgreement}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: termsAccepted }}
                onPress={() => setTermsAccepted((previous) => !previous)}
                style={styles.termsCheckboxRow}
              >
                <MaterialIcons
                  name={termsAccepted ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={termsAccepted ? '#2E5A3D' : '#6F5948'}
                />
                <Text style={styles.termsCheckboxText}>
                  I agree to the{' '}
                  <Text
                    style={styles.legalLink}
                    onPress={() => openLegalDocument('terms')}
                    accessibilityRole="link"
                  >Terms & Conditions</Text>
                </Text>
              </Pressable>
              <Text style={styles.privacyPrompt}>
                Please review BrewHub's{' '}
                <Text
                  style={styles.legalLink}
                  onPress={() => openLegalDocument('privacy')}
                  accessibilityRole="link"
                >Privacy Policy</Text>
                {' '}before creating your account.
              </Text>
            </View>

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

        <Modal
          visible={activeLegalDocument !== null}
          transparent
          animationType="fade"
          onRequestClose={closeLegalDocument}
          statusBarTranslucent
        >
          <View style={styles.legalModalOverlay}>
            <View style={styles.legalModalCard}>
              <View style={styles.legalModalHeader}>
                <Text style={styles.legalModalTitle}>
                  {activeLegalDocument === 'terms'
                    ? 'Terms & Conditions — BrewHub User Agreement'
                    : 'Privacy Policy — Data Privacy Act of 2012'}
                </Text>
                <Pressable
                  onPress={closeLegalDocument}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close legal document"
                  style={styles.legalCloseIcon}
                >
                  <MaterialIcons name="close" size={24} color="#3A2E22" />
                </Pressable>
              </View>

              <ScrollView
                key={activeLegalDocument || 'legal'}
                style={styles.legalModalScroll}
                contentContainerStyle={styles.legalModalBody}
                showsVerticalScrollIndicator
                onScroll={activeLegalDocument === 'terms' ? (event) => {
                  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
                  if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
                    setTermsScrolledToEnd(true);
                  }
                } : undefined}
                scrollEventThrottle={16}
              >
                {activeLegalDocument === 'terms' ? (
                  <>
                    <Text style={styles.legalParagraph}>
                      Welcome to BrewHub. By creating an account or using BrewHub as a coffee farm, coffee shop, roaster, or reseller, you agree to these Terms & Conditions.
                    </Text>
                    {termsSections.map((section) => (
                      <View key={section.title} style={styles.legalSection}>
                        <Text style={styles.legalSectionTitle}>{section.title}</Text>
                        <Text style={styles.legalParagraph}>{section.body}</Text>
                      </View>
                    ))}
                    <Text style={styles.legalParagraph}>
                      By selecting “I Agree,” you confirm that you have read and understood these Terms & Conditions and agree to follow them.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.legalParagraph}>
                      BrewHub respects your privacy and handles personal information in accordance with Republic Act No. 10173, the Data Privacy Act of 2012, its Implementing Rules and Regulations, and applicable National Privacy Commission issuances. This notice explains how information submitted during registration and use of BrewHub may be processed.
                    </Text>
                    {privacySections.map((section) => (
                      <View key={section.title} style={styles.legalSection}>
                        <Text style={styles.legalSectionTitle}>{section.title}</Text>
                        <Text style={styles.legalParagraph}>{section.body}</Text>
                      </View>
                    ))}
                    <View style={styles.legalSection}>
                      <Text style={styles.legalSectionTitle}>7. Contact and concerns</Text>
                      <Text style={styles.legalParagraph}>
                        For questions, access or correction requests, or privacy concerns, contact BrewHub through its official Facebook page or email brewhub1@gmail.com. Identify the account involved without sending your password. If your concern remains unresolved, you may consult the National Privacy Commission through its official website.
                      </Text>
                      <Pressable onPress={() => openExternalLink('https://www.facebook.com/profile.php?id=61560676899683')}>
                        <Text style={styles.legalExternalLink}>Official BrewHub Facebook page</Text>
                      </Pressable>
                      <Pressable onPress={() => openExternalLink('mailto:brewhub1@gmail.com')}>
                        <Text style={styles.legalExternalLink}>brewhub1@gmail.com</Text>
                      </Pressable>
                    </View>
                    <View style={styles.legalSection}>
                      <Text style={styles.legalSectionTitle}>8. Legal references</Text>
                      <Text style={styles.legalParagraph}>
                        This notice is a BrewHub-specific summary and is not the text of the law or a claim of government endorsement. Read the official sources:
                      </Text>
                      <Pressable onPress={() => openExternalLink('https://officialgazette.gov.ph/2012/08/15/republic-act-no-10173/')}>
                        <Text style={styles.legalExternalLink}>Republic Act No. 10173 — Official Gazette of the Philippines</Text>
                      </Pressable>
                      <Pressable onPress={() => openExternalLink('https://privacy.gov.ph/implementing-rules%20regulations-data-privacy-act-2012/')}>
                        <Text style={styles.legalExternalLink}>Implementing Rules and Regulations — National Privacy Commission</Text>
                      </Pressable>
                      <Pressable onPress={() => openExternalLink('https://privacy.gov.ph/')}>
                        <Text style={styles.legalExternalLink}>National Privacy Commission official website</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.legalFootnote}>
                      Please review this notice before creating your account. BrewHub should update this policy if its actual data practices or contact details change.
                    </Text>
                  </>
                )}
              </ScrollView>

              <View style={styles.legalModalFooter}>
                {activeLegalDocument === 'terms' ? (
                  <>
                    <Pressable onPress={closeLegalDocument} style={styles.legalCancelButton}>
                      <Text style={styles.legalCancelButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      disabled={!termsScrolledToEnd}
                      onPress={() => {
                        setTermsAccepted(true);
                        setFormError('');
                        closeLegalDocument();
                      }}
                      style={[
                        styles.legalAgreeButton,
                        !termsScrolledToEnd && styles.legalAgreeButtonDisabled,
                      ]}
                    >
                      <Text style={styles.legalAgreeButtonText}>I Agree</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={closeLegalDocument} style={styles.legalAgreeButton}>
                    <Text style={styles.legalAgreeButtonText}>Close</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
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
    top: 15,
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
  legalAgreement: {
    width: '100%',
    maxWidth: 312,
    marginTop: 10,
    marginBottom: 2,
  },
  termsCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingVertical: 5,
  },
  termsCheckboxText: {
    flex: 1,
    color: '#3A2E22',
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 19,
  },
  privacyPrompt: {
    color: '#5D4B3A',
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
    paddingLeft: 29,
  },
  legalLink: {
    color: '#2E5A3D',
    fontFamily: 'PoppinsMedium',
    textDecorationLine: 'underline',
  },
  legalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(46, 90, 61, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  legalModalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9CDBA',
    backgroundColor: '#F3E9D7',
    overflow: 'hidden',
  },
  legalModalHeader: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#D9CDBA',
  },
  legalModalTitle: {
    flex: 1,
    color: '#3A2E22',
    fontFamily: 'PlayfairDisplayMedium',
    fontSize: 17,
    lineHeight: 23,
    paddingRight: 10,
  },
  legalCloseIcon: {
    padding: 2,
  },
  legalModalScroll: {
    flexGrow: 0,
  },
  legalModalBody: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  legalSection: {
    marginBottom: 12,
  },
  legalSectionTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 5,
  },
  legalParagraph: {
    color: '#3A2E22',
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  legalExternalLink: {
    color: '#2E5A3D',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 20,
    textDecorationLine: 'underline',
    marginBottom: 7,
  },
  legalFootnote: {
    color: '#8C7A68',
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  legalModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#D9CDBA',
  },
  legalCancelButton: {
    borderWidth: 1,
    borderColor: '#CBBCA7',
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  legalCancelButtonText: {
    color: '#3A2E22',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
  },
  legalAgreeButton: {
    minWidth: 82,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E5A3D',
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  legalAgreeButtonDisabled: {
    backgroundColor: '#8C8C8C',
  },
  legalAgreeButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
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
