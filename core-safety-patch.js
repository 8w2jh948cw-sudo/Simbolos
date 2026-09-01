(()=>{
  try{
    if(typeof sanitize!=="function")return;
    sanitize=function(root,cleanup=true){
      const out=root.cloneNode(true);
      out.querySelectorAll("script,foreignObject,iframe,object,embed,audio,video").forEach(el=>el.remove());
      if(cleanup)out.querySelectorAll("metadata,title,desc").forEach(el=>el.remove());
      [out,...out.querySelectorAll("*")].forEach(el=>[...el.attributes].forEach(attr=>{
        const n=attr.name.toLowerCase(),v=String(attr.value||"").trim().toLowerCase();
        if(n.startsWith("on"))el.removeAttribute(attr.name);
        if((n==="href"||n.endsWith(":href"))&&(v.startsWith("javascript:")||v.startsWith("data:text/html")))el.removeAttribute(attr.name);
        if(cleanup&&n.startsWith("data-"))el.removeAttribute(attr.name);
      }));
      return out;
    };
    if(typeof render==="function")render();
  }catch(error){console.warn("Core safety patch:",error);}
})();
