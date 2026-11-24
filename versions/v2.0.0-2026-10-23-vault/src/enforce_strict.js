'use strict';

const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

let updatedCount = 0;
files.forEach(file => {
  const filePath = path.join(srcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('use strict')) {
    fs.writeFileSync(filePath, `'use strict';\n` + content);
    console.log(`[STRICT ENFORCED] Added 'use strict'; to ${file}`);
    updatedCount++;
  }
});

console.log(`Successfully enforced strict mode on ${updatedCount} files.`);
