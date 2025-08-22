import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Key, Trash2, SlidersHorizontal, Globe, Shield, User, AtSign, Eye, EyeOff, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile, deleteUser, updatePassword, getUserByUsername } from '../lib/database';
import { hashPassword, verifyPassword } from '../lib/auth';
import { containsLink } from '../lib/validation';
import { FeedSettings as FS, loadFeedSettings, saveFeedSettings } from '../lib/settings';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';
import { useNavigation } from '../hooks/useNavigation';

interface UserSettingsProps {
  onClose?: () => void;
}

export function UserSettings({ onClose }: UserSettingsProps) {
  const { user, logout } = useAuth();
  const { setView } = useNavigation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'feed' | 'language' | 'mobile' | 'privacy' | 'security'>('profile');
  const [settings, setSettings] = useState<FS>(() => loadFeedSettings());
  const [mutedInput, setMutedInput] = useState('');
  const [language, setLanguage] = useState<'en' | 'tr'>(settings.language);
  const { language: currentLanguage } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);

  // Detect mobile device and platform
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || 
                           ('ontouchstart' in window) || 
                           (navigator.maxTouchPoints > 0);
      
      // Detect iOS specifically
      const isIOSDevice = /iphone|ipad|ipod/i.test(userAgent);
      const isNativeAndroidDevice = /android/i.test(userAgent) && !isIOSDevice;
      
      setIsMobile(isMobileDevice);
      setIsIOS(isIOSDevice);
      setIsNativeAndroid(isNativeAndroidDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const fresh = await getUserByUsername(user.username);
        if (fresh?.avatar_url) setAvatarUrl(fresh.avatar_url);
        if (typeof fresh?.bio === 'string') setBio(fresh.bio);
      } catch {}
    })();
  }, [user]);

  useEffect(() => { 
    saveFeedSettings(settings);
    // Apply privacy settings effects
    const p = (settings as any).privacy || {};
    const noindex = !!p.hidePublicProfile;
    const existing = document.querySelector('meta[name="robots"]');
    if (noindex) {
      if (existing) {
        existing.setAttribute('content', 'noindex');
      } else {
        const m = document.createElement('meta');
        m.name = 'robots';
        m.content = 'noindex';
        document.head.appendChild(m);
      }
    } else if (existing) {
      existing.setAttribute('content', 'index,follow');
    }
  }, [settings]);

  const handleLanguageChange = (newLanguage: 'en' | 'tr') => {
    setLanguage(newLanguage);
    const newSettings = { ...settings, language: newLanguage } as FS;
    setSettings(newSettings);
    saveFeedSettings(newSettings);
  };

  const generateRandomAvatar = () => {
    // Generate random gradient colors like AvatarGenerator
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
      '#A9CCE3', '#FAD7A0', '#ABEBC6', '#F9E79F', '#D5A6BD'
    ];
    
    const shuffled = colors.sort(() => 0.5 - Math.random());
    const color1 = shuffled[0];
    const color2 = shuffled[1];
    const color3 = shuffled[2];
    
    // Create gradient avatar data URL
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = 200;
    canvas.height = 200;
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 200, 200);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(0.5, color2);
    gradient.addColorStop(1, color3);
    
    // Fill with gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 200, 200);
    
    // Add subtle effects
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Draw diagonal lines
    for (let i = 0; i < 200; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 30, 200);
      ctx.stroke();
    }
    
    // Reset alpha
    ctx.globalAlpha = 1;
    
    const dataUrl = canvas.toDataURL('image/png');
    setAvatarUrl(dataUrl);
    
    // Show success message
    setError('');
    setTimeout(() => {
      setError('New avatar generated! Click save to apply.');
    }, 100);
  };

  const saveProfile = async () => {
    if (!user) return;
    if (bio && containsLink(bio)) { setError('Links are not allowed in bio'); return; }
    setLoading(true);
    try {
      await updateUserProfile(user.userId, avatarUrl || null, bio || null);
      if (onClose) {
        onClose();
      } else {
        setView('profile');
      }
    } catch (e) {
      setError('Failed to save profile');
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const dbUser = await getUserByUsername(user.username);
      if (!dbUser || !(await verifyPassword(currentPassword, dbUser.password_hash))) {
        setError('Current password is incorrect');
        return;
      }
      const newPasswordHash = await hashPassword(newPassword);
      await updatePassword(user.userId, newPasswordHash);
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setError('Failed to change password');
    } finally { setLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await deleteUser(user.userId);
      logout();
    } catch {
      setError('Failed to delete account');
    } finally { setLoading(false); }
  };

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      setView('profile');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100">{t('accountSettings', currentLanguage)}</h2>
            </div>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X size={20} />
            </button>
            )}
          </div>

          {/* Tabs */}
          <div className="relative">
            <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide touch-pan-x tab-scroll-container">
              <button onClick={() => setActiveTab('profile')} className={`px-3 py-1.5 rounded font-mono text-xs whitespace-nowrap flex-shrink-0 ${activeTab==='profile' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>Profile</button>
              <button onClick={() => setActiveTab('feed')} className={`px-3 py-1.5 rounded font-mono text-xs whitespace-nowrap flex-shrink-0 ${activeTab==='feed' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>Feed</button>
              <button onClick={() => setActiveTab('language')} className={`px-3 py-1.5 rounded font-mono text-xs whitespace-nowrap flex-shrink-0 ${activeTab==='language' ? 'bg-gray-900 text-white dark:text-gray-100 dark:text-gray-900' : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>Language</button>
              <button onClick={() => setActiveTab('mobile')} className={`px-3 py-1.5 rounded font-mono text-xs whitespace-nowrap flex-shrink-0 ${activeTab==='mobile' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>Mobile</button>
              <button onClick={() => setActiveTab('privacy')} className={`px-3 py-1.5 rounded font-mono text-xs whitespace-nowrap flex-shrink-0 ${activeTab==='privacy' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>Privacy</button>
              <button onClick={() => setActiveTab('security')} className={`px-3 py-1.5 rounded font-mono text-xs whitespace-nowrap flex-shrink-0 ${activeTab==='security' ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>Security</button>
            </div>
            {/* Scroll indicator for mobile */}
            {isMobile && (
              <>
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-gray-900 to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none" />
              </>
            )}
            {/* Scroll instruction for mobile */}
            {isMobile && (
              <div className="text-center mt-1">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                  ← Swipe to see more tabs →
                </span>
              </div>
            )}
          </div>
              </div>

        <div className="p-4 sm:p-6 pb-20 md:pb-6">
          {/* Profile section */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="relative group mx-auto sm:mx-0">
                  <button 
                    onClick={generateRandomAvatar}
                    className="w-24 h-24 sm:w-20 sm:h-20 rounded-full cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt="avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-4xl sm:text-3xl">
                        👤
                      </div>
                    )}
                  </button>
                  <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center pointer-events-none">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-3xl sm:text-2xl">
                      🎲
                    </div>
                  </div>
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                    Click to change avatar
                  </div>
                </div>
                <div className="flex-1 w-full sm:w-auto">
                  <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-2">{t('bio', currentLanguage)}</p>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" 
                    rows={4}
                    maxLength={200} 
                    placeholder={t('sayHelloNoLinks', currentLanguage)} 
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {bio.length}/200
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveProfile} disabled={loading} className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50">
                  {loading ? t('saving', currentLanguage) : t('saveProfile', currentLanguage)}
                </button>
              </div>
            </div>
          )}

          {/* Tab contents */}
          {activeTab === 'feed' && (
            <div className="rounded-md border border-gray-200 dark:border-gray-800">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-sm text-gray-700 dark:text-gray-300"><SlidersHorizontal size={16} /> {t('feedSettings', currentLanguage)}</span>
              </div>
              <div className="p-3 space-y-3 border-t border-gray-200 dark:border-gray-800">
                <div>
                  <label className="font-mono text-sm text-gray-600 dark:text-gray-400">{t('mutedWordsTags', currentLanguage)}</label>
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <input value={mutedInput} onChange={(e) => setMutedInput(e.target.value)} placeholder={t('wordOrTag', currentLanguage)} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
                    <button type="button" onClick={() => { if (!mutedInput.trim()) return; setSettings(s => ({ ...(s as any), mutedWords: Array.from(new Set([...((s as any).mutedWords||[]), mutedInput.trim()])) }) as FS); setMutedInput(''); }} className="ng-btn whitespace-nowrap">{t('add', currentLanguage)}</button>
                  </div>
                  {(settings as any).mutedWords?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(settings as any).mutedWords.map((w: string) => (
                        <button key={w} onClick={() => setSettings(s => ({ ...(s as any), mutedWords: (s as any).mutedWords.filter((x: string) => x !== w) }) as FS)} className="text-xs font-mono px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">{w} ×</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'language' && (
            <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <label className="font-mono text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Globe size={16} />
                {t('language', currentLanguage)} / {t('dil', currentLanguage)}
              </label>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`px-3 py-2 rounded text-sm font-mono transition-colors ${
                    language === 'en'
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                      : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {t('english', currentLanguage)}
                </button>
                <button
                  onClick={() => handleLanguageChange('tr')}
                  className={`px-3 py-2 rounded text-sm font-mono transition-colors ${
                    language === 'tr'
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                      : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {t('turkish', currentLanguage)}
                </button>
              </div>
              </div>
            )}

          {activeTab === 'mobile' && (
            <div className="space-y-4">
              {isNativeAndroid ? (
                <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="logo" className="w-8 h-8 rounded" />
                    <div className="font-mono text-sm text-gray-600 dark:text-gray-400">
                      You're using the native Android app.
                    </div>
                  </div>
                </div>
              ) : isIOS ? (
                // iOS Users - Coming Soon
                <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <img src="/logo.png" alt="logo" className="w-12 h-12 rounded-lg" />
                    <div>
                      <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
                        iOS App Coming Soon
                      </h3>
                      <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
                        We're working on bringing noise.garden to iPhone and iPad
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <h4 className="font-mono font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        ✨ Planned iOS Features
                      </h4>
                      <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Push notifications for mentions and replies
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Haptic feedback for interactions
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Native iOS performance and design
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Pull-to-refresh and smooth scrolling
                        </li>
                      </ul>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                      <h4 className="font-mono font-semibold text-purple-800 dark:text-purple-200 mb-2">
                        🚧 Development Status
                      </h4>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        Our iOS app is currently in development. We're working hard to bring the same privacy-first, 
                        ephemeral social experience to iPhone and iPad users. The app will feature native iOS design 
                        patterns and integrate seamlessly with iOS notifications and haptics.
                      </p>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <h4 className="font-mono font-semibold text-amber-800 dark:text-amber-200 mb-2">
                        📱 Current Options
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        While you wait for the iOS app, you can continue using noise.garden in your mobile browser. 
                        The web version is fully responsive and works great on mobile devices.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Android Users - Download Available (web)
                <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <img src="/logo.png" alt="logo" className="w-12 h-12 rounded-lg" />
                    <div>
                      <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
                        Android App
                      </h3>
                      <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
                        Limited beta - Join to test mobile features
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <h4 className="font-mono font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        ✨ Mobile Features
                      </h4>
                      <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Push notifications for mentions and replies
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Haptic feedback for interactions
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Native Android performance
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                          Pull-to-refresh and smooth scrolling
                        </li>
                      </ul>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <h4 className="font-mono font-semibold text-amber-800 dark:text-amber-200 mb-2">
                        📱 Download Options
                      </h4>
                      <div className="space-y-2">
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Choose your preferred download method:
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <a 
                            href="https://play.google.com/store/apps/details?id=com.ng.app" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-mono text-sm transition-colors"
                          >
                            🏪 Google Play Store
                          </a>
                          <a 
                            href="https://github.com/ng-app/ng-app/releases" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md font-mono text-sm transition-colors"
                          >
                            📦 Direct APK Download
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                      <h4 className="font-mono font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        🔧 Installation Guide
                      </h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                        <li>Download the APK file from the links above</li>
                        <li>Enable "Install from unknown sources" in your Android settings</li>
                        <li>Open the downloaded APK file</li>
                        <li>Tap "Install" when prompted</li>
                        <li>Open the app and sign in with your existing account</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <label className="font-mono text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2"><Shield size={16} /> Privacy</label>
              <div className="mt-2 space-y-3">
                <label className="flex items-center gap-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                  <input 
                    type="checkbox" 
                    checked={!!(settings as any).privacy?.hidePublicProfile} 
                    onChange={(e) => setSettings(s => ({ ...(s as any), privacy: { ...((s as any).privacy||{}), hidePublicProfile: e.target.checked } }) as FS)} 
                  />
                  Hide profile pages from search engines
                </label>
                <label className="flex items-center gap-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                  <input 
                    type="checkbox" 
                    checked={!!(settings as any).privacy?.defaultUnlisted} 
                    onChange={(e) => setSettings(s => ({ ...(s as any), privacy: { ...((s as any).privacy||{}), defaultUnlisted: e.target.checked } }) as FS)} 
                  />
                  New posts unlisted by default (not shown in main feed)
                </label>
                <label className="flex items-center gap-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                  <input 
                    type="checkbox" 
                    checked={!!(settings as any).privacy?.disableMentions} 
                    onChange={(e) => setSettings(s => ({ ...(s as any), privacy: { ...((s as any).privacy||{}), disableMentions: e.target.checked } }) as FS)} 
                  />
                  <div className="flex items-center gap-2">
                    <AtSign size={16} />
                    Disable @mentions (others cannot mention you)
                      </div>
                </label>
                <label className="flex items-center gap-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                  <input 
                    type="checkbox" 
                    checked={!!(settings as any).privacy?.hideOnlineStatus} 
                    onChange={(e) => setSettings(s => ({ ...(s as any), privacy: { ...((s as any).privacy||{}), hideOnlineStatus: e.target.checked } }) as FS)} 
                  />
                  <div className="flex items-center gap-2">
                    <Eye size={16} />
                    Hide online status from other users
                  </div>
                </label>
              </div>
              <p className="mt-2 text-xs font-mono text-gray-500 dark:text-gray-400">These preferences are applied by the app on this device.</p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-gray-700 dark:text-gray-300">Backup codes</p>
                  <p className="font-mono text-xs text-gray-500 dark:text-gray-400">Download your one-time recovery codes</p>
                </div>
                  <button
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem('onboarding_backup_codes');
                      if (!raw) { alert('No backup codes found on this device.'); return; }
                      const codes: string[] = JSON.parse(raw);
                      const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'ng_backup_codes.txt';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch {
                      alert('Could not download backup codes.');
                    }
                  }}
                  className="ng-btn whitespace-nowrap"
                >
                  Download
                </button>
              </div>
            </div>
          )}

          {/* Invite & account actions */}
          <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 mt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-gray-700 dark:text-gray-300">{t('inviteFriend', currentLanguage)}</p>
                <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{t('eachAccountHasOneInviteCode', currentLanguage)}</p>
              </div>
              <button 
                onClick={() => setView('invite')} 
                className="ng-btn whitespace-nowrap"
              >
                {t('generateInvite', currentLanguage)}
              </button>
            </div>

            {!showChangePassword ? (
              <button onClick={() => setShowChangePassword(true)} className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors mt-3">
                <Key size={16} /> {t('changePassword', currentLanguage)}
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3 mt-3">
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t('currentPassword', currentLanguage)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900" required />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('newPasswordMin6Chars', currentLanguage)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900" required minLength={6} />
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="submit" disabled={loading} className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50">{loading ? '...' : t('save', currentLanguage)}</button>
                  <button type="button" onClick={() => { setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setError(''); }} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-mono text-sm transition-colors">{t('cancel', currentLanguage)}</button>
                </div>
              </form>
            )}

            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-700 py-2 px-4 rounded-md font-mono text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mt-3">
                <Trash2 size={16} /> {t('deleteAccountPermanently', currentLanguage)}
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-4 mt-3">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="text-red-600 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-mono text-red-800 dark:text-red-300 font-medium">{t('permanentDeletion', currentLanguage)}</p>
                    <p className="text-xs font-mono text-red-600 dark:text-red-400 mt-1">{t('permanentDeletionDescription', currentLanguage)}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={handleDeleteAccount} disabled={loading} className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md font-mono text-sm hover:bg-red-700 transition-colors disabled:opacity-50">{loading ? '...' : t('yesDeleteEverything', currentLanguage)}</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-mono text-sm transition-colors">{t('cancel', currentLanguage)}</button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Sign Out Button */}
          <div className="md:hidden mt-4">
            <button 
              onClick={logout} 
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 rounded-md font-mono text-sm hover:bg-red-700 transition-colors"
            >
              <LogOut size={16} />
              {t('signOut', currentLanguage)}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-3 mt-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-red-600 mt-0.5" size={16} />
                <p className="text-sm font-mono text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}