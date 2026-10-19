import { useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const PRIVACY_SECTIONS = [
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

export default function PrivacyPolicyModal({ visible, onAccept }) {
  const [accepted, setAccepted] = useState(false);

  const openExternalLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Keep the modal usable even if the device cannot open an external link.
    }
  };

  const handleAccept = () => {
    if (!accepted) return;
    onAccept?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Privacy Policy — Data Privacy Act of 2012</Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator
          >
            <Text style={styles.paragraph}>
              BrewHub respects your privacy and handles personal information in accordance with Republic Act No. 10173, the Data Privacy Act of 2012, its Implementing Rules and Regulations, and applicable National Privacy Commission issuances. This notice explains how information submitted during registration and use of BrewHub may be processed.
            </Text>

            {PRIVACY_SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.paragraph}>{section.body}</Text>
              </View>
            ))}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>7. Contact and concerns</Text>
              <Text style={styles.paragraph}>
                For questions, access or correction requests, or privacy concerns, contact BrewHub through its official Facebook page or email brewhub1@gmail.com. Identify the account involved without sending your password. If your concern remains unresolved, you may consult the National Privacy Commission through its official website.
              </Text>
              <Pressable onPress={() => openExternalLink('https://www.facebook.com/profile.php?id=61560676899683')}>
                <Text style={styles.externalLink}>Official BrewHub Facebook page</Text>
              </Pressable>
              <Pressable onPress={() => openExternalLink('mailto:brewhub1@gmail.com')}>
                <Text style={styles.externalLink}>brewhub1@gmail.com</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>8. Legal references</Text>
              <Text style={styles.paragraph}>
                This notice is a BrewHub-specific summary and is not the text of the law or a claim of government endorsement. Read the official sources:
              </Text>
              <Pressable onPress={() => openExternalLink('https://officialgazette.gov.ph/2012/08/15/republic-act-no-10173/')}>
                <Text style={styles.externalLink}>Republic Act No. 10173 — Official Gazette of the Philippines</Text>
              </Pressable>
              <Pressable onPress={() => openExternalLink('https://privacy.gov.ph/implementing-rules%20regulations-data-privacy-act-2012/')}>
                <Text style={styles.externalLink}>Implementing Rules and Regulations — National Privacy Commission</Text>
              </Pressable>
              <Pressable onPress={() => openExternalLink('https://privacy.gov.ph/')}>
                <Text style={styles.externalLink}>National Privacy Commission official website</Text>
              </Pressable>
            </View>

            <Text style={styles.footnote}>
              BrewHub should update this policy if its actual data practices or contact details change.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setAccepted((previous) => !previous)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
            >
              <MaterialIcons
                name={accepted ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={accepted ? '#2E5A3D' : '#6F5948'}
              />
              <Text style={styles.checkboxText}>I have read and agree to the Data Privacy Policy</Text>
            </Pressable>
            <Pressable
              disabled={!accepted}
              onPress={handleAccept}
              accessibilityRole="button"
              accessibilityState={{ disabled: !accepted }}
              style={[styles.acceptButton, !accepted && styles.acceptButtonDisabled]}
            >
              <Text style={styles.acceptButtonText}>I Accept</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(46, 90, 61, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9CDBA',
    backgroundColor: '#F3E9D7',
    overflow: 'hidden',
  },
  header: {
    minHeight: 60,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#D9CDBA',
  },
  title: {
    color: '#3A2E22',
    fontFamily: 'PlayfairDisplayMedium',
    fontSize: 17,
    lineHeight: 23,
  },
  scroll: {
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#3A2E22',
    fontFamily: 'PoppinsBold',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 5,
  },
  paragraph: {
    color: '#3A2E22',
    fontFamily: 'PoppinsRegular',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  externalLink: {
    color: '#2E5A3D',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
    lineHeight: 20,
    textDecorationLine: 'underline',
    marginBottom: 7,
  },
  footnote: {
    color: '#8C7A68',
    fontFamily: 'PoppinsRegular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#D9CDBA',
  },
  checkboxRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 4,
  },
  checkboxText: {
    flex: 1,
    color: '#3A2E22',
    fontFamily: 'PoppinsRegular',
    fontSize: 12,
    lineHeight: 17,
  },
  acceptButton: {
    minWidth: 92,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E5A3D',
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  acceptButtonDisabled: {
    backgroundColor: '#8C8C8C',
    opacity: 0.8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PoppinsMedium',
    fontSize: 13,
  },
});
