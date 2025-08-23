import { useState, useCallback } from 'react';
import { RefreshCw, Download, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';

interface AvatarGeneratorProps {
  onClose: () => void;
  onAvatarGenerated?: (avatarUrl: string) => void;
}

interface GradientColors {
  color1: string;
  color2: string;
  color3: string;
}

export function AvatarGenerator({ onClose, onAvatarGenerated }: AvatarGeneratorProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [currentGradient, setCurrentGradient] = useState<GradientColors>(generateRandomGradient());
  const [savedGradients, setSavedGradients] = useState<GradientColors[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedGradient, setSelectedGradient] = useState<GradientColors | null>(null);

  function generateRandomGradient(): GradientColors {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
      '#A9CCE3', '#FAD7A0', '#ABEBC6', '#F9E79F', '#D5A6BD'
    ];
    
    const shuffled = colors.sort(() => 0.5 - Math.random());
    return {
      color1: shuffled[0],
      color2: shuffled[1],
      color3: shuffled[2]
    };
  }

  const generateNewGradient = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      setCurrentGradient(generateRandomGradient());
      setIsGenerating(false);
    }, 300);
  }, []);

  const saveGradient = () => {
    if (!savedGradients.find(g => 
      g.color1 === currentGradient.color1 && 
      g.color2 === currentGradient.color2 && 
      g.color3 === currentGradient.color3
    )) {
      setSavedGradients(prev => [...prev, currentGradient]);
    }
  };

  const selectGradient = (gradient: GradientColors) => {
    setSelectedGradient(gradient);
    setCurrentGradient(gradient);
  };

  const applyAvatar = async () => {
    if (!user) return;
    
    try {
      // Convert gradient to data URL
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = 200;
      canvas.height = 200;
      
      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 200, 200);
      gradient.addColorStop(0, currentGradient.color1);
      gradient.addColorStop(0.5, currentGradient.color2);
      gradient.addColorStop(1, currentGradient.color3);
      
      // Fill with gradient
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 200, 200);
      
      // Add cool effects
      addCoolEffects(ctx, canvas.width, canvas.height);
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      
      // Call the callback to update the user's avatar
      onAvatarGenerated?.(dataUrl);
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Failed to generate avatar:', error);
    }
  };

  const addCoolEffects = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Add subtle geometric patterns
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Draw diagonal lines
    for (let i = 0; i < width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 30, height);
      ctx.stroke();
    }
    
    // Draw circles
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = 20 + Math.random() * 30;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Reset alpha
    ctx.globalAlpha = 1;
  };

  const downloadAvatar = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = 400;
    canvas.height = 400;
    
    const gradient = ctx.createLinearGradient(0, 0, 400, 400);
    gradient.addColorStop(0, currentGradient.color1);
    gradient.addColorStop(0.5, currentGradient.color2);
    gradient.addColorStop(1, currentGradient.color3);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 400);
    
    addCoolEffects(ctx, 400, 400);
    
    const link = document.createElement('a');
    link.download = `avatar-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
            {language === 'tr' ? 'Avatar Oluşturucu' : 'Avatar Generator'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Current Avatar Preview */}
          <div className="text-center">
            <div className="relative inline-block">
              <div
                className="w-32 h-32 rounded-full shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${currentGradient.color1}, ${currentGradient.color2}, ${currentGradient.color3})`
                }}
              />
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-transparent to-black/20" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-mono">
              {language === 'tr' ? 'Önizleme' : 'Preview'}
            </p>
          </div>

          {/* Color Controls */}
          <div className="space-y-4">
            <h3 className="font-mono font-semibold text-gray-900 dark:text-gray-100">
              {language === 'tr' ? 'Renkler' : 'Colors'}
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {language === 'tr' ? 'Renk 1' : 'Color 1'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentGradient.color1}
                    onChange={(e) => setCurrentGradient(prev => ({ ...prev, color1: e.target.value }))}
                    className="w-12 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                    {currentGradient.color1}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {language === 'tr' ? 'Renk 2' : 'Color 2'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentGradient.color2}
                    onChange={(e) => setCurrentGradient(prev => ({ ...prev, color2: e.target.value }))}
                    className="w-12 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                    {currentGradient.color2}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {language === 'tr' ? 'Renk 3' : 'Color 3'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentGradient.color3}
                    onChange={(e) => setCurrentGradient(prev => ({ ...prev, color3: e.target.value }))}
                    className="w-12 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                    {currentGradient.color3}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={generateNewGradient}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-mono text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />
              {isGenerating 
                ? (language === 'tr' ? 'Oluşturuluyor...' : 'Generating...') 
                : (language === 'tr' ? 'Yeni Avatar' : 'New Avatar')
              }
            </button>
            
            <button
              onClick={saveGradient}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md font-mono text-sm hover:bg-green-700 transition-colors"
            >
              <Check size={16} />
              {language === 'tr' ? 'Kaydet' : 'Save'}
            </button>
            
            <button
              onClick={downloadAvatar}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md font-mono text-sm hover:bg-purple-700 transition-colors"
            >
              <Download size={16} />
              {language === 'tr' ? 'İndir' : 'Download'}
            </button>
            
            <button
              onClick={applyAvatar}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              {language === 'tr' ? 'Avatarı Uygula' : 'Apply Avatar'}
            </button>
          </div>

          {/* Saved Gradients */}
          {savedGradients.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                {language === 'tr' ? 'Kaydedilen Avatarlar' : 'Saved Avatars'}
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {savedGradients.map((gradient, index) => (
                  <button
                    key={index}
                    onClick={() => selectGradient(gradient)}
                    className={`w-16 h-16 rounded-full shadow-md transition-transform hover:scale-110 ${
                      selectedGradient === gradient ? 'ring-2 ring-blue-500' : ''
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${gradient.color1}, ${gradient.color2}, ${gradient.color3})`
                    }}
                    title={language === 'tr' ? 'Bu avatarı seç' : 'Select this avatar'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 