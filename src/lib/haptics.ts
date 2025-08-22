export async function hapticLight() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
  } catch {
    // Fallback to web vibration
  }
  
  // Web fallback
  if ('vibrate' in navigator) {
    try { (navigator as any).vibrate?.(10); } catch {}
  }
}

export async function hapticSelection() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.selectionChanged();
      return;
    }
  } catch {
    // Fallback to web vibration
  }
  
  // Web fallback
  if ('vibrate' in navigator) {
    try { (navigator as any).vibrate?.(5); } catch {}
  }
} 