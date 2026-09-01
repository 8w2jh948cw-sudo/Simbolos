(()=>{
  const cfg=window.APP_CONFIG||{};
  try{
    const aliases=cfg.storageAliases||{};
    if(Object.keys(aliases).length){
      const local=window.localStorage,proto=Storage.prototype;
      if(!proto.__simbolosNamespaced){
        const get=proto.getItem,set=proto.setItem,remove=proto.removeItem;
        const keyFor=(self,key)=>self===local&&Object.prototype.hasOwnProperty.call(aliases,key)?aliases[key]:key;
        proto.getItem=function(key){return get.call(this,keyFor(this,String(key)));};
        proto.setItem=function(key,value){return set.call(this,keyFor(this,String(key)),value);};
        proto.removeItem=function(key){return remove.call(this,keyFor(this,String(key)));};
        Object.defineProperty(proto,"__simbolosNamespaced",{value:true,configurable:false});
      }
    }
  }catch(error){console.warn("Storage namespace guard:",error);}
  try{
    if("serviceWorker" in navigator&&!cfg.enableServiceWorker){
      const proto=Object.getPrototypeOf(navigator.serviceWorker);
      if(proto&&!proto.__simbolosRegistrationBlocked){
        proto.register=function(){return Promise.resolve({scope:location.href,unregister:async()=>true,update:async()=>{}});};
        Object.defineProperty(proto,"__simbolosRegistrationBlocked",{value:true,configurable:false});
      }
    }
  }catch(error){console.warn("Service Worker guard:",error);}
})();
