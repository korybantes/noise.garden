import { useState, useEffect } from 'react';
import { Plus, Save, Eye, EyeOff, FileText, Calendar, User, Trash2, Edit, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../lib/translations';

interface ChangelogPost {
  id: string;
  title: string;
  content: string;
  created_at: Date;
  author_username: string;
  is_published: boolean;
}

export function ChangelogEditor() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [posts, setPosts] = useState<ChangelogPost[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<ChangelogPost | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch('/api/app.mjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getNewsPosts',
          args: { limit: 50, offset: 0, publishedOnly: false }
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

  const handleCreatePost = async () => {
    if (!user || !title.trim() || !content.trim()) {
      setError(language === 'tr' ? 'Başlık ve içerik gereklidir' : 'Title and content are required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/app.mjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createNewsPost',
          args: { title: title.trim(), content: content.trim(), isPublished: isPublished }
        })
      });
      
      if (!response.ok) throw new Error('Failed to create post');
      
      setSuccess(language === 'tr' ? 'Gönderi oluşturuldu!' : 'Post created!');
      setTitle('');
      setContent('');
      setIsPublished(true);
      setShowEditor(false);
      loadPosts();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(language === 'tr' ? 'Gönderi oluşturulamadı' : 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePost = async () => {
    if (!editingPost || !title.trim() || !content.trim()) {
      setError(language === 'tr' ? 'Başlık ve içerik gereklidir' : 'Title and content are required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/app.mjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateNewsPost',
          args: { 
            postId: editingPost.id, 
            title: title.trim(), 
            content: content.trim(), 
            isPublished: isPublished 
          }
        })
      });
      
      if (!response.ok) throw new Error('Failed to update post');
      
      setSuccess(language === 'tr' ? 'Gönderi güncellendi!' : 'Post updated!');
      setEditingPost(null);
      setTitle('');
      setContent('');
      setIsPublished(true);
      loadPosts();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(language === 'tr' ? 'Gönderi güncellenemedi' : 'Failed to update post');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm(language === 'tr' ? 'Bu gönderiyi silmek istediğinizden emin misiniz?' : 'Are you sure you want to delete this post?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/app.mjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteNewsPost',
          args: { postId }
        })
      });
      
      if (!response.ok) throw new Error('Failed to delete post');
      
      setSuccess(language === 'tr' ? 'Gönderi silindi!' : 'Post deleted!');
      loadPosts();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(language === 'tr' ? 'Gönderi silinemedi' : 'Failed to delete post');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (post: ChangelogPost) => {
    setEditingPost(post);
    setTitle(post.title);
    setContent(post.content);
    setIsPublished(post.is_published);
    setShowEditor(true);
  };

  const cancelEditing = () => {
    setEditingPost(null);
    setTitle('');
    setContent('');
    setIsPublished(true);
    setShowEditor(false);
    setError('');
  };

  const insertTemplate = (template: string) => {
    setContent(prev => prev + '\n\n' + template);
  };

  const templates = [
    {
      name: language === 'tr' ? 'Yeni Özellik' : 'New Feature',
      content: `## ✨ ${language === 'tr' ? 'Yeni Özellik' : 'New Feature'}

${language === 'tr' ? 'Bu güncellemede eklenen yeni özellikler:' : 'New features added in this update:'}

- ${language === 'tr' ? 'Özellik 1' : 'Feature 1'}
- ${language === 'tr' ? 'Özellik 2' : 'Feature 2'}
- ${language === 'tr' ? 'Özellik 3' : 'Feature 3'}`
    },
    {
      name: language === 'tr' ? 'Hata Düzeltmesi' : 'Bug Fix',
      content: `## 🐛 ${language === 'tr' ? 'Hata Düzeltmesi' : 'Bug Fix'}

${language === 'tr' ? 'Bu güncellemede düzeltilen hatalar:' : 'Bugs fixed in this update:'}

- ${language === 'tr' ? 'Hata 1' : 'Bug 1'}
- ${language === 'tr' ? 'Hata 2' : 'Bug 2'}
- ${language === 'tr' ? 'Hata 3' : 'Bug 3'}`
    },
    {
      name: language === 'tr' ? 'İyileştirme' : 'Improvement',
      content: `## 🔧 ${language === 'tr' ? 'İyileştirme' : 'Improvement'}

${language === 'tr' ? 'Bu güncellemede yapılan iyileştirmeler:' : 'Improvements made in this update:'}

- ${language === 'tr' ? 'İyileştirme 1' : 'Improvement 1'}
- ${language === 'tr' ? 'İyileştirme 2' : 'Improvement 2'}
- ${language === 'tr' ? 'İyileştirme 3' : 'Improvement 3'}`
    }
  ];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
          📝 {language === 'tr' ? 'Changelog Yönetimi' : 'Changelog Management'}
        </h3>
        {!showEditor && (
          <button
            onClick={() => setShowEditor(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-mono text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            {language === 'tr' ? 'Yeni Gönderi' : 'New Post'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
          {success}
        </div>
      )}

      {/* Editor */}
      {showEditor && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-mono font-semibold text-gray-900 dark:text-gray-100">
              {editingPost ? (language === 'tr' ? 'Gönderiyi Düzenle' : 'Edit Post') : (language === 'tr' ? 'Yeni Gönderi' : 'New Post')}
            </h4>
            <button
              onClick={cancelEditing}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'tr' ? 'Başlık' : 'Title'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === 'tr' ? 'Gönderi başlığı...' : 'Post title...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono"
                maxLength={100}
              />
            </div>

            {/* Templates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📋 {language === 'tr' ? 'Şablonlar' : 'Templates'}
              </label>
              <div className="flex flex-wrap gap-2">
                {templates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => insertTemplate(template.content)}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs font-mono hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'tr' ? 'İçerik (Markdown)' : 'Content (Markdown)'}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={language === 'tr' ? 'Markdown formatında içerik yazın...' : 'Write content in markdown format...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono resize-none"
                rows={12}
                maxLength={5000}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {content.length}/5000
              </div>
            </div>

            {/* Publish Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublished"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              <label htmlFor="isPublished" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'tr' ? 'Hemen yayınla' : 'Publish immediately'}
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={editingPost ? handleUpdatePost : handleCreatePost}
                disabled={loading || !title.trim() || !content.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-mono text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {loading 
                  ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') 
                  : (editingPost ? (language === 'tr' ? 'Güncelle' : 'Update') : (language === 'tr' ? 'Oluştur' : 'Create'))
                }
              </button>
              <button
                onClick={cancelEditing}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-mono text-sm transition-colors"
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-3">
        <h4 className="font-mono font-semibold text-gray-900 dark:text-gray-100">
          📰 {language === 'tr' ? 'Mevcut Gönderiler' : 'Existing Posts'}
        </h4>
        
        {loading && !showEditor ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
            {language === 'tr' ? 'Gönderiler yükleniyor...' : 'Loading posts...'}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
            {language === 'tr' ? 'Henüz gönderi bulunmuyor.' : 'No posts yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h5 className="font-mono font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {post.title}
                    </h5>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditing(post)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title={language === 'tr' ? 'Düzenle' : 'Edit'}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                      title={language === 'tr' ? 'Sil' : 'Delete'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-mono line-clamp-3">
                  {post.content.substring(0, 200)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
