// Stub implementation for @capacitor/haptics in web environment
export const Haptics = {
  impact: async (options: any) => {
    console.log('Haptics.impact() called in web environment:', options);
    // Fallback to web vibration if available
    if ('vibrate' in navigator) {
      try { (navigator as any).vibrate?.(10); } catch {}
    }
  },
  selectionChanged: async () => {
    console.log('Haptics.selectionChanged() called in web environment');
    // Fallback to web vibration if available
    if ('vibrate' in navigator) {
      try { (navigator as any).vibrate?.(5); } catch {}
    }
  }
};

export const ImpactStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy'
}; 