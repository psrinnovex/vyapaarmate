import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/theme/theme";

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const { colors } = useAppTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.flex}>{children}</View>
  );
  return <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>{content}</SafeAreaView>;
}

export function PageHeader({ eyebrow, title, subtitle, action }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionTitle({ children, detail }: PropsWithChildren<{ detail?: string }>) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>
      {detail ? <Text style={[styles.small, { color: colors.textMuted }]}>{detail}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = "primary", disabled, loading, accessibilityHint }: ButtonProps) {
  const { colors } = useAppTheme();
  const background = variant === "primary"
    ? colors.primary
    : variant === "danger"
      ? colors.dangerSurface
      : variant === "secondary"
        ? colors.surfaceMuted
        : "transparent";
  const foreground = variant === "primary"
    ? colors.onPrimary
    : variant === "danger"
      ? colors.danger
      : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed && variant === "primary" ? colors.primaryPressed : background },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>}
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  autoCapitalize = "sentences",
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
} & Omit<TextInputProps, "style">) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        selectionColor={colors.primary}
        style={[
          styles.field,
          multiline && styles.multiline,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        value={value}
      />
    </View>
  );
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const { colors } = useAppTheme();
  const color = tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "danger" ? colors.danger : colors.textMuted;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label.replaceAll("_", " ")}</Text>
    </View>
  );
}

export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceMuted : colors.surface }]}
    >
      <Text style={[styles.choiceText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function StateView({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.state}>
      <Text accessibilityRole="header" style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.state}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function BodyText({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  const { colors } = useAppTheme();
  return <Text style={[styles.body, { color: muted ? colors.textMuted : colors.text }]}>{children}</Text>;
}

export function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <Card style={styles.metric}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.small, { color: colors.textMuted }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48, gap: 18 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: "700" },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  button: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 14, fontWeight: "700" },
  field: { minHeight: 50, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  multiline: { minHeight: 96, paddingTop: 13, textAlignVertical: "top" },
  pill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  pillText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  choice: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" },
  choiceText: { fontSize: 14, fontWeight: "700" },
  state: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  stateTitle: { fontSize: 21, textAlign: "center", fontWeight: "800" },
  stateMessage: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22 },
  metric: { flex: 1, minWidth: 140 },
  metricValue: { fontSize: 24, lineHeight: 29, fontWeight: "800" },
  small: { fontSize: 12, lineHeight: 17 },
});

export const uiStyles = styles;
