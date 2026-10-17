// NIM 프록시 API 라우트 — POST /api/nim
// 개발 서버(npm start) 안에서 실행 → 별도 프록시 프로세스 불필요, 같은 origin이라 CORS 없음
// 키는 서버 전용(클라이언트 번들 미포함). 배포 시에도 이 라우트가 서버로 함께 배포됨
const NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export async function POST(request) {
  const key = process.env.EXPO_PUBLIC_NVIDIA_API_KEY;
  if (!key) {
    return Response.json({ error: 'NIM API 키가 설정되지 않았습니다 (app/.env)' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 JSON 본문' }, { status: 400 });
  }

  try {
    const upstream = await fetch(NIM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return Response.json({ error: 'NIM 호출 실패', detail: String(e) }, { status: 502 });
  }
}
