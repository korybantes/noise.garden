import { useState, useEffect } from 'react';
import { Calendar, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../lib/translations';
import { marked } from 'marked';

interface ChangelogPost {
  id: string;
  title: string;
  content: string;
  created_at: Date;
  author_username: string;
  is_published: boolean;
}

export function ChangelogViewer() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [posts, setPosts] = useState<ChangelogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/app.mjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getNewsPosts',
          args: { limit: 10, offset: 0, publishedOnly: true }
        })
      });
      
      if (!response.ok) throw new Error('Failed to load posts');
      const result = await response.json();
      setPosts(result.posts || []);
    } catch (err) {
      setError(language === 'tr' ? 'Gönderiler yüklenemedi' : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-sm font-bold">📰</span>
            </div>
            <div>
              <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
                {t('news', language)}
              </h3>
              <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
                {t('newsDescription', language)}
              </p>
            </div>
          </div>
          
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
            {language === 'tr' ? 'Gönderiler yükleniyor...' : 'Loading posts...'}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-sm font-bold">📰</span>
            </div>
            <div>
              <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
                {t('news', language)}
              </h3>
              <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
                {t('newsDescription', language)}
              </p>
            </div>
          </div>
          
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-400 text-sm font-bold">📰</span>
          </div>
          <div>
            <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
              {t('news', language)}
            </h3>
            <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
              {t('newsDescription', language)}
            </p>
          </div>
        </div>
        
        {posts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
            {language === 'tr' ? 'Henüz gönderi bulunmuyor.' : 'No posts yet.'}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-mono font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <div className="flex items-center gap-1">
                        <User size={12} />
                        <span>@{post.author_username}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {post.is_published ? (
                          <>
                            <Eye size={12} />
                            <span>{language === 'tr' ? 'Yayında' : 'Published'}</span>
                          </>
                        ) : (
                          <>
                            <EyeOff size={12} />
                            <span>{language === 'tr' ? 'Taslak' : 'Draft'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400 font-mono leading-relaxed mb-3">
                  <div 
                    className="prose prose-sm prose-gray dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: marked(truncateContent(post.content)) 
                    }}
                  />
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={() => window.open(`/news/${post.id}`, '_blank')}
                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-mono transition-colors"
                  >
                    {language === 'tr' ? 'Devamını oku' : 'Read more'}
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
            
            <div className="flex justify-center pt-4">
              <button
                onClick={() => window.open('/news', '_blank')}
                className="flex items-center gap-2 px-6 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                📰 {language === 'tr' ? 'Tüm Haberleri Gör' : 'View All News'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
