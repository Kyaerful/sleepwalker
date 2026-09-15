import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for (const file of ['index.html','bg.jpg']) await copyFile(file,`dist/${file}`);
console.log('Built site in dist/. Server functions are deployed separately by Netlify.');
