const fs = require('fs');

const file1 = 'apps/extension/src/components/ProviderSetup.tsx';
let c1 = fs.readFileSync(file1, 'utf8');
c1 = c1.replace(/\\\`e\.g\.\ \\\$\{meta\.defaultModel\}\\\`/g, "'e.g. ' + meta.defaultModel");
fs.writeFileSync(file1, c1);

const file2 = 'apps/web/src/app/dashboard/settings/SettingsForm.tsx';
let c2 = fs.readFileSync(file2, 'utf8');
c2 = c2.replace(/\\\`e\.g\.\ \\\$\{meta\.defaultModel\}\\\`/g, "'e.g. ' + meta.defaultModel");
fs.writeFileSync(file2, c2);

console.log('Fixed syntax errors.');
