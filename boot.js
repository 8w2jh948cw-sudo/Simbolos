(()=>{
  const cfg=window.APP_CONFIG||{env:"official",label:"Oficial",release:"?",assetRoot:"./",cachePrefix:"simbolos-",scopeNeedle:"/Simbolos/"};
  const started=performance.now();
  const logs=window.__SIMBOLOS_BOOT__={release:cfg.release,env:cfg.env,errors:[],steps:[],timings:{}};
  const $=id=>document.getElementById(id);
  const status=$("bootStatus"),progress=$("bootProgress"),failure=$("bootFailure"),screen=$("bootScreen");
  window.addEventListener("error",e=>logs.errors.push({type:"error",message:e.message||String(e.error||"Erro"),at:Date.now()}));
  window.addEventListener("unhandledrejection",e=>logs.errors.push({type:"promise",message:String(e.reason?.message||e.reason||"Promise rejeitada"),at:Date.now()}));
  const setStep=(id,state,text)=>{const el=$(id);if(el){el.dataset.state=state;const s=el.querySelector("span:last-child");if(s&&text)s.textContent=text;}logs.steps.push({id,state,text,at:Math.round(performance.now()-started)});};
  const setProgress=n=>{if(progress)progress.style.width=`${Math.max(4,Math.min(100,n))}%`;};
  const withTimeout=(promise,ms,label)=>Promise.race([Promise.resolve(promise),new Promise(resolve=>setTimeout(()=>resolve({timedOut:true,label}),ms))]);
  const loadScript=(src,timeout=5000)=>new Promise((resolve,reject)=>{const s=document.createElement("script");let done=false;const finish=(ok,error)=>{if(done)return;done=true;clearTimeout(timer);ok?resolve():reject(error||new Error(`Falha ao carregar ${src}`));};const timer=setTimeout(()=>{s.remove();finish(false,new Error(`Timeout: ${src}`));},timeout);s.src=src;s.async=false;s.onload=()=>finish(true);s.onerror=()=>finish(false,new Error(`HTTP/arquivo: ${src}`));document.head.appendChild(s);});
  async function cleanRuntime(){
    const result={registrations:0,caches:0};
    try{if("serviceWorker" in navigator){const regs=await navigator.serviceWorker.getRegistrations();const own=regs.filter(r=>String(r.scope).includes(cfg.scopeNeedle||"/Simbolos/"));result.registrations=own.length;await Promise.allSettled(own.map(r=>r.unregister()));}}catch(e){result.swError=String(e.message||e);}
    try{if("caches" in window){const keys=await caches.keys();const own=keys.filter(k=>k.startsWith(cfg.cachePrefix||"simbolos-"));result.caches=own.length;await Promise.allSettled(own.map(k=>caches.delete(k)));}}catch(e){result.cacheError=String(e.message||e);}
    return result;
  }
  async function storageCheck(){
    const out={localStorage:false,indexedDB:typeof indexedDB!=="undefined"};
    try{const k="__simbolos_boot_test__";localStorage.setItem(k,"1");out.localStorage=localStorage.getItem(k)==="1";localStorage.removeItem(k);}catch(e){out.error=String(e.message||e);}return out;
  }
  function looksFunctional(){return !!(document.querySelector(".app-shell")&&document.getElementById("symbolGrid")&&document.getElementById("addButton")&&document.getElementById("editorDialog")&&document.getElementById("symbolCount"));}
  function fail(message){setProgress(100);if(status)status.textContent="O app não conseguiu concluir a inicialização.";if(failure){failure.hidden=false;failure.querySelector("strong").textContent=message;}setStep("stepInterface","error","Falha detectada");document.documentElement.dataset.boot="failed";}
  async function patch(name,file){const t=performance.now();try{await loadScript(cfg.assetRoot+file,3500);logs.timings[name]=Math.round(performance.now()-t);return true;}catch(e){logs.errors.push({type:"patch",name,message:String(e.message||e)});return false;}}
  async function run(){
    document.documentElement.dataset.env=cfg.env;document.documentElement.dataset.boot="running";
    const release=$("releaseBadge"),env=$("environmentBadge");if(release)release.textContent=`v${cfg.release}`;if(env)env.textContent=cfg.label||cfg.env;
    setStep("stepHtml","ok","HTML carregado");setProgress(14);
    const maintenance=withTimeout(cleanRuntime(),1800,"runtime").then(r=>{logs.runtime=r;if(r?.timedOut)setStep("stepWeb","warn","Limpeza em segundo plano");else setStep("stepWeb","ok",r.registrations||r.caches?"Runtime antigo removido":"Ambiente limpo");});
    setStep("stepWeb","running","Verificando runtime");
    const storage=await storageCheck();logs.storage=storage;setStep("stepData",storage.localStorage?"ok":"warn",storage.localStorage?"Dados locais acessíveis":"Storage com restrição");setProgress(30);
    try{await loadScript(cfg.assetRoot+"runtime-guard.js",3000);}catch(e){logs.errors.push({type:"guard",message:String(e.message||e)});}
    setStep("stepEngine","running","Carregando motor");setProgress(42);
    const coreStart=performance.now();
    try{await loadScript(cfg.assetRoot+"app.js",5500);logs.timings.app=Math.round(performance.now()-coreStart);setStep("stepEngine","ok","Motor carregado");}catch(e){logs.errors.push({type:"core",message:String(e.message||e)});fail("Falha ao carregar app.js. Use Diagnóstico ou Modo Seguro.");return;}
    setProgress(66);setStep("stepPatches","running","Aplicando correções");
    await patch("core-safety","core-safety-patch.js");
    await patch("enhancements","enhancements.js");
    await patch("clipboard","clipboard-polish.js");
    setStep("stepPatches","ok","Correções concluídas");setProgress(88);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    if(!looksFunctional()){fail("O motor carregou, mas a interface essencial não foi encontrada.");return;}
    setStep("stepInterface","ok","Interface funcional");setProgress(100);logs.timings.total=Math.round(performance.now()-started);document.documentElement.dataset.boot="ready";
    setTimeout(()=>{if(screen){screen.classList.add("boot-done");setTimeout(()=>screen.remove(),260);}},120);
    maintenance.catch(()=>{});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
})();
