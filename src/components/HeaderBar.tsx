import React from 'react';
import { ShieldCheck } from 'lucide-react';

export type AppViewMode = 'login' | 'exam' | 'summary' | 'teacher';

interface HeaderBarProps {
  currentView: AppViewMode;
  onNavigate: (view: AppViewMode) => void;
  hasActiveSession: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentView,
  onNavigate,
  hasActiveSession,
}) => {
  const scrollToSection = (id: string) => {
    if (currentView !== 'login') {
      onNavigate('login');
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="flex items-center gap-2 text-left text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
        >
          <ShieldCheck className="h-5 w-5 text-blue-700 shrink-0" aria-hidden="true" />
          <span className="font-display">EvalWeb TJKT</span>
        </button>

        {/* Zone 2: Concise Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => scrollToSection('tata-tertib')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:underline"
          >
            Panduan Ujian
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('cakupan-lkpd')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:underline"
          >
            Cakupan LKPD
          </button>
          <button
            type="button"
            onClick={() => onNavigate('teacher')}
            className={`transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:underline ${
              currentView === 'teacher'
                ? 'text-blue-700 font-semibold underline underline-offset-4'
                : 'hover:text-slate-900'
            }`}
          >
            Portal Guru
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {currentView === 'teacher' ? (
            <button
              type="button"
              onClick={() => onNavigate(hasActiveSession ? 'exam' : 'login')}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
            >
              {hasActiveSession ? 'Kembali ke Ujian' : 'Masuk Ruang Ujian'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('teacher')}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
            >
              Portal Guru
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
