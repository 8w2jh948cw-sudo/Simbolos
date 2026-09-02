const STORAGE_KEY = "simbolos.library.v2";
const LEGACY_KEY = "simbolos.library.v1";
const $ = s => document.querySelector(s);
const clone = value => JSON.parse(JSON.stringify(value));

const els = {
  grid: $("#symbolGrid"), empty: $("#emptyState"), noResults: $("#noResultsState"), count: $("#symbolCount"), search: $("#searchInput"), clearSearch: $("#clearSearchButton"),
  add: $("#addButton"), emptyAdd: $("#emptyAddButton"), libraryButton: $("#libraryButton"), libraryMenu: $("#libraryMenu"), exportButton: $("#exportButton"), importButton: $("#importButton"), importFile: $("#importFileInput"), aboutStorage: $("#aboutStorageButton"),
  editor: $("#editorDialog"), editorTitle: $("#editorTitle"), cancel: $("#cancelEditorButton"), save: $("#saveSymbolButton"), name: $("#nameInput"), variantTabs: $("#variantTabs"), addVariant: $("#addVariantButton"), variantLabel: $("#variantLabelInput"), defaultVariant: $("#defaultVariantInput"),
  svg: $("#svgInput"), paste: $("#pasteButton"), format: $("#formatButton"), preview: $("#svgPreview"), previewColor: $("#previewColorInput"), previewStatus: $("#previewStatus"), previewVariantName: $("#previewVariantName"), fixedColor: $("#fixedColorInput"), cleanup: $("#cleanupInput"),
  strokeControls: $("#strokeControls"), strokeInput: $("#strokeWidthInput"), strokeOutput: $("#strokeWidthOutput"), restoreStroke: $("#restoreStrokeButton"), analysisChips: $("#analysisChips"), analysisText: $("#analysisText"), output: $("#outputCode code"), copyOutput: $("#copyOutputButton"), deleteVariant: $("#deleteVariantButton"), deleteSymbol: $("#deleteSymbolButton"),
  copyDialog: $("#copyVariantsDialog"), copyTitle: $("#copyVariantsTitle"), copyList: $("#copyVariantsList"), closeCopyDialog: $("#closeCopyVariantsButton"), info: $("#infoDialog"), closeInfo: $("#closeInfoButton"), toast: $("#toast"), template: $("#symbolCardTemplate")
};

let items = loadItems();
let draft = null;
let activeVariantId = null;
let toastTimer = null;

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function defaultOptions(){ return { colorMode:"currentColor", sizeMode:"24", fixedColor:"#111111", cleanup:true, strokeOverride:null }; }
function normalizeOptions(value){ const source=value&&typeof value==="object"&&!Array.isArray(value)?value:{},stroke=Number(source.strokeOverride);return {colorMode:["currentColor","original","fixed"].includes(source.colorMode)?source.colorMode:"currentColor",sizeMode:["24","1em","original"].includes(source.sizeMode)?source.sizeMode:"24",fixedColor:typeof source.fixedColor==="string"&&/^#[0-9a-f]{6}$/i.test(source.fixedColor)?source.fixedColor:"#111111",cleanup:source.cleanup!==false,strokeOverride:source.strokeOverride!=null&&Number.isFinite(stroke)?Math.min(4,Math.max(.5,stroke)):null}; }
function newVariant(label="Padrão"){ return { id:uid(), label, originalSvg:"", finalSvg:"", options:defaultOptions(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }; }
function normalizeItem(item){
  if(!item||typeof item!=="object"||Array.isArray(item))return null;
  if (Array.isArray(item.variants) && item.variants.length) {
    item.variants = item.variants.filter(v=>v&&typeof v==="object"&&!Array.isArray(v)).map(v => ({ id:typeof v.id==="string"&&v.id?v.id:uid(), label:typeof v.label==="string"&&v.label.trim()?v.label.trim().slice(0,40):"Padrão", originalSvg:typeof v.originalSvg==="string"?v.originalSvg:"", finalSvg:typeof v.finalSvg==="string"?v.finalSvg:"", options:normalizeOptions(v.options), createdAt:typeof v.createdAt==="string"?v.createdAt:new Date().toISOString(), updatedAt:typeof v.updatedAt==="string"?v.updatedAt:new Date().toISOString() }));
    if(!item.variants.length)return null;
    item.id=typeof item.id==="string"&&item.id?item.id:uid();
    item.name=typeof item.name==="string"&&item.name.trim()?item.name.trim().slice(0,80):"Sem título";
    item.createdAt=typeof item.createdAt==="string"?item.createdAt:new Date().toISOString();
    item.updatedAt=typeof item.updatedAt==="string"?item.updatedAt:new Date().toISOString();
    item.defaultVariantId = item.variants.some(v=>v.id===item.defaultVariantId) ? item.defaultVariantId : item.variants[0].id;
    return item;
  }
  if (typeof item.originalSvg === "string") {
    const v = { id:uid(), label:"Padrão", originalSvg:item.originalSvg, finalSvg:typeof item.finalSvg==="string"?item.finalSvg:item.originalSvg, options:normalizeOptions(item.options), createdAt:typeof item.createdAt==="string"?item.createdAt:new Date().toISOString(), updatedAt:typeof item.updatedAt==="string"?item.updatedAt:new Date().toISOString() };
    return { id:typeof item.id==="string"&&item.id?item.id:uid(), name:typeof item.name==="string"&&item.name.trim()?item.name.trim().slice(0,80):"Sem título", variants:[v], defaultVariantId:v.id, createdAt:v.createdAt, updatedAt:v.updatedAt };
  }
  return null;
}
function loadItems(){
  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||"null");return Array.isArray(value)?value:null;}catch{return null;}};
  const current=read(STORAGE_KEY),legacy=current===null?read(LEGACY_KEY):null,raw=current??legacy??[];
  const normalized=raw.map(normalizeItem).filter(Boolean);
  if(current===null&&legacy!==null){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(normalized));}catch{}}
  return normalized;
}
function persist(nextItems=items){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(nextItems));return true;}catch(error){console.warn("Não foi possível salvar a biblioteca:",error);return false;} }
function showToast(message){ clearTimeout(toastTimer); els.toast.textContent=message; els.toast.hidden=false; toastTimer=setTimeout(()=>els.toast.hidden=true,1800); }
async function copyText(text){
  if (!text) throw new Error("empty");
  if (navigator.clipboard?.writeText) { try{await navigator.clipboard.writeText(text);return;}catch{} }
  const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select();
  const ok=document.execCommand("copy"); ta.remove(); if(!ok) throw new Error("copy");
}
function parseSvg(code){
  const source=String(code||"").trim(); if(!source) return {ok:false,error:"Cole um código SVG."};
  const doc=new DOMParser().parseFromString(source,"image/svg+xml"); if(doc.querySelector("parsererror")) return {ok:false,error:"O código não é um SVG válido."};
  const root=doc.documentElement; if(!root||root.localName.toLowerCase()!=="svg") return {ok:false,error:"O código precisa começar com <svg>."};
  return {ok:true,root};
}
function hasUnsafeUrl(value){ return [...String(value||"").matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi)].some(match=>!match[2].trim().startsWith("#")); }
function sanitize(root,cleanup=true){
  const out=root.cloneNode(true); out.querySelectorAll("script,style,foreignObject,iframe,object,embed,audio,video,animate,animateMotion,animateTransform,set,discard,mpath").forEach(el=>el.remove());
  if(cleanup) out.querySelectorAll("metadata,title,desc").forEach(el=>el.remove());
  [out,...out.querySelectorAll("*")].forEach(el=>[...el.attributes].forEach(attr=>{
    const n=attr.name.toLowerCase(),v=String(attr.value||"").trim();
    if(n.startsWith("on")) el.removeAttribute(attr.name);
    if((n==="href"||n.endsWith(":href"))&&!v.startsWith("#")) el.removeAttribute(attr.name);
    if(hasUnsafeUrl(v)) el.removeAttribute(attr.name);
    if(cleanup&&(n==="class"||n.startsWith("data-"))) el.removeAttribute(attr.name);
  }));
  return out;
}
function isSolidPaint(value){ if(!value)return false; const v=value.trim().toLowerCase(); return !["none","transparent","currentcolor","inherit","initial","unset"].includes(v)&&!v.startsWith("url("); }
function styleProperty(el,name){ const match=String(el.getAttribute("style")||"").match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`,"i"));return match?match[1].trim():null; }
function applyPaint(root,mode,fixedColor){
  if(mode==="original")return; const target=mode==="currentColor"?"currentColor":fixedColor;
  [root,...root.querySelectorAll("*")].forEach(el=>{
    ["fill","stroke"].forEach(attr=>{ const value=el.getAttribute(attr); if(isSolidPaint(value)) el.setAttribute(attr,target); });
    const style=el.getAttribute("style"); if(style){ let next=style.replace(/(fill\s*:\s*)(?!none\b|transparent\b|currentColor\b|url\()[^;]+/gi,`$1${target}`); next=next.replace(/(stroke\s*:\s*)(?!none\b|transparent\b|currentColor\b|url\()[^;]+/gi,`$1${target}`); el.setAttribute("style",next); }
  });
  const nodes=[root,...root.querySelectorAll("*")]; if(!nodes.some(el=>el.hasAttribute("fill"))&&!nodes.some(el=>el.hasAttribute("stroke"))) root.setAttribute("fill",target);
}
function applySize(root,mode){ if(mode==="1em"){root.setAttribute("width","1em");root.setAttribute("height","1em");} else if(mode==="24"){root.setAttribute("width","24");root.setAttribute("height","24");} }
function applyStroke(root,width){ if(width==null)return; [root,...root.querySelectorAll("*")].forEach(el=>{ const stroke=el.getAttribute("stroke")||styleProperty(el,"stroke"); if(stroke&&stroke.toLowerCase()!=="none") el.setAttribute("stroke-width",String(width)); }); }
function serializeSvg(root){ if(!root.hasAttribute("xmlns"))root.setAttribute("xmlns","http://www.w3.org/2000/svg"); return new XMLSerializer().serializeToString(root).replace(/></g,">\n<"); }
function analyzeSvg(root){
  const nodes=[root,...root.querySelectorAll("*")],fills=nodes.map(el=>el.getAttribute("fill")||styleProperty(el,"fill")).filter(Boolean),strokes=nodes.map(el=>el.getAttribute("stroke")||styleProperty(el,"stroke")).filter(v=>v&&v.toLowerCase()!=="none"),widths=nodes.map(el=>el.getAttribute("stroke-width")||styleProperty(el,"stroke-width")).filter(v=>v!=null&&v!=="").map(Number).filter(Number.isFinite);
  return { paths:root.querySelectorAll("path").length, viewBox:root.getAttribute("viewBox")||"sem viewBox", hasStroke:strokes.length>0, usesCurrent:[...fills,...strokes].some(v=>v.toLowerCase()==="currentcolor"), hasMultiColor:new Set([...fills,...strokes].filter(isSolidPaint).map(v=>v.toLowerCase())).size>1, strokeWidth:widths[0]||1.5 };
}
function transformSvg(svg,options){
  const parsed=parseSvg(svg); if(!parsed.ok)return {ok:false,error:parsed.error,output:"",analysis:null};
  const analysis=analyzeSvg(parsed.root),root=sanitize(parsed.root,options.cleanup!==false); applyPaint(root,options.colorMode||"currentColor",options.fixedColor||"#111111"); applySize(root,options.sizeMode||"24"); applyStroke(root,options.strokeOverride);
  return {ok:true,output:serializeSvg(root),analysis};
}
function getRadio(name){ return document.querySelector(`input[name="${name}"]:checked`)?.value; }
function setRadio(name,value){ const input=document.querySelector(`input[name="${name}"][value="${value}"]`); if(input)input.checked=true; }
function currentVariant(){ return draft?.variants.find(v=>v.id===activeVariantId)||null; }
function optionsFromUI(){ return { colorMode:getRadio("colorMode"), sizeMode:getRadio("sizeMode"), fixedColor:els.fixedColor.value, cleanup:els.cleanup.checked, strokeOverride:els.strokeInput.dataset.override==="true"?Number(els.strokeInput.value):null }; }
function stashCurrent(){
  const v=currentVariant(); if(!v)return; v.label=els.variantLabel.value.trim()||"Sem nome"; v.originalSvg=els.svg.value.trim(); v.options=optionsFromUI(); const transformed=transformSvg(v.originalSvg,v.options); v.finalSvg=transformed.ok?transformed.output:""; v.updatedAt=new Date().toISOString();
  if(els.defaultVariant.checked) draft.defaultVariantId=v.id;
}
function loadVariantToUI(id){
  const v=draft?.variants.find(x=>x.id===id); if(!v)return; activeVariantId=id; els.variantLabel.value=v.label; els.svg.value=v.originalSvg; setRadio("colorMode",v.options.colorMode||"currentColor"); setRadio("sizeMode",v.options.sizeMode||"24"); els.fixedColor.value=v.options.fixedColor||"#111111"; els.cleanup.checked=v.options.cleanup!==false; els.defaultVariant.checked=draft.defaultVariantId===v.id;
  els.strokeInput.dataset.override=v.options.strokeOverride==null?"false":"true"; els.strokeInput.value=String(v.options.strokeOverride??1.5); renderVariantTabs(); updateEditor();
}
function renderVariantTabs(){
  els.variantTabs.innerHTML=""; if(!draft)return;
  draft.variants.forEach(v=>{ const b=document.createElement("button"); b.type="button"; b.className=`variant-tab${v.id===activeVariantId?" active":""}`; b.textContent=v.label||"Sem nome"; if(v.id===draft.defaultVariantId)b.dataset.default="true"; b.addEventListener("click",()=>{ if(v.id===activeVariantId)return; stashCurrent(); loadVariantToUI(v.id); }); els.variantTabs.appendChild(b); });
  els.deleteVariant.hidden=draft.variants.length<=1;
}
function updateEditor(){
  const v=currentVariant(); if(!v)return; const options=optionsFromUI(),result=transformSvg(els.svg.value,options); els.preview.style.color=els.previewColor.value; els.previewVariantName.textContent=els.variantLabel.value.trim()||"Sem nome";
  if(!result.ok){ els.preview.innerHTML=""; els.previewStatus.textContent=result.error; els.output.textContent=""; els.analysisChips.innerHTML=""; els.analysisText.textContent="Cole um SVG válido para ver a análise."; els.strokeControls.hidden=true; return; }
  els.preview.innerHTML=result.output; els.previewStatus.textContent="Pré-visualização da versão selecionada."; els.output.textContent=result.output; const a=result.analysis;
  els.analysisChips.innerHTML=[`${a.paths} path${a.paths===1?"":"s"}`,a.hasStroke?"Com stroke":"Preenchido",a.usesCurrent?"Já usa currentColor":"Cor própria",a.hasMultiColor?"Multicor":"Monocor"].map(x=>`<span>${x}</span>`).join("");
  els.analysisText.textContent=`viewBox: ${a.viewBox}. ${a.hasStroke?"Esta versão usa stroke, então o peso do traço pode ser ajustado.":"Esta versão não usa stroke. Transformar automaticamente um ícone preenchido em contorno pode mudar o desenho, por isso o app não força essa conversão."}`;
  els.strokeControls.hidden=!a.hasStroke;
  if(a.hasStroke&&els.strokeInput.dataset.override!=="true"){ els.strokeInput.value=String(Math.min(4,Math.max(.5,a.strokeWidth))); els.strokeOutput.value=String(a.strokeWidth); } else els.strokeOutput.value=String(els.strokeInput.value);
}
function defaultVariant(item){ return item.variants.find(v=>v.id===item.defaultVariantId)||item.variants[0]; }
function previewMarkup(svg){ const parsed=parseSvg(svg); if(!parsed.ok)return""; const root=sanitize(parsed.root,true); root.setAttribute("width","62");root.setAttribute("height","62");return serializeSvg(root); }
function render(){
  const q=els.search.value.trim().toLocaleLowerCase("pt-BR"),filtered=items.filter(item=>item.name.toLocaleLowerCase("pt-BR").includes(q)||item.variants.some(v=>v.label.toLocaleLowerCase("pt-BR").includes(q))); els.grid.innerHTML="";
  filtered.forEach(item=>{ const node=els.template.content.cloneNode(true),main=node.querySelector(".symbol-main"),copy=node.querySelector(".copy-button"),def=defaultVariant(item); node.querySelector(".card-preview").innerHTML=previewMarkup(def?.finalSvg||def?.originalSvg||""); node.querySelector("h2").textContent=item.name; node.querySelector(".card-meta").textContent=item.variants.length===1?def.label:`${item.variants.length} versões · ${def.label} padrão`; main.addEventListener("click",()=>openEditor(item.id)); copy.querySelector("span").textContent=item.variants.length>1?"Copiar ▾":"Copiar"; copy.addEventListener("click",async e=>{e.stopPropagation(); if(item.variants.length>1)return openCopyChooser(item); await copyVariant(item,def);}); els.grid.appendChild(node); });
  els.count.textContent=`${items.length} ${items.length===1?"símbolo":"símbolos"}`; els.empty.hidden=items.length!==0; els.noResults.hidden=!(items.length>0&&filtered.length===0); els.grid.hidden=filtered.length===0; els.clearSearch.style.display=q?"grid":"none";
}
async function copyVariant(item,variant){ try{await copyText(variant.finalSvg||variant.originalSvg);showToast(`“${item.name} · ${variant.label}” copiado`);}catch{showToast("Não foi possível copiar");} }
function openCopyChooser(item){ els.copyTitle.textContent=item.name; els.copyList.innerHTML=""; item.variants.forEach(v=>{ const b=document.createElement("button"),details=document.createElement("span"),strong=document.createElement("strong"),small=document.createElement("small"),action=document.createElement("span"); b.type="button";strong.textContent=v.label;small.textContent=`${v.id===item.defaultVariantId?"Padrão · ":""}${v.options?.colorMode==="currentColor"?"currentColor":"SVG"}`;action.textContent="Copiar";details.append(strong,small);b.append(details,action);b.addEventListener("click",async()=>{await copyVariant(item,v);els.copyDialog.close();});els.copyList.appendChild(b); }); els.copyDialog.showModal(); }
function openEditor(id=null){
  if(id){ const item=items.find(x=>x.id===id); if(!item)return; draft=clone(item); els.editorTitle.textContent=item.name; els.name.value=item.name; els.deleteSymbol.hidden=false; }
  else{ const v=newVariant("Padrão"); draft={id:uid(),name:"",variants:[v],defaultVariantId:v.id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}; els.editorTitle.textContent="Novo símbolo"; els.name.value=""; els.deleteSymbol.hidden=true; }
  activeVariantId=draft.defaultVariantId||draft.variants[0].id; els.previewColor.value="#111111"; loadVariantToUI(activeVariantId); els.editor.showModal(); document.body.classList.add("dialog-open");
}
function closeEditor(){ els.editor.close(); document.body.classList.remove("dialog-open"); draft=null; activeVariantId=null; }
function validateDraft(){
  const name=els.name.value.trim(); if(!name)return {ok:false,error:"Dê um título ao símbolo",focus:els.name}; stashCurrent(); draft.name=name;
  for(const v of draft.variants){ if(!v.label.trim())return {ok:false,error:"Dê um nome para cada versão"}; const result=transformSvg(v.originalSvg,v.options); if(!result.ok)return {ok:false,error:`${v.label}: ${result.error}`}; v.finalSvg=result.output; }
  return {ok:true};
}
function saveDraft(){ const validation=validateDraft(); if(!validation.ok){validation.focus?.focus();showToast(validation.error);return;} draft.updatedAt=new Date().toISOString(); const exists=items.some(x=>x.id===draft.id),nextItems=exists?items.map(x=>x.id===draft.id?draft:x):[draft,...items]; if(!persist(nextItems)){showToast("Não foi possível salvar. Exporte um backup e libere espaço.");return;} items=nextItems;render();const msg=exists?"Símbolo atualizado":"Símbolo adicionado";closeEditor();showToast(msg); }
function addVariant(){ stashCurrent(); const count=draft.variants.length+1,v=newVariant(`Versão ${count}`); draft.variants.push(v); loadVariantToUI(v.id); setTimeout(()=>{els.variantLabel.focus();els.variantLabel.select();},50); }
function deleteActiveVariant(){ if(!draft||draft.variants.length<=1)return; const v=currentVariant(); if(!confirm(`Excluir a versão “${v.label}”?`))return; draft.variants=draft.variants.filter(x=>x.id!==v.id); if(draft.defaultVariantId===v.id)draft.defaultVariantId=draft.variants[0].id; loadVariantToUI(draft.variants[0].id); }
function deleteWholeSymbol(){ if(!draft||!items.some(x=>x.id===draft.id))return; if(!confirm(`Excluir “${draft.name}” e todas as versões?`))return; const nextItems=items.filter(x=>x.id!==draft.id);if(!persist(nextItems)){showToast("Não foi possível atualizar a biblioteca");return;}items=nextItems;render();closeEditor();showToast("Símbolo excluído"); }
async function pasteSvg(){ try{ if(!navigator.clipboard?.readText)throw new Error(); els.svg.value=await navigator.clipboard.readText();updateEditor(); }catch{showToast("Cole o SVG manualmente neste campo");els.svg.focus();} }
function exportLibrary(){ const data=JSON.stringify({app:"Simbolos",version:2,exportedAt:new Date().toISOString(),symbols:items},null,2),blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`simbolos-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);els.libraryMenu.hidden=true; }
function importLibrary(file){ const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(String(reader.result)),incoming=Array.isArray(data)?data:data.symbols;if(!Array.isArray(incoming))throw new Error(); const normalized=incoming.map(normalizeItem).filter(Boolean);if(incoming.length&&!normalized.length)throw new Error();const byId=new Map(items.map(x=>[x.id,x]));normalized.forEach(x=>byId.set(x.id,x));const nextItems=[...byId.values()];if(!persist(nextItems)){showToast("Sem espaço para importar. Exporte um backup e libere espaço.");return;}items=nextItems;render();showToast(`${normalized.length} símbolo${normalized.length===1?"":"s"} importado${normalized.length===1?"":"s"}`);}catch{showToast("Backup inválido");}finally{els.importFile.value="";}};reader.onerror=()=>{els.importFile.value="";showToast("Não foi possível ler o arquivo");};reader.readAsText(file); }

els.add.addEventListener("click",()=>openEditor()); els.emptyAdd.addEventListener("click",()=>openEditor()); els.cancel.addEventListener("click",closeEditor); els.save.addEventListener("click",saveDraft);
els.name.addEventListener("input",()=>{if(draft)els.editorTitle.textContent=els.name.value.trim()||"Novo símbolo";}); els.variantLabel.addEventListener("input",()=>{const v=currentVariant();if(v){v.label=els.variantLabel.value;renderVariantTabs();els.previewVariantName.textContent=els.variantLabel.value||"Sem nome";}});
els.defaultVariant.addEventListener("change",()=>{if(!draft)return;if(els.defaultVariant.checked){draft.defaultVariantId=activeVariantId;renderVariantTabs();}else{els.defaultVariant.checked=true;showToast("Sempre precisa existir uma versão padrão");}});
els.addVariant.addEventListener("click",addVariant); els.deleteVariant.addEventListener("click",deleteActiveVariant); els.deleteSymbol.addEventListener("click",deleteWholeSymbol); els.svg.addEventListener("input",updateEditor); els.previewColor.addEventListener("input",updateEditor); els.fixedColor.addEventListener("input",updateEditor); els.cleanup.addEventListener("change",updateEditor);
document.querySelectorAll('input[name="colorMode"],input[name="sizeMode"]').forEach(x=>x.addEventListener("change",updateEditor)); els.strokeInput.addEventListener("input",()=>{els.strokeInput.dataset.override="true";els.strokeOutput.value=els.strokeInput.value;updateEditor();}); els.restoreStroke.addEventListener("click",()=>{els.strokeInput.dataset.override="false";updateEditor();});
els.paste.addEventListener("click",pasteSvg); els.format.addEventListener("click",()=>{const parsed=parseSvg(els.svg.value);if(!parsed.ok)return showToast(parsed.error);els.svg.value=serializeSvg(parsed.root);updateEditor();}); els.copyOutput.addEventListener("click",async()=>{const result=transformSvg(els.svg.value,optionsFromUI());if(!result.ok)return showToast(result.error);try{await copyText(result.output);showToast(`SVG · ${els.variantLabel.value||"versão"} copiado`);}catch{showToast("Não foi possível copiar");}});
els.search.addEventListener("input",render); els.clearSearch.addEventListener("click",()=>{els.search.value="";els.search.focus();render();}); els.libraryButton.addEventListener("click",e=>{e.stopPropagation();els.libraryMenu.hidden=!els.libraryMenu.hidden;}); document.addEventListener("click",e=>{if(!els.libraryMenu.hidden&&!els.libraryMenu.contains(e.target))els.libraryMenu.hidden=true;}); els.exportButton.addEventListener("click",exportLibrary); els.importButton.addEventListener("click",()=>{els.libraryMenu.hidden=true;els.importFile.click();}); els.importFile.addEventListener("change",()=>{const file=els.importFile.files?.[0];if(file)importLibrary(file);}); els.aboutStorage.addEventListener("click",()=>{els.libraryMenu.hidden=true;els.info.showModal();}); els.closeInfo.addEventListener("click",()=>els.info.close()); els.closeCopyDialog.addEventListener("click",()=>els.copyDialog.close()); els.editor.addEventListener("cancel",e=>{e.preventDefault();closeEditor();});

render(); if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
