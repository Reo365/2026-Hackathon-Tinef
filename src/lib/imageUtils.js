// 이미지 전처리 — 어떤 입력이든 JPEG 800px base64로 강제 변환
// NIM 제약(사용자 가이드 ②): JPEG/PNG만 지원, 대형 이미지는 디코딩 지연으로 게이트웨이 타임아웃 502 유발
// → 원본 사진(수 MB, PNG·HEIC 포함)을 그대로 전송하는 경로를 원천 차단
import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// 웹 캔버스 폴백 — ImageManipulator가 실패해도 JPEG 변환을 보장
function resizeViaCanvas(uri, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / (img.naturalWidth || maxWidth));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        // PNG 투명 배경 → 흰색 (JPEG는 알파 없음)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ base64: dataUrl.split(',')[1], uri: dataUrl });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = uri;
  });
}

// uri → { base64, uri } — 실패 시 throw (호출측이 안내 표시, 원본 전송 금지)
// 설치된 expo-image-manipulator는 manipulate(source) 1인자만 지원
// (2인자 전달 시 InvalidArgsNumberException, manipulateAsync는 미제공 — 2026-10-18 실측)
export async function toJpegBase64(uri, { maxWidth = 800, quality = 0.6 } = {}) {
  try {
    const context = ImageManipulator.manipulate(uri); // 인자 1개만!
    context.resize({ width: maxWidth });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: quality,
      base64: true,
    });
    if (result.base64) return { base64: result.base64, uri: result.uri || uri };
    throw new Error('base64 없음');
  } catch (e) {
    console.warn('ImageManipulator 실패 — 캔버스 폴백 시도:', e);
  }
  // 캔버스 폴백 (웹 — PNG·대형 이미지도 JPEG 800px로 강제)
  if (Platform.OS === 'web') {
    return resizeViaCanvas(uri, maxWidth, quality);
  }
  throw new Error('이미지 변환 실패');
}
