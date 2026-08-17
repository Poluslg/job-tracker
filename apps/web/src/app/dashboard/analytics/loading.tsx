import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function AnalyticsLoading() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Patterns across your own search. Small samples move these numbers a lot — read them as signals, not conclusions."
      />
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative flex items-end justify-center gap-2 h-24">
          <div className="w-6 bg-brand rounded-t-md animate-[pulse_1.2s_ease-in-out_infinite]" style={{ height: '40%' }}></div>
          <div className="w-6 bg-brand rounded-t-md animate-[pulse_1.2s_ease-in-out_0.2s_infinite]" style={{ height: '70%' }}></div>
          <div className="w-6 bg-brand rounded-t-md animate-[pulse_1.2s_ease-in-out_0.4s_infinite]" style={{ height: '100%' }}></div>
          <div className="w-6 bg-brand rounded-t-md animate-[pulse_1.2s_ease-in-out_0.6s_infinite]" style={{ height: '60%' }}></div>
          
          <div className="absolute inset-0 flex items-center justify-center mix-blend-overlay">
            <BarChart3 className="w-12 h-12 text-white opacity-50" />
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-xl font-semibold text-fg animate-pulse">Crunching your numbers...</h3>
          <p className="text-sm text-fg-muted max-w-sm text-center">
            We are analyzing your applications, responses, and job data to generate insights for your dashboard.
          </p>
        </div>
      </div>
    </>
  );
}
