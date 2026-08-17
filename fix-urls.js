const fs = require('fs');

const files = [
  'apps/web/src/app/dashboard/applications/[id]/page.tsx',
  'apps/web/src/app/dashboard/applications/ApplicationsTable.tsx',
  'apps/web/src/app/dashboard/saved-jobs/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\\\`https:\/\\\/\\\$\{([^\}]+)\}\\\`/g, "'https://' + $1");
  content = content.replace(/\\`https:\/\/\$\{([^\}]+)\}\\`/g, "'https://' + $1");
  fs.writeFileSync(file, content);
}
console.log('Fixed URLs.');
