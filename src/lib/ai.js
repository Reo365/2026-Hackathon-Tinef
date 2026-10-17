// NVIDIA NIM 연동 — GLM-5.3-Flash (일반 모델 + 비전) — 데모용
// 사진 인식(성분 추정) + 혈당 관리 조언 + 스파이크 완화 레시피 추천
// 인식 결과는 전부 AI 추정치로 통일 — 내장 DB 매핑 없음 (2026-10-17 사용자 결정)
// 주의: GLM은 추론 모델 → max_tokens 여유 필요(낮으면 잘림, finish=length).
//       추론은 reasoning_content 별도 필드 → content의 JSON만 파싱.
// 웹은 NIM CORS 차단 → 같은 origin의 API 라우트(/api/nim) 경유 (별도 프록시 불필요)
// 네이티브(Expo Go)는 NIM 직접 호출 + app/.env 키
const NIM_DIRECT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NIM_API_ROUTE = '/api/nim';
// 음식 인식(비전)과 텍스트 생성(레시피)은 용도별로 모델 분리
// 검증 결과(2026-10-17, 비빔밥 실사진): glm-5.3-flash가 한국어 음식명·성분·조언 모두 최고.
// llama-3.2-11b(로마자 응답·지시 미준수), 90b(타임아웃), nemotron-vl(추론 토큰 소진),
// gemma-3-12b(계정 미개설 404), gemma-4-31b(502) → glm-5.3-flash가 유일하게 전 항목 통과
const FOOD_VISION_MODEL = 'z-ai/glm-5.3-flash';
const TEXT_MODEL = 'z-ai/glm-5.3-flash';
// AI 맞춤 분석용 — glm-5.3-flash (한국어 품질 최고, 추론으로 ~20초)
const PROFILE_MODEL = 'z-ai/glm-5.3-flash';

function extractContentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => p?.text || '').join('');
  return '';
}

// 모델이 JSON이 아닌 텍스트를 반환해도 절대 throw하지 않음
function parseAnalysis(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return { items: [], advice: '' };
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      advice: typeof parsed?.advice === 'string' ? parsed.advice : '',
      kind: parsed?.kind === 'ingredients' ? 'ingredients' : 'dish',
    };
  } catch (e) {
    console.warn('AI 응답이 JSON이 아님:', raw);
    return { items: [], advice: '' };
  }
}

// 문장 단위 절단 — 모델이 길게 답해도 최대 maxSentences개 문장만 유지
function limitSentences(text, maxSentences = 2) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const sentences = trimmed.match(/[^.!?…]+[.!?…]+["']?|[^.!?…]+$/g) || [trimmed];
  return sentences.slice(0, maxSentences).join(' ').trim();
}

// NIM chat/completions 공통 호출 → content 텍스트 | null
async function nimChat({ model, messages, temperature = 0.2, maxTokens = 3000 }) {
  const isWeb = typeof window !== 'undefined';
  const key = process.env.EXPO_PUBLIC_NVIDIA_API_KEY;
  if (!isWeb && !key) {
    console.warn('EXPO_PUBLIC_NVIDIA_API_KEY 없음 — app/.env 확인 후 개발 서버 재시작');
    return null;
  }
  try {
    const res = await fetch(isWeb ? NIM_API_ROUTE : NIM_DIRECT_URL, {
      method: 'POST',
      headers: isWeb
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
      }),
    });
    if (!res.ok) {
      console.warn('NIM 응답 오류:', res.status);
      return null;
    }
    const data = await res.json();
    return extractContentText(data?.choices?.[0]?.message?.content);
  } catch (e) {
    console.warn('NIM 호출 실패:', e);
    return null;
  }
}

// 사진 → { kind: 'ingredients'|'dish', items: [{ name, servings, kcal, carbs }], advice } | null
// 전 항목 AI 추정치 — 성분(kcal·carbs)도 모델이 제공
export async function analyzeFoodPhoto(base64Image) {
  if (!base64Image) return null;

  const userPrompt =
    '이 사진의 음식을 분석해서 아래 JSON 형식으로만 답해. 설명이나 마크다운 없이 JSON 한 개만. ' +
    'items에는 보이는 음식/음료 각각의 한국어 이름(name), 1인분 기준 대략적 개수(servings, 소수 가능), ' +
    '1인분 기준 예상 칼로리(kcal), 1인분 기준 예상 탄수화물 그램(carbs)을 넣어라. ' +
    'kind에는 사진이 조리 전 식재료면 "ingredients", 완성된 음식이면 "dish"를 넣어라. ' +
    '사진에 없는 음식은 넣지 마라. ' +
    'advice에는 혈당 관리 관점에서 이 식사에 대한 조언을 최대 2문장으로, 간결하게. ' +
    '형식: {"kind":"dish","items":[{"name":"음식명","servings":1,"kcal":300,"carbs":40}],"advice":"조언"}. ' +
    '먹을 수 있는 게 없으면 items를 비우고 advice는 빈 문자열로 둬라. 조언은 음식이 확인될 때만 작성해라.';

  const raw = await nimChat({
    model: FOOD_VISION_MODEL,
    maxTokens: 3000, // GLM 추론 모델 — 낮으면 잘림(finish=length)
    messages: [
      { role: 'system', content: '당신은 혈당 관리 앱의 음식 분석 API다. 사진 속 음식을 확인하고 JSON만 출력한다.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ],
  });
  if (!raw) return null;

  const analysis = parseAnalysis(raw);
  const items = analysis.items
    .filter((entry) => entry && entry.name)
    .map((entry) => ({
      name: String(entry.name),
      servings: Number(entry.servings) || 1,
      kcal: Number(entry.kcal) || 0,
      carbs: Number(entry.carbs) || 0,
    }));
  return { kind: analysis.kind, items, advice: limitSentences(analysis.advice, 2) };
}

// 설문 답변 + 계산 결과 → 사용자 특성 맞춤 분석 | null (실패 시 호출측이 룰 기반 문구 사용)
export async function analyzeProfile(answers, analysis) {
  if (!answers) return null;
  const facts = [
    `나이 ${answers.age}, ${answers.gender}성, 키 ${answers.height}cm 몸무게 ${answers.weight}kg`,
    `BMI ${analysis?.bmi ?? '미계산'}(${analysis?.bmiLabel ?? '-'})`,
    `활동 수준 ${answers.activity}, 수면 ${answers.sleep}시간, 스트레스 ${answers.stress}`,
    `식사 후 반응: ${answers.mealReactions}`,
    `탄수화물 민감도 ${answers.carbSensitivity}, 당뇨 가족력 ${answers.familyHistory ? '있음' : '없음'}`,
    `목표: 체중 ${answers.weightGoal}, 기간 ${answers.goalPeriod}`,
    `계산값: 기초대사량 ${analysis?.bmr}, 하루 소비 ${analysis?.tdee}, 목표 칼로리 ${analysis?.targetCalories}kcal, 탄수화물 목표 ${analysis?.carbTarget}g`,
  ].join('. ');
  const prompt =
    '아래 정보는 앱 사용자 본인의 정보다. 앱이 사용자에게 직접 말하듯 분석해. ' +
    'summary는 혈당 관리 특성 요약 1문장으로, 존댓말("~예요/입니다")로 작성하고 "사용자"라는 단어를 쓰지 말 것. ' +
    'strengths는 유리한 점(최대 2개, 각 1문장)으로 반드시 "~해야 함" 어미로 작성(예: "정상 체중을 유지해야 함")하고 "사용자"라는 단어를 쓰지 말 것. ' +
    'warnings는 주의할 점(최대 2개, 각 1문장)으로 반드시 "~해야 함" 어미로 끝낼 것. ' +
    '설명 없이 JSON만: {"summary":"...","strengths":["정상 체중을 유지해야 함"],"warnings":["수면을 7시간 이상으로 늘려야 함"]}';

  const raw = await nimChat({
    model: PROFILE_MODEL,
    temperature: 0.4,
    maxTokens: 2000,
    messages: [
      { role: 'system', content: '당신은 혈당 관리 건강 코치다. 요청된 형식의 JSON만 출력한다.' },
      { role: 'user', content: `${facts}. ${prompt}` },
    ],
  });
  if (!raw) return null;

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const list = (v) => (Array.isArray(v) ? v.map((x) => limitSentences(x, 1)).filter(Boolean).slice(0, 2) : []);
    return {
      summary: limitSentences(parsed?.summary, 1),
      strengths: list(parsed?.strengths),
      warnings: list(parsed?.warnings),
    };
  } catch (e) {
    console.warn('프로필 분석 응답이 JSON이 아님:', raw);
    return null;
  }
}

// 식사 구성 → 혈당 스파이크가 적은 조합(레시피) 2개 | null
// 텍스트 전용 호출 — 사진 없이도 동작, 실패 시 호출측이 룰 기반 조합만 표시
export async function suggestRecipes(itemNames, surveyAnswers) {
  if (!itemNames || itemNames.length === 0) return null;
  const sensitivity = surveyAnswers?.carbSensitivity || '보통';
  const prompt =
    `사용 가능한 재료: ${itemNames.join(', ')}. 사용자의 탄수화물 민감도: ${sensitivity}. ` +
    '이 재료들로 만들 수 있는 혈당 스파이크가 낮은 레시피 2개를 제안해. ' +
    '각 레시피는 짧은 이름(title), 필요한 재료 목록(ingredients, 최대 5개), 레시피 소개(desc, 1문장), 만드는 법 요약(how, 1~2문장)로 담아. ' +
    '조리 단계로 나누지 말고 desc와 how로 간결하게 설명해라. ' +
    '없는 재료를 추가하지 말고, 소금·기름 같은 기본 양념은 재료에서 생략해도 된다. ' +
    '설명 없이 JSON만: {"recipes":[{"title":"레시피명","ingredients":["재료","재료"],"desc":"어떤 레시피인지 1문장","how":"만드는 법 1~2문장"}]}';

  const raw = await nimChat({
    model: TEXT_MODEL,
    temperature: 0.4,
    maxTokens: 2000,
    messages: [
      { role: 'system', content: '당신은 혈당 관리 영양사다. 요청된 형식의 JSON만 출력한다.' },
      { role: 'user', content: prompt },
    ],
  });
  if (!raw) return null;

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed?.recipes)) return null;
    return parsed.recipes
      .filter((r) => r && r.title)
      .slice(0, 3)
      .map((r) => ({
        title: String(r.title || '').trim(),
        ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(String).slice(0, 5) : [],
        desc: limitSentences(r.desc, 1),
        how: limitSentences(r.how, 2),
      }));
  } catch (e) {
    console.warn('레시피 응답이 JSON이 아님:', raw);
    return null;
  }
}
