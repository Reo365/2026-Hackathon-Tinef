// 식약처(공공데이터포털) 음식 검색 + 앱 형식 번역기 — 팀장 승인 2026-10-18
// 웹: /api/food-search 프록시(키 서버 전용) / 네이티브: data.go.kr 직접 호출(app/.env 키)
//   → ai.js의 NIM 호출과 동일한 2경로 패턴
// 출력은 rules.predictGlucose의 'AI 추정 항목' 경로({ name, carbs, giFactor })로 그대로 소비 가능
//   → rules.js / fooddb.js 수정 없이 37종 밖 음식도 예측 가능
// 영양성분 필드 매핑은 2026-10 실측 기준:
//   AMT_NUM1=에너지(kcal) 3=단백질 4=지방 6=탄수화물 7=당류 13=나트륨 (기준량 SERVING_SIZE, 보통 100g)
import { Platform } from 'react-native';
import { get, set } from './storage';

const MFDS_URL = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03';
const SEARCH_ROUTE = '/api/food-search';

// 파라미터 이름은 여기 한 곳에서만 정의 — 오타 시 에러 없이 전체 DB가 반환되므로
const PARAM = {
  SERVICE_KEY: 'serviceKey',
  TYPE: 'type',
  PAGE_NO: 'pageNo',
  NUM_OF_ROWS: 'numOfRows',
  FOOD_NM_KR: 'FOOD_NM_KR',
};

const DEFAULT_GI_FACTOR = 0.8; // 식약처 DB에 GI 없음 → rules.js 기본 계수와 동일값
const FETCH_ROWS = 50; // 관련도 정렬이 없어 정확일치가 뒤에 있을 수 있음(실측 함정 2) → 넉넉히 받고 정렬
const CACHE_KEY = 'mfds_food_cache_v3'; // TODO: storage.js KEYS로 이관 제안(팀장 보고 항목)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 50;
const SYNONYMS = { 자장면: '짜장면', 감자탕: '해장국' };

function squash(s) {
  return String(s || '').replace(/\s+/g, '');
}

// 응답 값 특성(실측): 전부 문자열, 빈 값 "", 3자리 콤마 포함("1,670.000")
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// '사과 1개' → '사과', '맥주 500ml' → '맥주' (수량·단위 제거)
function stripQuantity(keyword) {
  return String(keyword || '')
    .replace(/\s*\d+(\.\d+)?\s*(kg|g|ml|l|개|인분|공기|그릇|접시|조각|캔|잔|봉|팩|줄)*\s*$/i, '')
    .trim();
}

// 출처 구별 — 같은 이름의 음식이 여러 건일 때(예: 음식 마라탕 vs 가공식품 '마라탕' 라면) 판단용
//   품목대표 = 표준 조리 기준값(음식점 일반 조리) / 상용제품 = 실제 판매 제품(간편조리세트 등)
function sourceSuffixOf(row) {
  if (row.DB_GRP_NM === '가공식품') return '가공식품';
  if (row.DB_CLASS_NM === '품목대표') return '일반 조리';
  if (row.DB_CLASS_NM === '상용제품') return '시판 제품';
  return '';
}

// 식약처 row → 앱 음식 형식 (predictGlucose가 바로 계산 가능한 모양)
function toAppItem(row) {
  const suffix = sourceSuffixOf(row);
  return {
    source: 'mfds',
    foodCd: row.FOOD_CD || null,
    name: row.FOOD_NM_KR,
    // 검색 목록에서 바로 구별되도록 이름에 출처를 괄호로 표기 (마라탕(일반 조리) 등)
    displayName: suffix ? `${row.FOOD_NM_KR}(${suffix})` : row.FOOD_NM_KR,
    serving: row.SERVING_SIZE || '100g',
    kcal: num(row.AMT_NUM1),
    carbs: num(row.AMT_NUM6),
    sugar: num(row.AMT_NUM7),
    protein: num(row.AMT_NUM3),
    fat: num(row.AMT_NUM4),
    sodium: num(row.AMT_NUM13),
    giFactor: DEFAULT_GI_FACTOR,
    group: row.DB_GRP_NM || null,
    dbClass: row.DB_CLASS_NM || null,
    category: row.FOOD_CAT1_NM || null,
    sourceLabel: suffix ? `식약처 · ${suffix}` : '식약처',
  };
}

// 관련도 정렬: 정확일치 > 완성 요리(음식) 우선 > 접두일치 > 포함(이름 짧은 순)
// 같은 이름의 정확일치가 여러 건이어도(예: 음식 마라탕 vs 가공식품 '마라탕' 라면) 순서가 일관되도록 키를 고정
function rank(a, b, norm) {
  const an = squash(a.name);
  const bn = squash(b.name);
  const aExact = an === norm ? 0 : 1;
  const bExact = bn === norm ? 0 : 1;
  if (aExact !== bExact) return aExact - bExact;
  const aFood = a.group === '음식' ? 0 : 1;
  const bFood = b.group === '음식' ? 0 : 1;
  if (aFood !== bFood) return aFood - bFood;
  const ap = an.startsWith(norm) ? 0 : 1;
  const bp = bn.startsWith(norm) ? 0 : 1;
  if (ap !== bp) return ap - bp;
  return an.length - bn.length;
}

// row 정렬 + 중복 제거(같은 음식이 여러 연도 데이터로 존재)
function dedupe(items) {
  const seen = new Set();
  return items.filter((it) => {
    const key = `${it.name}|${it.kcal}|${it.carbs}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 원시 row 목록 가져오기 — 웹은 프록시, 네이티브는 직접 호출
async function fetchRows(keyword) {
  if (Platform.OS === 'web') {
    const res = await fetch(`${SEARCH_ROUTE}?keyword=${encodeURIComponent(keyword)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  }

  const key = process.env.EXPO_PUBLIC_MFDS_API_KEY;
  if (!key) return [];
  // RN에는 URLSearchParams가 없을 수 있어 수동 조립 — encodeURIComponent로 한글 처리
  const qs = [
    `${PARAM.SERVICE_KEY}=${encodeURIComponent(key)}`,
    `${PARAM.TYPE}=json`,
    `${PARAM.PAGE_NO}=1`,
    `${PARAM.NUM_OF_ROWS}=${FETCH_ROWS}`,
    `${PARAM.FOOD_NM_KR}=${encodeURIComponent(keyword)}`,
  ].join('&');
  const res = await fetch(`${MFDS_URL}?${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  const header = data.header || {};
  if (header.resultCode && header.resultCode !== '00') return [];
  const norm = squash(keyword);
  return ((data.body || {}).items || []).filter((row) => squash(row.FOOD_NM_KR).includes(norm));
}

// 검색 → [{ source:'mfds', name, serving, kcal, carbs, sugar, protein, fat, sodium, giFactor, ... }]
// 실패·0건은 항상 [] — 화면은 직접 입력 폼 등 폴백 처리
export async function searchFoods(keyword, options = {}) {
  const limit = options.limit || 10;
  const kw = stripQuantity(keyword);
  if (!kw) return [];

  // 캐시(1일) — 동일 검색어 재검색 시 API 호출 절약
  const cache = (await get(CACHE_KEY)) || {};
  const hit = cache[kw];
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.items.slice(0, limit);
  }

  let rows = [];
  try {
    rows = await fetchRows(kw);
  } catch {
    rows = [];
  }

  // 0건이면 동의어로 1회만 재시도 (일일 호출 한도 보호)
  if (rows.length === 0 && SYNONYMS[kw]) {
    try {
      rows = await fetchRows(SYNONYMS[kw]);
    } catch {
      rows = [];
    }
  }

  // 탄수화물 미측정(빈 값) 행 제거 — 예측에 사용 불가
  const items = dedupe(rows.map(toAppItem))
    .filter((it) => it.carbs !== null)
    .sort((a, b) => rank(a, b, squash(kw)))
    .slice(0, CACHE_MAX);

  const keys = Object.keys(cache);
  if (keys.length >= CACHE_MAX) {
    for (const k of keys.slice(0, keys.length - CACHE_MAX + 1)) delete cache[k];
  }
  cache[kw] = { ts: Date.now(), items };
  await set(CACHE_KEY, cache);

  return items.slice(0, limit);
}
