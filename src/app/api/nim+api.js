// NIM 프록시 API 라우트 — POST /api/nim
// 개발 서버(npm start) 안에서 실행 → 별도 프록시 프로세스 불필요, 같은 origin이라 CORS 없음
// 키는 서버 전용(클라이언트 번들 미포함). 배포 시에도 이 라우트가 서버로 함께 배포됨
// 본문은 request.json() 대신 text() 수동 파싱 — 미디어 타입 엄격 검사로 인한 415/502 방지
const NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export async function POST(request) {
  const key = process.env.EXPO_PUBLIC_NVIDIA_API_KEY;
  if (!key) {
    return Response.json({ error: 'NIM API 키가 설정되지 않았습니다 (app/.env)' }, { status: 500 });
  }

  let body;
  try {
    const raw = await request.text();
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: '잘못된 JSON 본문' }, { status: 400 });
  }

  try {
    // NIM 게이트웨이 일시 5xx 대비 1회 재시도 (짧은 대기 후)
    let upstream;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
      upstream = await fetch(NIM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      if (upstream.status < 500) break; // 5xx만 재시도
    }
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return Response.json({ error: 'NIM 호출 실패', detail: String(e) }, { status: 502 });
  }
}
