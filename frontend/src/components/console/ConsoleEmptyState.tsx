/**
 * Console 全局 Empty State 组件 —— 当后端 API 返回空表时使用。
 * ⚠️ Phase 1 **严禁** 用假数据填充，只显示 "No data yet" + 清晰行动指引（Phase 2+ 会提供真实数据源）。
 */
import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  loading?: boolean;
  error?: string | null;
  action?: { label: string; onClick?: () => void; disabled?: boolean };
  secondaryAction?: { label: string; onClick?: () => void };
  testId?: string;
}

export const ConsoleEmptyState: React.FC<Props> = ({
  icon: Icon, title, description, loading, error, action, secondaryAction, testId,
}) => {
  return (
    <div
      data-testid={testId}
      data-state={loading ? 'loading' : error ? 'error' : 'empty'}
      className="bg-white rounded-[2px] border border-ceramic-border
                 flex flex-col items-center justify-center text-center
                 px-8 py-16 md:px-16 md:py-24"
    >
      <div className="w-16 h-16 rounded-full bg-ceramic-cream border border-ceramic-border
                      flex items-center justify-center mb-6 relative">
        {loading ? (
          <Loader2 className="w-7 h-7 text-ceramic-gold-matte animate-spin" />
        ) : error ? (
          <Icon className="w-7 h-7 text-rose-500" />
        ) : (
          <Icon className="w-7 h-7 text-ceramic-ash" />
        )}
      </div>

      <h3 className="serif-heading text-[22px] md:text-[26px] text-ceramic-graphite mb-3">
        {loading ? 'Loading…' : error ? 'Failed to load' : title}
      </h3>

      <p className="text-[14px] text-ceramic-ash max-w-md leading-relaxed">
        {loading ? 'Fetching latest data from backend…' : (error ?? description)}
      </p>

      {(action || secondaryAction) && (
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          {action && (
            <button
              disabled={loading || !!action.disabled}
              onClick={action.onClick}
              className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              disabled={loading}
              onClick={secondaryAction.onClick}
              className="btn-gold-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ConsoleEmptyState;
