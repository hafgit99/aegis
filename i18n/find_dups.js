const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\hrn21\\OneDrive\\Desktop\\aegis-son-2\\aegis-vault\\i18n\\translations.ts', 'utf8');

const enMatch = content.match(/en: \{([\s\S]*?)\},/);
const trMatch = content.match(/tr: \{([\s\S]*?)\}/);

if (enMatch) {
    const enContent = enMatch[1];
    const keys = enContent.match(/^\s*([a-zA-Z0-9_]+):/gm).map(k => k.trim().replace(':', ''));
    const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
    console.log('EN Duplicates:', [...new Set(dups)]);
}

if (trMatch) {
    const trContent = trMatch[1];
    const keys = trContent.match(/^\s*([a-zA-Z0-9_]+):/gm).map(k => k.trim().replace(':', ''));
    const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
    console.log('TR Duplicates:', [...new Set(dups)]);
}
