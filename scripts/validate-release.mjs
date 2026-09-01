import fs from 'node:fs';

const required=[
  'index.html','app.js','boot.js','runtime-guard.js','core-safety-patch.js',
  'menu.html','menu/index.html','diagnostico/index.html','launch.html','recover.html','safe.html',
  'manifest.webmanifest','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png',
  'beta/index.html','beta/app.js','beta/boot.js','beta/config.js','beta/recover.html','beta/safe.html','beta/manage.html',
  'beta/manifest.webmanifest','beta/icons/apple-touch-icon.png','beta/icons/icon-192.png','beta/icons/icon-512.png'
];

const fail=m=>{console.error('VALIDATION ERROR:',m);process.exitCode=1;};
for(const f of required){
  if(!fs.existsSync(f)||fs.statSync(f).size===0) fail(`arquivo obrigatório ausente/vazio: ${f}`);
}
const read=f=>fs.readFileSync(f,'utf8');
const scriptBodies=html=>[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
const importsApp=html=>/<script\b[^>]*\bsrc\s*=\s*["'][^"']*app\.js(?:[?"'])/i.test(html);
const hasDestructiveStorageCall=html=>{
  const js=scriptBodies(html);
  return /\blocalStorage\s*\.\s*clear\s*\(/.test(js)||/\bindexedDB\s*\.\s*deleteDatabase\s*\(/.test(js);
};
const pngSize=file=>{
  const b=fs.readFileSync(file);
  if(b.length<24||b.toString('hex',0,8)!=='89504e470d0a1a0a') return null;
  return [b.readUInt32BE(16),b.readUInt32BE(20)];
};

const menu=read('menu.html');
if(!menu.includes('Central de Diagnóstico')) fail('menu.html não contém o menu real');
if(/url=\.\/menu\.html|location\.replace\(['"]\.\/menu\.html/.test(menu)) fail('menu.html contém redirect para ele mesmo');
if(importsApp(menu)) fail('menu.html não pode importar app.js');

const menuIndex=read('menu/index.html');
if(!menuIndex.includes('../menu.html')) fail('/menu/index.html deve apontar para ../menu.html');

const index=read('index.html');
if(!index.includes('./icons/apple-touch-icon.png')) fail('Oficial sem apple-touch-icon PNG');
if(!index.includes('./boot.js')) fail('Oficial sem boot resiliente');
if(importsApp(index)) fail('app.js não deve ser carregado diretamente pelo HTML');

const betaIndex=read('beta/index.html');
if(!betaIndex.includes('./icons/apple-touch-icon.png')) fail('Beta sem apple-touch-icon PNG próprio');
if(!betaIndex.includes('./boot.js')) fail('Beta sem boot resiliente');
if(importsApp(betaIndex)) fail('beta/app.js não deve ser carregado diretamente pelo HTML');

const betaCfg=read('beta/config.js');
if(!betaCfg.includes('simbolos.beta.library.v2')) fail('Beta não usa storage próprio');
if(betaCfg.includes('storageKey:"simbolos.library.v2"')) fail('Beta reutiliza storage oficial');
if(!betaCfg.includes('"simbolos.library.v2":"simbolos.beta.library.v2"')) fail('Beta não intercepta a chave hardcoded do motor legado');

for(const f of ['manifest.webmanifest','beta/manifest.webmanifest']){
  const m=JSON.parse(read(f));
  if(m.start_url!=='./') fail(`${f}: start_url precisa ser ./`);
  if(m.scope!=='./') fail(`${f}: scope precisa ser ./`);
  if(!m.icons?.some(x=>x.sizes==='192x192')||!m.icons?.some(x=>x.sizes==='512x512')) fail(`${f}: ícones 192/512 ausentes`);
}

for(const [file,w,h] of [
  ['icons/apple-touch-icon.png',180,180],['icons/icon-192.png',192,192],['icons/icon-512.png',512,512],
  ['beta/icons/apple-touch-icon.png',180,180],['beta/icons/icon-192.png',192,192],['beta/icons/icon-512.png',512,512]
]){
  const size=pngSize(file);
  if(!size||size[0]!==w||size[1]!==h) fail(`${file}: PNG inválido ou dimensão incorreta`);
}
if(fs.readFileSync('icons/apple-touch-icon.png').equals(fs.readFileSync('beta/icons/apple-touch-icon.png'))) fail('ícone Beta precisa ser visualmente distinto do Oficial');

for(const f of ['recover.html','beta/recover.html']){
  const t=read(f);
  if(hasDestructiveStorageCall(t)) fail(`${f}: recuperação contém chamada destrutiva de storage`);
}
for(const f of ['safe.html','beta/safe.html']){
  if(importsApp(read(f))) fail(`${f}: modo seguro não pode importar app.js`);
}

const sw=read('sw.js');
if(/addEventListener\s*\(\s*["']fetch["']/.test(sw)) fail('SW de desenvolvimento não deve interceptar navegação');

const boot=read('boot.js');
if(!boot.includes('unhandledrejection')||!boot.includes('withTimeout')) fail('boot não contém captura de erros/timeout');
if(!boot.includes('looksFunctional')) fail('boot não valida interface funcional');

const guard=read('runtime-guard.js');
if(!guard.includes('Storage.prototype')||!guard.includes('serviceWorker')) fail('runtime guard incompleto');

const manager=read('beta/manage.html');
const managerJs=scriptBodies(manager);
if(!managerJs.includes("simbolos.beta.library.v2")) fail('gerenciador Beta não aponta para base Beta');
if(/localStorage\s*\.\s*removeItem\s*\(\s*OFF\s*\)/.test(managerJs)) fail('gerenciador Beta pode apagar a base Oficial');

console.log(process.exitCode?'Release inválida':'Release validada com sucesso.');
