// 에이전트 B 작업 영역 — AI 사진 인식 데모 연결 완료 (NIM llama-3.2-11b-vision)
// 남은 내용: 음식 검색·수동 선택 리스트, mealTime 선택 UI, 식단 목록 표시
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors, radius, spacing, font } from '../../theme';
import { analyzeFoodPhoto } from '../lib/ai';
import { predictGlucose } from '../lib/rules';
import { FOODS } from '../lib/fooddb';
import { get, set, KEYS } from '../lib/storage';

const FOOD_NAME = Object.fromEntries(FOODS.map((f) => [f.id, f.name]));

// 원본 사진(수 MB) → 800px JPEG base64로 축소 — NIM 페이로드 제한/전송 지연 방지
async function toBase64ForAI(uri) {
  const context = ImageManipulator.manipulate(uri, { maxWidth: 1024, maxHeight: 1024 });
  context.resize({ width: 800 });
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
}

export default function FoodLogScreen() {
  const [photoUri, setPhotoUri] = useState(null);
  const [dbItems, setDbItems] = useState(null);
  const [aiItems, setAiItems] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const pickAndAnalyze = async () => {
    setError(null);
    setDbItems(null);
    setAiItems(null);
    setAdvice(null);
    setPrediction(null);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setLoading(true);

    let base64 = null;
    let previewUri = asset.uri;
    try {
      const resized = await toBase64ForAI(asset.uri);
      base64 = resized.base64;
      previewUri = resized.uri || asset.uri;
    } catch (e) {
      console.warn('이미지 리사이즈 실패 — 원본 사용 시도:', e);
      base64 = asset.base64 || null;
    }
    setPhotoUri(previewUri);

    if (!base64) {
      setLoading(false);
      setError('이미지를 읽지 못했어요. 다른 사진으로 시도해 주세요.');
      return;
    }

    const ai = await analyzeFoodPhoto(base64, FOODS);
    setLoading(false);

    if (!ai) {
      setError('분석에 실패했어요. 네트워크 상태와 프록시(nim-proxy.js 실행 여부)를 확인해 주세요.');
      return;
    }
    setDbItems(ai.dbItems.length ? ai.dbItems : null);
    setAiItems(ai.aiItems.length ? ai.aiItems : null);
    setAdvice(ai.advice || null);
    if (!ai.dbItems.length && !ai.aiItems.length) {
      setError('사진에서 음식을 찾지 못했어요. 음식이 잘 보이는 사진으로 다시 시도해 주세요.');
      return;
    }
    // DB 우선 + DB 없는 음식은 AI 추정치로 합산 예측
    const combined = [...ai.dbItems, ...ai.aiItems];
    const answers = await get(KEYS.SURVEY_ANSWERS);
    setPrediction(predictGlucose(combined, answers, '점심'));
  };

  const saveLog = async () => {
    const combined = [...(dbItems || []), ...(aiItems || [])];
    const logs = (await get(KEYS.FOOD_LOGS)) || [];
    logs.push({ date: new Date().toISOString().slice(0, 10), mealTime: '점심', items: combined });
    const ok = await set(KEYS.FOOD_LOGS, logs);
    if (ok) Alert.alert('저장 완료', '오늘의 식단에 기록했어요.');
    else setError('저장에 실패했어요. 다시 시도해 주세요.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>사진으로 기록 (AI)</Text>
        <Text style={styles.cardBody}>
          음식 사진을 올리면 AI가 음식을 인식하고 식후 혈당 상승을 예측합니다.
        </Text>
        <Pressable style={styles.primaryButton} onPress={pickAndAnalyze} disabled={loading}>
          <Text style={styles.primaryButtonText}>
            {loading ? '분석 중...' : '📷 사진 선택하고 분석하기'}
          </Text>
        </Pressable>
        {/* 사진 촬영 기록은 MVP 제외 — "곧 제공" (Plan.md 결정) */}
        <Text style={styles.comingSoon}>📷 바로 촬영해서 기록하기 — 곧 제공</Text>
      </View>

      {loading && <ActivityIndicator size="large" color={colors.primary} />}

      {error && (
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {photoUri && (
        <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
      )}

      {dbItems && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>인식된 음식 (내장 DB)</Text>
          {dbItems.map((it, i) => (
            <Text key={`${it.foodId}-${i}`} style={styles.itemText}>
              · {FOOD_NAME[it.foodId] || it.foodId} × {it.servings ?? 1}인분
            </Text>
          ))}
        </View>
      )}

      {aiItems && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI 추정 음식 (DB 미등록)</Text>
          {aiItems.map((it, i) => (
            <Text key={`${it.name}-${i}`} style={styles.itemText}>
              · {it.name} × {it.servings}인분 — 약 {it.kcal} kcal / 탄수화물 약 {it.carbs}g
            </Text>
          ))}
          <Text style={styles.disclaimer}>🤖 이 답변은 인공지능(AI)을 통해 생성되었어요.</Text>
        </View>
      )}

      {prediction && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>식후 혈당 예측</Text>
          <Text style={styles.peakText}>
            예상 최고 {prediction.peakMgDl} mg/dL
            <Text style={styles.peakSub}>  (공복 {prediction.base} 기준)</Text>
          </Text>
          {prediction.risePerItem.map((r) => (
            <Text key={r.name} style={styles.itemText}>
              · {r.name}: +{r.delta} mg/dL
            </Text>
          ))}
          {/* TODO: predict-result 화면 연결 (내용 단계) */}
          <Pressable style={styles.primaryButton} onPress={saveLog}>
            <Text style={styles.primaryButtonText}>이 기록 저장하기</Text>
          </Pressable>
        </View>
      )}

      {advice && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI 혈당 관리 조언</Text>
          <Text style={styles.cardBody}>{advice}</Text>
          <Text style={styles.disclaimer}>🤖 이 답변은 인공지능(AI)을 통해 생성되었어요.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: font.body, fontWeight: '700', marginBottom: spacing.sm },
  cardBody: { color: colors.sub, fontSize: font.body, lineHeight: 22, marginBottom: spacing.md },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  primaryButtonText: { color: colors.card, fontSize: font.body, fontWeight: '700' },
  comingSoon: { color: colors.sub, fontSize: font.small, textAlign: 'center', marginTop: spacing.sm },
  errorText: { color: colors.danger, fontSize: font.body },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
  },
  itemText: { color: colors.sub, fontSize: font.body, lineHeight: 24 },
  disclaimer: { color: colors.sub, fontSize: font.small, marginTop: spacing.sm },
  peakText: { color: colors.text, fontSize: font.title, fontWeight: '700', marginBottom: spacing.sm },
  peakSub: { color: colors.sub, fontSize: font.sub, fontWeight: '400' },
});
