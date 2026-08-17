const fs = require('fs');

const file = 'apps/web/src/app/dashboard/resume/profileEditor.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file currently has some messed up tab wrappers.
// Let's strip ALL the <TabPanel> stuff I added and re-apply them correctly.

content = content.replace(/<Tabs items=\{tabItems\}.*?\/>\s*/g, '');
content = content.replace(/<TabPanel.*?>\s*<div className="space-y-4">\s*/g, '');
content = content.replace(/<\/div>\s*<\/TabPanel>\s*/g, '');

// Now we have the original clean structure. We can inject the tabs and TabPanels using string splitting.

const parts = content.split('<Card>');

if (parts.length > 7) {
  // parts[0] is everything up to the first <Card>
  
  // parts[1] is Contact
  // parts[2] is Summary
  // parts[3] is Skills
  // parts[4] is Experience
  // parts[5] is Education
  // parts[6] is Projects
  // parts[7] is Certifications
  // parts[8] is Languages

  // We want:
  // basics: Contact, Summary
  // experience: Experience
  // education: Education, Certifications
  // projects: Projects
  // skills: Skills, Languages

  let newContent = parts[0];
  newContent += '<Tabs items={tabItems} active={activeTab} onChange={setActiveTab} />\n';
  
  newContent += '<TabPanel id="basics" active={activeTab}>\n<div className="space-y-4">\n<Card>';
  newContent += parts[1] + '<Card>' + parts[2];
  newContent += '</div>\n</TabPanel>\n\n';

  newContent += '<TabPanel id="experience" active={activeTab}>\n<div className="space-y-4">\n<Card>';
  newContent += parts[4];
  newContent += '</div>\n</TabPanel>\n\n';

  newContent += '<TabPanel id="education" active={activeTab}>\n<div className="space-y-4">\n<Card>';
  newContent += parts[5] + '<Card>' + parts[7];
  newContent += '</div>\n</TabPanel>\n\n';

  newContent += '<TabPanel id="projects" active={activeTab}>\n<div className="space-y-4">\n<Card>';
  newContent += parts[6];
  newContent += '</div>\n</TabPanel>\n\n';

  newContent += '<TabPanel id="skills" active={activeTab}>\n<div className="space-y-4">\n<Card>';
  newContent += parts[3] + '<Card>' + parts[8];
  newContent += '</div>\n</TabPanel>\n\n';

  fs.writeFileSync(file, newContent);
  console.log('Fixed tabs structure successfully.');
} else {
  console.log('Could not parse file structure.');
}
