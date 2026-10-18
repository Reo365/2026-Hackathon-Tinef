// 시간 선택 필드 — 웹: 시간 입력 + 설정 버튼 / 모바일: "시간 설정" 버튼(네이티브 선택창)만
// 설정한 시간이 있을 때만 값 배지 표시 (미설정 기본값은 숨김)
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';
import ThemedText from './ThemedText';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toDate(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
  if (!m) return new Date();
  return new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
}

export default function TimePickerField({ label, value, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const isWeb = Platform.OS === 'web';
  const hasValue = !!value; // 설정 전에는 배지 숨김

  const applyDraft = () => {
    const t = draft.trim();
    if (!TIME_RE.test(t)) {
      setError('시간은 HH:MM 형식으로 입력하세요 (예: 07:30).');
      return;
    }
    setError(null);
    setDraft('');
    onChange(t);
  };

  const onNativeChange = (event, date) => {
    if (Platform.OS === 'android') setPickerOpen(false); // Android는 OK 시 자동 닫힘
    if (date) {
      // 스피너 회전 중에도 즉시 적용 — 별도 완료 버튼 불필요
      onChange(
        `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      );
    }
  };

  return (
    <View style={styles.chipBlock}>
      <View style={styles.labelRow}>
        <ThemedText variant="headline" style={styles.cardTitle}>
          {label}
        </ThemedText>
        {hasValue && (
          <View style={styles.valuePill}>
            <Ionicons name="time" size={12} color={colors.primary} />
            <ThemedText variant="caption" style={styles.valueText}>
              {value}
            </ThemedText>
          </View>
        )}
      </View>

      {isWeb ? (
        // 웹 — 시간 입력 + 설정
        <>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="시간 입력 (예: 07:30)"
              placeholderTextColor={colors.sub}
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                setError(null);
              }}
              accessibilityLabel={`${label} 시간 입력`}
            />
            <Pressable
              style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}
              onPress={applyDraft}
              accessibilityRole="button"
              accessibilityLabel={`${label} 시간 설정`}
            >
              <ThemedText variant="subhead" style={styles.applyText}>
                설정
              </ThemedText>
            </Pressable>
          </View>
          {error && (
            <ThemedText variant="caption" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
        </>
      ) : (
        // 모바일 — "시간 설정" 버튼만 (입력란 없음, 누르면 네이티브 선택창)
        <>
          <Pressable
            style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label} 시간 설정`}
          >
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <ThemedText variant="subhead" style={styles.pickerText}>
              시간 설정
            </ThemedText>
          </Pressable>

          {pickerOpen && Platform.OS === 'ios' && (
            <Modal transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
              {/* 배경 탭으로 닫기 — 회전 중 실시간 적용, 완료 버튼 불필요 */}
              <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
                <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
                  <ThemedText variant="subhead" style={styles.modalTitle}>
                    {label} 설정
                  </ThemedText>
                  <DateTimePicker
                    value={toDate(value)}
                    mode="time"
                    display="spinner"
                    onChange={onNativeChange}
                    style={styles.picker}
                  />
                  <ThemedText variant="caption" style={styles.modalHint}>
                    밖을 누르면 닫혀요
                  </ThemedText>
                </View>
              </Pressable>
            </Modal>
          )}
          {pickerOpen && Platform.OS === 'android' && (
            <DateTimePicker value={toDate(value)} mode="time" display="default" onChange={onNativeChange} />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipBlock: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: { marginBottom: 0 },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  valueText: { color: colors.primary, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  applyText: { color: colors.onTint, fontWeight: '600' },
  errorText: { color: colors.danger, marginTop: spacing.xs },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  pickerText: { color: colors.primary, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: { color: colors.text, fontWeight: '700' },
  picker: { width: 260 },
  modalHint: { color: colors.sub },
});
