import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, MessageSquare, Heart, CheckCircle, ArrowRight } from 'lucide-react';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';

interface WelcomeStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

export default function Welcome() {
  const [currentStep, setCurrentStep] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();

  const steps: WelcomeStep[] = [
    {
      id: 'welcome',
      icon: <Heart size={32} />,
      title: t('welcomeToNoiseGarden', language),
      description: t('welcomeDescription', language),
      color: 'from-pink-500 to-rose-500'
    },
    {
      id: 'community',
      icon: <Users size={32} />,
      title: t('communityFirst', language),
      description: t('communityDescription', language),
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'guidelines',
      icon: <Shield size={32} />,
      title: t('communityGuidelines', language),
      description: t('guidelinesDescription', language),
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'features',
      icon: <MessageSquare size={32} />,
      title: t('keyFeatures', language),
      description: t('featuresDescription', language),
      color: 'from-purple-500 to-violet-500'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGetStarted = () => {
    if (acceptedTerms) {
      // Mark as completed for this device
      localStorage.setItem('welcome_completed', 'true');
      navigate('/app');
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-800 h-1">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8">
        {/* Step content */}
        <div className="text-center mb-8">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br ${currentStepData.color} flex items-center justify-center text-white shadow-lg`}>
            {currentStepData.icon}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-mono">
            {currentStepData.title}
          </h1>
          
          <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed max-w-md mx-auto">
            {currentStepData.description}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center space-x-2 mb-8">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index <= currentStep 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              currentStep === 0
                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t('previous', language)}
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 flex items-center gap-2"
            >
              {t('next', language)}
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleGetStarted}
              disabled={!acceptedTerms}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                acceptedTerms
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {t('getStarted', language)}
              <CheckCircle size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Terms acceptance (only on last step) */}
      {currentStep === steps.length - 1 && (
        <div className="px-6 pb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2"
              />
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">{t('iAccept', language)} </span>
                <button
                  type="button"
                  onClick={() => navigate('/terms')}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('termsOfService', language)}
                </button>
                <span> {t('and', language)} </span>
                <button
                  type="button"
                  onClick={() => navigate('/privacy')}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('privacyPolicy', language)}
                </button>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
} 