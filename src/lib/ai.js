// NVIDIA NIM 연동 — GLM-5.3-Flash (일반 모델 + 비전) 단일 호출 — 데모용
// 사진 인식 + 혈당 관리 조언을 시스템 프롬프트로 한 번에 받음 (2026-10-17 실사진 검증)
// 주의: GLM은 추론 모델 → max_tokens 3000 필요(낮으면 잘림, finish=length).
//       추론은 reasoning_content 별도 필드 → content의 JSON만 파싱.
// 웹은 NIM CORS 차단(프리플라이트 ACAO 없음) → nim-proxy.js(8787) 경유
// 네이티브(Expo Go)는 NIM 직접 호출 + app/.env 키. 실서비스 전환 시 프록시를 서버에 올림 (Plan.md 5장)
import { Platform } from 'react-native';
import { FOODS } from './fooddb';

const NIM_DIRECT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NIM_PROXY_URL = 'http://localhost:8787/nim';
const MODEL_ID = 'z-ai/glm-5.3-flash';
const MAX_TOKENS = 3000;

const SYSTEM_PROMPT =
  '당신은 혈당 관리 앱의 음식 분석 API다. 사진 속 음식을 확인하고 JSON만 출력한다.';

const USER_PROMPT =
  '이 사진의 음식을 분석해서 아래 JSON 형식으로만 답해. 설명이나 마크다운 없이 JSON 한 개만. ' +
  'items에는 보이는 음식/음료 각각의 한국어 이름(name), 1인분 기준 대략적 개수(servings, 소수 가능), ' +
  '1인분 기준 예상 칼로리(kcal), 1인분 기준 예상 탄수화물 그램(carbs)을 넣어라. ' +
  '사진에 없는 음식은 넣지 마라. ' +
  'advice에는 혈당 관리 관점에서 이 식사에 대한 조언을 2~3문장으로. ' +
  '형식: {"items":[{"name":"음식명","servings":1,"kcal":300,"carbs":40}],"advice":"조언"}. ' +
  '먹을 수 있는 게 없으면 items는 비우고 advice만 채워라.';

// 모델이 흔히 쓰는 한국어·로마자 음식명 → 내장 DB id
const ALIASES = {
  '밥': 'white-rice', '쌀밥': 'white-rice', '흰쌀밥': 'white-rice', 'rice': 'white-rice',
  '현미밥': 'brown-rice', '현미': 'brown-rice', 'brown rice': 'brown-rice',
  '계란': 'fried-egg', '달걀': 'fried-egg', '계란프라이': 'fried-egg', '달걀프라이': 'fried-egg',
  'gyeran': 'fried-egg', 'egg': 'fried-egg', 'fried egg': 'fried-egg',
  '닭가슴살': 'chicken-breast', '가슴살': 'chicken-breast', 'chicken breast': 'chicken-breast',
  '김치': 'kimchi-stew', '김치찌개': 'kimchi-stew', 'kimchi': 'kimchi-stew', 'kimchi jjigae': 'kimchi-stew',
  '배추김치': 'kimchi-stew',
  '된장': 'doenjang-stew', '된장찌개': 'doenjang-stew', 'doenjang': 'doenjang-stew',
  '비빔밥': 'bibimbap', 'bibimbap': 'bibimbap',
  '라면': 'ramyeon', '라면사리': 'ramyeon', 'ramyeon': 'ramyeon', 'ramen': 'ramyeon',
  '고구마': 'sweet-potato', 'sweet potato': 'sweet-potato',
  '바나나': 'banana', 'banana': 'banana', '사과': 'apple', 'apple': 'apple',
  '우유': 'milk', 'milk': 'milk',
  '브로콜리': 'broccoli', 'broccoli': 'broccoli',
  '시금치': 'spinach', '시금치나물': 'spinach', 'spinach': 'spinach', 'sigeumchi': 'spinach',
  '식빵': 'white-bread', '빵': 'white-bread', '토스트': 'white-bread', 'bread': 'white-bread', 'toast': 'white-bread',
  '커피': 'black-coffee', '아메리카노': 'black-coffee', '블랙커피': 'black-coffee',
  'coffee': 'black-coffee', 'americano': 'black-coffee',
  '치킨': 'fried-chicken', '후라이드치킨': 'fried-chicken', '후라이드 치킨': 'fried-chicken',
  '프라이드치킨': 'fried-chicken', '양념치킨': 'fried-chicken', 'fried chicken': 'fried-chicken',
  '피자': 'pizza', 'pizza': 'pizza',
  '떡볶이': 'tteokbokki', 'tteokbokki': 'tteokbokki',
  '김밥': 'gimbap', 'gimbap': 'gimbap',
  '돈까스': 'donkkaseu', '돈가스': 'donkkaseu', 'tonkatsu': 'donkkaseu',
  '짜장면': 'jjajangmyeon', '자장면': 'jjajangmyeon', 'jjajangmyeon': 'jjajangmyeon', 'jjajang': 'jjajangmyeon',
  '짬뽕': 'jjampong', 'jjampong': 'jjampong',
  '순두부': 'sundubu-jjigae', '순두부찌개': 'sundubu-jjigae', 'sundubu': 'sundubu-jjigae',
  '만두': 'dumpling', 'mandu': 'dumpling', 'dumpling': 'dumpling', '군만두': 'dumpling',
  '죽': 'juk', 'juk': 'juk', 'porridge': 'juk',
  '콜라': 'cola', 'cola': 'cola', '사이다': 'cola', '탄산음료': 'cola', 'coke': 'cola',
  '삼겹살': 'samgyeopsal', 'samgyeopsal': 'samgyeopsal', 'pork belly': 'samgyeopsal',
  '불고기': 'bulgogi', 'bulgogi': 'bulgogi',
  '제육': 'jeyuk-bokkeum', '제육볶음': 'jeyuk-bokkeum', 'jeyuk': 'jeyuk-bokkeum',
  '냉면': 'naengmyeon', 'naengmyeon': 'naengmyeon',
  '우동': 'udon', 'udon': 'udon',
  '볶음밥': 'kimchi-fried-rice', '김치볶음밥': 'kimchi-fried-rice', 'fried rice': 'kimchi-fried-rice',
  '햄버거': 'hamburger', 'burger': 'hamburger', 'hamburger': 'hamburger',
  '감자튀김': 'french-fries', 'french fries': 'french-fries', 'fries': 'french-fries',
  '카레': 'curry-rice', '카레라이스': 'curry-rice', 'curry': 'curry-rice',
  '계란찜': 'gyeranjjim', '달걀찜': 'gyeranjjim', 'steamed egg': 'gyeranjjim',
  '콩나물': 'spinach', '나물': 'spinach',
};

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
    };
  } catch (e) {
    console.warn('AI 응답이 JSON이 아님:', raw);
    return { items: [], advice: '' };
  }
}

// 사이드/부재료 — DB 매핑 금지 (부분일치 오매핑 방지, AI 추정 폴백으로 감)
const BLOCKLIST = ['치킨무', '단무지', '피클', '상추', '깻잎', '쌈장', '겉절이', '간장', '소스'];

function resolveFoodId(entry, allowedFoods) {
  const servings = Number(entry.servings) || 1;
  if (entry.foodId && allowedFoods.some((f) => f.id === entry.foodId)) {
    return { foodId: entry.foodId, servings };
  }
  const name = String(entry.name || '').trim();
  if (!name) return null;
  const lower = name.toLowerCase();

  // 사이드/부재료는 매핑하지 않음 → AI 추정 항목으로
  if (BLOCKLIST.some((b) => name.includes(b) || lower.includes(b))) return null;

  // 1) 별칭 정확 일치 (한국어/로마자)
  const aliasId = ALIASES[name] || ALIASES[lower];
  if (aliasId && allowedFoods.some((f) => f.id === aliasId)) return { foodId: aliasId, servings };
  // 2) DB 이름 정확 일치
  const exact = allowedFoods.find((f) => f.name === name);
  if (exact) return { foodId: exact.id, servings };
  // 3) 별칭 부분 일치 (예: "시금치나물" → 시금치)
  const aliasHit = Object.keys(ALIASES).find((k) => lower.includes(k) || name.includes(k));
  if (aliasHit) {
    const id = ALIASES[aliasHit];
    if (allowedFoods.some((f) => f.id === id)) return { foodId: id, servings };
  }
  // 4) DB 이름 포함 관계
  const fuzzy = allowedFoods.find((f) => f.name.includes(name) || name.includes(f.name));
  if (fuzzy) return { foodId: fuzzy.id, servings };
  return null;
}

// 사진 → { dbItems: [{foodId, servings}], aiItems: [{name, servings, kcal, carbs}], advice } | null(네트워크/키 실패)
// DB 우선: 이름이 내장 DB에 매핑되면 DB 값 사용, 없으면 AI 추정치로 폴백(호출측에서 AI 표시)
export async function analyzeFoodPhoto(base64Image, allowedFoods = FOODS) {
  if (!base64Image) return null;

  const isWeb = Platform.OS === 'web';
  const key = process.env.EXPO_PUBLIC_NVIDIA_API_KEY;
  if (!isWeb && !key) {
    console.warn('EXPO_PUBLIC_NVIDIA_API_KEY 없음 — app/.env 확인 후 개발 서버 재시작');
    return null;
  }

  try {
    const res = await fetch(isWeb ? NIM_PROXY_URL : NIM_DIRECT_URL, {
      method: 'POST',
      headers: isWeb
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL_ID,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: USER_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn('NIM 응답 오류:', res.status);
      return null;
    }
    const data = await res.json();
    const raw = extractContentText(data?.choices?.[0]?.message?.content);
    const analysis = parseAnalysis(raw);

    const dbItems = [];
    const aiItems = [];
    for (const entry of analysis.items) {
      const resolved = resolveFoodId(entry || {}, allowedFoods);
      if (resolved) dbItems.push(resolved);
      else if (entry?.name) {
        aiItems.push({
          name: String(entry.name),
          servings: Number(entry.servings) || 1,
          kcal: Number(entry.kcal) || 0,
          carbs: Number(entry.carbs) || 0,
        });
      }
    }
    return { dbItems, aiItems, advice: analysis.advice };
  } catch (e) {
    console.warn('NIM 호출 실패:', e);
    return null;
  }
}
