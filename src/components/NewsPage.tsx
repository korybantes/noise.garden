import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, User, ArrowLeft } from 'lucide-react';
import { NewsPost, getNewsPosts, createNewsPost, updateNewsPost, deleteNewsPost } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../lib/translations';
import { marked } from 'marked';
import { hapticLight } from '../lib/haptics';

interface NewsPageProps {
  onBack?: () => void;
}

export function NewsPage({ onBack }: NewsPageProps) {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const { user } = useAuth();
  const { language } = useLanguage();

  const isModerator = user && ['admin', 'moderator'].includes(user.role);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const newsPosts = await getNewsPosts(50, 0, !isModerator); // Show all posts to moderators
      setPosts(newsPosts);
    } catch (error) {
      console.error('Failed to load news posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (title: string, content: string, isPublished: boolean) => {
    if (!user) return;
    
    try {
      hapticLight();
      await createNewsPost(title, content, isPublished);
      setShowCreateForm(false);
      loadPosts();
    } catch (error) {
      console.error('Failed to create news post:', error);
    }
  };

  const handleUpdatePost = async (postId: string, title: string, content: string, isPublished: boolean) => {
    if (!user) return;
    
    try {
      hapticLight();
      await updateNewsPost(postId, { title, content, isPublished });
      setEditingPost(null);
      loadPosts();
    } catch (error) {
      console.error('Failed to update news post:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    
    if (!confirm(t('deleteNewsPostConfirm', language))) return;
    
    try {
      hapticLight();
      await deleteNewsPost(postId);
      loadPosts();
    } catch (error) {
      console.error('Failed to delete news post:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (selectedPost) {
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setSelectedPost(null)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors"
            >
              <ArrowLeft size={16} />
              {t('backToNews', language)}
            </button>
          </div>

          <article className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {selectedPost.title}
              </h1>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
                <div className="flex items-center gap-1">
                  <User size={14} />
                  <span className="font-mono">@{selectedPost.author_username}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span className="font-mono">{formatDate(selectedPost.created_at)}</span>
                </div>
                {!selectedPost.is_published && (
                  <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <EyeOff size={14} />
                    <span className="font-mono">{t('draft', language)}</span>
                  </div>
                )}
              </div>

              <div 
                className="prose prose-gray dark:prose-invert max-w-none font-mono text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: marked(selectedPost.content) }}
              />
            </div>
          </article>
        </div>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <NewsPostForm
        onSubmit={handleCreatePost}
        onCancel={() => setShowCreateForm(false)}
        mode="create"
      />
    );
  }

  if (editingPost) {
    return (
      <NewsPostForm
        post={editingPost}
        onSubmit={handleUpdatePost}
        onCancel={() => setEditingPost(null)}
        mode="edit"
      />
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-mono">
              {t('news', language)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
              {t('newsDescription', language)}
            </p>
          </div>
          
          {isModerator && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-mono text-sm transition-colors"
            >
              <Plus size={16} />
              {t('createNewsPost', language)}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 font-mono">
              {t('loadingNews', language)}
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 font-mono">
              {t('noNewsPosts', language)}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h2 
                      className="text-xl font-bold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      onClick={() => setSelectedPost(post)}
                    >
                      {post.title}
                    </h2>
                    
                    {isModerator && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingPost(post)}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                      <User size={14} />
                      <span className="font-mono">@{post.author_username}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span className="font-mono">{formatDate(post.created_at)}</span>
                    </div>
                    {!post.is_published && (
                      <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        <EyeOff size={14} />
                        <span className="font-mono">{t('draft', language)}</span>
                      </div>
                    )}
                  </div>

                  <div 
                    className="prose prose-gray dark:prose-invert max-w-none font-mono text-sm leading-relaxed line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: marked(post.content.substring(0, 300) + (post.content.length > 300 ? '...' : '')) }}
                  />

                  <button
                    onClick={() => setSelectedPost(post)}
                    className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-mono text-sm transition-colors"
                  >
                    {t('readMore', language)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface NewsPostFormProps {
  post?: NewsPost;
  onSubmit: (title: string, content: string, isPublished: boolean) => void;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

function NewsPostForm({ post, onSubmit, onCancel, mode }: NewsPostFormProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [isPublished, setIsPublished] = useState(post?.is_published ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { language } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setIsSubmitting(true);
    try {
      if (mode === 'edit' && post) {
        await onSubmit(post.id, title, content, isPublished);
      } else {
        await onSubmit(title, content, isPublished);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            {t('backToNews', language)}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-mono mb-6">
              {mode === 'create' ? t('createNewsPost', language) : t('editNewsPost', language)}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-mono mb-2">
                  {t('title', language)}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('newsTitlePlaceholder', language)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-mono mb-2">
                  {t('content', language)} ({t('markdownSupported', language)})
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('newsContentPlaceholder', language)}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isPublished" className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                  {t('publishImmediately', language)}
                </label>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !content.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-mono text-sm transition-colors"
                >
                  {isSubmitting ? t('saving', language) : (mode === 'create' ? t('create', language) : t('save', language))}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md font-mono text-sm transition-colors"
                >
                  {t('cancel', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
