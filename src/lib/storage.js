import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  ONBOARDING_DONE: 'onboarding_done',
  SURVEY_ANSWERS: 'survey_answers',
  FOOD_LOGS: 'food_logs',
  EXERCISE_LOGS: 'exercise_logs',
  GLUCOSE_LOGS: 'glucose_logs',
  ROUTINE_SETTINGS: 'routine_settings',
};

export async function get(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (e) {
    console.warn('storage.get 실패:', key, e);
    return null;
  }
}

export async function set(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('storage.set 실패:', key, e);
    return false;
  }
}

export async function remove(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn('storage.remove 실패:', key, e);
    return false;
  }
}

export async function saveOnboarding(answers) {
  const savedAnswers = await set(KEYS.SURVEY_ANSWERS, answers);
  const savedFlag = await set(KEYS.ONBOARDING_DONE, true);
  return savedAnswers && savedFlag;
}

export async function resetOnboarding() {
  const removedAnswers = await remove(KEYS.SURVEY_ANSWERS);
  const removedFlag = await remove(KEYS.ONBOARDING_DONE);
  return removedAnswers && removedFlag;
}
