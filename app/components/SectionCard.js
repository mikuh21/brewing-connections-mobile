import { StyleSheet, Text, View } from 'react-native';
import theme from '../theme';

export default function SectionCard({ title, description, footer }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSizes.lg,
    fontWeight: '700',
    color: theme.colors.sidebar,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.fonts.display,
  },
  description: {
    fontSize: theme.fontSizes.md,
    color: theme.colors.textMuted,
    lineHeight: 20,
    fontFamily: theme.fonts.body,
  },
  footer: {
    marginTop: theme.spacing.sm,
    color: theme.colors.accentLight,
    fontWeight: '600',
    fontFamily: theme.fonts.body,
  },
});
