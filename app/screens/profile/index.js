import { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components';
import { useAuth } from '../../context';
import {
  getProfile,
  sendEmailVerification,
  verifyEmailOtp,
} from '../../services';
import theme from '../../theme';

const SAVED_TRAILS_KEY = 'saved_coffee_trails';
const DOWNLOADED_VARIETIES_KEY = 'offline_saved_varieties';
const DOWNLOADED_ESTABLISHMENTS_KEY = 'offline_saved_establishments';

function getInitials(name, email) {
  const source = String(name || '').trim();
  if (source) {
    const chunks = source.split(/\s+/).filter(Boolean);
    if (chunks.length === 1) {
      return chunks[0].slice(0, 2).toUpperCase();
    }
    return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase();
  }

  return String(email || 'CE').slice(0, 2).toUpperCase();
}

function normalizeProfilePayload(rawData) {
  const source = rawData?.user || rawData?.data || rawData || {};
  return {
    id: source?.id ?? null,
    name: source?.name ?? '',
    email: source?.email ?? '',
    profile_photo_url: source?.profile_photo_url || source?.profile_photo || source?.avatar || null,
    role: source?.role || null,
    email_verified_at: source?.email_verified_at || null,
    email_verified:
      source?.email_verified ?? source?.verified ?? Boolean(source?.email_verified_at),
  };
}

function getUniqueSavedVarieties(savedTrails) {
  const fromPreferences = savedTrails.flatMap((trail) => {
    const list = trail?.preferences?.varieties;
    return Array.isArray(list) ? list : [];
  });

  return Array.from(new Set(fromPreferences.map((item) => String(item || '').trim()).filter(Boolean)));
}

function getUniqueSavedEstablishments(savedTrails) {
  const mapById = new Map();

  savedTrails.forEach((trail, trailIndex) => {
    const stops = Array.isArray(trail?.trailStops) ? trail.trailStops : [];
    stops.forEach((stop, stopIndex) => {
      const id = String(stop?.establishment_id ?? stop?.id ?? `${trailIndex}-${stopIndex}`);
      if (mapById.has(id)) {
        return;
      }

      mapById.set(id, {
        id,
        name: stop?.name || 'Coffee Stop',
        address: stop?.address || stop?.barangay || 'Address not available',
      });
    });
  });

  return Array.from(mapById.values());
}

export default function ProfileScreen({ navigation }) {
  const { user, signOut, updateUser } = useAuth();
  const [savedTrails, setSavedTrails] = useState([]);
  const [downloadedVarieties, setDownloadedVarieties] = useState([]);
  const [downloadedEstablishments, setDownloadedEstablishments] = useState([]);
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationOtp, setVerificationOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isEmailVerified = Boolean(user?.email_verified || user?.email_verified_at);
  const registeredEmail = String(user?.email || '').trim();
  const accountName = user?.name || '';
  const accountEmail = user?.email || '';

  const savedVarieties = useMemo(() => getUniqueSavedVarieties(savedTrails), [savedTrails]);
  const savedEstablishments = useMemo(() => getUniqueSavedEstablishments(savedTrails), [savedTrails]);

  const initials = getInitials(user?.name, user?.email);

  const restoreProfileAndStorage = useCallback(async () => {
    try {
      const [savedTrailsRaw, varietiesRaw, establishmentsRaw] = await Promise.all([
        AsyncStorage.getItem(SAVED_TRAILS_KEY),
        AsyncStorage.getItem(DOWNLOADED_VARIETIES_KEY),
        AsyncStorage.getItem(DOWNLOADED_ESTABLISHMENTS_KEY),
      ]);

      const parsedTrails = JSON.parse(savedTrailsRaw || '[]');
      const parsedVarieties = JSON.parse(varietiesRaw || '[]');
      const parsedEstablishments = JSON.parse(establishmentsRaw || '[]');

      setSavedTrails(Array.isArray(parsedTrails) ? parsedTrails : []);
      setDownloadedVarieties(Array.isArray(parsedVarieties) ? parsedVarieties : []);
      setDownloadedEstablishments(Array.isArray(parsedEstablishments) ? parsedEstablishments : []);
    } catch {
      setSavedTrails([]);
      setDownloadedVarieties([]);
      setDownloadedEstablishments([]);
    }

    try {
      const profileResponse = await getProfile();
      const normalized = normalizeProfilePayload(profileResponse);
      await updateUser(normalized);
    } catch {}
  }, [updateUser]);

  useFocusEffect(
    useCallback(() => {
      restoreProfileAndStorage();
    }, [restoreProfileAndStorage])
  );

  const toggleVarietyOffline = async (varietyName) => {
    const key = String(varietyName || '').trim();
    if (!key) {
      return;
    }

    const next = downloadedVarieties.includes(key)
      ? downloadedVarieties.filter((item) => item !== key)
      : [...downloadedVarieties, key];

    setDownloadedVarieties(next);
    await AsyncStorage.setItem(DOWNLOADED_VARIETIES_KEY, JSON.stringify(next));
  };

  const toggleEstablishmentOffline = async (establishmentId) => {
    const key = String(establishmentId || '');
    if (!key) {
      return;
    }

    const next = downloadedEstablishments.includes(key)
      ? downloadedEstablishments.filter((item) => item !== key)
      : [...downloadedEstablishments, key];

    setDownloadedEstablishments(next);
    await AsyncStorage.setItem(DOWNLOADED_ESTABLISHMENTS_KEY, JSON.stringify(next));
  };

  const handleSendVerificationEmail = async () => {
    setSecurityMessage('');
    setSecurityError('');

    if (!registeredEmail) {
      setSecurityError('No registered email is available for this account.');
      return;
    }

    setIsSendingVerification(true);
    try {
      await sendEmailVerification(registeredEmail);
      setSecurityMessage(`Verification code sent to ${registeredEmail}.`);
    } catch (error) {
      setSecurityError(
        error?.response?.data?.message || 'Unable to send verification email right now.'
      );
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleVerifyOtp = async () => {
    setSecurityMessage('');
    setSecurityError('');

    if (!registeredEmail) {
      setSecurityError('No registered email is available for this account.');
      return;
    }

    if (verificationOtp.trim().length !== 6) {
      setSecurityError('Enter the 6-digit verification code from your email.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const response = await verifyEmailOtp({
        email: registeredEmail,
        otp: verificationOtp.trim(),
      });

      const verifiedAt = new Date().toISOString();
      await updateUser({
        ...user,
        email_verified: true,
        email_verified_at: verifiedAt,
      });

      setVerificationOtp('');
      setSecurityMessage(response?.message || 'Email verified successfully.');
    } catch (error) {
      setSecurityError(
        error?.response?.data?.message || 'Unable to verify code right now.'
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>

          <View style={styles.heroMeta}>
            <Text style={styles.heroName} numberOfLines={1}>
              {user?.name || 'Coffee Explorer'}
            </Text>
            <Text style={styles.heroEmail} numberOfLines={1}>
              {user?.email || 'No email available'}
            </Text>
            <View style={styles.rolePill}>
              <MaterialIcons
                name={isEmailVerified ? 'verified' : 'report-gmailerrorred'}
                size={14}
                color={isEmailVerified ? '#24563B' : '#8A5A11'}
              />
              <Text style={styles.rolePillText}>
                {isEmailVerified ? 'Email verified' : 'Email unverified'}
              </Text>
            </View>
          </View>
        </View>

        {!isEmailVerified ? (
          <View style={styles.warningCard}>
            <MaterialIcons name="warning-amber" size={18} color="#8A5A11" />
            <View style={styles.warningBody}>
              <Text style={styles.warningText}>
                Your email is not verified yet. Verify your registered email to secure your account and restore access faster.
              </Text>
              <Pressable
                style={[styles.warningActionButton, isSendingVerification && styles.warningActionButtonDisabled]}
                onPress={handleSendVerificationEmail}
                disabled={isSendingVerification}
              >
                <Text style={styles.warningActionText}>
                  {isSendingVerification ? 'Sending...' : `Send Code to ${registeredEmail || 'Email'}`}
                </Text>
              </Pressable>

              <TextInput
                style={styles.verificationOtpInput}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#8A7B66"
                keyboardType="number-pad"
                maxLength={6}
                value={verificationOtp}
                onChangeText={(value) => setVerificationOtp(value.replace(/[^0-9]/g, ''))}
              />
              <Pressable
                style={[styles.warningVerifyButton, isVerifyingOtp && styles.warningActionButtonDisabled]}
                onPress={handleVerifyOtp}
                disabled={isVerifyingOtp}
              >
                <Text style={styles.warningVerifyButtonText}>
                  {isVerifyingOtp ? 'Verifying...' : 'Verify Code'}
                </Text>
              </Pressable>

              {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}
              {securityMessage ? <Text style={styles.successText}>{securityMessage}</Text> : null}
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Saved Content</Text>
        <Pressable style={styles.actionRow} onPress={() => navigation.navigate('SavedTrails')}>
          <View style={styles.actionLeft}>
            <MaterialIcons name="route" size={18} color="#2D4A1E" />
            <Text style={styles.actionLabel}>Saved Trails</Text>
          </View>
          <View style={styles.actionRight}>
            <Text style={styles.actionCount}>{savedTrails.length}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6E6254" />
          </View>
        </Pressable>

        <View style={styles.offlineBlock}>
          <View style={styles.offlineHeader}>
            <Text style={styles.offlineTitle}>Saved Coffee Varieties</Text>
            <Text style={styles.offlineMeta}>{savedVarieties.length} saved</Text>
          </View>

          {savedVarieties.length ? (
            savedVarieties.map((variety) => {
              const downloaded = downloadedVarieties.includes(variety);
              return (
                <Pressable
                  key={variety}
                  style={styles.offlineItem}
                  onPress={() => toggleVarietyOffline(variety)}
                >
                  <Text style={styles.offlineItemLabel}>{variety}</Text>
                  <View style={[styles.offlineBadge, downloaded && styles.offlineBadgeActive]}>
                    <MaterialIcons
                      name={downloaded ? 'check-circle' : 'download'}
                      size={14}
                      color={downloaded ? '#24563B' : '#6E6254'}
                    />
                    <Text style={[styles.offlineBadgeText, downloaded && styles.offlineBadgeTextActive]}>
                      {downloaded ? 'Offline' : 'Download'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No saved varieties yet. Save trails to populate this list.</Text>
          )}
        </View>

        <View style={styles.offlineBlock}>
          <View style={styles.offlineHeader}>
            <Text style={styles.offlineTitle}>Saved Establishments</Text>
            <Text style={styles.offlineMeta}>{savedEstablishments.length} saved</Text>
          </View>

          {savedEstablishments.length ? (
            savedEstablishments.map((item) => {
              const downloaded = downloadedEstablishments.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  style={styles.offlineItem}
                  onPress={() => toggleEstablishmentOffline(item.id)}
                >
                  <View style={styles.establishmentMeta}>
                    <Text style={styles.offlineItemLabel} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.establishmentAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                  <View style={[styles.offlineBadge, downloaded && styles.offlineBadgeActive]}>
                    <MaterialIcons
                      name={downloaded ? 'check-circle' : 'download'}
                      size={14}
                      color={downloaded ? '#24563B' : '#6E6254'}
                    />
                    <Text style={[styles.offlineBadgeText, downloaded && styles.offlineBadgeTextActive]}>
                      {downloaded ? 'Offline' : 'Download'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No saved establishments yet. Save trails to populate this list.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.settingsCard}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={accountName}
            editable={false}
            selectTextOnFocus={false}
          />

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={accountEmail}
            editable={false}
            selectTextOnFocus={false}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.helperText}>
            Name and email are linked to your registered account and cannot be edited here.
          </Text>
        </View>

        <Pressable style={styles.signOutButton} onPress={() => setShowLogoutModal(true)}>
          <Text style={styles.signOutText}>Log Out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.logoutModalBackdrop}>
          <View style={styles.logoutModalCard}>
            <Text style={styles.logoutModalTitle}>Log out from account?</Text>
            <Text style={styles.logoutModalSubtitle}>
              You will need to log in again to access your BrewHub account.
            </Text>

            <View style={styles.logoutModalActions}>
              <Pressable
                style={styles.logoutModalCancelButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.logoutModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.logoutModalConfirmButton}
                onPress={() => {
                  setShowLogoutModal(false);
                  signOut();
                }}
              >
                <Text style={styles.logoutModalConfirmText}>Log Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSizes.xl,
    fontWeight: '700',
    color: theme.colors.sidebar,
    marginBottom: theme.spacing.md,
    fontFamily: 'PoppinsBold',
  },
  heroCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8DDCF',
    borderWidth: 1,
    borderColor: '#D0C2B2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    color: '#6E4E2D',
    fontWeight: '700',
  },
  heroMeta: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    color: theme.colors.sidebar,
    fontWeight: '700',
  },
  heroEmail: {
    fontFamily: theme.fonts.body,
    color: '#6E6254',
    fontSize: 14,
  },
  rolePill: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#D5CABD',
    borderRadius: theme.borderRadius.pill,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F8F3EB',
  },
  rolePillText: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: '#6E6254',
    fontWeight: '600',
  },
  warningCard: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E4C998',
    backgroundColor: '#FFF7E7',
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    color: '#8A5A11',
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  warningBody: {
    flex: 1,
    gap: 8,
  },
  warningActionButton: {
    alignSelf: 'flex-start',
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#C8A86F',
    backgroundColor: '#FFF1D7',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  warningActionButtonDisabled: {
    opacity: 0.65,
  },
  warningActionText: {
    color: '#7D5215',
    fontFamily: theme.fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  verificationOtpInput: {
    borderWidth: 1,
    borderColor: '#D8CCBE',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: theme.fonts.body,
    color: '#3A2E22',
    backgroundColor: '#FFFCF8',
  },
  warningVerifyButton: {
    alignSelf: 'flex-start',
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#8EB296',
    backgroundColor: '#EEF7F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  warningVerifyButtonText: {
    color: '#24563B',
    fontFamily: theme.fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontSize: theme.fontSizes.lg,
    fontWeight: '700',
    color: theme.colors.sidebar,
    fontFamily: 'PoppinsBold',
  },
  actionRow: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionLabel: {
    fontFamily: theme.fonts.body,
    fontWeight: '600',
    fontSize: 14,
    color: '#3A2E22',
  },
  actionCount: {
    fontFamily: theme.fonts.body,
    color: '#6E6254',
    fontWeight: '700',
  },
  offlineBlock: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 8,
  },
  offlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offlineTitle: {
    fontFamily: theme.fonts.body,
    color: '#3A2E22',
    fontSize: 15,
    fontWeight: '700',
  },
  offlineMeta: {
    fontFamily: theme.fonts.body,
    color: '#9E8C78',
    fontSize: 12,
    fontWeight: '600',
  },
  offlineItem: {
    borderWidth: 1,
    borderColor: '#E7DED3',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  offlineItemLabel: {
    fontFamily: theme.fonts.body,
    color: '#3A2E22',
    fontWeight: '600',
    fontSize: 14,
    flexShrink: 1,
  },
  offlineBadge: {
    borderWidth: 1,
    borderColor: '#D8CCBE',
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FCFAF6',
  },
  offlineBadgeActive: {
    borderColor: '#8EB296',
    backgroundColor: '#EEF7F0',
  },
  offlineBadgeText: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: '#6E6254',
    fontWeight: '600',
  },
  offlineBadgeTextActive: {
    color: '#24563B',
  },
  establishmentMeta: {
    flex: 1,
    gap: 2,
  },
  establishmentAddress: {
    fontFamily: theme.fonts.body,
    color: '#9E8C78',
    fontSize: 12,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: '#9E8C78',
    fontSize: 13,
    lineHeight: 18,
  },
  settingsCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  inputLabel: {
    fontFamily: theme.fonts.body,
    color: '#6E6254',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D8CCBE',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: theme.fonts.body,
    color: '#3A2E22',
    marginBottom: 10,
    backgroundColor: '#FFFCF8',
  },
  inputDisabled: {
    backgroundColor: '#F3EEE6',
    color: '#6E6254',
  },
  errorText: {
    fontFamily: theme.fonts.body,
    color: '#A33939',
    marginBottom: 8,
    fontSize: 12,
  },
  successText: {
    fontFamily: theme.fonts.body,
    color: '#24563B',
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: {
    marginTop: 2,
    fontFamily: theme.fonts.body,
    color: '#7A6B59',
    fontSize: 12,
    lineHeight: 17,
  },
  signOutButton: {
    marginTop: theme.spacing.md,
    backgroundColor: '#A33939',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  signOutText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.body,
  },
  logoutModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 21, 14, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9D2C8',
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  logoutModalTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 18,
    textAlign: 'center',
  },
  logoutModalSubtitle: {
    marginTop: 8,
    color: '#6B7280',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  logoutModalActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  logoutModalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D8CCBE',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#F9F4EC',
  },
  logoutModalCancelText: {
    color: '#6E6254',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
  },
  logoutModalConfirmButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#A33939',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#A33939',
  },
  logoutModalConfirmText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
  },
});
