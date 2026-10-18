// 에이전트 B 작업 영역 — AI 사진/카메라 분석 + 성분 요약 + 스파이크 완화 조합 + AI 레시피
// 인식 결과는 전부 AI 추정치로 통일 (DB 매핑 구분 없음)
// 각 항목은 AnimatedSection 슬롯 — 스켈레톤↔결출 전환이 높이 애니메이션으로 부드럽게 이어짐
// 남은 내용: 음식 검색·수동 선택 리스트(직접 입력 탭), 식단 목록 표시
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, type } from '../../theme';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import Skeleton from '../components/Skeleton';
import AnimatedSection from '../components/AnimatedSection';
import BloodSugarChart from '../components/BloodSugarChart';
import FoodRow, { deltaColor } from '../components/FoodRow';
import { toJpegBase64 } from '../lib/imageUtils';
import { analyzeFoodPhoto, suggestRecipes } from '../lib/ai';
import { searchFoods } from '../lib/fooddb';
import { searchFoods as searchMfds } from '../lib/nutrition';
import { predictGlucose } from '../lib/rules';
import { suggestCombination } from '../lib/combination';
import { get, set, KEYS } from '../lib/storage';

// 식약처 결과와 내장 DB 결과의 중복 제거용 — 공백 무시 이름 비교
const squashName = (s) => String(s || '').replace(/\s+/g, '');

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

  // 기록 방식 — 'photo'(AI 사진 분석) | 'manual'(직접 입력 검색)
  const [mode, setMode] = useState('photo');
  // 식사 시간 UI는 미표시 — 예측·저장 로직용 내부 기본값만 유지 (홈이 기록의 mealTime 참조)
  const mealTime = '점심';
  const [answers, setAnswers] = useState(null);

  // 직접 입력 — 검색(내장 37종 + 식약처 DB) 및 선택 목록 (predict.js와 동일 패턴)
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    let mounted = true;
    get(KEYS.SURVEY_ANSWERS).then((a) => {
      if (mounted) setAnswers(a);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 식약처 검색 — 입력 멈춤 0.35초 후 1회 호출 (setState는 콜백 안에서만)
  useEffect(() => {
    if (!query.trim()) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setRemoteLoading(true);
      const found = await searchMfds(query.trim(), { limit: 10 });
      if (!cancelled) {
        setRemoteResults(found);
        setRemoteLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const queryTrimmed = query.trim();
  const localResults = searchFoods(queryTrimmed).filter((f) => !selected.some((s) => s.key === f.id));
  const localNames = new Set(localResults.map((f) => squashName(f.name)));
  const localRows = localResults
    .slice(0, queryTrimmed ? 10 : 6)
    .map((f) => ({ ...f, key: f.id, isMfds: false }));
  const remoteRows = queryTrimmed
    ? remoteResults
        .filter(
          (r) =>
            !localNames.has(squashName(r.name)) &&
            !selected.some((s) => s.key === `mfds:${r.foodCd}`)
        )
        .map((r) => ({ ...r, key: `mfds:${r.foodCd}`, isMfds: true }))
    : [];
  const rows = [...localRows, ...remoteRows];

  const addFood = (food) => {
    setSelected((prev) => [
      ...prev,
      food.isMfds
        ? {
            key: `mfds:${food.foodCd}`,
            name: food.name,
            displayName: food.displayName,
            serving: `${food.serving}`,
            servings: 1,
            kcal: food.kcal,
            carbs: food.carbs,
            giFactor: food.giFactor,
          }
        : {
            key: food.id,
            foodId: food.id,
            name: food.name,
            serving: food.serving,
            servings: 1,
            kcal: food.kcal,
            carbs: food.carbs,
            giFactor: food.giFactor,
          },
    ]);
  };

  const changeServings = (key, step) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.key === key
          ? { ...s, servings: Math.max(0.5, Math.round((s.servings + step) * 2) / 2) }
          : s
      )
    );
  };

  const removeFood = (key) => {
    setSelected((prev) => prev.filter((s) => s.key !== key));
  };

  // 직접 입력 예측 요약 — 선택 즉시 반영 (식약처 항목은 name/carbs 경로)
  const itemDeltas = selected.map((s) => ({
    ...s,
    delta: predictGlucose(
      [
        s.foodId
          ? { foodId: s.foodId, servings: s.servings }
          : { name: s.name, carbs: s.carbs, giFactor: s.giFactor, servings: s.servings },
      ],
      answers,
      mealTime
    ).risePerItem[0].delta,
  }));
  const totalDelta = itemDeltas.reduce((sum, s) => sum + s.delta, 0);
  const manualPrediction =
    answers && selected.length > 0
      ? predictGlucose(
          selected.map((s) =>
            s.foodId
              ? { foodId: s.foodId, servings: s.servings }
              : { name: s.name, carbs: s.carbs, giFactor: s.giFactor, servings: s.servings }
          ),
          answers,
          mealTime
        )
      : null;

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

    // 항상 JPEG 800px로 변환 — 원본(PNG·수 MB) 전송은 NIM 타임아웃 502의 원인이라 금지
    let base64 = null;
    let previewUri = asset.uri;
    try {
      const resized = await toJpegBase64(asset.uri);
      base64 = resized.base64;
      previewUri = resized.uri || asset.uri;
    } catch (e) {
      console.warn('이미지 변환 실패:', e);
    }
    setPhotoUri(previewUri);

    if (!base64) {
      setLoading(false);
      setError('이미지를 읽지 못했어요. 다른 사진으로 시도해 주세요.');
      return;
    }
    if (base64.length > 1_500_000) {
      // 방어 가드 — 비정상적으로 큰 페이로드는 NIM 게이트웨이 타임아웃 유발
      setLoading(false);
      setError('이미지가 너무 커요. 더 작은 사진으로 시도해 주세요.');
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
    setPrediction(predictGlucose(ai.items, answers, mealTime));

    // 룰 기반 스파이크 완화 조합 — 즉시 계산, 실패 리스크 0
    setCombination(suggestCombination(ai.items, answers, mealTime));

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

  // 합계 — 인분 반영 kcal·탄수화물 (스냅샷 저장용)
  const sumTotals = (list) => {
    let kcal = 0;
    let carbs = 0;
    (list || []).forEach((it) => {
      kcal += (it.kcal || 0) * (it.servings ?? 1);
      carbs += (it.carbs || 0) * (it.servings ?? 1);
    });
    return { kcal: Math.round(kcal), carbs: Math.round(carbs) };
  };

  // 기록 저장 — 저장 시점 화면의 모든 내용을 snapshot으로 보존 (내 기록 상세가 동일하게 재생)
  const saveLog = async (logItems) => {
    const list = logItems || [];
    const savedPrediction = predictGlucose(list, answers, mealTime);
    const rise = savedPrediction.peakMgDl - savedPrediction.base;
    const logs = (await get(KEYS.FOOD_LOGS)) || [];
    logs.push({
      date: new Date().toISOString().slice(0, 10),
      mealTime,
      items: list,
      snapshot: {
        kind: photoKind,
        totals: sumTotals(list),
        prediction: {
          peakMgDl: savedPrediction.peakMgDl,
          base: savedPrediction.base,
          risePerItem: savedPrediction.risePerItem,
        },
        chart: {
          labels: chartLabels,
          values: [
            savedPrediction.base,
            savedPrediction.base + Math.round(rise * 0.45),
            savedPrediction.peakMgDl,
            savedPrediction.base + Math.round(rise * 0.85),
            savedPrediction.base + Math.round(rise * 0.6),
          ],
        },
        combination,
        recipes,
        advice,
      },
    });
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

  // 시간별 혈당 곡선 — 식전 → 30분 → 1시간(최고) → 완만한 하락
  const chartLabels = ['식전', '30분', '1시간', '2시간', '3시간'];
  let chartValues = [];
  if (prediction) {
    const rise = prediction.peakMgDl - prediction.base;
    chartValues = [
      prediction.base,
      prediction.base + Math.round(rise * 0.45),
      prediction.peakMgDl,
      prediction.base + Math.round(rise * 0.85),
      prediction.base + Math.round(rise * 0.6),
    ];
  }

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
      {/* 기록 방식 — 직접 입력(검색) / 사진 AI */}
      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setMode('manual')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'manual' }}
          style={({ pressed }) => [
            styles.segment,
            mode === 'manual' && styles.segmentActive,
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText variant="subhead" style={mode === 'manual' ? styles.segmentTextActive : styles.segmentText}>
            직접 입력
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setMode('photo')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'photo' }}
          style={({ pressed }) => [
            styles.segment,
            mode === 'photo' && styles.segmentActive,
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText variant="subhead" style={mode === 'photo' ? styles.segmentTextActive : styles.segmentText}>
            사진으로 기록
          </ThemedText>
        </Pressable>
      </View>

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

      {/* 직접 입력 — 검색(내장 37종 + 식약처 DB) + 선택 목록 + 기록 */}
      {mode === 'manual' && (
        <>
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              음식 검색
            </ThemedText>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.sub} />
              <TextInput
                style={styles.input}
                placeholder="음식 이름을 검색하세요"
                placeholderTextColor={colors.sub}
                value={query}
                onChangeText={setQuery}
                accessibilityLabel="음식 검색"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="검색어 지우기">
                  <Ionicons name="close-circle" size={16} color={colors.sub} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.resultList}>
              {rows.length > 0 ? (
                rows.map((food) => {
                  const rowDelta = predictGlucose(
                    [
                      food.isMfds
                        ? { name: food.name, carbs: food.carbs, giFactor: food.giFactor, servings: 1 }
                        : { foodId: food.id, servings: 1 },
                    ],
                    answers,
                    mealTime
                  ).risePerItem[0].delta;
                  return (
                    <FoodRow
                      key={food.key}
                      name={food.displayName || food.name}
                      serving={food.isMfds ? `${food.serving} · ${food.sourceLabel || '식약처'}` : food.serving}
                      delta={rowDelta}
                      onPress={() => addFood(food)}
                      actionLabel={`${food.name} 선택`}
                    />
                  );
                })
              ) : (
                <ThemedText variant="subhead" style={styles.emptyText}>
                  {remoteLoading
                    ? '식약처 DB에서 검색 중이에요…'
                    : '검색 결과가 없어요. 다른 키워드로 검색해 보세요.'}
                </ThemedText>
              )}
            </View>
          </Card>

          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              선택한 음식 {selected.length}개
            </ThemedText>
            {selected.length === 0 ? (
              <ThemedText variant="subhead" style={styles.emptyText}>
                위 목록에서 음식을 선택하세요.
              </ThemedText>
            ) : (
              <>
                {itemDeltas.map((s) => (
                  <View key={s.key} style={styles.selectedRow}>
                    <View style={styles.selectedLeft}>
                      <ThemedText variant="body" style={styles.selectedName}>
                        {s.displayName || s.name} × {s.servings}인분
                      </ThemedText>
                      <ThemedText variant="caption" style={[styles.itemDelta, { color: deltaColor(s.delta) }]}>
                        +{s.delta} mg/dL
                      </ThemedText>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        style={({ pressed }) => [styles.stepButton, pressed && styles.buttonPressed]}
                        onPress={() => changeServings(s.key, -0.5)}
                        accessibilityRole="button"
                        accessibilityLabel={`${s.name} 0.5인분 줄이기`}
                      >
                        <Ionicons name="remove" size={14} color={colors.text} />
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.stepButton, pressed && styles.buttonPressed]}
                        onPress={() => changeServings(s.key, 0.5)}
                        accessibilityRole="button"
                        accessibilityLabel={`${s.name} 0.5인분 늘리기`}
                      >
                        <Ionicons name="add" size={14} color={colors.text} />
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.stepButton, pressed && styles.buttonPressed]}
                        onPress={() => removeFood(s.key)}
                        accessibilityRole="button"
                        accessibilityLabel={`${s.name} 삭제`}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                ))}
                <ThemedText variant="body" style={styles.totalText}>
                  합계 상승 +{totalDelta} mg/dL
                </ThemedText>
                {manualPrediction && (
                  <ThemedText variant="subhead" style={styles.itemText}>
                    예상 최고 혈당 약 {manualPrediction.peakMgDl} mg/dL
                  </ThemedText>
                )}
                <Pressable
                  style={({ pressed }) => [styles.manualSaveButton, pressed && styles.buttonPressed]}
                  onPress={() => saveLog(selected)}
                  accessibilityRole="button"
                >
                  <ThemedText variant="headline" style={styles.primaryButtonText}>
                    기록하기
                  </ThemedText>
                </Pressable>
              </>
            )}
          </Card>
        </>
      )}

      {mode === 'photo' && (
        <>
      <Card>
        <ThemedText variant="headline" style={styles.cardTitle}>
          사진으로 분석 (AI)
        </ThemedText>
        <ThemedText variant="body" style={styles.cardBody}>
          음식 사진을 올리면 성분을 인식하고, 식후 혈당 변화와 먹는 순서 가이드를 알려드려요.
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
              <Skeleton width="100%" height={140} />
              <Skeleton width="60%" height={14} />
            </View>
          </Card>
        ) : prediction ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              식후 혈당 예측
            </ThemedText>
            <BloodSugarChart labels={chartLabels} values={chartValues} />
            <ThemedText variant="caption" style={styles.chartCaption}>
              최고 {prediction.peakMgDl} mg/dL · 공복 {prediction.base} 기준
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

      {/* 혈당 관리 먹는 순서 가이드 */}
      <AnimatedSection onHeightDelta={handleHeightDelta}>
        {loading ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              혈당 관리 먹는 순서 가이드
            </ThemedText>
            <View style={styles.skeletonStack}>
              <Skeleton width="100%" height={14} />
              <Skeleton width="85%" height={14} />
            </View>
          </Card>
        ) : combination ? (
          <Card>
            <ThemedText variant="headline" style={styles.cardTitle}>
              혈당 관리 먹는 순서 가이드
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
            onPress={() => saveLog(items)}
            accessibilityRole="button"
          >
            <ThemedText variant="headline" style={styles.primaryButtonText}>
              이 기록 저장하기
            </ThemedText>
          </Pressable>
        </AnimatedSection>
      )}
        </>
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
  chartCaption: { color: colors.sub, marginTop: spacing.xs },
  recipeBlock: { gap: spacing.xs, marginTop: spacing.sm },
  recipeTitle: { color: colors.text },
  skeletonStack: { gap: spacing.sm },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  moreText: { color: colors.primary, fontWeight: '600' },
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  segmentActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  segmentText: { color: colors.sub },
  segmentTextActive: { color: colors.primary, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: { flex: 1, color: colors.text, fontSize: type.body.fontSize, paddingVertical: 0 },
  resultList: { gap: spacing.xs },
  emptyText: { color: colors.sub, paddingVertical: spacing.sm },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  selectedLeft: { flex: 1 },
  selectedName: { color: colors.text },
  itemDelta: { fontWeight: '600' },
  stepper: { flexDirection: 'row', gap: spacing.xs },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
});
