const fs = require('fs');

const file = 'apps/extension/src/popup/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update imports
content = content.replace("import { FileText, Settings, ShieldAlert, Sparkles } from 'lucide-react';", "import { FileText, Settings, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';");

// Replace AnalyzingState
const oldComponent = `function AnalyzingState({ label }: { label: string }) {
  const stages = Object.values(STAGE_LABELS).filter((s) => s !== 'Done');
  const currentIndex = stages.indexOf(label);

  return (
    <div className="py-6">
      <ul className="mx-auto max-w-xs space-y-2">
        {stages.map((s, i) => {
          const done = currentIndex > i;
          const active = currentIndex === i;
          return (
            <li
              key={s}
              className={
                active ? 'text-sm font-medium text-fg' : done ? 'text-sm text-fg-subtle' : 'text-sm text-fg-subtle/60'
              }
            >
              <span className="mr-2 inline-block w-4 text-center">{done ? '✓' : active ? '›' : '·'}</span>
              {s}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 space-y-2 px-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}`;

const newComponent = `function AnalyzingState({ label }: { label: string }) {
  const stages = Object.values(STAGE_LABELS).filter((s) => s !== 'Done');
  const currentIndex = stages.indexOf(label);

  return (
    <div className="py-6">
      <div className="flex justify-center mb-6">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
          <div className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
          <FileText className="h-6 w-6 text-brand animate-pulse" />
        </div>
      </div>
      
      <div className="mx-auto max-w-xs space-y-3 px-4">
        {stages.map((s, i) => (
          <div key={s} className={\`flex items-center gap-3 transition-opacity duration-500 \${i <= currentIndex ? 'opacity-100' : 'opacity-30'}\`}>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              {i < currentIndex ? (
                 <CheckCircle2 className="h-4 w-4 text-brand" />
              ) : i === currentIndex ? (
                 <div className="h-4 w-4 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
              ) : (
                 <div className="h-4 w-4 rounded-full border-2 border-border"></div>
              )}
            </div>
            <span className={\`text-sm \${i === currentIndex ? 'text-fg font-medium animate-pulse' : 'text-fg-muted'}\`}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}`;

content = content.replace(oldComponent, newComponent);

fs.writeFileSync(file, content);
console.log('Fixed extension analyzer UI successfully.');
