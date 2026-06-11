const fs = require('fs');
const path = './src/components/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/#262626/g, '#e5e7eb');
content = content.replace(/#121214/g, '#ffffff');
content = content.replace(/#1a1a1c/g, '#f3f4f6');
content = content.replace(/#e2e2e2/g, '#111827');
content = content.replace(/#0a0a0b/g, '#f9fafb');

fs.writeFileSync(path, content, 'utf8');
console.log('replaced colors completely');
