import fs from 'node:fs';
const required=['index.html','app.js','boot.js','runtime-guard.js','core-safety-patch.js','menu.html','menu/index.html','diagnostico/index.html','launch.html','recover.html','safe.html','manifest.webmanifest','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','beta/index.html','beta/app.js','beta/boot.js','beta/config.js','beta/recover.html','beta/safe.html','beta/manifest.webmanifest','beta/icons/apple-touch-icon.png','beta/icons/icon-192.png','beta/icons/icon-512.png'];
const fail=m=>{console.error('VALIDATION ERROR:',m);process.exitCode=1;};
for(const f of required)if(!fs.existsSync(f)||fs.statSync(f).size===0)fail(`arquivo obrigatório ausente/vazio: ${f}`);
const read=f=>fs.readFileSync(f,'utf8');
const menu=read('menu.html');if(!menu.includes('Central de Diagnóstico'))fail('menu.html não contém o menu real');if(/url=\.\/menu\.html|location\.replace\(['"]\.\/menu\.html/.test(menu))fail('menu.html contém redirect para ele mesmo');if(menu.includes('app.js'))fail('menu.html não pode importar app.js');
const menuIndex=read('menu/index.html');if(!menuIndex.includes('../menu.html'))fail('/menu/index.html deve apontar para ../menu.html');
const index=read('index.html');if(!index.includes('./icons/apple-touch-icon.png'))fail('Oficial sem apple-touch-icon PNG');if(!index.includes('./boot.js'))fail('Oficial sem boot resiliente');if(index.includes('<script src="./app.js"'))fail('app.js não deve ser carregado diretamente pelo HTML');
const betaCfg=read('beta/config.js');if(!betaCfg.includes('simbolos.beta.library.v2'))fail('Beta não usa storage próprio');if(betaCfg.includes('storageKey:"simbolos.library.v2"'))fail('Beta reutiliza storage oficial');
for(const f of ['manifest.webmanifest','beta/manifest.webmanifest']){const m=JSON.parse(read(f));if(m.start_url!=='./')fail(`${f}: start_url precisa ser ./`);if(!m.icons?.some(x=>x.sizes==='192x192')||!m.icons?.some(x=>x.sizes==='512x512'))fail(`${f}: ícones 192/512 ausentes`);}
for(const f of ['recover.html','beta/recover.html']){const t=read(f);if(/localStorage\.clear\s*\(|indexedDB\.deleteDatabase\s*\(/.test(t))fail(`${f}: recuperação contém ação destrutiva`);}
for(const f of ['safe.html','beta/safe.html'])if(read(f).includes('app.js'))fail(`${f}: modo seguro não pode importar app.js`);
const sw=read('sw.js');if(sw.includes("addEventListener(\"fetch\"")||sw.includes("addEventListener('fetch'"))fail('SW de desenvolvimento não deve interceptar navegação');
const boot=read('boot.js');if(!boot.includes('unhandledrejection')||!boot.includes('withTimeout'))fail('boot não contém captura de erros/timeout');
console.log(process.exitCode?'Release inválida':'Release validada com sucesso.');
