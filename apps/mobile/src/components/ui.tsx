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
import { Illustration, type IllustrationName } from "@/components/illustrations";
import { useAppTheme, type AppColors } from "@/theme/theme";

/** Soft colour blobs behind every screen (the "clay canvas"). */
function CanvasBlobs() {
  const { colors } = useAppTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blob, styles.blobTop, { backgroundColor: colors.blobA }]} />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: colors.blobB }]} />
    </View>
  );
}

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
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <CanvasBlobs />
      {content}
    </SafeAreaView>
  );
}

type StickerTone = "mango" | "emerald" | "violet" | "berry" | "white";

function stickerColors(tone: StickerTone, colors: AppColors) {
  switch (tone) {
    case "emerald":
      return { background: colors.primary, text: colors.onPrimary };
    case "violet":
      return { background: colors.accent, text: "#FFFFFF" };
    case "berry":
      return { background: colors.berry, text: "#FFFFFF" };
    case "white":
      return { background: colors.surface, text: colors.text };
    default:
      return { background: colors.mango, text: "#1D1A39" };
  }
}

/** Die-cut label with a thick white edge and a slight tilt. */
export function Sticker({ label, tone = "mango", tilt = -3 }: { label: string; tone?: StickerTone; tilt?: number }) {
  const { colors } = useAppTheme();
  const palette = stickerColors(tone, colors);
  return (
    <View style={[styles.sticker, { backgroundColor: palette.background, transform: [{ rotate: `${tilt}deg` }], boxShadow: colors.clayShadowSmall }]}>
      <Text style={[styles.stickerText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

/**
 * Hero header: sticker eyebrow, big title and an optional 3D illustration.
 * Without an illustration it stays a compact text header.
 */
export function PageHeader({ eyebrow, title, subtitle, action, illustration }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  illustration?: IllustrationName;
}) {
  const { colors } = useAppTheme();
  const copy = (
    <View style={styles.headerCopy}>
      {eyebrow ? <Sticker label={eyebrow} /> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );

  if (!illustration) {
    return (
      <View style={styles.headerRow}>
        {copy}
        {action}
      </View>
    );
  }

  // The shadow lives on the outer view; the inner view clips the decorative glow
  // (clipping on the same view would also clip the shadow on iOS).
  return (
    <View style={[styles.heroShell, { backgroundColor: colors.surface, boxShadow: colors.clayShadow }]}>
      <View style={styles.hero}>
        <View style={[styles.heroGlow, { backgroundColor: colors.accentSurface }]} />
        <View style={styles.heroRow}>
          {copy}
          <Illustration name={illustration} size={96} />
        </View>
        {action ? <View style={styles.heroAction}>{action}</View> : null}
      </View>
    </View>
  );
}

export function SectionTitle({ children, detail }: PropsWithChildren<{ detail?: string }>) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>
      {detail ? (
        <View style={[styles.countChip, { backgroundColor: colors.surface, boxShadow: colors.clayShadowSmall }]}>
          <Text style={[styles.small, styles.bold, { color: colors.textMuted }]}>{detail}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Clay surface: rounded, soft outer shadow with an inner highlight. */
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surface, boxShadow: colors.clayShadow }, style]}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "dark";
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
};

function buttonPalette(variant: NonNullable<ButtonProps["variant"]>, colors: AppColors) {
  switch (variant) {
    case "primary":
      return { background: colors.primary, pressed: colors.primaryPressed, lip: colors.primaryLip, text: colors.onPrimary };
    case "dark":
      return { background: colors.contrast, pressed: colors.contrast, lip: colors.contrastLip, text: colors.onContrast };
    case "danger":
      return { background: colors.dangerSurface, pressed: colors.dangerSurface, lip: colors.danger, text: colors.danger };
    case "secondary":
      return { background: colors.surface, pressed: colors.surfaceMuted, lip: colors.border, text: colors.text };
    default:
      return { background: "transparent", pressed: colors.surfaceMuted, lip: "transparent", text: colors.text };
  }
}

/** Pressable clay button: a solid "lip" under the face that squashes when pressed. */
export function Button({ label, onPress, variant = "primary", disabled, loading, accessibilityHint }: ButtonProps) {
  const { colors } = useAppTheme();
  const palette = buttonPalette(variant, colors);
  const lifted = variant !== "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? palette.pressed : palette.background,
          boxShadow: lifted ? `0px ${pressed ? 1 : 4}px 0px ${palette.lip}${variant === "secondary" ? `, ${colors.clayShadowSmall}` : ""}` : undefined,
          transform: [{ translateY: lifted && pressed ? 3 : 0 }],
        },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.text} /> : <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>}
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
          { color: colors.text, backgroundColor: colors.surfaceMuted, borderColor: colors.border, boxShadow: colors.insetShadow },
        ]}
        value={value}
      />
    </View>
  );
}

function pillColors(tone: "neutral" | "success" | "warning" | "danger", colors: AppColors) {
  if (tone === "success") return { background: colors.successSurface, text: colors.success };
  if (tone === "warning") return { background: colors.warningSurface, text: colors.warning };
  if (tone === "danger") return { background: colors.dangerSurface, text: colors.danger };
  return { background: colors.surfaceMuted, text: colors.textMuted };
}

/** Soft tinted status chip with a dot. */
export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const { colors } = useAppTheme();
  const palette = pillColors(tone, colors);
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      <View style={[styles.pillDot, { backgroundColor: palette.text }]} />
      <Text style={[styles.pillText, { color: palette.text }]}>{label.replaceAll("_", " ")}</Text>
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
      style={[
        styles.choice,
        selected
          ? { backgroundColor: colors.contrast, boxShadow: colors.clayShadowSmall }
          : { backgroundColor: colors.surface, boxShadow: colors.clayShadowSmall },
      ]}
    >
      <Text style={[styles.choiceText, { color: selected ? colors.onContrast : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function StateView({ title, message, action, illustration = "empty" }: {
  title: string;
  message?: string;
  action?: ReactNode;
  illustration?: IllustrationName | null;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.state}>
      {illustration ? (
        <View style={[styles.stateArt, { backgroundColor: colors.surface, boxShadow: colors.clayShadow }]}>
          <Illustration name={illustration} size={104} />
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{message}</Text> : null}
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.state}>
      <View style={[styles.loaderOrb, { backgroundColor: colors.surface, boxShadow: colors.clayShadow }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
      <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function BodyText({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  const { colors } = useAppTheme();
  return <Text style={[styles.body, { color: muted ? colors.textMuted : colors.text }]}>{children}</Text>;
}

/** Stat tile; an illustration turns it into a picture-first tile. */
export function Metric({ label, value, illustration }: { label: string; value: string; illustration?: IllustrationName }) {
  const { colors } = useAppTheme();
  return (
    <Card style={styles.metric}>
      {illustration ? (
        <View style={[styles.metricArt, { backgroundColor: colors.surfaceMuted, boxShadow: colors.insetShadow }]}>
          <Illustration name={illustration} size={40} />
        </View>
      ) : null}
      <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.small, styles.bold, { color: colors.textMuted }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  blob: { position: "absolute", width: 320, height: 320, borderRadius: 160, opacity: 0.55 },
  blobTop: { top: -140, right: -120 },
  blobBottom: { bottom: -160, left: -140 },
  scrollContent: { padding: 20, paddingBottom: 56, gap: 18 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerCopy: { flex: 1, gap: 8, alignItems: "flex-start" },
  heroShell: { borderRadius: 30 },
  hero: { borderRadius: 30, padding: 20, overflow: "hidden", gap: 14 },
  heroGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, right: -70, top: -60, opacity: 0.9 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroAction: { alignItems: "flex-start" },
  sticker: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 3, borderColor: "#FFFFFF", paddingHorizontal: 11, paddingVertical: 4 },
  stickerText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 30, lineHeight: 34, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 6 },
  sectionTitle: { fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.5 },
  countChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  card: { borderRadius: 26, borderWidth: 1, padding: 18, gap: 12 },
  button: { minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginBottom: 4 },
  buttonText: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  disabled: { opacity: 0.5 },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 14, fontWeight: "800" },
  field: { minHeight: 52, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  multiline: { minHeight: 104, paddingTop: 14, textAlignVertical: "top" },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  choice: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, justifyContent: "center" },
  choiceText: { fontSize: 14, fontWeight: "800" },
  state: { flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  stateArt: { width: 136, height: 136, borderRadius: 68, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  stateTitle: { fontSize: 21, textAlign: "center", fontWeight: "900", letterSpacing: -0.4 },
  stateMessage: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  stateAction: { alignSelf: "stretch", marginTop: 4 },
  loaderOrb: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  body: { fontSize: 15, lineHeight: 22 },
  metric: { flex: 1, minWidth: 140, gap: 6 },
  metricArt: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  metricValue: { fontSize: 24, lineHeight: 29, fontWeight: "900", letterSpacing: -0.6 },
  small: { fontSize: 12, lineHeight: 17 },
  bold: { fontWeight: "700" },
});

export const uiStyles = styles;
