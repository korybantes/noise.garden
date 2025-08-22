import { useState } from 'react';
import { MessageCircle, Bug, Lightbulb, HelpCircle, Send, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';

interface FeedbackSupportProps {
  onClose: () => void;
}

export function FeedbackSupport({ onClose }: FeedbackSupportProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'feedback' | 'bug_report' | 'support' | 'feature_request'>('feedback');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!user || !title.trim() || !description.trim()) {
      setError(language === 'tr' ? 'Lütfen başlık ve açıklama girin' : 'Please enter title and description');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'createTicket',
          args: {
            type: activeTab,
            title: title.trim(),
            description: description.trim(),
            priority
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit ticket');
      }

      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(language === 'tr' ? 'Gönderim başarısız oldu' : 'Submission failed');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'feedback': return <MessageCircle size={16} />;
      case 'bug_report': return <Bug size={16} />;
      case 'support': return <HelpCircle size={16} />;
      case 'feature_request': return <Lightbulb size={16} />;
      default: return <MessageCircle size={16} />;
    }
  };

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'feedback': return language === 'tr' ? 'Geri Bildirim' : 'Feedback';
      case 'bug_report': return language === 'tr' ? 'Hata Raporu' : 'Bug Report';
      case 'support': return language === 'tr' ? 'Destek' : 'Support';
      case 'feature_request': return language === 'tr' ? 'Özellik İsteği' : 'Feature Request';
      default: return language === 'tr' ? 'Geri Bildirim' : 'Feedback';
    }
  };

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case 'feedback': return language === 'tr' ? 'Genel geri bildirim ve önerilerinizi paylaşın' : 'Share general feedback and suggestions';
      case 'bug_report': return language === 'tr' ? 'Karşılaştığınız hataları bildirin' : 'Report bugs you encountered';
      case 'support': return language === 'tr' ? 'Hesap veya teknik sorunlar için destek alın' : 'Get support for account or technical issues';
      case 'feature_request': return language === 'tr' ? 'Yeni özellik önerilerinizi paylaşın' : 'Share suggestions for new features';
      default: return '';
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-6 text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto mb-4">
            <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {language === 'tr' ? 'Gönderildi!' : 'Submitted!'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {language === 'tr' ? 'Talebiniz başarıyla gönderildi. En kısa sürede size dönüş yapacağız.' : 'Your request has been submitted successfully. We will get back to you soon.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {language === 'tr' ? 'Geri Bildirim ve Destek' : 'Feedback & Support'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(['feedback', 'bug_report', 'support', 'feature_request'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {getTabIcon(tab)}
                {getTabTitle(tab)}
              </button>
            ))}
          </div>

          {/* Tab Description */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getTabDescription(activeTab)}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'tr' ? 'Başlık' : 'Title'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === 'tr' ? 'Kısa ve açıklayıcı bir başlık girin' : 'Enter a short, descriptive title'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'tr' ? 'Açıklama' : 'Description'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === 'tr' ? 'Detaylı açıklama girin...' : 'Enter detailed description...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={6}
                maxLength={1000}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description.length}/1000
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'tr' ? 'Öncelik' : 'Priority'}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">{language === 'tr' ? 'Düşük' : 'Low'}</option>
                <option value="medium">{language === 'tr' ? 'Orta' : 'Medium'}</option>
                <option value="high">{language === 'tr' ? 'Yüksek' : 'High'}</option>
                <option value="urgent">{language === 'tr' ? 'Acil' : 'Urgent'}</option>
              </select>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium text-sm transition-colors"
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !description.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
                {submitting ? (language === 'tr' ? 'Gönderiliyor...' : 'Submitting...') : (language === 'tr' ? 'Gönder' : 'Submit')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 