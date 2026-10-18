// AI 연동 — NVIDIA NIM (glm-5.3-flash) 백엔드 (2026-10-18: OpenRouter 시도 후 원복)
// NIM 멀티모달 제약 체크포인트 (사용자 가이드 반영 — 현재 코드는 모두 충족):
//   1) base64에 MIME 접두사 필수: data:image/jpeg;base64,... (analyzeFoodPhoto에서 구성)
//   2) 이미지는 JPEG + 800px 리사이즈 (food-log의 toBase64ForAI가 처리 — PNG/WebP/HEIC 금지)
//   3) 비전 지원 모델만 이미지 입력 가능 — glm-5.3-flash는 멀티모달 지원 확인됨
// 알려진 이슈: GLM 비전은 추론이 30초에 근접하면 NIM 게이트웨이가 502/타임아웃으로 끊는 것이
//   간헐 재현됨(밤 시간대) → analyzeFoodPhoto에서 실패 시 llama-3.2-11b-vision으로 자동 폴백
// 웹은 같은 origin의 API 라우트(/api/nim) 경유 — 키는 서버 전용, CORS 없음
// 네이티브(Expo Go)는 NIM 직접 호출 + app/.env 키
const NIM_ROUTE = '/api/nim';
const NIM_DIRECT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FOOD_VISION_MODEL = 'z-ai/glm-5.3-flash';
const FOOD_VISION_FALLBACK_MODEL = 'meta/llama-3.2-11b-vision-instruct';
const TEXT_MODEL = 'z-ai/glm-5.3-flash';
const PROFILE_MODEL = 'z-ai/glm-5.3-flash';
// 루틴 계획 전용 — glm-5.3-flash는 2000토큰급 JSON 생성 시 NIM 게이트웨이 30초 한계 502 빈번(밤 시간대)
// → llama-3.2-11b-vision(텍스트 모드)이 15.4초로 빠르고 JSON·한국어·어미 준수 확인됨 (2026-10-18 실측)
// 실패 시 glm-5.3-flash로 1회 폴백
const ROUTINE_MODEL = 'meta/llama-3.2-11b-vision-instruct';

// llama-3.2 폴백 전용 시스템 프롬프트 — 11b 모델이 완성 음식 사진을 재료로 오판하는 문제 대응:
// dish/ingredients 판정 기준을 명시하고 애매하면 dish로 강제한다 (재료 오판 시 레시피 분기로 빠지는 피해가 큼)
const FALLBACK_VISION_SYSTEM =
  '당신은 혈당 관리 앱의 음식 분석 API다. 요청된 형식의 JSON만 출력한다. ' +
  'kind 판정 기준: 조리·가공이 끝나 바로 먹을 수 있는 음식이나 음료(밥, 국, 볶음, 튀김, 빵, 김밥, 커피 등)가 ' +
  '사진에 하나라도 보이면 반드시 "dish"다. 완성 음식과 재료가 함께 보여도 "dish"다. ' +
  '조리 전 날것 재료(생채소, 생고기, 과일 등)만 찍힌 사진일 때만 "ingredients"다. ' +
  '판단이 애매하면 무조건 "dish"로 분류한다.';

function extractContentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => p?.text || '').join('');
  return '';
}

// 문장 단위 절단 — 모델이 길게 답해도 최대 maxSentences개 문장만 유지
function limitSentences(text, maxSentences = 2) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const sentences = trimmed.match(/[^.!?…]+[.!?…]+["']?|[^.!?…]+$/g) || [trimmed];
  return sentences.slice(0, maxSentences).join(' ').trim();
}

// 모델이 JSON이 아닌 텍스트를 반환해도 절대 throw하지 않음
// 잘린 응답(반복 생성 중 max_tokens 소진)도 완결된 항목 객체를 개별 복구해 살린다
function parseAnalysis(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return { items: [], advice: '', kind: 'dish' };
  const candidate = raw.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate);
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      advice: typeof parsed?.advice === 'string' ? parsed.advice : '',
      kind: parsed?.kind === 'ingredients' ? 'ingredients' : 'dish',
    };
  } catch (e) {
    console.warn('AI 응답이 JSON이 아님 — 잘린 응답 복구 시도');
  }
  // 복구: {…} 객체만 골라 개별 파싱 (items 배열이 닫히지 않은 경우)
  try {
    const itemMatches = candidate.match(/\{[^{}]*\}/g) || [];
    const items = itemMatches
      .map((m) => {
        try {
          return JSON.parse(m);
        } catch {
          return null;
        }
      })
      .filter((it) => it && typeof it.name === 'string');
    if (items.length > 0) {
      console.warn('잘린 AI 응답 복구 성공 — 항목', items.length, '개');
      return { items, advice: '', kind: 'dish' };
    }
  } catch (e) {
    console.warn('AI 응답 복구 실패:', e);
  }
  return { items: [], advice: '', kind: 'dish' };
}

// NIM chat/completions 공통 호출 → content 텍스트 | null
async function nimChat({ model, messages, temperature = 0.2, maxTokens = 800 }) {
  const isWeb = typeof window !== 'undefined';
  const key = process.env.EXPO_PUBLIC_NVIDIA_API_KEY;
  if (!isWeb && !key) {
    console.warn('EXPO_PUBLIC_NVIDIA_API_KEY 없음 — app/.env 확인 후 개발 서버 재시작');
    return null;
  }
  try {
    const res = await fetch(isWeb ? NIM_ROUTE : NIM_DIRECT_URL, {
      method: 'POST',
      headers: isWeb
        ? { 'Content-Type': 'application/json; charset=utf-8' } // charset 생략 시 개발 서버 파서가 415/502 반환
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
// 1순위 GLM-5.3-flash(품질 최고) → 실패 시 llama-3.2-11b-vision 자동 폴백 (게이트웨이 타임아웃 대응)
export async function analyzeFoodPhoto(base64Image) {
  if (!base64Image) return null;

  const userPrompt =
    '이 사진의 음식을 분석해서 아래 JSON 형식으로만 답해. 설명이나 마크다운 없이 JSON 한 개만. ' +
    'items에는 보이는 음식/음료 각각의 한국어 이름(name), 1인분 기준 대략적 개수(servings, 소수 가능), ' +
    '1인분 기준 예상 칼로리(kcal), 1인분 기준 예상 탄수화물 그램(carbs)을 넣어라. ' +
    '사진에 없는 음식은 넣지 마라. ' +
    'kind에는 사진이 조리 전 식재료면 "ingredients", 완성된 음식이면 "dish"를 넣어라. ' +
    'items는 최대 10개로 제한하고 같은 음식을 절대 반복하지 마라. ' +
    'advice에는 혈당 관리 관점에서 이 식사에 대한 조언을 최대 2문장으로, 간결하게. ' +
    '형식: {"kind":"dish","items":[{"name":"음식명","servings":1,"kcal":300,"carbs":40}],"advice":"조언"}. ' +
    '먹을 수 있는 게 없으면 items를 비우고 advice는 빈 문자열로 둬라. 조언은 음식이 확인될 때만 작성해라.';

  const buildMessages = (system) => [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        // NIM 요구: base64에는 반드시 MIME 접두사(data:image/jpeg;base64,) 포함
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
      ],
    },
  ];

  // 1순위: GLM-5.3-flash (한국어·성분 추정 품질 최고)
  let raw = await nimChat({
    model: FOOD_VISION_MODEL,
    maxTokens: 3000, // 추론 모델 — 낮으면 잘림(finish=length)
    messages: buildMessages('당신은 혈당 관리 앱의 음식 분석 API다. 사진 속 음식을 확인하고 JSON만 출력한다.'),
  });

  // 2순위 폴백: GLM 실패(게이트웨이 502/타임아웃 등) → llama-3.2-11b-vision (빠르고 안정)
  if (!raw) {
    console.warn('GLM 비전 실패 — llama-3.2-11b-vision 폴백 사용');
    raw = await nimChat({
      model: FOOD_VISION_FALLBACK_MODEL,
      maxTokens: 500, // 비-추론 모델 — 반복 생성 잘림은 parseAnalysis 복구로 흡수
      messages: buildMessages(FALLBACK_VISION_SYSTEM),
    });
  }

  // 최후 재시도 — NIM 무료 티어의 지연 요동(30초 전후 502) 흡수 (2초 대기 후 1회)
  if (!raw) {
    await new Promise((r) => setTimeout(r, 2000));
    console.warn('11b 폴백 재시도');
    raw = await nimChat({
      model: FOOD_VISION_FALLBACK_MODEL,
      maxTokens: 500,
      messages: buildMessages(FALLBACK_VISION_SYSTEM),
    });
  }

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
    `수면 ${answers.sleep}시간${answers.activity ? `, 활동 수준 ${answers.activity}` : ''}${answers.stress ? `, 스트레스 ${answers.stress}` : ''}`,
    `식사 후 반응: ${answers.mealReactions}`,
    `탄수화물 민감도 ${answers.carbSensitivity}${answers.familyHistory !== undefined ? `, 당뇨 가족력 ${answers.familyHistory ? '있음' : '없음'}` : ''}`,
    ...(answers.weightGoal || answers.goalPeriod
      ? [`목표: 체중 ${answers.weightGoal}, 기간 ${answers.goalPeriod}`]
      : []),
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

// 설정 + 사용자 직접 계획 + 기본 룰 → AI 맞춤 하루 루틴 생성 | null (실패 시 호출측이 룰 기본안 표시)
export async function generateRoutinePlan({ wakeTime, bedTime, customPlans = [], surveyAnswers = {}, baseline = [] }) {
  const baselineLines = baseline.map((s) => `${s.time} ${s.title}`).join(', ') || '없음';
  const customLines = customPlans.length > 0 ? customPlans.map((p) => `${p.time} ${p.title}`).join(', ') : '없음';
  const survey = surveyAnswers || {};
  const facts = `활동 수준 ${survey.activity || '보통'}, 민감도 ${survey.carbSensitivity || '보통'}, 목표 ${survey.weightGoal || '유지'}.`;
  const prompt =
    `기상 ${wakeTime}, 취침 ${bedTime}. 사용자가 직접 추가한 계획: ${customLines}. (이 시간과 제목은 반드시 포함) ` +
    `기본 룰 루틴(참고용): ${baselineLines}. ${facts} ` +
    '이 정보로 혈당 관리에 맞춘 하루 시간표를 만들어. 식사·혈당 측정(식후 30분과 2시간)·산책·수면을 배치하고, ' +
    '사용자 계획 시간과 겹치지 않게 조정해. 같은 항목을 반복하지 마라. ' +
    '각 항목은 time(HH:MM), type(meal|glucose|exercise|sleep|wake|custom|snack), title(짧게), desc(1문장)이고 시간순 정렬 20개 이하. ' +
    'comment는 루틴 총평 1~2문장(존댓말, "사용자"라는 단어 금지). 설명 없이 JSON만: ' +
    '{"schedule":[{"time":"07:30","type":"meal","title":"아침 식사","desc":"채소와 단백질을 먼저"}],"comment":"..."}';

  let raw = await nimChat({
    model: ROUTINE_MODEL,
    temperature: 0.5,
    maxTokens: 1000, // 비-추론 모델 — 시간표 JSON에 충분
    messages: [
      { role: 'system', content: '당신은 혈당 관리 건강 코치다. 요청된 형식의 JSON만 출력한다.' },
      { role: 'user', content: prompt },
    ],
  });

  // 폴백: 11b 실패 시 glm-5.3-flash 1회 (품질 우선 시 수동 재시도)
  if (!raw) {
    console.warn('루틴 생성 실패 — glm-5.3-flash 폴백 사용');
    raw = await nimChat({
      model: PROFILE_MODEL,
      temperature: 0.5,
      maxTokens: 2000,
      messages: [
        { role: 'system', content: '당신은 혈당 관리 건강 코치다. 요청된 형식의 JSON만 출력한다.' },
        { role: 'user', content: prompt },
      ],
    });
  }
  if (!raw) return null;

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const TYPES = new Set(['meal', 'glucose', 'exercise', 'sleep', 'wake', 'custom', 'snack']);
  const normalizeSchedule = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((s) => s && TIME_RE.test(String(s.time || '')) && s.title)
      .map((s) => ({
        time: String(s.time),
        type: TYPES.has(s.type) ? s.type : 'custom',
        title: String(s.title).trim(),
        desc: limitSentences(s.desc, 1),
      }))
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 20);

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const schedule = normalizeSchedule(parsed?.schedule);
    if (schedule.length === 0) return null;
    return { schedule, comment: limitSentences(parsed?.comment, 2) || null };
  } catch (e) {
    // 잘린 응답 복구 — 완결된 항목 객체만 개별 추출 (반복 생성 중 max_tokens로 잘린 경우)
    console.warn('루틴 생성 응답이 JSON이 아님 — 잘린 응답 복구 시도');
    const schedule = normalizeSchedule(
      (raw.match(/\{[^{}]*\}/g) || [])
        .map((m) => {
          try {
            return JSON.parse(m);
          } catch {
            return null;
          }
        })
        .filter((s) => s && s.time && s.title)
    );
    if (schedule.length === 0) return null;
    return { schedule, comment: null };
  }
}

// 재료 구성 → 혈당 스파이크가 적은 레시피 2개 | null (실패 시 호출측이 룰 기반 조합만 표시)
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
  const parseRecipe = (m) => {
    try {
      const r = JSON.parse(m);
      if (!r || !r.title) return null;
      return {
        title: String(r.title).trim(),
        ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(String).slice(0, 5) : [],
        desc: limitSentences(r.desc, 1),
        how: limitSentences(r.how, 2),
      };
    } catch {
      return null;
    }
  };

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed?.recipes)) return null;
    const recipes = parsed.recipes.map(parseRecipe).filter(Boolean).slice(0, 3);
    return recipes.length > 0 ? recipes : null;
  } catch (e) {
    // 잘린 응답 복구 — 완결된 레시피 객체만 개별 추출 (반복 생성 중 잘린 경우)
    console.warn('레시피 응답이 JSON이 아님 — 잘린 응답 복구 시도');
    const recipes = (raw.match(/\{[^{}]*\}/g) || [])
      .map(parseRecipe)
      .filter(Boolean)
      .slice(0, 3);
    return recipes.length > 0 ? recipes : null;
  }
}
