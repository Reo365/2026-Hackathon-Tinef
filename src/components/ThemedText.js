// 텍스트 프리미티브 — 화면에서 fontSize를 직접 쓰지 않게 하는 유일한 통로
import { Text } from 'react-native';
import { type } from '../../theme';

export default function ThemedText({ variant = 'body', style, ...props }) {
  return <Text style={[type[variant], style]} {...props} />;
}
