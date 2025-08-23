import { useState, useRef, useEffect } from 'react';
import { X, Download, Share2, Palette, Type } from 'lucide-react';
import html2canvas from 'html2canvas';

// TypeScript declarations for Web Share API
interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

interface InstagramPostGeneratorProps {
  post: {
    id: string;
    content: string;
    username: string;
    avatar_url?: string | null;
    created_at: Date;
  };
  onClose: () => void;
}

interface GradientPreset {
  name: string;
  colors: string[];
}

const gradientPresets: GradientPreset[] = [
  { name: 'Sunset', colors: ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff'] },
  { name: 'Ocean', colors: ['#00d2ff', '#3a7bd5', '#667eea', '#764ba2'] },
  { name: 'Forest', colors: ['#11998e', '#38ef7d', '#56ab2f', '#a8e6cf'] },
  { name: 'Neon', colors: ['#ff0080', '#7928ca', '#ff6b35', '#feca57'] },
  { name: 'Pastel', colors: ['#ff9a9e', '#fecfef', '#fecfef', '#fad0c4'] },
  { name: 'Midnight', colors: ['#0c0c0c', '#1a1a2e', '#16213e', '#0f3460'] },
  { name: 'Aurora', colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c'] },
  { name: 'Desert', colors: ['#f093fb', '#f5576c', '#4facfe', '#00f2fe'] },
];

export function InstagramPostGenerator({ post, onClose }: InstagramPostGeneratorProps) {
  const [selectedGradient, setSelectedGradient] = useState<GradientPreset>(gradientPresets[0]);
  const [fontSize, setFontSize] = useState<number>(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const postRef = useRef<HTMLDivElement>(null);
	const exportRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    console.log('InstagramPostGenerator modal opened');
    console.log('Viewport dimensions:', {
      width: window.innerWidth,
      height: window.innerHeight,
      documentHeight: document.documentElement.clientHeight,
      bodyHeight: document.body.clientHeight
    });
    document.body.classList.add('modal-open');
    return () => {
      console.log('InstagramPostGenerator modal closed');
      document.body.classList.remove('modal-open');
    };
  }, []);

  const generateGradientCSS = (preset: GradientPreset) => {
    if (preset.colors.length === 2) {
      return `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`;
    } else if (preset.colors.length === 3) {
      return `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]}, ${preset.colors[2]})`;
    } else {
      return `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]}, ${preset.colors[2]}, ${preset.colors[3]})`;
    }
  };

	const generateCustomGradient = () => generateGradientCSS(selectedGradient);

  const downloadPost = async () => {
		if (!exportRef.current) return;
    
    setIsGenerating(true);
    try {
			const canvas = await html2canvas(exportRef.current, {
				backgroundColor: '#000000',
				scale: 2,
        useCORS: true,
				allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `instagram-story-${post.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const shareToInstagram = async () => {
		if (!exportRef.current) return;
    
    setIsGenerating(true);
    try {
			const canvas = await html2canvas(exportRef.current, {
				backgroundColor: '#000000',
        scale: 2,
        useCORS: true,
				allowTaint: true
      });
      
      // Convert to blob for sharing
      canvas.toBlob(async (blob: Blob | null) => {
        if (blob) {
          try {
            // Try to use Web Share API if available
            if ('share' in navigator) {
          const file = new File([blob], 'instagram-story.png', { type: 'image/png' });
              
              try {
					await (navigator as any).share({
                  title: `Post by @${post.username}`,
                  text: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
            files: [file]
          });
                return; // Successfully shared
              } catch (shareApiError) {
                console.log('Web Share API failed, falling back to download');
              }
            }
            
            // Fallback: Try to open Instagram directly with the image
            const url = URL.createObjectURL(blob);
            
            // Detect if we're on mobile
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
              // Try to open Instagram app or download
              try {
                // Create a temporary link to trigger download
                const link = document.createElement('a');
                link.href = url;
                link.download = `instagram-story-${post.id}.png`;
                link.click();
                
                // Show instructions
                setTimeout(() => {
                  const message = `Image downloaded! To share to Instagram:
1. Open Instagram app
2. Tap the "+" button
3. Select "Story" 
4. Choose the downloaded image from your gallery
5. Add any text and share!`;
                  alert(message);
                }, 100);
              } catch (downloadError) {
                console.error('Download error:', downloadError);
                alert('Failed to download image. Please try again.');
              }
            } else {
              // Desktop fallback
              const link = document.createElement('a');
              link.href = url;
              link.download = `instagram-story-${post.id}.png`;
              link.click();
              alert('Image downloaded! You can upload it to Instagram manually.');
            }
            
            URL.revokeObjectURL(url);
            
          } catch (shareError) {
            console.error('Share error:', shareError);
            
            // Final fallback: download the file
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `instagram-story-${post.id}.png`;
            link.click();
            URL.revokeObjectURL(url);
            
            alert('Sharing failed. Image downloaded instead. You can manually share it to Instagram.');
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="modal-overlay bg-black/90">
      <div className="modal-content w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Type className="w-4 h-4 sm:w-6 sm:h-6 text-pink-500" />
            <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              <span className="sm:hidden">Story Generator</span>
              <span className="hidden sm:inline">Instagram Story Generator</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={18} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Controls Panel - Compact on mobile */}
          <div className="w-full lg:w-72 p-3 sm:p-6 border-r border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-6">
            {/* Gradient Presets - Compact grid on mobile */}
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 flex items-center gap-2">
                <Palette size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Gradient Presets</span>
                <span className="sm:hidden">Presets</span>
              </h3>
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-2 sm:gap-2">
                {gradientPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedGradient(preset)}
                    className={`p-1.5 sm:p-3 rounded-lg border-2 transition-all ${
                      selectedGradient.name === preset.name
                        ? 'border-blue-500 scale-105'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                    style={{
                      background: generateGradientCSS(preset)
                    }}
                  >
                    <span className="text-xs font-medium text-white drop-shadow-lg">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
                Font: {fontSize}px
              </h3>
              <input
                type="range"
                min="16"
                max="36"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Action Buttons - Compact on mobile */}
            <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-4">
              <button
                onClick={downloadPost}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 text-xs sm:text-sm"
              >
                <Download size={16} className="sm:w-5 sm:h-5" />
                {isGenerating ? 'Generating...' : 'Download Story PNG'}
              </button>
              
              <button
                onClick={shareToInstagram}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 text-xs sm:text-sm"
              >
                <Share2 size={16} className="sm:w-5 sm:h-5" />
                {isGenerating ? 'Preparing...' : 'Share to Instagram'}
              </button>

              {/* Quick Share Options - Hidden on mobile to save space */}
              <div className="pt-2 hidden sm:block">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Quick Share</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const text = `Check out this post by @${post.username}: "${post.content.substring(0, 50)}..."`;
                      const url = `${window.location.origin}/post/${post.id}`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                    }}
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
                  >
                    Twitter
                  </button>
                  <button
                    onClick={() => {
                      const text = `Check out this post by @${post.username}: "${post.content.substring(0, 50)}..."`;
                      const url = `${window.location.origin}/post/${post.id}`;
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    Facebook
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preview - Compact on mobile */}
          <div className="flex-1 p-3 sm:p-6 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <div className="relative">
              {/* Instagram Story Preview - 1080x1920 aspect ratio */}
              <div
                ref={postRef}
                className="w-48 h-85 sm:w-64 sm:h-114 lg:w-96 lg:h-171 instagram-story instagram-shadow rounded-2xl overflow-hidden relative"
                style={{
                  background: generateCustomGradient(),
                  aspectRatio: '9/16'
                }}
              >
                {/* Content */}
                <div className="absolute inset-0 p-3 sm:p-6 lg:p-8 flex flex-col justify-between">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    {/* Username */}
                    <div className="flex items-center gap-1.5 sm:gap-3">
                      {post.avatar_url ? (
                        <img
                          src={post.avatar_url}
                          alt={post.username}
                          className="w-5 h-5 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-full border-2 border-white/20 shadow-lg"
                        />
                      ) : (
                        <div className="w-5 h-5 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-full bg-white/20 flex items-center justify-center shadow-lg backdrop-blur-sm">
                          <span className="text-white font-bold text-xs sm:text-base lg:text-lg">
                            {post.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span 
                        className="text-white/90 font-semibold text-xs sm:text-base lg:text-lg"
                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                      >
                        @{post.username}
                      </span>
                    </div>
                    
                    {/* Timestamp */}
                    <span className="text-white/70 text-xs font-mono">
                      {new Date(post.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Post Content */}
                  <div 
                    className="text-white leading-relaxed font-medium text-center flex-1 flex items-center justify-center px-1 sm:px-4 lg:px-6"
                    style={{ 
                      fontSize: `${fontSize}px`,
											color: '#ffffff',
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  >
                    {post.content}
                  </div>

                  {/* Footer Branding */}
                  <div className="text-center">
                    <div 
                      className="text-white/80 text-xs sm:text-sm lg:text-base font-mono font-semibold"
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                    >
                      posted on noise.garden
                    </div>
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-1.5 sm:top-4 right-1.5 sm:right-4">
                  <div className="w-1 h-1 sm:w-2 sm:h-2 lg:w-3 lg:h-3 bg-white/30 rounded-full animate-pulse"></div>
                </div>
                <div className="absolute bottom-1.5 sm:bottom-4 left-1.5 sm:left-4">
                  <div className="w-0.5 h-0.5 sm:w-1.5 sm:h-1.5 lg:w-2 lg:h-2 bg-white/20 rounded-full animate-pulse"></div>
                </div>
                
                {/* Instagram-style corner accent */}
                <div className="absolute top-0 right-0 w-6 h-6 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-gradient-to-bl from-transparent to-white/10 rounded-bl-full"></div>
              </div>

              {/* Instagram Frame */}
              <div className="absolute -top-1 sm:-top-2 -left-1 sm:-left-2 -right-1 sm:-right-2 -bottom-1 sm:-bottom-2 border-2 border-gray-300 dark:border-gray-600 rounded-3xl pointer-events-none"></div>
            </div>
          </div>
        </div>

				{/* Off-screen full-resolution export target (1080x1920) */}
				<div
					ref={exportRef}
					style={{
						position: 'fixed',
						top: '-10000px',
						left: '-10000px',
						width: '1080px',
						height: '1920px',
						background: generateCustomGradient(),
						overflow: 'hidden',
						zIndex: -1
					}}
					aria-hidden="true"
				>
					<div style={{ position: 'relative', width: '100%', height: '100%' }}>
						<div style={{ position: 'absolute', inset: '0', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
									{post.avatar_url ? (
										<img
											src={post.avatar_url}
											alt={post.username}
											style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }}
										/>
									) : (
										<div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
											<span style={{ color: 'white', fontWeight: 'bold', fontSize: '24px' }}>
												{post.username.charAt(0).toUpperCase()}
											</span>
										</div>
									)}
									<span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: '24px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
										@{post.username}
									</span>
								</div>
								<span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px', fontFamily: 'monospace' }}>
									{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
								</span>
							</div>

							<div style={{ 
								color: 'white', 
								lineHeight: '1.6', 
								fontWeight: '500', 
								textAlign: 'center', 
								flex: '1', 
								display: 'flex', 
								alignItems: 'center', 
								justifyContent: 'center', 
								padding: '0 40px',
								fontSize: `${Math.round(fontSize * 2.5)}px`,
								textShadow: '0 2px 4px rgba(0,0,0,0.3)' 
							}}>
								{post.content}
							</div>

							<div style={{ textAlign: 'center' }}>
								<div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', fontFamily: 'monospace', fontWeight: '600', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
									posted on noise.garden
								</div>
							</div>
						</div>
					</div>
				</div>
      </div>
    </div>
  );
} 