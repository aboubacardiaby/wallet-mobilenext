import { ActivityIndicator } from 'react-native'

export default function Spinner({ size = 'md', color = '#4F46E5' }) {
  const sz = size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'small'
  return <ActivityIndicator size={sz} color={color} />
}
