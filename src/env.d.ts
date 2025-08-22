declare module '@capacitor/share' {
  export const Share: {
    share: (opts: { title?: string; text?: string; url?: string; dialogTitle?: string }) => Promise<any>;
  };
} 