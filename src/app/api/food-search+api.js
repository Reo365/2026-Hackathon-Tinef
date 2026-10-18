// 식약처(공공데이터포털) 음식 검색 프록시 — GET /api/food-search?keyword=...
// 패턴은 api/nim+api.js와 동일: 키는 서버 전용(app/.env), 같은 origin이라 CORS 없음
// 엔드포인트: 식품의약품안전처_식품영양성분DB정보 (data.go.kr 15127578, 2026-10 실측)
//   https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03
// 필드: FOOD_NM_KR=식품명 SERVING_SIZE=기준량 AMT_NUM1=에너지 3=단백질 4=지방 6=탄수화물 7=당류 13=나트륨
const MFDS_URL = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03';

// 클라이언트로 내려보낼 필드만 선별 (파라미터 이름도 여기 한 곳에서만 정의)
const PARAM = {
  SERVICE_KEY: 'serviceKey',
  TYPE: 'type',
  PAGE_NO: 'pageNo',
  NUM_OF_ROWS: 'numOfRows',
  FOOD_NM_KR: 'FOOD_NM_KR',
};
const PICK_FIELDS = [
  'FOOD_CD',
  'FOOD_NM_KR',
  'SERVING_SIZE',
  'DB_GRP_NM',
  'DB_CLASS_NM',
  'FOOD_CAT1_NM',
  'MAKER_NM',
  'AMT_NUM1',
  'AMT_NUM3',
  'AMT_NUM4',
  'AMT_NUM6',
  'AMT_NUM7',
  'AMT_NUM13',
];
const MAX_ROWS = 50;

const squash = (s) => String(s || '').replace(/\s+/g, '');

export async function GET(request) {
  const key = process.env.EXPO_PUBLIC_MFDS_API_KEY;
  if (!key) {
    return Response.json({ error: '식약처 API 키가 설정되지 않았습니다 (app/.env)' }, { status: 500 });
  }

  const keyword = (new URL(request.url).searchParams.get('keyword') || '').trim();
  const norm = squash(keyword);
  if (!norm) {
    return Response.json({ error: 'keyword 파라미터가 필요합니다' }, { status: 400 });
  }

  try {
    const params = new URLSearchParams();
    params.set(PARAM.SERVICE_KEY, key);
    params.set(PARAM.TYPE, 'json');
    params.set(PARAM.PAGE_NO, '1');
    params.set(PARAM.NUM_OF_ROWS, String(MAX_ROWS));
    params.set(PARAM.FOOD_NM_KR, keyword);

    let upstream;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
      upstream = await fetch(`${MFDS_URL}?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
      if (upstream.status < 500) break; // 5xx만 재시도
    }
    if (!upstream.ok) {
      return Response.json({ error: '식약처 API 호출 실패', status: upstream.status }, { status: 502 });
    }

    let data;
    try {
      data = await upstream.json();
    } catch {
      return Response.json({ error: '식약처 API 응답이 JSON이 아닙니다 (키/서비스 오류 의심)' }, { status: 502 });
    }

    const header = data.header || {};
    if (header.resultCode && header.resultCode !== '00') {
      return Response.json({ error: `식약처 API 오류: ${header.resultMsg || header.resultCode}` }, { status: 502 });
    }

    // 검색어(공백 무시 비교)가 포함된 행만 통과 —
    // 파라미터가 무시되어 전체 DB(34만 건)가 반환되어도 여기서 0건으로 걸러짐 (실측 함정 1 방어)
    const rows = ((data.body || {}).items || []).filter((row) => squash(row.FOOD_NM_KR).includes(norm));
    const results = rows.map((row) => {
      const picked = {};
      for (const f of PICK_FIELDS) picked[f] = row[f];
      return picked;
    });

    return Response.json({ results, totalCount: (data.body || {}).totalCount ?? results.length });
  } catch (e) {
    return Response.json({ error: '식약처 API 호출 실패', detail: String(e) }, { status: 502 });
  }
}
