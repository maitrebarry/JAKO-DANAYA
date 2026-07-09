import { useWindowDimensions } from 'react-native';

/** Shared breakpoints for compact phones, wide Android phones and tablets. */
export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isTablet = shortestSide >= 600;
  const isWidePhone = !isTablet && width >= 430;
  const isCompact = width < 360;

  return {
    width,
    height,
    fontScale,
    isTablet,
    isWidePhone,
    isCompact,
    horizontalPadding: isTablet ? 32 : isWidePhone ? 24 : isCompact ? 12 : 16,
    contentMaxWidth: isTablet ? 820 : 680,
    formMaxWidth: isTablet ? 620 : 560,
    touchSize: 48,
  };
}
