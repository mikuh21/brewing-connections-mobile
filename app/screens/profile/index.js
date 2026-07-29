import { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
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
import { useAuth, useChat } from '../../context';
import {
  getProfile,
  sendEmailVerification,
  verifyEmailOtp,
} from '../../services';
import { getImageUrl } from '../../utils/imageHelper';
import theme from '../../theme';

const SAVED_TRAILS_KEY = 'saved_coffee_trails';
const SAVED_ESTABLISHMENTS_KEY = 'saved_establishments';
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

export default function ProfileScreen({ navigation }) {
  const { user, signOut, updateUser } = useAuth();
  const { unreadCount, refreshUnreadCount } = useChat();
  const [savedTrails, setSavedTrails] = useState([]);
  const [downloadedVarieties, setDownloadedVarieties] = useState([]);
  const [savedEstablishments, setSavedEstablishments] = useState([]);
  const [downloadedEstablishments, setDownloadedEstablishments] = useState([]);
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationOtp, setVerificationOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [verificationCooldownSeconds, setVerificationCooldownSeconds] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const cooldownTimerRef = useRef(null);

  const isEmailVerified = Boolean(user?.email_verified || user?.email_verified_at);
  const registeredEmail = String(user?.email || '').trim();
  const accountName = user?.name || '';
  const accountEmail = user?.email || '';

  const savedVarieties = useMemo(
    () => Array.from(new Set(downloadedVarieties.map((item) => String(item || '').trim()).filter(Boolean))),
    [downloadedVarieties]
  );

  const initials = getInitials(user?.name, user?.email);

  const restoreProfileAndStorage = useCallback(async () => {
    try {
      const [savedTrailsRaw, varietiesRaw, savedEstablishmentsRaw, establishmentsRaw] = await Promise.all([
        AsyncStorage.getItem(SAVED_TRAILS_KEY),
        AsyncStorage.getItem(DOWNLOADED_VARIETIES_KEY),
        AsyncStorage.getItem(SAVED_ESTABLISHMENTS_KEY),
        AsyncStorage.getItem(DOWNLOADED_ESTABLISHMENTS_KEY),
      ]);

      const parsedTrails = JSON.parse(savedTrailsRaw || '[]');
      const parsedVarieties = JSON.parse(varietiesRaw || '[]');
      const parsedSavedEstablishments = JSON.parse(savedEstablishmentsRaw || '[]');
      const parsedEstablishments = JSON.parse(establishmentsRaw || '[]');

      setSavedTrails(Array.isArray(parsedTrails) ? parsedTrails : []);
      setDownloadedVarieties(Array.isArray(parsedVarieties) ? parsedVarieties : []);
      setSavedEstablishments(Array.isArray(parsedSavedEstablishments) ? parsedSavedEstablishments : []);
      setDownloadedEstablishments(Array.isArray(parsedEstablishments) ? parsedEstablishments : []);
    } catch {
      setSavedTrails([]);
      setDownloadedVarieties([]);
      setSavedEstablishments([]);
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
      refreshUnreadCount();
    }, [refreshUnreadCount, restoreProfileAndStorage])
  );

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

    // If cooldown active, ignore presses (button should be disabled by UI).
    if (verificationCooldownSeconds > 0) return;

    setIsSendingVerification(true);
    try {
      await sendEmailVerification(registeredEmail);
      setSecurityMessage(`Verification code sent to ${registeredEmail}.`);

      // Start 15-minute cooldown and persist per-email so it survives short app restarts.
      const sentAt = Date.now();
      const key = `email_verification_sent_at:${registeredEmail}`;
      await AsyncStorage.setItem(key, String(sentAt));
      setVerificationCooldownSeconds(15 * 60);
    } catch (error) {
      setSecurityError(
        error?.response?.data?.message || 'Unable to send verification email right now.'
      );
    } finally {
      setIsSendingVerification(false);
    }
  };

  // Load any existing cooldown for this email and start countdown.
  useEffect(() => {
    const key = `email_verification_sent_at:${registeredEmail}`;
    let mounted = true;

    const init = async () => {
      if (!registeredEmail) return;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;
        const sentAt = Number(raw) || 0;
        const expiresAt = sentAt + 15 * 60 * 1000;
        const now = Date.now();
        const diff = Math.max(0, Math.ceil((expiresAt - now) / 1000));
        if (mounted) {
          if (diff > 0) {
            setVerificationCooldownSeconds(diff);
          } else {
            // Already expired while app was closed — remove persisted key so cooldown
            // does not restart when reopening the app.
            try {
              await AsyncStorage.removeItem(key);
            } catch (_) {}
          }
        }
      } catch (_) {}
    };

    init();

    return () => {
      mounted = false;
    };
  }, [registeredEmail]);

  // Tick countdown every second while active.
  useEffect(() => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }

    if (verificationCooldownSeconds > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setVerificationCooldownSeconds((s) => {
          if (s <= 1) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }

    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, [verificationCooldownSeconds]);

  // When cooldown ends, remove persisted timestamp so next send starts fresh.
  useEffect(() => {
    const clearKey = async () => {
      if (!registeredEmail) return;
      const key = `email_verification_sent_at:${registeredEmail}`;
      try {
        if (verificationCooldownSeconds === 0) {
          await AsyncStorage.removeItem(key);
        }
      } catch (_) {}
    };

    clearKey();
  }, [verificationCooldownSeconds, registeredEmail]);

  // Helper to format mm:ss
  const formatCooldown = (seconds) => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
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
        <View style={styles.titleRow}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.chatButtonWrap}>
            <Pressable style={styles.chatButton} onPress={() => navigation.navigate('Messages')}>
              <MaterialIcons name="chat-bubble-outline" size={19} color="#2D4A1E" />
            </Pressable>
            {unreadCount > 0 ? (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            {user?.profile_photo_url ? (
              <Image source={{ uri: getImageUrl(user.profile_photo_url) }} style={styles.avatarImage} />
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
                color={isEmailVerified ? '#2D4A1E' : '#8A5A11'}
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
                style={[
                  styles.warningActionButton,
                  (isSendingVerification || verificationCooldownSeconds > 0) && styles.warningActionButtonDisabled,
                ]}
                onPress={handleSendVerificationEmail}
                disabled={isSendingVerification || verificationCooldownSeconds > 0}
              >
                <Text style={styles.warningActionText}>
                  {isSendingVerification
                    ? 'Sending...'
                    : verificationCooldownSeconds > 0
                    ? `Resend in ${formatCooldown(verificationCooldownSeconds)}`
                    : `Send Code to ${registeredEmail || 'Email'}`}
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

        <Pressable style={[styles.actionRow, styles.actionRowSpaced]} onPress={() => navigation.navigate('SavedCoffeeVarieties')}>
          <View style={styles.actionLeft}>
            <MaterialIcons name="coffee" size={18} color="#2D4A1E" />
            <Text style={styles.actionLabel}>Saved Coffee Varieties</Text>
          </View>
          <View style={styles.actionRight}>
            <Text style={styles.actionCount}>{savedVarieties.length}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6E6254" />
          </View>
        </Pressable>

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
            <Text style={styles.emptyText}>No saved establishments yet. Tap the heart icon in map details to save.</Text>
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
  titleRow: {
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
    overflow: 'visible',
  },
  title: {
    fontSize: 30,
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
  },
  chatButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#D5CABD',
    backgroundColor: '#FFF9F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonWrap: {
    position: 'relative',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  chatBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#C2410C',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsBold',
    fontSize: 10,
    lineHeight: 11,
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
    fontFamily: 'PoppinsSemiBold',
    fontSize: 22,
    color: '#6E4E2D',
    fontWeight: '600',
  },
  heroMeta: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontFamily: 'PoppinsSemiBold',
    fontSize: 22,
    color: theme.colors.sidebar,
    fontWeight: '600',
  },
  heroEmail: {
    fontFamily: 'PoppinsRegular',
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
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    color: '#6E6254',
    fontWeight: '500',
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
    fontFamily: 'PoppinsRegular',
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
    fontFamily: 'PoppinsSemiBold',
    fontSize: 12,
    fontWeight: '600',
  },
  verificationOtpInput: {
    borderWidth: 1,
    borderColor: '#D8CCBE',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: 'PoppinsRegular',
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
    fontFamily: 'PoppinsSemiBold',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontSize: theme.fontSizes.lg,
    fontWeight: '600',
    color: theme.colors.sidebar,
    fontFamily: 'PoppinsSemiBold',
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
  actionRowSpaced: {
    marginTop: theme.spacing.sm,
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
    fontFamily: 'PoppinsMedium',
    fontWeight: '500',
    fontSize: 14,
    color: '#3A2E22',
  },
  actionCount: {
    fontFamily: 'PoppinsSemiBold',
    color: '#6E6254',
    fontWeight: '600',
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
    fontFamily: 'PoppinsSemiBold',
    color: '#3A2E22',
    fontSize: 15,
    fontWeight: '600',
  },
  offlineMeta: {
    fontFamily: 'PoppinsMedium',
    color: '#9E8C78',
    fontSize: 12,
    fontWeight: '500',
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
    fontFamily: 'PoppinsMedium',
    color: '#3A2E22',
    fontWeight: '500',
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
    fontFamily: 'PoppinsMedium',
    fontSize: 12,
    color: '#6E6254',
    fontWeight: '500',
  },
  offlineBadgeTextActive: {
    color: '#24563B',
  },
  establishmentMeta: {
    flex: 1,
    gap: 2,
  },
  establishmentAddress: {
    fontFamily: 'PoppinsRegular',
    color: '#9E8C78',
    fontSize: 12,
  },
  emptyText: {
    fontFamily: 'PoppinsRegular',
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
    fontFamily: 'PoppinsMedium',
    color: '#6E6254',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D8CCBE',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: 'PoppinsRegular',
    color: '#3A2E22',
    marginBottom: 10,
    backgroundColor: '#FFFCF8',
  },
  inputDisabled: {
    backgroundColor: '#F3EEE6',
    color: '#6E6254',
  },
  errorText: {
    fontFamily: 'PoppinsRegular',
    color: '#A33939',
    marginBottom: 8,
    fontSize: 12,
  },
  successText: {
    fontFamily: 'PoppinsMedium',
    color: '#24563B',
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  helperText: {
    marginTop: 2,
    fontFamily: 'PoppinsRegular',
    color: '#7A6B59',
    fontSize: 12,
    lineHeight: 17,
  },
  signOutButton: {
    marginTop: theme.spacing.md,
    backgroundColor: '#DC2626',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  signOutText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: theme.fontSizes.md,
    fontFamily: 'PoppinsSemiBold',
  },
  logoutModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
    fontFamily: 'PoppinsRegular',
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
    borderColor: '#DC2626',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#DC2626',
  },
  logoutModalConfirmText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsSemiBold',
    fontSize: 13,
  },
});
