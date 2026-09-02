(()=>{
  try{
    if(typeof sanitize!=="function")return;
    sanitize=function(root,cleanup=true){
      const out=root.cloneNode(true);
      out.querySelectorAll("script,style,foreignObject,iframe,object,embed,audio,video,animate,animateMotion,animateTransform,set,discard,mpath").forEach(el=>el.remove());
      if(cleanup)out.querySelectorAll("metadata,title,desc").forEach(el=>el.remove());
      [out,...out.querySelectorAll("*")].forEach(el=>[...el.attributes].forEach(attr=>{
        const n=attr.name.toLowerCase(),v=String(attr.value||"").trim();
        if(n.startsWith("on"))el.removeAttribute(attr.name);
        if((n==="href"||n.endsWith(":href"))&&!v.startsWith("#"))el.removeAttribute(attr.name);
        if(typeof hasUnsafeUrl==="function"&&hasUnsafeUrl(v))el.removeAttribute(attr.name);
        if(cleanup&&(n==="class"||n.startsWith("data-")))el.removeAttribute(attr.name);
      }));
      return out;
    };
    if(typeof render==="function")render();
  }catch(error){console.warn("Core safety patch:",error);}
})();
