import { useState } from 'react';
import { MessageCircle, Bug, Lightbulb, HelpCircle, Send, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';

export function FeedbackTab() {
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
      const response = await fetch('/api/app.mjs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'createFeedbackTicket',
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
      // Reset form after successful submission
      setTimeout(() => {
        setSubmitted(false);
        setTitle('');
        setDescription('');
        setPriority('medium');
        setActiveTab('feedback');
      }, 3000);
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
      <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-6 text-center">
        <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto mb-4">
          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
          {language === 'tr' ? 'Gönderildi!' : 'Submitted!'}
        </h3>
        <p className="text-green-700 dark:text-green-300">
          {language === 'tr' ? 'Talebiniz başarıyla gönderildi. En kısa sürede size dönüş yapacağız.' : 'Your request has been submitted successfully. We will get back to you soon.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
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
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
            {submitting ? (language === 'tr' ? 'Gönderiliyor...' : 'Submitting...') : (language === 'tr' ? 'Gönder' : 'Submit')}
          </button>
        </div>
      </div>
    </div>
  );
} 