// Web stub for @capacitor/share
export const Share = {
  async share(_: { title?: string; text?: string; url?: string; dialogTitle?: string }) {
    // No-op on web; caller should fall back to Web Share API or clipboard
    return { activityType: undefined, dismissed: true } as any;
  }
}; 