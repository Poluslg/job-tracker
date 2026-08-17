const fs = require('fs');

const file = 'apps/web/src/app/dashboard/analyzer/Analyzer.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix imports
content = content.replace("import { useState } from 'react';", "import { useState, useEffect } from 'react';");

// Define the new component correctly
const newComponent = `function AnalyzerLoading() {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => Math.min(prev + 1, STAGES.length - 1));
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card>
      <CardBody className="space-y-6 py-8">
        <div className="flex justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
            <div className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
            <FileText className="h-6 w-6 text-brand animate-pulse" />
          </div>
        </div>
        
        <div className="space-y-3 px-4">
          {STAGES.map((stage, i) => (
            <div key={stage} className={\`flex items-center gap-3 transition-opacity duration-500 \${i <= currentStage ? 'opacity-100' : 'opacity-30'}\`}>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                {i < currentStage ? (
                   <CheckCircle2 className="h-4 w-4 text-brand" />
                ) : i === currentStage ? (
                   <div className="h-4 w-4 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
                ) : (
                   <div className="h-4 w-4 rounded-full border-2 border-border"></div>
                )}
              </div>
              <span className={\`text-sm \${i === currentStage ? 'text-fg font-medium animate-pulse' : 'text-fg-muted'}\`}>
                {stage}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}`;

content = content.replace(/function AnalyzerLoading\(\) \{[\s\S]*?\}/, newComponent);

// Now replace the usage in the render method
const oldUsage = `{busy && (
            <Card>
              <CardBody className="space-y-3">
                <ul className="space-y-1.5">
                  {STAGES.map((stage) => (
                    <li key={stage} className="text-sm text-fg-muted">
                      · {stage}
                    </li>
                  ))}
                </ul>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </CardBody>
            </Card>
          )}`;

content = content.replace(oldUsage, '{busy && <AnalyzerLoading />}');

fs.writeFileSync(file, content);
console.log('Fixed Analyzer loading UI successfully.');
