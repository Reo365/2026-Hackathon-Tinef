// MVP 내장 음식 DB — 37종 (식약처 API 교체는 Plan.md 5장)
// 값: 1인분 기준 대략치 (kcal / 탄수화물 g / 혈당 영향 계수)
export const FOODS = [
  { id: 'white-rice', name: '흰쌀밥', serving: '1공기 (210g)', kcal: 300, carbs: 65, giFactor: 1.0 },
  { id: 'brown-rice', name: '현미밥', serving: '1공기 (210g)', kcal: 280, carbs: 58, giFactor: 0.75 },
  { id: 'fried-egg', name: '계란후라이', serving: '1개 (50g)', kcal: 90, carbs: 1, giFactor: 0.2 },
  { id: 'chicken-breast', name: '닭가슴살', serving: '100g', kcal: 110, carbs: 0, giFactor: 0.1 },
  { id: 'kimchi-stew', name: '김치찌개', serving: '1인분 (400g)', kcal: 220, carbs: 15, giFactor: 0.6 },
  { id: 'doenjang-stew', name: '된장찌개', serving: '1인분 (400g)', kcal: 150, carbs: 10, giFactor: 0.5 },
  { id: 'bibimbap', name: '비빔밥', serving: '1인분 (450g)', kcal: 520, carbs: 80, giFactor: 0.9 },
  { id: 'ramyeon', name: '라면', serving: '1개 (120g)', kcal: 500, carbs: 78, giFactor: 1.1 },
  { id: 'sweet-potato', name: '고구마', serving: '1개 (150g)', kcal: 160, carbs: 37, giFactor: 0.7 },
  { id: 'banana', name: '바나나', serving: '1개 (100g)', kcal: 90, carbs: 22, giFactor: 0.85 },
  { id: 'apple', name: '사과', serving: '1개 (200g)', kcal: 100, carbs: 26, giFactor: 0.8 },
  { id: 'milk', name: '우유', serving: '1컵 (200ml)', kcal: 125, carbs: 10, giFactor: 0.5 },
  { id: 'broccoli', name: '브로콜리', serving: '70g', kcal: 25, carbs: 5, giFactor: 0.25 },
  { id: 'spinach', name: '시금치나물', serving: '60g', kcal: 30, carbs: 4, giFactor: 0.2 },
  { id: 'white-bread', name: '식빵', serving: '1쪽 (35g)', kcal: 100, carbs: 18, giFactor: 1.05 },
  { id: 'black-coffee', name: '블랙커피', serving: '1잔 (200ml)', kcal: 5, carbs: 0, giFactor: 0.05 },
  { id: 'fried-chicken', name: '후라이드치킨', serving: '2조각 (200g)', kcal: 550, carbs: 25, giFactor: 0.7 },
  { id: 'pizza', name: '피자', serving: '2조각 (250g)', kcal: 600, carbs: 75, giFactor: 0.95 },
  { id: 'tteokbokki', name: '떡볶이', serving: '1인분 (350g)', kcal: 450, carbs: 85, giFactor: 1.0 },
  { id: 'gimbap', name: '김밥', serving: '1줄 (250g)', kcal: 400, carbs: 60, giFactor: 0.9 },
  { id: 'donkkaseu', name: '돈까스', serving: '1개 (250g)', kcal: 550, carbs: 45, giFactor: 0.8 },
  { id: 'jjajangmyeon', name: '짜장면', serving: '1그릇 (400g)', kcal: 550, carbs: 85, giFactor: 0.95 },
  { id: 'jjampong', name: '짬뽕', serving: '1그릇 (450g)', kcal: 500, carbs: 70, giFactor: 0.9 },
  { id: 'sundubu-jjigae', name: '순두부찌개', serving: '1인분 (350g)', kcal: 300, carbs: 8, giFactor: 0.3 },
  { id: 'dumpling', name: '만두', serving: '6개 (180g)', kcal: 350, carbs: 40, giFactor: 0.8 },
  { id: 'juk', name: '죽', serving: '1그릇 (300g)', kcal: 250, carbs: 50, giFactor: 1.0 },
  { id: 'cola', name: '콜라', serving: '1캔 (250ml)', kcal: 105, carbs: 27, giFactor: 1.1 },
  { id: 'samgyeopsal', name: '삼겹살', serving: '2인분 (200g)', kcal: 650, carbs: 0, giFactor: 0.05 },
  { id: 'bulgogi', name: '불고기', serving: '1인분 (200g)', kcal: 400, carbs: 12, giFactor: 0.3 },
  { id: 'jeyuk-bokkeum', name: '제육볶음', serving: '1인분 (200g)', kcal: 500, carbs: 10, giFactor: 0.3 },
  { id: 'naengmyeon', name: '냉면', serving: '1그릇 (500g)', kcal: 450, carbs: 80, giFactor: 0.9 },
  { id: 'udon', name: '우동', serving: '1그릇 (450g)', kcal: 400, carbs: 65, giFactor: 0.95 },
  { id: 'kimchi-fried-rice', name: '김치볶음밥', serving: '1그릇 (300g)', kcal: 550, carbs: 80, giFactor: 1.0 },
  { id: 'hamburger', name: '햄버거', serving: '1개 (220g)', kcal: 550, carbs: 45, giFactor: 0.85 },
  { id: 'french-fries', name: '감자튀김', serving: '중 사이즈 (120g)', kcal: 300, carbs: 40, giFactor: 0.95 },
  { id: 'curry-rice', name: '카레라이스', serving: '1그릇 (350g)', kcal: 550, carbs: 75, giFactor: 1.0 },
  { id: 'gyeranjjim', name: '계란찜', serving: '1인분 (120g)', kcal: 150, carbs: 3, giFactor: 0.2 },
];

export function searchFoods(query) {
  const q = (query || '').trim();
  if (!q) return FOODS;
  return FOODS.filter((food) => food.name.includes(q));
}

export function getFood(id) {
  return FOODS.find((food) => food.id === id) || null;
}
