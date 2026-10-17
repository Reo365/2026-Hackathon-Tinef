// 에이전트 B 작업 영역 — AI 사진/카메라 분석 + 성분 요약 + 스파이크 완화 조합 + AI 레시피
// 인식 결과는 전부 AI 추정치로 통일 (DB 매핑 구분 없음)
// 각 항목은 AnimatedSection 슬롯 — 스켈레톤↔결출 전환이 높이 애니메이션으로 부드럽게 이어짐
// 남은 내용: 음식 검색·수동 선택 리스트(직접 입력 탭), mealTime 선택 UI, 식단 목록 표시
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors, radius, spacing } from '../../theme';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import Skeleton from '../components/Skeleton';
import AnimatedSection from '../components/AnimatedSection';
import { analyzeFoodPhoto, suggestRecipes } from '../lib/ai';
import { predictGlucose } from '../lib/rules';
import { suggestCombination } from '../lib/combination';
import { get, set, KEYS } from '../lib/storage';

const MEAL_TIME = '점심'; // TODO: 식사 시간 선택 UI (내용 단계)

// 원본 사진(수 MB) → 800px JPEG base64로 축소 — NIM 페이로드 제한/전송 지연 방지
async function toBase64ForAI(uri) {
  const context = ImageManipulator.manipulate(uri, { maxWidth: 1024, maxHeight: 1024 });
  context.resize({ width: 800 });
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
}

export default function FoodLogScreen() {
  const [photoUri, setPhotoUri] = useState(null);
  const [photoKind, setPhotoKind] = useState(null); // 'ingredients' | 'dish' | null
  const [items, setItems] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [combination, setCombination] = useState(null);
  const [recipes, setRecipes] = useState(null);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesFailed, setRecipesFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [predictionExpanded, setPredictionExpanded] = useState(false);
  const scrollRef = useRef(null);
  const scrollOffset = useRef(0);

  // 뷰포트 위쪽 섹션의 높이 변화는 위 내용을 밀어 화면이 뛰는 원인 — 스크롤을 보정
  const handleHeightDelta = (delta, winY) => {
    if (delta !== 0 && winY < 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, scrollOffset.current + delta), animated: false });
    }
  };

  const resetResults = () => {
    setError(null);
    setPhotoKind(null);
    setItems(null);
    setAdvice(null);
    setPrediction(null);
    setCombination(null);
    setRecipes(null);
    setRecipesLoading(false);
    setRecipesFailed(false);
    setSaved(false);
    setItemsExpanded(false);
    setPredictionExpanded(false);
  };

  // 갤러리/카메라 공통 분석 파이프라인
  const analyzeAsset = async (asset) => {
    resetResults();
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

    const ai = await analyzeFoodPhoto(base64);
    setLoading(false);

    if (!ai) {
      setError('분석에 실패했어요. 네트워크 상태를 확인해 주세요.');
      return;
    }
    if (ai.items.length === 0) {
      // 음식 미인식 — 조언/조합/레시피 생성도 하지 않음
      setError('사진에서 음식을 찾지 못했어요. 음식이 잘 보이는 사진으로 다시 시도해 주세요.');
      return;
    }
    setItems(ai.items);
    setAdvice(ai.advice || null);
    setPhotoKind(ai.kind);

    const answers = await get(KEYS.SURVEY_ANSWERS);
    setPrediction(predictGlucose(ai.items, answers, MEAL_TIME));

    // 룰 기반 스파이크 완화 조합 — 즉시 계산, 실패 리스크 0
    setCombination(suggestCombination(ai.items, answers, MEAL_TIME));

    // AI 레시피 — 재료 사진일 때만 요청 (완성 음식은 조합 카드가 역할 대행, 불필요한 호출 제거)
    if (ai.kind === 'ingredients') loadRecipes(ai.items);
  };

  const loadRecipes = async (sourceItems) => {
    setRecipesFailed(false);
    setRecipesLoading(true);
    const answers = await get(KEYS.SURVEY_ANSWERS);
    const names = sourceItems.map((it) => it.name);
    const recipeList = await suggestRecipes(names, answers);
    if (!recipeList) setRecipesFailed(true);
    setRecipes(recipeList);
    setRecipesLoading(false);
  };

  const takeAndAnalyze = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('카메라 권한이 필요합니다.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
      if (result.canceled) return;
      await analyzeAsset(result.assets[0]);
    } catch (e) {
      console.warn('카메라 실행 실패:', e);
      setError('카메라를 실행할 수 없어요. 앨범 선택으로 시도해 주세요.');
    }
  };

  const pickAndAnalyze = async () => {
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
    await analyzeAsset(result.assets[0]);
  };

  const saveLog = async () => {
    const logs = (await get(KEYS.FOOD_LOGS)) || [];
    logs.push({ date: new Date().toISOString().slice(0, 10), mealTime: MEAL_TIME, items: items || [] });
    const ok = await set(KEYS.FOOD_LOGS, logs);
    if (ok) setSaved(true);
    else setError('저장에 실패했어요. 다시 시도해 주세요.');
  };

  // 총 성분 — 전 항목 AI 추정치 합산
  let totalKcal = 0;
  let totalCarbs = 0;
  (items || []).forEach((it) => {
    totalKcal += (it.kcal || 0) * (it.servings ?? 1);
    totalCarbs += (it.carbs || 0) * (it.servings ?? 1);
  });

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      onScroll={(e) => {
        scrollOffset.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          사진으로 기록 (AI)
        </ThemedText>
        <ThemedText variant="body" style={styles.cardBody}>
          음식을 촬영하면 성분을 분석하고 혈당 스파이크를 예측합니다.
        </ThemedText>
        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={takeAndAnalyze}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="카메라로 촬영해서 분석"
          >
            <Ionicons name="camera" size={18} color={colors.onTint} />
            <ThemedText variant="subhead" style={styles.primaryButtonText}>
              카메라로 촬영
            </ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={pickAndAnalyze}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="앨범에서 사진 선택해서 분석"
          >
            <Ionicons name="image" size={18} color={colors.primary} />
            <ThemedText variant="subhead" style={styles.secondaryButtonText}>
              앨범에서 선택
            </ThemedText>
          </Pressable>
        </View>
      </Card>

      {/* 미리보기는 스켈레톤 위 고정 — 로딩 중에도 위치가 밀리지 않음 */}
      {photoUri && (
        <Image
          source={{ uri: photoUri }}
          style={styles.preview}
          resizeMode="cover"
          accessibilityLabel="선택한 음식 사진 미리보기"
        />
      )}

      {error && (
        <AnimatedSection onHeightDelta={handleHeightDelta}>
          <Card>
            <ThemedText variant="body" style={styles.errorText}>
              {error}
            </ThemedText>
          </Card>
        </AnimatedSection>
      )}

      {saved && (
        <AnimatedSection onHeightDelta={handleHeightDelta}>
          <Card style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <ThemedText variant="subhead" style={styles.successText}>
              오늘의 식단에 기록했어요
            </ThemedText>
          </Card>
        </AnimatedSection>
      )}

      {/* 인식된 음식 — 로딩 중 스켈레톤, 완료 시 결과로 높이 보간 */}
      <AnimatedSection onHeightDelta={handleHeightDelta}>
        {loading ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              인식된 음식
            </ThemedText>
            <View style={styles.skeletonStack}>
              <Skeleton width="92%" height={14} />
              <Skeleton width="78%" height={14} />
              <Skeleton width="85%" height={14} />
            </View>
          </Card>
        ) : items && items.length > 0 ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              인식된 음식
            </ThemedText>
            {(itemsExpanded ? items : items.slice(0, 5)).map((it, i) => (
              <ThemedText key={`${it.name}-${i}`} variant="body" style={styles.itemText}>
                · {it.name} × {it.servings}인분 — 약 {it.kcal} kcal / 탄수화물 약 {it.carbs}g
              </ThemedText>
            ))}
            {items.length > 5 && (
              <Pressable
                style={({ pressed }) => [styles.moreRow, pressed && styles.buttonPressed]}
                onPress={() => setItemsExpanded(!itemsExpanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded: itemsExpanded }}
              >
                <Ionicons
                  name={itemsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                />
                <ThemedText variant="subhead" style={styles.moreText}>
                  {itemsExpanded ? '접기' : `더보기 (외 ${items.length - 5}개)`}
                </ThemedText>
              </Pressable>
            )}
          </Card>
        ) : null}
      </AnimatedSection>

      {/* 이번 식사 성분 */}
      <AnimatedSection onHeightDelta={handleHeightDelta}>
        {loading ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              이번 식사 성분
            </ThemedText>
            <Skeleton width="60%" height={44} />
          </Card>
        ) : items && items.length > 0 ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              이번 식사 성분
            </ThemedText>
            <ThemedText variant="hero" style={styles.totalText}>
              약 {Math.round(totalKcal)}
              <ThemedText variant="subhead" style={styles.totalUnit}>
                {'  '}kcal · 탄수화물 약 {Math.round(totalCarbs)}g
              </ThemedText>
            </ThemedText>
          </Card>
        ) : null}
      </AnimatedSection>

      {/* 식후 혈당 예측 */}
      <AnimatedSection onHeightDelta={handleHeightDelta}>
        {loading ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              식후 혈당 예측
            </ThemedText>
            <View style={styles.skeletonStack}>
              <Skeleton width="45%" height={44} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="85%" height={14} />
            </View>
          </Card>
        ) : prediction ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              식후 혈당 예측
            </ThemedText>
            <ThemedText variant="hero" style={styles.peakText}>
              {prediction.peakMgDl}
              <ThemedText variant="subhead" style={styles.peakSub}>
                {'  '}mg/dL (공복 {prediction.base} 기준)
              </ThemedText>
            </ThemedText>
            {(predictionExpanded
              ? prediction.risePerItem
              : prediction.risePerItem.slice(0, 5)
            ).map((r) => (
              <ThemedText key={r.name} variant="body" style={styles.itemText}>
                · {r.name}: +{r.delta} mg/dL
              </ThemedText>
            ))}
            {prediction.risePerItem.length > 5 && (
              <Pressable
                style={({ pressed }) => [styles.moreRow, pressed && styles.buttonPressed]}
                onPress={() => setPredictionExpanded(!predictionExpanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded: predictionExpanded }}
              >
                <Ionicons
                  name={predictionExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                />
                <ThemedText variant="subhead" style={styles.moreText}>
                  {predictionExpanded
                    ? '접기'
                    : `더보기 (외 ${prediction.risePerItem.length - 5}개)`}
                </ThemedText>
              </Pressable>
            )}
          </Card>
        ) : null}
      </AnimatedSection>

      {/* 혈당 스파이크 줄이는 조합 */}
      <AnimatedSection onHeightDelta={handleHeightDelta}>
        {loading ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              혈당 스파이크 줄이는 조합
            </ThemedText>
            <View style={styles.skeletonStack}>
              <Skeleton width="100%" height={14} />
              <Skeleton width="85%" height={14} />
            </View>
          </Card>
        ) : combination ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              혈당 스파이크 줄이는 조합
            </ThemedText>
            {combination.cut && (
              <ThemedText variant="body" style={styles.itemText}>
                · {combination.cut.name}의 양을 절반으로 — 예상 최고 {combination.beforePeak} →{' '}
                {combination.afterPeak} mg/dL
              </ThemedText>
            )}
            {combination.orderFirst.length > 0 && (
              <ThemedText variant="body" style={styles.itemText}>
                · 먼저 드시면 좋은 음식: {combination.orderFirst.join(' → ')}
              </ThemedText>
            )}
            {combination.additions.length > 0 && (
              <ThemedText variant="body" style={styles.itemText}>
                · 추가 추천: {combination.additions.join(', ')} (혈당 영향 낮음)
              </ThemedText>
            )}
          </Card>
        ) : null}
      </AnimatedSection>

      {/* AI 레시피 — 재료 사진일 때만 표시 */}
      {photoKind === 'ingredients' && (recipesLoading || recipes || recipesFailed) && (
        <AnimatedSection onHeightDelta={handleHeightDelta}>
          {recipesLoading ? (
            <Card>
              <ThemedText variant="headline" style={styles.cardTitle}>
                추천 레시피
              </ThemedText>
              <View style={styles.skeletonStack}>
                <Skeleton width="100%" height={14} />
                <Skeleton width="82%" height={14} />
              </View>
            </Card>
          ) : recipes && recipes.length > 0 ? (
            <Card>
              <ThemedText variant="headline" style={styles.cardTitle}>
                추천 레시피
              </ThemedText>
              {recipes.map((recipe, i) => (
                <View key={`${recipe.title}-${i}`} style={styles.recipeBlock}>
                  <ThemedText variant="headline" style={styles.recipeTitle}>
                    {i + 1}. {recipe.title}
                  </ThemedText>
                  {recipe.ingredients.length > 0 && (
                    <ThemedText variant="subhead" style={styles.itemText}>
                      재료: {recipe.ingredients.join(', ')}
                    </ThemedText>
                  )}
                  {recipe.desc ? (
                    <ThemedText variant="body" style={styles.itemText}>
                      {recipe.desc}
                    </ThemedText>
                  ) : null}
                  {recipe.how ? (
                    <ThemedText variant="subhead" style={styles.itemText}>
                      만드는 법: {recipe.how}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : recipesFailed ? (
            <Card>
              <ThemedText variant="body" style={styles.cardBody}>
                레시피 추천을 불러오지 못했어요.
              </ThemedText>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={() => loadRecipes(items)}
                accessibilityRole="button"
              >
                <Ionicons name="refresh" size={16} color={colors.primary} />
                <ThemedText variant="subhead" style={styles.secondaryButtonText}>
                  다시 시도
                </ThemedText>
              </Pressable>
            </Card>
          ) : null}
        </AnimatedSection>
      )}

      {advice && (
        <AnimatedSection onHeightDelta={handleHeightDelta}>
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              AI 혈당 관리 조언
            </ThemedText>
            <ThemedText variant="body" style={styles.cardBody}>
              {advice}
            </ThemedText>
          </Card>
        </AnimatedSection>
      )}

      {prediction && (
        <AnimatedSection onHeightDelta={handleHeightDelta}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={saveLog}
            accessibilityRole="button"
          >
            <ThemedText variant="headline" style={styles.primaryButtonText}>
              이 기록 저장하기
            </ThemedText>
          </Pressable>
        </AnimatedSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  cardTitle: { marginBottom: spacing.sm },
  cardBody: { color: colors.sub, marginBottom: spacing.sm },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
  },
  buttonPressed: { opacity: 0.7 },
  primaryButtonText: { color: colors.onTint, fontWeight: '600' },
  secondaryButtonText: { color: colors.primary, fontWeight: '600' },
  errorText: { color: colors.danger },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
  },
  successText: { color: colors.text, flex: 1 },
  preview: {
    width: '100%',
    height: 180, // 사진 비율과 무관한 고정 높이 — 목록 흐름 유지용 예외값
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  totalText: { color: colors.text },
  totalUnit: { color: colors.sub },
  itemText: { color: colors.sub },
  peakText: { color: colors.text, marginBottom: spacing.sm },
  peakSub: { color: colors.sub },
  recipeBlock: { gap: spacing.xs, marginTop: spacing.sm },
  recipeTitle: { color: colors.text },
  skeletonStack: { gap: spacing.sm },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  moreText: { color: colors.primary, fontWeight: '600' },
});
