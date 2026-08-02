import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'

export default function Skeleton({ width, height, borderRadius = 8, color = '#E5E7EB', shimmerColor = 'rgba(255,255,255,0.5)' }) {
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [shimmer])

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  })

  return (
    <View style={[s.box, { width, height, borderRadius, backgroundColor: color }]}>
      <Animated.View style={[s.shimmer, { width, height: '100%', transform: [{ translateX }], backgroundColor: shimmerColor }]} />
    </View>
  )
}

const s = StyleSheet.create({
  box: { overflow: 'hidden' },
  shimmer: { borderRadius: 8 },
})
