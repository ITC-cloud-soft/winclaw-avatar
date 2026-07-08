(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const a of i)if(a.type==="childList")for(const o of a.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const a={};return i.integrity&&(a.integrity=i.integrity),i.referrerPolicy&&(a.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?a.credentials="include":i.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function s(i){if(i.ep)return;i.ep=!0;const a=n(i);fetch(i.href,a)}})();const td="modulepreload",nd=function(e,t){return new URL(e,t).href},lo={},xe=function(t,n,s){let i=Promise.resolve();if(n&&n.length>0){let p=function(g){return Promise.all(g.map(u=>Promise.resolve(u).then(h=>({status:"fulfilled",value:h}),h=>({status:"rejected",reason:h}))))};const o=document.getElementsByTagName("link"),l=document.querySelector("meta[property=csp-nonce]"),c=l?.nonce||l?.getAttribute("nonce");i=p(n.map(g=>{if(g=nd(g,s),g in lo)return;lo[g]=!0;const u=g.endsWith(".css"),h=u?'[rel="stylesheet"]':"";if(s)for(let d=o.length-1;d>=0;d--){const m=o[d];if(m.href===g&&(!u||m.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${g}"]${h}`))return;const f=document.createElement("link");if(f.rel=u?"stylesheet":td,u||(f.as="script"),f.crossOrigin="",f.href=g,c&&f.setAttribute("nonce",c),document.head.appendChild(f),u)return new Promise((d,m)=>{f.addEventListener("load",d),f.addEventListener("error",()=>m(new Error(`Unable to preload CSS for ${g}`)))})}))}function a(o){const l=new Event("vite:preloadError",{cancelable:!0});if(l.payload=o,window.dispatchEvent(l),!l.defaultPrevented)throw o}return i.then(o=>{for(const l of o||[])l.status==="rejected"&&a(l.reason);return t().catch(a)})},sd=(e,t,n)=>{const s=e[t];return s?typeof s=="function"?s():Promise.resolve(s):new Promise((i,a)=>{(typeof queueMicrotask=="function"?queueMicrotask:setTimeout)(a.bind(null,new Error("Unknown variable dynamic import: "+t+(t.split("/").length!==n?". Note that variables only represent file names one level deep.":""))))})},zt=["zh-CN","zh-TW","en","ja","ko","fr","de","es","pt","ru","vi","th","id"];let Jr="en",Zr={};const Us=new Map,bi=new Set;function id(){try{const t=new URLSearchParams(typeof location<"u"?location.search:""),n=new URLSearchParams(typeof location<"u"?location.hash.replace(/^#/,""):""),s=ad(t.get("lang")??n.get("lang"));if(s)return s}catch{}try{const t=localStorage.getItem("winclaw-locale");if(t&&zt.includes(t))return t}catch{}const e=[];typeof navigator<"u"&&(navigator.languages&&navigator.languages.length>0?e.push(...navigator.languages):navigator.language&&e.push(navigator.language));for(const t of e){if(zt.includes(t))return t;const n=t.split("-")[0],s=zt.find(i=>i===n||i.startsWith(`${n}-`));if(s)return s}return"en"}function ad(e){if(!e)return null;const t=e.trim();if(!t)return null;if(zt.includes(t))return t;const n=t.toLowerCase();if(n==="zh")return"zh-CN";const s=n.split("-")[0];return zt.find(a=>a.toLowerCase()===s||a.toLowerCase().startsWith(`${s}-`))??null}async function Xr(e){if(!Us.has(e)){const t=await sd(Object.assign({"./locales/de.json":()=>xe(()=>import("./de-ClGpPwQH.js"),[],import.meta.url),"./locales/en.json":()=>xe(()=>import("./en-Dj3WSWa9.js"),[],import.meta.url),"./locales/es.json":()=>xe(()=>import("./es-DP7MWk8L.js"),[],import.meta.url),"./locales/fr.json":()=>xe(()=>import("./fr-DeIQ4u4M.js"),[],import.meta.url),"./locales/id.json":()=>xe(()=>import("./id-BEEFaVIe.js"),[],import.meta.url),"./locales/ja.json":()=>xe(()=>import("./ja-B2d4ZLHd.js"),[],import.meta.url),"./locales/ko.json":()=>xe(()=>import("./ko-DQbiY8br.js"),[],import.meta.url),"./locales/pt.json":()=>xe(()=>import("./pt-stvJYzGQ.js"),[],import.meta.url),"./locales/ru.json":()=>xe(()=>import("./ru-QXIJzh8K.js"),[],import.meta.url),"./locales/th.json":()=>xe(()=>import("./th-JHRukEz3.js"),[],import.meta.url),"./locales/vi.json":()=>xe(()=>import("./vi-frDP9CWt.js"),[],import.meta.url),"./locales/zh-CN.json":()=>xe(()=>import("./zh-CN-BZzMbVBE.js"),[],import.meta.url),"./locales/zh-TW.json":()=>xe(()=>import("./zh-TW-CIsEc54o.js"),[],import.meta.url)}),`./locales/${e}.json`,3);Us.set(e,t.default)}Jr=e,Zr=Us.get(e);try{localStorage.setItem("winclaw-locale",e)}catch{}bi.forEach(t=>t())}function _(e,t){const n=e.split(".");let s=Zr;for(const i of n){if(s==null||typeof s!="object")return e;s=s[i]}return typeof s!="string"?e:t?s.replace(/\{(\w+)\}/g,(i,a)=>String(t[a]??`{${a}}`)):s}function el(e){return bi.add(e),()=>bi.delete(e)}function od(){return Jr}function rd(){return zt}const ld={"zh-CN":"简体中文","zh-TW":"繁體中文",en:"English",ja:"日本語",ko:"한국어",fr:"Français",de:"Deutsch",es:"Español",pt:"Português",ru:"Русский",vi:"Tiếng Việt",th:"ภาษาไทย",id:"Bahasa Indonesia"};const Kn=globalThis,qi=Kn.ShadowRoot&&(Kn.ShadyCSS===void 0||Kn.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Gi=Symbol(),co=new WeakMap;let tl=class{constructor(t,n,s){if(this._$cssResult$=!0,s!==Gi)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=n}get styleSheet(){let t=this.o;const n=this.t;if(qi&&t===void 0){const s=n!==void 0&&n.length===1;s&&(t=co.get(n)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&co.set(n,t))}return t}toString(){return this.cssText}};const cd=e=>new tl(typeof e=="string"?e:e+"",void 0,Gi),Qi=(e,...t)=>{const n=e.length===1?e[0]:t.reduce((s,i,a)=>s+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+e[a+1],e[0]);return new tl(n,e,Gi)},dd=(e,t)=>{if(qi)e.adoptedStyleSheets=t.map(n=>n instanceof CSSStyleSheet?n:n.styleSheet);else for(const n of t){const s=document.createElement("style"),i=Kn.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=n.cssText,e.appendChild(s)}},uo=qi?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let n="";for(const s of t.cssRules)n+=s.cssText;return cd(n)})(e):e;const{is:ud,defineProperty:pd,getOwnPropertyDescriptor:gd,getOwnPropertyNames:hd,getOwnPropertySymbols:fd,getPrototypeOf:md}=Object,us=globalThis,po=us.trustedTypes,vd=po?po.emptyScript:"",bd=us.reactiveElementPolyfillSupport,rn=(e,t)=>e,Qn={toAttribute(e,t){switch(t){case Boolean:e=e?vd:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let n=e;switch(t){case Boolean:n=e!==null;break;case Number:n=e===null?null:Number(e);break;case Object:case Array:try{n=JSON.parse(e)}catch{n=null}}return n}},Yi=(e,t)=>!ud(e,t),go={attribute:!0,type:String,converter:Qn,reflect:!1,useDefault:!1,hasChanged:Yi};Symbol.metadata??=Symbol("metadata"),us.litPropertyMetadata??=new WeakMap;let Ut=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,n=go){if(n.state&&(n.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((n=Object.create(n)).wrapped=!0),this.elementProperties.set(t,n),!n.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,n);i!==void 0&&pd(this.prototype,t,i)}}static getPropertyDescriptor(t,n,s){const{get:i,set:a}=gd(this.prototype,t)??{get(){return this[n]},set(o){this[n]=o}};return{get:i,set(o){const l=i?.call(this);a?.call(this,o),this.requestUpdate(t,l,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??go}static _$Ei(){if(this.hasOwnProperty(rn("elementProperties")))return;const t=md(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(rn("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(rn("properties"))){const n=this.properties,s=[...hd(n),...fd(n)];for(const i of s)this.createProperty(i,n[i])}const t=this[Symbol.metadata];if(t!==null){const n=litPropertyMetadata.get(t);if(n!==void 0)for(const[s,i]of n)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[n,s]of this.elementProperties){const i=this._$Eu(n,s);i!==void 0&&this._$Eh.set(i,n)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const n=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const i of s)n.unshift(uo(i))}else t!==void 0&&n.push(uo(t));return n}static _$Eu(t,n){const s=n.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,n=this.constructor.elementProperties;for(const s of n.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return dd(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,n,s){this._$AK(t,s)}_$ET(t,n){const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(i!==void 0&&s.reflect===!0){const a=(s.converter?.toAttribute!==void 0?s.converter:Qn).toAttribute(n,s.type);this._$Em=t,a==null?this.removeAttribute(i):this.setAttribute(i,a),this._$Em=null}}_$AK(t,n){const s=this.constructor,i=s._$Eh.get(t);if(i!==void 0&&this._$Em!==i){const a=s.getPropertyOptions(i),o=typeof a.converter=="function"?{fromAttribute:a.converter}:a.converter?.fromAttribute!==void 0?a.converter:Qn;this._$Em=i;const l=o.fromAttribute(n,a.type);this[i]=l??this._$Ej?.get(i)??l,this._$Em=null}}requestUpdate(t,n,s,i=!1,a){if(t!==void 0){const o=this.constructor;if(i===!1&&(a=this[t]),s??=o.getPropertyOptions(t),!((s.hasChanged??Yi)(a,n)||s.useDefault&&s.reflect&&a===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,s))))return;this.C(t,n,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,n,{useDefault:s,reflect:i,wrapped:a},o){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??n??this[t]),a!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(n=void 0),this._$AL.set(t,n)),i===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(n){Promise.reject(n)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[i,a]of this._$Ep)this[i]=a;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,a]of s){const{wrapped:o}=a,l=this[i];o!==!0||this._$AL.has(i)||l===void 0||this.C(i,void 0,a,l)}}let t=!1;const n=this._$AL;try{t=this.shouldUpdate(n),t?(this.willUpdate(n),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(n)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(n)}willUpdate(t){}_$AE(t){this._$EO?.forEach(n=>n.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(n=>this._$ET(n,this[n])),this._$EM()}updated(t){}firstUpdated(t){}};Ut.elementStyles=[],Ut.shadowRootOptions={mode:"open"},Ut[rn("elementProperties")]=new Map,Ut[rn("finalized")]=new Map,bd?.({ReactiveElement:Ut}),(us.reactiveElementVersions??=[]).push("2.1.2");const Ji=globalThis,ho=e=>e,Yn=Ji.trustedTypes,fo=Yn?Yn.createPolicy("lit-html",{createHTML:e=>e}):void 0,nl="$lit$",tt=`lit$${Math.random().toFixed(9).slice(2)}$`,sl="?"+tt,yd=`<${sl}>`,St=document,pn=()=>St.createComment(""),gn=e=>e===null||typeof e!="object"&&typeof e!="function",Zi=Array.isArray,xd=e=>Zi(e)||typeof e?.[Symbol.iterator]=="function",Hs=`[ 	
\f\r]`,Qt=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,mo=/-->/g,vo=/>/g,pt=RegExp(`>|${Hs}(?:([^\\s"'>=/]+)(${Hs}*=${Hs}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),bo=/'/g,yo=/"/g,il=/^(?:script|style|textarea|title)$/i,al=e=>(t,...n)=>({_$litType$:e,strings:t,values:n}),r=al(1),J=al(2),it=Symbol.for("lit-noChange"),v=Symbol.for("lit-nothing"),xo=new WeakMap,wt=St.createTreeWalker(St,129);function ol(e,t){if(!Zi(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return fo!==void 0?fo.createHTML(t):t}const wd=(e,t)=>{const n=e.length-1,s=[];let i,a=t===2?"<svg>":t===3?"<math>":"",o=Qt;for(let l=0;l<n;l++){const c=e[l];let p,g,u=-1,h=0;for(;h<c.length&&(o.lastIndex=h,g=o.exec(c),g!==null);)h=o.lastIndex,o===Qt?g[1]==="!--"?o=mo:g[1]!==void 0?o=vo:g[2]!==void 0?(il.test(g[2])&&(i=RegExp("</"+g[2],"g")),o=pt):g[3]!==void 0&&(o=pt):o===pt?g[0]===">"?(o=i??Qt,u=-1):g[1]===void 0?u=-2:(u=o.lastIndex-g[2].length,p=g[1],o=g[3]===void 0?pt:g[3]==='"'?yo:bo):o===yo||o===bo?o=pt:o===mo||o===vo?o=Qt:(o=pt,i=void 0);const f=o===pt&&e[l+1].startsWith("/>")?" ":"";a+=o===Qt?c+yd:u>=0?(s.push(p),c.slice(0,u)+nl+c.slice(u)+tt+f):c+tt+(u===-2?l:f)}return[ol(e,a+(e[n]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class hn{constructor({strings:t,_$litType$:n},s){let i;this.parts=[];let a=0,o=0;const l=t.length-1,c=this.parts,[p,g]=wd(t,n);if(this.el=hn.createElement(p,s),wt.currentNode=this.el.content,n===2||n===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(i=wt.nextNode())!==null&&c.length<l;){if(i.nodeType===1){if(i.hasAttributes())for(const u of i.getAttributeNames())if(u.endsWith(nl)){const h=g[o++],f=i.getAttribute(u).split(tt),d=/([.?@])?(.*)/.exec(h);c.push({type:1,index:a,name:d[2],strings:f,ctor:d[1]==="."?kd:d[1]==="?"?Sd:d[1]==="@"?Ad:gs}),i.removeAttribute(u)}else u.startsWith(tt)&&(c.push({type:6,index:a}),i.removeAttribute(u));if(il.test(i.tagName)){const u=i.textContent.split(tt),h=u.length-1;if(h>0){i.textContent=Yn?Yn.emptyScript:"";for(let f=0;f<h;f++)i.append(u[f],pn()),wt.nextNode(),c.push({type:2,index:++a});i.append(u[h],pn())}}}else if(i.nodeType===8)if(i.data===sl)c.push({type:2,index:a});else{let u=-1;for(;(u=i.data.indexOf(tt,u+1))!==-1;)c.push({type:7,index:a}),u+=tt.length-1}a++}}static createElement(t,n){const s=St.createElement("template");return s.innerHTML=t,s}}function jt(e,t,n=e,s){if(t===it)return t;let i=s!==void 0?n._$Co?.[s]:n._$Cl;const a=gn(t)?void 0:t._$litDirective$;return i?.constructor!==a&&(i?._$AO?.(!1),a===void 0?i=void 0:(i=new a(e),i._$AT(e,n,s)),s!==void 0?(n._$Co??=[])[s]=i:n._$Cl=i),i!==void 0&&(t=jt(e,i._$AS(e,t.values),i,s)),t}class $d{constructor(t,n){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=n}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:n},parts:s}=this._$AD,i=(t?.creationScope??St).importNode(n,!0);wt.currentNode=i;let a=wt.nextNode(),o=0,l=0,c=s[0];for(;c!==void 0;){if(o===c.index){let p;c.type===2?p=new ps(a,a.nextSibling,this,t):c.type===1?p=new c.ctor(a,c.name,c.strings,this,t):c.type===6&&(p=new Cd(a,this,t)),this._$AV.push(p),c=s[++l]}o!==c?.index&&(a=wt.nextNode(),o++)}return wt.currentNode=St,i}p(t){let n=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,n),n+=s.strings.length-2):s._$AI(t[n])),n++}}let ps=class rl{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,n,s,i){this.type=2,this._$AH=v,this._$AN=void 0,this._$AA=t,this._$AB=n,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const n=this._$AM;return n!==void 0&&t?.nodeType===11&&(t=n.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,n=this){t=jt(this,t,n),gn(t)?t===v||t==null||t===""?(this._$AH!==v&&this._$AR(),this._$AH=v):t!==this._$AH&&t!==it&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):xd(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==v&&gn(this._$AH)?this._$AA.nextSibling.data=t:this.T(St.createTextNode(t)),this._$AH=t}$(t){const{values:n,_$litType$:s}=t,i=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=hn.createElement(ol(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(n);else{const a=new $d(i,this),o=a.u(this.options);a.p(n),this.T(o),this._$AH=a}}_$AC(t){let n=xo.get(t.strings);return n===void 0&&xo.set(t.strings,n=new hn(t)),n}k(t){Zi(this._$AH)||(this._$AH=[],this._$AR());const n=this._$AH;let s,i=0;for(const a of t)i===n.length?n.push(s=new rl(this.O(pn()),this.O(pn()),this,this.options)):s=n[i],s._$AI(a),i++;i<n.length&&(this._$AR(s&&s._$AB.nextSibling,i),n.length=i)}_$AR(t=this._$AA.nextSibling,n){for(this._$AP?.(!1,!0,n);t!==this._$AB;){const s=ho(t).nextSibling;ho(t).remove(),t=s}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},gs=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,n,s,i,a){this.type=1,this._$AH=v,this._$AN=void 0,this.element=t,this.name=n,this._$AM=i,this.options=a,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=v}_$AI(t,n=this,s,i){const a=this.strings;let o=!1;if(a===void 0)t=jt(this,t,n,0),o=!gn(t)||t!==this._$AH&&t!==it,o&&(this._$AH=t);else{const l=t;let c,p;for(t=a[0],c=0;c<a.length-1;c++)p=jt(this,l[s+c],n,c),p===it&&(p=this._$AH[c]),o||=!gn(p)||p!==this._$AH[c],p===v?t=v:t!==v&&(t+=(p??"")+a[c+1]),this._$AH[c]=p}o&&!i&&this.j(t)}j(t){t===v?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},kd=class extends gs{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===v?void 0:t}},Sd=class extends gs{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==v)}},Ad=class extends gs{constructor(t,n,s,i,a){super(t,n,s,i,a),this.type=5}_$AI(t,n=this){if((t=jt(this,t,n,0)??v)===it)return;const s=this._$AH,i=t===v&&s!==v||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,a=t!==v&&(s===v||i);i&&this.element.removeEventListener(this.name,this,s),a&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},Cd=class{constructor(t,n,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=n,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){jt(this,t)}};const Td={I:ps},_d=Ji.litHtmlPolyfillSupport;_d?.(hn,ps),(Ji.litHtmlVersions??=[]).push("3.3.2");const Ed=(e,t,n)=>{const s=n?.renderBefore??t;let i=s._$litPart$;if(i===void 0){const a=n?.renderBefore??null;s._$litPart$=i=new ps(t.insertBefore(pn(),a),a,void 0,n??{})}return i._$AI(e),i};const Xi=globalThis;let nt=class extends Ut{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const n=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Ed(n,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return it}};nt._$litElement$=!0,nt.finalized=!0,Xi.litElementHydrateSupport?.({LitElement:nt});const Ld=Xi.litElementPolyfillSupport;Ld?.({LitElement:nt});(Xi.litElementVersions??=[]).push("4.2.2");const hs=e=>(t,n)=>{n!==void 0?n.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};const Id={attribute:!0,type:String,converter:Qn,reflect:!1,hasChanged:Yi},Md=(e=Id,t,n)=>{const{kind:s,metadata:i}=n;let a=globalThis.litPropertyMetadata.get(i);if(a===void 0&&globalThis.litPropertyMetadata.set(i,a=new Map),s==="setter"&&((e=Object.create(e)).wrapped=!0),a.set(n.name,e),s==="accessor"){const{name:o}=n;return{set(l){const c=t.get.call(this);t.set.call(this,l),this.requestUpdate(o,c,e,!0,l)},init(l){return l!==void 0&&this.C(o,void 0,e,l),l}}}if(s==="setter"){const{name:o}=n;return function(l){const c=this[o];t.call(this,l),this.requestUpdate(o,c,e,!0,l)}}throw Error("Unsupported decorator location: "+s)};function Ze(e){return(t,n)=>typeof n=="object"?Md(e,t,n):((s,i,a)=>{const o=i.hasOwnProperty(a);return i.constructor.createProperty(a,s),o?Object.getOwnPropertyDescriptor(i,a):void 0})(e,t,n)}function b(e){return Ze({...e,state:!0,attribute:!1})}const Rd=(e,t,n)=>(n.configurable=!0,n.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,n),n);function Pd(e,t){return(n,s,i)=>{const a=o=>o.renderRoot?.querySelector(e)??null;return Rd(n,s,{get(){return a(this)}})}}async function $e(e,t){if(!(!e.client||!e.connected)&&!e.channelsLoading){e.channelsLoading=!0,e.channelsError=null;try{const n=await e.client.request("channels.status",{probe:t,timeoutMs:8e3});e.channelsSnapshot=n,e.channelsLastSuccess=Date.now()}catch(n){e.channelsError=String(n)}finally{e.channelsLoading=!1}}}async function Dd(e,t){if(!(!e.client||!e.connected||e.whatsappBusy)){e.whatsappBusy=!0;try{const n=await e.client.request("web.login.start",{force:t,timeoutMs:3e4});e.whatsappLoginMessage=n.message??null,e.whatsappLoginQrDataUrl=n.qrDataUrl??null,e.whatsappLoginConnected=null}catch(n){e.whatsappLoginMessage=String(n),e.whatsappLoginQrDataUrl=null,e.whatsappLoginConnected=null}finally{e.whatsappBusy=!1}}}async function Fd(e){if(!(!e.client||!e.connected||e.whatsappBusy)){e.whatsappBusy=!0;try{const t=await e.client.request("web.login.wait",{timeoutMs:12e4});e.whatsappLoginMessage=t.message??null,e.whatsappLoginConnected=t.connected??null,t.connected&&(e.whatsappLoginQrDataUrl=null)}catch(t){e.whatsappLoginMessage=String(t),e.whatsappLoginConnected=null}finally{e.whatsappBusy=!1}}}async function Nd(e){if(!(!e.client||!e.connected||e.whatsappBusy)){e.whatsappBusy=!0;try{await e.client.request("channels.logout",{channel:"whatsapp"}),e.whatsappLoginMessage="Logged out.",e.whatsappLoginQrDataUrl=null,e.whatsappLoginConnected=null}catch(t){e.whatsappLoginMessage=String(t)}finally{e.whatsappBusy=!1}}}function At(e){return typeof structuredClone=="function"?structuredClone(e):JSON.parse(JSON.stringify(e))}function Kt(e){return`${JSON.stringify(e,null,2).trimEnd()}
`}function ll(e,t,n){if(t.length===0)return;let s=e;for(let a=0;a<t.length-1;a+=1){const o=t[a],l=t[a+1];if(typeof o=="number"){if(!Array.isArray(s))return;s[o]==null&&(s[o]=typeof l=="number"?[]:{}),s=s[o]}else{if(typeof s!="object"||s==null)return;const c=s;c[o]==null&&(c[o]=typeof l=="number"?[]:{}),s=c[o]}}const i=t[t.length-1];if(typeof i=="number"){Array.isArray(s)&&(s[i]=n);return}typeof s=="object"&&s!=null&&(s[i]=n)}function cl(e,t){if(t.length===0)return;let n=e;for(let i=0;i<t.length-1;i+=1){const a=t[i];if(typeof a=="number"){if(!Array.isArray(n))return;n=n[a]}else{if(typeof n!="object"||n==null)return;n=n[a]}if(n==null)return}const s=t[t.length-1];if(typeof s=="number"){Array.isArray(n)&&n.splice(s,1);return}typeof n=="object"&&n!=null&&delete n[s]}async function De(e){if(!(!e.client||!e.connected)){e.configLoading=!0,e.lastError=null;try{const t=await e.client.request("config.get",{});Bd(e,t)}catch(t){e.lastError=String(t)}finally{e.configLoading=!1}}}async function dl(e){if(!(!e.client||!e.connected)&&!e.configSchemaLoading){e.configSchemaLoading=!0;try{const t=await e.client.request("config.schema",{});Od(e,t)}catch(t){e.lastError=String(t)}finally{e.configSchemaLoading=!1}}}function Od(e,t){e.configSchema=t.schema??null,e.configUiHints=t.uiHints??{},e.configSchemaVersion=t.version??null}function Bd(e,t){e.configSnapshot=t;const n=typeof t.raw=="string"?t.raw:t.config&&typeof t.config=="object"?Kt(t.config):e.configRaw;!e.configFormDirty||e.configFormMode==="raw"?e.configRaw=n:e.configForm?e.configRaw=Kt(e.configForm):e.configRaw=n,e.configValid=typeof t.valid=="boolean"?t.valid:null,e.configIssues=Array.isArray(t.issues)?t.issues:[],e.configFormDirty||(e.configForm=At(t.config??{}),e.configFormOriginal=At(t.config??{}),e.configRawOriginal=n)}async function Vn(e){if(!(!e.client||!e.connected)){e.configSaving=!0,e.lastError=null;try{const t=e.configFormMode==="form"&&e.configForm?Kt(e.configForm):e.configRaw,n=e.configSnapshot?.hash;if(!n){e.lastError="Config hash missing; reload and retry.";return}await e.client.request("config.set",{raw:t,baseHash:n}),e.configFormDirty=!1,await De(e)}catch(t){e.lastError=String(t)}finally{e.configSaving=!1}}}async function Ud(e){if(!(!e.client||!e.connected)){e.configApplying=!0,e.lastError=null;try{const t=e.configFormMode==="form"&&e.configForm?Kt(e.configForm):e.configRaw,n=e.configSnapshot?.hash;if(!n){e.lastError="Config hash missing; reload and retry.";return}await e.client.request("config.apply",{raw:t,baseHash:n,sessionKey:e.applySessionKey}),e.configFormDirty=!1,await De(e)}catch(t){e.lastError=String(t)}finally{e.configApplying=!1}}}async function Hd(e){if(!(!e.client||!e.connected)){e.updateRunning=!0,e.lastError=null;try{await e.client.request("update.run",{sessionKey:e.applySessionKey})}catch(t){e.lastError=String(t)}finally{e.updateRunning=!1}}}function Te(e,t,n){const s=At(e.configForm??e.configSnapshot?.config??{});ll(s,t,n),e.configForm=s,e.configFormDirty=!0,e.configFormMode==="form"&&(e.configRaw=Kt(s))}function Ge(e,t){const n=At(e.configForm??e.configSnapshot?.config??{});cl(n,t),e.configForm=n,e.configFormDirty=!0,e.configFormMode==="form"&&(e.configRaw=Kt(n))}function zd(e){const{values:t,original:n}=e;return t.name!==n.name||t.displayName!==n.displayName||t.about!==n.about||t.picture!==n.picture||t.banner!==n.banner||t.website!==n.website||t.nip05!==n.nip05||t.lud16!==n.lud16}function jd(e){const{state:t,callbacks:n,accountId:s}=e,i=zd(t),a=(l,c,p={})=>{const{type:g="text",placeholder:u,maxLength:h,help:f}=p,d=t.values[l]??"",m=t.fieldErrors[l],k=`nostr-profile-${l}`;return g==="textarea"?r`
        <div class="form-field" style="margin-bottom: 12px;">
          <label for="${k}" style="display: block; margin-bottom: 4px; font-weight: 500;">
            ${c}
          </label>
          <textarea
            id="${k}"
            .value=${d}
            placeholder=${u??""}
            maxlength=${h??2e3}
            rows="3"
            style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; resize: vertical; font-family: inherit;"
            @input=${S=>{const $=S.target;n.onFieldChange(l,$.value)}}
            ?disabled=${t.saving}
          ></textarea>
          ${f?r`<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${f}</div>`:v}
          ${m?r`<div style="font-size: 12px; color: var(--danger-color); margin-top: 2px;">${m}</div>`:v}
        </div>
      `:r`
      <div class="form-field" style="margin-bottom: 12px;">
        <label for="${k}" style="display: block; margin-bottom: 4px; font-weight: 500;">
          ${c}
        </label>
        <input
          id="${k}"
          type=${g}
          .value=${d}
          placeholder=${u??""}
          maxlength=${h??256}
          style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;"
          @input=${S=>{const $=S.target;n.onFieldChange(l,$.value)}}
          ?disabled=${t.saving}
        />
        ${f?r`<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${f}</div>`:v}
        ${m?r`<div style="font-size: 12px; color: var(--danger-color); margin-top: 2px;">${m}</div>`:v}
      </div>
    `},o=()=>{const l=t.values.picture;return l?r`
      <div style="margin-bottom: 12px;">
        <img
          src=${l}
          alt="Profile picture preview"
          style="max-width: 80px; max-height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);"
          @error=${c=>{const p=c.target;p.style.display="none"}}
          @load=${c=>{const p=c.target;p.style.display="block"}}
        />
      </div>
    `:v};return r`
    <div class="nostr-profile-form" style="padding: 16px; background: var(--bg-secondary); border-radius: 8px; margin-top: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="font-weight: 600; font-size: 16px;">Edit Profile</div>
        <div style="font-size: 12px; color: var(--text-muted);">Account: ${s}</div>
      </div>

      ${t.error?r`<div class="callout danger" style="margin-bottom: 12px;">${t.error}</div>`:v}

      ${t.success?r`<div class="callout success" style="margin-bottom: 12px;">${t.success}</div>`:v}

      ${o()}

      ${a("name","Username",{placeholder:"satoshi",maxLength:256,help:"Short username (e.g., satoshi)"})}

      ${a("displayName","Display Name",{placeholder:"Satoshi Nakamoto",maxLength:256,help:"Your full display name"})}

      ${a("about","Bio",{type:"textarea",placeholder:"Tell people about yourself...",maxLength:2e3,help:"A brief bio or description"})}

      ${a("picture","Avatar URL",{type:"url",placeholder:"https://example.com/avatar.jpg",help:"HTTPS URL to your profile picture"})}

      ${t.showAdvanced?r`
            <div style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
              <div style="font-weight: 500; margin-bottom: 12px; color: var(--text-muted);">Advanced</div>

              ${a("banner","Banner URL",{type:"url",placeholder:"https://example.com/banner.jpg",help:"HTTPS URL to a banner image"})}

              ${a("website","Website",{type:"url",placeholder:"https://example.com",help:"Your personal website"})}

              ${a("nip05","NIP-05 Identifier",{placeholder:"you@example.com",help:"Verifiable identifier (e.g., you@domain.com)"})}

              ${a("lud16","Lightning Address",{placeholder:"you@getalby.com",help:"Lightning address for tips (LUD-16)"})}
            </div>
          `:v}

      <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
        <button
          class="btn primary"
          @click=${n.onSave}
          ?disabled=${t.saving||!i}
        >
          ${t.saving?"Saving...":"Save & Publish"}
        </button>

        <button
          class="btn"
          @click=${n.onImport}
          ?disabled=${t.importing||t.saving}
        >
          ${t.importing?"Importing...":"Import from Relays"}
        </button>

        <button
          class="btn"
          @click=${n.onToggleAdvanced}
        >
          ${t.showAdvanced?"Hide Advanced":"Show Advanced"}
        </button>

        <button
          class="btn"
          @click=${n.onCancel}
          ?disabled=${t.saving}
        >
          Cancel
        </button>
      </div>

      ${i?r`
              <div style="font-size: 12px; color: var(--warning-color); margin-top: 8px">
                You have unsaved changes
              </div>
            `:v}
    </div>
  `}function Kd(e){const t={name:e?.name??"",displayName:e?.displayName??"",about:e?.about??"",picture:e?.picture??"",banner:e?.banner??"",website:e?.website??"",nip05:e?.nip05??"",lud16:e?.lud16??""};return{values:t,original:{...t},saving:!1,importing:!1,error:null,success:null,fieldErrors:{},showAdvanced:!!(e?.banner||e?.website||e?.nip05||e?.lud16)}}async function Vd(e,t){await Dd(e,t),await $e(e,!0)}async function Wd(e){await Fd(e),await $e(e,!0)}async function qd(e){await Nd(e),await $e(e,!0)}async function Gd(e){await Vn(e),await De(e),await $e(e,!0)}async function Qd(e){await De(e),await $e(e,!0)}function Yd(e){if(!Array.isArray(e))return{};const t={};for(const n of e){if(typeof n!="string")continue;const[s,...i]=n.split(":");if(!s||i.length===0)continue;const a=s.trim(),o=i.join(":").trim();a&&o&&(t[a]=o)}return t}function ul(e){return(e.channelsSnapshot?.channelAccounts?.nostr??[])[0]?.accountId??e.nostrProfileAccountId??"default"}function pl(e,t=""){return`/api/channels/nostr/${encodeURIComponent(e)}/profile${t}`}function Jd(e,t,n){e.nostrProfileAccountId=t,e.nostrProfileFormState=Kd(n??void 0)}function Zd(e){e.nostrProfileFormState=null,e.nostrProfileAccountId=null}function Xd(e,t,n){const s=e.nostrProfileFormState;s&&(e.nostrProfileFormState={...s,values:{...s.values,[t]:n},fieldErrors:{...s.fieldErrors,[t]:""}})}function eu(e){const t=e.nostrProfileFormState;t&&(e.nostrProfileFormState={...t,showAdvanced:!t.showAdvanced})}async function tu(e){const t=e.nostrProfileFormState;if(!t||t.saving)return;const n=ul(e);e.nostrProfileFormState={...t,saving:!0,error:null,success:null,fieldErrors:{}};try{const s=await fetch(pl(n),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(t.values)}),i=await s.json().catch(()=>null);if(!s.ok||i?.ok===!1||!i){const a=i?.error??`Profile update failed (${s.status})`;e.nostrProfileFormState={...t,saving:!1,error:a,success:null,fieldErrors:Yd(i?.details)};return}if(!i.persisted){e.nostrProfileFormState={...t,saving:!1,error:"Profile publish failed on all relays.",success:null};return}e.nostrProfileFormState={...t,saving:!1,error:null,success:"Profile published to relays.",fieldErrors:{},original:{...t.values}},await $e(e,!0)}catch(s){e.nostrProfileFormState={...t,saving:!1,error:`Profile update failed: ${String(s)}`,success:null}}}async function nu(e){const t=e.nostrProfileFormState;if(!t||t.importing)return;const n=ul(e);e.nostrProfileFormState={...t,importing:!0,error:null,success:null};try{const s=await fetch(pl(n,"/import"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({autoMerge:!0})}),i=await s.json().catch(()=>null);if(!s.ok||i?.ok===!1||!i){const c=i?.error??`Profile import failed (${s.status})`;e.nostrProfileFormState={...t,importing:!1,error:c,success:null};return}const a=i.merged??i.imported??null,o=a?{...t.values,...a}:t.values,l=!!(o.banner||o.website||o.nip05||o.lud16);e.nostrProfileFormState={...t,importing:!1,values:o,error:null,success:i.saved?"Profile imported from relays. Review and publish.":"Profile imported. Review and publish.",showAdvanced:l},i.saved&&await $e(e,!0)}catch(s){e.nostrProfileFormState={...t,importing:!1,error:`Profile import failed: ${String(s)}`,success:null}}}function ea(e){const t=(e??"").trim().toLowerCase();if(!t)return null;const n=t.split(":").filter(Boolean);if(n.length<3||n[0]!=="agent")return null;const s=n[1]?.trim(),i=n.slice(2).join(":");return!s||!i?null:{agentId:s,rest:i}}const yi=450;function bn(e,t=!1,n=!1){e.chatScrollFrame&&cancelAnimationFrame(e.chatScrollFrame),e.chatScrollTimeout!=null&&(clearTimeout(e.chatScrollTimeout),e.chatScrollTimeout=null);const s=()=>{const i=e.querySelector(".chat-thread");if(i){const a=getComputedStyle(i).overflowY;if(a==="auto"||a==="scroll"||i.scrollHeight-i.clientHeight>1)return i}return document.scrollingElement??document.documentElement};e.updateComplete.then(()=>{e.chatScrollFrame=requestAnimationFrame(()=>{e.chatScrollFrame=null;const i=s();if(!i)return;const a=i.scrollHeight-i.scrollTop-i.clientHeight,o=t&&!e.chatHasAutoScrolled;if(!(o||e.chatUserNearBottom||a<yi)){e.chatNewMessagesBelow=!0;return}o&&(e.chatHasAutoScrolled=!0);const c=n&&(typeof window>"u"||typeof window.matchMedia!="function"||!window.matchMedia("(prefers-reduced-motion: reduce)").matches),p=i.scrollHeight;typeof i.scrollTo=="function"?i.scrollTo({top:p,behavior:c?"smooth":"auto"}):i.scrollTop=p,e.chatUserNearBottom=!0,e.chatNewMessagesBelow=!1;const g=o?150:120;e.chatScrollTimeout=window.setTimeout(()=>{e.chatScrollTimeout=null;const u=s();if(!u)return;const h=u.scrollHeight-u.scrollTop-u.clientHeight;(o||e.chatUserNearBottom||h<yi)&&(u.scrollTop=u.scrollHeight,e.chatUserNearBottom=!0)},g)})})}function gl(e,t=!1){e.logsScrollFrame&&cancelAnimationFrame(e.logsScrollFrame),e.updateComplete.then(()=>{e.logsScrollFrame=requestAnimationFrame(()=>{e.logsScrollFrame=null;const n=e.querySelector(".log-stream");if(!n)return;const s=n.scrollHeight-n.scrollTop-n.clientHeight;(t||s<80)&&(n.scrollTop=n.scrollHeight)})})}function su(e,t){const n=t.currentTarget;if(!n)return;const s=n.scrollHeight-n.scrollTop-n.clientHeight;e.chatUserNearBottom=s<yi,e.chatUserNearBottom&&(e.chatNewMessagesBelow=!1)}function iu(e,t){const n=t.currentTarget;if(!n)return;const s=n.scrollHeight-n.scrollTop-n.clientHeight;e.logsAtBottom=s<80}function wo(e){e.chatHasAutoScrolled=!1,e.chatUserNearBottom=!0,e.chatNewMessagesBelow=!1}function au(e,t){if(e.length===0)return;const n=new Blob([`${e.join(`
`)}
`],{type:"text/plain"}),s=URL.createObjectURL(n),i=document.createElement("a"),a=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");i.href=s,i.download=`winclaw-logs-${t}-${a}.log`,i.click(),URL.revokeObjectURL(s)}function ou(e){if(typeof ResizeObserver>"u")return;const t=e.querySelector(".topbar");if(!t)return;const n=()=>{const{height:s}=t.getBoundingClientRect();e.style.setProperty("--topbar-height",`${s}px`)};n(),e.topbarObserver=new ResizeObserver(()=>n()),e.topbarObserver.observe(t)}async function fs(e){if(!(!e.client||!e.connected)&&!e.debugLoading){e.debugLoading=!0;try{const[t,n,s,i]=await Promise.all([e.client.request("status",{}),e.client.request("health",{}),e.client.request("models.list",{}),e.client.request("last-heartbeat",{})]);e.debugStatus=t,e.debugHealth=n;const a=s;e.debugModels=Array.isArray(a?.models)?a?.models:[],e.debugHeartbeat=i}catch(t){e.debugCallError=String(t)}finally{e.debugLoading=!1}}}async function ru(e){if(!(!e.client||!e.connected)){e.debugCallError=null,e.debugCallResult=null;try{const t=e.debugCallParams.trim()?JSON.parse(e.debugCallParams):{},n=await e.client.request(e.debugCallMethod.trim(),t);e.debugCallResult=JSON.stringify(n,null,2)}catch(t){e.debugCallError=String(t)}}}const lu=2e3,cu=new Set(["trace","debug","info","warn","error","fatal"]);function du(e){if(typeof e!="string")return null;const t=e.trim();if(!t.startsWith("{")||!t.endsWith("}"))return null;try{const n=JSON.parse(t);return!n||typeof n!="object"?null:n}catch{return null}}function uu(e){if(typeof e!="string")return null;const t=e.toLowerCase();return cu.has(t)?t:null}function pu(e){if(!e.trim())return{raw:e,message:e};try{const t=JSON.parse(e),n=t&&typeof t._meta=="object"&&t._meta!==null?t._meta:null,s=typeof t.time=="string"?t.time:typeof n?.date=="string"?n?.date:null,i=uu(n?.logLevelName??n?.level),a=typeof t[0]=="string"?t[0]:typeof n?.name=="string"?n?.name:null,o=du(a);let l=null;o&&(typeof o.subsystem=="string"?l=o.subsystem:typeof o.module=="string"&&(l=o.module)),!l&&a&&a.length<120&&(l=a);let c=null;return typeof t[1]=="string"?c=t[1]:!o&&typeof t[0]=="string"?c=t[0]:typeof t.message=="string"&&(c=t.message),{raw:e,time:s,level:i,subsystem:l,message:c??e,meta:n??void 0}}catch{return{raw:e,message:e}}}async function ta(e,t){if(!(!e.client||!e.connected)&&!(e.logsLoading&&!t?.quiet)){t?.quiet||(e.logsLoading=!0),e.logsError=null;try{const s=await e.client.request("logs.tail",{cursor:t?.reset?void 0:e.logsCursor??void 0,limit:e.logsLimit,maxBytes:e.logsMaxBytes}),a=(Array.isArray(s.lines)?s.lines.filter(l=>typeof l=="string"):[]).map(pu),o=!!(t?.reset||s.reset||e.logsCursor==null);e.logsEntries=o?a:[...e.logsEntries,...a].slice(-lu),typeof s.cursor=="number"&&(e.logsCursor=s.cursor),typeof s.file=="string"&&(e.logsFile=s.file),e.logsTruncated=!!s.truncated,e.logsLastFetchAt=Date.now()}catch(n){e.logsError=String(n)}finally{t?.quiet||(e.logsLoading=!1)}}}async function ms(e,t){if(!(!e.client||!e.connected)&&!e.nodesLoading){e.nodesLoading=!0,t?.quiet||(e.lastError=null);try{const n=await e.client.request("node.list",{});e.nodes=Array.isArray(n.nodes)?n.nodes:[]}catch(n){t?.quiet||(e.lastError=String(n))}finally{e.nodesLoading=!1}}}function gu(e){e.nodesPollInterval==null&&(e.nodesPollInterval=window.setInterval(()=>{ms(e,{quiet:!0})},5e3))}function hu(e){e.nodesPollInterval!=null&&(clearInterval(e.nodesPollInterval),e.nodesPollInterval=null)}function na(e){e.logsPollInterval==null&&(e.logsPollInterval=window.setInterval(()=>{e.tab==="logs"&&ta(e,{quiet:!0})},2e3))}function sa(e){e.logsPollInterval!=null&&(clearInterval(e.logsPollInterval),e.logsPollInterval=null)}function ia(e){e.debugPollInterval==null&&(e.debugPollInterval=window.setInterval(()=>{e.tab==="debug"&&fs(e)},3e3))}function aa(e){e.debugPollInterval!=null&&(clearInterval(e.debugPollInterval),e.debugPollInterval=null)}async function hl(e,t){if(!(!e.client||!e.connected||e.agentIdentityLoading)&&!e.agentIdentityById[t]){e.agentIdentityLoading=!0,e.agentIdentityError=null;try{const n=await e.client.request("agent.identity.get",{agentId:t});n&&(e.agentIdentityById={...e.agentIdentityById,[t]:n})}catch(n){e.agentIdentityError=String(n)}finally{e.agentIdentityLoading=!1}}}async function fl(e,t){if(!e.client||!e.connected||e.agentIdentityLoading)return;const n=t.filter(s=>!e.agentIdentityById[s]);if(n.length!==0){e.agentIdentityLoading=!0,e.agentIdentityError=null;try{for(const s of n){const i=await e.client.request("agent.identity.get",{agentId:s});i&&(e.agentIdentityById={...e.agentIdentityById,[s]:i})}}catch(s){e.agentIdentityError=String(s)}finally{e.agentIdentityLoading=!1}}}async function Wn(e,t){if(!(!e.client||!e.connected)&&!e.agentSkillsLoading){e.agentSkillsLoading=!0,e.agentSkillsError=null;try{const n=await e.client.request("skills.status",{agentId:t});n&&(e.agentSkillsReport=n,e.agentSkillsAgentId=t)}catch(n){e.agentSkillsError=String(n)}finally{e.agentSkillsLoading=!1}}}async function oa(e,t){if(!(!e.client||!e.connected)&&!e.agentsLoading){e.agentsLoading=!0,e.agentsError=null;try{const n=await e.client.request("agents.list",{});if(n){e.agentsList=n;const s=e.agentsSelectedId,i=n.agents.some(a=>a.id===s);(!s||!i)&&(e.agentsSelectedId=n.defaultId??n.agents[0]?.id??null)}}catch(n){e.agentsError=String(n)}finally{e.agentsLoading=!1}}}function ra(e,t){if(e==null||!Number.isFinite(e)||e<=0)return;if(e<1e3)return`${Math.round(e)}ms`;const n=t?.spaced?" ":"",s=Math.round(e/1e3),i=Math.floor(s/3600),a=Math.floor(s%3600/60),o=s%60;if(i>=24){const l=Math.floor(i/24),c=i%24;return c>0?`${l}d${n}${c}h`:`${l}d`}return i>0?a>0?`${i}h${n}${a}m`:`${i}h`:a>0?o>0?`${a}m${n}${o}s`:`${a}m`:`${o}s`}function la(e,t="n/a"){if(e==null||!Number.isFinite(e)||e<0)return t;if(e<1e3)return`${Math.round(e)}ms`;const n=Math.round(e/1e3);if(n<60)return`${n}s`;const s=Math.round(n/60);if(s<60)return`${s}m`;const i=Math.round(s/60);return i<24?`${i}h`:`${Math.round(i/24)}d`}function Y(e,t){const n=t?.fallback??"n/a";if(e==null||!Number.isFinite(e))return n;const s=Date.now()-e,i=Math.abs(s),a=s>=0,o=Math.round(i/1e3);if(o<60)return a?"just now":"in <1m";const l=Math.round(o/60);if(l<60)return a?`${l}m ago`:`in ${l}m`;const c=Math.round(l/60);if(c<48)return a?`${c}h ago`:`in ${c}h`;const p=Math.round(c/24);return a?`${p}d ago`:`in ${p}d`}function $o(e){const t=[],n=/(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(?:\n\2(?:\n|$)|$)/g;for(const i of e.matchAll(n)){const a=(i.index??0)+i[1].length;t.push({start:a,end:a+i[0].length-i[1].length})}const s=/`+[^`]+`+/g;for(const i of e.matchAll(s)){const a=i.index??0,o=a+i[0].length;t.some(c=>a>=c.start&&o<=c.end)||t.push({start:a,end:o})}return t.sort((i,a)=>i.start-a.start),t}function ko(e,t){return t.some(n=>e>=n.start&&e<n.end)}const fu=/<\s*\/?\s*(?:think(?:ing)?|thought|antthinking|final)\b/i,In=/<\s*\/?\s*final\b[^<>]*>/gi,So=/<\s*(\/?)\s*(?:think(?:ing)?|thought|antthinking)\b[^<>]*>/gi;function mu(e,t){return e.trimStart()}function vu(e,t){if(!e||!fu.test(e))return e;let n=e;if(In.test(n)){In.lastIndex=0;const l=[],c=$o(n);for(const p of n.matchAll(In)){const g=p.index??0;l.push({start:g,length:p[0].length,inCode:ko(g,c)})}for(let p=l.length-1;p>=0;p--){const g=l[p];g.inCode||(n=n.slice(0,g.start)+n.slice(g.start+g.length))}}else In.lastIndex=0;const s=$o(n);So.lastIndex=0;let i="",a=0,o=!1;for(const l of n.matchAll(So)){const c=l.index??0,p=l[1]==="/";ko(c,s)||(o?p&&(o=!1):(i+=n.slice(a,c),p||(o=!0)),a=c+l[0].length)}return i+=n.slice(a),mu(i)}function Ct(e){return!e&&e!==0?"n/a":new Date(e).toLocaleString()}function xi(e){return!e||e.length===0?"none":e.filter(t=>!!(t&&t.trim())).join(", ")}function wi(e,t=120){return e.length<=t?e:`${e.slice(0,Math.max(0,t-1))}…`}function ml(e,t){return e.length<=t?{text:e,truncated:!1,total:e.length}:{text:e.slice(0,Math.max(0,t)),truncated:!0,total:e.length}}function Jn(e,t){const n=Number(e);return Number.isFinite(n)?n:t}function zs(e){return vu(e)}async function yn(e){if(!(!e.client||!e.connected))try{const t=await e.client.request("cron.status",{});e.cronStatus=t}catch(t){e.cronError=String(t)}}async function vs(e){if(!(!e.client||!e.connected)&&!e.cronLoading){e.cronLoading=!0,e.cronError=null;try{const t=await e.client.request("cron.list",{includeDisabled:!0});e.cronJobs=Array.isArray(t.jobs)?t.jobs:[]}catch(t){e.cronError=String(t)}finally{e.cronLoading=!1}}}function bu(e){if(e.scheduleKind==="at"){const n=Date.parse(e.scheduleAt);if(!Number.isFinite(n))throw new Error("Invalid run time.");return{kind:"at",at:new Date(n).toISOString()}}if(e.scheduleKind==="every"){const n=Jn(e.everyAmount,0);if(n<=0)throw new Error("Invalid interval amount.");const s=e.everyUnit;return{kind:"every",everyMs:n*(s==="minutes"?6e4:s==="hours"?36e5:864e5)}}const t=e.cronExpr.trim();if(!t)throw new Error("Cron expression required.");return{kind:"cron",expr:t,tz:e.cronTz.trim()||void 0}}function yu(e){if(e.payloadKind==="systemEvent"){const i=e.payloadText.trim();if(!i)throw new Error("System event text required.");return{kind:"systemEvent",text:i}}const t=e.payloadText.trim();if(!t)throw new Error("Agent message required.");const n={kind:"agentTurn",message:t},s=Jn(e.timeoutSeconds,0);return s>0&&(n.timeoutSeconds=s),n}async function xu(e){if(!(!e.client||!e.connected||e.cronBusy)){e.cronBusy=!0,e.cronError=null;try{const t=bu(e.cronForm),n=yu(e.cronForm),s=e.cronForm.sessionTarget==="isolated"&&e.cronForm.payloadKind==="agentTurn"&&e.cronForm.deliveryMode?{mode:e.cronForm.deliveryMode==="announce"?"announce":"none",channel:e.cronForm.deliveryChannel.trim()||"last",to:e.cronForm.deliveryTo.trim()||void 0}:void 0,i=e.cronForm.agentId.trim(),a={name:e.cronForm.name.trim(),description:e.cronForm.description.trim()||void 0,agentId:i||void 0,enabled:e.cronForm.enabled,schedule:t,sessionTarget:e.cronForm.sessionTarget,wakeMode:e.cronForm.wakeMode,payload:n,delivery:s};if(!a.name)throw new Error("Name required.");await e.client.request("cron.add",a),e.cronForm={...e.cronForm,name:"",description:"",payloadText:""},await vs(e),await yn(e)}catch(t){e.cronError=String(t)}finally{e.cronBusy=!1}}}async function wu(e,t,n){if(!(!e.client||!e.connected||e.cronBusy)){e.cronBusy=!0,e.cronError=null;try{await e.client.request("cron.update",{id:t.id,patch:{enabled:n}}),await vs(e),await yn(e)}catch(s){e.cronError=String(s)}finally{e.cronBusy=!1}}}async function $u(e,t){if(!(!e.client||!e.connected||e.cronBusy)){e.cronBusy=!0,e.cronError=null;try{await e.client.request("cron.run",{id:t.id,mode:"force"}),await vl(e,t.id)}catch(n){e.cronError=String(n)}finally{e.cronBusy=!1}}}async function ku(e,t){if(!(!e.client||!e.connected||e.cronBusy)){e.cronBusy=!0,e.cronError=null;try{await e.client.request("cron.remove",{id:t.id}),e.cronRunsJobId===t.id&&(e.cronRunsJobId=null,e.cronRuns=[]),await vs(e),await yn(e)}catch(n){e.cronError=String(n)}finally{e.cronBusy=!1}}}async function vl(e,t){if(!(!e.client||!e.connected))try{const n=await e.client.request("cron.runs",{id:t,limit:50});e.cronRunsJobId=t,e.cronRuns=Array.isArray(n.entries)?n.entries:[]}catch(n){e.cronError=String(n)}}const bl="winclaw.device.auth.v1";function ca(e){return e.trim()}function Su(e){if(!Array.isArray(e))return[];const t=new Set;for(const n of e){const s=n.trim();s&&t.add(s)}return[...t].toSorted()}function da(){try{const e=window.localStorage.getItem(bl);if(!e)return null;const t=JSON.parse(e);return!t||t.version!==1||!t.deviceId||typeof t.deviceId!="string"||!t.tokens||typeof t.tokens!="object"?null:t}catch{return null}}function yl(e){try{window.localStorage.setItem(bl,JSON.stringify(e))}catch{}}function Au(e){const t=da();if(!t||t.deviceId!==e.deviceId)return null;const n=ca(e.role),s=t.tokens[n];return!s||typeof s.token!="string"?null:s}function xl(e){const t=ca(e.role),n={version:1,deviceId:e.deviceId,tokens:{}},s=da();s&&s.deviceId===e.deviceId&&(n.tokens={...s.tokens});const i={token:e.token,role:t,scopes:Su(e.scopes),updatedAtMs:Date.now()};return n.tokens[t]=i,yl(n),i}function wl(e){const t=da();if(!t||t.deviceId!==e.deviceId)return;const n=ca(e.role);if(!t.tokens[n])return;const s={...t,tokens:{...t.tokens}};delete s.tokens[n],yl(s)}const $l={p:0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffedn,n:0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3edn,h:8n,a:0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffecn,d:0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3n,Gx:0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51an,Gy:0x6666666666666666666666666666666666666666666666666666666666666658n},{p:me,n:qn,Gx:Ao,Gy:Co,a:js,d:Ks,h:Cu}=$l,Tt=32,ua=64,Tu=(...e)=>{"captureStackTrace"in Error&&typeof Error.captureStackTrace=="function"&&Error.captureStackTrace(...e)},ue=(e="")=>{const t=new Error(e);throw Tu(t,ue),t},_u=e=>typeof e=="bigint",Eu=e=>typeof e=="string",Lu=e=>e instanceof Uint8Array||ArrayBuffer.isView(e)&&e.constructor.name==="Uint8Array",ot=(e,t,n="")=>{const s=Lu(e),i=e?.length,a=t!==void 0;if(!s||a&&i!==t){const o=n&&`"${n}" `,l=a?` of length ${t}`:"",c=s?`length=${i}`:`type=${typeof e}`;ue(o+"expected Uint8Array"+l+", got "+c)}return e},bs=e=>new Uint8Array(e),kl=e=>Uint8Array.from(e),Sl=(e,t)=>e.toString(16).padStart(t,"0"),Al=e=>Array.from(ot(e)).map(t=>Sl(t,2)).join(""),Qe={_0:48,_9:57,A:65,F:70,a:97,f:102},To=e=>{if(e>=Qe._0&&e<=Qe._9)return e-Qe._0;if(e>=Qe.A&&e<=Qe.F)return e-(Qe.A-10);if(e>=Qe.a&&e<=Qe.f)return e-(Qe.a-10)},Cl=e=>{const t="hex invalid";if(!Eu(e))return ue(t);const n=e.length,s=n/2;if(n%2)return ue(t);const i=bs(s);for(let a=0,o=0;a<s;a++,o+=2){const l=To(e.charCodeAt(o)),c=To(e.charCodeAt(o+1));if(l===void 0||c===void 0)return ue(t);i[a]=l*16+c}return i},Tl=()=>globalThis?.crypto,Iu=()=>Tl()?.subtle??ue("crypto.subtle must be defined, consider polyfill"),fn=(...e)=>{const t=bs(e.reduce((s,i)=>s+ot(i).length,0));let n=0;return e.forEach(s=>{t.set(s,n),n+=s.length}),t},Mu=(e=Tt)=>Tl().getRandomValues(bs(e)),Zn=BigInt,mt=(e,t,n,s="bad number: out of range")=>_u(e)&&t<=e&&e<n?e:ue(s),F=(e,t=me)=>{const n=e%t;return n>=0n?n:t+n},_l=e=>F(e,qn),Ru=(e,t)=>{(e===0n||t<=0n)&&ue("no inverse n="+e+" mod="+t);let n=F(e,t),s=t,i=0n,a=1n;for(;n!==0n;){const o=s/n,l=s%n,c=i-a*o;s=n,n=l,i=a,a=c}return s===1n?F(i,t):ue("no inverse")},Pu=e=>{const t=Ml[e];return typeof t!="function"&&ue("hashes."+e+" not set"),t},Vs=e=>e instanceof Ee?e:ue("Point expected"),$i=2n**256n;class Ee{static BASE;static ZERO;X;Y;Z;T;constructor(t,n,s,i){const a=$i;this.X=mt(t,0n,a),this.Y=mt(n,0n,a),this.Z=mt(s,1n,a),this.T=mt(i,0n,a),Object.freeze(this)}static CURVE(){return $l}static fromAffine(t){return new Ee(t.x,t.y,1n,F(t.x*t.y))}static fromBytes(t,n=!1){const s=Ks,i=kl(ot(t,Tt)),a=t[31];i[31]=a&-129;const o=Ll(i);mt(o,0n,n?$i:me);const c=F(o*o),p=F(c-1n),g=F(s*c+1n);let{isValid:u,value:h}=Fu(p,g);u||ue("bad point: y not sqrt");const f=(h&1n)===1n,d=(a&128)!==0;return!n&&h===0n&&d&&ue("bad point: x==0, isLastByteOdd"),d!==f&&(h=F(-h)),new Ee(h,o,1n,F(h*o))}static fromHex(t,n){return Ee.fromBytes(Cl(t),n)}get x(){return this.toAffine().x}get y(){return this.toAffine().y}assertValidity(){const t=js,n=Ks,s=this;if(s.is0())return ue("bad point: ZERO");const{X:i,Y:a,Z:o,T:l}=s,c=F(i*i),p=F(a*a),g=F(o*o),u=F(g*g),h=F(c*t),f=F(g*F(h+p)),d=F(u+F(n*F(c*p)));if(f!==d)return ue("bad point: equation left != right (1)");const m=F(i*a),k=F(o*l);return m!==k?ue("bad point: equation left != right (2)"):this}equals(t){const{X:n,Y:s,Z:i}=this,{X:a,Y:o,Z:l}=Vs(t),c=F(n*l),p=F(a*i),g=F(s*l),u=F(o*i);return c===p&&g===u}is0(){return this.equals(Ht)}negate(){return new Ee(F(-this.X),this.Y,this.Z,F(-this.T))}double(){const{X:t,Y:n,Z:s}=this,i=js,a=F(t*t),o=F(n*n),l=F(2n*F(s*s)),c=F(i*a),p=t+n,g=F(F(p*p)-a-o),u=c+o,h=u-l,f=c-o,d=F(g*h),m=F(u*f),k=F(g*f),S=F(h*u);return new Ee(d,m,S,k)}add(t){const{X:n,Y:s,Z:i,T:a}=this,{X:o,Y:l,Z:c,T:p}=Vs(t),g=js,u=Ks,h=F(n*o),f=F(s*l),d=F(a*u*p),m=F(i*c),k=F((n+s)*(o+l)-h-f),S=F(m-d),$=F(m+d),C=F(f-g*h),A=F(k*S),T=F($*C),E=F(k*C),M=F(S*$);return new Ee(A,T,M,E)}subtract(t){return this.add(Vs(t).negate())}multiply(t,n=!0){if(!n&&(t===0n||this.is0()))return Ht;if(mt(t,1n,qn),t===1n)return this;if(this.equals(_t))return qu(t).p;let s=Ht,i=_t;for(let a=this;t>0n;a=a.double(),t>>=1n)t&1n?s=s.add(a):n&&(i=i.add(a));return s}multiplyUnsafe(t){return this.multiply(t,!1)}toAffine(){const{X:t,Y:n,Z:s}=this;if(this.equals(Ht))return{x:0n,y:1n};const i=Ru(s,me);F(s*i)!==1n&&ue("invalid inverse");const a=F(t*i),o=F(n*i);return{x:a,y:o}}toBytes(){const{x:t,y:n}=this.assertValidity().toAffine(),s=El(n);return s[31]|=t&1n?128:0,s}toHex(){return Al(this.toBytes())}clearCofactor(){return this.multiply(Zn(Cu),!1)}isSmallOrder(){return this.clearCofactor().is0()}isTorsionFree(){let t=this.multiply(qn/2n,!1).double();return qn%2n&&(t=t.add(this)),t.is0()}}const _t=new Ee(Ao,Co,1n,F(Ao*Co)),Ht=new Ee(0n,1n,1n,0n);Ee.BASE=_t;Ee.ZERO=Ht;const El=e=>Cl(Sl(mt(e,0n,$i),ua)).reverse(),Ll=e=>Zn("0x"+Al(kl(ot(e)).reverse())),Oe=(e,t)=>{let n=e;for(;t-- >0n;)n*=n,n%=me;return n},Du=e=>{const n=e*e%me*e%me,s=Oe(n,2n)*n%me,i=Oe(s,1n)*e%me,a=Oe(i,5n)*i%me,o=Oe(a,10n)*a%me,l=Oe(o,20n)*o%me,c=Oe(l,40n)*l%me,p=Oe(c,80n)*c%me,g=Oe(p,80n)*c%me,u=Oe(g,10n)*a%me;return{pow_p_5_8:Oe(u,2n)*e%me,b2:n}},_o=0x2b8324804fc1df0b2b4d00993dfbd7a72f431806ad2fe478c4ee1b274a0ea0b0n,Fu=(e,t)=>{const n=F(t*t*t),s=F(n*n*t),i=Du(e*s).pow_p_5_8;let a=F(e*n*i);const o=F(t*a*a),l=a,c=F(a*_o),p=o===e,g=o===F(-e),u=o===F(-e*_o);return p&&(a=l),(g||u)&&(a=c),(F(a)&1n)===1n&&(a=F(-a)),{isValid:p||g,value:a}},ki=e=>_l(Ll(e)),pa=(...e)=>Ml.sha512Async(fn(...e)),Nu=(...e)=>Pu("sha512")(fn(...e)),Il=e=>{const t=e.slice(0,Tt);t[0]&=248,t[31]&=127,t[31]|=64;const n=e.slice(Tt,ua),s=ki(t),i=_t.multiply(s),a=i.toBytes();return{head:t,prefix:n,scalar:s,point:i,pointBytes:a}},ga=e=>pa(ot(e,Tt)).then(Il),Ou=e=>Il(Nu(ot(e,Tt))),Bu=e=>ga(e).then(t=>t.pointBytes),Uu=e=>pa(e.hashable).then(e.finish),Hu=(e,t,n)=>{const{pointBytes:s,scalar:i}=e,a=ki(t),o=_t.multiply(a).toBytes();return{hashable:fn(o,s,n),finish:p=>{const g=_l(a+ki(p)*i);return ot(fn(o,El(g)),ua)}}},zu=async(e,t)=>{const n=ot(e),s=await ga(t),i=await pa(s.prefix,n);return Uu(Hu(s,i,n))},Ml={sha512Async:async e=>{const t=Iu(),n=fn(e);return bs(await t.digest("SHA-512",n.buffer))},sha512:void 0},ju=(e=Mu(Tt))=>e,Ku={getExtendedPublicKeyAsync:ga,getExtendedPublicKey:Ou,randomSecretKey:ju},Xn=8,Vu=256,Rl=Math.ceil(Vu/Xn)+1,Si=2**(Xn-1),Wu=()=>{const e=[];let t=_t,n=t;for(let s=0;s<Rl;s++){n=t,e.push(n);for(let i=1;i<Si;i++)n=n.add(t),e.push(n);t=n.double()}return e};let Eo;const Lo=(e,t)=>{const n=t.negate();return e?n:t},qu=e=>{const t=Eo||(Eo=Wu());let n=Ht,s=_t;const i=2**Xn,a=i,o=Zn(i-1),l=Zn(Xn);for(let c=0;c<Rl;c++){let p=Number(e&o);e>>=l,p>Si&&(p-=a,e+=1n);const g=c*Si,u=g,h=g+Math.abs(p)-1,f=c%2!==0,d=p<0;p===0?s=s.add(Lo(f,t[u])):n=n.add(Lo(d,t[h]))}return e!==0n&&ue("invalid wnaf"),{p:n,f:s}},Ws="winclaw-device-identity-v1";function Ai(e){let t="";for(const n of e)t+=String.fromCharCode(n);return btoa(t).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}function Pl(e){const t=e.replaceAll("-","+").replaceAll("_","/"),n=t+"=".repeat((4-t.length%4)%4),s=atob(n),i=new Uint8Array(s.length);for(let a=0;a<s.length;a+=1)i[a]=s.charCodeAt(a);return i}function Gu(e){return Array.from(e).map(t=>t.toString(16).padStart(2,"0")).join("")}async function Dl(e){const t=await crypto.subtle.digest("SHA-256",e.slice().buffer);return Gu(new Uint8Array(t))}async function Qu(){const e=Ku.randomSecretKey(),t=await Bu(e);return{deviceId:await Dl(t),publicKey:Ai(t),privateKey:Ai(e)}}async function ha(){try{const n=localStorage.getItem(Ws);if(n){const s=JSON.parse(n);if(s?.version===1&&typeof s.deviceId=="string"&&typeof s.publicKey=="string"&&typeof s.privateKey=="string"){const i=await Dl(Pl(s.publicKey));if(i!==s.deviceId){const a={...s,deviceId:i};return localStorage.setItem(Ws,JSON.stringify(a)),{deviceId:i,publicKey:s.publicKey,privateKey:s.privateKey}}return{deviceId:s.deviceId,publicKey:s.publicKey,privateKey:s.privateKey}}}}catch{}const e=await Qu(),t={version:1,deviceId:e.deviceId,publicKey:e.publicKey,privateKey:e.privateKey,createdAtMs:Date.now()};return localStorage.setItem(Ws,JSON.stringify(t)),e}async function Yu(e,t){const n=Pl(e),s=new TextEncoder().encode(t),i=await zu(s,n);return Ai(i)}async function rt(e,t){if(!(!e.client||!e.connected)&&!e.devicesLoading){e.devicesLoading=!0,t?.quiet||(e.devicesError=null);try{const n=await e.client.request("device.pair.list",{});e.devicesList={pending:Array.isArray(n?.pending)?n.pending:[],paired:Array.isArray(n?.paired)?n.paired:[]}}catch(n){t?.quiet||(e.devicesError=String(n))}finally{e.devicesLoading=!1}}}async function Ju(e,t){if(!(!e.client||!e.connected))try{await e.client.request("device.pair.approve",{requestId:t}),await rt(e)}catch(n){e.devicesError=String(n)}}async function Zu(e,t){if(!(!e.client||!e.connected||!window.confirm("Reject this device pairing request?")))try{await e.client.request("device.pair.reject",{requestId:t}),await rt(e)}catch(s){e.devicesError=String(s)}}async function Xu(e,t){if(!(!e.client||!e.connected))try{const n=await e.client.request("device.token.rotate",t);if(n?.token){const s=await ha(),i=n.role??t.role;(n.deviceId===s.deviceId||t.deviceId===s.deviceId)&&xl({deviceId:s.deviceId,role:i,token:n.token,scopes:n.scopes??t.scopes??[]}),window.prompt("New device token (copy and store securely):",n.token)}await rt(e)}catch(n){e.devicesError=String(n)}}async function ep(e,t){if(!(!e.client||!e.connected||!window.confirm(`Revoke token for ${t.deviceId} (${t.role})?`)))try{await e.client.request("device.token.revoke",t);const s=await ha();t.deviceId===s.deviceId&&wl({deviceId:s.deviceId,role:t.role}),await rt(e)}catch(s){e.devicesError=String(s)}}function tp(e){if(!e||e.kind==="gateway")return{method:"exec.approvals.get",params:{}};const t=e.nodeId.trim();return t?{method:"exec.approvals.node.get",params:{nodeId:t}}:null}function np(e,t){if(!e||e.kind==="gateway")return{method:"exec.approvals.set",params:t};const n=e.nodeId.trim();return n?{method:"exec.approvals.node.set",params:{...t,nodeId:n}}:null}async function fa(e,t){if(!(!e.client||!e.connected)&&!e.execApprovalsLoading){e.execApprovalsLoading=!0,e.lastError=null;try{const n=tp(t);if(!n){e.lastError="Select a node before loading exec approvals.";return}const s=await e.client.request(n.method,n.params);sp(e,s)}catch(n){e.lastError=String(n)}finally{e.execApprovalsLoading=!1}}}function sp(e,t){e.execApprovalsSnapshot=t,e.execApprovalsDirty||(e.execApprovalsForm=At(t.file??{}))}async function ip(e,t){if(!(!e.client||!e.connected)){e.execApprovalsSaving=!0,e.lastError=null;try{const n=e.execApprovalsSnapshot?.hash;if(!n){e.lastError="Exec approvals hash missing; reload and retry.";return}const s=e.execApprovalsForm??e.execApprovalsSnapshot?.file??{},i=np(t,{file:s,baseHash:n});if(!i){e.lastError="Select a node before saving exec approvals.";return}await e.client.request(i.method,i.params),e.execApprovalsDirty=!1,await fa(e,t)}catch(n){e.lastError=String(n)}finally{e.execApprovalsSaving=!1}}}function ap(e,t,n){const s=At(e.execApprovalsForm??e.execApprovalsSnapshot?.file??{});ll(s,t,n),e.execApprovalsForm=s,e.execApprovalsDirty=!0}function op(e,t){const n=At(e.execApprovalsForm??e.execApprovalsSnapshot?.file??{});cl(n,t),e.execApprovalsForm=n,e.execApprovalsDirty=!0}async function ma(e){if(!(!e.client||!e.connected)&&!e.personalInfoLoading){e.personalInfoLoading=!0,e.personalInfoError=null,e.personalInfoSuccess=null;try{const t=await e.client.request("personal-info.get",{});e.personalInfo=t,e.personalInfoForm={...t},e.personalInfoDirty=!1}catch(t){e.personalInfoError=String(t)}finally{e.personalInfoLoading=!1}}}async function rp(e){if(!(!e.client||!e.connected||!e.personalInfoForm)){e.personalInfoSaving=!0,e.personalInfoError=null,e.personalInfoSuccess=null;try{const t=await e.client.request("personal-info.save",{employeeId:e.personalInfoForm.employeeId,employeeName:e.personalInfoForm.employeeName,employeeEmail:e.personalInfoForm.employeeEmail,grcUrl:e.personalInfoForm.grcUrl});e.personalInfoDirty=!1;let n="保存しました";t.grcSynced?n+=" (GRC同期完了)":t.grcError&&(n+=` (GRC同期失敗: ${t.grcError})`),e.personalInfoSuccess=n,await ma(e)}catch(t){e.personalInfoError=String(t)}finally{e.personalInfoSaving=!1}}}function lp(e,t,n){e.personalInfoForm&&(e.personalInfoForm={...e.personalInfoForm,[t]:n},e.personalInfoDirty=!0,e.personalInfoSuccess=null)}async function va(e){if(!(!e.client||!e.connected)&&!e.presenceLoading){e.presenceLoading=!0,e.presenceError=null,e.presenceStatus=null;try{const t=await e.client.request("system-presence",{});Array.isArray(t)?(e.presenceEntries=t,e.presenceStatus=t.length===0?"No instances yet.":null):(e.presenceEntries=[],e.presenceStatus="No presence payload.")}catch(t){e.presenceError=String(t)}finally{e.presenceLoading=!1}}}async function lt(e,t){if(!(!e.client||!e.connected)&&!e.sessionsLoading){e.sessionsLoading=!0,e.sessionsError=null;try{const n=t?.includeGlobal??e.sessionsIncludeGlobal,s=t?.includeUnknown??e.sessionsIncludeUnknown,i=t?.activeMinutes??Jn(e.sessionsFilterActive,0),a=t?.limit??Jn(e.sessionsFilterLimit,0),o={includeGlobal:n,includeUnknown:s,includeDerivedTitles:!0};i>0&&(o.activeMinutes=i),a>0&&(o.limit=a);const l=await e.client.request("sessions.list",o);l&&(e.sessionsResult=l)}catch(n){e.sessionsError=String(n)}finally{e.sessionsLoading=!1}}}async function ba(e,t,n){if(!e.client||!e.connected)return;const s={key:t};"label"in n&&(s.label=n.label),"thinkingLevel"in n&&(s.thinkingLevel=n.thinkingLevel),"verboseLevel"in n&&(s.verboseLevel=n.verboseLevel),"reasoningLevel"in n&&(s.reasoningLevel=n.reasoningLevel),"model"in n&&(s.model=n.model),"workspace"in n&&(s.workspace=n.workspace);try{await e.client.request("sessions.patch",s),await lt(e)}catch(i){e.sessionsError=String(i)}}async function cp(e,t){if(!(!e.client||!e.connected||e.sessionsLoading||!window.confirm(`Delete session "${t}"?

Deletes the session entry and archives its transcript.`))){e.sessionsLoading=!0,e.sessionsError=null;try{await e.client.request("sessions.delete",{key:t,deleteTranscript:!0}),await lt(e)}catch(s){e.sessionsError=String(s)}finally{e.sessionsLoading=!1}}}function Vt(e,t,n){if(!t.trim())return;const s={...e.skillMessages};n?s[t]=n:delete s[t],e.skillMessages=s}function ys(e){return e instanceof Error?e.message:String(e)}async function xn(e,t){if(t?.clearMessages&&Object.keys(e.skillMessages).length>0&&(e.skillMessages={}),!(!e.client||!e.connected)&&!e.skillsLoading){e.skillsLoading=!0,e.skillsError=null;try{const n=await e.client.request("skills.status",{});n&&(e.skillsReport=n)}catch(n){e.skillsError=ys(n)}finally{e.skillsLoading=!1}}}function dp(e,t,n){e.skillEdits={...e.skillEdits,[t]:n}}async function up(e,t,n){if(!(!e.client||!e.connected)){e.skillsBusyKey=t,e.skillsError=null;try{await e.client.request("skills.update",{skillKey:t,enabled:n}),await xn(e),Vt(e,t,{kind:"success",message:n?"Skill enabled":"Skill disabled"})}catch(s){const i=ys(s);e.skillsError=i,Vt(e,t,{kind:"error",message:i})}finally{e.skillsBusyKey=null}}}async function pp(e,t){if(!(!e.client||!e.connected)){e.skillsBusyKey=t,e.skillsError=null;try{const n=e.skillEdits[t]??"";await e.client.request("skills.update",{skillKey:t,apiKey:n}),await xn(e),Vt(e,t,{kind:"success",message:"API key saved"})}catch(n){const s=ys(n);e.skillsError=s,Vt(e,t,{kind:"error",message:s})}finally{e.skillsBusyKey=null}}}async function gp(e,t,n,s){if(!(!e.client||!e.connected)){e.skillsBusyKey=t,e.skillsError=null;try{const i=await e.client.request("skills.install",{name:n,installId:s,timeoutMs:12e4});await xn(e),Vt(e,t,{kind:"success",message:i?.message??"Installed"})}catch(i){const a=ys(i);e.skillsError=a,Vt(e,t,{kind:"error",message:a})}finally{e.skillsBusyKey=null}}}const Fl={agents:"/agents",overview:"/overview",channels:"/channels",instances:"/instances",sessions:"/sessions",usage:"/usage",cron:"/cron",skills:"/skills",nodes:"/nodes",chat:"/chat","digital-human":"/digital-human",personal:"/personal",config:"/config",debug:"/debug",logs:"/logs"},Nl=new Map(Object.entries(Fl).map(([e,t])=>[t,e]));function wn(e){if(!e)return"";let t=e.trim();return t.startsWith("/")||(t=`/${t}`),t==="/"?"":(t.endsWith("/")&&(t=t.slice(0,-1)),t)}function mn(e){if(!e)return"/";let t=e.trim();return t.startsWith("/")||(t=`/${t}`),t.length>1&&t.endsWith("/")&&(t=t.slice(0,-1)),t}function ya(e,t=""){const n=wn(t),s=Fl[e];return n?`${n}${s}`:s}function Ol(e,t=""){const n=wn(t);let s=e||"/";n&&(s===n?s="/":s.startsWith(`${n}/`)&&(s=s.slice(n.length)));let i=mn(s).toLowerCase();return i.endsWith("/index.html")&&(i="/"),i==="/"?"chat":Nl.get(i)??null}function hp(e){let t=mn(e);if(t.endsWith("/index.html")&&(t=mn(t.slice(0,-11))),t==="/")return"";const n=t.split("/").filter(Boolean);if(n.length===0)return"";for(let s=0;s<n.length;s++){const i=`/${n.slice(s).join("/")}`.toLowerCase();if(Nl.has(i)){const a=n.slice(0,s);return a.length?`/${a.join("/")}`:""}}return`/${n.join("/")}`}function fp(e){switch(e){case"agents":return"folder";case"chat":return"messageSquare";case"overview":return"barChart";case"channels":return"link";case"instances":return"radio";case"sessions":return"fileText";case"usage":return"barChart";case"cron":return"loader";case"skills":return"zap";case"nodes":return"monitor";case"personal":return"user";case"config":return"settings";case"debug":return"bug";case"logs":return"scrollText";case"digital-human":return"monitor";default:return"folder"}}function Ci(e){switch(e){case"agents":return"Agents";case"overview":return"Overview";case"channels":return"Channels";case"instances":return"Instances";case"sessions":return"Sessions";case"usage":return"Usage";case"cron":return"Cron Jobs";case"skills":return"Skills";case"nodes":return"Nodes";case"chat":return"Chat";case"personal":return _("commands.personalInfo");case"config":return"Config";case"debug":return"Debug";case"logs":return"Logs";case"digital-human":return"Digital Human";default:return"Control"}}function Io(){return[_("commands.chat"),_("commands.services"),_("commands.system")]}function qs(){const e=_("commands.chat"),t=_("commands.services"),n=_("commands.system");return[{id:"new-chat",label:_("commands.newConversation"),category:e,icon:"messageSquare",shortcut:"Ctrl+N",keywords:["new","chat","会話","新規"]},{id:"history",label:_("commands.conversationHistory"),category:e,icon:"fileText",tab:"sessions",shortcut:"Ctrl+H",keywords:["history","履歴","sessions"]},{id:"channels",label:_("commands.channelManagement"),category:t,icon:"link",tab:"channels",keywords:["channels","チャネル","slack","discord","telegram"]},{id:"agents",label:_("commands.agentSettings"),category:t,icon:"folder",tab:"agents",keywords:["agents","エージェント"]},{id:"cron",label:_("commands.scheduleManagement"),category:t,icon:"loader",tab:"cron",keywords:["cron","schedule","スケジュール"]},{id:"personal",label:_("commands.personalInfo"),category:n,icon:"user",tab:"personal",keywords:["personal","個人情報","従業員","employee","profile"]},{id:"settings",label:_("commands.settings"),category:n,icon:"settings",tab:"config",shortcut:"Ctrl+,",keywords:["config","設定","settings"]},{id:"overview",label:_("commands.dashboard"),category:n,icon:"barChart",tab:"overview",keywords:["overview","ダッシュボード","dashboard"]},{id:"usage",label:_("commands.checkUsage"),category:n,icon:"barChart",tab:"usage",keywords:["usage","使用量","cost","コスト"]},{id:"skills",label:_("commands.skillManagement"),category:n,icon:"zap",tab:"skills",keywords:["skills","スキル"]},{id:"logs",label:_("commands.showLogs"),category:n,icon:"scrollText",tab:"logs",keywords:["logs","ログ"]},{id:"debug",label:_("commands.debug"),category:n,icon:"bug",tab:"debug",keywords:["debug","デバッグ"]},{id:"nodes",label:_("commands.nodeManagement"),category:n,icon:"monitor",tab:"nodes",keywords:["nodes","ノード"]},{id:"instances",label:_("commands.instances"),category:n,icon:"radio",tab:"instances",keywords:["instances","インスタンス"]}]}function mp(e){switch(e){case"agents":return"Manage agent workspaces, tools, and identities.";case"overview":return"Gateway status, entry points, and a fast health read.";case"channels":return"Manage channels and settings.";case"instances":return"Presence beacons from connected clients and nodes.";case"sessions":return"Inspect active sessions and adjust per-session defaults.";case"usage":return"";case"cron":return"Schedule wakeups and recurring agent runs.";case"skills":return"Manage skill availability and API key injection.";case"nodes":return"Paired devices, capabilities, and command exposure.";case"chat":return"Direct gateway chat session for quick interventions.";case"personal":return _("personal.subtitle");case"config":return"Edit ~/.winclaw/winclaw.json (WinClaw config) safely.";case"debug":return"Gateway snapshots, events, and manual RPC calls.";case"logs":return"Live tail of the gateway file logs.";case"digital-human":return"Real-time voice conversation with your digital human avatar.";default:return""}}const Bl="winclaw.control.settings.v1";function vp(){const t={gatewayUrl:`${location.protocol==="https:"?"wss":"ws"}://${location.host}`,token:"",sessionKey:"main",lastActiveSessionKey:"main",theme:"system",chatFocusMode:!1,chatShowThinking:!0,splitRatio:.6,navCollapsed:!1,navGroupsCollapsed:{},openTabs:["chat"],recentCommands:[],openChatSessions:[],aimetaToken:"",aimetaApi:""};try{const n=localStorage.getItem(Bl);if(!n)return t;const s=JSON.parse(n);return{gatewayUrl:typeof s.gatewayUrl=="string"&&s.gatewayUrl.trim()?s.gatewayUrl.trim():t.gatewayUrl,token:typeof s.token=="string"?s.token:t.token,sessionKey:typeof s.sessionKey=="string"&&s.sessionKey.trim()?s.sessionKey.trim():t.sessionKey,lastActiveSessionKey:typeof s.lastActiveSessionKey=="string"&&s.lastActiveSessionKey.trim()?s.lastActiveSessionKey.trim():typeof s.sessionKey=="string"&&s.sessionKey.trim()||t.lastActiveSessionKey,theme:s.theme==="light"||s.theme==="dark"||s.theme==="system"?s.theme:t.theme,chatFocusMode:typeof s.chatFocusMode=="boolean"?s.chatFocusMode:t.chatFocusMode,chatShowThinking:typeof s.chatShowThinking=="boolean"?s.chatShowThinking:t.chatShowThinking,splitRatio:typeof s.splitRatio=="number"&&s.splitRatio>=.4&&s.splitRatio<=.7?s.splitRatio:t.splitRatio,navCollapsed:typeof s.navCollapsed=="boolean"?s.navCollapsed:t.navCollapsed,navGroupsCollapsed:typeof s.navGroupsCollapsed=="object"&&s.navGroupsCollapsed!==null?s.navGroupsCollapsed:t.navGroupsCollapsed,openTabs:Array.isArray(s.openTabs)&&s.openTabs.every(i=>typeof i=="string")?s.openTabs:t.openTabs,recentCommands:Array.isArray(s.recentCommands)&&s.recentCommands.every(i=>typeof i=="string")?s.recentCommands:t.recentCommands,openChatSessions:Array.isArray(s.openChatSessions)&&s.openChatSessions.every(i=>typeof i=="string")?s.openChatSessions:t.openChatSessions,aimetaToken:typeof s.aimetaToken=="string"?s.aimetaToken:t.aimetaToken,aimetaApi:typeof s.aimetaApi=="string"?s.aimetaApi:t.aimetaApi}}catch{return t}}function bp(e){localStorage.setItem(Bl,JSON.stringify(e))}const Mn=e=>Number.isNaN(e)?.5:e<=0?0:e>=1?1:e,yp=()=>typeof window>"u"||typeof window.matchMedia!="function"?!1:window.matchMedia("(prefers-reduced-motion: reduce)").matches??!1,Rn=e=>{e.classList.remove("theme-transition"),e.style.removeProperty("--theme-switch-x"),e.style.removeProperty("--theme-switch-y")},xp=({nextTheme:e,applyTheme:t,context:n,currentTheme:s})=>{if(s===e)return;const i=globalThis.document??null;if(!i){t();return}const a=i.documentElement,o=i,l=yp();if(!!o.startViewTransition&&!l){let p=.5,g=.5;if(n?.pointerClientX!==void 0&&n?.pointerClientY!==void 0&&typeof window<"u")p=Mn(n.pointerClientX/window.innerWidth),g=Mn(n.pointerClientY/window.innerHeight);else if(n?.element){const u=n.element.getBoundingClientRect();u.width>0&&u.height>0&&typeof window<"u"&&(p=Mn((u.left+u.width/2)/window.innerWidth),g=Mn((u.top+u.height/2)/window.innerHeight))}a.style.setProperty("--theme-switch-x",`${p*100}%`),a.style.setProperty("--theme-switch-y",`${g*100}%`),a.classList.add("theme-transition");try{const u=o.startViewTransition?.(()=>{t()});u?.finished?u.finished.finally(()=>Rn(a)):Rn(a)}catch{Rn(a),t()}return}t(),Rn(a)};function wp(){return typeof window>"u"||typeof window.matchMedia!="function"||window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function xa(e){return e==="system"?wp():e}function Ye(e,t){const n={...t,lastActiveSessionKey:t.lastActiveSessionKey?.trim()||t.sessionKey.trim()||"main"};e.settings=n,bp(n),t.theme!==e.theme&&(e.theme=t.theme,xs(e,xa(t.theme))),e.applySessionKey=e.settings.lastActiveSessionKey}function Ul(e,t){const n=t.trim();n&&e.settings.lastActiveSessionKey!==n&&Ye(e,{...e.settings,lastActiveSessionKey:n})}function $p(e){if(!window.location.search&&!window.location.hash)return;const t=new URL(window.location.href),n=new URLSearchParams(t.search),s=new URLSearchParams(t.hash.startsWith("#")?t.hash.slice(1):t.hash),i=n.get("token")??s.get("token"),a=n.get("password")??s.get("password"),o=n.get("session")??s.get("session"),l=n.get("gatewayUrl")??s.get("gatewayUrl"),c=n.get("aimeta")??s.get("aimeta"),p=n.get("api")??s.get("api");let g=!1;if(i!=null){const h=i.trim();h&&h!==e.settings.token&&Ye(e,{...e.settings,token:h}),n.delete("token"),s.delete("token"),g=!0}if(c!=null||p!=null){const h={};c!=null&&(h.aimetaToken=c.trim(),n.delete("aimeta"),s.delete("aimeta")),p!=null&&(h.aimetaApi=p.trim(),n.delete("api"),s.delete("api")),Ye(e,{...e.settings,...h}),g=!0}if(a!=null){const h=a.trim();h&&(e.password=h),n.delete("password"),s.delete("password"),g=!0}if(o!=null){const h=o.trim();h&&(e.sessionKey=h,Ye(e,{...e.settings,sessionKey:h,lastActiveSessionKey:h}))}if(l!=null){const h=l.trim();h&&h!==e.settings.gatewayUrl&&(e.pendingGatewayUrl=h),n.delete("gatewayUrl"),s.delete("gatewayUrl"),g=!0}if(!g)return;t.search=n.toString();const u=s.toString();t.hash=u?`#${u}`:"",window.history.replaceState({},"",t.toString())}function kp(e,t){e.tab!==t&&(e.tab=t),t==="chat"&&(e.chatHasAutoScrolled=!1),t==="logs"?na(e):sa(e),t==="debug"?ia(e):aa(e),wa(e),zl(e,t,!1)}function Sp(e,t,n){xp({nextTheme:t,applyTheme:()=>{e.theme=t,Ye(e,{...e.settings,theme:t}),xs(e,xa(t))},context:n,currentTheme:e.theme})}async function wa(e){if(e.tab==="personal"&&await ma(e),e.tab==="overview"&&await jl(e),e.tab==="channels"&&await Ip(e),e.tab==="instances"&&await va(e),e.tab==="sessions"&&await lt(e),e.tab==="cron"&&await es(e),e.tab==="skills"&&await xn(e),e.tab==="agents"){await oa(e),await De(e);const t=e.agentsList?.agents?.map(s=>s.id)??[];t.length>0&&fl(e,t);const n=e.agentsSelectedId??e.agentsList?.defaultId??e.agentsList?.agents?.[0]?.id;n&&(hl(e,n),e.agentsPanel==="skills"&&Wn(e,n),e.agentsPanel==="channels"&&$e(e,!1),e.agentsPanel==="cron"&&es(e))}e.tab==="nodes"&&(await ms(e),await rt(e),await De(e),await fa(e)),e.tab==="chat"&&(await Xl(e),bn(e,!e.chatHasAutoScrolled)),e.tab==="config"&&(await dl(e),await De(e)),e.tab==="debug"&&(await fs(e),e.eventLog=e.eventLogBuffer),e.tab==="logs"&&(e.logsAtBottom=!0,await ta(e,{reset:!0}),gl(e,!0))}function Ap(){if(typeof window>"u")return"";const e=window.__WINCLAW_CONTROL_UI_BASE_PATH__;return typeof e=="string"&&e.trim()?wn(e):hp(window.location.pathname)}function Cp(e){e.theme=e.settings.theme??"system",xs(e,xa(e.theme))}function xs(e,t){if(e.themeResolved=t,typeof document>"u")return;const n=document.documentElement;n.dataset.theme=t,n.style.colorScheme=t}function Tp(e){if(typeof window>"u"||typeof window.matchMedia!="function")return;if(e.themeMedia=window.matchMedia("(prefers-color-scheme: dark)"),e.themeMediaHandler=n=>{e.theme==="system"&&xs(e,n.matches?"dark":"light")},typeof e.themeMedia.addEventListener=="function"){e.themeMedia.addEventListener("change",e.themeMediaHandler);return}e.themeMedia.addListener(e.themeMediaHandler)}function _p(e){if(!e.themeMedia||!e.themeMediaHandler)return;if(typeof e.themeMedia.removeEventListener=="function"){e.themeMedia.removeEventListener("change",e.themeMediaHandler);return}e.themeMedia.removeListener(e.themeMediaHandler),e.themeMedia=null,e.themeMediaHandler=null}function Ep(e,t){if(typeof window>"u")return;const n=Ol(window.location.pathname,e.basePath)??"chat";Hl(e,n),zl(e,n,t)}function Lp(e){if(typeof window>"u")return;const t=Ol(window.location.pathname,e.basePath);if(!t)return;const s=new URL(window.location.href).searchParams.get("session")?.trim();s&&(e.sessionKey=s,Ye(e,{...e.settings,sessionKey:s,lastActiveSessionKey:s})),Hl(e,t)}function Hl(e,t){e.tab!==t&&(e.tab=t),t==="chat"&&(e.chatHasAutoScrolled=!1),t==="logs"?na(e):sa(e),t==="debug"?ia(e):aa(e),e.connected&&wa(e)}function zl(e,t,n){if(typeof window>"u")return;const s=mn(ya(t,e.basePath)),i=mn(window.location.pathname),a=new URL(window.location.href);t==="chat"&&e.sessionKey?a.searchParams.set("session",e.sessionKey):a.searchParams.delete("session"),i!==s&&(a.pathname=s),n?window.history.replaceState({},"",a.toString()):window.history.pushState({},"",a.toString())}async function jl(e){await Promise.all([$e(e,!1),va(e),lt(e),yn(e),fs(e)])}async function Ip(e){await Promise.all([$e(e,!0),dl(e),De(e)])}async function es(e){await Promise.all([$e(e,!1),yn(e),vs(e)])}const Mo=50,Mp=80,Rp=12e4,Ro=5e3;function Pp(e){if(!e||typeof e!="object")return null;const t=e;if(typeof t.text=="string")return t.text;const n=t.content;if(!Array.isArray(n))return null;const s=n.map(i=>{if(!i||typeof i!="object")return null;const a=i;return a.type==="text"&&typeof a.text=="string"?a.text:null}).filter(i=>!!i);return s.length===0?null:s.join(`
`)}function ts(e){if(e==null)return null;if(typeof e=="number"||typeof e=="boolean")return String(e);const t=Pp(e);let n;if(typeof e=="string")n=e;else if(t)n=t;else try{n=JSON.stringify(e,null,2)}catch{n=String(e)}const s=ml(n,Rp);return s.truncated?`${s.text}

… truncated (${s.total} chars, showing first ${s.text.length}).`:s.text}function Dp(e){const t=[];return t.push({type:"toolcall",name:e.name,arguments:e.args??{}}),e.output&&t.push({type:"toolresult",name:e.name,text:e.output}),{role:"assistant",toolCallId:e.toolCallId,runId:e.runId,content:t,timestamp:e.startedAt}}function Fp(e){if(e.toolStreamOrder.length<=Mo)return;const t=e.toolStreamOrder.length-Mo,n=e.toolStreamOrder.splice(0,t);for(const s of n)e.toolStreamById.delete(s)}function Np(e){e.chatToolMessages=e.toolStreamOrder.map(t=>e.toolStreamById.get(t)?.message).filter(t=>!!t)}function Ti(e){e.toolStreamSyncTimer!=null&&(clearTimeout(e.toolStreamSyncTimer),e.toolStreamSyncTimer=null),Np(e)}function Op(e,t=!1){if(t){Ti(e);return}e.toolStreamSyncTimer==null&&(e.toolStreamSyncTimer=window.setTimeout(()=>Ti(e),Mp))}function ws(e){e.toolStreamById.clear(),e.toolStreamOrder=[],e.chatToolMessages=[],Ti(e)}const Bp=5e3;function Up(e,t){const n=t.data??{},s=typeof n.phase=="string"?n.phase:"";e.compactionClearTimer!=null&&(window.clearTimeout(e.compactionClearTimer),e.compactionClearTimer=null),s==="start"?e.compactionStatus={active:!0,startedAt:Date.now(),completedAt:null}:s==="end"&&(e.compactionStatus={active:!1,startedAt:e.compactionStatus?.startedAt??null,completedAt:Date.now()},e.compactionClearTimer=window.setTimeout(()=>{e.compactionStatus=null,e.compactionClearTimer=null},Bp))}function Hp(e,t){if(!t)return;if(t.stream==="compaction"){Up(e,t);return}if(t.stream!=="tool")return;const n=typeof t.sessionKey=="string"?t.sessionKey:void 0;if(n&&n!==e.sessionKey||!n&&e.chatRunId&&t.runId!==e.chatRunId||e.chatRunId&&t.runId!==e.chatRunId||!e.chatRunId)return;const s=t.data??{},i=typeof s.toolCallId=="string"?s.toolCallId:"";if(!i)return;const a=typeof s.name=="string"?s.name:"tool",o=typeof s.phase=="string"?s.phase:"",l=o==="start"?s.args:void 0,c=o==="update"?ts(s.partialResult):o==="result"?ts(s.result):void 0,p=Date.now();let g=e.toolStreamById.get(i);g?(g.name=a,l!==void 0&&(g.args=l),c!==void 0&&(g.output=c||void 0),g.updatedAt=p):(g={toolCallId:i,runId:t.runId,sessionKey:n,name:a,args:l,output:c||void 0,startedAt:typeof t.ts=="number"?t.ts:p,updatedAt:p,message:{}},e.toolStreamById.set(i,g),e.toolStreamOrder.push(i)),g.message=Dp(g),Fp(e),Op(e,o==="result"),Kp(e,t,s,a,o)}function zp(e){return e==="Bash"||e==="bash"||e==="execute_command"}function jp(e,t){return t==="update"?ts(e.partialResult):t==="result"?ts(e.result):null}function Gs(e){return e.length<=Ro?e:e.slice(-Ro)}function Kp(e,t,n,s,i){if(!zp(s))return;const a=typeof t.ts=="number"?t.ts:Date.now(),o=typeof n.toolCallId=="string"?n.toolCallId:void 0;if(i==="start"){const l=n.args,c=typeof l?.command=="string"?l.command:"",g=(typeof l?.description=="string"?l.description:"")||c;e.execLogActive=!0,e.execLogEntries=Gs([...e.execLogEntries,{ts:a,stream:"system",text:`▶ ${g}`,toolCallId:o}]),!e.execLogManuallyDismissed&&e.sidebarMode!=="exec-log"&&(e.sidebarMode="exec-log",e.sidebarOpen=!0);return}if(i==="update"||i==="result"){const l=jp(n,i);l&&(e.execLogEntries=Gs([...e.execLogEntries,{ts:a,stream:"stdout",text:l,toolCallId:o}]))}if(i==="result"){e.execLogActive=!1;const l=n.exitCode??n.exit_code,c=typeof l=="number"&&l!==0?"✗ Failed":"✓ Done";e.execLogEntries=Gs([...e.execLogEntries,{ts:a,stream:l!==0?"stderr":"system",text:`${c} (exit ${l??"?"})`,toolCallId:o}])}}const Vp=/^\[([^\]]+)\]\s*/,Wp=["WebChat","WhatsApp","Telegram","Signal","Slack","Discord","iMessage","Teams","Matrix","Zalo","Zalo Personal","BlueBubbles"],Qs=new WeakMap,Ys=new WeakMap;function qp(e){return/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(e)||/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(e)?!0:Wp.some(t=>e.startsWith(`${t} `))}function Js(e){const t=e.match(Vp);if(!t)return e;const n=t[1]??"";return qp(n)?e.slice(t[0].length):e}function _i(e){const t=e,n=typeof t.role=="string"?t.role:"",s=t.content;if(typeof s=="string")return n==="assistant"?zs(s):Js(s);if(Array.isArray(s)){const i=s.map(a=>{const o=a;return o.type==="text"&&typeof o.text=="string"?o.text:null}).filter(a=>typeof a=="string");if(i.length>0){const a=i.join(`
`);return n==="assistant"?zs(a):Js(a)}}return typeof t.text=="string"?n==="assistant"?zs(t.text):Js(t.text):null}function Kl(e){if(!e||typeof e!="object")return _i(e);const t=e;if(Qs.has(t))return Qs.get(t)??null;const n=_i(e);return Qs.set(t,n),n}function Po(e){const n=e.content,s=[];if(Array.isArray(n))for(const l of n){const c=l;if(c.type==="thinking"&&typeof c.thinking=="string"){const p=c.thinking.trim();p&&s.push(p)}}if(s.length>0)return s.join(`
`);const i=Qp(e);if(!i)return null;const o=[...i.matchAll(/<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi)].map(l=>(l[1]??"").trim()).filter(Boolean);return o.length>0?o.join(`
`):null}function Gp(e){if(!e||typeof e!="object")return Po(e);const t=e;if(Ys.has(t))return Ys.get(t)??null;const n=Po(e);return Ys.set(t,n),n}function Qp(e){const t=e,n=t.content;if(typeof n=="string")return n;if(Array.isArray(n)){const s=n.map(i=>{const a=i;return a.type==="text"&&typeof a.text=="string"?a.text:null}).filter(i=>typeof i=="string");if(s.length>0)return s.join(`
`)}return typeof t.text=="string"?t.text:null}function Yp(e){const t=e.trim();if(!t)return"";const n=t.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>`_${s}_`);return n.length?["_Reasoning:_",...n].join(`
`):""}let Do=!1;function Fo(e){e[6]=e[6]&15|64,e[8]=e[8]&63|128;let t="";for(let n=0;n<e.length;n++)t+=e[n].toString(16).padStart(2,"0");return`${t.slice(0,8)}-${t.slice(8,12)}-${t.slice(12,16)}-${t.slice(16,20)}-${t.slice(20)}`}function Jp(){const e=new Uint8Array(16),t=Date.now();for(let n=0;n<e.length;n++)e[n]=Math.floor(Math.random()*256);return e[0]^=t&255,e[1]^=t>>>8&255,e[2]^=t>>>16&255,e[3]^=t>>>24&255,e}function Zp(){Do||(Do=!0,console.warn("[uuid] crypto API missing; falling back to weak randomness"))}function $s(e=globalThis.crypto){if(e&&typeof e.randomUUID=="function")return e.randomUUID();if(e&&typeof e.getRandomValues=="function"){const t=new Uint8Array(16);return e.getRandomValues(t),Fo(t)}return Zp(),Fo(Jp())}async function at(e){if(!(!e.client||!e.connected)){e.chatLoading=!0,e.lastError=null;try{const t=await e.client.request("chat.history",{sessionKey:e.sessionKey,limit:200});e.chatMessages=Array.isArray(t.messages)?t.messages:[],e.chatThinkingLevel=t.thinkingLevel??null}catch(t){e.lastError=String(t)}finally{e.chatLoading=!1}}}function Xp(e){const t=/^data:([^;]+);base64,(.+)$/.exec(e);return t?{mimeType:t[1],content:t[2]}:null}async function Vl(e,t,n,s){if(!e.client||!e.connected)return null;const i=t.trim(),a=n&&n.length>0;if(!i&&!a)return null;const o=Date.now(),l=[];if(i&&l.push({type:"text",text:i}),a)for(const g of n)l.push({type:"image",source:{type:"base64",media_type:g.mimeType,data:g.dataUrl}});s?.silent||(e.chatMessages=[...e.chatMessages,{role:"user",content:l,timestamp:o}]),e.chatSending=!0,e.lastError=null;const c=$s();e.chatRunId=c,e.chatStream="",e.chatStreamStartedAt=o;const p=a?n.map(g=>{const u=Xp(g.dataUrl);return u?{type:"image",mimeType:u.mimeType,content:u.content}:null}).filter(g=>g!==null):void 0;try{return await e.client.request("chat.send",{sessionKey:e.sessionKey,message:i,deliver:!1,idempotencyKey:c,attachments:p}),c}catch(g){const u=String(g);return e.chatRunId=null,e.chatStream=null,e.chatStreamStartedAt=null,e.lastError=u,e.chatMessages=[...e.chatMessages,{role:"assistant",content:[{type:"text",text:"Error: "+u}],timestamp:Date.now()}],null}finally{e.chatSending=!1}}async function Wl(e){if(!e.client||!e.connected)return!1;const t=e.chatRunId;try{return await e.client.request("chat.abort",t?{sessionKey:e.sessionKey,runId:t}:{sessionKey:e.sessionKey}),!0}catch(n){return e.lastError=String(n),!1}}function ql(e,t){if(!t||t.sessionKey!==e.sessionKey)return null;if(t.runId&&e.chatRunId&&t.runId!==e.chatRunId)return t.state==="final"?"final":null;if(t.state==="delta"){const n=_i(t.message);if(typeof n=="string"){const s=e.chatStream??"";(!s||n.length>=s.length)&&(e.chatStream=n)}}else t.state==="final"||t.state==="aborted"?(e.chatStream=null,e.chatRunId=null,e.chatStreamStartedAt=null):t.state==="error"&&(e.chatStream=null,e.chatRunId=null,e.chatStreamStartedAt=null,e.lastError=t.errorMessage??"chat error");return t.state}const eg=Object.freeze(Object.defineProperty({__proto__:null,abortChatRun:Wl,handleChatEvent:ql,loadChatHistory:at,sendChatMessage:Vl},Symbol.toStringTag,{value:"Module"})),ks=120;function $a(e){return e.chatSending||!!e.chatRunId}function Gl(e){const t=e.trim();if(!t)return!1;const n=t.toLowerCase();return n==="/stop"?!0:n==="stop"||n==="esc"||n==="abort"||n==="wait"||n==="exit"}function tg(e){const t=e.trim();if(!t)return!1;const n=t.toLowerCase();return n==="/new"||n==="/reset"?!0:n.startsWith("/new ")||n.startsWith("/reset ")}async function ka(e){e.connected&&(e.chatMessage="",await Wl(e))}function ng(e,t,n,s){const i=t.trim(),a=!!(n&&n.length>0);!i&&!a||(e.chatQueue=[...e.chatQueue,{id:$s(),text:i,createdAt:Date.now(),attachments:a?n?.map(o=>({...o})):void 0,refreshSessions:s}])}async function Ql(e,t,n){ws(e);const s=await Vl(e,t,n?.attachments,{silent:n?.silent}),i=!!s;return!i&&n?.previousDraft!=null&&(e.chatMessage=n.previousDraft),!i&&n?.previousAttachments&&(e.chatAttachments=n.previousAttachments),i&&Ul(e,e.sessionKey),i&&n?.restoreDraft&&n.previousDraft?.trim()&&(e.chatMessage=n.previousDraft),i&&n?.restoreAttachments&&n.previousAttachments?.length&&(e.chatAttachments=n.previousAttachments),bn(e),i&&!e.chatRunId&&Yl(e),i&&n?.refreshSessions&&s&&e.refreshSessionsAfterChat.add(s),i}async function Yl(e){if(!e.connected||$a(e))return;const[t,...n]=e.chatQueue;if(!t)return;e.chatQueue=n,await Ql(e,t.text,{attachments:t.attachments,refreshSessions:t.refreshSessions})||(e.chatQueue=[t,...e.chatQueue])}function Jl(e,t){e.chatQueue=e.chatQueue.filter(n=>n.id!==t)}async function Zl(e,t,n){if(!e.connected)return;const s=e.chatMessage,i=(t??e.chatMessage).trim(),a=e.chatAttachments??[],o=t==null?a:[],l=o.length>0;if(!i&&!l)return;if(Gl(i)){await ka(e);return}const c=tg(i);if(t==null&&(e.chatMessage="",e.chatAttachments=[]),$a(e)){ng(e,i,o,c);return}await Ql(e,i,{previousDraft:t==null?s:void 0,restoreDraft:!!(t&&n?.restoreDraft),attachments:l?o:void 0,previousAttachments:t==null?a:void 0,restoreAttachments:!!(t&&n?.restoreDraft),refreshSessions:c,silent:c})}async function Xl(e,t){await Promise.all([at(e),lt(e,{activeMinutes:ks}),Et(e)]),bn(e)}const ec=Yl;function sg(e){const t=ea(e.sessionKey);return t?.agentId?t.agentId:e.hello?.snapshot?.sessionDefaults?.defaultAgentId?.trim()||"main"}function ig(e,t){const n=wn(e),s=encodeURIComponent(t);return n?`${n}/avatar/${s}?meta=1`:`/avatar/${s}?meta=1`}async function Et(e){if(!e.connected){e.chatAvatarUrl=null;return}const t=sg(e);if(!t){e.chatAvatarUrl=null;return}e.chatAvatarUrl=null;const n=ig(e.basePath,t);try{const s=await fetch(n,{method:"GET"});if(!s.ok){e.chatAvatarUrl=null;return}const i=await s.json(),a=typeof i.avatarUrl=="string"?i.avatarUrl.trim():"";e.chatAvatarUrl=a||null}catch{e.chatAvatarUrl=null}}const ag=Object.freeze(Object.defineProperty({__proto__:null,CHAT_SESSIONS_ACTIVE_MINUTES:ks,flushChatQueueForEvent:ec,handleAbortChat:ka,handleSendChat:Zl,isChatBusy:$a,isChatStopCommand:Gl,refreshChat:Xl,refreshChatAvatar:Et,removeQueuedMessage:Jl},Symbol.toStringTag,{value:"Module"})),og={trace:!0,debug:!0,info:!0,warn:!0,error:!0,fatal:!0},rg={name:"",description:"",agentId:"",enabled:!0,scheduleKind:"every",scheduleAt:"",everyAmount:"30",everyUnit:"minutes",cronExpr:"0 7 * * *",cronTz:"",sessionTarget:"isolated",wakeMode:"now",payloadKind:"agentTurn",payloadText:"",deliveryMode:"announce",deliveryChannel:"last",deliveryTo:"",timeoutSeconds:""},lg=50,cg=200,dg="Assistant";function No(e,t){if(typeof e!="string")return;const n=e.trim();if(n)return n.length<=t?n:n.slice(0,t)}function Ei(e){const t=No(e?.name,lg)??dg,n=No(e?.avatar??void 0,cg)??null;return{agentId:typeof e?.agentId=="string"&&e.agentId.trim()?e.agentId.trim():null,name:t,avatar:n}}function ug(){return Ei(typeof window>"u"?{}:{name:window.__WINCLAW_ASSISTANT_NAME__,avatar:window.__WINCLAW_ASSISTANT_AVATAR__})}async function tc(e,t){if(!e.client||!e.connected)return;const n=e.sessionKey.trim(),s=n?{sessionKey:n}:{};try{const i=await e.client.request("agent.identity.get",s);if(!i)return;const a=Ei(i);e.assistantName=a.name,e.assistantAvatar=a.avatar,e.assistantAgentId=a.agentId??null}catch{}}function Li(e){return typeof e=="object"&&e!==null}function pg(e){if(!Li(e))return null;const t=typeof e.id=="string"?e.id.trim():"",n=e.request;if(!t||!Li(n))return null;const s=typeof n.command=="string"?n.command.trim():"";if(!s)return null;const i=typeof e.createdAtMs=="number"?e.createdAtMs:0,a=typeof e.expiresAtMs=="number"?e.expiresAtMs:0;return!i||!a?null:{id:t,request:{command:s,cwd:typeof n.cwd=="string"?n.cwd:null,host:typeof n.host=="string"?n.host:null,security:typeof n.security=="string"?n.security:null,ask:typeof n.ask=="string"?n.ask:null,agentId:typeof n.agentId=="string"?n.agentId:null,resolvedPath:typeof n.resolvedPath=="string"?n.resolvedPath:null,sessionKey:typeof n.sessionKey=="string"?n.sessionKey:null},createdAtMs:i,expiresAtMs:a}}function gg(e){if(!Li(e))return null;const t=typeof e.id=="string"?e.id.trim():"";return t?{id:t,decision:typeof e.decision=="string"?e.decision:null,resolvedBy:typeof e.resolvedBy=="string"?e.resolvedBy:null,ts:typeof e.ts=="number"?e.ts:null}:null}function nc(e){const t=Date.now();return e.filter(n=>n.expiresAtMs>t)}function hg(e,t){const n=nc(e).filter(s=>s.id!==t.id);return n.push(t),n}function Oo(e,t){return nc(e).filter(n=>n.id!==t)}async function fg(e){if(!(!e.client||!e.connected)&&!e.modelCatalogLoading){e.modelCatalogLoading=!0;try{const t=await e.client.request("models.list",{});t?.models&&(e.modelCatalog=t.models)}catch(t){console.error("[models] loadModelCatalog error:",t)}finally{e.modelCatalogLoading=!1}}}function mg(e){const t=e.scopes.join(","),n=e.token??"";return["v2",e.deviceId,e.clientId,e.clientMode,e.role,t,String(e.signedAtMs),n,e.nonce].join("|")}const sc={WEBCHAT_UI:"webchat-ui",CONTROL_UI:"winclaw-control-ui",WEBCHAT:"webchat",CLI:"cli",GATEWAY_CLIENT:"gateway-client",MACOS_APP:"winclaw-macos",IOS_APP:"winclaw-ios",ANDROID_APP:"winclaw-android",NODE_HOST:"node-host",TEST:"test",FINGERPRINT:"fingerprint",PROBE:"winclaw-probe"},Bo=sc,Ii={WEBCHAT:"webchat",CLI:"cli",UI:"ui",BACKEND:"backend",NODE:"node",PROBE:"probe",TEST:"test"},vg={TOOL_EVENTS:"tool-events"};new Set(Object.values(sc));new Set(Object.values(Ii));const bg=4008;class yg{constructor(t){this.opts=t,this.ws=null,this.pending=new Map,this.closed=!1,this.lastSeq=null,this.connectNonce=null,this.connectSent=!1,this.connectTimer=null,this.backoffMs=800}start(){this.closed=!1,this.connect()}stop(){this.closed=!0,this.ws?.close(),this.ws=null,this.flushPending(new Error("gateway client stopped"))}get connected(){return this.ws?.readyState===WebSocket.OPEN}connect(){this.closed||(this.ws=new WebSocket(this.opts.url),this.ws.addEventListener("open",()=>this.queueConnect()),this.ws.addEventListener("message",t=>this.handleMessage(String(t.data??""))),this.ws.addEventListener("close",t=>{const n=String(t.reason??"");this.ws=null,this.flushPending(new Error(`gateway closed (${t.code}): ${n}`)),this.opts.onClose?.({code:t.code,reason:n}),this.scheduleReconnect()}),this.ws.addEventListener("error",()=>{}))}scheduleReconnect(){if(this.closed)return;const t=this.backoffMs;this.backoffMs=Math.min(this.backoffMs*1.7,15e3),window.setTimeout(()=>this.connect(),t)}flushPending(t){for(const[,n]of this.pending)n.reject(t);this.pending.clear()}async sendConnect(){if(this.connectSent)return;this.connectSent=!0,this.connectTimer!==null&&(window.clearTimeout(this.connectTimer),this.connectTimer=null);const t=typeof crypto<"u"&&!!crypto.subtle,n=["operator.admin","operator.approvals","operator.pairing"],s="operator";let i=null,a=!1,o=this.opts.token;if(t){i=await ha();const g=Au({deviceId:i.deviceId,role:s})?.token;o=g??this.opts.token,a=!!(g&&this.opts.token)}const l=o||this.opts.password?{token:o,password:this.opts.password}:void 0;let c;if(t&&i){const g=Date.now(),u=this.connectNonce??void 0,h=mg({deviceId:i.deviceId,clientId:this.opts.clientName??Bo.CONTROL_UI,clientMode:this.opts.mode??Ii.WEBCHAT,role:s,scopes:n,signedAtMs:g,token:o??null,nonce:u}),f=await Yu(i.privateKey,h);c={id:i.deviceId,publicKey:i.publicKey,signature:f,signedAt:g,nonce:u}}const p={minProtocol:3,maxProtocol:3,client:{id:this.opts.clientName??Bo.CONTROL_UI,version:this.opts.clientVersion??"dev",platform:this.opts.platform??navigator.platform??"web",mode:this.opts.mode??Ii.WEBCHAT,instanceId:this.opts.instanceId},role:s,scopes:n,device:c,caps:[vg.TOOL_EVENTS],auth:l,userAgent:navigator.userAgent,locale:navigator.language};this.request("connect",p).then(g=>{g?.auth?.deviceToken&&i&&xl({deviceId:i.deviceId,role:g.auth.role??s,token:g.auth.deviceToken,scopes:g.auth.scopes??[]}),this.backoffMs=800,this.opts.onHello?.(g)}).catch(()=>{a&&i&&wl({deviceId:i.deviceId,role:s}),this.ws?.close(bg,"connect failed")})}handleMessage(t){let n;try{n=JSON.parse(t)}catch{return}const s=n;if(s.type==="event"){const i=n;if(i.event==="connect.challenge"){const o=i.payload,l=o&&typeof o.nonce=="string"?o.nonce:null;l&&(this.connectNonce=l,this.sendConnect());return}const a=typeof i.seq=="number"?i.seq:null;a!==null&&(this.lastSeq!==null&&a>this.lastSeq+1&&this.opts.onGap?.({expected:this.lastSeq+1,received:a}),this.lastSeq=a);try{this.opts.onEvent?.(i)}catch(o){console.error("[gateway] event handler error:",o)}return}if(s.type==="res"){const i=n,a=this.pending.get(i.id);if(!a)return;this.pending.delete(i.id),i.ok?a.resolve(i.payload):a.reject(new Error(i.error?.message??"request failed"));return}}request(t,n){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return Promise.reject(new Error("gateway not connected"));const s=$s(),i={type:"req",id:s,method:t,params:n},a=new Promise((o,l)=>{this.pending.set(s,{resolve:c=>o(c),reject:l})});return this.ws.send(JSON.stringify(i)),a}queueConnect(){this.connectNonce=null,this.connectSent=!1,this.connectTimer!==null&&window.clearTimeout(this.connectTimer),this.connectTimer=window.setTimeout(()=>{this.sendConnect()},750)}}function Zs(e,t){const n=(e??"").trim(),s=t.mainSessionKey?.trim();if(!s)return n;if(!n)return s;const i=t.mainKey?.trim()||"main",a=t.defaultAgentId?.trim();return n==="main"||n===i||a&&(n===`agent:${a}:main`||n===`agent:${a}:${i}`)?s:n}function xg(e,t){if(!t?.mainSessionKey)return;const n=Zs(e.sessionKey,t),s=Zs(e.settings.sessionKey,t),i=Zs(e.settings.lastActiveSessionKey,t),a=n||s||e.sessionKey,o={...e.settings,sessionKey:s||a,lastActiveSessionKey:i||a},l=o.sessionKey!==e.settings.sessionKey||o.lastActiveSessionKey!==e.settings.lastActiveSessionKey;a!==e.sessionKey&&(e.sessionKey=a),l&&Ye(e,o)}function ic(e){e.lastError=null,e.hello=null,e.connected=!1,e.execApprovalQueue=[],e.execApprovalError=null,e.client?.stop(),e.client=new yg({url:e.settings.gatewayUrl,token:e.settings.token.trim()?e.settings.token:void 0,password:e.password.trim()?e.password:void 0,clientName:"winclaw-control-ui",mode:"webchat",onHello:t=>{e.connected=!0,e.lastError=null,e.hello=t,Sg(e,t),e.chatRunId=null,e.chatStream=null,e.chatStreamStartedAt=null,ws(e),tc(e),oa(e),lt(e,{activeMinutes:ks}),fg(e),ms(e,{quiet:!0}),rt(e,{quiet:!0}),$e(e,!1),wa(e),kg(e)},onClose:({code:t,reason:n})=>{e.connected=!1,t!==1012&&(e.lastError=`disconnected (${t}): ${n||"no reason"}`)},onEvent:t=>wg(e,t),onGap:({expected:t,received:n})=>{e.lastError=`event gap detected (expected seq ${t}, got ${n}); refresh recommended`}}),e.client.start()}function wg(e,t){try{$g(e,t)}catch(n){console.error("[gateway] handleGatewayEvent error:",t.event,n)}}function $g(e,t){if(e.eventLogBuffer=[{ts:Date.now(),event:t.event,payload:t.payload},...e.eventLogBuffer].slice(0,250),e.tab==="debug"&&(e.eventLog=e.eventLogBuffer),t.event==="agent"){if(e.onboarding)return;Hp(e,t.payload);return}if(t.event==="chat"){const n=t.payload;n?.sessionKey&&Ul(e,n.sessionKey);const s=ql(e,n);if(s==="final"||s==="error"||s==="aborted"){ws(e),ec(e);const i=n?.runId;i&&e.refreshSessionsAfterChat.delete(i)}s==="final"&&(lt(e,{activeMinutes:ks}),at(e));return}if(t.event==="presence"){const n=t.payload;n?.presence&&Array.isArray(n.presence)&&(e.presenceEntries=n.presence,e.presenceError=null,e.presenceStatus=null);return}if(t.event==="cron"&&e.tab==="cron"&&es(e),(t.event==="device.pair.requested"||t.event==="device.pair.resolved")&&rt(e,{quiet:!0}),t.event==="exec.approval.requested"){const n=pg(t.payload);if(n){e.execApprovalQueue=hg(e.execApprovalQueue,n),e.execApprovalError=null;const s=Math.max(0,n.expiresAtMs-Date.now()+500);window.setTimeout(()=>{e.execApprovalQueue=Oo(e.execApprovalQueue,n.id)},s)}return}if(t.event==="exec.approval.resolved"){const n=gg(t.payload);n&&(e.execApprovalQueue=Oo(e.execApprovalQueue,n.id))}}function kg(e){const t=e.settings?.token??"";fetch("/api/dh/health",{headers:t?{Authorization:`Bearer ${t}`}:{}}).then(n=>{e.dhAvailable=n.ok}).catch(()=>{e.dhAvailable=!1})}function Sg(e,t){const n=t.snapshot;n?.presence&&Array.isArray(n.presence)&&(e.presenceEntries=n.presence),n?.health&&(e.debugHealth=n.health),n?.sessionDefaults&&xg(e,n.sessionDefaults)}function Ag(e){e.basePath=Ap(),$p(e),Ep(e,!0),Cp(e),Tp(e),window.addEventListener("popstate",e.popStateHandler),e.keydownHandler=t=>{(t.ctrlKey||t.metaKey)&&t.key==="k"&&(t.preventDefault(),e.toggleCommandPalette()),t.key==="Escape"&&e.commandPaletteOpen&&(t.preventDefault(),e.toggleCommandPalette())},window.addEventListener("keydown",e.keydownHandler),ic(e),gu(e),e.tab==="logs"&&na(e),e.tab==="debug"&&ia(e)}function Cg(e){ou(e)}function Tg(e){window.removeEventListener("popstate",e.popStateHandler),e.keydownHandler&&(window.removeEventListener("keydown",e.keydownHandler),e.keydownHandler=void 0),hu(e),sa(e),aa(e),_p(e),e.topbarObserver?.disconnect(),e.topbarObserver=null}function _g(e,t){if(!(e.tab==="chat"&&e.chatManualRefreshInFlight)){if(e.tab==="chat"&&(t.has("chatMessages")||t.has("chatToolMessages")||t.has("chatStream")||t.has("chatLoading")||t.has("tab"))){const n=t.has("tab"),s=t.has("chatLoading")&&t.get("chatLoading")===!0&&!e.chatLoading;bn(e,n||s||!e.chatHasAutoScrolled)}e.tab==="logs"&&(t.has("logsEntries")||t.has("logsAutoFollow")||t.has("tab"))&&e.logsAutoFollow&&e.logsAtBottom&&gl(e,t.has("tab")||t.has("logsAutoFollow"))}}const Sa={CHILD:2},Aa=e=>(...t)=>({_$litDirective$:e,values:t});let Ca=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,n,s){this._$Ct=t,this._$AM=n,this._$Ci=s}_$AS(t,n){return this.update(t,n)}update(t,n){return this.render(...n)}};const{I:Eg}=Td,Uo=e=>e,Lg=e=>e.strings===void 0,Ho=()=>document.createComment(""),Yt=(e,t,n)=>{const s=e._$AA.parentNode,i=t===void 0?e._$AB:t._$AA;if(n===void 0){const a=s.insertBefore(Ho(),i),o=s.insertBefore(Ho(),i);n=new Eg(a,o,e,e.options)}else{const a=n._$AB.nextSibling,o=n._$AM,l=o!==e;if(l){let c;n._$AQ?.(e),n._$AM=e,n._$AP!==void 0&&(c=e._$AU)!==o._$AU&&n._$AP(c)}if(a!==i||l){let c=n._$AA;for(;c!==a;){const p=Uo(c).nextSibling;Uo(s).insertBefore(c,i),c=p}}}return n},gt=(e,t,n=e)=>(e._$AI(t,n),e),Ig={},Mg=(e,t=Ig)=>e._$AH=t,Rg=e=>e._$AH,Xs=e=>{e._$AR(),e._$AA.remove()};const zo=(e,t,n)=>{const s=new Map;for(let i=t;i<=n;i++)s.set(e[i],i);return s},kt=Aa(class extends Ca{constructor(e){if(super(e),e.type!==Sa.CHILD)throw Error("repeat() can only be used in text expressions")}dt(e,t,n){let s;n===void 0?n=t:t!==void 0&&(s=t);const i=[],a=[];let o=0;for(const l of e)i[o]=s?s(l,o):o,a[o]=n(l,o),o++;return{values:a,keys:i}}render(e,t,n){return this.dt(e,t,n).values}update(e,[t,n,s]){const i=Rg(e),{values:a,keys:o}=this.dt(t,n,s);if(!Array.isArray(i))return this.ut=o,a;const l=this.ut??=[],c=[];let p,g,u=0,h=i.length-1,f=0,d=a.length-1;for(;u<=h&&f<=d;)if(i[u]===null)u++;else if(i[h]===null)h--;else if(l[u]===o[f])c[f]=gt(i[u],a[f]),u++,f++;else if(l[h]===o[d])c[d]=gt(i[h],a[d]),h--,d--;else if(l[u]===o[d])c[d]=gt(i[u],a[d]),Yt(e,c[d+1],i[u]),u++,d--;else if(l[h]===o[f])c[f]=gt(i[h],a[f]),Yt(e,i[u],i[h]),h--,f++;else if(p===void 0&&(p=zo(o,f,d),g=zo(l,u,h)),p.has(l[u]))if(p.has(l[h])){const m=g.get(o[f]),k=m!==void 0?i[m]:null;if(k===null){const S=Yt(e,i[u]);gt(S,a[f]),c[f]=S}else c[f]=gt(k,a[f]),Yt(e,i[u],k),i[m]=null;f++}else Xs(i[h]),h--;else Xs(i[u]),u++;for(;f<=d;){const m=Yt(e,c[d+1]);gt(m,a[f]),c[f++]=m}for(;u<=h;){const m=i[u++];m!==null&&Xs(m)}return this.ut=o,Mg(e,c),it}});function Pg(e,t){const n=t?.sessions?.find(a=>a.key===e);if(n?.derivedTitle?.trim())return n.derivedTitle.trim();if(n?.displayName?.trim()&&n.displayName!==e)return n.displayName.trim();if(n?.label?.trim()&&n.label!==e)return n.label.trim();const s=e.split(":"),i=s[s.length-1]??e;return/^[0-9a-f]{8}-/.test(i)?"New Chat":i.charAt(0).toUpperCase()+i.slice(1)}function Dg(e){return e.openSessions.length<=1?r`
      <div class="chat-session-tabs chat-session-tabs--single">
        <button
          class="chat-session-tabs__new"
          @click=${()=>e.onNew()}
          title="New Chat"
        >
          +
        </button>
      </div>
    `:r`
    <div class="chat-session-tabs">
      <div class="chat-session-tabs__list">
        ${kt(e.openSessions,t=>t,t=>{const n=t===e.activeSessionKey,s=Pg(t,e.sessionsResult);return r`
              <button
                class="chat-session-tabs__tab ${n?"chat-session-tabs__tab--active":""}"
                @click=${()=>e.onSelect(t)}
                title=${t}
              >
                <span class="chat-session-tabs__tab-label">${s}</span>
                <span
                  class="chat-session-tabs__tab-close"
                  @click=${i=>{i.stopPropagation(),e.onClose(t)}}
                  title="Close"
                >
                  &times;
                </span>
              </button>
            `})}
      </div>
      <button
        class="chat-session-tabs__new"
        @click=${()=>e.onNew()}
        title="New Chat"
      >
        +
      </button>
    </div>
  `}const pe={messageSquare:r`
    <svg viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  `,barChart:r`
    <svg viewBox="0 0 24 24">
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  `,link:r`
    <svg viewBox="0 0 24 24">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  `,radio:r`
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2" />
      <path
        d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"
      />
    </svg>
  `,fileText:r`
    <svg viewBox="0 0 24 24">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  `,zap:r`
    <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
  `,monitor:r`
    <svg viewBox="0 0 24 24">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  `,settings:r`
    <svg viewBox="0 0 24 24">
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  `,bug:r`
    <svg viewBox="0 0 24 24">
      <path d="m8 2 1.88 1.88" />
      <path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  `,scrollText:r`
    <svg viewBox="0 0 24 24">
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
      <path d="M19 17V5a2 2 0 0 0-2-2H4" />
      <path d="M15 8h-5" />
      <path d="M15 12h-5" />
    </svg>
  `,folder:r`
    <svg viewBox="0 0 24 24">
      <path
        d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
      />
    </svg>
  `,menu:r`
    <svg viewBox="0 0 24 24">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  `,x:r`
    <svg viewBox="0 0 24 24">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  `,check:r`
    <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
  `,arrowDown:r`
    <svg viewBox="0 0 24 24">
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  `,copy:r`
    <svg viewBox="0 0 24 24">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  `,search:r`
    <svg viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  `,brain:r`
    <svg viewBox="0 0 24 24">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  `,book:r`
    <svg viewBox="0 0 24 24">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  `,loader:r`
    <svg viewBox="0 0 24 24">
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>
  `,wrench:r`
    <svg viewBox="0 0 24 24">
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      />
    </svg>
  `,fileCode:r`
    <svg viewBox="0 0 24 24">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 17 2-2-2-2" />
    </svg>
  `,edit:r`
    <svg viewBox="0 0 24 24">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  `,penLine:r`
    <svg viewBox="0 0 24 24">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  `,paperclip:r`
    <svg viewBox="0 0 24 24">
      <path
        d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
      />
    </svg>
  `,globe:r`
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  `,image:r`
    <svg viewBox="0 0 24 24">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  `,smartphone:r`
    <svg viewBox="0 0 24 24">
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  `,plug:r`
    <svg viewBox="0 0 24 24">
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  `,circle:r`
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
  `,puzzle:r`
    <svg viewBox="0 0 24 24">
      <path
        d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.076.874.54 1.02 1.02a2.5 2.5 0 1 0 3.237-3.237c-.48-.146-.944-.505-1.02-1.02a.98.98 0 0 1 .303-.917l1.526-1.526A2.402 2.402 0 0 1 11.998 2c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.236 3.236c-.464.18-.894.527-.967 1.02Z"
      />
    </svg>
  `,bot:r`
    <svg viewBox="0 0 24 24">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  `};function ac(e){const t=e.sessionsResult?.sessions?.find(l=>l.key===e.sessionKey);if(t?.workspace)return t.workspace;const n=e.agentsList?.agents;if(!n||n.length===0)return;const a=(e.sessionKey??"").match(/^agent:([^:]+):/)?.[1]??e.agentsList?.defaultId;return(n.find(l=>l.id===a)??n[0])?.workspace}function Fg(e){const n=e.sessionsResult?.sessions?.find(i=>i.key===e.sessionKey);if(n?.model&&n?.modelProvider)return`${n.modelProvider}/${n.model}`;if(n?.model)return n.model;const s=e.sessionsResult?.defaults;return s?.model&&s?.modelProvider?`${s.modelProvider}/${s.model}`:s?.model?s.model:""}function Ng(e,t){return r`
    <div class="chat-controls">
      ${Dg({activeSessionKey:e.sessionKey,openSessions:e.openChatSessions,sessionsResult:e.sessionsResult,onSelect:n=>e.switchChatSession(n),onClose:n=>e.removeChatSession(n),onNew:()=>t?.onNewSession?.()})}
      ${Bg(e)}
      ${Ug(e)}
    </div>
  `}async function Og(e){const t=ac(e)??"";let n=null;const s=window.chrome;if(s?.webview?.hostObjects?.winclawBridge)try{const a=await s.webview.hostObjects.winclawBridge.ShowFolderDialog(t);if(n=typeof a=="string"&&a.trim()?a.trim():null,!n)return}catch(a){console.warn("[workspace] WebView2 bridge failed:",a)}if(!n&&e.client)try{const a=await e.client.request("system.showFolderDialog",{initialPath:t});if(a?.path)n=a.path;else if(a?.path===null)return}catch(a){console.warn("[workspace] Gateway folder dialog failed:",a)}if(n||(n=window.prompt("Enter workspace directory path:",t)),!n||n.trim()===t)return;const i=n.trim();try{await ba(e,e.sessionKey,{workspace:i})}catch(a){console.error("[workspace] change failed:",a)}}function Bg(e){const t=ac(e);return t?r`
    <div
      class="chat-controls__workspace"
      title="Workspace: ${t} (click to change)"
      @click=${()=>Og(e)}
    >
      <span class="chat-controls__workspace-icon">📁</span>
      <span class="chat-controls__workspace-path">${t}</span>
    </div>
  `:r``}function Ug(e){const t=e.modelCatalog;if(!t||t.length===0)return r``;const n=Fg(e);return r`
    <span class="chat-controls__separator">|</span>
    <label class="field chat-controls__model">
      <select
        .value=${n}
        ?disabled=${!e.connected}
        @change=${async s=>{const i=s.target.value;!i||i===n||await ba(e,e.sessionKey,{model:i})}}
        title="Switch model"
      >
        ${kt(t,s=>`${s.provider}/${s.id}`,s=>{const i=`${s.provider}/${s.id}`;return r`<option
              value=${i}
              ?selected=${i===n}
            >
              ${s.name||s.id} (${s.provider})
            </option>`})}
      </select>
    </label>
  `}const ln=(e,t)=>{const n=e._$AN;if(n===void 0)return!1;for(const s of n)s._$AO?.(t,!1),ln(s,t);return!0},ns=e=>{let t,n;do{if((t=e._$AM)===void 0)break;n=t._$AN,n.delete(e),e=t}while(n?.size===0)},oc=e=>{for(let t;t=e._$AM;e=t){let n=t._$AN;if(n===void 0)t._$AN=n=new Set;else if(n.has(e))break;n.add(e),jg(t)}};function Hg(e){this._$AN!==void 0?(ns(this),this._$AM=e,oc(this)):this._$AM=e}function zg(e,t=!1,n=0){const s=this._$AH,i=this._$AN;if(i!==void 0&&i.size!==0)if(t)if(Array.isArray(s))for(let a=n;a<s.length;a++)ln(s[a],!1),ns(s[a]);else s!=null&&(ln(s,!1),ns(s));else ln(this,e)}const jg=e=>{e.type==Sa.CHILD&&(e._$AP??=zg,e._$AQ??=Hg)};class Kg extends Ca{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,n,s){super._$AT(t,n,s),oc(this),this.isConnected=t._$AU}_$AO(t,n=!0){t!==this.isConnected&&(this.isConnected=t,t?this.reconnected?.():this.disconnected?.()),n&&(ln(this,t),ns(this))}setValue(t){if(Lg(this._$Ct))this._$Ct._$AI(t,this);else{const n=[...this._$Ct._$AH];n[this._$Ci]=t,this._$Ct._$AI(n,this,0)}}disconnected(){}reconnected(){}}const ei=new WeakMap,Ta=Aa(class extends Kg{render(e){return v}update(e,[t]){const n=t!==this.G;return n&&this.G!==void 0&&this.rt(void 0),(n||this.lt!==this.ct)&&(this.G=t,this.ht=e.options?.host,this.rt(this.ct=e.element)),v}rt(e){if(this.isConnected||(e=void 0),typeof this.G=="function"){const t=this.ht??globalThis;let n=ei.get(t);n===void 0&&(n=new WeakMap,ei.set(t,n)),n.get(this.G)!==void 0&&this.G.call(this.ht,void 0),n.set(this.G,e),e!==void 0&&this.G.call(this.ht,e)}else this.G.value=e}get lt(){return typeof this.G=="function"?ei.get(this.ht??globalThis)?.get(this.G):this.G?.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});function Vg(e,t){const n=t.toLowerCase();return e.label.toLowerCase().includes(n)||e.id.toLowerCase().includes(n)?!0:e.keywords.some(s=>s.toLowerCase().includes(n))}function Wg(e){if(!e.open)return v;let t="",n=0;const s=u=>{const h=qs();return u.trim()?h.filter(f=>Vg(f,u)):h},i=u=>{const f=u.target.closest(".command-palette")?.querySelector(".command-palette__list")?.querySelectorAll(".command-palette__item");if(f?.length)if(u.key==="ArrowDown")u.preventDefault(),n=Math.min(n+1,f.length-1),f.forEach((d,m)=>d.classList.toggle("highlighted",m===n)),f[n]?.scrollIntoView({block:"nearest"});else if(u.key==="ArrowUp")u.preventDefault(),n=Math.max(n-1,0),f.forEach((d,m)=>d.classList.toggle("highlighted",m===n)),f[n]?.scrollIntoView({block:"nearest"});else if(u.key==="Enter"){u.preventDefault();const d=f[n];d&&d.click()}else u.key==="Escape"&&(u.preventDefault(),e.onClose())},a=u=>{const h=u.target;t=h.value,n=0;const d=h.closest(".command-palette")?.querySelector(".command-palette__list");if(!d)return;const m=s(t),k=e.recentCommandIds,S=t.trim()?[]:k.map(T=>m.find(E=>E.id===T)).filter(Boolean),$=t.trim()?m:m.filter(T=>!k.includes(T.id));let C=0,A="";if(S.length>0){A+=`<div class="command-palette__category">${_("commands.recentCommands")}</div>`;for(const T of S)A+=Ko(T,C===n),C++}for(const T of Io()){const E=$.filter(M=>M.category===T);if(E.length!==0){A+=`<div class="command-palette__category">${T}</div>`;for(const M of E)A+=Ko(M,C===n),C++}}d.innerHTML=A,d.querySelectorAll(".command-palette__item").forEach(T=>{T.addEventListener("click",()=>{const E=T.dataset.cmdId,M=qs().find(V=>V.id===E);M&&e.onSelect(M)})})},o=qs(),l=e.recentCommandIds,c=l.map(u=>o.find(h=>h.id===u)).filter(Boolean),p=o.filter(u=>!l.includes(u.id));let g=0;return r`
    <div
      class="command-palette-overlay"
      @click=${u=>{u.target.classList.contains("command-palette-overlay")&&e.onClose()}}
      @keydown=${u=>{u.key==="Escape"&&e.onClose()}}
    >
      <div class="command-palette">
        <div class="command-palette__search">
          <span class="command-palette__search-icon">${pe.search??r`
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
            `}</span>
          <input
            type="text"
            class="command-palette__input"
            placeholder=${_("commands.searchPlaceholder")}
            @input=${a}
            @keydown=${i}
            ${Ta(u=>{u&&requestAnimationFrame(()=>u.focus())})}
          />
        </div>
        <div class="command-palette__list">
          ${c.length>0?r`
                <div class="command-palette__category">${_("commands.recentCommands")}</div>
                ${kt(c,u=>`recent-${u.id}`,u=>{const h=g++;return jo(u,h===0,e.onSelect)})}
              `:v}
          ${kt(Io(),u=>u,u=>{const h=p.filter(f=>f.category===u);return h.length===0?v:r`
                <div class="command-palette__category">${u}</div>
                ${kt(h,f=>f.id,f=>{const d=g++;return jo(f,d===0,e.onSelect)})}
              `})}
        </div>
      </div>
    </div>
  `}function jo(e,t,n){return r`
    <button
      class="command-palette__item ${t?"highlighted":""}"
      data-cmd-id=${e.id}
      @click=${()=>n(e)}
    >
      <span class="command-palette__item-icon">${pe[e.icon]}</span>
      <span class="command-palette__item-label">${e.label}</span>
      ${e.shortcut?r`<span class="command-palette__item-shortcut">${e.shortcut}</span>`:e.tab?r`<span class="command-palette__item-shortcut">${e.tab}</span>`:v}
    </button>
  `}function Ko(e,t){const n=e.shortcut?`<span class="command-palette__item-shortcut">${e.shortcut}</span>`:e.tab?`<span class="command-palette__item-shortcut">${e.tab}</span>`:"";return`<button class="command-palette__item ${t?"highlighted":""}" data-cmd-id="${e.id}">
    <span class="command-palette__item-icon"></span>
    <span class="command-palette__item-label">${e.label}</span>
    ${n}
  </button>`}function qg(e){return r`
    <div class="session-tabs">
      ${kt(e.openTabs,t=>t,t=>{const n=t===e.activeTab,s=t==="chat";return r`
            <button
              class="session-tabs__tab ${n?"session-tabs__tab--active":""}"
              @click=${()=>e.onTabSelect(t)}
              title=${Ci(t)}
            >
              <span class="session-tabs__tab-icon">${pe[fp(t)]}</span>
              <span class="session-tabs__tab-label">${s?e.chatSessionTitle||"New Chat":Ci(t)}</span>
              ${s?v:r`
                    <button
                      class="session-tabs__tab-close"
                      @click=${i=>{i.stopPropagation(),e.onTabClose(t)}}
                      title="Close tab"
                    >
                      &times;
                    </button>
                  `}
            </button>
          `})}
      <button
        class="session-tabs__add"
        @click=${()=>e.onAddTab()}
        title="Open command palette"
      >
        +
      </button>
    </div>
  `}function rc(e,t){if(!e)return e;const s=e.files.some(i=>i.name===t.name)?e.files.map(i=>i.name===t.name?t:i):[...e.files,t];return{...e,files:s}}async function ti(e,t){if(!(!e.client||!e.connected||e.agentFilesLoading)){e.agentFilesLoading=!0,e.agentFilesError=null;try{const n=await e.client.request("agents.files.list",{agentId:t});n&&(e.agentFilesList=n,e.agentFileActive&&!n.files.some(s=>s.name===e.agentFileActive)&&(e.agentFileActive=null))}catch(n){e.agentFilesError=String(n)}finally{e.agentFilesLoading=!1}}}async function Gg(e,t,n,s){if(!(!e.client||!e.connected||e.agentFilesLoading)&&!Object.hasOwn(e.agentFileContents,n)){e.agentFilesLoading=!0,e.agentFilesError=null;try{const i=await e.client.request("agents.files.get",{agentId:t,name:n});if(i?.file){const a=i.file.content??"",o=e.agentFileContents[n]??"",l=e.agentFileDrafts[n],c=s?.preserveDraft??!0;e.agentFilesList=rc(e.agentFilesList,i.file),e.agentFileContents={...e.agentFileContents,[n]:a},(!c||!Object.hasOwn(e.agentFileDrafts,n)||l===o)&&(e.agentFileDrafts={...e.agentFileDrafts,[n]:a})}}catch(i){e.agentFilesError=String(i)}finally{e.agentFilesLoading=!1}}}async function Qg(e,t,n,s){if(!(!e.client||!e.connected||e.agentFileSaving)){e.agentFileSaving=!0,e.agentFilesError=null;try{const i=await e.client.request("agents.files.set",{agentId:t,name:n,content:s});i?.file&&(e.agentFilesList=rc(e.agentFilesList,i.file),e.agentFileContents={...e.agentFileContents,[n]:s},e.agentFileDrafts={...e.agentFileDrafts,[n]:s})}catch(i){e.agentFilesError=String(i)}finally{e.agentFileSaving=!1}}}async function lc(e,t){if(!(!e.client||!e.connected)&&!e.usageLoading){e.usageLoading=!0,e.usageError=null;try{const n=t?.startDate??e.usageStartDate,s=t?.endDate??e.usageEndDate,[i,a]=await Promise.all([e.client.request("sessions.usage",{startDate:n,endDate:s,limit:1e3,includeContextWeight:!0}),e.client.request("usage.cost",{startDate:n,endDate:s})]);i&&(e.usageResult=i),a&&(e.usageCostSummary=a)}catch(n){e.usageError=String(n)}finally{e.usageLoading=!1}}}async function Yg(e,t){if(!(!e.client||!e.connected)&&!e.usageTimeSeriesLoading){e.usageTimeSeriesLoading=!0,e.usageTimeSeries=null;try{const n=await e.client.request("sessions.usage.timeseries",{key:t});n&&(e.usageTimeSeries=n)}catch{e.usageTimeSeries=null}finally{e.usageTimeSeriesLoading=!1}}}async function Jg(e,t){if(!(!e.client||!e.connected)&&!e.usageSessionLogsLoading){e.usageSessionLogsLoading=!0,e.usageSessionLogs=null;try{const n=await e.client.request("sessions.usage.logs",{key:t,limit:500});n&&Array.isArray(n.logs)&&(e.usageSessionLogs=n.logs)}catch{e.usageSessionLogs=null}finally{e.usageSessionLogsLoading=!1}}}function Zg(e){if(e&&typeof e=="object")return e;if(typeof e=="string"&&e.trim())try{const t=JSON.parse(e);if(t&&typeof t=="object")return t}catch{}return{}}const ni=5,Xg=15e3;class eh{constructor(t){this.ws=null,this.url="",this.reconnectAttempts=0,this.isManualClose=!1,this.pingTimer=null,this.exitHandlerBound=!1,this.handlers=t,this.onMuseTalkAnswer=t.onMuseTalkAnswer}connect(t){this.ws&&this.ws.readyState===WebSocket.OPEN&&(console.warn("[DHWebSocket] Already connected, closing previous connection"),this.closeInternal()),this.url=t,this.isManualClose=!1,this.reconnectAttempts=0,this.bindExitHandler(),this.openConnection()}bindExitHandler(){this.exitHandlerBound||typeof window>"u"||(this.exitHandlerBound=!0,window.addEventListener("pagehide",()=>{if(this.ws&&this.ws.readyState===WebSocket.OPEN){this.isManualClose=!0;try{this.ws.send(JSON.stringify({type:"stop"}))}catch{}try{this.ws.close(1e3,"page hidden")}catch{}}}))}sendAudio(t){this.send({type:"audio",data:t})}sendText(t){this.send({type:"text",text:t})}sendVideo(t){this.send({type:"video",data:t})}sendMuseTalkOffer(t,n){this.send({type:"musetalk_offer",data:{sdp:t,webrtcId:n}})}sendAvatarPause(){this.send({type:"avatar_pause"})}sendAvatarResume(){this.send({type:"avatar_resume"})}sendVoiceChange(t){this.send({type:"voice_change",voice:t})}disconnect(){this.isManualClose=!0,this.closeInternal(),console.log("[DHWebSocket] Disconnected")}get isConnected(){return this.ws?.readyState===WebSocket.OPEN}openConnection(){try{this.ws=new WebSocket(this.url)}catch(t){console.error("[DHWebSocket] Failed to create WebSocket:",t),this.scheduleReconnect();return}this.ws.onopen=()=>{console.log("[DHWebSocket] Connected:",this.url),this.reconnectAttempts=0,this.startPing(),this.handlers.onConnected?.()},this.ws.onmessage=t=>{this.handleMessage(t.data)},this.ws.onerror=t=>{console.error("[DHWebSocket] WebSocket error:",t)},this.ws.onclose=t=>{console.log(`[DHWebSocket] Connection closed: code=${t.code}, reason=${t.reason}`),this.stopPing(),this.isManualClose?this.handlers.onClose?.():this.scheduleReconnect()}}closeInternal(){this.stopPing(),this.ws&&(this.ws.onopen=null,this.ws.onmessage=null,this.ws.onerror=null,this.ws.onclose=null,this.ws.close(),this.ws=null)}scheduleReconnect(){if(this.reconnectAttempts>=ni){console.error(`[DHWebSocket] Giving up after ${ni} reconnect attempts`),this.handlers.onClose?.();return}this.reconnectAttempts++;const t=1e3*Math.pow(2,this.reconnectAttempts-1);console.log(`[DHWebSocket] Reconnecting in ${t} ms (attempt ${this.reconnectAttempts}/${ni})`),setTimeout(()=>{this.isManualClose||this.openConnection()},t)}startPing(){this.stopPing(),this.pingTimer=setInterval(()=>{this.isConnected&&this.send({type:"ping"})},Xg)}stopPing(){this.pingTimer!==null&&(clearInterval(this.pingTimer),this.pingTimer=null)}send(t){if(!this.isConnected){console.warn("[DHWebSocket] Cannot send: not connected");return}try{this.ws.send(JSON.stringify(t))}catch(n){console.error("[DHWebSocket] Send failed:",n)}}handleMessage(t){let n;try{n=JSON.parse(t)}catch(s){console.error("[DHWebSocket] Failed to parse message:",s,t);return}try{this.dispatch(n)}catch(s){console.error("[DHWebSocket] Handler threw an error:",s)}}dispatch(t){const n=t.data??{};switch(t.type){case"dh_stream_info":case"stream_info":{const s=n;this.handlers.onDhStreamInfo?.(s);break}case"ai_text":{const s=n.content??n.text??t.content??"",i=!!(n.is_delta??n.isDelta??t.is_delta??!1);this.handlers.onAiText?.(s,i);break}case"ai_audio":{const s=n.audio??t.audio??"",i=n.sample_rate??n.sampleRate??t.sample_rate??24e3;s&&this.handlers.onAiAudio?.(s,i);break}case"ai_thinking":{const s=!!(n.thinking??t.thinking??!1);this.handlers.onAiThinking?.(s);break}case"response_started":case"ai_response_started":this.handlers.onAiResponseStarted?.();break;case"response_done":case"ai_response_done":this.handlers.onAiResponseDone?.();break;case"speech_started":case"ai_speech_interrupted":this.handlers.onAiSpeechInterrupted?.();break;case"user_transcript":{const s=n.content??n.transcript??t.content??"";this.handlers.onUserTranscript?.(s);break}case"musetalk_answer":{const s=n.sdp,i=n.error;this.onMuseTalkAnswer?.({sdp:s,error:i});break}case"error":{const s=t.code??n.code??"UNKNOWN",i=t.message??n.message??"Unknown error";console.error(`[DHWebSocket] Backend error: [${s}] ${i}`),this.handlers.onError?.(s,i);break}case"session.created":console.log("[DHWebSocket] Session created:",t.sessionId);break;case"pong":break;case"tool_call":{const s=n.name??"";if(s==="task_run")try{window.dispatchEvent(new CustomEvent("secretary-voice-task",{detail:{callId:n.callId??"",args:n.args??""}}))}catch{}else if(s==="ui_action")try{const i=Zg(n.args);window.dispatchEvent(new CustomEvent("dh-ui-action",{detail:{target:i.target??"",action:i.action??"",name:i.name??void 0}}))}catch{}break}default:console.debug("[DHWebSocket] Unhandled message type:",t.type,t);break}}}const th=1,nh=2,Vo=3,sh=0;class ih{constructor(t,n,s={}){this.engine=null,this.firstRemoteSet=!1,this.autoplayFailedUsers=new Set,this.initialized=!1,this.appId=t,this.renderDomId=n,this.callbacks=s}async ensureEngine(){if(this.engine)return this.engine;if(this.initialized)throw new Error("[ByteRTC] Engine initialization already in progress");this.initialized=!0;try{const n=await import(new URL("./vendor/byteplus-rtc.esm.js",window.location.href).href),s=n.default??n;return this.engine=s.createEngine(this.appId),console.log(`[ByteRTC] Engine created: appId=${this.appId}, SDK v${s.getSdkVersion()}`),this.bindEvents(s),this.engine}catch(t){throw this.initialized=!1,console.error("[ByteRTC] Failed to load @byteplus/rtc SDK:",t),this.callbacks.onError?.(t),t}}bindEvents(t){this.engine&&(this.engine.on(t.events.onUserPublishStream,async n=>{const{userId:s,mediaType:i}=n;if(console.log(`[ByteRTC] User published stream: userId=${s}, mediaType=${i}`),(i&Vo)!==0||(i&nh)!==0||(i&th)!==0)try{if(await this.engine.subscribeStream(s,Vo),console.log(`[ByteRTC] Subscribed to stream: userId=${s}`),!this.firstRemoteSet){const o=document.getElementById(this.renderDomId);o&&(o.innerHTML=""),await this.engine.setRemoteVideoPlayer(sh,{userId:s,renderDom:this.renderDomId}),this.firstRemoteSet=!0,this.callbacks.onStreamReady?.(),console.log(`[ByteRTC] Video player set: userId=${s}, dom=#${this.renderDomId}`)}}catch(o){console.error("[ByteRTC] Subscribe error:",o),this.callbacks.onError?.(o)}}),this.engine.on(t.events.onUserJoined,n=>{const s=n?.userInfo?.userId;s&&(console.log(`[ByteRTC] User joined: ${s}`),this.callbacks.onUserJoined?.(s))}),this.engine.on(t.events.onUserLeave,n=>{const s=n?.userInfo?.userId;s&&(console.log(`[ByteRTC] User left: ${s}`),this.callbacks.onUserLeave?.(s))}),this.engine.on(t.events.onAutoplayFailed,n=>{const{userId:s,kind:i}=n;console.warn(`[ByteRTC] Autoplay failed: userId=${s}, kind=${i}`),this.autoplayFailedUsers.add(s),this.callbacks.onAutoplayFailed?.(s,i)}),this.engine.on(t.events.onError,n=>{console.error("[ByteRTC] SDK error:",n),this.callbacks.onError?.(n)}))}async join(t,n,s){const i=await this.ensureEngine();console.log(`[ByteRTC] Joining room: roomId=${n}, userId=${s}`),await i.joinRoom(t,n,{userId:s},{isAutoPublish:!1,isAutoSubscribeAudio:!0,isAutoSubscribeVideo:!0})}play(t){if(this.engine)try{this.engine.play?.(t),this.autoplayFailedUsers.delete(t)}catch{}}playAll(){for(const t of this.autoplayFailedUsers)this.play(t)}async leave(){if(this.engine){try{await this.engine.leaveRoom(),console.log("[ByteRTC] Left room")}catch(t){console.warn("[ByteRTC] Error leaving room:",t)}this.firstRemoteSet=!1,this.autoplayFailedUsers.clear()}}destroy(){this.leave().catch(()=>{}),this.engine=null,this.initialized=!1,console.log("[ByteRTC] Viewer destroyed")}}class ss{constructor(t,n={}){this.pc=null,this.videoEl=null,this.mediaStream=null,this.localStream=null,this.cleaned=!1,this.streamReadyFired=!1,this.playWebRtcAudio=(()=>{try{return new URLSearchParams(location.search).get("webrtcAudio")==="1"}catch{return!1}})(),this.containerId=t,this.callbacks=n}async join(t){const{exchangeOffer:n}=t,s=t.sessionId||ss.uuid(),i=t.iceServers&&t.iceServers.length>0?t.iceServers:[{urls:"stun:stun.l.google.com:19302"}];console.log("[MuseTalkViewer] join (offer proxied via DH WS)","webrtc_id=",s,"iceServers=",i.length);const a=new RTCPeerConnection({iceServers:i});this.pc=a,this.mediaStream=new MediaStream;const o=a.createDataChannel("control",{ordered:!0});o.onopen=()=>console.log("[MuseTalkViewer] DataChannel open (unblocks VM audio_emit)"),o.onclose=()=>console.log("[MuseTalkViewer] DataChannel closed"),o.onerror=c=>console.warn("[MuseTalkViewer] DataChannel error:",c);const l=ss.createSilentAudioTrack();l?(this.localStream=new MediaStream([l]),a.addTransceiver(l,{direction:"sendrecv",streams:[this.localStream]}),console.log("[MuseTalkViewer] Attached silent wake-up audio track (sendrecv)")):(a.addTransceiver("audio",{direction:"sendrecv"}),console.warn("[MuseTalkViewer] No AudioContext — silent wake-up track unavailable; emit() may not start")),a.addTransceiver("video",{direction:"sendrecv"}),a.ontrack=c=>{console.log("[MuseTalkViewer] ontrack:",c.track.kind,"muted=",c.track.muted),this.mediaStream&&!this.mediaStream.getTracks().includes(c.track)&&this.mediaStream.addTrack(c.track),this.attachToVideoElement()},a.onconnectionstatechange=()=>{const c=a.connectionState;console.log("[MuseTalkViewer] connectionState:",c),c==="connected"?(this.callbacks.onUserJoined?.(s),this.streamReadyFired||(this.streamReadyFired=!0,this.callbacks.onStreamReady?.())):(c==="failed"||c==="disconnected"||c==="closed")&&(this.cleaned||this.callbacks.onUserLeave?.(s))},a.oniceconnectionstatechange=()=>{console.log("[MuseTalkViewer] iceConnectionState:",a.iceConnectionState)};try{const c=await a.createOffer();await a.setLocalDescription(c),await this.waitForIceGathering(a,2e3);const p=a.localDescription?.sdp||"",g=await n(p,s);if(!g||typeof g!="string")throw new Error("offer exchange returned empty answer SDP");await a.setRemoteDescription({type:"answer",sdp:g}),console.log("[MuseTalkViewer] Remote description set, waiting for media...")}catch(c){throw console.error("[MuseTalkViewer] join failed:",c),this.callbacks.onError?.(c),c}}waitForIceGathering(t,n){return new Promise(s=>{if(t.iceGatheringState==="complete"){s();return}const i=setTimeout(()=>s(),n),a=()=>{t.iceGatheringState==="complete"&&(clearTimeout(i),t.removeEventListener("icegatheringstatechange",a),s())};t.addEventListener("icegatheringstatechange",a)})}attachToVideoElement(){if(!this.mediaStream)return;const t=document.getElementById(this.containerId);if(!t){console.warn("[MuseTalkViewer] container not found:",this.containerId);return}let n=this.videoEl;n||(n=document.createElement("video"),n.autoplay=!0,n.playsInline=!0,n.muted=!0,n.controls=!1,n.style.backgroundColor="#000",n.style.width="100%",n.style.height="100%",n.style.objectFit="cover",n.setAttribute("data-source","musetalk-webrtc"),t.appendChild(n),this.videoEl=n,this.playWebRtcAudio&&this.armWebRtcAudioUnmute()),n.srcObject=this.mediaStream;const s=n.play();s&&typeof s.then=="function"&&s.then(()=>{console.log("[MuseTalkViewer] Video playing"),this.callbacks.onStreamReady?.()}).catch(i=>{console.warn("[MuseTalkViewer] Autoplay blocked:",i?.message??i),this.callbacks.onAutoplayFailed?.("avatar","video"),this.callbacks.onStreamReady?.()})}async play(t){if(this.videoEl)try{await this.videoEl.play()}catch(n){console.warn("[MuseTalkViewer] play() still failed:",n)}}armWebRtcAudioUnmute(){const t=()=>{const n=this.videoEl;n&&(n.muted=!1,n.play().catch(()=>{}),console.log("[MuseTalkViewer] WebRTC audio un-muted on user gesture")),document.removeEventListener("pointerdown",t),document.removeEventListener("keydown",t)};document.addEventListener("pointerdown",t,{once:!0}),document.addEventListener("keydown",t,{once:!0})}async leave(){if(this.cleaned=!0,this.pc){try{this.pc.close()}catch{}this.pc=null}if(this.localStream){for(const t of this.localStream.getTracks())try{t.stop()}catch{}this.localStream=null}this.videoEl?.parentNode&&(this.videoEl.pause(),this.videoEl.srcObject=null,this.videoEl.parentNode.removeChild(this.videoEl),this.videoEl=null),this.mediaStream=null}destroy(){this.leave().catch(()=>{})}static createSilentAudioTrack(){try{const t=window.AudioContext||window.webkitAudioContext;if(!t)return null;const n=new t;n.state==="suspended"&&typeof n.resume=="function"&&n.resume().catch(()=>{});const s=n.createOscillator(),i=n.createGain();i.gain.value=1e-4,s.frequency.value=440,s.connect(i);const a=n.createMediaStreamDestination();return i.connect(a),s.start(),a.stream.getAudioTracks()[0]||null}catch(t){return console.warn("[MuseTalkViewer] createSilentAudioTrack failed:",t),null}}static uuid(){const t=globalThis.crypto;return t&&typeof t.randomUUID=="function"?t.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,n=>{const s=Math.random()*16|0;return(n==="x"?s:s&3|8).toString(16)})}}class ah{constructor(t){this.audioContext=null,this.mediaStream=null,this.sourceNode=null,this.processorNode=null,this._isRecording=!1,this._isMuted=!1,this.targetSampleRate=16e3,this.bufferSize=4096,this.onAudioData=t}get isRecording(){return this._isRecording}get isMuted(){return this._isMuted}async start(){if(this._isRecording){console.warn("[AudioRecorder] Already recording");return}if(!navigator.mediaDevices?.getUserMedia)throw new Error("[AudioRecorder] Microphone requires a secure context (HTTPS or localhost).");try{this.mediaStream=await navigator.mediaDevices.getUserMedia({audio:{sampleRate:{ideal:this.targetSampleRate},channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}});const t=window.AudioContext??window.webkitAudioContext;this.audioContext=new t,this.sourceNode=this.audioContext.createMediaStreamSource(this.mediaStream),this.processorNode=this.audioContext.createScriptProcessor(this.bufferSize,1,1),this.processorNode.onaudioprocess=n=>{if(n.outputBuffer.getChannelData(0).fill(0),!this._isRecording)return;const s=n.inputBuffer.getChannelData(0),i=this.audioContext.sampleRate,a=this.downsample(s,i,this.targetSampleRate);if(a.length===0)return;const o=this.float32ToPCM16(a),l=this.arrayBufferToBase64(o.buffer);this.onAudioData(l)},this.sourceNode.connect(this.processorNode),this.processorNode.connect(this.audioContext.destination),this._isRecording=!0,console.log(`[AudioRecorder] Started: native=${this.audioContext.sampleRate} Hz → target=${this.targetSampleRate} Hz, buffer=${this.bufferSize}`)}catch(t){throw console.error("[AudioRecorder] Failed to start:",t),this.cleanup(),t}}stop(){this._isRecording&&(this._isRecording=!1,this.cleanup(),console.log("[AudioRecorder] Stopped"))}setMuted(t){if(this._isMuted=t,this.mediaStream)for(const n of this.mediaStream.getAudioTracks())n.enabled=!t}cleanup(){if(this.processorNode&&(this.processorNode.disconnect(),this.processorNode.onaudioprocess=null,this.processorNode=null),this.sourceNode&&(this.sourceNode.disconnect(),this.sourceNode=null),this.audioContext&&(this.audioContext.close().catch(()=>{}),this.audioContext=null),this.mediaStream){for(const t of this.mediaStream.getTracks())t.stop();this.mediaStream=null}}downsample(t,n,s){if(n===s)return t;const i=n/s,a=Math.round(t.length/i),o=new Float32Array(a);for(let l=0;l<a;l++){const c=Math.round(l*i),p=Math.round((l+1)*i);let g=0,u=0;for(let h=c;h<p&&h<t.length;h++)g+=t[h],u++;o[l]=u>0?g/u:0}return o}float32ToPCM16(t){const n=new Int16Array(t.length);for(let s=0;s<t.length;s++){const i=Math.max(-1,Math.min(1,t[s]));n[s]=i<0?i*32768:i*32767}return n}arrayBufferToBase64(t){const n=new Uint8Array(t);let s="";for(let i=0;i<n.length;i++)s+=String.fromCharCode(n[i]);return btoa(s)}}class oh{constructor(t=24e3,n=0){this.audioContext=null,this.nextStartTime=0,this._isPlaying=!1,this.freshStart=!0,this.activeSources=new Set,this.defaultSampleRate=t,this.playbackDelaySec=Number.isFinite(n)&&n>0?n:0}playChunk(t,n){try{const s=this.ensureContext(),i=n??this.defaultSampleRate,a=atob(t),o=new Uint8Array(a.length);for(let f=0;f<a.length;f++)o[f]=a.charCodeAt(f);const l=Math.floor(o.length/2);if(l===0)return;const c=new Float32Array(l),p=new DataView(o.buffer);for(let f=0;f<l;f++)c[f]=p.getInt16(f*2,!0)/32768;const g=s.createBuffer(1,l,i);g.copyToChannel(c,0);const u=s.createBufferSource();u.buffer=g,u.connect(s.destination);const h=s.currentTime;this.freshStart?(this.nextStartTime=h+this.playbackDelaySec,this.freshStart=!1):this.nextStartTime<h&&(this.nextStartTime=h),u.start(this.nextStartTime),this.nextStartTime+=g.duration,this._isPlaying=!0,this.activeSources.add(u),u.onended=()=>{this.activeSources.delete(u),s.currentTime>=this.nextStartTime-.01&&(this._isPlaying=!1)}}catch(s){console.error("[AudioPlayer] Error playing chunk:",s)}}stop(){this.cancelActiveSources(),this.audioContext&&(this.audioContext.close().catch(()=>{}),this.audioContext=null),this.nextStartTime=0,this._isPlaying=!1,this.freshStart=!0}flush(){this.cancelActiveSources(),this.nextStartTime=0,this._isPlaying=!1,this.freshStart=!0}cancelActiveSources(){for(const t of this.activeSources)try{t.onended=null,t.stop(),t.disconnect()}catch{}this.activeSources.clear()}resume(){this.nextStartTime=0,this._isPlaying=!1,this.freshStart=!0,this.audioContext?.state==="suspended"&&this.audioContext.resume().catch(()=>{})}get isPlaying(){return this._isPlaying}ensureContext(){return(!this.audioContext||this.audioContext.state==="closed")&&(this.audioContext=new AudioContext({sampleRate:this.defaultSampleRate})),this.audioContext.state==="suspended"&&this.audioContext.resume().catch(()=>{}),this.audioContext}}class rh{constructor(){this.videoElement=null,this.canvas=null,this.canvasCtx=null,this.mediaStream=null,this.captureInterval=null,this._isCapturing=!1,this.onFrame=null,this.width=640,this.height=480,this.fps=2,this.jpegQuality=.7}get isCapturing(){return this._isCapturing}get stream(){return this.mediaStream}async start(t,n){if(this._isCapturing)return console.warn("[VideoCapture] Already capturing"),this.mediaStream;this.onFrame=t;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera requires a secure context (HTTPS or localhost). Please access via https:// or http://localhost.");if(this.mediaStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:this.width},height:{ideal:this.height},facingMode:"user"}}),n&&(n.srcObject=this.mediaStream,n.muted=!0,n.playsInline=!0,await n.play().catch(()=>{console.warn("[VideoCapture] Preview autoplay blocked — user interaction required")})),this.videoElement=document.createElement("video"),this.videoElement.srcObject=this.mediaStream,this.videoElement.muted=!0,this.videoElement.playsInline=!0,await this.videoElement.play(),this.canvas=document.createElement("canvas"),this.canvas.width=this.width,this.canvas.height=this.height,this.canvasCtx=this.canvas.getContext("2d"),!this.canvasCtx)throw new Error("[VideoCapture] Failed to obtain 2D canvas context");return this.captureInterval=setInterval(()=>this.captureFrame(),1e3/this.fps),this._isCapturing=!0,console.log(`[VideoCapture] Started — ${this.width}x${this.height} @ ${this.fps} fps, JPEG quality=${this.jpegQuality}`),this.mediaStream}catch(s){throw console.error("[VideoCapture] Failed to start:",s),this.cleanup(),s}}stop(){this._isCapturing&&(this._isCapturing=!1,this.cleanup(),console.log("[VideoCapture] Stopped"))}setEnabled(t){this.mediaStream&&this.mediaStream.getVideoTracks().forEach(n=>{n.enabled=t})}captureFrame(){if(!this._isCapturing||!this.videoElement||!this.canvasCtx||!this.canvas||!this.onFrame||this.videoElement.readyState<this.videoElement.HAVE_CURRENT_DATA)return;this.canvasCtx.drawImage(this.videoElement,0,0,this.width,this.height);const n=this.canvas.toDataURL("image/jpeg",this.jpegQuality).split(",")[1];n&&this.onFrame(n)}cleanup(){this.captureInterval!==null&&(clearInterval(this.captureInterval),this.captureInterval=null),this.videoElement&&(this.videoElement.pause(),this.videoElement.srcObject=null,this.videoElement=null),this.mediaStream&&(this.mediaStream.getTracks().forEach(t=>t.stop()),this.mediaStream=null),this.canvas=null,this.canvasCtx=null,this.onFrame=null}}const lh=800,Wo="dh-video-player",si=250;function ch(){try{const e=new URLSearchParams(location.search).get("audioDelay"),t=e==null?si:Number(e);return Number.isFinite(t)?Math.min(2e3,Math.max(0,t))/1e3:si/1e3}catch{return si/1e3}}function dh(){try{return new URLSearchParams(location.search).get("webrtcAudio")==="1"}catch{return!1}}const ds=class ds{constructor(t){this.ws=null,this.rtcViewer=null,this.recorder=null,this.museTalkMode=!1,this.streamInfo=null,this.avatarWanted=!1,this.idleTimer=null,this.player=null,this.unmuteTimer=null,this.cameraStream=null,this.cameraEnabled=!1,this.videoCapture=null,this.callbacks=t}async start(t,n){await this.stop(),this.callbacks.onConnectionStatusChange("connecting");const i=location.protocol==="https:"?`wss://${location.host}/api/dh/connect/${n}`:`ws://${location.hostname}:${t}/api/dh/connect/${n}`;this.ws=new eh(this.buildMessageHandlers()),this.ws.connect(i),this.player=new oh(24e3,ch()),this.recorder=new ah(a=>{this.ws?.sendAudio(a)});try{await this.recorder.start()}catch(a){console.error("[DHSessionController] Microphone access denied:",a),this.callbacks.onErrorMessage(a instanceof Error?a.message:"Microphone access denied")}}async stop(){this.unmuteTimer!==null&&(clearTimeout(this.unmuteTimer),this.unmuteTimer=null),this.museTalkMode=!1,this.idleTimer!==null&&(clearTimeout(this.idleTimer),this.idleTimer=null),this.streamInfo=null,this.avatarWanted=!1,this.recorder&&(this.recorder.stop(),this.recorder=null),this.stopCamera(),this.rtcViewer&&(await this.rtcViewer.leave().catch(()=>{}),this.rtcViewer=null),this.player&&(this.player.stop(),this.player=null),this.ws&&(this.ws.disconnect(),this.ws=null),this.callbacks.onConnectionStatusChange("disconnected")}toggleMic(){if(!this.recorder)return!1;const t=!this.recorder.isMuted;return this.recorder.setMuted(t),!t}setVoice(t){return this.ws?(this.ws.sendVoiceChange(t),!0):(console.warn("[DHSessionController] setVoice — no active session"),!1)}showAvatar(){this.avatarWanted=!0,this.resetIdleTimer(),!this.rtcViewer&&(this.streamInfo?(this.initRtcViewer(this.streamInfo),this.callbacks.onAvatarActiveChange?.(!0)):this.ws?.sendAvatarResume())}hideAvatar(){this.avatarWanted=!1,this.idleTimer!==null&&(clearTimeout(this.idleTimer),this.idleTimer=null),this.rtcViewer&&(this.rtcViewer.destroy(),this.rtcViewer=null),this.museTalkMode=!1,this.ws?.sendAvatarPause(),this.streamInfo=null,this.callbacks.onAvatarActiveChange?.(!1)}toggleAvatar(){return this.rtcViewer?(this.hideAvatar(),!1):(this.showAvatar(),!0)}isAvatarActive(){return this.rtcViewer!==null}resetIdleTimer(){this.idleTimer!==null&&clearTimeout(this.idleTimer),this.idleTimer=setTimeout(()=>{this.idleTimer=null,this.rtcViewer&&this.hideAvatar()},ds.AVATAR_IDLE_MS)}toggleCamera(){return this.cameraEnabled=!this.cameraEnabled,this.cameraEnabled?this.startCamera():this.stopCamera(),this.cameraEnabled}async startCamera(){try{let t=null;for(let s=0;s<20&&(await new Promise(i=>setTimeout(i,50)),t=document.getElementById("camera-preview"),!t);s++);t||console.warn("[DHSessionController] #camera-preview not found after 1s"),this.videoCapture=new rh;let n=0;this.cameraStream=await this.videoCapture.start(s=>{n++,(n===1||n%10===0)&&console.log(`[DHSessionController] 📹 captured frame #${n} (base64 len=${s.length}); ws.connected=${this.ws?.isConnected}`);try{this.ws?.sendVideo(s)}catch(i){console.warn("[DHSessionController] sendVideo failed:",i)}},t),console.log("[DHSessionController] Camera started — VideoCapture is now emitting frames")}catch(t){if(console.error("[DHSessionController] Camera access denied or capture failed:",t),this.cameraEnabled=!1,this.cameraStream=null,this.videoCapture){try{this.videoCapture.stop()}catch{}this.videoCapture=null}}}stopCamera(){const t=!!this.videoCapture||!!this.cameraStream;if(this.videoCapture){try{this.videoCapture.stop()}catch{}this.videoCapture=null}this.cameraStream=null;const n=document.getElementById("camera-preview");n&&(n.srcObject=null),t&&console.log("[DHSessionController] Camera stopped")}buildMessageHandlers(){return{onConnected:()=>{console.log("[DHSessionController] WebSocket connected"),this.callbacks.onConnectionStatusChange("connected")},onDhStreamInfo:t=>{console.log("[DHSessionController] DH stream info received:",t),this.streamInfo=t,this.avatarWanted&&!this.rtcViewer&&(this.initRtcViewer(t),this.callbacks.onAvatarActiveChange?.(!0))},onAiText:(t,n)=>{this.callbacks.onSubtitleUpdate(t,n)},onAiAudio:(t,n)=>{const s=this.museTalkMode&&dh();(this.museTalkMode||!this.rtcViewer)&&!s&&this.player?.playChunk(t,n)},onAiResponseStarted:()=>{this.showAvatar(),this.recorder&&this.recorder.setMuted(!0),this.player?.resume()},onAiSpeechInterrupted:()=>{this.player?.flush(),this.unmuteTimer!==null&&(clearTimeout(this.unmuteTimer),this.unmuteTimer=null)},onAiResponseDone:()=>{this.unmuteTimer!==null&&clearTimeout(this.unmuteTimer),this.unmuteTimer=setTimeout(()=>{this.unmuteTimer=null,this.recorder&&this.recorder.setMuted(!1)},lh)},onUserTranscript:t=>{this.showAvatar(),this.callbacks.onUserTranscript(t)},onAiThinking:t=>{this.callbacks.onThinkingChange?.(t)},onError:(t,n)=>{if(console.error(`[DHSessionController] Backend error [${t}]: ${n}`),t==="AVATAR_MINT_FAILED"){this.avatarWanted=!1,this.idleTimer!==null&&(clearTimeout(this.idleTimer),this.idleTimer=null),this.callbacks.onAvatarActiveChange?.(!1);return}this.callbacks.onErrorMessage(n),this.callbacks.onConnectionStatusChange("error")},onClose:()=>{console.log("[DHSessionController] WebSocket closed"),this.callbacks.onConnectionStatusChange("disconnected")}}}initRtcViewer(t){this.rtcViewer&&(this.rtcViewer.destroy(),this.rtcViewer=null),t.provider==="musetalk"?this.initMuseTalkViewer(t):this.initByteRtcViewer(t)}initMuseTalkViewer(t){this.museTalkMode=!0;const n=new ss(Wo,{onStreamReady:()=>{console.log("[DHSessionController] MuseTalk WebRTC stream ready")},onAutoplayFailed:(i,a)=>{console.warn(`[DHSessionController] MuseTalk autoplay failed for userId=${i}, kind=${a}`)},onError:i=>{console.error("[DHSessionController] MuseTalk error:",i),this.callbacks.onErrorMessage(i instanceof Error?i.message:"MuseTalk error")}});this.rtcViewer=n;const s=(i,a)=>new Promise((o,l)=>{const c=this.ws;if(!c){l(new Error("DH WebSocket not available for offer exchange"));return}const p=setTimeout(()=>l(new Error("musetalk offer proxy timeout")),2e4);c.onMuseTalkAnswer=g=>{clearTimeout(p),g.error?l(new Error(g.error)):g.sdp?o(g.sdp):l(new Error("empty answer"))},c.sendMuseTalkOffer(i,a)});n.join({exchangeOffer:s,sessionId:t.sessionId,iceServers:t.iceServers}).catch(i=>{console.error("[DHSessionController] MuseTalk join failed:",i),this.callbacks.onErrorMessage(i instanceof Error?i.message:"MuseTalk join failed")})}initByteRtcViewer(t){const n=new ih(t.rtcAppId,Wo,{onStreamReady:()=>{console.log("[DHSessionController] ByteRTC stream ready")},onAutoplayFailed:(s,i)=>{console.warn(`[DHSessionController] Autoplay failed for userId=${s}, kind=${i}`)},onError:s=>{console.error("[DHSessionController] ByteRTC error:",s),this.callbacks.onErrorMessage(s instanceof Error?s.message:"ByteRTC error")}});this.rtcViewer=n,n.join(t.viewerToken,t.roomId,t.viewerUid).catch(s=>{console.error("[DHSessionController] ByteRTC join failed:",s),this.callbacks.onErrorMessage(s instanceof Error?s.message:"ByteRTC join failed")})}};ds.AVATAR_IDLE_MS=6e4;let Mi=ds;const uh="Serena";function ph(e){return e==="disconnected"?v:r`
    <span class="dh-status-badge dh-status-badge--${e}" role="status">
      ${_(e==="connecting"?"dh.statusConnecting":e==="connected"?"dh.statusConnected":"dh.statusError")}
    </span>
  `}function gh(e){return r`
    <div
      class="dh-placeholder"
      @click=${e}
      role="button"
      tabindex="0"
      aria-label=${_("dh.clickToStart")}
      @keydown=${t=>{(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),e())}}
    >
      <img
        src="/avatar-placeholder.png"
        class="dh-avatar-static"
        alt=${_("dh.avatarAlt")}
      />
      <span class="dh-start-hint">${_("dh.clickToStart")}</span>
    </div>
  `}function hh(e){return e.isConnected?r`
    <div
      id="dh-video-player"
      class="dh-video-player-container"
      @dblclick=${e.onVideoDoubleClick}
      aria-label=${_("dh.videoLabel")}
    ></div>
  `:gh(e.onStart)}function fh(e){return e?r`
    <video
      id="camera-preview"
      class="camera-pip"
      autoplay
      playsinline
      muted
      aria-label=${_("dh.cameraPreviewLabel")}
    ></video>
  `:v}function mh(e){return e?r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>`:r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>`}function vh(e){return e?r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <path d="M23 7 16 12 23 17V7z"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>`:r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/>
        <path d="M23 7l-7 5 7 5V7z"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>`}function bh(e){const t=_(e.micEnabled?"dh.micOn":"dh.micOff"),n=_(e.cameraEnabled?"dh.camOn":"dh.camOff");return r`
    <div class="dh-controls dh-controls--brand" role="toolbar" aria-label=${_("dh.controlsLabel")}>
      <!-- Mic toggle -->
      <button
        class="dh-btn ${e.micEnabled?"active":"inactive"}"
        @click=${e.onToggleMic}
        title=${t}
        aria-pressed=${e.micEnabled?"true":"false"}
        aria-label=${t}
      >
        ${mh(e.micEnabled)}
        <span class="dh-btn-label">${t}</span>
      </button>

      <!-- Camera toggle -->
      <button
        class="dh-btn ${e.cameraEnabled?"active":"inactive"}"
        @click=${e.onToggleCamera}
        title=${n}
        aria-pressed=${e.cameraEnabled?"true":"false"}
        aria-label=${n}
      >
        ${vh(e.cameraEnabled)}
        <span class="dh-btn-label">${n}</span>
      </button>

      <!-- 声音选择は伴侣管理画面(ai-meta)へ移設したため内嵌控制条からは削除。
           声音切替の実体(voice_change WS / reconnectWithVoice)は残置(将来再利用可)。 -->

      <!-- 数字人形象 ON/OFF(Qwen 音声対話は常時維持。このボタンは avatar のみを制御) -->
      ${e.isConnected?r`
            <button
              class="dh-btn ${e.avatarActive?"danger":"primary"}"
              @click=${e.onToggleAvatar}
              aria-pressed=${e.avatarActive?"true":"false"}
              aria-label=${_(e.avatarActive?"dh.avatarStop":"dh.avatarStart")}
              title=${_(e.avatarActive?"dh.avatarStop":"dh.avatarStart")}
            >
              ${e.avatarActive?r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  </svg>`:r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
                    <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/>
                    <path d="M3 22a9 9 0 0 1 18 0"/>
                  </svg>`}
              <span class="dh-btn-label">${_(e.avatarActive?"dh.avatarStop":"dh.avatarStart")}</span>
            </button>
          `:r`
            <button
              class="dh-btn primary"
              @click=${e.onStart}
              aria-label=${_("dh.startSession")}
              ?disabled=${e.connectionStatus==="connecting"}
            >
              ${e.connectionStatus==="connecting"?r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`:r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="currentColor" stroke-width="0"><polygon points="5 3 19 12 5 21 5 3"/></svg>`}
              <span class="dh-btn-label">
                ${e.connectionStatus==="connecting"?_("dh.statusConnecting"):_("dh.startSession")}
              </span>
            </button>
          `}
    </div>
  `}function yh(e){return r`
    <div class="dh-panel" aria-label=${_("dh.panelLabel")}>

      <!-- Video / placeholder area -->
      <div class="dh-video-container">
        ${ph(e.connectionStatus)}
        ${e.isThinking?r`<span class="dh-thinking-badge">正在思考中...</span>`:v}
        ${hh(e)}
        ${fh(e.cameraEnabled)}

        ${e.connectionStatus==="error"&&e.errorMessage?r`
              <div class="dh-error-overlay" role="alert">
                <span class="dh-error-text">${e.errorMessage}</span>
              </div>
            `:v}
      </div>

      <!-- Subtitle area removed (ユーザ要望 2026-07-07: 内嵌数字人画面の下方字幕を非表示) -->

      <!-- Control toolbar -->
      ${bh(e)}
    </div>
  `}const is=[{id:"read",label:"read",description:"Read file contents",sectionId:"fs",profiles:["coding"]},{id:"write",label:"write",description:"Create or overwrite files",sectionId:"fs",profiles:["coding"]},{id:"edit",label:"edit",description:"Make precise edits",sectionId:"fs",profiles:["coding"]},{id:"apply_patch",label:"apply_patch",description:"Patch files (OpenAI)",sectionId:"fs",profiles:["coding"]},{id:"exec",label:"exec",description:"Run shell commands",sectionId:"runtime",profiles:["coding"]},{id:"process",label:"process",description:"Manage background processes",sectionId:"runtime",profiles:["coding"]},{id:"web_search",label:"web_search",description:"Search the web",sectionId:"web",profiles:[],includeInWinClawGroup:!0},{id:"web_fetch",label:"web_fetch",description:"Fetch web content",sectionId:"web",profiles:[],includeInWinClawGroup:!0},{id:"memory_search",label:"memory_search",description:"Semantic search",sectionId:"memory",profiles:["coding"],includeInWinClawGroup:!0},{id:"memory_get",label:"memory_get",description:"Read memory files",sectionId:"memory",profiles:["coding"],includeInWinClawGroup:!0},{id:"sessions_list",label:"sessions_list",description:"List sessions",sectionId:"sessions",profiles:["coding","messaging"],includeInWinClawGroup:!0},{id:"sessions_history",label:"sessions_history",description:"Session history",sectionId:"sessions",profiles:["coding","messaging"],includeInWinClawGroup:!0},{id:"sessions_send",label:"sessions_send",description:"Send to session",sectionId:"sessions",profiles:["coding","messaging"],includeInWinClawGroup:!0},{id:"sessions_spawn",label:"sessions_spawn",description:"Spawn sub-agent",sectionId:"sessions",profiles:["coding"],includeInWinClawGroup:!0},{id:"subagents",label:"subagents",description:"Manage sub-agents",sectionId:"sessions",profiles:["coding"],includeInWinClawGroup:!0},{id:"session_status",label:"session_status",description:"Session status",sectionId:"sessions",profiles:["minimal","coding","messaging"],includeInWinClawGroup:!0},{id:"browser",label:"browser",description:"Control web browser",sectionId:"ui",profiles:[],includeInWinClawGroup:!0},{id:"canvas",label:"canvas",description:"Control canvases",sectionId:"ui",profiles:[],includeInWinClawGroup:!0},{id:"message",label:"message",description:"Send messages",sectionId:"messaging",profiles:["messaging"],includeInWinClawGroup:!0},{id:"cron",label:"cron",description:"Schedule tasks",sectionId:"automation",profiles:["coding"],includeInWinClawGroup:!0},{id:"gateway",label:"gateway",description:"Gateway control",sectionId:"automation",profiles:[],includeInWinClawGroup:!0},{id:"nodes",label:"nodes",description:"Nodes + devices",sectionId:"nodes",profiles:[],includeInWinClawGroup:!0},{id:"agents_list",label:"agents_list",description:"List agents",sectionId:"agents",profiles:[],includeInWinClawGroup:!0},{id:"image",label:"image",description:"Image understanding",sectionId:"media",profiles:["coding"],includeInWinClawGroup:!0},{id:"tts",label:"tts",description:"Text-to-speech conversion",sectionId:"media",profiles:[],includeInWinClawGroup:!0}];new Map(is.map(e=>[e.id,e]));function ii(e){return is.filter(t=>t.profiles.includes(e)).map(t=>t.id)}const xh={minimal:{allow:ii("minimal")},coding:{allow:ii("coding")},messaging:{allow:ii("messaging")},full:{}};function wh(){const e=new Map;for(const n of is){const s=`group:${n.sectionId}`,i=e.get(s)??[];i.push(n.id),e.set(s,i)}return{"group:winclaw":is.filter(n=>n.includeInWinClawGroup).map(n=>n.id),...Object.fromEntries(e.entries())}}const $h=wh();function kh(e){if(!e)return;const t=xh[e];if(t&&!(!t.allow&&!t.deny))return{allow:t.allow?[...t.allow]:void 0,deny:t.deny?[...t.deny]:void 0}}const Sh={bash:"exec","apply-patch":"apply_patch"},Ah={...$h};function He(e){const t=e.trim().toLowerCase();return Sh[t]??t}function Ch(e){return e?e.map(He).filter(Boolean):[]}function Th(e){const t=Ch(e),n=[];for(const s of t){const i=Ah[s];if(i){n.push(...i);continue}n.push(s)}return Array.from(new Set(n))}function _h(e){return kh(e)}function Eh(e){const t=e.host??"unknown",n=e.ip?`(${e.ip})`:"",s=e.mode??"",i=e.version??"";return`${t} ${n} ${s} ${i}`.trim()}function Lh(e){const t=e.ts??null;return t?Y(t):"n/a"}function _a(e){return e?`${Ct(e)} (${Y(e)})`:"n/a"}function Ih(e){if(e.totalTokens==null)return"n/a";const t=e.totalTokens??0,n=e.contextTokens??0;return n?`${t} / ${n}`:String(t)}function Mh(e){if(e==null)return"";try{return JSON.stringify(e,null,2)}catch{return String(e)}}function Rh(e){const t=e.state??{},n=t.nextRunAtMs?Ct(t.nextRunAtMs):"n/a",s=t.lastRunAtMs?Ct(t.lastRunAtMs):"n/a";return`${t.lastStatus??"n/a"} · next ${n} · last ${s}`}function cc(e){const t=e.schedule;if(t.kind==="at"){const n=Date.parse(t.at);return Number.isFinite(n)?`At ${Ct(n)}`:`At ${t.at}`}return t.kind==="every"?`Every ${la(t.everyMs)}`:`Cron ${t.expr}${t.tz?` (${t.tz})`:""}`}function Ph(e){const t=e.payload;if(t.kind==="systemEvent")return`System: ${t.text}`;const n=`Agent: ${t.message}`,s=e.delivery;if(s&&s.mode!=="none"){const i=s.channel||s.to?` (${s.channel??"last"}${s.to?` -> ${s.to}`:""})`:"";return`${n} · ${s.mode}${i}`}return n}const qo=[{id:"fs",label:"Files",tools:[{id:"read",label:"read",description:"Read file contents"},{id:"write",label:"write",description:"Create or overwrite files"},{id:"edit",label:"edit",description:"Make precise edits"},{id:"apply_patch",label:"apply_patch",description:"Patch files (OpenAI)"}]},{id:"runtime",label:"Runtime",tools:[{id:"exec",label:"exec",description:"Run shell commands"},{id:"process",label:"process",description:"Manage background processes"}]},{id:"web",label:"Web",tools:[{id:"web_search",label:"web_search",description:"Search the web"},{id:"web_fetch",label:"web_fetch",description:"Fetch web content"}]},{id:"memory",label:"Memory",tools:[{id:"memory_search",label:"memory_search",description:"Semantic search"},{id:"memory_get",label:"memory_get",description:"Read memory files"}]},{id:"sessions",label:"Sessions",tools:[{id:"sessions_list",label:"sessions_list",description:"List sessions"},{id:"sessions_history",label:"sessions_history",description:"Session history"},{id:"sessions_send",label:"sessions_send",description:"Send to session"},{id:"sessions_spawn",label:"sessions_spawn",description:"Spawn sub-agent"},{id:"session_status",label:"session_status",description:"Session status"}]},{id:"ui",label:"UI",tools:[{id:"browser",label:"browser",description:"Control web browser"},{id:"canvas",label:"canvas",description:"Control canvases"}]},{id:"messaging",label:"Messaging",tools:[{id:"message",label:"message",description:"Send messages"}]},{id:"automation",label:"Automation",tools:[{id:"cron",label:"cron",description:"Schedule tasks"},{id:"gateway",label:"gateway",description:"Gateway control"}]},{id:"nodes",label:"Nodes",tools:[{id:"nodes",label:"nodes",description:"Nodes + devices"}]},{id:"agents",label:"Agents",tools:[{id:"agents_list",label:"agents_list",description:"List agents"}]},{id:"media",label:"Media",tools:[{id:"image",label:"image",description:"Image understanding"}]}],Dh=[{id:"minimal",label:"Minimal"},{id:"coding",label:"Coding"},{id:"messaging",label:"Messaging"},{id:"full",label:"Full"}];function Ri(e){return e.name?.trim()||e.identity?.name?.trim()||e.id}function Pn(e){const t=e.trim();if(!t||t.length>16)return!1;let n=!1;for(let s=0;s<t.length;s+=1)if(t.charCodeAt(s)>127){n=!0;break}return!(!n||t.includes("://")||t.includes("/")||t.includes("."))}function Ss(e,t){const n=t?.emoji?.trim();if(n&&Pn(n))return n;const s=e.identity?.emoji?.trim();if(s&&Pn(s))return s;const i=t?.avatar?.trim();if(i&&Pn(i))return i;const a=e.identity?.avatar?.trim();return a&&Pn(a)?a:""}function dc(e,t){return t&&e===t?"default":null}function Fh(e){if(e==null||!Number.isFinite(e))return"-";if(e<1024)return`${e} B`;const t=["KB","MB","GB","TB"];let n=e/1024,s=0;for(;n>=1024&&s<t.length-1;)n/=1024,s+=1;return`${n.toFixed(n<10?1:0)} ${t[s]}`}function As(e,t){const n=e;return{entry:(n?.agents?.list??[]).find(a=>a?.id===t),defaults:n?.agents?.defaults,globalTools:n?.tools}}function uc(e,t,n,s,i){const a=As(t,e.id),l=(n&&n.agentId===e.id?n.workspace:null)||a.entry?.workspace||a.defaults?.workspace||"default",c=a.entry?.model?cn(a.entry?.model):cn(a.defaults?.model),p=i?.name?.trim()||e.identity?.name?.trim()||e.name?.trim()||a.entry?.name||e.id,g=Ss(e,i)||"-",u=Array.isArray(a.entry?.skills)?a.entry?.skills:null,h=u?.length??null;return{workspace:l,model:c,identityName:p,identityEmoji:g,skillsLabel:u?`${h} selected`:"all skills",isDefault:!!(s&&e.id===s)}}function cn(e){if(!e)return"-";if(typeof e=="string")return e.trim()||"-";if(typeof e=="object"&&e){const t=e,n=t.primary?.trim();if(n){const s=Array.isArray(t.fallbacks)?t.fallbacks.length:0;return s>0?`${n} (+${s} fallback)`:n}}return"-"}function Go(e){const t=e.match(/^(.+) \(\+\d+ fallback\)$/);return t?t[1]:e}function Qo(e){if(!e)return null;if(typeof e=="string")return e.trim()||null;if(typeof e=="object"&&e){const t=e;return(typeof t.primary=="string"?t.primary:typeof t.model=="string"?t.model:typeof t.id=="string"?t.id:typeof t.value=="string"?t.value:null)?.trim()||null}return null}function Nh(e){if(!e||typeof e=="string")return null;if(typeof e=="object"&&e){const t=e,n=Array.isArray(t.fallbacks)?t.fallbacks:Array.isArray(t.fallback)?t.fallback:null;return n?n.filter(s=>typeof s=="string"):null}return null}function Oh(e){return e.split(",").map(t=>t.trim()).filter(Boolean)}function Bh(e){const n=e?.agents?.defaults?.models;if(!n||typeof n!="object")return[];const s=[];for(const[i,a]of Object.entries(n)){const o=i.trim();if(!o)continue;const l=a&&typeof a=="object"&&"alias"in a&&typeof a.alias=="string"?a.alias?.trim():void 0,c=l&&l!==o?`${l} (${o})`:o;s.push({value:o,label:c})}return s}function Uh(e,t){const n=Bh(e),s=t?n.some(i=>i.value===t):!1;return t&&!s&&n.unshift({value:t,label:`Current (${t})`}),n.length===0?r`
      <option value="" disabled>No configured models</option>
    `:n.map(i=>r`<option value=${i.value}>${i.label}</option>`)}function Hh(e){const t=He(e);if(!t)return{kind:"exact",value:""};if(t==="*")return{kind:"all"};if(!t.includes("*"))return{kind:"exact",value:t};const n=t.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&");return{kind:"regex",value:new RegExp(`^${n.replaceAll("\\*",".*")}$`)}}function Pi(e){return Array.isArray(e)?Th(e).map(Hh).filter(t=>t.kind!=="exact"||t.value.length>0):[]}function dn(e,t){for(const n of t)if(n.kind==="all"||n.kind==="exact"&&e===n.value||n.kind==="regex"&&n.value.test(e))return!0;return!1}function zh(e,t){if(!t)return!0;const n=He(e),s=Pi(t.deny);if(dn(n,s))return!1;const i=Pi(t.allow);return!!(i.length===0||dn(n,i)||n==="apply_patch"&&dn("exec",i))}function Yo(e,t){if(!Array.isArray(t)||t.length===0)return!1;const n=He(e),s=Pi(t);return!!(dn(n,s)||n==="apply_patch"&&dn("exec",s))}function jh(e){const t=e.agentsList?.agents??[],n=e.agentsList?.defaultId??null,s=e.selectedAgentId??n??t[0]?.id??null,i=s?t.find(a=>a.id===s)??null:null;return r`
    <div class="agents-layout">
      <section class="card agents-sidebar">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">Agents</div>
            <div class="card-sub">${t.length} configured.</div>
          </div>
          <button class="btn btn--sm" ?disabled=${e.loading} @click=${e.onRefresh}>
            ${e.loading?"Loading…":"Refresh"}
          </button>
        </div>
        ${e.error?r`<div class="callout danger" style="margin-top: 12px;">${e.error}</div>`:v}
        <div class="agent-list" style="margin-top: 12px;">
          ${t.length===0?r`
                  <div class="muted">No agents found.</div>
                `:t.map(a=>{const o=dc(a.id,n),l=Ss(a,e.agentIdentityById[a.id]??null);return r`
                    <button
                      type="button"
                      class="agent-row ${s===a.id?"active":""}"
                      @click=${()=>e.onSelectAgent(a.id)}
                    >
                      <div class="agent-avatar">
                        ${l||Ri(a).slice(0,1)}
                      </div>
                      <div class="agent-info">
                        <div class="agent-title">${Ri(a)}</div>
                        <div class="agent-sub mono">${a.id}</div>
                      </div>
                      ${o?r`<span class="agent-pill">${o}</span>`:v}
                    </button>
                  `})}
        </div>
      </section>
      <section class="agents-main">
        ${i?r`
              ${Kh(i,n,e.agentIdentityById[i.id]??null)}
              ${Vh(e.activePanel,a=>e.onSelectPanel(a))}
              ${e.activePanel==="overview"?Wh({agent:i,defaultId:n,configForm:e.configForm,agentFilesList:e.agentFilesList,agentIdentity:e.agentIdentityById[i.id]??null,agentIdentityError:e.agentIdentityError,agentIdentityLoading:e.agentIdentityLoading,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configDirty,onConfigReload:e.onConfigReload,onConfigSave:e.onConfigSave,onModelChange:e.onModelChange,onModelFallbacksChange:e.onModelFallbacksChange}):v}
              ${e.activePanel==="files"?nf({agentId:i.id,agentFilesList:e.agentFilesList,agentFilesLoading:e.agentFilesLoading,agentFilesError:e.agentFilesError,agentFileActive:e.agentFileActive,agentFileContents:e.agentFileContents,agentFileDrafts:e.agentFileDrafts,agentFileSaving:e.agentFileSaving,onLoadFiles:e.onLoadFiles,onSelectFile:e.onSelectFile,onFileDraftChange:e.onFileDraftChange,onFileReset:e.onFileReset,onFileSave:e.onFileSave}):v}
              ${e.activePanel==="tools"?af({agentId:i.id,configForm:e.configForm,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configDirty,onProfileChange:e.onToolsProfileChange,onOverridesChange:e.onToolsOverridesChange,onConfigReload:e.onConfigReload,onConfigSave:e.onConfigSave}):v}
              ${e.activePanel==="skills"?rf({agentId:i.id,report:e.agentSkillsReport,loading:e.agentSkillsLoading,error:e.agentSkillsError,activeAgentId:e.agentSkillsAgentId,configForm:e.configForm,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configDirty,filter:e.skillsFilter,onFilterChange:e.onSkillsFilterChange,onRefresh:e.onSkillsRefresh,onToggle:e.onAgentSkillToggle,onClear:e.onAgentSkillsClear,onDisableAll:e.onAgentSkillsDisableAll,onConfigReload:e.onConfigReload,onConfigSave:e.onConfigSave}):v}
              ${e.activePanel==="channels"?ef({agent:i,defaultId:n,configForm:e.configForm,agentFilesList:e.agentFilesList,agentIdentity:e.agentIdentityById[i.id]??null,snapshot:e.channelsSnapshot,loading:e.channelsLoading,error:e.channelsError,lastSuccess:e.channelsLastSuccess,onRefresh:e.onChannelsRefresh}):v}
              ${e.activePanel==="cron"?tf({agent:i,defaultId:n,configForm:e.configForm,agentFilesList:e.agentFilesList,agentIdentity:e.agentIdentityById[i.id]??null,jobs:e.cronJobs,status:e.cronStatus,loading:e.cronLoading,error:e.cronError,onRefresh:e.onCronRefresh}):v}
            `:r`
                <div class="card">
                  <div class="card-title">Select an agent</div>
                  <div class="card-sub">Pick an agent to inspect its workspace and tools.</div>
                </div>
              `}
      </section>
    </div>
  `}function Kh(e,t,n){const s=dc(e.id,t),i=Ri(e),a=e.identity?.theme?.trim()||"Agent workspace and routing.",o=Ss(e,n);return r`
    <section class="card agent-header">
      <div class="agent-header-main">
        <div class="agent-avatar agent-avatar--lg">
          ${o||i.slice(0,1)}
        </div>
        <div>
          <div class="card-title">${i}</div>
          <div class="card-sub">${a}</div>
        </div>
      </div>
      <div class="agent-header-meta">
        <div class="mono">${e.id}</div>
        ${s?r`<span class="agent-pill">${s}</span>`:v}
      </div>
    </section>
  `}function Vh(e,t){return r`
    <div class="agent-tabs">
      ${[{id:"overview",label:"Overview"},{id:"files",label:"Files"},{id:"tools",label:"Tools"},{id:"skills",label:"Skills"},{id:"channels",label:"Channels"},{id:"cron",label:"Cron Jobs"}].map(s=>r`
          <button
            class="agent-tab ${e===s.id?"active":""}"
            type="button"
            @click=${()=>t(s.id)}
          >
            ${s.label}
          </button>
        `)}
    </div>
  `}function Wh(e){const{agent:t,configForm:n,agentFilesList:s,agentIdentity:i,agentIdentityLoading:a,agentIdentityError:o,configLoading:l,configSaving:c,configDirty:p,onConfigReload:g,onConfigSave:u,onModelChange:h,onModelFallbacksChange:f}=e,d=As(n,t.id),k=(s&&s.agentId===t.id?s.workspace:null)||d.entry?.workspace||d.defaults?.workspace||"default",S=d.entry?.model?cn(d.entry?.model):cn(d.defaults?.model),$=cn(d.defaults?.model),C=Qo(d.entry?.model)||(S!=="-"?Go(S):null),A=Qo(d.defaults?.model)||($!=="-"?Go($):null),T=C??A??null,E=Nh(d.entry?.model),M=E?E.join(", "):"",V=i?.name?.trim()||t.identity?.name?.trim()||t.name?.trim()||d.entry?.name||"-",oe=Ss(t,i)||"-",N=Array.isArray(d.entry?.skills)?d.entry?.skills:null,z=N?.length??null,he=a?"Loading…":o?"Unavailable":"",L=!!(e.defaultId&&t.id===e.defaultId);return r`
    <section class="card">
      <div class="card-title">Overview</div>
      <div class="card-sub">Workspace paths and identity metadata.</div>
      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">Workspace</div>
          <div class="mono">${k}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Primary Model</div>
          <div class="mono">${S}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Identity Name</div>
          <div>${V}</div>
          ${he?r`<div class="agent-kv-sub muted">${he}</div>`:v}
        </div>
        <div class="agent-kv">
          <div class="label">Default</div>
          <div>${L?"yes":"no"}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Identity Emoji</div>
          <div>${oe}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Skills Filter</div>
          <div>${N?`${z} selected`:"all skills"}</div>
        </div>
      </div>

      <div class="agent-model-select" style="margin-top: 20px;">
        <div class="label">Model Selection</div>
        <div class="row" style="gap: 12px; flex-wrap: wrap;">
          <label class="field" style="min-width: 260px; flex: 1;">
            <span>Primary model${L?" (default)":""}</span>
            <select
              .value=${T??""}
              ?disabled=${!n||l||c}
              @change=${U=>h(t.id,U.target.value||null)}
            >
              ${L?v:r`
                      <option value="">
                        ${A?`Inherit default (${A})`:"Inherit default"}
                      </option>
                    `}
              ${Uh(n,T??void 0)}
            </select>
          </label>
          <label class="field" style="min-width: 260px; flex: 1;">
            <span>Fallbacks (comma-separated)</span>
            <input
              .value=${M}
              ?disabled=${!n||l||c}
              placeholder="provider/model, provider/model"
              @input=${U=>f(t.id,Oh(U.target.value))}
            />
          </label>
        </div>
        <div class="row" style="justify-content: flex-end; gap: 8px;">
          <button
            class="btn btn--sm"
            ?disabled=${l}
            @click=${g}
          >
            Reload Config
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${c||!p}
            @click=${u}
          >
            ${c?"Saving…":"Save"}
          </button>
        </div>
      </div>
    </section>
  `}function pc(e,t){return r`
    <section class="card">
      <div class="card-title">Agent Context</div>
      <div class="card-sub">${t}</div>
      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">Workspace</div>
          <div class="mono">${e.workspace}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Primary Model</div>
          <div class="mono">${e.model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Identity Name</div>
          <div>${e.identityName}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Identity Emoji</div>
          <div>${e.identityEmoji}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Skills Filter</div>
          <div>${e.skillsLabel}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Default</div>
          <div>${e.isDefault?"yes":"no"}</div>
        </div>
      </div>
    </section>
  `}function qh(e,t){const n=e.channelMeta?.find(s=>s.id===t);return n?.label?n.label:e.channelLabels?.[t]??t}function Gh(e){if(!e)return[];const t=new Set;for(const i of e.channelOrder??[])t.add(i);for(const i of e.channelMeta??[])t.add(i.id);for(const i of Object.keys(e.channelAccounts??{}))t.add(i);const n=[],s=e.channelOrder?.length?e.channelOrder:Array.from(t);for(const i of s)t.has(i)&&(n.push(i),t.delete(i));for(const i of t)n.push(i);return n.map(i=>({id:i,label:qh(e,i),accounts:e.channelAccounts?.[i]??[]}))}const Qh=["groupPolicy","streamMode","dmPolicy"];function Yh(e,t){if(!e)return null;const s=(e.channels??{})[t];if(s&&typeof s=="object")return s;const i=e[t];return i&&typeof i=="object"?i:null}function Jh(e){if(e==null)return"n/a";if(typeof e=="string"||typeof e=="number"||typeof e=="boolean")return String(e);try{return JSON.stringify(e)}catch{return"n/a"}}function Zh(e,t){const n=Yh(e,t);return n?Qh.flatMap(s=>s in n?[{label:s,value:Jh(n[s])}]:[]):[]}function Xh(e){let t=0,n=0,s=0;for(const i of e){const a=i.probe&&typeof i.probe=="object"&&"ok"in i.probe?!!i.probe.ok:!1;(i.connected===!0||i.running===!0||a)&&(t+=1),i.configured&&(n+=1),i.enabled&&(s+=1)}return{total:e.length,connected:t,configured:n,enabled:s}}function ef(e){const t=uc(e.agent,e.configForm,e.agentFilesList,e.defaultId,e.agentIdentity),n=Gh(e.snapshot),s=e.lastSuccess?Y(e.lastSuccess):"never";return r`
    <section class="grid grid-cols-2">
      ${pc(t,"Workspace, identity, and model configuration.")}
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">Channels</div>
            <div class="card-sub">Gateway-wide channel status snapshot.</div>
          </div>
          <button class="btn btn--sm" ?disabled=${e.loading} @click=${e.onRefresh}>
            ${e.loading?"Refreshing…":"Refresh"}
          </button>
        </div>
        <div class="muted" style="margin-top: 8px;">
          Last refresh: ${s}
        </div>
        ${e.error?r`<div class="callout danger" style="margin-top: 12px;">${e.error}</div>`:v}
        ${e.snapshot?v:r`
                <div class="callout info" style="margin-top: 12px">Load channels to see live status.</div>
              `}
        ${n.length===0?r`
                <div class="muted" style="margin-top: 16px">No channels found.</div>
              `:r`
              <div class="list" style="margin-top: 16px;">
                ${n.map(i=>{const a=Xh(i.accounts),o=a.total?`${a.connected}/${a.total} connected`:"no accounts",l=a.configured?`${a.configured} configured`:"not configured",c=a.total?`${a.enabled} enabled`:"disabled",p=Zh(e.configForm,i.id);return r`
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${i.label}</div>
                        <div class="list-sub mono">${i.id}</div>
                      </div>
                      <div class="list-meta">
                        <div>${o}</div>
                        <div>${l}</div>
                        <div>${c}</div>
                        ${p.length>0?p.map(g=>r`<div>${g.label}: ${g.value}</div>`):v}
                      </div>
                    </div>
                  `})}
              </div>
            `}
      </section>
    </section>
  `}function tf(e){const t=uc(e.agent,e.configForm,e.agentFilesList,e.defaultId,e.agentIdentity),n=e.jobs.filter(s=>s.agentId===e.agent.id);return r`
    <section class="grid grid-cols-2">
      ${pc(t,"Workspace and scheduling targets.")}
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">Scheduler</div>
            <div class="card-sub">Gateway cron status.</div>
          </div>
          <button class="btn btn--sm" ?disabled=${e.loading} @click=${e.onRefresh}>
            ${e.loading?"Refreshing…":"Refresh"}
          </button>
        </div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Enabled</div>
            <div class="stat-value">
              ${e.status?e.status.enabled?"Yes":"No":"n/a"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Jobs</div>
            <div class="stat-value">${e.status?.jobs??"n/a"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Next wake</div>
            <div class="stat-value">${_a(e.status?.nextWakeAtMs??null)}</div>
          </div>
        </div>
        ${e.error?r`<div class="callout danger" style="margin-top: 12px;">${e.error}</div>`:v}
      </section>
    </section>
    <section class="card">
      <div class="card-title">Agent Cron Jobs</div>
      <div class="card-sub">Scheduled jobs targeting this agent.</div>
      ${n.length===0?r`
              <div class="muted" style="margin-top: 16px">No jobs assigned.</div>
            `:r`
              <div class="list" style="margin-top: 16px;">
                ${n.map(s=>r`
                  <div class="list-item">
                    <div class="list-main">
                      <div class="list-title">${s.name}</div>
                      ${s.description?r`<div class="list-sub">${s.description}</div>`:v}
                      <div class="chip-row" style="margin-top: 6px;">
                        <span class="chip">${cc(s)}</span>
                        <span class="chip ${s.enabled?"chip-ok":"chip-warn"}">
                          ${s.enabled?"enabled":"disabled"}
                        </span>
                        <span class="chip">${s.sessionTarget}</span>
                      </div>
                    </div>
                    <div class="list-meta">
                      <div class="mono">${Rh(s)}</div>
                      <div class="muted">${Ph(s)}</div>
                    </div>
                  </div>
                `)}
              </div>
            `}
    </section>
  `}function nf(e){const t=e.agentFilesList?.agentId===e.agentId?e.agentFilesList:null,n=t?.files??[],s=e.agentFileActive??null,i=s?n.find(c=>c.name===s)??null:null,a=s?e.agentFileContents[s]??"":"",o=s?e.agentFileDrafts[s]??a:"",l=s?o!==a:!1;return r`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Core Files</div>
          <div class="card-sub">Bootstrap persona, identity, and tool guidance.</div>
        </div>
        <button
          class="btn btn--sm"
          ?disabled=${e.agentFilesLoading}
          @click=${()=>e.onLoadFiles(e.agentId)}
        >
          ${e.agentFilesLoading?"Loading…":"Refresh"}
        </button>
      </div>
      ${t?r`<div class="muted mono" style="margin-top: 8px;">Workspace: ${t.workspace}</div>`:v}
      ${e.agentFilesError?r`<div class="callout danger" style="margin-top: 12px;">${e.agentFilesError}</div>`:v}
      ${t?r`
              <div class="agent-files-grid" style="margin-top: 16px;">
                <div class="agent-files-list">
                  ${n.length===0?r`
                          <div class="muted">No files found.</div>
                        `:n.map(c=>sf(c,s,()=>e.onSelectFile(c.name)))}
                </div>
                <div class="agent-files-editor">
                  ${i?r`
                          <div class="agent-file-header">
                            <div>
                              <div class="agent-file-title mono">${i.name}</div>
                              <div class="agent-file-sub mono">${i.path}</div>
                            </div>
                            <div class="agent-file-actions">
                              <button
                                class="btn btn--sm"
                                ?disabled=${!l}
                                @click=${()=>e.onFileReset(i.name)}
                              >
                                Reset
                              </button>
                              <button
                                class="btn btn--sm primary"
                                ?disabled=${e.agentFileSaving||!l}
                                @click=${()=>e.onFileSave(i.name)}
                              >
                                ${e.agentFileSaving?"Saving…":"Save"}
                              </button>
                            </div>
                          </div>
                          ${i.missing?r`
                                  <div class="callout info" style="margin-top: 10px">
                                    This file is missing. Saving will create it in the agent workspace.
                                  </div>
                                `:v}
                          <label class="field" style="margin-top: 12px;">
                            <span>Content</span>
                            <textarea
                              .value=${o}
                              @input=${c=>e.onFileDraftChange(i.name,c.target.value)}
                            ></textarea>
                          </label>
                        `:r`
                          <div class="muted">Select a file to edit.</div>
                        `}
                </div>
              </div>
            `:r`
              <div class="callout info" style="margin-top: 12px">
                Load the agent workspace files to edit core instructions.
              </div>
            `}
    </section>
  `}function sf(e,t,n){const s=e.missing?"Missing":`${Fh(e.size)} · ${Y(e.updatedAtMs??null)}`;return r`
    <button
      type="button"
      class="agent-file-row ${t===e.name?"active":""}"
      @click=${n}
    >
      <div>
        <div class="agent-file-name mono">${e.name}</div>
        <div class="agent-file-meta">${s}</div>
      </div>
      ${e.missing?r`
              <span class="agent-pill warn">missing</span>
            `:v}
    </button>
  `}function af(e){const t=As(e.configForm,e.agentId),n=t.entry?.tools??{},s=t.globalTools??{},i=n.profile??s.profile??"full",a=n.profile?"agent override":s.profile?"global default":"default",o=Array.isArray(n.allow)&&n.allow.length>0,l=Array.isArray(s.allow)&&s.allow.length>0,c=!!e.configForm&&!e.configLoading&&!e.configSaving&&!o,p=o?[]:Array.isArray(n.alsoAllow)?n.alsoAllow:[],g=o?[]:Array.isArray(n.deny)?n.deny:[],u=o?{allow:n.allow??[],deny:n.deny??[]}:_h(i)??void 0,h=qo.flatMap(S=>S.tools.map($=>$.id)),f=S=>{const $=zh(S,u),C=Yo(S,p),A=Yo(S,g);return{allowed:($||C)&&!A,baseAllowed:$,denied:A}},d=h.filter(S=>f(S).allowed).length,m=(S,$)=>{const C=new Set(p.map(M=>He(M)).filter(M=>M.length>0)),A=new Set(g.map(M=>He(M)).filter(M=>M.length>0)),T=f(S).baseAllowed,E=He(S);$?(A.delete(E),T||C.add(E)):(C.delete(E),A.add(E)),e.onOverridesChange(e.agentId,[...C],[...A])},k=S=>{const $=new Set(p.map(A=>He(A)).filter(A=>A.length>0)),C=new Set(g.map(A=>He(A)).filter(A=>A.length>0));for(const A of h){const T=f(A).baseAllowed,E=He(A);S?(C.delete(E),T||$.add(E)):($.delete(E),C.add(E))}e.onOverridesChange(e.agentId,[...$],[...C])};return r`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Tool Access</div>
          <div class="card-sub">
            Profile + per-tool overrides for this agent.
            <span class="mono">${d}/${h.length}</span> enabled.
          </div>
        </div>
        <div class="row" style="gap: 8px;">
          <button
            class="btn btn--sm"
            ?disabled=${!c}
            @click=${()=>k(!0)}
          >
            Enable All
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${!c}
            @click=${()=>k(!1)}
          >
            Disable All
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${e.configLoading}
            @click=${e.onConfigReload}
          >
            Reload Config
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${e.configSaving||!e.configDirty}
            @click=${e.onConfigSave}
          >
            ${e.configSaving?"Saving…":"Save"}
          </button>
        </div>
      </div>

      ${e.configForm?v:r`
              <div class="callout info" style="margin-top: 12px">
                Load the gateway config to adjust tool profiles.
              </div>
            `}
      ${o?r`
              <div class="callout info" style="margin-top: 12px">
                This agent is using an explicit allowlist in config. Tool overrides are managed in the Config tab.
              </div>
            `:v}
      ${l?r`
              <div class="callout info" style="margin-top: 12px">
                Global tools.allow is set. Agent overrides cannot enable tools that are globally blocked.
              </div>
            `:v}

      <div class="agent-tools-meta" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">Profile</div>
          <div class="mono">${i}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Source</div>
          <div>${a}</div>
        </div>
        ${e.configDirty?r`
                <div class="agent-kv">
                  <div class="label">Status</div>
                  <div class="mono">unsaved</div>
                </div>
              `:v}
      </div>

      <div class="agent-tools-presets" style="margin-top: 16px;">
        <div class="label">Quick Presets</div>
        <div class="agent-tools-buttons">
          ${Dh.map(S=>r`
              <button
                class="btn btn--sm ${i===S.id?"active":""}"
                ?disabled=${!c}
                @click=${()=>e.onProfileChange(e.agentId,S.id,!0)}
              >
                ${S.label}
              </button>
            `)}
          <button
            class="btn btn--sm"
            ?disabled=${!c}
            @click=${()=>e.onProfileChange(e.agentId,null,!1)}
          >
            Inherit
          </button>
        </div>
      </div>

      <div class="agent-tools-grid" style="margin-top: 20px;">
        ${qo.map(S=>r`
            <div class="agent-tools-section">
              <div class="agent-tools-header">${S.label}</div>
              <div class="agent-tools-list">
                ${S.tools.map($=>{const{allowed:C}=f($.id);return r`
                    <div class="agent-tool-row">
                      <div>
                        <div class="agent-tool-title mono">${$.label}</div>
                        <div class="agent-tool-sub">${$.description}</div>
                      </div>
                      <label class="cfg-toggle">
                        <input
                          type="checkbox"
                          .checked=${C}
                          ?disabled=${!c}
                          @change=${A=>m($.id,A.target.checked)}
                        />
                        <span class="cfg-toggle__track"></span>
                      </label>
                    </div>
                  `})}
              </div>
            </div>
          `)}
      </div>
    </section>
  `}const Dn=[{id:"workspace",label:"Workspace Skills",sources:["winclaw-workspace"]},{id:"built-in",label:"Built-in Skills",sources:["winclaw-bundled"]},{id:"installed",label:"Installed Skills",sources:["winclaw-managed"]},{id:"extra",label:"Extra Skills",sources:["winclaw-extra"]}];function of(e){const t=new Map;for(const a of Dn)t.set(a.id,{id:a.id,label:a.label,skills:[]});const n=Dn.find(a=>a.id==="built-in"),s={id:"other",label:"Other Skills",skills:[]};for(const a of e){const o=a.bundled?n:Dn.find(l=>l.sources.includes(a.source));o?t.get(o.id)?.skills.push(a):s.skills.push(a)}const i=Dn.map(a=>t.get(a.id)).filter(a=>!!(a&&a.skills.length>0));return s.skills.length>0&&i.push(s),i}function rf(e){const t=!!e.configForm&&!e.configLoading&&!e.configSaving,n=As(e.configForm,e.agentId),s=Array.isArray(n.entry?.skills)?n.entry?.skills:void 0,i=new Set((s??[]).map(f=>f.trim()).filter(Boolean)),a=s!==void 0,o=!!(e.report&&e.activeAgentId===e.agentId),l=o?e.report?.skills??[]:[],c=e.filter.trim().toLowerCase(),p=c?l.filter(f=>[f.name,f.description,f.source].join(" ").toLowerCase().includes(c)):l,g=of(p),u=a?l.filter(f=>i.has(f.name)).length:l.length,h=l.length;return r`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Skills</div>
          <div class="card-sub">
            Per-agent skill allowlist and workspace skills.
            ${h>0?r`<span class="mono">${u}/${h}</span>`:v}
          </div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn btn--sm" ?disabled=${!t} @click=${()=>e.onClear(e.agentId)}>
            Use All
          </button>
          <button class="btn btn--sm" ?disabled=${!t} @click=${()=>e.onDisableAll(e.agentId)}>
            Disable All
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${e.configLoading}
            @click=${e.onConfigReload}
          >
            Reload Config
          </button>
          <button class="btn btn--sm" ?disabled=${e.loading} @click=${e.onRefresh}>
            ${e.loading?"Loading…":"Refresh"}
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${e.configSaving||!e.configDirty}
            @click=${e.onConfigSave}
          >
            ${e.configSaving?"Saving…":"Save"}
          </button>
        </div>
      </div>

      ${e.configForm?v:r`
              <div class="callout info" style="margin-top: 12px">
                Load the gateway config to set per-agent skills.
              </div>
            `}
      ${a?r`
              <div class="callout info" style="margin-top: 12px">This agent uses a custom skill allowlist.</div>
            `:r`
              <div class="callout info" style="margin-top: 12px">
                All skills are enabled. Disabling any skill will create a per-agent allowlist.
              </div>
            `}
      ${!o&&!e.loading?r`
              <div class="callout info" style="margin-top: 12px">
                Load skills for this agent to view workspace-specific entries.
              </div>
            `:v}
      ${e.error?r`<div class="callout danger" style="margin-top: 12px;">${e.error}</div>`:v}

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="flex: 1;">
          <span>Filter</span>
          <input
            .value=${e.filter}
            @input=${f=>e.onFilterChange(f.target.value)}
            placeholder="Search skills"
          />
        </label>
        <div class="muted">${p.length} shown</div>
      </div>

      ${p.length===0?r`
              <div class="muted" style="margin-top: 16px">No skills found.</div>
            `:r`
              <div class="agent-skills-groups" style="margin-top: 16px;">
                ${g.map(f=>lf(f,{agentId:e.agentId,allowSet:i,usingAllowlist:a,editable:t,onToggle:e.onToggle}))}
              </div>
            `}
    </section>
  `}function lf(e,t){const n=e.id==="workspace"||e.id==="built-in";return r`
    <details class="agent-skills-group" ?open=${!n}>
      <summary class="agent-skills-header">
        <span>${e.label}</span>
        <span class="muted">${e.skills.length}</span>
      </summary>
      <div class="list skills-grid">
        ${e.skills.map(s=>cf(s,{agentId:t.agentId,allowSet:t.allowSet,usingAllowlist:t.usingAllowlist,editable:t.editable,onToggle:t.onToggle}))}
      </div>
    </details>
  `}function cf(e,t){const n=t.usingAllowlist?t.allowSet.has(e.name):!0,s=[...e.missing.bins.map(a=>`bin:${a}`),...e.missing.env.map(a=>`env:${a}`),...e.missing.config.map(a=>`config:${a}`),...e.missing.os.map(a=>`os:${a}`)],i=[];return e.disabled&&i.push("disabled"),e.blockedByAllowlist&&i.push("blocked by allowlist"),r`
    <div class="list-item agent-skill-row">
      <div class="list-main">
        <div class="list-title">
          ${e.emoji?`${e.emoji} `:""}${e.name}
        </div>
        <div class="list-sub">${e.description}</div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${e.source}</span>
          <span class="chip ${e.eligible?"chip-ok":"chip-warn"}">
            ${e.eligible?"eligible":"blocked"}
          </span>
          ${e.disabled?r`
                  <span class="chip chip-warn">disabled</span>
                `:v}
        </div>
        ${s.length>0?r`<div class="muted" style="margin-top: 6px;">Missing: ${s.join(", ")}</div>`:v}
        ${i.length>0?r`<div class="muted" style="margin-top: 6px;">Reason: ${i.join(", ")}</div>`:v}
      </div>
      <div class="list-meta">
        <label class="cfg-toggle">
          <input
            type="checkbox"
            .checked=${n}
            ?disabled=${!t.editable}
            @change=${a=>t.onToggle(t.agentId,e.name,a.target.checked)}
          />
          <span class="cfg-toggle__track"></span>
        </label>
      </div>
    </div>
  `}function ze(e){if(e)return Array.isArray(e.type)?e.type.filter(n=>n!=="null")[0]??e.type[0]:e.type}function gc(e){if(!e)return"";if(e.default!==void 0)return e.default;switch(ze(e)){case"object":return{};case"array":return[];case"boolean":return!1;case"number":case"integer":return 0;case"string":return"";default:return""}}function Cs(e){return e.filter(t=>typeof t=="string").join(".")}function Le(e,t){const n=Cs(e),s=t[n];if(s)return s;const i=n.split(".");for(const[a,o]of Object.entries(t)){if(!a.includes("*"))continue;const l=a.split(".");if(l.length!==i.length)continue;let c=!0;for(let p=0;p<i.length;p+=1)if(l[p]!=="*"&&l[p]!==i[p]){c=!1;break}if(c)return o}}function Xe(e){return e.replace(/_/g," ").replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/\s+/g," ").replace(/^./,t=>t.toUpperCase())}function df(e){const t=Cs(e).toLowerCase();return t.includes("token")||t.includes("password")||t.includes("secret")||t.includes("apikey")||t.endsWith("key")}const uf=new Set(["title","description","default","nullable"]);function pf(e){return Object.keys(e??{}).filter(n=>!uf.has(n)).length===0}function gf(e){if(e===void 0)return"";try{return JSON.stringify(e,null,2)??""}catch{return""}}const vn={chevronDown:r`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `,plus:r`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `,minus:r`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `,trash:r`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  `,edit:r`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `};function Je(e){const{schema:t,value:n,path:s,hints:i,unsupported:a,disabled:o,onPatch:l}=e,c=e.showLabel??!0,p=ze(t),g=Le(s,i),u=g?.label??t.title??Xe(String(s.at(-1))),h=g?.help??t.description,f=Cs(s);if(a.has(f))return r`<div class="cfg-field cfg-field--error">
      <div class="cfg-field__label">${u}</div>
      <div class="cfg-field__error">Unsupported schema node. Use Raw mode.</div>
    </div>`;if(t.anyOf||t.oneOf){const m=(t.anyOf??t.oneOf??[]).filter(T=>!(T.type==="null"||Array.isArray(T.type)&&T.type.includes("null")));if(m.length===1)return Je({...e,schema:m[0]});const k=T=>{if(T.const!==void 0)return T.const;if(T.enum&&T.enum.length===1)return T.enum[0]},S=m.map(k),$=S.every(T=>T!==void 0);if($&&S.length>0&&S.length<=5){const T=n??t.default;return r`
        <div class="cfg-field">
          ${c?r`<label class="cfg-field__label">${u}</label>`:v}
          ${h?r`<div class="cfg-field__help">${h}</div>`:v}
          <div class="cfg-segmented">
            ${S.map(E=>r`
              <button
                type="button"
                class="cfg-segmented__btn ${E===T||String(E)===String(T)?"active":""}"
                ?disabled=${o}
                @click=${()=>l(s,E)}
              >
                ${String(E)}
              </button>
            `)}
          </div>
        </div>
      `}if($&&S.length>5)return Zo({...e,options:S,value:n??t.default});const C=new Set(m.map(T=>ze(T)).filter(Boolean)),A=new Set([...C].map(T=>T==="integer"?"number":T));if([...A].every(T=>["string","number","boolean"].includes(T))){const T=A.has("string"),E=A.has("number");if(A.has("boolean")&&A.size===1)return Je({...e,schema:{...t,type:"boolean",anyOf:void 0,oneOf:void 0}});if(T||E)return Jo({...e,inputType:E&&!T?"number":"text"})}}if(t.enum){const d=t.enum;if(d.length<=5){const m=n??t.default;return r`
        <div class="cfg-field">
          ${c?r`<label class="cfg-field__label">${u}</label>`:v}
          ${h?r`<div class="cfg-field__help">${h}</div>`:v}
          <div class="cfg-segmented">
            ${d.map(k=>r`
              <button
                type="button"
                class="cfg-segmented__btn ${k===m||String(k)===String(m)?"active":""}"
                ?disabled=${o}
                @click=${()=>l(s,k)}
              >
                ${String(k)}
              </button>
            `)}
          </div>
        </div>
      `}return Zo({...e,options:d,value:n??t.default})}if(p==="object")return ff(e);if(p==="array")return mf(e);if(p==="boolean"){const d=typeof n=="boolean"?n:typeof t.default=="boolean"?t.default:!1;return r`
      <label class="cfg-toggle-row ${o?"disabled":""}">
        <div class="cfg-toggle-row__content">
          <span class="cfg-toggle-row__label">${u}</span>
          ${h?r`<span class="cfg-toggle-row__help">${h}</span>`:v}
        </div>
        <div class="cfg-toggle">
          <input
            type="checkbox"
            .checked=${d}
            ?disabled=${o}
            @change=${m=>l(s,m.target.checked)}
          />
          <span class="cfg-toggle__track"></span>
        </div>
      </label>
    `}return p==="number"||p==="integer"?hf(e):p==="string"?Jo({...e,inputType:"text"}):r`
    <div class="cfg-field cfg-field--error">
      <div class="cfg-field__label">${u}</div>
      <div class="cfg-field__error">Unsupported type: ${p}. Use Raw mode.</div>
    </div>
  `}function Jo(e){const{schema:t,value:n,path:s,hints:i,disabled:a,onPatch:o,inputType:l}=e,c=e.showLabel??!0,p=Le(s,i),g=p?.label??t.title??Xe(String(s.at(-1))),u=p?.help??t.description,h=p?.sensitive??df(s),f=p?.placeholder??(h?"••••":t.default!==void 0?`Default: ${String(t.default)}`:""),d=n??"";return r`
    <div class="cfg-field">
      ${c?r`<label class="cfg-field__label">${g}</label>`:v}
      ${u?r`<div class="cfg-field__help">${u}</div>`:v}
      <div class="cfg-input-wrap">
        <input
          type=${h?"password":l}
          class="cfg-input"
          placeholder=${f}
          .value=${d==null?"":String(d)}
          ?disabled=${a}
          @input=${m=>{const k=m.target.value;if(l==="number"){if(k.trim()===""){o(s,void 0);return}const S=Number(k);o(s,Number.isNaN(S)?k:S);return}o(s,k)}}
          @change=${m=>{if(l==="number")return;const k=m.target.value;o(s,k.trim())}}
        />
        ${t.default!==void 0?r`
          <button
            type="button"
            class="cfg-input__reset"
            title="Reset to default"
            ?disabled=${a}
            @click=${()=>o(s,t.default)}
          >↺</button>
        `:v}
      </div>
    </div>
  `}function hf(e){const{schema:t,value:n,path:s,hints:i,disabled:a,onPatch:o}=e,l=e.showLabel??!0,c=Le(s,i),p=c?.label??t.title??Xe(String(s.at(-1))),g=c?.help??t.description,u=n??t.default??"",h=typeof u=="number"?u:0;return r`
    <div class="cfg-field">
      ${l?r`<label class="cfg-field__label">${p}</label>`:v}
      ${g?r`<div class="cfg-field__help">${g}</div>`:v}
      <div class="cfg-number">
        <button
          type="button"
          class="cfg-number__btn"
          ?disabled=${a}
          @click=${()=>o(s,h-1)}
        >−</button>
        <input
          type="number"
          class="cfg-number__input"
          .value=${u==null?"":String(u)}
          ?disabled=${a}
          @input=${f=>{const d=f.target.value,m=d===""?void 0:Number(d);o(s,m)}}
        />
        <button
          type="button"
          class="cfg-number__btn"
          ?disabled=${a}
          @click=${()=>o(s,h+1)}
        >+</button>
      </div>
    </div>
  `}function Zo(e){const{schema:t,value:n,path:s,hints:i,disabled:a,options:o,onPatch:l}=e,c=e.showLabel??!0,p=Le(s,i),g=p?.label??t.title??Xe(String(s.at(-1))),u=p?.help??t.description,h=n??t.default,f=o.findIndex(m=>m===h||String(m)===String(h)),d="__unset__";return r`
    <div class="cfg-field">
      ${c?r`<label class="cfg-field__label">${g}</label>`:v}
      ${u?r`<div class="cfg-field__help">${u}</div>`:v}
      <select
        class="cfg-select"
        ?disabled=${a}
        .value=${f>=0?String(f):d}
        @change=${m=>{const k=m.target.value;l(s,k===d?void 0:o[Number(k)])}}
      >
        <option value=${d}>Select...</option>
        ${o.map((m,k)=>r`
          <option value=${String(k)}>${String(m)}</option>
        `)}
      </select>
    </div>
  `}function ff(e){const{schema:t,value:n,path:s,hints:i,unsupported:a,disabled:o,onPatch:l}=e,c=Le(s,i),p=c?.label??t.title??Xe(String(s.at(-1))),g=c?.help??t.description,u=n??t.default,h=u&&typeof u=="object"&&!Array.isArray(u)?u:{},f=t.properties??{},m=Object.entries(f).toSorted((C,A)=>{const T=Le([...s,C[0]],i)?.order??0,E=Le([...s,A[0]],i)?.order??0;return T!==E?T-E:C[0].localeCompare(A[0])}),k=new Set(Object.keys(f)),S=t.additionalProperties,$=!!S&&typeof S=="object";return s.length===1?r`
      <div class="cfg-fields">
        ${m.map(([C,A])=>Je({schema:A,value:h[C],path:[...s,C],hints:i,unsupported:a,disabled:o,onPatch:l}))}
        ${$?Xo({schema:S,value:h,path:s,hints:i,unsupported:a,disabled:o,reservedKeys:k,onPatch:l}):v}
      </div>
    `:r`
    <details class="cfg-object" open>
      <summary class="cfg-object__header">
        <span class="cfg-object__title">${p}</span>
        <span class="cfg-object__chevron">${vn.chevronDown}</span>
      </summary>
      ${g?r`<div class="cfg-object__help">${g}</div>`:v}
      <div class="cfg-object__content">
        ${m.map(([C,A])=>Je({schema:A,value:h[C],path:[...s,C],hints:i,unsupported:a,disabled:o,onPatch:l}))}
        ${$?Xo({schema:S,value:h,path:s,hints:i,unsupported:a,disabled:o,reservedKeys:k,onPatch:l}):v}
      </div>
    </details>
  `}function mf(e){const{schema:t,value:n,path:s,hints:i,unsupported:a,disabled:o,onPatch:l}=e,c=e.showLabel??!0,p=Le(s,i),g=p?.label??t.title??Xe(String(s.at(-1))),u=p?.help??t.description,h=Array.isArray(t.items)?t.items[0]:t.items;if(!h)return r`
      <div class="cfg-field cfg-field--error">
        <div class="cfg-field__label">${g}</div>
        <div class="cfg-field__error">Unsupported array schema. Use Raw mode.</div>
      </div>
    `;const f=Array.isArray(n)?n:Array.isArray(t.default)?t.default:[];return r`
    <div class="cfg-array">
      <div class="cfg-array__header">
        ${c?r`<span class="cfg-array__label">${g}</span>`:v}
        <span class="cfg-array__count">${f.length} item${f.length!==1?"s":""}</span>
        <button
          type="button"
          class="cfg-array__add"
          ?disabled=${o}
          @click=${()=>{const d=[...f,gc(h)];l(s,d)}}
        >
          <span class="cfg-array__add-icon">${vn.plus}</span>
          Add
        </button>
      </div>
      ${u?r`<div class="cfg-array__help">${u}</div>`:v}

      ${f.length===0?r`
              <div class="cfg-array__empty">No items yet. Click "Add" to create one.</div>
            `:r`
        <div class="cfg-array__items">
          ${f.map((d,m)=>r`
            <div class="cfg-array__item">
              <div class="cfg-array__item-header">
                <span class="cfg-array__item-index">#${m+1}</span>
                <button
                  type="button"
                  class="cfg-array__item-remove"
                  title="Remove item"
                  ?disabled=${o}
                  @click=${()=>{const k=[...f];k.splice(m,1),l(s,k)}}
                >
                  ${vn.trash}
                </button>
              </div>
              <div class="cfg-array__item-content">
                ${Je({schema:h,value:d,path:[...s,m],hints:i,unsupported:a,disabled:o,showLabel:!1,onPatch:l})}
              </div>
            </div>
          `)}
        </div>
      `}
    </div>
  `}function Xo(e){const{schema:t,value:n,path:s,hints:i,unsupported:a,disabled:o,reservedKeys:l,onPatch:c}=e,p=pf(t),g=Object.entries(n??{}).filter(([u])=>!l.has(u));return r`
    <div class="cfg-map">
      <div class="cfg-map__header">
        <span class="cfg-map__label">Custom entries</span>
        <button
          type="button"
          class="cfg-map__add"
          ?disabled=${o}
          @click=${()=>{const u={...n};let h=1,f=`custom-${h}`;for(;f in u;)h+=1,f=`custom-${h}`;u[f]=p?{}:gc(t),c(s,u)}}
        >
          <span class="cfg-map__add-icon">${vn.plus}</span>
          Add Entry
        </button>
      </div>

      ${g.length===0?r`
              <div class="cfg-map__empty">No custom entries.</div>
            `:r`
        <div class="cfg-map__items">
          ${g.map(([u,h])=>{const f=[...s,u],d=gf(h);return r`
              <div class="cfg-map__item">
                <div class="cfg-map__item-key">
                  <input
                    type="text"
                    class="cfg-input cfg-input--sm"
                    placeholder="Key"
                    .value=${u}
                    ?disabled=${o}
                    @change=${m=>{const k=m.target.value.trim();if(!k||k===u)return;const S={...n};k in S||(S[k]=S[u],delete S[u],c(s,S))}}
                  />
                </div>
                <div class="cfg-map__item-value">
                  ${p?r`
                        <textarea
                          class="cfg-textarea cfg-textarea--sm"
                          placeholder="JSON value"
                          rows="2"
                          .value=${d}
                          ?disabled=${o}
                          @change=${m=>{const k=m.target,S=k.value.trim();if(!S){c(f,void 0);return}try{c(f,JSON.parse(S))}catch{k.value=d}}}
                        ></textarea>
                      `:Je({schema:t,value:h,path:f,hints:i,unsupported:a,disabled:o,showLabel:!1,onPatch:c})}
                </div>
                <button
                  type="button"
                  class="cfg-map__item-remove"
                  title="Remove entry"
                  ?disabled=${o}
                  @click=${()=>{const m={...n};delete m[u],c(s,m)}}
                >
                  ${vn.trash}
                </button>
              </div>
            `})}
        </div>
      `}
    </div>
  `}const er={env:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="3"></circle>
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      ></path>
    </svg>
  `,update:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `,agents:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path
        d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"
      ></path>
      <circle cx="8" cy="14" r="1"></circle>
      <circle cx="16" cy="14" r="1"></circle>
    </svg>
  `,auth:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  `,channels:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `,messages:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
  `,commands:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <polyline points="4 17 10 11 4 5"></polyline>
      <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
  `,hooks:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
  `,skills:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
      ></polygon>
    </svg>
  `,tools:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      ></path>
    </svg>
  `,gateway:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      ></path>
    </svg>
  `,wizard:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M15 4V2"></path>
      <path d="M15 16v-2"></path>
      <path d="M8 9h2"></path>
      <path d="M20 9h2"></path>
      <path d="M17.8 11.8 19 13"></path>
      <path d="M15 9h0"></path>
      <path d="M17.8 6.2 19 5"></path>
      <path d="m3 21 9-9"></path>
      <path d="M12.2 6.2 11 5"></path>
    </svg>
  `,meta:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>
  `,logging:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  `,browser:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="4"></circle>
      <line x1="21.17" y1="8" x2="12" y2="8"></line>
      <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
      <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
    </svg>
  `,ui:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="9" y1="21" x2="9" y2="9"></line>
    </svg>
  `,models:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
      ></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  `,bindings:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
      <line x1="6" y1="6" x2="6.01" y2="6"></line>
      <line x1="6" y1="18" x2="6.01" y2="18"></line>
    </svg>
  `,broadcast:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
      <circle cx="12" cy="12" r="2"></circle>
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path>
    </svg>
  `,audio:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  `,session:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  `,cron:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  `,web:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      ></path>
    </svg>
  `,discovery:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  `,canvasHost:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  `,talk:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
  `,plugins:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2v6"></path>
      <path d="m4.93 10.93 4.24 4.24"></path>
      <path d="M2 12h6"></path>
      <path d="m4.93 13.07 4.24-4.24"></path>
      <path d="M12 22v-6"></path>
      <path d="m19.07 13.07-4.24-4.24"></path>
      <path d="M22 12h-6"></path>
      <path d="m19.07 10.93-4.24 4.24"></path>
    </svg>
  `,default:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  `},Ea={env:{label:"Environment Variables",description:"Environment variables passed to the gateway process"},update:{label:"Updates",description:"Auto-update settings and release channel"},agents:{label:"Agents",description:"Agent configurations, models, and identities"},auth:{label:"Authentication",description:"API keys and authentication profiles"},channels:{label:"Channels",description:"Messaging channels (Telegram, Discord, Slack, etc.)"},messages:{label:"Messages",description:"Message handling and routing settings"},commands:{label:"Commands",description:"Custom slash commands"},hooks:{label:"Hooks",description:"Webhooks and event hooks"},skills:{label:"Skills",description:"Skill packs and capabilities"},tools:{label:"Tools",description:"Tool configurations (browser, search, etc.)"},gateway:{label:"Gateway",description:"Gateway server settings (port, auth, binding)"},wizard:{label:"Setup Wizard",description:"Setup wizard state and history"},meta:{label:"Metadata",description:"Gateway metadata and version information"},logging:{label:"Logging",description:"Log levels and output configuration"},browser:{label:"Browser",description:"Browser automation settings"},ui:{label:"UI",description:"User interface preferences"},models:{label:"Models",description:"AI model configurations and providers"},bindings:{label:"Bindings",description:"Key bindings and shortcuts"},broadcast:{label:"Broadcast",description:"Broadcast and notification settings"},audio:{label:"Audio",description:"Audio input/output settings"},session:{label:"Session",description:"Session management and persistence"},cron:{label:"Cron",description:"Scheduled tasks and automation"},web:{label:"Web",description:"Web server and API settings"},discovery:{label:"Discovery",description:"Service discovery and networking"},canvasHost:{label:"Canvas Host",description:"Canvas rendering and display"},talk:{label:"Talk",description:"Voice and speech settings"},plugins:{label:"Plugins",description:"Plugin management and extensions"}};function tr(e){return er[e]??er.default}function vf(e,t,n){if(!n)return!0;const s=n.toLowerCase(),i=Ea[e];return e.toLowerCase().includes(s)||i&&(i.label.toLowerCase().includes(s)||i.description.toLowerCase().includes(s))?!0:an(t,s)}function an(e,t){if(e.title?.toLowerCase().includes(t)||e.description?.toLowerCase().includes(t)||e.enum?.some(s=>String(s).toLowerCase().includes(t)))return!0;if(e.properties){for(const[s,i]of Object.entries(e.properties))if(s.toLowerCase().includes(t)||an(i,t))return!0}if(e.items){const s=Array.isArray(e.items)?e.items:[e.items];for(const i of s)if(i&&an(i,t))return!0}if(e.additionalProperties&&typeof e.additionalProperties=="object"&&an(e.additionalProperties,t))return!0;const n=e.anyOf??e.oneOf??e.allOf;if(n){for(const s of n)if(s&&an(s,t))return!0}return!1}function bf(e){if(!e.schema)return r`
      <div class="muted">Schema unavailable.</div>
    `;const t=e.schema,n=e.value??{};if(ze(t)!=="object"||!t.properties)return r`
      <div class="callout danger">Unsupported schema. Use Raw.</div>
    `;const s=new Set(e.unsupportedPaths??[]),i=t.properties,a=e.searchQuery??"",o=e.activeSection,l=e.activeSubsection??null,p=Object.entries(i).toSorted((u,h)=>{const f=Le([u[0]],e.uiHints)?.order??50,d=Le([h[0]],e.uiHints)?.order??50;return f!==d?f-d:u[0].localeCompare(h[0])}).filter(([u,h])=>!(o&&u!==o||a&&!vf(u,h,a)));let g=null;if(o&&l&&p.length===1){const u=p[0]?.[1];u&&ze(u)==="object"&&u.properties&&u.properties[l]&&(g={sectionKey:o,subsectionKey:l,schema:u.properties[l]})}return p.length===0?r`
      <div class="config-empty">
        <div class="config-empty__icon">${pe.search}</div>
        <div class="config-empty__text">
          ${a?`No settings match "${a}"`:"No settings in this section"}
        </div>
      </div>
    `:r`
    <div class="config-form config-form--modern">
      ${g?(()=>{const{sectionKey:u,subsectionKey:h,schema:f}=g,d=Le([u,h],e.uiHints),m=d?.label??f.title??Xe(h),k=d?.help??f.description??"",S=n[u],$=S&&typeof S=="object"?S[h]:void 0,C=`config-section-${u}-${h}`;return r`
              <section class="config-section-card" id=${C}>
                <div class="config-section-card__header">
                  <span class="config-section-card__icon">${tr(u)}</span>
                  <div class="config-section-card__titles">
                    <h3 class="config-section-card__title">${m}</h3>
                    ${k?r`<p class="config-section-card__desc">${k}</p>`:v}
                  </div>
                </div>
                <div class="config-section-card__content">
                  ${Je({schema:f,value:$,path:[u,h],hints:e.uiHints,unsupported:s,disabled:e.disabled??!1,showLabel:!1,onPatch:e.onPatch})}
                </div>
              </section>
            `})():p.map(([u,h])=>{const f=Ea[u]??{label:u.charAt(0).toUpperCase()+u.slice(1),description:h.description??""};return r`
              <section class="config-section-card" id="config-section-${u}">
                <div class="config-section-card__header">
                  <span class="config-section-card__icon">${tr(u)}</span>
                  <div class="config-section-card__titles">
                    <h3 class="config-section-card__title">${f.label}</h3>
                    ${f.description?r`<p class="config-section-card__desc">${f.description}</p>`:v}
                  </div>
                </div>
                <div class="config-section-card__content">
                  ${Je({schema:h,value:n[u],path:[u],hints:e.uiHints,unsupported:s,disabled:e.disabled??!1,showLabel:!1,onPatch:e.onPatch})}
                </div>
              </section>
            `})}
    </div>
  `}const yf=new Set(["title","description","default","nullable"]);function xf(e){return Object.keys(e??{}).filter(n=>!yf.has(n)).length===0}function hc(e){const t=e.filter(i=>i!=null),n=t.length!==e.length,s=[];for(const i of t)s.some(a=>Object.is(a,i))||s.push(i);return{enumValues:s,nullable:n}}function fc(e){return!e||typeof e!="object"?{schema:null,unsupportedPaths:["<root>"]}:un(e,[])}function un(e,t){const n=new Set,s={...e},i=Cs(t)||"<root>";if(e.anyOf||e.oneOf||e.allOf){const l=wf(e,t);return l||{schema:e,unsupportedPaths:[i]}}const a=Array.isArray(e.type)&&e.type.includes("null"),o=ze(e)??(e.properties||e.additionalProperties?"object":void 0);if(s.type=o??e.type,s.nullable=a||e.nullable,s.enum){const{enumValues:l,nullable:c}=hc(s.enum);s.enum=l,c&&(s.nullable=!0),l.length===0&&n.add(i)}if(o==="object"){const l=e.properties??{},c={};for(const[p,g]of Object.entries(l)){const u=un(g,[...t,p]);u.schema&&(c[p]=u.schema);for(const h of u.unsupportedPaths)n.add(h)}if(s.properties=c,e.additionalProperties===!0)n.add(i);else if(e.additionalProperties===!1)s.additionalProperties=!1;else if(e.additionalProperties&&typeof e.additionalProperties=="object"&&!xf(e.additionalProperties)){const p=un(e.additionalProperties,[...t,"*"]);s.additionalProperties=p.schema??e.additionalProperties,p.unsupportedPaths.length>0&&n.add(i)}}else if(o==="array"){const l=Array.isArray(e.items)?e.items[0]:e.items;if(!l)n.add(i);else{const c=un(l,[...t,"*"]);s.items=c.schema??l,c.unsupportedPaths.length>0&&n.add(i)}}else o!=="string"&&o!=="number"&&o!=="integer"&&o!=="boolean"&&!s.enum&&n.add(i);return{schema:s,unsupportedPaths:Array.from(n)}}function wf(e,t){if(e.allOf)return null;const n=e.anyOf??e.oneOf;if(!n)return null;const s=[],i=[];let a=!1;for(const l of n){if(!l||typeof l!="object")return null;if(Array.isArray(l.enum)){const{enumValues:c,nullable:p}=hc(l.enum);s.push(...c),p&&(a=!0);continue}if("const"in l){if(l.const==null){a=!0;continue}s.push(l.const);continue}if(ze(l)==="null"){a=!0;continue}i.push(l)}if(s.length>0&&i.length===0){const l=[];for(const c of s)l.some(p=>Object.is(p,c))||l.push(c);return{schema:{...e,enum:l,nullable:a,anyOf:void 0,oneOf:void 0,allOf:void 0},unsupportedPaths:[]}}if(i.length===1){const l=un(i[0],t);return l.schema&&(l.schema.nullable=a||l.schema.nullable),l}const o=new Set(["string","number","integer","boolean"]);return i.length>0&&s.length===0&&i.every(l=>l.type&&o.has(String(l.type)))?{schema:{...e,nullable:a},unsupportedPaths:[]}:null}function $f(e,t){let n=e;for(const s of t){if(!n)return null;const i=ze(n);if(i==="object"){const a=n.properties??{};if(typeof s=="string"&&a[s]){n=a[s];continue}const o=n.additionalProperties;if(typeof s=="string"&&o&&typeof o=="object"){n=o;continue}return null}if(i==="array"){if(typeof s!="number")return null;n=(Array.isArray(n.items)?n.items[0]:n.items)??null;continue}return null}return n}function kf(e,t){const s=(e.channels??{})[t],i=e[t];return(s&&typeof s=="object"?s:null)??(i&&typeof i=="object"?i:null)??{}}const Sf=["groupPolicy","streamMode","dmPolicy"];function Af(e){if(e==null)return"n/a";if(typeof e=="string"||typeof e=="number"||typeof e=="boolean")return String(e);try{return JSON.stringify(e)}catch{return"n/a"}}function Cf(e){const t=Sf.flatMap(n=>n in e?[[n,e[n]]]:[]);return t.length===0?null:r`
    <div class="status-list" style="margin-top: 12px;">
      ${t.map(([n,s])=>r`
          <div>
            <span class="label">${n}</span>
            <span>${Af(s)}</span>
          </div>
        `)}
    </div>
  `}function Tf(e){const t=fc(e.schema),n=t.schema;if(!n)return r`
      <div class="callout danger">Schema unavailable. Use Raw.</div>
    `;const s=$f(n,["channels",e.channelId]);if(!s)return r`
      <div class="callout danger">Channel config schema unavailable.</div>
    `;const i=e.configValue??{},a=kf(i,e.channelId);return r`
    <div class="config-form">
      ${Je({schema:s,value:a,path:["channels",e.channelId],hints:e.uiHints,unsupported:new Set(t.unsupportedPaths),disabled:e.disabled,showLabel:!1,onPatch:e.onPatch})}
    </div>
    ${Cf(a)}
  `}function et(e){const{channelId:t,props:n}=e,s=n.configSaving||n.configSchemaLoading;return r`
    <div style="margin-top: 16px;">
      ${n.configSchemaLoading?r`
              <div class="muted">Loading config schema…</div>
            `:Tf({channelId:t,configValue:n.configForm,schema:n.configSchema,uiHints:n.configUiHints,disabled:s,onPatch:n.onConfigPatch})}
      <div class="row" style="margin-top: 12px;">
        <button
          class="btn primary"
          ?disabled=${s||!n.configFormDirty}
          @click=${()=>n.onConfigSave()}
        >
          ${n.configSaving?"Saving…":"Save"}
        </button>
        <button
          class="btn"
          ?disabled=${s}
          @click=${()=>n.onConfigReload()}
        >
          Reload
        </button>
      </div>
    </div>
  `}function _f(e){const{props:t,discord:n,accountCountLabel:s}=e;return r`
    <div class="card">
      <div class="card-title">Discord</div>
      <div class="card-sub">Bot status and channel configuration.</div>
      ${s}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${n?.configured?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${n?.running?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${n?.lastStartAt?Y(n.lastStartAt):"n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${n?.lastProbeAt?Y(n.lastProbeAt):"n/a"}</span>
        </div>
      </div>

      ${n?.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${n.lastError}
          </div>`:v}

      ${n?.probe?r`<div class="callout" style="margin-top: 12px;">
            Probe ${n.probe.ok?"ok":"failed"} ·
            ${n.probe.status??""} ${n.probe.error??""}
          </div>`:v}

      ${et({channelId:"discord",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function Ef(e){const{props:t,googleChat:n,accountCountLabel:s}=e;return r`
    <div class="card">
      <div class="card-title">Google Chat</div>
      <div class="card-sub">Chat API webhook status and channel configuration.</div>
      ${s}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${n?n.configured?"Yes":"No":"n/a"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${n?n.running?"Yes":"No":"n/a"}</span>
        </div>
        <div>
          <span class="label">Credential</span>
          <span>${n?.credentialSource??"n/a"}</span>
        </div>
        <div>
          <span class="label">Audience</span>
          <span>
            ${n?.audienceType?`${n.audienceType}${n.audience?` · ${n.audience}`:""}`:"n/a"}
          </span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${n?.lastStartAt?Y(n.lastStartAt):"n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${n?.lastProbeAt?Y(n.lastProbeAt):"n/a"}</span>
        </div>
      </div>

      ${n?.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${n.lastError}
          </div>`:v}

      ${n?.probe?r`<div class="callout" style="margin-top: 12px;">
            Probe ${n.probe.ok?"ok":"failed"} ·
            ${n.probe.status??""} ${n.probe.error??""}
          </div>`:v}

      ${et({channelId:"googlechat",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function Lf(e){const{props:t,imessage:n,accountCountLabel:s}=e;return r`
    <div class="card">
      <div class="card-title">iMessage</div>
      <div class="card-sub">macOS bridge status and channel configuration.</div>
      ${s}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${n?.configured?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${n?.running?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${n?.lastStartAt?Y(n.lastStartAt):"n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${n?.lastProbeAt?Y(n.lastProbeAt):"n/a"}</span>
        </div>
      </div>

      ${n?.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${n.lastError}
          </div>`:v}

      ${n?.probe?r`<div class="callout" style="margin-top: 12px;">
            Probe ${n.probe.ok?"ok":"failed"} ·
            ${n.probe.error??""}
          </div>`:v}

      ${et({channelId:"imessage",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function nr(e){return e?e.length<=20?e:`${e.slice(0,8)}...${e.slice(-8)}`:"n/a"}function If(e){const{props:t,nostr:n,nostrAccounts:s,accountCountLabel:i,profileFormState:a,profileFormCallbacks:o,onEditProfile:l}=e,c=s[0],p=n?.configured??c?.configured??!1,g=n?.running??c?.running??!1,u=n?.publicKey??c?.publicKey,h=n?.lastStartAt??c?.lastStartAt??null,f=n?.lastError??c?.lastError??null,d=s.length>1,m=a!=null,k=$=>{const C=$.publicKey,A=$.profile,T=A?.displayName??A?.name??$.name??$.accountId;return r`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">${T}</div>
          <div class="account-card-id">${$.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">Running</span>
            <span>${$.running?"Yes":"No"}</span>
          </div>
          <div>
            <span class="label">Configured</span>
            <span>${$.configured?"Yes":"No"}</span>
          </div>
          <div>
            <span class="label">Public Key</span>
            <span class="monospace" title="${C??""}">${nr(C)}</span>
          </div>
          <div>
            <span class="label">Last inbound</span>
            <span>${$.lastInboundAt?Y($.lastInboundAt):"n/a"}</span>
          </div>
          ${$.lastError?r`
                <div class="account-card-error">${$.lastError}</div>
              `:v}
        </div>
      </div>
    `},S=()=>{if(m&&o)return jd({state:a,callbacks:o,accountId:s[0]?.accountId??"default"});const $=c?.profile??n?.profile,{name:C,displayName:A,about:T,picture:E,nip05:M}=$??{},V=C||A||T||E||M;return r`
      <div style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-weight: 500;">Profile</div>
          ${p?r`
                <button
                  class="btn btn-sm"
                  @click=${l}
                  style="font-size: 12px; padding: 4px 8px;"
                >
                  Edit Profile
                </button>
              `:v}
        </div>
        ${V?r`
              <div class="status-list">
                ${E?r`
                      <div style="margin-bottom: 8px;">
                        <img
                          src=${E}
                          alt="Profile picture"
                          style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);"
                          @error=${K=>{K.target.style.display="none"}}
                        />
                      </div>
                    `:v}
                ${C?r`<div><span class="label">Name</span><span>${C}</span></div>`:v}
                ${A?r`<div><span class="label">Display Name</span><span>${A}</span></div>`:v}
                ${T?r`<div><span class="label">About</span><span style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${T}</span></div>`:v}
                ${M?r`<div><span class="label">NIP-05</span><span>${M}</span></div>`:v}
              </div>
            `:r`
                <div style="color: var(--text-muted); font-size: 13px">
                  No profile set. Click "Edit Profile" to add your name, bio, and avatar.
                </div>
              `}
      </div>
    `};return r`
    <div class="card">
      <div class="card-title">Nostr</div>
      <div class="card-sub">Decentralized DMs via Nostr relays (NIP-04).</div>
      ${i}

      ${d?r`
            <div class="account-card-list">
              ${s.map($=>k($))}
            </div>
          `:r`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">Configured</span>
                <span>${p?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${g?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Public Key</span>
                <span class="monospace" title="${u??""}"
                  >${nr(u)}</span
                >
              </div>
              <div>
                <span class="label">Last start</span>
                <span>${h?Y(h):"n/a"}</span>
              </div>
            </div>
          `}

      ${f?r`<div class="callout danger" style="margin-top: 12px;">${f}</div>`:v}

      ${S()}

      ${et({channelId:"nostr",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!1)}>Refresh</button>
      </div>
    </div>
  `}function Mf(e,t){const n=t.snapshot,s=n?.channels;if(!n||!s)return!1;const i=s[e],a=typeof i?.configured=="boolean"&&i.configured,o=typeof i?.running=="boolean"&&i.running,l=typeof i?.connected=="boolean"&&i.connected,p=(n.channelAccounts?.[e]??[]).some(g=>g.configured||g.running||g.connected);return a||o||l||p}function Rf(e,t){return t?.[e]?.length??0}function mc(e,t){const n=Rf(e,t);return n<2?v:r`<div class="account-count">Accounts (${n})</div>`}function Pf(e){const{props:t,signal:n,accountCountLabel:s}=e;return r`
    <div class="card">
      <div class="card-title">Signal</div>
      <div class="card-sub">signal-cli status and channel configuration.</div>
      ${s}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${n?.configured?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${n?.running?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Base URL</span>
          <span>${n?.baseUrl??"n/a"}</span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${n?.lastStartAt?Y(n.lastStartAt):"n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${n?.lastProbeAt?Y(n.lastProbeAt):"n/a"}</span>
        </div>
      </div>

      ${n?.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${n.lastError}
          </div>`:v}

      ${n?.probe?r`<div class="callout" style="margin-top: 12px;">
            Probe ${n.probe.ok?"ok":"failed"} ·
            ${n.probe.status??""} ${n.probe.error??""}
          </div>`:v}

      ${et({channelId:"signal",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function Df(e){const{props:t,slack:n,accountCountLabel:s}=e;return r`
    <div class="card">
      <div class="card-title">Slack</div>
      <div class="card-sub">Socket mode status and channel configuration.</div>
      ${s}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${n?.configured?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${n?.running?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${n?.lastStartAt?Y(n.lastStartAt):"n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${n?.lastProbeAt?Y(n.lastProbeAt):"n/a"}</span>
        </div>
      </div>

      ${n?.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${n.lastError}
          </div>`:v}

      ${n?.probe?r`<div class="callout" style="margin-top: 12px;">
            Probe ${n.probe.ok?"ok":"failed"} ·
            ${n.probe.status??""} ${n.probe.error??""}
          </div>`:v}

      ${et({channelId:"slack",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function Ff(e){const{props:t,telegram:n,telegramAccounts:s,accountCountLabel:i}=e,a=s.length>1,o=l=>{const p=l.probe?.bot?.username,g=l.name||l.accountId;return r`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${p?`@${p}`:g}
          </div>
          <div class="account-card-id">${l.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">Running</span>
            <span>${l.running?"Yes":"No"}</span>
          </div>
          <div>
            <span class="label">Configured</span>
            <span>${l.configured?"Yes":"No"}</span>
          </div>
          <div>
            <span class="label">Last inbound</span>
            <span>${l.lastInboundAt?Y(l.lastInboundAt):"n/a"}</span>
          </div>
          ${l.lastError?r`
                <div class="account-card-error">
                  ${l.lastError}
                </div>
              `:v}
        </div>
      </div>
    `};return r`
    <div class="card">
      <div class="card-title">Telegram</div>
      <div class="card-sub">Bot status and channel configuration.</div>
      ${i}

      ${a?r`
            <div class="account-card-list">
              ${s.map(l=>o(l))}
            </div>
          `:r`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">Configured</span>
                <span>${n?.configured?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${n?.running?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Mode</span>
                <span>${n?.mode??"n/a"}</span>
              </div>
              <div>
                <span class="label">Last start</span>
                <span>${n?.lastStartAt?Y(n.lastStartAt):"n/a"}</span>
              </div>
              <div>
                <span class="label">Last probe</span>
                <span>${n?.lastProbeAt?Y(n.lastProbeAt):"n/a"}</span>
              </div>
            </div>
          `}

      ${n?.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${n.lastError}
          </div>`:v}

      ${n?.probe?r`<div class="callout" style="margin-top: 12px;">
            Probe ${n.probe.ok?"ok":"failed"} ·
            ${n.probe.status??""} ${n.probe.error??""}
          </div>`:v}

      ${et({channelId:"telegram",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function Nf(e){const{props:t,whatsapp:n,accountCountLabel:s}=e;return r`
    <div class="card">
      <div class="card-title">WhatsApp</div>
      <div class="card-sub">Link WhatsApp Web and monitor connection health.</div>
      ${s}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${n?.configured?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Linked</span>
          <span>${n?.linked?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${n?.running?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Connected</span>
          <span>${n?.connected?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Last connect</span>
          <span>
            ${n?.lastConnectedAt?Y(n.lastConnectedAt):"n/a"}
          </span>
        </div>
        <div>
          <span class="label">Last message</span>
          <span>
            ${n?.lastMessageAt?Y(n.lastMessageAt):"n/a"}
          </span>
        </div>
        <div>
          <span class="label">Auth age</span>
          <span>
            ${n?.authAgeMs!=null?la(n.authAgeMs):"n/a"}
          </span>
        </div>
      </div>

      ${n?.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${n.lastError}
          </div>`:v}

      ${t.whatsappMessage?r`<div class="callout" style="margin-top: 12px;">
            ${t.whatsappMessage}
          </div>`:v}

      ${t.whatsappQrDataUrl?r`<div class="qr-wrap">
            <img src=${t.whatsappQrDataUrl} alt="WhatsApp QR" />
          </div>`:v}

      <div class="row" style="margin-top: 14px; flex-wrap: wrap;">
        <button
          class="btn primary"
          ?disabled=${t.whatsappBusy}
          @click=${()=>t.onWhatsAppStart(!1)}
        >
          ${t.whatsappBusy?"Working…":"Show QR"}
        </button>
        <button
          class="btn"
          ?disabled=${t.whatsappBusy}
          @click=${()=>t.onWhatsAppStart(!0)}
        >
          Relink
        </button>
        <button
          class="btn"
          ?disabled=${t.whatsappBusy}
          @click=${()=>t.onWhatsAppWait()}
        >
          Wait for scan
        </button>
        <button
          class="btn danger"
          ?disabled=${t.whatsappBusy}
          @click=${()=>t.onWhatsAppLogout()}
        >
          Logout
        </button>
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Refresh
        </button>
      </div>

      ${et({channelId:"whatsapp",props:t})}
    </div>
  `}function Of(e){const t=e.snapshot?.channels,n=t?.whatsapp??void 0,s=t?.telegram??void 0,i=t?.discord??null,a=t?.googlechat??null,o=t?.slack??null,l=t?.signal??null,c=t?.imessage??null,p=t?.nostr??null,u=Bf(e.snapshot).map((h,f)=>({key:h,enabled:Mf(h,e),order:f})).toSorted((h,f)=>h.enabled!==f.enabled?h.enabled?-1:1:h.order-f.order);return r`
    <section class="grid grid-cols-2">
      ${u.map(h=>Uf(h.key,e,{whatsapp:n,telegram:s,discord:i,googlechat:a,slack:o,signal:l,imessage:c,nostr:p,channelAccounts:e.snapshot?.channelAccounts??null}))}
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Channel health</div>
          <div class="card-sub">Channel status snapshots from the gateway.</div>
        </div>
        <div class="muted">${e.lastSuccessAt?Y(e.lastSuccessAt):"n/a"}</div>
      </div>
      ${e.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${e.lastError}
          </div>`:v}
      <pre class="code-block" style="margin-top: 12px;">
${e.snapshot?JSON.stringify(e.snapshot,null,2):"No snapshot yet."}
      </pre>
    </section>
  `}function Bf(e){return e?.channelMeta?.length?e.channelMeta.map(t=>t.id):e?.channelOrder?.length?e.channelOrder:["whatsapp","telegram","discord","googlechat","slack","signal","imessage","nostr"]}function Uf(e,t,n){const s=mc(e,n.channelAccounts);switch(e){case"whatsapp":return Nf({props:t,whatsapp:n.whatsapp,accountCountLabel:s});case"telegram":return Ff({props:t,telegram:n.telegram,telegramAccounts:n.channelAccounts?.telegram??[],accountCountLabel:s});case"discord":return _f({props:t,discord:n.discord,accountCountLabel:s});case"googlechat":return Ef({props:t,googleChat:n.googlechat,accountCountLabel:s});case"slack":return Df({props:t,slack:n.slack,accountCountLabel:s});case"signal":return Pf({props:t,signal:n.signal,accountCountLabel:s});case"imessage":return Lf({props:t,imessage:n.imessage,accountCountLabel:s});case"nostr":{const i=n.channelAccounts?.nostr??[],a=i[0],o=a?.accountId??"default",l=a?.profile??null,c=t.nostrProfileAccountId===o?t.nostrProfileFormState:null,p=c?{onFieldChange:t.onNostrProfileFieldChange,onSave:t.onNostrProfileSave,onImport:t.onNostrProfileImport,onCancel:t.onNostrProfileCancel,onToggleAdvanced:t.onNostrProfileToggleAdvanced}:null;return If({props:t,nostr:n.nostr,nostrAccounts:i,accountCountLabel:s,profileFormState:c,profileFormCallbacks:p,onEditProfile:()=>t.onNostrProfileEdit(o,l)})}default:return Hf(e,t,n.channelAccounts??{})}}function Hf(e,t,n){const s=jf(t.snapshot,e),i=t.snapshot?.channels?.[e],a=typeof i?.configured=="boolean"?i.configured:void 0,o=typeof i?.running=="boolean"?i.running:void 0,l=typeof i?.connected=="boolean"?i.connected:void 0,c=typeof i?.lastError=="string"?i.lastError:void 0,p=n[e]??[],g=mc(e,n);return r`
    <div class="card">
      <div class="card-title">${s}</div>
      <div class="card-sub">Channel status and configuration.</div>
      ${g}

      ${p.length>0?r`
            <div class="account-card-list">
              ${p.map(u=>qf(u))}
            </div>
          `:r`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">Configured</span>
                <span>${a==null?"n/a":a?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${o==null?"n/a":o?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Connected</span>
                <span>${l==null?"n/a":l?"Yes":"No"}</span>
              </div>
            </div>
          `}

      ${c?r`<div class="callout danger" style="margin-top: 12px;">
            ${c}
          </div>`:v}

      ${et({channelId:e,props:t})}
    </div>
  `}function zf(e){return e?.channelMeta?.length?Object.fromEntries(e.channelMeta.map(t=>[t.id,t])):{}}function jf(e,t){return zf(e)[t]?.label??e?.channelLabels?.[t]??t}const Kf=600*1e3;function vc(e){return e.lastInboundAt?Date.now()-e.lastInboundAt<Kf:!1}function Vf(e){return e.running?"Yes":vc(e)?"Active":"No"}function Wf(e){return e.connected===!0?"Yes":e.connected===!1?"No":vc(e)?"Active":"n/a"}function qf(e){const t=Vf(e),n=Wf(e);return r`
    <div class="account-card">
      <div class="account-card-header">
        <div class="account-card-title">${e.name||e.accountId}</div>
        <div class="account-card-id">${e.accountId}</div>
      </div>
      <div class="status-list account-card-status">
        <div>
          <span class="label">Running</span>
          <span>${t}</span>
        </div>
        <div>
          <span class="label">Configured</span>
          <span>${e.configured?"Yes":"No"}</span>
        </div>
        <div>
          <span class="label">Connected</span>
          <span>${n}</span>
        </div>
        <div>
          <span class="label">Last inbound</span>
          <span>${e.lastInboundAt?Y(e.lastInboundAt):"n/a"}</span>
        </div>
        ${e.lastError?r`
              <div class="account-card-error">
                ${e.lastError}
              </div>
            `:v}
      </div>
    </div>
  `}class Di extends Ca{constructor(t){if(super(t),this.it=v,t.type!==Sa.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(t){if(t===v||t==null)return this._t=void 0,this.it=t;if(t===it)return t;if(typeof t!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(t===this.it)return this._t;this.it=t;const n=[t];return n.raw=n,this._t={_$litType$:this.constructor.resultType,strings:n,values:[]}}}Di.directiveName="unsafeHTML",Di.resultType=1;const Fi=Aa(Di);const{entries:bc,setPrototypeOf:sr,isFrozen:Gf,getPrototypeOf:Qf,getOwnPropertyDescriptor:Yf}=Object;let{freeze:ke,seal:Ie,create:Ni}=Object,{apply:Oi,construct:Bi}=typeof Reflect<"u"&&Reflect;ke||(ke=function(t){return t});Ie||(Ie=function(t){return t});Oi||(Oi=function(t,n){for(var s=arguments.length,i=new Array(s>2?s-2:0),a=2;a<s;a++)i[a-2]=arguments[a];return t.apply(n,i)});Bi||(Bi=function(t){for(var n=arguments.length,s=new Array(n>1?n-1:0),i=1;i<n;i++)s[i-1]=arguments[i];return new t(...s)});const Fn=Se(Array.prototype.forEach),Jf=Se(Array.prototype.lastIndexOf),ir=Se(Array.prototype.pop),Jt=Se(Array.prototype.push),Zf=Se(Array.prototype.splice),Gn=Se(String.prototype.toLowerCase),ai=Se(String.prototype.toString),oi=Se(String.prototype.match),Zt=Se(String.prototype.replace),Xf=Se(String.prototype.indexOf),em=Se(String.prototype.trim),Me=Se(Object.prototype.hasOwnProperty),ye=Se(RegExp.prototype.test),Xt=tm(TypeError);function Se(e){return function(t){t instanceof RegExp&&(t.lastIndex=0);for(var n=arguments.length,s=new Array(n>1?n-1:0),i=1;i<n;i++)s[i-1]=arguments[i];return Oi(e,t,s)}}function tm(e){return function(){for(var t=arguments.length,n=new Array(t),s=0;s<t;s++)n[s]=arguments[s];return Bi(e,n)}}function W(e,t){let n=arguments.length>2&&arguments[2]!==void 0?arguments[2]:Gn;sr&&sr(e,null);let s=t.length;for(;s--;){let i=t[s];if(typeof i=="string"){const a=n(i);a!==i&&(Gf(t)||(t[s]=a),i=a)}e[i]=!0}return e}function nm(e){for(let t=0;t<e.length;t++)Me(e,t)||(e[t]=null);return e}function Be(e){const t=Ni(null);for(const[n,s]of bc(e))Me(e,n)&&(Array.isArray(s)?t[n]=nm(s):s&&typeof s=="object"&&s.constructor===Object?t[n]=Be(s):t[n]=s);return t}function en(e,t){for(;e!==null;){const s=Yf(e,t);if(s){if(s.get)return Se(s.get);if(typeof s.value=="function")return Se(s.value)}e=Qf(e)}function n(){return null}return n}const ar=ke(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),ri=ke(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),li=ke(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),sm=ke(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),ci=ke(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),im=ke(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),or=ke(["#text"]),rr=ke(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns","slot"]),di=ke(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-rendering","textlength","type","u1","u2","unicode","values","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),lr=ke(["accent","accentunder","align","bevelled","close","columnsalign","columnlines","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lspace","lquote","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),Nn=ke(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),am=Ie(/\{\{[\w\W]*|[\w\W]*\}\}/gm),om=Ie(/<%[\w\W]*|[\w\W]*%>/gm),rm=Ie(/\$\{[\w\W]*/gm),lm=Ie(/^data-[\-\w.\u00B7-\uFFFF]+$/),cm=Ie(/^aria-[\-\w]+$/),yc=Ie(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),dm=Ie(/^(?:\w+script|data):/i),um=Ie(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),xc=Ie(/^html$/i),pm=Ie(/^[a-z][.\w]*(-[.\w]+)+$/i);var cr=Object.freeze({__proto__:null,ARIA_ATTR:cm,ATTR_WHITESPACE:um,CUSTOM_ELEMENT:pm,DATA_ATTR:lm,DOCTYPE_NAME:xc,ERB_EXPR:om,IS_ALLOWED_URI:yc,IS_SCRIPT_OR_DATA:dm,MUSTACHE_EXPR:am,TMPLIT_EXPR:rm});const tn={element:1,text:3,progressingInstruction:7,comment:8,document:9},gm=function(){return typeof window>"u"?null:window},hm=function(t,n){if(typeof t!="object"||typeof t.createPolicy!="function")return null;let s=null;const i="data-tt-policy-suffix";n&&n.hasAttribute(i)&&(s=n.getAttribute(i));const a="dompurify"+(s?"#"+s:"");try{return t.createPolicy(a,{createHTML(o){return o},createScriptURL(o){return o}})}catch{return console.warn("TrustedTypes policy "+a+" could not be created."),null}},dr=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}};function wc(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:gm();const t=H=>wc(H);if(t.version="3.3.1",t.removed=[],!e||!e.document||e.document.nodeType!==tn.document||!e.Element)return t.isSupported=!1,t;let{document:n}=e;const s=n,i=s.currentScript,{DocumentFragment:a,HTMLTemplateElement:o,Node:l,Element:c,NodeFilter:p,NamedNodeMap:g=e.NamedNodeMap||e.MozNamedAttrMap,HTMLFormElement:u,DOMParser:h,trustedTypes:f}=e,d=c.prototype,m=en(d,"cloneNode"),k=en(d,"remove"),S=en(d,"nextSibling"),$=en(d,"childNodes"),C=en(d,"parentNode");if(typeof o=="function"){const H=n.createElement("template");H.content&&H.content.ownerDocument&&(n=H.content.ownerDocument)}let A,T="";const{implementation:E,createNodeIterator:M,createDocumentFragment:V,getElementsByTagName:K}=n,{importNode:oe}=s;let N=dr();t.isSupported=typeof bc=="function"&&typeof C=="function"&&E&&E.createHTMLDocument!==void 0;const{MUSTACHE_EXPR:z,ERB_EXPR:he,TMPLIT_EXPR:L,DATA_ATTR:U,ARIA_ATTR:ce,IS_SCRIPT_OR_DATA:de,ATTR_WHITESPACE:te,CUSTOM_ELEMENT:re}=cr;let{IS_ALLOWED_URI:R}=cr,P=null;const D=W({},[...ar,...ri,...li,...ci,...or]);let j=null;const Ce=W({},[...rr,...di,...lr,...Nn]);let X=Object.seal(Ni(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),_e=null,ne=null;const be=Object.seal(Ni(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}}));let je=!0,Ke=!0,ct=!1,Ka=!0,Pt=!1,Sn=!0,dt=!1,Ls=!1,Is=!1,Dt=!1,An=!1,Cn=!1,Va=!0,Wa=!1;const qc="user-content-";let Ms=!0,qt=!1,Ft={},Fe=null;const Rs=W({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","style","svg","template","thead","title","video","xmp"]);let qa=null;const Ga=W({},["audio","video","img","source","image","track"]);let Ps=null;const Qa=W({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),Tn="http://www.w3.org/1998/Math/MathML",_n="http://www.w3.org/2000/svg",Ve="http://www.w3.org/1999/xhtml";let Nt=Ve,Ds=!1,Fs=null;const Gc=W({},[Tn,_n,Ve],ai);let En=W({},["mi","mo","mn","ms","mtext"]),Ln=W({},["annotation-xml"]);const Qc=W({},["title","style","font","a","script"]);let Gt=null;const Yc=["application/xhtml+xml","text/html"],Jc="text/html";let le=null,Ot=null;const Zc=n.createElement("form"),Ya=function(w){return w instanceof RegExp||w instanceof Function},Ns=function(){let w=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(!(Ot&&Ot===w)){if((!w||typeof w!="object")&&(w={}),w=Be(w),Gt=Yc.indexOf(w.PARSER_MEDIA_TYPE)===-1?Jc:w.PARSER_MEDIA_TYPE,le=Gt==="application/xhtml+xml"?ai:Gn,P=Me(w,"ALLOWED_TAGS")?W({},w.ALLOWED_TAGS,le):D,j=Me(w,"ALLOWED_ATTR")?W({},w.ALLOWED_ATTR,le):Ce,Fs=Me(w,"ALLOWED_NAMESPACES")?W({},w.ALLOWED_NAMESPACES,ai):Gc,Ps=Me(w,"ADD_URI_SAFE_ATTR")?W(Be(Qa),w.ADD_URI_SAFE_ATTR,le):Qa,qa=Me(w,"ADD_DATA_URI_TAGS")?W(Be(Ga),w.ADD_DATA_URI_TAGS,le):Ga,Fe=Me(w,"FORBID_CONTENTS")?W({},w.FORBID_CONTENTS,le):Rs,_e=Me(w,"FORBID_TAGS")?W({},w.FORBID_TAGS,le):Be({}),ne=Me(w,"FORBID_ATTR")?W({},w.FORBID_ATTR,le):Be({}),Ft=Me(w,"USE_PROFILES")?w.USE_PROFILES:!1,je=w.ALLOW_ARIA_ATTR!==!1,Ke=w.ALLOW_DATA_ATTR!==!1,ct=w.ALLOW_UNKNOWN_PROTOCOLS||!1,Ka=w.ALLOW_SELF_CLOSE_IN_ATTR!==!1,Pt=w.SAFE_FOR_TEMPLATES||!1,Sn=w.SAFE_FOR_XML!==!1,dt=w.WHOLE_DOCUMENT||!1,Dt=w.RETURN_DOM||!1,An=w.RETURN_DOM_FRAGMENT||!1,Cn=w.RETURN_TRUSTED_TYPE||!1,Is=w.FORCE_BODY||!1,Va=w.SANITIZE_DOM!==!1,Wa=w.SANITIZE_NAMED_PROPS||!1,Ms=w.KEEP_CONTENT!==!1,qt=w.IN_PLACE||!1,R=w.ALLOWED_URI_REGEXP||yc,Nt=w.NAMESPACE||Ve,En=w.MATHML_TEXT_INTEGRATION_POINTS||En,Ln=w.HTML_INTEGRATION_POINTS||Ln,X=w.CUSTOM_ELEMENT_HANDLING||{},w.CUSTOM_ELEMENT_HANDLING&&Ya(w.CUSTOM_ELEMENT_HANDLING.tagNameCheck)&&(X.tagNameCheck=w.CUSTOM_ELEMENT_HANDLING.tagNameCheck),w.CUSTOM_ELEMENT_HANDLING&&Ya(w.CUSTOM_ELEMENT_HANDLING.attributeNameCheck)&&(X.attributeNameCheck=w.CUSTOM_ELEMENT_HANDLING.attributeNameCheck),w.CUSTOM_ELEMENT_HANDLING&&typeof w.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements=="boolean"&&(X.allowCustomizedBuiltInElements=w.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements),Pt&&(Ke=!1),An&&(Dt=!0),Ft&&(P=W({},or),j=[],Ft.html===!0&&(W(P,ar),W(j,rr)),Ft.svg===!0&&(W(P,ri),W(j,di),W(j,Nn)),Ft.svgFilters===!0&&(W(P,li),W(j,di),W(j,Nn)),Ft.mathMl===!0&&(W(P,ci),W(j,lr),W(j,Nn))),w.ADD_TAGS&&(typeof w.ADD_TAGS=="function"?be.tagCheck=w.ADD_TAGS:(P===D&&(P=Be(P)),W(P,w.ADD_TAGS,le))),w.ADD_ATTR&&(typeof w.ADD_ATTR=="function"?be.attributeCheck=w.ADD_ATTR:(j===Ce&&(j=Be(j)),W(j,w.ADD_ATTR,le))),w.ADD_URI_SAFE_ATTR&&W(Ps,w.ADD_URI_SAFE_ATTR,le),w.FORBID_CONTENTS&&(Fe===Rs&&(Fe=Be(Fe)),W(Fe,w.FORBID_CONTENTS,le)),w.ADD_FORBID_CONTENTS&&(Fe===Rs&&(Fe=Be(Fe)),W(Fe,w.ADD_FORBID_CONTENTS,le)),Ms&&(P["#text"]=!0),dt&&W(P,["html","head","body"]),P.table&&(W(P,["tbody"]),delete _e.tbody),w.TRUSTED_TYPES_POLICY){if(typeof w.TRUSTED_TYPES_POLICY.createHTML!="function")throw Xt('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof w.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw Xt('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');A=w.TRUSTED_TYPES_POLICY,T=A.createHTML("")}else A===void 0&&(A=hm(f,i)),A!==null&&typeof T=="string"&&(T=A.createHTML(""));ke&&ke(w),Ot=w}},Ja=W({},[...ri,...li,...sm]),Za=W({},[...ci,...im]),Xc=function(w){let I=C(w);(!I||!I.tagName)&&(I={namespaceURI:Nt,tagName:"template"});const O=Gn(w.tagName),ee=Gn(I.tagName);return Fs[w.namespaceURI]?w.namespaceURI===_n?I.namespaceURI===Ve?O==="svg":I.namespaceURI===Tn?O==="svg"&&(ee==="annotation-xml"||En[ee]):!!Ja[O]:w.namespaceURI===Tn?I.namespaceURI===Ve?O==="math":I.namespaceURI===_n?O==="math"&&Ln[ee]:!!Za[O]:w.namespaceURI===Ve?I.namespaceURI===_n&&!Ln[ee]||I.namespaceURI===Tn&&!En[ee]?!1:!Za[O]&&(Qc[O]||!Ja[O]):!!(Gt==="application/xhtml+xml"&&Fs[w.namespaceURI]):!1},Ne=function(w){Jt(t.removed,{element:w});try{C(w).removeChild(w)}catch{k(w)}},ut=function(w,I){try{Jt(t.removed,{attribute:I.getAttributeNode(w),from:I})}catch{Jt(t.removed,{attribute:null,from:I})}if(I.removeAttribute(w),w==="is")if(Dt||An)try{Ne(I)}catch{}else try{I.setAttribute(w,"")}catch{}},Xa=function(w){let I=null,O=null;if(Is)w="<remove></remove>"+w;else{const ie=oi(w,/^[\r\n\t ]+/);O=ie&&ie[0]}Gt==="application/xhtml+xml"&&Nt===Ve&&(w='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+w+"</body></html>");const ee=A?A.createHTML(w):w;if(Nt===Ve)try{I=new h().parseFromString(ee,Gt)}catch{}if(!I||!I.documentElement){I=E.createDocument(Nt,"template",null);try{I.documentElement.innerHTML=Ds?T:ee}catch{}}const fe=I.body||I.documentElement;return w&&O&&fe.insertBefore(n.createTextNode(O),fe.childNodes[0]||null),Nt===Ve?K.call(I,dt?"html":"body")[0]:dt?I.documentElement:fe},eo=function(w){return M.call(w.ownerDocument||w,w,p.SHOW_ELEMENT|p.SHOW_COMMENT|p.SHOW_TEXT|p.SHOW_PROCESSING_INSTRUCTION|p.SHOW_CDATA_SECTION,null)},Os=function(w){return w instanceof u&&(typeof w.nodeName!="string"||typeof w.textContent!="string"||typeof w.removeChild!="function"||!(w.attributes instanceof g)||typeof w.removeAttribute!="function"||typeof w.setAttribute!="function"||typeof w.namespaceURI!="string"||typeof w.insertBefore!="function"||typeof w.hasChildNodes!="function")},to=function(w){return typeof l=="function"&&w instanceof l};function We(H,w,I){Fn(H,O=>{O.call(t,w,I,Ot)})}const no=function(w){let I=null;if(We(N.beforeSanitizeElements,w,null),Os(w))return Ne(w),!0;const O=le(w.nodeName);if(We(N.uponSanitizeElement,w,{tagName:O,allowedTags:P}),Sn&&w.hasChildNodes()&&!to(w.firstElementChild)&&ye(/<[/\w!]/g,w.innerHTML)&&ye(/<[/\w!]/g,w.textContent)||w.nodeType===tn.progressingInstruction||Sn&&w.nodeType===tn.comment&&ye(/<[/\w]/g,w.data))return Ne(w),!0;if(!(be.tagCheck instanceof Function&&be.tagCheck(O))&&(!P[O]||_e[O])){if(!_e[O]&&io(O)&&(X.tagNameCheck instanceof RegExp&&ye(X.tagNameCheck,O)||X.tagNameCheck instanceof Function&&X.tagNameCheck(O)))return!1;if(Ms&&!Fe[O]){const ee=C(w)||w.parentNode,fe=$(w)||w.childNodes;if(fe&&ee){const ie=fe.length;for(let Ae=ie-1;Ae>=0;--Ae){const qe=m(fe[Ae],!0);qe.__removalCount=(w.__removalCount||0)+1,ee.insertBefore(qe,S(w))}}}return Ne(w),!0}return w instanceof c&&!Xc(w)||(O==="noscript"||O==="noembed"||O==="noframes")&&ye(/<\/no(script|embed|frames)/i,w.innerHTML)?(Ne(w),!0):(Pt&&w.nodeType===tn.text&&(I=w.textContent,Fn([z,he,L],ee=>{I=Zt(I,ee," ")}),w.textContent!==I&&(Jt(t.removed,{element:w.cloneNode()}),w.textContent=I)),We(N.afterSanitizeElements,w,null),!1)},so=function(w,I,O){if(Va&&(I==="id"||I==="name")&&(O in n||O in Zc))return!1;if(!(Ke&&!ne[I]&&ye(U,I))){if(!(je&&ye(ce,I))){if(!(be.attributeCheck instanceof Function&&be.attributeCheck(I,w))){if(!j[I]||ne[I]){if(!(io(w)&&(X.tagNameCheck instanceof RegExp&&ye(X.tagNameCheck,w)||X.tagNameCheck instanceof Function&&X.tagNameCheck(w))&&(X.attributeNameCheck instanceof RegExp&&ye(X.attributeNameCheck,I)||X.attributeNameCheck instanceof Function&&X.attributeNameCheck(I,w))||I==="is"&&X.allowCustomizedBuiltInElements&&(X.tagNameCheck instanceof RegExp&&ye(X.tagNameCheck,O)||X.tagNameCheck instanceof Function&&X.tagNameCheck(O))))return!1}else if(!Ps[I]){if(!ye(R,Zt(O,te,""))){if(!((I==="src"||I==="xlink:href"||I==="href")&&w!=="script"&&Xf(O,"data:")===0&&qa[w])){if(!(ct&&!ye(de,Zt(O,te,"")))){if(O)return!1}}}}}}}return!0},io=function(w){return w!=="annotation-xml"&&oi(w,re)},ao=function(w){We(N.beforeSanitizeAttributes,w,null);const{attributes:I}=w;if(!I||Os(w))return;const O={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:j,forceKeepAttr:void 0};let ee=I.length;for(;ee--;){const fe=I[ee],{name:ie,namespaceURI:Ae,value:qe}=fe,Bt=le(ie),Bs=qe;let ge=ie==="value"?Bs:em(Bs);if(O.attrName=Bt,O.attrValue=ge,O.keepAttr=!0,O.forceKeepAttr=void 0,We(N.uponSanitizeAttribute,w,O),ge=O.attrValue,Wa&&(Bt==="id"||Bt==="name")&&(ut(ie,w),ge=qc+ge),Sn&&ye(/((--!?|])>)|<\/(style|title|textarea)/i,ge)){ut(ie,w);continue}if(Bt==="attributename"&&oi(ge,"href")){ut(ie,w);continue}if(O.forceKeepAttr)continue;if(!O.keepAttr){ut(ie,w);continue}if(!Ka&&ye(/\/>/i,ge)){ut(ie,w);continue}Pt&&Fn([z,he,L],ro=>{ge=Zt(ge,ro," ")});const oo=le(w.nodeName);if(!so(oo,Bt,ge)){ut(ie,w);continue}if(A&&typeof f=="object"&&typeof f.getAttributeType=="function"&&!Ae)switch(f.getAttributeType(oo,Bt)){case"TrustedHTML":{ge=A.createHTML(ge);break}case"TrustedScriptURL":{ge=A.createScriptURL(ge);break}}if(ge!==Bs)try{Ae?w.setAttributeNS(Ae,ie,ge):w.setAttribute(ie,ge),Os(w)?Ne(w):ir(t.removed)}catch{ut(ie,w)}}We(N.afterSanitizeAttributes,w,null)},ed=function H(w){let I=null;const O=eo(w);for(We(N.beforeSanitizeShadowDOM,w,null);I=O.nextNode();)We(N.uponSanitizeShadowNode,I,null),no(I),ao(I),I.content instanceof a&&H(I.content);We(N.afterSanitizeShadowDOM,w,null)};return t.sanitize=function(H){let w=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},I=null,O=null,ee=null,fe=null;if(Ds=!H,Ds&&(H="<!-->"),typeof H!="string"&&!to(H))if(typeof H.toString=="function"){if(H=H.toString(),typeof H!="string")throw Xt("dirty is not a string, aborting")}else throw Xt("toString is not a function");if(!t.isSupported)return H;if(Ls||Ns(w),t.removed=[],typeof H=="string"&&(qt=!1),qt){if(H.nodeName){const qe=le(H.nodeName);if(!P[qe]||_e[qe])throw Xt("root node is forbidden and cannot be sanitized in-place")}}else if(H instanceof l)I=Xa("<!---->"),O=I.ownerDocument.importNode(H,!0),O.nodeType===tn.element&&O.nodeName==="BODY"||O.nodeName==="HTML"?I=O:I.appendChild(O);else{if(!Dt&&!Pt&&!dt&&H.indexOf("<")===-1)return A&&Cn?A.createHTML(H):H;if(I=Xa(H),!I)return Dt?null:Cn?T:""}I&&Is&&Ne(I.firstChild);const ie=eo(qt?H:I);for(;ee=ie.nextNode();)no(ee),ao(ee),ee.content instanceof a&&ed(ee.content);if(qt)return H;if(Dt){if(An)for(fe=V.call(I.ownerDocument);I.firstChild;)fe.appendChild(I.firstChild);else fe=I;return(j.shadowroot||j.shadowrootmode)&&(fe=oe.call(s,fe,!0)),fe}let Ae=dt?I.outerHTML:I.innerHTML;return dt&&P["!doctype"]&&I.ownerDocument&&I.ownerDocument.doctype&&I.ownerDocument.doctype.name&&ye(xc,I.ownerDocument.doctype.name)&&(Ae="<!DOCTYPE "+I.ownerDocument.doctype.name+`>
`+Ae),Pt&&Fn([z,he,L],qe=>{Ae=Zt(Ae,qe," ")}),A&&Cn?A.createHTML(Ae):Ae},t.setConfig=function(){let H=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};Ns(H),Ls=!0},t.clearConfig=function(){Ot=null,Ls=!1},t.isValidAttribute=function(H,w,I){Ot||Ns({});const O=le(H),ee=le(w);return so(O,ee,I)},t.addHook=function(H,w){typeof w=="function"&&Jt(N[H],w)},t.removeHook=function(H,w){if(w!==void 0){const I=Jf(N[H],w);return I===-1?void 0:Zf(N[H],I,1)[0]}return ir(N[H])},t.removeHooks=function(H){N[H]=[]},t.removeAllHooks=function(){N=dr()},t}var Ui=wc();function La(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Mt=La();function $c(e){Mt=e}var bt={exec:()=>null};function q(e,t=""){let n=typeof e=="string"?e:e.source,s={replace:(i,a)=>{let o=typeof a=="string"?a:a.source;return o=o.replace(we.caret,"$1"),n=n.replace(i,o),s},getRegex:()=>new RegExp(n,t)};return s}var fm=(()=>{try{return!!new RegExp("(?<=1)(?<!1)")}catch{return!1}})(),we={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>new RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}#`),htmlBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}<(?:[a-z].*>|!--)`,"i"),blockquoteBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}>`)},mm=/^(?:[ \t]*(?:\n|$))+/,vm=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,bm=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,$n=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,ym=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Ia=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,kc=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,Sc=q(kc).replace(/bull/g,Ia).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),xm=q(kc).replace(/bull/g,Ia).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Ma=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,wm=/^[^\n]+/,Ra=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,$m=q(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",Ra).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),km=q(/^(bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,Ia).getRegex(),Ts="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",Pa=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,Sm=q("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",Pa).replace("tag",Ts).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),Ac=q(Ma).replace("hr",$n).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ts).getRegex(),Am=q(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",Ac).getRegex(),Da={blockquote:Am,code:vm,def:$m,fences:bm,heading:ym,hr:$n,html:Sm,lheading:Sc,list:km,newline:mm,paragraph:Ac,table:bt,text:wm},ur=q("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",$n).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ts).getRegex(),Cm={...Da,lheading:xm,table:ur,paragraph:q(Ma).replace("hr",$n).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",ur).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ts).getRegex()},Tm={...Da,html:q(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",Pa).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:bt,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:q(Ma).replace("hr",$n).replace("heading",` *#{1,6} *[^
]`).replace("lheading",Sc).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},_m=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,Em=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Cc=/^( {2,}|\\)\n(?!\s*$)/,Lm=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,_s=/[\p{P}\p{S}]/u,Fa=/[\s\p{P}\p{S}]/u,Tc=/[^\s\p{P}\p{S}]/u,Im=q(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,Fa).getRegex(),_c=/(?!~)[\p{P}\p{S}]/u,Mm=/(?!~)[\s\p{P}\p{S}]/u,Rm=/(?:[^\s\p{P}\p{S}]|~)/u,Ec=/(?![*_])[\p{P}\p{S}]/u,Pm=/(?![*_])[\s\p{P}\p{S}]/u,Dm=/(?:[^\s\p{P}\p{S}]|[*_])/u,Fm=q(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",fm?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),Lc=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,Nm=q(Lc,"u").replace(/punct/g,_s).getRegex(),Om=q(Lc,"u").replace(/punct/g,_c).getRegex(),Ic="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",Bm=q(Ic,"gu").replace(/notPunctSpace/g,Tc).replace(/punctSpace/g,Fa).replace(/punct/g,_s).getRegex(),Um=q(Ic,"gu").replace(/notPunctSpace/g,Rm).replace(/punctSpace/g,Mm).replace(/punct/g,_c).getRegex(),Hm=q("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,Tc).replace(/punctSpace/g,Fa).replace(/punct/g,_s).getRegex(),zm=q(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,Ec).getRegex(),jm="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",Km=q(jm,"gu").replace(/notPunctSpace/g,Dm).replace(/punctSpace/g,Pm).replace(/punct/g,Ec).getRegex(),Vm=q(/\\(punct)/,"gu").replace(/punct/g,_s).getRegex(),Wm=q(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),qm=q(Pa).replace("(?:-->|$)","-->").getRegex(),Gm=q("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",qm).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),as=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/,Qm=q(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label",as).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),Mc=q(/^!?\[(label)\]\[(ref)\]/).replace("label",as).replace("ref",Ra).getRegex(),Rc=q(/^!?\[(ref)\](?:\[\])?/).replace("ref",Ra).getRegex(),Ym=q("reflink|nolink(?!\\()","g").replace("reflink",Mc).replace("nolink",Rc).getRegex(),pr=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,Na={_backpedal:bt,anyPunctuation:Vm,autolink:Wm,blockSkip:Fm,br:Cc,code:Em,del:bt,delLDelim:bt,delRDelim:bt,emStrongLDelim:Nm,emStrongRDelimAst:Bm,emStrongRDelimUnd:Hm,escape:_m,link:Qm,nolink:Rc,punctuation:Im,reflink:Mc,reflinkSearch:Ym,tag:Gm,text:Lm,url:bt},Jm={...Na,link:q(/^!?\[(label)\]\((.*?)\)/).replace("label",as).getRegex(),reflink:q(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",as).getRegex()},Hi={...Na,emStrongRDelimAst:Um,emStrongLDelim:Om,delLDelim:zm,delRDelim:Km,url:q(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",pr).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:q(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",pr).getRegex()},Zm={...Hi,br:q(Cc).replace("{2,}","*").getRegex(),text:q(Hi.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},On={normal:Da,gfm:Cm,pedantic:Tm},nn={normal:Na,gfm:Hi,breaks:Zm,pedantic:Jm},Xm={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},gr=e=>Xm[e];function Ue(e,t){if(t){if(we.escapeTest.test(e))return e.replace(we.escapeReplace,gr)}else if(we.escapeTestNoEncode.test(e))return e.replace(we.escapeReplaceNoEncode,gr);return e}function hr(e){try{e=encodeURI(e).replace(we.percentDecode,"%")}catch{return null}return e}function fr(e,t){let n=e.replace(we.findPipe,(a,o,l)=>{let c=!1,p=o;for(;--p>=0&&l[p]==="\\";)c=!c;return c?"|":" |"}),s=n.split(we.splitPipe),i=0;if(s[0].trim()||s.shift(),s.length>0&&!s.at(-1)?.trim()&&s.pop(),t)if(s.length>t)s.splice(t);else for(;s.length<t;)s.push("");for(;i<s.length;i++)s[i]=s[i].trim().replace(we.slashPipe,"|");return s}function sn(e,t,n){let s=e.length;if(s===0)return"";let i=0;for(;i<s&&e.charAt(s-i-1)===t;)i++;return e.slice(0,s-i)}function ev(e,t){if(e.indexOf(t[1])===-1)return-1;let n=0;for(let s=0;s<e.length;s++)if(e[s]==="\\")s++;else if(e[s]===t[0])n++;else if(e[s]===t[1]&&(n--,n<0))return s;return n>0?-2:-1}function tv(e,t=0){let n=t,s="";for(let i of e)if(i==="	"){let a=4-n%4;s+=" ".repeat(a),n+=a}else s+=i,n++;return s}function mr(e,t,n,s,i){let a=t.href,o=t.title||null,l=e[1].replace(i.other.outputLinkReplace,"$1");s.state.inLink=!0;let c={type:e[0].charAt(0)==="!"?"image":"link",raw:n,href:a,title:o,text:l,tokens:s.inlineTokens(l)};return s.state.inLink=!1,c}function nv(e,t,n){let s=e.match(n.other.indentCodeCompensation);if(s===null)return t;let i=s[1];return t.split(`
`).map(a=>{let o=a.match(n.other.beginningSpace);if(o===null)return a;let[l]=o;return l.length>=i.length?a.slice(i.length):a}).join(`
`)}var os=class{options;rules;lexer;constructor(e){this.options=e||Mt}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let n=t[0].replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:t[0],codeBlockStyle:"indented",text:this.options.pedantic?n:sn(n,`
`)}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let n=t[0],s=nv(n,t[3]||"",this.rules);return{type:"code",raw:n,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:s}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let n=t[2].trim();if(this.rules.other.endingHash.test(n)){let s=sn(n,"#");(this.options.pedantic||!s||this.rules.other.endingSpaceChar.test(s))&&(n=s.trim())}return{type:"heading",raw:t[0],depth:t[1].length,text:n,tokens:this.lexer.inline(n)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:sn(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let n=sn(t[0],`
`).split(`
`),s="",i="",a=[];for(;n.length>0;){let o=!1,l=[],c;for(c=0;c<n.length;c++)if(this.rules.other.blockquoteStart.test(n[c]))l.push(n[c]),o=!0;else if(!o)l.push(n[c]);else break;n=n.slice(c);let p=l.join(`
`),g=p.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");s=s?`${s}
${p}`:p,i=i?`${i}
${g}`:g;let u=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(g,a,!0),this.lexer.state.top=u,n.length===0)break;let h=a.at(-1);if(h?.type==="code")break;if(h?.type==="blockquote"){let f=h,d=f.raw+`
`+n.join(`
`),m=this.blockquote(d);a[a.length-1]=m,s=s.substring(0,s.length-f.raw.length)+m.raw,i=i.substring(0,i.length-f.text.length)+m.text;break}else if(h?.type==="list"){let f=h,d=f.raw+`
`+n.join(`
`),m=this.list(d);a[a.length-1]=m,s=s.substring(0,s.length-h.raw.length)+m.raw,i=i.substring(0,i.length-f.raw.length)+m.raw,n=d.substring(a.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:s,tokens:a,text:i}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim(),s=n.length>1,i={type:"list",raw:"",ordered:s,start:s?+n.slice(0,-1):"",loose:!1,items:[]};n=s?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=s?n:"[*+-]");let a=this.rules.other.listItemRegex(n),o=!1;for(;e;){let c=!1,p="",g="";if(!(t=a.exec(e))||this.rules.block.hr.test(e))break;p=t[0],e=e.substring(p.length);let u=tv(t[2].split(`
`,1)[0],t[1].length),h=e.split(`
`,1)[0],f=!u.trim(),d=0;if(this.options.pedantic?(d=2,g=u.trimStart()):f?d=t[1].length+1:(d=u.search(this.rules.other.nonSpaceChar),d=d>4?1:d,g=u.slice(d),d+=t[1].length),f&&this.rules.other.blankLine.test(h)&&(p+=h+`
`,e=e.substring(h.length+1),c=!0),!c){let m=this.rules.other.nextBulletRegex(d),k=this.rules.other.hrRegex(d),S=this.rules.other.fencesBeginRegex(d),$=this.rules.other.headingBeginRegex(d),C=this.rules.other.htmlBeginRegex(d),A=this.rules.other.blockquoteBeginRegex(d);for(;e;){let T=e.split(`
`,1)[0],E;if(h=T,this.options.pedantic?(h=h.replace(this.rules.other.listReplaceNesting,"  "),E=h):E=h.replace(this.rules.other.tabCharGlobal,"    "),S.test(h)||$.test(h)||C.test(h)||A.test(h)||m.test(h)||k.test(h))break;if(E.search(this.rules.other.nonSpaceChar)>=d||!h.trim())g+=`
`+E.slice(d);else{if(f||u.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||S.test(u)||$.test(u)||k.test(u))break;g+=`
`+h}f=!h.trim(),p+=T+`
`,e=e.substring(T.length+1),u=E.slice(d)}}i.loose||(o?i.loose=!0:this.rules.other.doubleBlankLine.test(p)&&(o=!0)),i.items.push({type:"list_item",raw:p,task:!!this.options.gfm&&this.rules.other.listIsTask.test(g),loose:!1,text:g,tokens:[]}),i.raw+=p}let l=i.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;i.raw=i.raw.trimEnd();for(let c of i.items){if(this.lexer.state.top=!1,c.tokens=this.lexer.blockTokens(c.text,[]),c.task){if(c.text=c.text.replace(this.rules.other.listReplaceTask,""),c.tokens[0]?.type==="text"||c.tokens[0]?.type==="paragraph"){c.tokens[0].raw=c.tokens[0].raw.replace(this.rules.other.listReplaceTask,""),c.tokens[0].text=c.tokens[0].text.replace(this.rules.other.listReplaceTask,"");for(let g=this.lexer.inlineQueue.length-1;g>=0;g--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[g].src)){this.lexer.inlineQueue[g].src=this.lexer.inlineQueue[g].src.replace(this.rules.other.listReplaceTask,"");break}}let p=this.rules.other.listTaskCheckbox.exec(c.raw);if(p){let g={type:"checkbox",raw:p[0]+" ",checked:p[0]!=="[ ]"};c.checked=g.checked,i.loose?c.tokens[0]&&["paragraph","text"].includes(c.tokens[0].type)&&"tokens"in c.tokens[0]&&c.tokens[0].tokens?(c.tokens[0].raw=g.raw+c.tokens[0].raw,c.tokens[0].text=g.raw+c.tokens[0].text,c.tokens[0].tokens.unshift(g)):c.tokens.unshift({type:"paragraph",raw:g.raw,text:g.raw,tokens:[g]}):c.tokens.unshift(g)}}if(!i.loose){let p=c.tokens.filter(u=>u.type==="space"),g=p.length>0&&p.some(u=>this.rules.other.anyLine.test(u.raw));i.loose=g}}if(i.loose)for(let c of i.items){c.loose=!0;for(let p of c.tokens)p.type==="text"&&(p.type="paragraph")}return i}}html(e){let t=this.rules.block.html.exec(e);if(t)return{type:"html",block:!0,raw:t[0],pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:t[0]}}def(e){let t=this.rules.block.def.exec(e);if(t){let n=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),s=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",i=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:n,raw:t[0],href:s,title:i}}}table(e){let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let n=fr(t[1]),s=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),i=t[3]?.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],a={type:"table",raw:t[0],header:[],align:[],rows:[]};if(n.length===s.length){for(let o of s)this.rules.other.tableAlignRight.test(o)?a.align.push("right"):this.rules.other.tableAlignCenter.test(o)?a.align.push("center"):this.rules.other.tableAlignLeft.test(o)?a.align.push("left"):a.align.push(null);for(let o=0;o<n.length;o++)a.header.push({text:n[o],tokens:this.lexer.inline(n[o]),header:!0,align:a.align[o]});for(let o of i)a.rows.push(fr(o,a.header.length).map((l,c)=>({text:l,tokens:this.lexer.inline(l),header:!1,align:a.align[c]})));return a}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t)return{type:"heading",raw:t[0],depth:t[2].charAt(0)==="="?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let n=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:n,tokens:this.lexer.inline(n)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let n=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(n)){if(!this.rules.other.endAngleBracket.test(n))return;let a=sn(n.slice(0,-1),"\\");if((n.length-a.length)%2===0)return}else{let a=ev(t[2],"()");if(a===-2)return;if(a>-1){let o=(t[0].indexOf("!")===0?5:4)+t[1].length+a;t[2]=t[2].substring(0,a),t[0]=t[0].substring(0,o).trim(),t[3]=""}}let s=t[2],i="";if(this.options.pedantic){let a=this.rules.other.pedanticHrefTitle.exec(s);a&&(s=a[1],i=a[3])}else i=t[3]?t[3].slice(1,-1):"";return s=s.trim(),this.rules.other.startAngleBracket.test(s)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(n)?s=s.slice(1):s=s.slice(1,-1)),mr(t,{href:s&&s.replace(this.rules.inline.anyPunctuation,"$1"),title:i&&i.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){let s=(n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal," "),i=t[s.toLowerCase()];if(!i){let a=n[0].charAt(0);return{type:"text",raw:a,text:a}}return mr(n,i,n[0],this.lexer,this.rules)}}emStrong(e,t,n=""){let s=this.rules.inline.emStrongLDelim.exec(e);if(!(!s||s[3]&&n.match(this.rules.other.unicodeAlphaNumeric))&&(!(s[1]||s[2])||!n||this.rules.inline.punctuation.exec(n))){let i=[...s[0]].length-1,a,o,l=i,c=0,p=s[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(p.lastIndex=0,t=t.slice(-1*e.length+i);(s=p.exec(t))!=null;){if(a=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!a)continue;if(o=[...a].length,s[3]||s[4]){l+=o;continue}else if((s[5]||s[6])&&i%3&&!((i+o)%3)){c+=o;continue}if(l-=o,l>0)continue;o=Math.min(o,o+l+c);let g=[...s[0]][0].length,u=e.slice(0,i+s.index+g+o);if(Math.min(i,o)%2){let f=u.slice(1,-1);return{type:"em",raw:u,text:f,tokens:this.lexer.inlineTokens(f)}}let h=u.slice(2,-2);return{type:"strong",raw:u,text:h,tokens:this.lexer.inlineTokens(h)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let n=t[2].replace(this.rules.other.newLineCharGlobal," "),s=this.rules.other.nonSpaceChar.test(n),i=this.rules.other.startingSpaceChar.test(n)&&this.rules.other.endingSpaceChar.test(n);return s&&i&&(n=n.substring(1,n.length-1)),{type:"codespan",raw:t[0],text:n}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e,t,n=""){let s=this.rules.inline.delLDelim.exec(e);if(s&&(!s[1]||!n||this.rules.inline.punctuation.exec(n))){let i=[...s[0]].length-1,a,o,l=i,c=this.rules.inline.delRDelim;for(c.lastIndex=0,t=t.slice(-1*e.length+i);(s=c.exec(t))!=null;){if(a=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!a||(o=[...a].length,o!==i))continue;if(s[3]||s[4]){l+=o;continue}if(l-=o,l>0)continue;o=Math.min(o,o+l);let p=[...s[0]][0].length,g=e.slice(0,i+s.index+p+o),u=g.slice(i,-i);return{type:"del",raw:g,text:u,tokens:this.lexer.inlineTokens(u)}}}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let n,s;return t[2]==="@"?(n=t[1],s="mailto:"+n):(n=t[1],s=n),{type:"link",raw:t[0],text:n,href:s,tokens:[{type:"text",raw:n,text:n}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let n,s;if(t[2]==="@")n=t[0],s="mailto:"+n;else{let i;do i=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??"";while(i!==t[0]);n=t[0],t[1]==="www."?s="http://"+t[0]:s=t[0]}return{type:"link",raw:t[0],text:n,href:s,tokens:[{type:"text",raw:n,text:n}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let n=this.lexer.state.inRawBlock;return{type:"text",raw:t[0],text:t[0],escaped:n}}}},Re=class zi{tokens;options;state;inlineQueue;tokenizer;constructor(t){this.tokens=[],this.tokens.links=Object.create(null),this.options=t||Mt,this.options.tokenizer=this.options.tokenizer||new os,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let n={other:we,block:On.normal,inline:nn.normal};this.options.pedantic?(n.block=On.pedantic,n.inline=nn.pedantic):this.options.gfm&&(n.block=On.gfm,this.options.breaks?n.inline=nn.breaks:n.inline=nn.gfm),this.tokenizer.rules=n}static get rules(){return{block:On,inline:nn}}static lex(t,n){return new zi(n).lex(t)}static lexInline(t,n){return new zi(n).inlineTokens(t)}lex(t){t=t.replace(we.carriageReturn,`
`),this.blockTokens(t,this.tokens);for(let n=0;n<this.inlineQueue.length;n++){let s=this.inlineQueue[n];this.inlineTokens(s.src,s.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(t,n=[],s=!1){for(this.options.pedantic&&(t=t.replace(we.tabCharGlobal,"    ").replace(we.spaceLine,""));t;){let i;if(this.options.extensions?.block?.some(o=>(i=o.call({lexer:this},t,n))?(t=t.substring(i.raw.length),n.push(i),!0):!1))continue;if(i=this.tokenizer.space(t)){t=t.substring(i.raw.length);let o=n.at(-1);i.raw.length===1&&o!==void 0?o.raw+=`
`:n.push(i);continue}if(i=this.tokenizer.code(t)){t=t.substring(i.raw.length);let o=n.at(-1);o?.type==="paragraph"||o?.type==="text"?(o.raw+=(o.raw.endsWith(`
`)?"":`
`)+i.raw,o.text+=`
`+i.text,this.inlineQueue.at(-1).src=o.text):n.push(i);continue}if(i=this.tokenizer.fences(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.heading(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.hr(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.blockquote(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.list(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.html(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.def(t)){t=t.substring(i.raw.length);let o=n.at(-1);o?.type==="paragraph"||o?.type==="text"?(o.raw+=(o.raw.endsWith(`
`)?"":`
`)+i.raw,o.text+=`
`+i.raw,this.inlineQueue.at(-1).src=o.text):this.tokens.links[i.tag]||(this.tokens.links[i.tag]={href:i.href,title:i.title},n.push(i));continue}if(i=this.tokenizer.table(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.lheading(t)){t=t.substring(i.raw.length),n.push(i);continue}let a=t;if(this.options.extensions?.startBlock){let o=1/0,l=t.slice(1),c;this.options.extensions.startBlock.forEach(p=>{c=p.call({lexer:this},l),typeof c=="number"&&c>=0&&(o=Math.min(o,c))}),o<1/0&&o>=0&&(a=t.substring(0,o+1))}if(this.state.top&&(i=this.tokenizer.paragraph(a))){let o=n.at(-1);s&&o?.type==="paragraph"?(o.raw+=(o.raw.endsWith(`
`)?"":`
`)+i.raw,o.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=o.text):n.push(i),s=a.length!==t.length,t=t.substring(i.raw.length);continue}if(i=this.tokenizer.text(t)){t=t.substring(i.raw.length);let o=n.at(-1);o?.type==="text"?(o.raw+=(o.raw.endsWith(`
`)?"":`
`)+i.raw,o.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=o.text):n.push(i);continue}if(t){let o="Infinite loop on byte: "+t.charCodeAt(0);if(this.options.silent){console.error(o);break}else throw new Error(o)}}return this.state.top=!0,n}inline(t,n=[]){return this.inlineQueue.push({src:t,tokens:n}),n}inlineTokens(t,n=[]){let s=t,i=null;if(this.tokens.links){let c=Object.keys(this.tokens.links);if(c.length>0)for(;(i=this.tokenizer.rules.inline.reflinkSearch.exec(s))!=null;)c.includes(i[0].slice(i[0].lastIndexOf("[")+1,-1))&&(s=s.slice(0,i.index)+"["+"a".repeat(i[0].length-2)+"]"+s.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(i=this.tokenizer.rules.inline.anyPunctuation.exec(s))!=null;)s=s.slice(0,i.index)+"++"+s.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let a;for(;(i=this.tokenizer.rules.inline.blockSkip.exec(s))!=null;)a=i[2]?i[2].length:0,s=s.slice(0,i.index+a)+"["+"a".repeat(i[0].length-a-2)+"]"+s.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);s=this.options.hooks?.emStrongMask?.call({lexer:this},s)??s;let o=!1,l="";for(;t;){o||(l=""),o=!1;let c;if(this.options.extensions?.inline?.some(g=>(c=g.call({lexer:this},t,n))?(t=t.substring(c.raw.length),n.push(c),!0):!1))continue;if(c=this.tokenizer.escape(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.tag(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.link(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.reflink(t,this.tokens.links)){t=t.substring(c.raw.length);let g=n.at(-1);c.type==="text"&&g?.type==="text"?(g.raw+=c.raw,g.text+=c.text):n.push(c);continue}if(c=this.tokenizer.emStrong(t,s,l)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.codespan(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.br(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.del(t,s,l)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.autolink(t)){t=t.substring(c.raw.length),n.push(c);continue}if(!this.state.inLink&&(c=this.tokenizer.url(t))){t=t.substring(c.raw.length),n.push(c);continue}let p=t;if(this.options.extensions?.startInline){let g=1/0,u=t.slice(1),h;this.options.extensions.startInline.forEach(f=>{h=f.call({lexer:this},u),typeof h=="number"&&h>=0&&(g=Math.min(g,h))}),g<1/0&&g>=0&&(p=t.substring(0,g+1))}if(c=this.tokenizer.inlineText(p)){t=t.substring(c.raw.length),c.raw.slice(-1)!=="_"&&(l=c.raw.slice(-1)),o=!0;let g=n.at(-1);g?.type==="text"?(g.raw+=c.raw,g.text+=c.text):n.push(c);continue}if(t){let g="Infinite loop on byte: "+t.charCodeAt(0);if(this.options.silent){console.error(g);break}else throw new Error(g)}}return n}},rs=class{options;parser;constructor(e){this.options=e||Mt}space(e){return""}code({text:e,lang:t,escaped:n}){let s=(t||"").match(we.notSpaceStart)?.[0],i=e.replace(we.endingNewline,"")+`
`;return s?'<pre><code class="language-'+Ue(s)+'">'+(n?i:Ue(i,!0))+`</code></pre>
`:"<pre><code>"+(n?i:Ue(i,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return""}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,n=e.start,s="";for(let o=0;o<e.items.length;o++){let l=e.items[o];s+=this.listitem(l)}let i=t?"ol":"ul",a=t&&n!==1?' start="'+n+'"':"";return"<"+i+a+`>
`+s+"</"+i+`>
`}listitem(e){return`<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",n="";for(let i=0;i<e.header.length;i++)n+=this.tablecell(e.header[i]);t+=this.tablerow({text:n});let s="";for(let i=0;i<e.rows.length;i++){let a=e.rows[i];n="";for(let o=0;o<a.length;o++)n+=this.tablecell(a[o]);s+=this.tablerow({text:n})}return s&&(s=`<tbody>${s}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+s+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),n=e.header?"th":"td";return(e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${Ue(e,!0)}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:n}){let s=this.parser.parseInline(n),i=hr(e);if(i===null)return s;e=i;let a='<a href="'+e+'"';return t&&(a+=' title="'+Ue(t)+'"'),a+=">"+s+"</a>",a}image({href:e,title:t,text:n,tokens:s}){s&&(n=this.parser.parseInline(s,this.parser.textRenderer));let i=hr(e);if(i===null)return Ue(n);e=i;let a=`<img src="${e}" alt="${Ue(n)}"`;return t&&(a+=` title="${Ue(t)}"`),a+=">",a}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:Ue(e.text)}},Oa=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}checkbox({raw:e}){return e}},Pe=class ji{options;renderer;textRenderer;constructor(t){this.options=t||Mt,this.options.renderer=this.options.renderer||new rs,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new Oa}static parse(t,n){return new ji(n).parse(t)}static parseInline(t,n){return new ji(n).parseInline(t)}parse(t){let n="";for(let s=0;s<t.length;s++){let i=t[s];if(this.options.extensions?.renderers?.[i.type]){let o=i,l=this.options.extensions.renderers[o.type].call({parser:this},o);if(l!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(o.type)){n+=l||"";continue}}let a=i;switch(a.type){case"space":{n+=this.renderer.space(a);break}case"hr":{n+=this.renderer.hr(a);break}case"heading":{n+=this.renderer.heading(a);break}case"code":{n+=this.renderer.code(a);break}case"table":{n+=this.renderer.table(a);break}case"blockquote":{n+=this.renderer.blockquote(a);break}case"list":{n+=this.renderer.list(a);break}case"checkbox":{n+=this.renderer.checkbox(a);break}case"html":{n+=this.renderer.html(a);break}case"def":{n+=this.renderer.def(a);break}case"paragraph":{n+=this.renderer.paragraph(a);break}case"text":{n+=this.renderer.text(a);break}default:{let o='Token with "'+a.type+'" type was not found.';if(this.options.silent)return console.error(o),"";throw new Error(o)}}}return n}parseInline(t,n=this.renderer){let s="";for(let i=0;i<t.length;i++){let a=t[i];if(this.options.extensions?.renderers?.[a.type]){let l=this.options.extensions.renderers[a.type].call({parser:this},a);if(l!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(a.type)){s+=l||"";continue}}let o=a;switch(o.type){case"escape":{s+=n.text(o);break}case"html":{s+=n.html(o);break}case"link":{s+=n.link(o);break}case"image":{s+=n.image(o);break}case"checkbox":{s+=n.checkbox(o);break}case"strong":{s+=n.strong(o);break}case"em":{s+=n.em(o);break}case"codespan":{s+=n.codespan(o);break}case"br":{s+=n.br(o);break}case"del":{s+=n.del(o);break}case"text":{s+=n.text(o);break}default:{let l='Token with "'+o.type+'" type was not found.';if(this.options.silent)return console.error(l),"";throw new Error(l)}}}return s}},on=class{options;block;constructor(e){this.options=e||Mt}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens","emStrongMask"]);static passThroughHooksRespectAsync=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(){return this.block?Re.lex:Re.lexInline}provideParser(){return this.block?Pe.parse:Pe.parseInline}},sv=class{defaults=La();options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=Pe;Renderer=rs;TextRenderer=Oa;Lexer=Re;Tokenizer=os;Hooks=on;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(let s of e)switch(n=n.concat(t.call(this,s)),s.type){case"table":{let i=s;for(let a of i.header)n=n.concat(this.walkTokens(a.tokens,t));for(let a of i.rows)for(let o of a)n=n.concat(this.walkTokens(o.tokens,t));break}case"list":{let i=s;n=n.concat(this.walkTokens(i.items,t));break}default:{let i=s;this.defaults.extensions?.childTokens?.[i.type]?this.defaults.extensions.childTokens[i.type].forEach(a=>{let o=i[a].flat(1/0);n=n.concat(this.walkTokens(o,t))}):i.tokens&&(n=n.concat(this.walkTokens(i.tokens,t)))}}return n}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(n=>{let s={...n};if(s.async=this.defaults.async||s.async||!1,n.extensions&&(n.extensions.forEach(i=>{if(!i.name)throw new Error("extension name required");if("renderer"in i){let a=t.renderers[i.name];a?t.renderers[i.name]=function(...o){let l=i.renderer.apply(this,o);return l===!1&&(l=a.apply(this,o)),l}:t.renderers[i.name]=i.renderer}if("tokenizer"in i){if(!i.level||i.level!=="block"&&i.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let a=t[i.level];a?a.unshift(i.tokenizer):t[i.level]=[i.tokenizer],i.start&&(i.level==="block"?t.startBlock?t.startBlock.push(i.start):t.startBlock=[i.start]:i.level==="inline"&&(t.startInline?t.startInline.push(i.start):t.startInline=[i.start]))}"childTokens"in i&&i.childTokens&&(t.childTokens[i.name]=i.childTokens)}),s.extensions=t),n.renderer){let i=this.defaults.renderer||new rs(this.defaults);for(let a in n.renderer){if(!(a in i))throw new Error(`renderer '${a}' does not exist`);if(["options","parser"].includes(a))continue;let o=a,l=n.renderer[o],c=i[o];i[o]=(...p)=>{let g=l.apply(i,p);return g===!1&&(g=c.apply(i,p)),g||""}}s.renderer=i}if(n.tokenizer){let i=this.defaults.tokenizer||new os(this.defaults);for(let a in n.tokenizer){if(!(a in i))throw new Error(`tokenizer '${a}' does not exist`);if(["options","rules","lexer"].includes(a))continue;let o=a,l=n.tokenizer[o],c=i[o];i[o]=(...p)=>{let g=l.apply(i,p);return g===!1&&(g=c.apply(i,p)),g}}s.tokenizer=i}if(n.hooks){let i=this.defaults.hooks||new on;for(let a in n.hooks){if(!(a in i))throw new Error(`hook '${a}' does not exist`);if(["options","block"].includes(a))continue;let o=a,l=n.hooks[o],c=i[o];on.passThroughHooks.has(a)?i[o]=p=>{if(this.defaults.async&&on.passThroughHooksRespectAsync.has(a))return(async()=>{let u=await l.call(i,p);return c.call(i,u)})();let g=l.call(i,p);return c.call(i,g)}:i[o]=(...p)=>{if(this.defaults.async)return(async()=>{let u=await l.apply(i,p);return u===!1&&(u=await c.apply(i,p)),u})();let g=l.apply(i,p);return g===!1&&(g=c.apply(i,p)),g}}s.hooks=i}if(n.walkTokens){let i=this.defaults.walkTokens,a=n.walkTokens;s.walkTokens=function(o){let l=[];return l.push(a.call(this,o)),i&&(l=l.concat(i.call(this,o))),l}}this.defaults={...this.defaults,...s}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return Re.lex(e,t??this.defaults)}parser(e,t){return Pe.parse(e,t??this.defaults)}parseMarkdown(e){return(t,n)=>{let s={...n},i={...this.defaults,...s},a=this.onError(!!i.silent,!!i.async);if(this.defaults.async===!0&&s.async===!1)return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof t>"u"||t===null)return a(new Error("marked(): input parameter is undefined or null"));if(typeof t!="string")return a(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(t)+", string expected"));if(i.hooks&&(i.hooks.options=i,i.hooks.block=e),i.async)return(async()=>{let o=i.hooks?await i.hooks.preprocess(t):t,l=await(i.hooks?await i.hooks.provideLexer():e?Re.lex:Re.lexInline)(o,i),c=i.hooks?await i.hooks.processAllTokens(l):l;i.walkTokens&&await Promise.all(this.walkTokens(c,i.walkTokens));let p=await(i.hooks?await i.hooks.provideParser():e?Pe.parse:Pe.parseInline)(c,i);return i.hooks?await i.hooks.postprocess(p):p})().catch(a);try{i.hooks&&(t=i.hooks.preprocess(t));let o=(i.hooks?i.hooks.provideLexer():e?Re.lex:Re.lexInline)(t,i);i.hooks&&(o=i.hooks.processAllTokens(o)),i.walkTokens&&this.walkTokens(o,i.walkTokens);let l=(i.hooks?i.hooks.provideParser():e?Pe.parse:Pe.parseInline)(o,i);return i.hooks&&(l=i.hooks.postprocess(l)),l}catch(o){return a(o)}}}onError(e,t){return n=>{if(n.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let s="<p>An error occurred:</p><pre>"+Ue(n.message+"",!0)+"</pre>";return t?Promise.resolve(s):s}if(t)return Promise.reject(n);throw n}}},Lt=new sv;function Q(e,t){return Lt.parse(e,t)}Q.options=Q.setOptions=function(e){return Lt.setOptions(e),Q.defaults=Lt.defaults,$c(Q.defaults),Q};Q.getDefaults=La;Q.defaults=Mt;Q.use=function(...e){return Lt.use(...e),Q.defaults=Lt.defaults,$c(Q.defaults),Q};Q.walkTokens=function(e,t){return Lt.walkTokens(e,t)};Q.parseInline=Lt.parseInline;Q.Parser=Pe;Q.parser=Pe.parse;Q.Renderer=rs;Q.TextRenderer=Oa;Q.Lexer=Re;Q.lexer=Re.lex;Q.Tokenizer=os;Q.Hooks=on;Q.parse=Q;Q.options;Q.setOptions;Q.use;Q.walkTokens;Q.parseInline;Pe.parse;Re.lex;Q.setOptions({gfm:!0,breaks:!0});const vr=["a","b","blockquote","br","code","del","em","h1","h2","h3","h4","hr","i","li","ol","p","pre","strong","table","tbody","td","th","thead","tr","ul"],br=["class","href","rel","target","title","start"];let yr=!1;const iv=14e4,av=4e4,ov=200,ui=5e4,$t=new Map;function rv(e){const t=$t.get(e);return t===void 0?null:($t.delete(e),$t.set(e,t),t)}function xr(e,t){if($t.set(e,t),$t.size<=ov)return;const n=$t.keys().next().value;n&&$t.delete(n)}function lv(){yr||(yr=!0,Ui.addHook("afterSanitizeAttributes",e=>{!(e instanceof HTMLAnchorElement)||!e.getAttribute("href")||(e.setAttribute("rel","noreferrer noopener"),e.setAttribute("target","_blank"))}))}function Ki(e){const t=e.trim();if(!t)return"";if(lv(),t.length<=ui){const o=rv(t);if(o!==null)return o}const n=ml(t,iv),s=n.truncated?`

… truncated (${n.total} chars, showing first ${n.text.length}).`:"";if(n.text.length>av){const l=`<pre class="code-block">${cv(`${n.text}${s}`)}</pre>`,c=Ui.sanitize(l,{ALLOWED_TAGS:vr,ALLOWED_ATTR:br});return t.length<=ui&&xr(t,c),c}const i=Q.parse(`${n.text}${s}`),a=Ui.sanitize(i,{ALLOWED_TAGS:vr,ALLOWED_ATTR:br});return t.length<=ui&&xr(t,a),a}function cv(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}const dv=1500,uv=2e3,Pc="Copy as markdown",pv="Copied",gv="Copy failed";async function hv(e){if(!e)return!1;try{return await navigator.clipboard.writeText(e),!0}catch{return!1}}function Bn(e,t){e.title=t,e.setAttribute("aria-label",t)}function fv(e){const t=e.label??Pc;return r`
    <button
      class="chat-copy-btn"
      type="button"
      title=${t}
      aria-label=${t}
      @click=${async n=>{const s=n.currentTarget;if(!s||s.dataset.copying==="1")return;s.dataset.copying="1",s.setAttribute("aria-busy","true"),s.disabled=!0;const i=await hv(e.text());if(s.isConnected){if(delete s.dataset.copying,s.removeAttribute("aria-busy"),s.disabled=!1,!i){s.dataset.error="1",Bn(s,gv),window.setTimeout(()=>{s.isConnected&&(delete s.dataset.error,Bn(s,t))},uv);return}s.dataset.copied="1",Bn(s,pv),window.setTimeout(()=>{s.isConnected&&(delete s.dataset.copied,Bn(s,t))},dv)}}}
    >
      <span class="chat-copy-btn__icon" aria-hidden="true">
        <span class="chat-copy-btn__icon-copy">${pe.copy}</span>
        <span class="chat-copy-btn__icon-check">${pe.check}</span>
      </span>
    </button>
  `}function mv(e){return fv({text:()=>e,label:Pc})}function Dc(e){const t=e;let n=typeof t.role=="string"?t.role:"unknown";const s=typeof t.toolCallId=="string"||typeof t.tool_call_id=="string",i=t.content,a=Array.isArray(i)?i:null,o=Array.isArray(a)&&a.some(u=>{const h=u,f=(typeof h.type=="string"?h.type:"").toLowerCase();return f==="toolresult"||f==="tool_result"}),l=typeof t.toolName=="string"||typeof t.tool_name=="string";(s||o||l)&&(n="toolResult");let c=[];typeof t.content=="string"?c=[{type:"text",text:t.content}]:Array.isArray(t.content)?c=t.content.map(u=>({type:u.type||"text",text:u.text,name:u.name,args:u.args||u.arguments})):typeof t.text=="string"&&(c=[{type:"text",text:t.text}]);const p=typeof t.timestamp=="number"?t.timestamp:Date.now(),g=typeof t.id=="string"?t.id:void 0;return{role:n,content:c,timestamp:p,id:g}}function Ba(e){const t=e.toLowerCase();return e==="user"||e==="User"?e:e==="assistant"?"assistant":e==="system"?"system":t==="toolresult"||t==="tool_result"||t==="tool"||t==="function"?"tool":e}function Fc(e){const t=e,n=typeof t.role=="string"?t.role.toLowerCase():"";return n==="toolresult"||n==="tool_result"}const vv={icon:"puzzle",detailKeys:["command","path","url","targetUrl","targetId","ref","element","node","nodeId","id","requestId","to","channelId","guildId","userId","name","query","pattern","messageId"]},bv={bash:{icon:"wrench",title:"Bash",detailKeys:["command"]},process:{icon:"wrench",title:"Process",detailKeys:["sessionId"]},read:{icon:"fileText",title:"Read",detailKeys:["path"]},write:{icon:"edit",title:"Write",detailKeys:["path"]},edit:{icon:"penLine",title:"Edit",detailKeys:["path"]},attach:{icon:"paperclip",title:"Attach",detailKeys:["path","url","fileName"]},browser:{icon:"globe",title:"Browser",actions:{status:{label:"status"},start:{label:"start"},stop:{label:"stop"},tabs:{label:"tabs"},open:{label:"open",detailKeys:["targetUrl"]},focus:{label:"focus",detailKeys:["targetId"]},close:{label:"close",detailKeys:["targetId"]},snapshot:{label:"snapshot",detailKeys:["targetUrl","targetId","ref","element","format"]},screenshot:{label:"screenshot",detailKeys:["targetUrl","targetId","ref","element"]},navigate:{label:"navigate",detailKeys:["targetUrl","targetId"]},console:{label:"console",detailKeys:["level","targetId"]},pdf:{label:"pdf",detailKeys:["targetId"]},upload:{label:"upload",detailKeys:["paths","ref","inputRef","element","targetId"]},dialog:{label:"dialog",detailKeys:["accept","promptText","targetId"]},act:{label:"act",detailKeys:["request.kind","request.ref","request.selector","request.text","request.value"]}}},canvas:{icon:"image",title:"Canvas",actions:{present:{label:"present",detailKeys:["target","node","nodeId"]},hide:{label:"hide",detailKeys:["node","nodeId"]},navigate:{label:"navigate",detailKeys:["url","node","nodeId"]},eval:{label:"eval",detailKeys:["javaScript","node","nodeId"]},snapshot:{label:"snapshot",detailKeys:["format","node","nodeId"]},a2ui_push:{label:"A2UI push",detailKeys:["jsonlPath","node","nodeId"]},a2ui_reset:{label:"A2UI reset",detailKeys:["node","nodeId"]}}},nodes:{icon:"smartphone",title:"Nodes",actions:{status:{label:"status"},describe:{label:"describe",detailKeys:["node","nodeId"]},pending:{label:"pending"},approve:{label:"approve",detailKeys:["requestId"]},reject:{label:"reject",detailKeys:["requestId"]},notify:{label:"notify",detailKeys:["node","nodeId","title","body"]},camera_snap:{label:"camera snap",detailKeys:["node","nodeId","facing","deviceId"]},camera_list:{label:"camera list",detailKeys:["node","nodeId"]},camera_clip:{label:"camera clip",detailKeys:["node","nodeId","facing","duration","durationMs"]},screen_record:{label:"screen record",detailKeys:["node","nodeId","duration","durationMs","fps","screenIndex"]}}},cron:{icon:"loader",title:"Cron",actions:{status:{label:"status"},list:{label:"list"},add:{label:"add",detailKeys:["job.name","job.id","job.schedule","job.cron"]},update:{label:"update",detailKeys:["id"]},remove:{label:"remove",detailKeys:["id"]},run:{label:"run",detailKeys:["id"]},runs:{label:"runs",detailKeys:["id"]},wake:{label:"wake",detailKeys:["text","mode"]}}},gateway:{icon:"plug",title:"Gateway",actions:{restart:{label:"restart",detailKeys:["reason","delayMs"]},"config.get":{label:"config get"},"config.schema":{label:"config schema"},"config.apply":{label:"config apply",detailKeys:["restartDelayMs"]},"update.run":{label:"update run",detailKeys:["restartDelayMs"]}}},whatsapp_login:{icon:"circle",title:"WhatsApp Login",actions:{start:{label:"start"},wait:{label:"wait"}}},discord:{icon:"messageSquare",title:"Discord",actions:{react:{label:"react",detailKeys:["channelId","messageId","emoji"]},reactions:{label:"reactions",detailKeys:["channelId","messageId"]},sticker:{label:"sticker",detailKeys:["to","stickerIds"]},poll:{label:"poll",detailKeys:["question","to"]},permissions:{label:"permissions",detailKeys:["channelId"]},readMessages:{label:"read messages",detailKeys:["channelId","limit"]},sendMessage:{label:"send",detailKeys:["to","content"]},editMessage:{label:"edit",detailKeys:["channelId","messageId"]},deleteMessage:{label:"delete",detailKeys:["channelId","messageId"]},threadCreate:{label:"thread create",detailKeys:["channelId","name"]},threadList:{label:"thread list",detailKeys:["guildId","channelId"]},threadReply:{label:"thread reply",detailKeys:["channelId","content"]},pinMessage:{label:"pin",detailKeys:["channelId","messageId"]},unpinMessage:{label:"unpin",detailKeys:["channelId","messageId"]},listPins:{label:"list pins",detailKeys:["channelId"]},searchMessages:{label:"search",detailKeys:["guildId","content"]},memberInfo:{label:"member",detailKeys:["guildId","userId"]},roleInfo:{label:"roles",detailKeys:["guildId"]},emojiList:{label:"emoji list",detailKeys:["guildId"]},roleAdd:{label:"role add",detailKeys:["guildId","userId","roleId"]},roleRemove:{label:"role remove",detailKeys:["guildId","userId","roleId"]},channelInfo:{label:"channel",detailKeys:["channelId"]},channelList:{label:"channels",detailKeys:["guildId"]},voiceStatus:{label:"voice",detailKeys:["guildId","userId"]},eventList:{label:"events",detailKeys:["guildId"]},eventCreate:{label:"event create",detailKeys:["guildId","name"]},timeout:{label:"timeout",detailKeys:["guildId","userId"]},kick:{label:"kick",detailKeys:["guildId","userId"]},ban:{label:"ban",detailKeys:["guildId","userId"]}}},slack:{icon:"messageSquare",title:"Slack",actions:{react:{label:"react",detailKeys:["channelId","messageId","emoji"]},reactions:{label:"reactions",detailKeys:["channelId","messageId"]},sendMessage:{label:"send",detailKeys:["to","content"]},editMessage:{label:"edit",detailKeys:["channelId","messageId"]},deleteMessage:{label:"delete",detailKeys:["channelId","messageId"]},readMessages:{label:"read messages",detailKeys:["channelId","limit"]},pinMessage:{label:"pin",detailKeys:["channelId","messageId"]},unpinMessage:{label:"unpin",detailKeys:["channelId","messageId"]},listPins:{label:"list pins",detailKeys:["channelId"]},memberInfo:{label:"member",detailKeys:["userId"]},emojiList:{label:"emoji list"}}}},yv={fallback:vv,tools:bv},Nc=yv,wr=Nc.fallback??{icon:"puzzle"},xv=Nc.tools??{};function wv(e){return(e??"tool").trim()}function $v(e){const t=e.replace(/_/g," ").trim();return t?t.split(/\s+/).map(n=>n.length<=2&&n.toUpperCase()===n?n:`${n.at(0)?.toUpperCase()??""}${n.slice(1)}`).join(" "):"Tool"}function kv(e){const t=e?.trim();if(t)return t.replace(/_/g," ")}function Oc(e){if(e!=null){if(typeof e=="string"){const t=e.trim();if(!t)return;const n=t.split(/\r?\n/)[0]?.trim()??"";return n?n.length>160?`${n.slice(0,157)}…`:n:void 0}if(typeof e=="number"||typeof e=="boolean")return String(e);if(Array.isArray(e)){const t=e.map(s=>Oc(s)).filter(s=>!!s);if(t.length===0)return;const n=t.slice(0,3).join(", ");return t.length>3?`${n}…`:n}}}function Sv(e,t){if(!e||typeof e!="object")return;let n=e;for(const s of t.split(".")){if(!s||!n||typeof n!="object")return;n=n[s]}return n}function Av(e,t){for(const n of t){const s=Sv(e,n),i=Oc(s);if(i)return i}}function Cv(e){if(!e||typeof e!="object")return;const t=e,n=typeof t.path=="string"?t.path:void 0;if(!n)return;const s=typeof t.offset=="number"?t.offset:void 0,i=typeof t.limit=="number"?t.limit:void 0;return s!==void 0&&i!==void 0?`${n}:${s}-${s+i}`:n}function Tv(e){if(!e||typeof e!="object")return;const t=e;return typeof t.path=="string"?t.path:void 0}function _v(e,t){if(!(!e||!t))return e.actions?.[t]??void 0}function Ev(e){const t=wv(e.name),n=t.toLowerCase(),s=xv[n],i=s?.icon??wr.icon??"puzzle",a=s?.title??$v(t),o=s?.label??t,l=e.args&&typeof e.args=="object"?e.args.action:void 0,c=typeof l=="string"?l.trim():void 0,p=_v(s,c),g=kv(p?.label??c);let u;n==="read"&&(u=Cv(e.args)),!u&&(n==="write"||n==="edit"||n==="attach")&&(u=Tv(e.args));const h=p?.detailKeys??s?.detailKeys??wr.detailKeys??[];return!u&&h.length>0&&(u=Av(e.args,h)),!u&&e.meta&&(u=e.meta),u&&(u=Iv(u)),{name:t,icon:i,title:a,label:o,verb:g,detail:u}}function Lv(e){const t=[];if(e.verb&&t.push(e.verb),e.detail&&t.push(e.detail),t.length!==0)return t.join(" · ")}function Iv(e){return e&&e.replace(/\/Users\/[^/]+/g,"~").replace(/\/home\/[^/]+/g,"~")}const Mv=80,Rv=2,$r=100;function Pv(e){const t=e.trim();if(t.startsWith("{")||t.startsWith("["))try{const n=JSON.parse(t);return"```json\n"+JSON.stringify(n,null,2)+"\n```"}catch{}return e}function Dv(e){const t=e.split(`
`),n=t.slice(0,Rv),s=n.join(`
`);return s.length>$r?s.slice(0,$r)+"…":n.length<t.length?s+"…":s}function Fv(e){const t=e,n=Nv(t.content),s=[];for(const i of n){const a=(typeof i.type=="string"?i.type:"").toLowerCase();(["toolcall","tool_call","tooluse","tool_use"].includes(a)||typeof i.name=="string"&&i.arguments!=null)&&s.push({kind:"call",name:i.name??"tool",args:Ov(i.arguments??i.args)})}for(const i of n){const a=(typeof i.type=="string"?i.type:"").toLowerCase();if(a!=="toolresult"&&a!=="tool_result")continue;const o=Bv(i),l=typeof i.name=="string"?i.name:"tool";s.push({kind:"result",name:l,text:o})}if(Fc(e)&&!s.some(i=>i.kind==="result")){const i=typeof t.toolName=="string"&&t.toolName||typeof t.tool_name=="string"&&t.tool_name||"tool",a=Kl(e)??void 0;s.push({kind:"result",name:i,text:a})}return s}function kr(e,t){const n=Ev({name:e.name,args:e.args}),s=Lv(n),i=!!e.text?.trim(),a=!!t,o=a?()=>{if(i){t(Pv(e.text));return}const u=`## ${n.label}

${s?`**Command:** \`${s}\`

`:""}*No output — tool completed successfully.*`;t(u)}:void 0,l=i&&(e.text?.length??0)<=Mv,c=i&&!l,p=i&&l,g=!i;return r`
    <div
      class="chat-tool-card ${a?"chat-tool-card--clickable":""}"
      @click=${o}
      role=${a?"button":v}
      tabindex=${a?"0":v}
      @keydown=${a?u=>{u.key!=="Enter"&&u.key!==" "||(u.preventDefault(),o?.())}:v}
    >
      <div class="chat-tool-card__header">
        <div class="chat-tool-card__title">
          <span class="chat-tool-card__icon">${pe[n.icon]}</span>
          <span>${n.label}</span>
        </div>
        ${a?r`<span class="chat-tool-card__action">${i?"View":""} ${pe.check}</span>`:v}
        ${g&&!a?r`<span class="chat-tool-card__status">${pe.check}</span>`:v}
      </div>
      ${s?r`<div class="chat-tool-card__detail">${s}</div>`:v}
      ${g?r`
              <div class="chat-tool-card__status-text muted">Completed</div>
            `:v}
      ${c?r`<div class="chat-tool-card__preview mono">${Dv(e.text)}</div>`:v}
      ${p?r`<div class="chat-tool-card__inline mono">${e.text}</div>`:v}
    </div>
  `}function Nv(e){return Array.isArray(e)?e.filter(Boolean):[]}function Ov(e){if(typeof e!="string")return e;const t=e.trim();if(!t||!t.startsWith("{")&&!t.startsWith("["))return e;try{return JSON.parse(t)}catch{return e}}function Bv(e){if(typeof e.text=="string")return e.text;if(typeof e.content=="string")return e.content}function Uv(e){const n=e.content,s=[];if(Array.isArray(n))for(const i of n){if(typeof i!="object"||i===null)continue;const a=i;if(a.type==="image"){const o=a.source;if(o?.type==="base64"&&typeof o.data=="string"){const l=o.data,c=o.media_type||"image/png",p=l.startsWith("data:")?l:`data:${c};base64,${l}`;s.push({url:p})}else typeof a.url=="string"&&s.push({url:a.url})}else if(a.type==="image_url"){const o=a.image_url;typeof o?.url=="string"&&s.push({url:o.url})}}return s}function Hv(e){return r`
    <div class="chat-group assistant">
      ${Ua("assistant",e)}
      <div class="chat-group-messages">
        <div class="chat-bubble chat-reading-indicator" aria-hidden="true">
          <span class="chat-reading-indicator__dots">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    </div>
  `}function zv(e,t,n,s){const i=new Date(t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}),a=s?.name??"Assistant";return r`
    <div class="chat-group assistant">
      ${Ua("assistant",s)}
      <div class="chat-group-messages">
        ${Bc({role:"assistant",content:[{type:"text",text:e}],timestamp:t},{isStreaming:!0,showReasoning:!1},n)}
        <div class="chat-group-footer">
          <span class="chat-sender-name">${a}</span>
          <span class="chat-group-timestamp">${i}</span>
        </div>
      </div>
    </div>
  `}function jv(e,t){const n=Ba(e.role),s=t.assistantName??"Assistant",i=n==="user"?"You":n==="assistant"?s:n,a=n==="user"?"user":n==="assistant"?"assistant":"other",o=new Date(e.timestamp).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});return r`
    <div class="chat-group ${a}">
      ${Ua(e.role,{name:s,avatar:t.assistantAvatar??null})}
      <div class="chat-group-messages">
        ${e.messages.map((l,c)=>Bc(l.message,{isStreaming:e.isStreaming&&c===e.messages.length-1,showReasoning:t.showReasoning},t.onOpenSidebar))}
        <div class="chat-group-footer">
          <span class="chat-sender-name">${i}</span>
          <span class="chat-group-timestamp">${o}</span>
        </div>
      </div>
    </div>
  `}function Ua(e,t){const n=Ba(e),s=t?.name?.trim()||"Assistant",i=t?.avatar?.trim()||"",a=n==="user"?"U":n==="assistant"?s.charAt(0).toUpperCase()||"A":n==="tool"?"⚙":"?",o=n==="user"?"user":n==="assistant"?"assistant":n==="tool"?"tool":"other";return n==="assistant"?i&&Kv(i)?r`<img
        class="chat-avatar ${o}"
        src="${i}"
        alt="${s}"
      />`:r`<div class="chat-avatar ${o}">${pe.bot}</div>`:r`<div class="chat-avatar ${o}">${a}</div>`}function Kv(e){return/^https?:\/\//i.test(e)||/^data:image\//i.test(e)||e.startsWith("/")}function Vv(e){return e.length===0?v:r`
    <div class="chat-message-images">
      ${e.map(t=>r`
          <img
            src=${t.url}
            alt=${t.alt??"Attached image"}
            class="chat-message-image"
            @click=${()=>window.open(t.url,"_blank")}
          />
        `)}
    </div>
  `}function Bc(e,t,n){const s=e,i=typeof s.role=="string"?s.role:"unknown",a=Fc(e)||i.toLowerCase()==="toolresult"||i.toLowerCase()==="tool_result"||typeof s.toolCallId=="string"||typeof s.tool_call_id=="string",o=Fv(e),l=o.length>0,c=Uv(e),p=c.length>0;if(!!s._synthetic&&a)return v;const u=Kl(e),h=t.showReasoning&&i==="assistant"?Gp(e):null,f=u?.trim()?u:null,d=h?Yp(h):null,m=f,k=i==="assistant"&&!!m?.trim(),S=["chat-bubble",k?"has-copy":"",t.isStreaming?"streaming":"","fade-in"].filter(Boolean).join(" ");return!m&&l&&a?r`${o.map($=>kr($,n))}`:!m&&!l&&!p?v:r`
    <div class="${S}">
      ${k?mv(m):v}
      ${Vv(c)}
      ${d?r`<div class="chat-thinking">${Fi(Ki(d))}</div>`:v}
      ${m?r`<div class="chat-text">${Fi(Ki(m))}</div>`:v}
      ${o.map($=>kr($,n))}
    </div>
  `}const Sr=2e3;function Wv(e){const t=new Date(e),n=String(t.getHours()).padStart(2,"0"),s=String(t.getMinutes()).padStart(2,"0"),i=String(t.getSeconds()).padStart(2,"0");return`${n}:${s}:${i}`}function qv(e){const t=e.stream==="stderr"?"exec-log__line--stderr":e.stream==="system"?"exec-log__line--system":"",n=e.text.split(`
`),s=Wv(e.ts);return n.map((i,a)=>r`
      <div class="exec-log__line ${t}">
        ${a===0?r`<span class="exec-log__timestamp">${s}</span>`:r`
                <span class="exec-log__timestamp-pad"></span>
              `}
        <span class="exec-log__text">${i||" "}</span>
      </div>
    `)}function Gv(e){const t=e.entries.length>Sr?e.entries.slice(-Sr):e.entries,n=t.reduce((s,i)=>s+i.text.split(`
`).length,0);return r`
    <div class="exec-log">
      <div class="exec-log__header">
        <div class="exec-log__header-left">
          <span class="exec-log__title">Execution Log</span>
          <span class="exec-log__status ${e.isActive?"exec-log__status--active":""}">
            ${e.isActive?"● Running":"○ Idle"}
          </span>
        </div>
        <div class="exec-log__header-right">
          <button
            class="exec-log__btn"
            @click=${e.onClear}
            title="Clear log"
          >
            <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
          <button
            class="exec-log__btn"
            @click=${e.onClose}
            title="Close log console"
          >
            ${pe.x}
          </button>
        </div>
      </div>

      <div
        class="exec-log__body"
        ${Ta(s=>{s&&e.autoScroll&&t.length>0&&requestAnimationFrame(()=>{s.scrollTop=s.scrollHeight})})}
      >
        ${t.length===0?r`
                <div class="exec-log__empty">Waiting for execution output…</div>
              `:t.map(s=>qv(s))}
      </div>

      <div class="exec-log__footer">
        <span class="exec-log__line-count">${n} lines</span>
        <button
          class="exec-log__btn exec-log__auto-scroll ${e.autoScroll?"exec-log__auto-scroll--on":""}"
          @click=${e.onToggleAutoScroll}
          title="${e.autoScroll?"Auto-scroll ON":"Auto-scroll OFF"}"
        >
          ⬇ ${e.autoScroll?"Auto":"Manual"}
        </button>
      </div>
    </div>
  `}function Qv(e){return r`
    <div class="sidebar-panel">
      <div class="sidebar-header">
        <div class="sidebar-title">Tool Output</div>
        <button @click=${e.onClose} class="btn" title="Close sidebar">
          ${pe.x}
        </button>
      </div>
      <div class="sidebar-content">
        ${e.error?r`
              <div class="callout danger">${e.error}</div>
              <button @click=${e.onViewRawText} class="btn" style="margin-top: 12px;">
                View Raw Text
              </button>
            `:e.content?r`<div class="sidebar-markdown">${Fi(Ki(e.content))}</div>`:r`
                  <div class="muted">No content available</div>
                `}
      </div>
    </div>
  `}var Yv=Object.defineProperty,Jv=Object.getOwnPropertyDescriptor,Es=(e,t,n,s)=>{for(var i=s>1?void 0:s?Jv(t,n):t,a=e.length-1,o;a>=0;a--)(o=e[a])&&(i=(s?o(t,n,i):o(i))||i);return s&&i&&Yv(t,n,i),i};let Wt=class extends nt{constructor(){super(...arguments),this.splitRatio=.6,this.minRatio=.4,this.maxRatio=.7,this.isDragging=!1,this.startX=0,this.startRatio=0,this.handleMouseDown=e=>{this.isDragging=!0,this.startX=e.clientX,this.startRatio=this.splitRatio,this.classList.add("dragging"),document.addEventListener("mousemove",this.handleMouseMove),document.addEventListener("mouseup",this.handleMouseUp),e.preventDefault()},this.handleMouseMove=e=>{if(!this.isDragging)return;const t=this.parentElement;if(!t)return;const n=t.getBoundingClientRect().width,i=(e.clientX-this.startX)/n;let a=this.startRatio+i;a=Math.max(this.minRatio,Math.min(this.maxRatio,a)),this.dispatchEvent(new CustomEvent("resize",{detail:{splitRatio:a},bubbles:!0,composed:!0}))},this.handleMouseUp=()=>{this.isDragging=!1,this.classList.remove("dragging"),document.removeEventListener("mousemove",this.handleMouseMove),document.removeEventListener("mouseup",this.handleMouseUp)}}render(){return v}connectedCallback(){super.connectedCallback(),this.addEventListener("mousedown",this.handleMouseDown)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("mousedown",this.handleMouseDown),document.removeEventListener("mousemove",this.handleMouseMove),document.removeEventListener("mouseup",this.handleMouseUp)}};Wt.styles=Qi`
    :host {
      width: 4px;
      cursor: col-resize;
      background: var(--border, #333);
      transition: background 150ms ease-out;
      flex-shrink: 0;
      position: relative;
    }
    :host::before {
      content: "";
      position: absolute;
      top: 0;
      left: -4px;
      right: -4px;
      bottom: 0;
    }
    :host(:hover) {
      background: var(--accent, #007bff);
    }
    :host(.dragging) {
      background: var(--accent, #007bff);
    }
  `;Es([Ze({type:Number})],Wt.prototype,"splitRatio",2);Es([Ze({type:Number})],Wt.prototype,"minRatio",2);Es([Ze({type:Number})],Wt.prototype,"maxRatio",2);Wt=Es([hs("resizable-divider")],Wt);const Zv=5e3;function Ar(e){e.style.height="auto",e.style.height=`${e.scrollHeight}px`}function Xv(e){return e?e.active?r`
      <div class="compaction-indicator compaction-indicator--active" role="status" aria-live="polite">
        ${pe.loader} Compacting context...
      </div>
    `:e.completedAt&&Date.now()-e.completedAt<Zv?r`
        <div class="compaction-indicator compaction-indicator--complete" role="status" aria-live="polite">
          ${pe.check} Context compacted
        </div>
      `:v:v}function eb(){return`att-${Date.now()}-${Math.random().toString(36).slice(2,9)}`}function tb(e,t){const n=e.clipboardData?.items;if(!n||!t.onAttachmentsChange)return;const s=[];for(let i=0;i<n.length;i++){const a=n[i];a.type.startsWith("image/")&&s.push(a)}if(s.length!==0){e.preventDefault();for(const i of s){const a=i.getAsFile();if(!a)continue;const o=new FileReader;o.addEventListener("load",()=>{const l=o.result,c={id:eb(),dataUrl:l,mimeType:a.type},p=t.attachments??[];t.onAttachmentsChange?.([...p,c])}),o.readAsDataURL(a)}}}function nb(e){const t=e.attachments??[];return t.length===0?v:r`
    <div class="chat-attachments">
      ${t.map(n=>r`
          <div class="chat-attachment">
            <img
              src=${n.dataUrl}
              alt="Attachment preview"
              class="chat-attachment__img"
            />
            <button
              class="chat-attachment__remove"
              type="button"
              aria-label="Remove attachment"
              @click=${()=>{const s=(e.attachments??[]).filter(i=>i.id!==n.id);e.onAttachmentsChange?.(s)}}
            >
              ${pe.x}
            </button>
          </div>
        `)}
    </div>
  `}function sb(e){const t=e.connected,n=e.sending||e.stream!==null,s=!!(e.canAbort&&e.onAbort),a=e.sessions?.sessions?.find(m=>m.key===e.sessionKey)?.reasoningLevel??"off",o=e.showThinking&&a!=="off",l={name:e.assistantName,avatar:e.assistantAvatar??e.assistantAvatarUrl??null},c=(e.attachments?.length??0)>0,p=e.connected?c?"Add a message or paste more images...":"Message (↩ to send, Shift+↩ for line breaks, paste images)":"Connect to the gateway to start chatting…",g=e.splitRatio??.6,u=e.sidebarMode??(e.sidebarOpen?"markdown":null),h=!!(u&&e.sidebarOpen),f=(e.execLogEntries?.length??0)>0,d=r`
    <div
      class="chat-thread"
      role="log"
      aria-live="polite"
      @scroll=${e.onChatScroll}
    >
      ${e.loading?r`
              <div class="muted">Loading chat…</div>
            `:v}
      ${kt(ab(e),m=>m.key,m=>m.kind==="divider"?r`
              <div class="chat-divider" role="separator" data-ts=${String(m.timestamp)}>
                <span class="chat-divider__line"></span>
                <span class="chat-divider__label">${m.label}</span>
                <span class="chat-divider__line"></span>
              </div>
            `:m.kind==="reading-indicator"?Hv(l):m.kind==="stream"?zv(m.text,m.startedAt,e.onOpenSidebar,l):m.kind==="group"?jv(m,{onOpenSidebar:e.onOpenSidebar,showReasoning:o,assistantName:e.assistantName,assistantAvatar:l.avatar}):v)}
    </div>
  `;return r`
    <section class="card chat">
      ${e.disabledReason?r`<div class="callout">${e.disabledReason}</div>`:v}

      ${e.error?r`<div class="callout danger">${e.error}</div>`:v}

      ${e.focusMode?r`
            <button
              class="chat-focus-exit"
              type="button"
              @click=${e.onToggleFocusMode}
              aria-label="Exit focus mode"
              title="Exit focus mode"
            >
              ${pe.x}
            </button>
          `:v}

      <div
        class="chat-split-container ${h?"chat-split-container--open":""}"
      >
        <div
          class="chat-main"
          style="flex: ${h?`0 0 ${g*100}%`:"1 1 100%"}"
        >
          ${d}
        </div>

        ${h?r`
              <resizable-divider
                .splitRatio=${g}
                @resize=${m=>e.onSplitRatioChange?.(m.detail.splitRatio)}
              ></resizable-divider>
              <div class="chat-sidebar">
                ${u==="exec-log"?Gv({entries:e.execLogEntries??[],isActive:e.execLogActive??!1,autoScroll:e.execLogAutoScroll??!0,onClose:()=>e.onCloseExecLog?.(),onClear:()=>e.onClearExecLog?.(),onToggleAutoScroll:()=>e.onToggleExecLogAutoScroll?.()}):Qv({content:e.sidebarContent??null,error:e.sidebarError??null,onClose:e.onCloseSidebar,onViewRawText:()=>{!e.sidebarContent||!e.onOpenSidebar||e.onOpenSidebar(`\`\`\`
${e.sidebarContent}
\`\`\``)}})}
              </div>
            `:v}
      </div>

      ${e.queue.length?r`
            <div class="chat-queue" role="status" aria-live="polite">
              <div class="chat-queue__title">Queued (${e.queue.length})</div>
              <div class="chat-queue__list">
                ${e.queue.map(m=>r`
                    <div class="chat-queue__item">
                      <div class="chat-queue__text">
                        ${m.text||(m.attachments?.length?`Image (${m.attachments.length})`:"")}
                      </div>
                      <button
                        class="btn chat-queue__remove"
                        type="button"
                        aria-label="Remove queued message"
                        @click=${()=>e.onQueueRemove(m.id)}
                      >
                        ${pe.x}
                      </button>
                    </div>
                  `)}
              </div>
            </div>
          `:v}

      ${Xv(e.compactionStatus)}

      ${e.showNewMessages?r`
            <button
              class="btn chat-new-messages"
              type="button"
              @click=${e.onScrollToBottom}
            >
              New messages ${pe.arrowDown}
            </button>
          `:v}

      <div class="chat-compose">
        ${nb(e)}
        <div class="chat-compose__row">
          <label class="field chat-compose__field">
            <span>Message</span>
            <textarea
              ${Ta(m=>m&&Ar(m))}
              .value=${e.draft}
              ?disabled=${!e.connected}
              @keydown=${m=>{m.key==="Enter"&&(m.isComposing||m.keyCode===229||m.shiftKey||e.connected&&(m.preventDefault(),t&&e.onSend()))}}
              @input=${m=>{const k=m.target;Ar(k),e.onDraftChange(k.value)}}
              @paste=${m=>tb(m,e)}
              placeholder=${p}
            ></textarea>
          </label>
          <div class="chat-compose__actions">
            ${f&&u!=="exec-log"?r`
                  <button
                    class="btn chat-compose__exec-log-btn ${e.execLogActive?"chat-compose__exec-log-btn--active":""}"
                    title="Show execution log"
                    @click=${()=>e.onOpenExecLog?.()}
                  >
                    ▸ Log
                  </button>
                `:v}
            <button
              class="btn"
              ?disabled=${!e.connected||!s&&e.sending}
              @click=${s?e.onAbort:e.onNewSession}
            >
              ${s?"Stop":"New session"}
            </button>
            <button
              class="btn primary"
              ?disabled=${!e.connected}
              @click=${e.onSend}
            >
              ${n?"Queue":"Send"}<kbd class="btn-kbd">↵</kbd>
            </button>
          </div>
        </div>
      </div>
    </section>
  `}const Cr=200;function ib(e){const t=[];let n=null;for(const s of e){if(s.kind!=="message"){n&&(t.push(n),n=null),t.push(s);continue}const i=Dc(s.message),a=Ba(i.role),o=i.timestamp||Date.now();!n||n.role!==a?(n&&t.push(n),n={kind:"group",key:`group:${a}:${s.key}`,role:a,messages:[{message:s.message,key:s.key}],timestamp:o,isStreaming:!1}):n.messages.push({message:s.message,key:s.key})}return n&&t.push(n),t}function ab(e){const t=[],n=Array.isArray(e.messages)?e.messages:[],s=Array.isArray(e.toolMessages)?e.toolMessages:[],i=Math.max(0,n.length-Cr);i>0&&t.push({kind:"message",key:"chat:history:notice",message:{role:"system",content:`Showing last ${Cr} messages (${i} hidden).`,timestamp:Date.now()}});for(let a=i;a<n.length;a++){const o=n[a],l=Dc(o),p=o.__winclaw;if(p&&p.kind==="compaction"){t.push({kind:"divider",key:typeof p.id=="string"?`divider:compaction:${p.id}`:`divider:compaction:${l.timestamp}:${a}`,label:"Compaction",timestamp:l.timestamp??Date.now()});continue}!e.showThinking&&l.role.toLowerCase()==="toolresult"||t.push({kind:"message",key:Tr(o,a),message:o})}if(e.showThinking)for(let a=0;a<s.length;a++)t.push({kind:"message",key:Tr(s[a],a+n.length),message:s[a]});if(e.stream!==null){const a=`stream:${e.sessionKey}:${e.streamStartedAt??"live"}`;e.stream.trim().length>0?t.push({kind:"stream",key:a,text:e.stream,startedAt:e.streamStartedAt??Date.now()}):t.push({kind:"reading-indicator",key:a})}return ib(t)}function Tr(e,t){const n=e,s=typeof n.toolCallId=="string"?n.toolCallId:"";if(s)return`tool:${s}`;const i=typeof n.id=="string"?n.id:"";if(i)return`msg:${i}`;const a=typeof n.messageId=="string"?n.messageId:"";if(a)return`msg:${a}`;const o=typeof n.timestamp=="number"?n.timestamp:null,l=typeof n.role=="string"?n.role:"unknown";return o!=null?`msg:${l}:${o}:${t}`:`msg:${l}:${t}`}const Vi={all:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  `,env:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      ></path>
    </svg>
  `,update:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `,agents:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path
        d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"
      ></path>
      <circle cx="8" cy="14" r="1"></circle>
      <circle cx="16" cy="14" r="1"></circle>
    </svg>
  `,auth:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  `,channels:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `,messages:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
  `,commands:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 17 10 11 4 5"></polyline>
      <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
  `,hooks:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
  `,skills:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
      ></polygon>
    </svg>
  `,tools:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      ></path>
    </svg>
  `,gateway:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      ></path>
    </svg>
  `,wizard:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M15 4V2"></path>
      <path d="M15 16v-2"></path>
      <path d="M8 9h2"></path>
      <path d="M20 9h2"></path>
      <path d="M17.8 11.8 19 13"></path>
      <path d="M15 9h0"></path>
      <path d="M17.8 6.2 19 5"></path>
      <path d="m3 21 9-9"></path>
      <path d="M12.2 6.2 11 5"></path>
    </svg>
  `,meta:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>
  `,logging:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  `,browser:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="4"></circle>
      <line x1="21.17" y1="8" x2="12" y2="8"></line>
      <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
      <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
    </svg>
  `,ui:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="9" y1="21" x2="9" y2="9"></line>
    </svg>
  `,models:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
      ></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  `,bindings:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
      <line x1="6" y1="6" x2="6.01" y2="6"></line>
      <line x1="6" y1="18" x2="6.01" y2="18"></line>
    </svg>
  `,broadcast:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
      <circle cx="12" cy="12" r="2"></circle>
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path>
    </svg>
  `,audio:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  `,session:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  `,cron:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  `,web:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      ></path>
    </svg>
  `,discovery:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  `,canvasHost:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  `,talk:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
  `,plugins:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2v6"></path>
      <path d="m4.93 10.93 4.24 4.24"></path>
      <path d="M2 12h6"></path>
      <path d="m4.93 13.07 4.24-4.24"></path>
      <path d="M12 22v-6"></path>
      <path d="m19.07 13.07-4.24-4.24"></path>
      <path d="M22 12h-6"></path>
      <path d="m19.07 10.93-4.24 4.24"></path>
    </svg>
  `,default:r`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  `},_r=[{key:"env",label:"Environment"},{key:"update",label:"Updates"},{key:"agents",label:"Agents"},{key:"auth",label:"Authentication"},{key:"channels",label:"Channels"},{key:"messages",label:"Messages"},{key:"commands",label:"Commands"},{key:"hooks",label:"Hooks"},{key:"skills",label:"Skills"},{key:"tools",label:"Tools"},{key:"gateway",label:"Gateway"},{key:"wizard",label:"Setup Wizard"}],Er="__all__";function Lr(e){return Vi[e]??Vi.default}function ob(e,t){const n=Ea[e];return n||{label:t?.title??Xe(e),description:t?.description??""}}function rb(e){const{key:t,schema:n,uiHints:s}=e;if(!n||ze(n)!=="object"||!n.properties)return[];const i=Object.entries(n.properties).map(([a,o])=>{const l=Le([t,a],s),c=l?.label??o.title??Xe(a),p=l?.help??o.description??"",g=l?.order??50;return{key:a,label:c,description:p,order:g}});return i.sort((a,o)=>a.order!==o.order?a.order-o.order:a.key.localeCompare(o.key)),i}function lb(e,t){if(!e||!t)return[];const n=[];function s(i,a,o){if(i===a)return;if(typeof i!=typeof a){n.push({path:o,from:i,to:a});return}if(typeof i!="object"||i===null||a===null){i!==a&&n.push({path:o,from:i,to:a});return}if(Array.isArray(i)&&Array.isArray(a)){JSON.stringify(i)!==JSON.stringify(a)&&n.push({path:o,from:i,to:a});return}const l=i,c=a,p=new Set([...Object.keys(l),...Object.keys(c)]);for(const g of p)s(l[g],c[g],o?`${o}.${g}`:g)}return s(e,t,""),n}function Ir(e,t=40){let n;try{n=JSON.stringify(e)??String(e)}catch{n=String(e)}return n.length<=t?n:n.slice(0,t-3)+"..."}function cb(e){const t=e.valid==null?"unknown":e.valid?"valid":"invalid",n=fc(e.schema),s=n.schema?n.unsupportedPaths.length>0:!1,i=n.schema?.properties??{},a=_r.filter(E=>E.key in i),o=new Set(_r.map(E=>E.key)),l=Object.keys(i).filter(E=>!o.has(E)).map(E=>({key:E,label:E.charAt(0).toUpperCase()+E.slice(1)})),c=[...a,...l],p=e.activeSection&&n.schema&&ze(n.schema)==="object"?n.schema.properties?.[e.activeSection]:void 0,g=e.activeSection?ob(e.activeSection,p):null,u=e.activeSection?rb({key:e.activeSection,schema:p,uiHints:e.uiHints}):[],h=e.formMode==="form"&&!!e.activeSection&&u.length>0,f=e.activeSubsection===Er,d=e.searchQuery||f?null:e.activeSubsection??u[0]?.key??null,m=e.formMode==="form"?lb(e.originalValue,e.formValue):[],k=e.formMode==="raw"&&e.raw!==e.originalRaw,S=e.formMode==="form"?m.length>0:k,$=!!e.formValue&&!e.loading&&!!n.schema,C=e.connected&&!e.saving&&S&&(e.formMode==="raw"?!0:$),A=e.connected&&!e.applying&&!e.updating&&S&&(e.formMode==="raw"?!0:$),T=e.connected&&!e.applying&&!e.updating;return r`
    <div class="config-layout">
      <!-- Sidebar -->
      <aside class="config-sidebar">
        <div class="config-sidebar__header">
          <div class="config-sidebar__title">${_("settings.title")}</div>
          <span
            class="pill pill--sm ${t==="valid"?"pill--ok":t==="invalid"?"pill--danger":""}"
            >${t}</span
          >
        </div>

        <!-- Search -->
        <div class="config-search">
          <svg
            class="config-search__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            class="config-search__input"
            placeholder="Search settings..."
            .value=${e.searchQuery}
            @input=${E=>e.onSearchChange(E.target.value)}
          />
          ${e.searchQuery?r`
                <button
                  class="config-search__clear"
                  @click=${()=>e.onSearchChange("")}
                >
                  ×
                </button>
              `:v}
        </div>

        <!-- Section nav -->
        <nav class="config-nav">
          <button
            class="config-nav__item ${e.activeSection===null?"active":""}"
            @click=${()=>e.onSectionChange(null)}
          >
            <span class="config-nav__icon">${Vi.all}</span>
            <span class="config-nav__label">All Settings</span>
          </button>
          ${c.map(E=>r`
              <button
                class="config-nav__item ${e.activeSection===E.key?"active":""}"
                @click=${()=>e.onSectionChange(E.key)}
              >
                <span class="config-nav__icon"
                  >${Lr(E.key)}</span
                >
                <span class="config-nav__label">${E.label}</span>
              </button>
            `)}
        </nav>

        <!-- Mode toggle at bottom -->
        <div class="config-sidebar__footer">
          <div class="config-mode-toggle">
            <button
              class="config-mode-toggle__btn ${e.formMode==="form"?"active":""}"
              ?disabled=${e.schemaLoading||!e.schema}
              @click=${()=>e.onFormModeChange("form")}
            >
              Form
            </button>
            <button
              class="config-mode-toggle__btn ${e.formMode==="raw"?"active":""}"
              @click=${()=>e.onFormModeChange("raw")}
            >
              Raw
            </button>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <main class="config-main">
        <!-- Action bar -->
        <div class="config-actions">
          <div class="config-actions__left">
            ${S?r`
                  <span class="config-changes-badge"
                    >${e.formMode==="raw"?"Unsaved changes":`${m.length} unsaved change${m.length!==1?"s":""}`}</span
                  >
                `:r`
                    <span class="config-status muted">No changes</span>
                  `}
          </div>
          <div class="config-actions__right">
            <button
              class="btn btn--sm"
              ?disabled=${e.loading}
              @click=${e.onReload}
            >
              ${e.loading?"Loading…":"Reload"}
            </button>
            <button
              class="btn btn--sm primary"
              ?disabled=${!C}
              @click=${e.onSave}
            >
              ${e.saving?"Saving…":"Save"}
            </button>
            <button
              class="btn btn--sm"
              ?disabled=${!A}
              @click=${e.onApply}
            >
              ${e.applying?"Applying…":"Apply"}
            </button>
            <button
              class="btn btn--sm"
              ?disabled=${!T}
              @click=${e.onUpdate}
            >
              ${e.updating?"Updating…":"Update"}
            </button>
          </div>
        </div>

        <!-- Diff panel (form mode only - raw mode doesn't have granular diff) -->
        ${S&&e.formMode==="form"?r`
              <details class="config-diff">
                <summary class="config-diff__summary">
                  <span
                    >View ${m.length} pending
                    change${m.length!==1?"s":""}</span
                  >
                  <svg
                    class="config-diff__chevron"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </summary>
                <div class="config-diff__content">
                  ${m.map(E=>r`
                      <div class="config-diff__item">
                        <div class="config-diff__path">${E.path}</div>
                        <div class="config-diff__values">
                          <span class="config-diff__from"
                            >${Ir(E.from)}</span
                          >
                          <span class="config-diff__arrow">→</span>
                          <span class="config-diff__to"
                            >${Ir(E.to)}</span
                          >
                        </div>
                      </div>
                    `)}
                </div>
              </details>
            `:v}
        ${g&&e.formMode==="form"?r`
              <div class="config-section-hero">
                <div class="config-section-hero__icon">
                  ${Lr(e.activeSection??"")}
                </div>
                <div class="config-section-hero__text">
                  <div class="config-section-hero__title">
                    ${g.label}
                  </div>
                  ${g.description?r`<div class="config-section-hero__desc">
                        ${g.description}
                      </div>`:v}
                </div>
              </div>
            `:v}
        ${h?r`
              <div class="config-subnav">
                <button
                  class="config-subnav__item ${d===null?"active":""}"
                  @click=${()=>e.onSubsectionChange(Er)}
                >
                  All
                </button>
                ${u.map(E=>r`
                    <button
                      class="config-subnav__item ${d===E.key?"active":""}"
                      title=${E.description||E.label}
                      @click=${()=>e.onSubsectionChange(E.key)}
                    >
                      ${E.label}
                    </button>
                  `)}
              </div>
            `:v}

        <!-- Form content -->
        <div class="config-content">
          ${e.formMode==="form"?r`
                ${e.schemaLoading?r`
                        <div class="config-loading">
                          <div class="config-loading__spinner"></div>
                          <span>Loading schema…</span>
                        </div>
                      `:bf({schema:n.schema,uiHints:e.uiHints,value:e.formValue,disabled:e.loading||!e.formValue,unsupportedPaths:n.unsupportedPaths,onPatch:e.onFormPatch,searchQuery:e.searchQuery,activeSection:e.activeSection,activeSubsection:d})}
                ${s?r`
                        <div class="callout danger" style="margin-top: 12px">
                          Form view can't safely edit some fields. Use Raw to avoid losing config entries.
                        </div>
                      `:v}
              `:r`
                <label class="field config-raw-field">
                  <span>Raw JSON5</span>
                  <textarea
                    .value=${e.raw}
                    @input=${E=>e.onRawChange(E.target.value)}
                  ></textarea>
                </label>
              `}
        </div>

        ${e.issues.length>0?r`<div class="callout danger" style="margin-top: 12px;">
              <pre class="code-block">
${JSON.stringify(e.issues,null,2)}</pre
              >
            </div>`:v}
      </main>
    </div>
  `}function db(e){const t=["last",...e.channels.filter(Boolean)],n=e.form.deliveryChannel?.trim();n&&!t.includes(n)&&t.push(n);const s=new Set;return t.filter(i=>s.has(i)?!1:(s.add(i),!0))}function ub(e,t){if(t==="last")return"last";const n=e.channelMeta?.find(s=>s.id===t);return n?.label?n.label:e.channelLabels?.[t]??t}function pb(e){const t=db(e),s=(e.runsJobId==null?void 0:e.jobs.find(a=>a.id===e.runsJobId))?.name??e.runsJobId??"(select a job)",i=e.runs.toSorted((a,o)=>o.ts-a.ts);return r`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Scheduler</div>
        <div class="card-sub">Gateway-owned cron scheduler status.</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Enabled</div>
            <div class="stat-value">
              ${e.status?e.status.enabled?"Yes":"No":"n/a"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Jobs</div>
            <div class="stat-value">${e.status?.jobs??"n/a"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Next wake</div>
            <div class="stat-value">${_a(e.status?.nextWakeAtMs??null)}</div>
          </div>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn" ?disabled=${e.loading} @click=${e.onRefresh}>
            ${e.loading?"Refreshing…":"Refresh"}
          </button>
          ${e.error?r`<span class="muted">${e.error}</span>`:v}
        </div>
      </div>

      <div class="card">
        <div class="card-title">New Job</div>
        <div class="card-sub">Create a scheduled wakeup or agent run.</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>Name</span>
            <input
              .value=${e.form.name}
              @input=${a=>e.onFormChange({name:a.target.value})}
            />
          </label>
          <label class="field">
            <span>Description</span>
            <input
              .value=${e.form.description}
              @input=${a=>e.onFormChange({description:a.target.value})}
            />
          </label>
          <label class="field">
            <span>Agent ID</span>
            <input
              .value=${e.form.agentId}
              @input=${a=>e.onFormChange({agentId:a.target.value})}
              placeholder="default"
            />
          </label>
          <label class="field checkbox">
            <span>Enabled</span>
            <input
              type="checkbox"
              .checked=${e.form.enabled}
              @change=${a=>e.onFormChange({enabled:a.target.checked})}
            />
          </label>
          <label class="field">
            <span>Schedule</span>
            <select
              .value=${e.form.scheduleKind}
              @change=${a=>e.onFormChange({scheduleKind:a.target.value})}
            >
              <option value="every">Every</option>
              <option value="at">At</option>
              <option value="cron">Cron</option>
            </select>
          </label>
        </div>
        ${gb(e)}
        <div class="form-grid" style="margin-top: 12px;">
          <label class="field">
            <span>Session</span>
            <select
              .value=${e.form.sessionTarget}
              @change=${a=>e.onFormChange({sessionTarget:a.target.value})}
            >
              <option value="main">Main</option>
              <option value="isolated">Isolated</option>
            </select>
          </label>
          <label class="field">
            <span>Wake mode</span>
            <select
              .value=${e.form.wakeMode}
              @change=${a=>e.onFormChange({wakeMode:a.target.value})}
            >
              <option value="now">Now</option>
              <option value="next-heartbeat">Next heartbeat</option>
            </select>
          </label>
          <label class="field">
            <span>Payload</span>
            <select
              .value=${e.form.payloadKind}
              @change=${a=>e.onFormChange({payloadKind:a.target.value})}
            >
              <option value="systemEvent">System event</option>
              <option value="agentTurn">Agent turn</option>
            </select>
          </label>
        </div>
        <label class="field" style="margin-top: 12px;">
          <span>${e.form.payloadKind==="systemEvent"?"System text":"Agent message"}</span>
          <textarea
            .value=${e.form.payloadText}
            @input=${a=>e.onFormChange({payloadText:a.target.value})}
            rows="4"
          ></textarea>
        </label>
        ${e.form.payloadKind==="agentTurn"?r`
                <div class="form-grid" style="margin-top: 12px;">
                  <label class="field">
                    <span>Delivery</span>
                    <select
                      .value=${e.form.deliveryMode}
                      @change=${a=>e.onFormChange({deliveryMode:a.target.value})}
                    >
                      <option value="announce">Announce summary (default)</option>
                      <option value="none">None (internal)</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Timeout (seconds)</span>
                    <input
                      .value=${e.form.timeoutSeconds}
                      @input=${a=>e.onFormChange({timeoutSeconds:a.target.value})}
                    />
                  </label>
                  ${e.form.deliveryMode==="announce"?r`
                          <label class="field">
                            <span>Channel</span>
                            <select
                              .value=${e.form.deliveryChannel||"last"}
                              @change=${a=>e.onFormChange({deliveryChannel:a.target.value})}
                            >
                              ${t.map(a=>r`<option value=${a}>
                                    ${ub(e,a)}
                                  </option>`)}
                            </select>
                          </label>
                          <label class="field">
                            <span>To</span>
                            <input
                              .value=${e.form.deliveryTo}
                              @input=${a=>e.onFormChange({deliveryTo:a.target.value})}
                              placeholder="+1555… or chat id"
                            />
                          </label>
                        `:v}
                </div>
              `:v}
        <div class="row" style="margin-top: 14px;">
          <button class="btn primary" ?disabled=${e.busy} @click=${e.onAdd}>
            ${e.busy?"Saving…":"Add job"}
          </button>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Jobs</div>
      <div class="card-sub">All scheduled jobs stored in the gateway.</div>
      ${e.jobs.length===0?r`
              <div class="muted" style="margin-top: 12px">No jobs yet.</div>
            `:r`
            <div class="list" style="margin-top: 12px;">
              ${e.jobs.map(a=>hb(a,e))}
            </div>
          `}
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Run history</div>
      <div class="card-sub">Latest runs for ${s}.</div>
      ${e.runsJobId==null?r`
              <div class="muted" style="margin-top: 12px">Select a job to inspect run history.</div>
            `:i.length===0?r`
                <div class="muted" style="margin-top: 12px">No runs yet.</div>
              `:r`
              <div class="list" style="margin-top: 12px;">
                ${i.map(a=>vb(a,e.basePath))}
              </div>
            `}
    </section>
  `}function gb(e){const t=e.form;return t.scheduleKind==="at"?r`
      <label class="field" style="margin-top: 12px;">
        <span>Run at</span>
        <input
          type="datetime-local"
          .value=${t.scheduleAt}
          @input=${n=>e.onFormChange({scheduleAt:n.target.value})}
        />
      </label>
    `:t.scheduleKind==="every"?r`
      <div class="form-grid" style="margin-top: 12px;">
        <label class="field">
          <span>Every</span>
          <input
            .value=${t.everyAmount}
            @input=${n=>e.onFormChange({everyAmount:n.target.value})}
          />
        </label>
        <label class="field">
          <span>Unit</span>
          <select
            .value=${t.everyUnit}
            @change=${n=>e.onFormChange({everyUnit:n.target.value})}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </label>
      </div>
    `:r`
    <div class="form-grid" style="margin-top: 12px;">
      <label class="field">
        <span>Expression</span>
        <input
          .value=${t.cronExpr}
          @input=${n=>e.onFormChange({cronExpr:n.target.value})}
        />
      </label>
      <label class="field">
        <span>Timezone (optional)</span>
        <input
          .value=${t.cronTz}
          @input=${n=>e.onFormChange({cronTz:n.target.value})}
        />
      </label>
    </div>
  `}function hb(e,t){const s=`list-item list-item-clickable cron-job${t.runsJobId===e.id?" list-item-selected":""}`;return r`
    <div class=${s} @click=${()=>t.onLoadRuns(e.id)}>
      <div class="list-main">
        <div class="list-title">${e.name}</div>
        <div class="list-sub">${cc(e)}</div>
        ${fb(e)}
        ${e.agentId?r`<div class="muted cron-job-agent">Agent: ${e.agentId}</div>`:v}
      </div>
      <div class="list-meta">
        ${mb(e)}
      </div>
      <div class="cron-job-footer">
        <div class="chip-row cron-job-chips">
          <span class=${`chip ${e.enabled?"chip-ok":"chip-danger"}`}>
            ${e.enabled?"enabled":"disabled"}
          </span>
          <span class="chip">${e.sessionTarget}</span>
          <span class="chip">${e.wakeMode}</span>
        </div>
        <div class="row cron-job-actions">
          <button
            class="btn"
            ?disabled=${t.busy}
            @click=${i=>{i.stopPropagation(),t.onToggle(e,!e.enabled)}}
          >
            ${e.enabled?"Disable":"Enable"}
          </button>
          <button
            class="btn"
            ?disabled=${t.busy}
            @click=${i=>{i.stopPropagation(),t.onRun(e)}}
          >
            Run
          </button>
          <button
            class="btn"
            ?disabled=${t.busy}
            @click=${i=>{i.stopPropagation(),t.onLoadRuns(e.id)}}
          >
            History
          </button>
          <button
            class="btn danger"
            ?disabled=${t.busy}
            @click=${i=>{i.stopPropagation(),t.onRemove(e)}}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  `}function fb(e){if(e.payload.kind==="systemEvent")return r`<div class="cron-job-detail">
      <span class="cron-job-detail-label">System</span>
      <span class="muted cron-job-detail-value">${e.payload.text}</span>
    </div>`;const t=e.delivery,n=t?.channel||t?.to?` (${t.channel??"last"}${t.to?` -> ${t.to}`:""})`:"";return r`
    <div class="cron-job-detail">
      <span class="cron-job-detail-label">Prompt</span>
      <span class="muted cron-job-detail-value">${e.payload.message}</span>
    </div>
    ${t?r`<div class="cron-job-detail">
            <span class="cron-job-detail-label">Delivery</span>
            <span class="muted cron-job-detail-value">${t.mode}${n}</span>
          </div>`:v}
  `}function Mr(e){return typeof e!="number"||!Number.isFinite(e)?"n/a":Y(e)}function mb(e){const t=e.state?.lastStatus??"n/a",n=t==="ok"?"cron-job-status-ok":t==="error"?"cron-job-status-error":t==="skipped"?"cron-job-status-skipped":"cron-job-status-na",s=e.state?.nextRunAtMs,i=e.state?.lastRunAtMs;return r`
    <div class="cron-job-state">
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Status</span>
        <span class=${`cron-job-status-pill ${n}`}>${t}</span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Next</span>
        <span class="cron-job-state-value" title=${Ct(s)}>
          ${Mr(s)}
        </span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Last</span>
        <span class="cron-job-state-value" title=${Ct(i)}>
          ${Mr(i)}
        </span>
      </div>
    </div>
  `}function vb(e,t){const n=typeof e.sessionKey=="string"&&e.sessionKey.trim().length>0?`${ya("chat",t)}?session=${encodeURIComponent(e.sessionKey)}`:null;return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${e.status}</div>
        <div class="list-sub">${e.summary??""}</div>
      </div>
      <div class="list-meta">
        <div>${Ct(e.ts)}</div>
        <div class="muted">${e.durationMs??0}ms</div>
        ${n?r`<div><a class="session-link" href=${n}>Open run chat</a></div>`:v}
        ${e.error?r`<div class="muted">${e.error}</div>`:v}
      </div>
    </div>
  `}function bb(e){const n=(e.status&&typeof e.status=="object"?e.status.securityAudit:null)?.summary??null,s=n?.critical??0,i=n?.warn??0,a=n?.info??0,o=s>0?"danger":i>0?"warn":"success",l=s>0?`${s} critical`:i>0?`${i} warnings`:"No critical issues";return r`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">Snapshots</div>
            <div class="card-sub">Status, health, and heartbeat data.</div>
          </div>
          <button class="btn" ?disabled=${e.loading} @click=${e.onRefresh}>
            ${e.loading?"Refreshing…":"Refresh"}
          </button>
        </div>
        <div class="stack" style="margin-top: 12px;">
          <div>
            <div class="muted">Status</div>
            ${n?r`<div class="callout ${o}" style="margin-top: 8px;">
                  Security audit: ${l}${a>0?` · ${a} info`:""}. Run
                  <span class="mono">winclaw security audit --deep</span> for details.
                </div>`:v}
            <pre class="code-block">${JSON.stringify(e.status??{},null,2)}</pre>
          </div>
          <div>
            <div class="muted">Health</div>
            <pre class="code-block">${JSON.stringify(e.health??{},null,2)}</pre>
          </div>
          <div>
            <div class="muted">Last heartbeat</div>
            <pre class="code-block">${JSON.stringify(e.heartbeat??{},null,2)}</pre>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Manual RPC</div>
        <div class="card-sub">Send a raw gateway method with JSON params.</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>Method</span>
            <input
              .value=${e.callMethod}
              @input=${c=>e.onCallMethodChange(c.target.value)}
              placeholder="system-presence"
            />
          </label>
          <label class="field">
            <span>Params (JSON)</span>
            <textarea
              .value=${e.callParams}
              @input=${c=>e.onCallParamsChange(c.target.value)}
              rows="6"
            ></textarea>
          </label>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn primary" @click=${e.onCall}>Call</button>
        </div>
        ${e.callError?r`<div class="callout danger" style="margin-top: 12px;">
              ${e.callError}
            </div>`:v}
        ${e.callResult?r`<pre class="code-block" style="margin-top: 12px;">${e.callResult}</pre>`:v}
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Models</div>
      <div class="card-sub">Catalog from models.list.</div>
      <pre class="code-block" style="margin-top: 12px;">${JSON.stringify(e.models??[],null,2)}</pre>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Event Log</div>
      <div class="card-sub">Latest gateway events.</div>
      ${e.eventLog.length===0?r`
              <div class="muted" style="margin-top: 12px">No events yet.</div>
            `:r`
            <div class="list" style="margin-top: 12px;">
              ${e.eventLog.map(c=>r`
                  <div class="list-item">
                    <div class="list-main">
                      <div class="list-title">${c.event}</div>
                      <div class="list-sub">${new Date(c.ts).toLocaleTimeString()}</div>
                    </div>
                    <div class="list-meta">
                      <pre class="code-block">${Mh(c.payload)}</pre>
                    </div>
                  </div>
                `)}
            </div>
          `}
    </section>
  `}function yb(e){const t=Math.max(0,e),n=Math.floor(t/1e3);if(n<60)return`${n}s`;const s=Math.floor(n/60);return s<60?`${s}m`:`${Math.floor(s/60)}h`}function ht(e,t){return t?r`<div class="exec-approval-meta-row"><span>${e}</span><span>${t}</span></div>`:v}function xb(e){const t=e.execApprovalQueue[0];if(!t)return v;const n=t.request,s=t.expiresAtMs-Date.now(),i=s>0?`expires in ${yb(s)}`:"expired",a=e.execApprovalQueue.length;return r`
    <div class="exec-approval-overlay" role="dialog" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">Exec approval needed</div>
            <div class="exec-approval-sub">${i}</div>
          </div>
          ${a>1?r`<div class="exec-approval-queue">${a} pending</div>`:v}
        </div>
        <div class="exec-approval-command mono">${n.command}</div>
        <div class="exec-approval-meta">
          ${ht("Host",n.host)}
          ${ht("Agent",n.agentId)}
          ${ht("Session",n.sessionKey)}
          ${ht("CWD",n.cwd)}
          ${ht("Resolved",n.resolvedPath)}
          ${ht("Security",n.security)}
          ${ht("Ask",n.ask)}
        </div>
        ${e.execApprovalError?r`<div class="exec-approval-error">${e.execApprovalError}</div>`:v}
        <div class="exec-approval-actions">
          <button
            class="btn primary"
            ?disabled=${e.execApprovalBusy}
            @click=${()=>e.handleExecApprovalDecision("allow-once")}
          >
            Allow once
          </button>
          <button
            class="btn"
            ?disabled=${e.execApprovalBusy}
            @click=${()=>e.handleExecApprovalDecision("allow-always")}
          >
            Always allow
          </button>
          <button
            class="btn danger"
            ?disabled=${e.execApprovalBusy}
            @click=${()=>e.handleExecApprovalDecision("deny")}
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  `}function wb(e){const{pendingGatewayUrl:t}=e;return t?r`
    <div class="exec-approval-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">Change Gateway URL</div>
            <div class="exec-approval-sub">This will reconnect to a different gateway server</div>
          </div>
        </div>
        <div class="exec-approval-command mono">${t}</div>
        <div class="callout danger" style="margin-top: 12px;">
          Only confirm if you trust this URL. Malicious URLs can compromise your system.
        </div>
        <div class="exec-approval-actions">
          <button
            class="btn primary"
            @click=${()=>e.handleGatewayUrlConfirm()}
          >
            Confirm
          </button>
          <button
            class="btn"
            @click=${()=>e.handleGatewayUrlCancel()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `:v}function $b(e){return r`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Connected Instances</div>
          <div class="card-sub">Presence beacons from the gateway and clients.</div>
        </div>
        <button class="btn" ?disabled=${e.loading} @click=${e.onRefresh}>
          ${e.loading?"Loading…":"Refresh"}
        </button>
      </div>
      ${e.lastError?r`<div class="callout danger" style="margin-top: 12px;">
            ${e.lastError}
          </div>`:v}
      ${e.statusMessage?r`<div class="callout" style="margin-top: 12px;">
            ${e.statusMessage}
          </div>`:v}
      <div class="list" style="margin-top: 16px;">
        ${e.entries.length===0?r`
                <div class="muted">No instances reported yet.</div>
              `:e.entries.map(t=>kb(t))}
      </div>
    </section>
  `}function kb(e){const t=e.lastInputSeconds!=null?`${e.lastInputSeconds}s ago`:"n/a",n=e.mode??"unknown",s=Array.isArray(e.roles)?e.roles.filter(Boolean):[],i=Array.isArray(e.scopes)?e.scopes.filter(Boolean):[],a=i.length>0?i.length>3?`${i.length} scopes`:`scopes: ${i.join(", ")}`:null;return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${e.host??"unknown host"}</div>
        <div class="list-sub">${Eh(e)}</div>
        <div class="chip-row">
          <span class="chip">${n}</span>
          ${s.map(o=>r`<span class="chip">${o}</span>`)}
          ${a?r`<span class="chip">${a}</span>`:v}
          ${e.platform?r`<span class="chip">${e.platform}</span>`:v}
          ${e.deviceFamily?r`<span class="chip">${e.deviceFamily}</span>`:v}
          ${e.modelIdentifier?r`<span class="chip">${e.modelIdentifier}</span>`:v}
          ${e.version?r`<span class="chip">${e.version}</span>`:v}
        </div>
      </div>
      <div class="list-meta">
        <div>${Lh(e)}</div>
        <div class="muted">Last input ${t}</div>
        <div class="muted">Reason ${e.reason??""}</div>
      </div>
    </div>
  `}const Rr=["trace","debug","info","warn","error","fatal"];function Sb(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleTimeString()}function Ab(e,t){return t?[e.message,e.subsystem,e.raw].filter(Boolean).join(" ").toLowerCase().includes(t):!0}function Cb(e){const t=e.filterText.trim().toLowerCase(),n=Rr.some(a=>!e.levelFilters[a]),s=e.entries.filter(a=>a.level&&!e.levelFilters[a.level]?!1:Ab(a,t)),i=t||n?"filtered":"visible";return r`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Logs</div>
          <div class="card-sub">Gateway file logs (JSONL).</div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn" ?disabled=${e.loading} @click=${e.onRefresh}>
            ${e.loading?"Loading…":"Refresh"}
          </button>
          <button
            class="btn"
            ?disabled=${s.length===0}
            @click=${()=>e.onExport(s.map(a=>a.raw),i)}
          >
            Export ${i}
          </button>
        </div>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="min-width: 220px;">
          <span>Filter</span>
          <input
            .value=${e.filterText}
            @input=${a=>e.onFilterTextChange(a.target.value)}
            placeholder="Search logs"
          />
        </label>
        <label class="field checkbox">
          <span>Auto-follow</span>
          <input
            type="checkbox"
            .checked=${e.autoFollow}
            @change=${a=>e.onToggleAutoFollow(a.target.checked)}
          />
        </label>
      </div>

      <div class="chip-row" style="margin-top: 12px;">
        ${Rr.map(a=>r`
            <label class="chip log-chip ${a}">
              <input
                type="checkbox"
                .checked=${e.levelFilters[a]}
                @change=${o=>e.onLevelToggle(a,o.target.checked)}
              />
              <span>${a}</span>
            </label>
          `)}
      </div>

      ${e.file?r`<div class="muted" style="margin-top: 10px;">File: ${e.file}</div>`:v}
      ${e.truncated?r`
              <div class="callout" style="margin-top: 10px">Log output truncated; showing latest chunk.</div>
            `:v}
      ${e.error?r`<div class="callout danger" style="margin-top: 10px;">${e.error}</div>`:v}

      <div class="log-stream" style="margin-top: 12px;" @scroll=${e.onScroll}>
        ${s.length===0?r`
                <div class="muted" style="padding: 12px">No log entries.</div>
              `:s.map(a=>r`
                <div class="log-row">
                  <div class="log-time mono">${Sb(a.time)}</div>
                  <div class="log-level ${a.level??""}">${a.level??""}</div>
                  <div class="log-subsystem mono">${a.subsystem??""}</div>
                  <div class="log-message mono">${a.message??a.raw}</div>
                </div>
              `)}
      </div>
    </section>
  `}function Tb(e){const t=Rb(e),n=Bb(e);return r`
    ${Hb(n)}
    ${Ub(t)}
    ${_b(e)}
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Nodes</div>
          <div class="card-sub">Paired devices and live links.</div>
        </div>
        <button class="btn" ?disabled=${e.loading} @click=${e.onRefresh}>
          ${e.loading?"Loading…":"Refresh"}
        </button>
      </div>
      <div class="list" style="margin-top: 16px;">
        ${e.nodes.length===0?r`
                <div class="muted">No nodes found.</div>
              `:e.nodes.map(s=>Jb(s))}
      </div>
    </section>
  `}function _b(e){const t=e.devicesList??{pending:[],paired:[]},n=Array.isArray(t.pending)?t.pending:[],s=Array.isArray(t.paired)?t.paired:[];return r`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Devices</div>
          <div class="card-sub">Pairing requests + role tokens.</div>
        </div>
        <button class="btn" ?disabled=${e.devicesLoading} @click=${e.onDevicesRefresh}>
          ${e.devicesLoading?"Loading…":"Refresh"}
        </button>
      </div>
      ${e.devicesError?r`<div class="callout danger" style="margin-top: 12px;">${e.devicesError}</div>`:v}
      <div class="list" style="margin-top: 16px;">
        ${n.length>0?r`
              <div class="muted" style="margin-bottom: 8px;">Pending</div>
              ${n.map(i=>Eb(i,e))}
            `:v}
        ${s.length>0?r`
              <div class="muted" style="margin-top: 12px; margin-bottom: 8px;">Paired</div>
              ${s.map(i=>Lb(i,e))}
            `:v}
        ${n.length===0&&s.length===0?r`
                <div class="muted">No paired devices.</div>
              `:v}
      </div>
    </section>
  `}function Eb(e,t){const n=e.displayName?.trim()||e.deviceId,s=typeof e.ts=="number"?Y(e.ts):"n/a",i=e.role?.trim()?`role: ${e.role}`:"role: -",a=e.isRepair?" · repair":"",o=e.remoteIp?` · ${e.remoteIp}`:"";return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${n}</div>
        <div class="list-sub">${e.deviceId}${o}</div>
        <div class="muted" style="margin-top: 6px;">
          ${i} · requested ${s}${a}
        </div>
      </div>
      <div class="list-meta">
        <div class="row" style="justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn--sm primary" @click=${()=>t.onDeviceApprove(e.requestId)}>
            Approve
          </button>
          <button class="btn btn--sm" @click=${()=>t.onDeviceReject(e.requestId)}>
            Reject
          </button>
        </div>
      </div>
    </div>
  `}function Lb(e,t){const n=e.displayName?.trim()||e.deviceId,s=e.remoteIp?` · ${e.remoteIp}`:"",i=`roles: ${xi(e.roles)}`,a=`scopes: ${xi(e.scopes)}`,o=Array.isArray(e.tokens)?e.tokens:[];return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${n}</div>
        <div class="list-sub">${e.deviceId}${s}</div>
        <div class="muted" style="margin-top: 6px;">${i} · ${a}</div>
        ${o.length===0?r`
                <div class="muted" style="margin-top: 6px">Tokens: none</div>
              `:r`
              <div class="muted" style="margin-top: 10px;">Tokens</div>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                ${o.map(l=>Ib(e.deviceId,l,t))}
              </div>
            `}
      </div>
    </div>
  `}function Ib(e,t,n){const s=t.revokedAtMs?"revoked":"active",i=`scopes: ${xi(t.scopes)}`,a=Y(t.rotatedAtMs??t.createdAtMs??t.lastUsedAtMs??null);return r`
    <div class="row" style="justify-content: space-between; gap: 8px;">
      <div class="list-sub">${t.role} · ${s} · ${i} · ${a}</div>
      <div class="row" style="justify-content: flex-end; gap: 6px; flex-wrap: wrap;">
        <button
          class="btn btn--sm"
          @click=${()=>n.onDeviceRotate(e,t.role,t.scopes)}
        >
          Rotate
        </button>
        ${t.revokedAtMs?v:r`
              <button
                class="btn btn--sm danger"
                @click=${()=>n.onDeviceRevoke(e,t.role)}
              >
                Revoke
              </button>
            `}
      </div>
    </div>
  `}const st="__defaults__",Pr=[{value:"deny",label:"Deny"},{value:"allowlist",label:"Allowlist"},{value:"full",label:"Full"}],Mb=[{value:"off",label:"Off"},{value:"on-miss",label:"On miss"},{value:"always",label:"Always"}];function Rb(e){const t=e.configForm,n=Gb(e.nodes),{defaultBinding:s,agents:i}=Yb(t),a=!!t,o=e.configSaving||e.configFormMode==="raw";return{ready:a,disabled:o,configDirty:e.configDirty,configLoading:e.configLoading,configSaving:e.configSaving,defaultBinding:s,agents:i,nodes:n,onBindDefault:e.onBindDefault,onBindAgent:e.onBindAgent,onSave:e.onSaveBindings,onLoadConfig:e.onLoadConfig,formMode:e.configFormMode}}function Dr(e){return e==="allowlist"||e==="full"||e==="deny"?e:"deny"}function Pb(e){return e==="always"||e==="off"||e==="on-miss"?e:"on-miss"}function Db(e){const t=e?.defaults??{};return{security:Dr(t.security),ask:Pb(t.ask),askFallback:Dr(t.askFallback??"deny"),autoAllowSkills:!!(t.autoAllowSkills??!1)}}function Fb(e){const t=e?.agents??{},n=Array.isArray(t.list)?t.list:[],s=[];return n.forEach(i=>{if(!i||typeof i!="object")return;const a=i,o=typeof a.id=="string"?a.id.trim():"";if(!o)return;const l=typeof a.name=="string"?a.name.trim():void 0,c=a.default===!0;s.push({id:o,name:l||void 0,isDefault:c})}),s}function Nb(e,t){const n=Fb(e),s=Object.keys(t?.agents??{}),i=new Map;n.forEach(o=>i.set(o.id,o)),s.forEach(o=>{i.has(o)||i.set(o,{id:o})});const a=Array.from(i.values());return a.length===0&&a.push({id:"main",isDefault:!0}),a.sort((o,l)=>{if(o.isDefault&&!l.isDefault)return-1;if(!o.isDefault&&l.isDefault)return 1;const c=o.name?.trim()?o.name:o.id,p=l.name?.trim()?l.name:l.id;return c.localeCompare(p)}),a}function Ob(e,t){return e===st?st:e&&t.some(n=>n.id===e)?e:st}function Bb(e){const t=e.execApprovalsForm??e.execApprovalsSnapshot?.file??null,n=!!t,s=Db(t),i=Nb(e.configForm,t),a=Qb(e.nodes),o=e.execApprovalsTarget;let l=o==="node"&&e.execApprovalsTargetNodeId?e.execApprovalsTargetNodeId:null;o==="node"&&l&&!a.some(u=>u.id===l)&&(l=null);const c=Ob(e.execApprovalsSelectedAgent,i),p=c!==st?(t?.agents??{})[c]??null:null,g=Array.isArray(p?.allowlist)?p.allowlist??[]:[];return{ready:n,disabled:e.execApprovalsSaving||e.execApprovalsLoading,dirty:e.execApprovalsDirty,loading:e.execApprovalsLoading,saving:e.execApprovalsSaving,form:t,defaults:s,selectedScope:c,selectedAgent:p,agents:i,allowlist:g,target:o,targetNodeId:l,targetNodes:a,onSelectScope:e.onExecApprovalsSelectAgent,onSelectTarget:e.onExecApprovalsTargetChange,onPatch:e.onExecApprovalsPatch,onRemove:e.onExecApprovalsRemove,onLoad:e.onLoadExecApprovals,onSave:e.onSaveExecApprovals}}function Ub(e){const t=e.nodes.length>0,n=e.defaultBinding??"";return r`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">Exec node binding</div>
          <div class="card-sub">
            Pin agents to a specific node when using <span class="mono">exec host=node</span>.
          </div>
        </div>
        <button
          class="btn"
          ?disabled=${e.disabled||!e.configDirty}
          @click=${e.onSave}
        >
          ${e.configSaving?"Saving…":"Save"}
        </button>
      </div>

      ${e.formMode==="raw"?r`
              <div class="callout warn" style="margin-top: 12px">
                Switch the Config tab to <strong>Form</strong> mode to edit bindings here.
              </div>
            `:v}

      ${e.ready?r`
            <div class="list" style="margin-top: 16px;">
              <div class="list-item">
                <div class="list-main">
                  <div class="list-title">Default binding</div>
                  <div class="list-sub">Used when agents do not override a node binding.</div>
                </div>
                <div class="list-meta">
                  <label class="field">
                    <span>Node</span>
                    <select
                      ?disabled=${e.disabled||!t}
                      @change=${s=>{const a=s.target.value.trim();e.onBindDefault(a||null)}}
                    >
                      <option value="" ?selected=${n===""}>Any node</option>
                      ${e.nodes.map(s=>r`<option
                            value=${s.id}
                            ?selected=${n===s.id}
                          >
                            ${s.label}
                          </option>`)}
                    </select>
                  </label>
                  ${t?v:r`
                          <div class="muted">No nodes with system.run available.</div>
                        `}
                </div>
              </div>

              ${e.agents.length===0?r`
                      <div class="muted">No agents found.</div>
                    `:e.agents.map(s=>qb(s,e))}
            </div>
          `:r`<div class="row" style="margin-top: 12px; gap: 12px;">
            <div class="muted">Load config to edit bindings.</div>
            <button class="btn" ?disabled=${e.configLoading} @click=${e.onLoadConfig}>
              ${e.configLoading?"Loading…":"Load config"}
            </button>
          </div>`}
    </section>
  `}function Hb(e){const t=e.ready,n=e.target!=="node"||!!e.targetNodeId;return r`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">Exec approvals</div>
          <div class="card-sub">
            Allowlist and approval policy for <span class="mono">exec host=gateway/node</span>.
          </div>
        </div>
        <button
          class="btn"
          ?disabled=${e.disabled||!e.dirty||!n}
          @click=${e.onSave}
        >
          ${e.saving?"Saving…":"Save"}
        </button>
      </div>

      ${zb(e)}

      ${t?r`
            ${jb(e)}
            ${Kb(e)}
            ${e.selectedScope===st?v:Vb(e)}
          `:r`<div class="row" style="margin-top: 12px; gap: 12px;">
            <div class="muted">Load exec approvals to edit allowlists.</div>
            <button class="btn" ?disabled=${e.loading||!n} @click=${e.onLoad}>
              ${e.loading?"Loading…":"Load approvals"}
            </button>
          </div>`}
    </section>
  `}function zb(e){const t=e.targetNodes.length>0,n=e.targetNodeId??"";return r`
    <div class="list" style="margin-top: 12px;">
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Target</div>
          <div class="list-sub">
            Gateway edits local approvals; node edits the selected node.
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Host</span>
            <select
              ?disabled=${e.disabled}
              @change=${s=>{if(s.target.value==="node"){const o=e.targetNodes[0]?.id??null;e.onSelectTarget("node",n||o)}else e.onSelectTarget("gateway",null)}}
            >
              <option value="gateway" ?selected=${e.target==="gateway"}>Gateway</option>
              <option value="node" ?selected=${e.target==="node"}>Node</option>
            </select>
          </label>
          ${e.target==="node"?r`
                <label class="field">
                  <span>Node</span>
                  <select
                    ?disabled=${e.disabled||!t}
                    @change=${s=>{const a=s.target.value.trim();e.onSelectTarget("node",a||null)}}
                  >
                    <option value="" ?selected=${n===""}>Select node</option>
                    ${e.targetNodes.map(s=>r`<option
                          value=${s.id}
                          ?selected=${n===s.id}
                        >
                          ${s.label}
                        </option>`)}
                  </select>
                </label>
              `:v}
        </div>
      </div>
      ${e.target==="node"&&!t?r`
              <div class="muted">No nodes advertise exec approvals yet.</div>
            `:v}
    </div>
  `}function jb(e){return r`
    <div class="row" style="margin-top: 12px; gap: 8px; flex-wrap: wrap;">
      <span class="label">Scope</span>
      <div class="row" style="gap: 8px; flex-wrap: wrap;">
        <button
          class="btn btn--sm ${e.selectedScope===st?"active":""}"
          @click=${()=>e.onSelectScope(st)}
        >
          Defaults
        </button>
        ${e.agents.map(t=>{const n=t.name?.trim()?`${t.name} (${t.id})`:t.id;return r`
            <button
              class="btn btn--sm ${e.selectedScope===t.id?"active":""}"
              @click=${()=>e.onSelectScope(t.id)}
            >
              ${n}
            </button>
          `})}
      </div>
    </div>
  `}function Kb(e){const t=e.selectedScope===st,n=e.defaults,s=e.selectedAgent??{},i=t?["defaults"]:["agents",e.selectedScope],a=typeof s.security=="string"?s.security:void 0,o=typeof s.ask=="string"?s.ask:void 0,l=typeof s.askFallback=="string"?s.askFallback:void 0,c=t?n.security:a??"__default__",p=t?n.ask:o??"__default__",g=t?n.askFallback:l??"__default__",u=typeof s.autoAllowSkills=="boolean"?s.autoAllowSkills:void 0,h=u??n.autoAllowSkills,f=u==null;return r`
    <div class="list" style="margin-top: 16px;">
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Security</div>
          <div class="list-sub">
            ${t?"Default security mode.":`Default: ${n.security}.`}
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Mode</span>
            <select
              ?disabled=${e.disabled}
              @change=${d=>{const k=d.target.value;!t&&k==="__default__"?e.onRemove([...i,"security"]):e.onPatch([...i,"security"],k)}}
            >
              ${t?v:r`<option value="__default__" ?selected=${c==="__default__"}>
                    Use default (${n.security})
                  </option>`}
              ${Pr.map(d=>r`<option
                    value=${d.value}
                    ?selected=${c===d.value}
                  >
                    ${d.label}
                  </option>`)}
            </select>
          </label>
        </div>
      </div>

      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Ask</div>
          <div class="list-sub">
            ${t?"Default prompt policy.":`Default: ${n.ask}.`}
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Mode</span>
            <select
              ?disabled=${e.disabled}
              @change=${d=>{const k=d.target.value;!t&&k==="__default__"?e.onRemove([...i,"ask"]):e.onPatch([...i,"ask"],k)}}
            >
              ${t?v:r`<option value="__default__" ?selected=${p==="__default__"}>
                    Use default (${n.ask})
                  </option>`}
              ${Mb.map(d=>r`<option
                    value=${d.value}
                    ?selected=${p===d.value}
                  >
                    ${d.label}
                  </option>`)}
            </select>
          </label>
        </div>
      </div>

      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Ask fallback</div>
          <div class="list-sub">
            ${t?"Applied when the UI prompt is unavailable.":`Default: ${n.askFallback}.`}
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Fallback</span>
            <select
              ?disabled=${e.disabled}
              @change=${d=>{const k=d.target.value;!t&&k==="__default__"?e.onRemove([...i,"askFallback"]):e.onPatch([...i,"askFallback"],k)}}
            >
              ${t?v:r`<option value="__default__" ?selected=${g==="__default__"}>
                    Use default (${n.askFallback})
                  </option>`}
              ${Pr.map(d=>r`<option
                    value=${d.value}
                    ?selected=${g===d.value}
                  >
                    ${d.label}
                  </option>`)}
            </select>
          </label>
        </div>
      </div>

      <div class="list-item">
        <div class="list-main">
          <div class="list-title">Auto-allow skill CLIs</div>
          <div class="list-sub">
            ${t?"Allow skill executables listed by the Gateway.":f?`Using default (${n.autoAllowSkills?"on":"off"}).`:`Override (${h?"on":"off"}).`}
          </div>
        </div>
        <div class="list-meta">
          <label class="field">
            <span>Enabled</span>
            <input
              type="checkbox"
              ?disabled=${e.disabled}
              .checked=${h}
              @change=${d=>{const m=d.target;e.onPatch([...i,"autoAllowSkills"],m.checked)}}
            />
          </label>
          ${!t&&!f?r`<button
                class="btn btn--sm"
                ?disabled=${e.disabled}
                @click=${()=>e.onRemove([...i,"autoAllowSkills"])}
              >
                Use default
              </button>`:v}
        </div>
      </div>
    </div>
  `}function Vb(e){const t=["agents",e.selectedScope,"allowlist"],n=e.allowlist;return r`
    <div class="row" style="margin-top: 18px; justify-content: space-between;">
      <div>
        <div class="card-title">Allowlist</div>
        <div class="card-sub">Case-insensitive glob patterns.</div>
      </div>
      <button
        class="btn btn--sm"
        ?disabled=${e.disabled}
        @click=${()=>{const s=[...n,{pattern:""}];e.onPatch(t,s)}}
      >
        Add pattern
      </button>
    </div>
    <div class="list" style="margin-top: 12px;">
      ${n.length===0?r`
              <div class="muted">No allowlist entries yet.</div>
            `:n.map((s,i)=>Wb(e,s,i))}
    </div>
  `}function Wb(e,t,n){const s=t.lastUsedAt?Y(t.lastUsedAt):"never",i=t.lastUsedCommand?wi(t.lastUsedCommand,120):null,a=t.lastResolvedPath?wi(t.lastResolvedPath,120):null;return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${t.pattern?.trim()?t.pattern:"New pattern"}</div>
        <div class="list-sub">Last used: ${s}</div>
        ${i?r`<div class="list-sub mono">${i}</div>`:v}
        ${a?r`<div class="list-sub mono">${a}</div>`:v}
      </div>
      <div class="list-meta">
        <label class="field">
          <span>Pattern</span>
          <input
            type="text"
            .value=${t.pattern??""}
            ?disabled=${e.disabled}
            @input=${o=>{const l=o.target;e.onPatch(["agents",e.selectedScope,"allowlist",n,"pattern"],l.value)}}
          />
        </label>
        <button
          class="btn btn--sm danger"
          ?disabled=${e.disabled}
          @click=${()=>{if(e.allowlist.length<=1){e.onRemove(["agents",e.selectedScope,"allowlist"]);return}e.onRemove(["agents",e.selectedScope,"allowlist",n])}}
        >
          Remove
        </button>
      </div>
    </div>
  `}function qb(e,t){const n=e.binding??"__default__",s=e.name?.trim()?`${e.name} (${e.id})`:e.id,i=t.nodes.length>0;return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${s}</div>
        <div class="list-sub">
          ${e.isDefault?"default agent":"agent"} ·
          ${n==="__default__"?`uses default (${t.defaultBinding??"any"})`:`override: ${e.binding}`}
        </div>
      </div>
      <div class="list-meta">
        <label class="field">
          <span>Binding</span>
          <select
            ?disabled=${t.disabled||!i}
            @change=${a=>{const l=a.target.value.trim();t.onBindAgent(e.index,l==="__default__"?null:l)}}
          >
            <option value="__default__" ?selected=${n==="__default__"}>
              Use default
            </option>
            ${t.nodes.map(a=>r`<option
                  value=${a.id}
                  ?selected=${n===a.id}
                >
                  ${a.label}
                </option>`)}
          </select>
        </label>
      </div>
    </div>
  `}function Gb(e){const t=[];for(const n of e){if(!(Array.isArray(n.commands)?n.commands:[]).some(l=>String(l)==="system.run"))continue;const a=typeof n.nodeId=="string"?n.nodeId.trim():"";if(!a)continue;const o=typeof n.displayName=="string"&&n.displayName.trim()?n.displayName.trim():a;t.push({id:a,label:o===a?a:`${o} · ${a}`})}return t.sort((n,s)=>n.label.localeCompare(s.label)),t}function Qb(e){const t=[];for(const n of e){if(!(Array.isArray(n.commands)?n.commands:[]).some(l=>String(l)==="system.execApprovals.get"||String(l)==="system.execApprovals.set"))continue;const a=typeof n.nodeId=="string"?n.nodeId.trim():"";if(!a)continue;const o=typeof n.displayName=="string"&&n.displayName.trim()?n.displayName.trim():a;t.push({id:a,label:o===a?a:`${o} · ${a}`})}return t.sort((n,s)=>n.label.localeCompare(s.label)),t}function Yb(e){const t={id:"main",name:void 0,index:0,isDefault:!0,binding:null};if(!e||typeof e!="object")return{defaultBinding:null,agents:[t]};const s=(e.tools??{}).exec??{},i=typeof s.node=="string"&&s.node.trim()?s.node.trim():null,a=e.agents??{},o=Array.isArray(a.list)?a.list:[];if(o.length===0)return{defaultBinding:i,agents:[t]};const l=[];return o.forEach((c,p)=>{if(!c||typeof c!="object")return;const g=c,u=typeof g.id=="string"?g.id.trim():"";if(!u)return;const h=typeof g.name=="string"?g.name.trim():void 0,f=g.default===!0,m=(g.tools??{}).exec??{},k=typeof m.node=="string"&&m.node.trim()?m.node.trim():null;l.push({id:u,name:h||void 0,index:p,isDefault:f,binding:k})}),l.length===0&&l.push(t),{defaultBinding:i,agents:l}}function Jb(e){const t=!!e.connected,n=!!e.paired,s=typeof e.displayName=="string"&&e.displayName.trim()||(typeof e.nodeId=="string"?e.nodeId:"unknown"),i=Array.isArray(e.caps)?e.caps:[],a=Array.isArray(e.commands)?e.commands:[];return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${s}</div>
        <div class="list-sub">
          ${typeof e.nodeId=="string"?e.nodeId:""}
          ${typeof e.remoteIp=="string"?` · ${e.remoteIp}`:""}
          ${typeof e.version=="string"?` · ${e.version}`:""}
        </div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${n?"paired":"unpaired"}</span>
          <span class="chip ${t?"chip-ok":"chip-warn"}">
            ${t?"connected":"offline"}
          </span>
          ${i.slice(0,12).map(o=>r`<span class="chip">${String(o)}</span>`)}
          ${a.slice(0,8).map(o=>r`<span class="chip">${String(o)}</span>`)}
        </div>
      </div>
    </div>
  `}function Zb(e){const t=e.hello?.snapshot,n=t?.uptimeMs?la(t.uptimeMs):"n/a",s=t?.policy?.tickIntervalMs?`${t.policy.tickIntervalMs}ms`:"n/a",i=(()=>{if(e.connected||!e.lastError)return null;const o=e.lastError.toLowerCase();if(!(o.includes("unauthorized")||o.includes("connect failed")))return null;const c=!!e.settings.token.trim(),p=!!e.password.trim();return!c&&!p?r`
        <div class="muted" style="margin-top: 8px">
          This gateway requires auth. Add a token or password, then click Connect.
          <div style="margin-top: 6px">
            <span class="mono">winclaw dashboard --no-open</span> → open the Control UI<br />
            <span class="mono">winclaw doctor --generate-gateway-token</span> → set token
          </div>
          <div style="margin-top: 6px">
            <a
              class="session-link"
              href="https://docs.winclaw.ai/web/dashboard"
              target="_blank"
              rel="noreferrer"
              title="Control UI auth docs (opens in new tab)"
              >Docs: Control UI auth</a
            >
          </div>
        </div>
      `:r`
      <div class="muted" style="margin-top: 8px">
        Auth failed. Update the token or password in Control UI settings, then click Connect.
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.winclaw.ai/web/dashboard"
            target="_blank"
            rel="noreferrer"
            title="Control UI auth docs (opens in new tab)"
            >Docs: Control UI auth</a
          >
        </div>
      </div>
    `})(),a=(()=>{if(e.connected||!e.lastError||(typeof window<"u"?window.isSecureContext:!0))return null;const l=e.lastError.toLowerCase();return!l.includes("secure context")&&!l.includes("device identity required")?null:r`
      <div class="muted" style="margin-top: 8px">
        This page is HTTP, so the browser blocks device identity. Use HTTPS (Tailscale Serve) or open
        <span class="mono">http://127.0.0.1:18789</span> on the gateway host.
        <div style="margin-top: 6px">
          If you must stay on HTTP, set
          <span class="mono">gateway.controlUi.allowInsecureAuth: true</span> (token-only).
        </div>
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.winclaw.ai/gateway/tailscale"
            target="_blank"
            rel="noreferrer"
            title="Tailscale Serve docs (opens in new tab)"
            >Docs: Tailscale Serve</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.winclaw.ai/web/control-ui#insecure-http"
            target="_blank"
            rel="noreferrer"
            title="Insecure HTTP docs (opens in new tab)"
            >Docs: Insecure HTTP</a
          >
        </div>
      </div>
    `})();return r`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Gateway Access</div>
        <div class="card-sub">Where the dashboard connects and how it authenticates.</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>WebSocket URL</span>
            <input
              .value=${e.settings.gatewayUrl}
              @input=${o=>{const l=o.target.value;e.onSettingsChange({...e.settings,gatewayUrl:l})}}
              placeholder="ws://100.x.y.z:18789"
            />
          </label>
          <label class="field">
            <span>Gateway Token</span>
            <input
              .value=${e.settings.token}
              @input=${o=>{const l=o.target.value;e.onSettingsChange({...e.settings,token:l})}}
              placeholder="WINCLAW_GATEWAY_TOKEN"
            />
          </label>
          <label class="field">
            <span>Password (not stored)</span>
            <input
              type="password"
              .value=${e.password}
              @input=${o=>{const l=o.target.value;e.onPasswordChange(l)}}
              placeholder="system or shared password"
            />
          </label>
          <label class="field">
            <span>Default Session Key</span>
            <input
              .value=${e.settings.sessionKey}
              @input=${o=>{const l=o.target.value;e.onSessionKeyChange(l)}}
            />
          </label>
        </div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn" @click=${()=>e.onConnect()}>Connect</button>
          <button class="btn" @click=${()=>e.onRefresh()}>Refresh</button>
          <span class="muted">Click Connect to apply connection changes.</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Snapshot</div>
        <div class="card-sub">Latest gateway handshake information.</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Status</div>
            <div class="stat-value ${e.connected?"ok":"warn"}">
              ${e.connected?"Connected":"Disconnected"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">${n}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Tick Interval</div>
            <div class="stat-value">${s}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Last Channels Refresh</div>
            <div class="stat-value">
              ${e.lastChannelsRefresh?Y(e.lastChannelsRefresh):"n/a"}
            </div>
          </div>
        </div>
        ${e.lastError?r`<div class="callout danger" style="margin-top: 14px;">
              <div>${e.lastError}</div>
              ${i??""}
              ${a??""}
            </div>`:r`
                <div class="callout" style="margin-top: 14px">
                  Use Channels to link WhatsApp, Telegram, Discord, Signal, or iMessage.
                </div>
              `}
      </div>
    </section>

    <section class="grid grid-cols-3" style="margin-top: 18px;">
      <div class="card stat-card">
        <div class="stat-label">Instances</div>
        <div class="stat-value">${e.presenceCount}</div>
        <div class="muted">Presence beacons in the last 5 minutes.</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Sessions</div>
        <div class="stat-value">${e.sessionsCount??"n/a"}</div>
        <div class="muted">Recent session keys tracked by the gateway.</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Cron</div>
        <div class="stat-value">
          ${e.cronEnabled==null?"n/a":e.cronEnabled?"Enabled":"Disabled"}
        </div>
        <div class="muted">Next wake ${_a(e.cronNext)}</div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Notes</div>
      <div class="card-sub">Quick reminders for remote control setups.</div>
      <div class="note-grid" style="margin-top: 14px;">
        <div>
          <div class="note-title">Tailscale serve</div>
          <div class="muted">
            Prefer serve mode to keep the gateway on loopback with tailnet auth.
          </div>
        </div>
        <div>
          <div class="note-title">Session hygiene</div>
          <div class="muted">Use /new or sessions.patch to reset context.</div>
        </div>
        <div>
          <div class="note-title">Cron reminders</div>
          <div class="muted">Use isolated sessions for recurring runs.</div>
        </div>
      </div>
    </section>
  `}function Xb(e){const{form:t}=e;return r`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${_("personal.title")}</div>
          <div class="card-sub">
            ${_("personal.subtitle")}
          </div>
        </div>
        <button
          class="btn"
          ?disabled=${e.loading}
          @click=${e.onRefresh}
        >
          ${e.loading?_("personal.loading"):_("personal.reload")}
        </button>
      </div>

      ${e.error?r`<div class="callout danger" style="margin-top: 12px;">
              ${e.error}
            </div>`:v}
      ${e.success?r`<div class="callout success" style="margin-top: 12px;">
              ${e.success}
            </div>`:v}

      ${t?r`
              <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 16px;">
                <label class="field">
                  <span class="field-label">${_("personal.employeeId")}</span>
                  <input
                    type="text"
                    .value=${t.employeeId??""}
                    placeholder=${_("personal.employeeIdPlaceholder")}
                    @input=${n=>e.onFieldChange("employeeId",n.target.value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${_("personal.employeeName")}</span>
                  <input
                    type="text"
                    .value=${t.employeeName??""}
                    placeholder=${_("personal.employeeNamePlaceholder")}
                    @input=${n=>e.onFieldChange("employeeName",n.target.value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${_("personal.email")}</span>
                  <input
                    type="email"
                    .value=${t.employeeEmail??""}
                    placeholder=${_("personal.emailPlaceholder")}
                    @input=${n=>e.onFieldChange("employeeEmail",n.target.value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${_("personal.grcUrl")}</span>
                  <input
                    type="url"
                    .value=${t.grcUrl??""}
                    placeholder=${_("personal.grcUrlPlaceholder")}
                    @input=${n=>e.onFieldChange("grcUrl",n.target.value)}
                  />
                </label>

                <div
                  class="callout"
                  style="margin-top: 4px; opacity: 0.7; font-size: 0.85em;"
                >
                  <div><strong>Node ID:</strong> ${t.nodeId||_("personal.notConnected")}</div>
                </div>

                <div class="row" style="margin-top: 8px; gap: 8px;">
                  <button
                    class="btn primary"
                    ?disabled=${!e.dirty||e.saving}
                    @click=${e.onSave}
                  >
                    ${e.saving?_("personal.saving"):_("personal.save")}
                  </button>
                </div>
              </div>
            `:e.loading?r`<div class="muted" style="margin-top: 16px;">${_("personal.loading")}</div>`:r`<div class="muted" style="margin-top: 16px;">${_("personal.loadError")}</div>`}
    </section>
  `}var ey=Object.defineProperty,ty=Object.getOwnPropertyDescriptor,kn=(e,t,n,s)=>{for(var i=s>1?void 0:s?ty(t,n):t,a=e.length-1,o;a>=0;a--)(o=e[a])&&(i=(s?o(t,n,i):o(i))||i);return s&&i&&ey(t,n,i),i};const ny=J`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,sy=J`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,iy=J`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`,ay=J`<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`;let It=class extends nt{constructor(){super(...arguments),this.track=null,this.paused=!1,this._playing=!1,this._lastUrl="",this._wantPlay=!1,this._gestureHandler=null}disconnectedCallback(){super.disconnectedCallback(),this._disarmGestureUnlock()}updated(e){const t=this._audio;if(t){if(e.has("track")){const n=this.track?.playUrl??"";n&&n!==this._lastUrl?(this._lastUrl=n,t.loop=this.track?.loop!==!1,t.pause(),t.src=n,t.load(),this._wantPlay=!this.paused,this._wantPlay&&this._requestPlay()):n||(this._lastUrl="",this._wantPlay=!1,t.pause(),this._playing=!1)}e.has("paused")&&!e.has("track")&&(this.paused?(this._wantPlay=!1,t.pause(),this._playing=!1):this._lastUrl&&(this._wantPlay=!0,this._requestPlay()))}}async _requestPlay(){!await this._tryPlay()&&this._wantPlay&&this._armGestureUnlock()}async _tryPlay(){try{return await this._audio.play(),this._playing=!0,this._disarmGestureUnlock(),!0}catch(e){return this._playing=!1,console.debug("[music-player] play blocked:",e?.name),!1}}_armGestureUnlock(){if(this._gestureHandler)return;const e=()=>{this._disarmGestureUnlock(),this._wantPlay&&this._lastUrl&&this._requestPlay()};this._gestureHandler=e;const t={capture:!0};document.addEventListener("pointerdown",e,t),document.addEventListener("keydown",e,t),document.addEventListener("touchend",e,t)}_disarmGestureUnlock(){const e=this._gestureHandler;if(!e)return;this._gestureHandler=null;const t={capture:!0};document.removeEventListener("pointerdown",e,t),document.removeEventListener("keydown",e,t),document.removeEventListener("touchend",e,t)}_togglePlay(){this._playing?(this._wantPlay=!1,this._audio.pause(),this._playing=!1,this.paused=!0):(this.paused=!1,this._wantPlay=!0,this._requestPlay())}_stop(){this._wantPlay=!1,this._disarmGestureUnlock(),this._audio.pause(),this._audio.currentTime=0,this._playing=!1,this._lastUrl="",this.dispatchEvent(new CustomEvent("music-stop",{bubbles:!0,composed:!0}))}render(){const e=this.track;if(!e)return v;const t=this._playing&&!this.paused;return r`
      <div class="wrap ${t?"":"paused"}">
        <div class="cover">
          ${e.cover?r`<img src=${e.cover} alt="" @error=${n=>n.target.style.display="none"} />`:r`<span class="ph">${ny}</span>`}
        </div>
        <div class="meta">
          <div class="title" title=${e.title}>${e.title}</div>
          ${e.artist?r`<div class="artist">${e.artist}</div>`:v}
          <div class="now">
            <span class="bars"><i></i><i></i><i></i><i></i></span>
            ${t?"循环播放中":"已暂停"}
          </div>
        </div>
        <div class="ctrls">
          <button class="pp" @click=${this._togglePlay}
            aria-label=${t?"暂停":"播放"} title=${t?"暂停":"播放"}>
            ${t?iy:sy}
          </button>
          <button class="sm" @click=${this._stop} aria-label="停止" title="停止">${ay}</button>
        </div>
      </div>
      <audio preload="auto" @ended=${()=>{this.track?.loop===!1&&(this._playing=!1)}}></audio>
    `}};It.styles=Qi`
    :host {
      --brand-pink: #f0759b;
      --grad-warm: linear-gradient(135deg, #ff8a65, #f0759b 55%, #8b78d6);
      --ink-2: #171120;
      --ink-3: #20182e;
      --ink-line: #332741;
      --tx: #f6f1fb;
      --tx-mut: #b7aac9;
      --live: #7cffc0;
      display: block;
    }
    .wrap { display: flex; gap: 12px; align-items: center; }
    .cover {
      width: 56px; height: 56px; border-radius: 12px; flex: 0 0 auto;
      background: var(--grad-warm); object-fit: cover; display: grid; place-items: center;
      color: #1a0f12; box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .7); overflow: hidden;
    }
    .cover img { width: 100%; height: 100%; object-fit: cover; }
    .cover .ph { transform: scale(1.6); opacity: .9; }
    .meta { flex: 1; min-width: 0; }
    .title {
      font-weight: 650; font-size: 13.5px; color: var(--tx); white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
      font-family: "Poppins", "Inter", "Noto Sans SC", sans-serif;
    }
    .artist {
      font-size: 12px; color: var(--tx-mut); margin-top: 2px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .now { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--live); margin-top: 4px; }
    .bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 11px; }
    .bars i { width: 2.5px; background: var(--live); border-radius: 2px; animation: eq 900ms ease-in-out infinite; }
    .bars i:nth-child(1) { height: 40%; animation-delay: 0ms; }
    .bars i:nth-child(2) { height: 90%; animation-delay: 150ms; }
    .bars i:nth-child(3) { height: 60%; animation-delay: 300ms; }
    .bars i:nth-child(4) { height: 100%; animation-delay: 80ms; }
    .paused .bars i { animation-play-state: paused; opacity: .5; }
    @keyframes eq { 0%, 100% { transform: scaleY(.4); } 50% { transform: scaleY(1); } }
    @media (prefers-reduced-motion: reduce) { .bars i { animation: none; } }
    .ctrls { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    button {
      border: 1px solid var(--ink-line); background: var(--ink-3); color: var(--tx);
      border-radius: 10px; cursor: pointer; display: grid; place-items: center;
      transition: border-color .15s, background .15s, transform .1s;
    }
    button:hover { border-color: var(--brand-pink); }
    button:active { transform: scale(.94); }
    button:focus-visible { outline: 2px solid var(--brand-pink); outline-offset: 2px; }
    .pp { width: 40px; height: 40px; background: var(--grad-warm); border: none; color: #1a0f12; }
    .pp:hover { filter: brightness(1.06); }
    .sm { width: 32px; height: 32px; color: var(--tx-mut); }
    audio { display: none; }
  `;kn([Ze({attribute:!1})],It.prototype,"track",2);kn([Ze({type:Boolean})],It.prototype,"paused",2);kn([b()],It.prototype,"_playing",2);kn([Pd("audio")],It.prototype,"_audio",2);It=kn([hs("dh-music-player")],It);var oy=Object.defineProperty,ry=Object.getOwnPropertyDescriptor,se=(e,t,n,s)=>{for(var i=s>1?void 0:s?ry(t,n):t,a=e.length-1,o;a>=0;a--)(o=e[a])&&(i=(s?o(t,n,i):o(i))||i);return s&&i&&oy(t,n,i),i};const Fr=new Set(["pending","running"]),pi=3e3,ly=5e3;let Z=class extends nt{constructor(){super(...arguments),this.aimetaToken=null,this.aimetaApi=null,this.subtitle=null,this.slots=[],this.tasks=[],this.prompt="",this.slotId=null,this.submitting=!1,this.uploading=!1,this.over=!1,this.selectedId=null,this.artifacts=[],this.err=null,this.preview=null,this.nodeFiles=[],this.contMsg="",this.contBusy=!1,this.slotBusy=!1,this.runtimeLocked=new Set,this.addTargetSlot=null,this._composing=!1,this._unsubLocale=null,this.pollTimer=null,this.refreshTimer=null,this._knownNodeFiles=new Set,this._loaded=!1,this._voiceTaskListener=e=>{this._onVoiceTask(e)},this._ingestedCallIds=new Set,this._music=null,this._musicPaused=!1,this._uiArtifactListener=e=>{const t=e.detail?.name;this.openPreviewNodeByName(typeof t=="string"?t.trim():"")},this._uiArtifactCloseListener=()=>{this.closePreview()},this._taskContinueListener=e=>{this._onVoiceTaskContinue(e)},this._taskArtifactListener=e=>{this._onVoiceTaskArtifact(e)},this._uiMusicListener=e=>{this._onUiMusic(e)}}connectedCallback(){super.connectedCallback(),window.addEventListener("secretary-voice-task",this._voiceTaskListener),window.addEventListener("dh-ui-artifact",this._uiArtifactListener),window.addEventListener("dh-ui-artifact-close",this._uiArtifactCloseListener),window.addEventListener("dh-ui-task-continue",this._taskContinueListener),window.addEventListener("dh-ui-task-artifact",this._taskArtifactListener),window.addEventListener("dh-ui-music",this._uiMusicListener),this._unsubLocale=el(()=>this.requestUpdate()),this._maybeLoad()}updated(){this._maybeLoad()}_maybeLoad(){this.enabled&&!this._loaded&&(this._loaded=!0,this.loadSlots(),this.loadTasks(),this.loadNodeFiles(),this.startRefresh())}startRefresh(){this.refreshTimer==null&&(this.refreshTimer=window.setInterval(()=>{this.loadTasks(),this.loadNodeFiles()},ly))}stopRefresh(){this.refreshTimer!=null&&(clearInterval(this.refreshTimer),this.refreshTimer=null)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("secretary-voice-task",this._voiceTaskListener),window.removeEventListener("dh-ui-artifact",this._uiArtifactListener),window.removeEventListener("dh-ui-artifact-close",this._uiArtifactCloseListener),window.removeEventListener("dh-ui-task-continue",this._taskContinueListener),window.removeEventListener("dh-ui-task-artifact",this._taskArtifactListener),window.removeEventListener("dh-ui-music",this._uiMusicListener),this._unsubLocale?.(),this._unsubLocale=null,this.stopPoll(),this.stopRefresh()}async _onVoiceTask(e){if(!this.enabled)return;const t=e.detail??{},n=t.callId||"";if(n&&this._ingestedCallIds.has(n))return;let s="",i="",a,o;try{const c=JSON.parse(t.args||"{}");s=(c.taskName||"").trim();const p=c.args&&typeof c.args=="object"?c.args:{};i=String(p.destination??p.filename??p.output??p.path??p.source??"").trim(),typeof p.content=="string"&&(a=p.content);const g=p.filename??p.destination??p.path;typeof g=="string"&&(o=g.replace(/\\/g,"/").split("/").pop()||void 0)}catch{}if(!s)return;n&&this._ingestedCallIds.add(n);const l=`🎙 语音任务: ${s}${i?` → ${i}`:""}`;try{(await fetch(this.url("/tasks/ingest"),{method:"POST",headers:{...this.authHeaders(),"Content-Type":"application/json"},body:JSON.stringify({prompt:l,status:"done",task_id_str:n||void 0,output_rel:i||void 0,content:a,filename:o})})).ok&&await this.loadTasks()}catch{}}_onUiMusic(e){const t=e.detail??{},n=t.action||"play";if(n==="stop"){this._music=null,this._musicPaused=!1;return}if(n==="pause"){this._musicPaused=!0;return}if(n==="resume"){this._musicPaused=!1;return}try{const s=JSON.parse(t.payload||"{}");if(!s.playUrl)return;this._music={playUrl:s.playUrl,title:s.title||"未知曲目",artist:s.artist||"",cover:s.cover||void 0,loop:s.loop!==!1,source:s.source},this._musicPaused=!1}catch{}}get enabled(){return!!this.aimetaApi&&!!this.aimetaToken}url(e){return`${this.aimetaApi}/api/v1${e}`}authHeaders(){return{Authorization:`Bearer ${this.aimetaToken}`}}async loadSlots(){try{const e=await fetch(this.url("/files/slots"),{headers:this.authHeaders()});if(!e.ok)throw new Error(`HTTP ${e.status}`);this.slots=await e.json()}catch(e){this.err=`${_("secretary.errLoadSlots")}: ${String(e)}`}}async loadTasks(){try{const e=await fetch(this.url("/tasks"),{headers:this.authHeaders()});if(!e.ok)throw new Error(`HTTP ${e.status}`);this.tasks=await e.json()}catch(e){this.err=`${_("secretary.errLoadTasks")}: ${String(e)}`}}async doUpload(e){if(!(!e.length||!this.enabled)){this.uploading=!0,this.err=null;try{const t=new FormData;for(const s of e)t.append("files",s);const n=await fetch(this.url("/files/slots"),{method:"POST",headers:this.authHeaders(),body:t});if(!n.ok)throw new Error(`HTTP ${n.status}`);await this.loadSlots()}catch(t){this.err=`${_("secretary.errUpload")}: ${String(t)}`}finally{this.uploading=!1}}}slotLocked(e){return this.runtimeLocked.has(e)?!0:this.tasks.some(t=>t.slot_id===e)}async addToSlot(e,t){if(!(!t.length||!this.enabled)){this.slotBusy=!0,this.err=null;try{const n=new FormData;for(const i of t)n.append("files",i);const s=await fetch(this.url(`/files/slots/${e}/files`),{method:"POST",headers:this.authHeaders(),body:n});if(!s.ok)throw new Error(`HTTP ${s.status}`);await this.loadSlots()}catch(n){this.err=`${_("secretary.errUpload")}: ${String(n)}`}finally{this.slotBusy=!1}}}async deleteSlot(e){if(this.enabled){this.slotBusy=!0,this.err=null;try{const t=await fetch(this.url(`/files/slots/${e}`),{method:"DELETE",headers:this.authHeaders()});if(t.status===409){this.runtimeLocked=new Set(this.runtimeLocked).add(e);return}if(!t.ok&&t.status!==204)throw new Error(`HTTP ${t.status}`);await this.loadSlots()}catch(t){this.err=`${_("secretary.errDelete")}: ${String(t)}`}finally{this.slotBusy=!1}}}async deleteSlotFile(e,t){if(this.enabled){this.slotBusy=!0,this.err=null;try{const n=await fetch(this.url(`/files/slots/${e}/files/${t}`),{method:"DELETE",headers:this.authHeaders()});if(!n.ok&&n.status!==204)throw new Error(`HTTP ${n.status}`);await this.loadSlots()}catch(n){this.err=`${_("secretary.errDelete")}: ${String(n)}`}finally{this.slotBusy=!1}}}pick(e,t=null){this.addTargetSlot=t,this.renderRoot.querySelector(e)?.click()}async _resolveAndSelectTask(e){await this.loadTasks();const t=this.tasks.find(n=>(n.user_seq??n.id)===e)??this.tasks.find(n=>n.id===e);return t?(this.selectedId!==t.id?(this.stopPoll(),this.selectedId=t.id,this.artifacts=[],this.detailStatus=void 0,await this.pullDetail(),this.pollTimer=window.setInterval(()=>{this.pullDetail()},pi)):this.artifacts.length===0&&await this.pullDetail(),t):null}static _pickArtifact(e,t){if(e.length===0)return;const n=o=>(o.filename.split(".").pop()||"").toLowerCase(),s=o=>o.toLowerCase().replace(/[\s_\-.]+/g,""),i=s(t),a=(o,l)=>{const c=e.filter(u=>o.includes(n(u)));if(c.length===0)return;const p=i.replace(l,"");return(p?c.find(u=>s(u.filename).includes(p)):void 0)??c[0]};if(/pdf/.test(i))return a(["pdf"],/pdf/g);if(/(xlsx|xls|excel|csv|表格)/.test(i))return a(["xlsx","xls","csv"],/(xlsx|xls|excel|csv|表格)/g);if(/(docx|doc|word|文档|文檔)/.test(i))return a(["doc","docx"],/(docx|doc|word|文档|文檔)/g);if(/(png|jpg|jpeg|gif|webp|svg|图片|圖片|图像|圖像|截图|截圖|image|photo)/.test(i))return a(["png","jpg","jpeg","gif","webp","svg"],/(png|jpe?g|gif|webp|svg|图片|圖片|图像|圖像|截图|截圖|image|photo)/g);if(i){const o=e.find(l=>s(l.filename)===i)??e.find(l=>s(l.filename).includes(i))??e.find(l=>i.includes(s(l.filename.replace(/\.[^.]+$/,"")))&&s(l.filename.replace(/\.[^.]+$/,"")));if(o)return o}return e.find(o=>n(o)==="pdf")??e.find(o=>!/^source\./i.test(o.filename))??e[0]}async _onVoiceTaskArtifact(e){if(!this.enabled)return;let t=NaN,n="";try{const a=JSON.parse(e.detail?.payload||"{}");t=Number(a.seq),n=String(a.query??"").trim()}catch{return}if(!Number.isFinite(t)||t<=0)return;if(!await this._resolveAndSelectTask(t)){this.err=`没有找到第 ${t} 号任务`;return}if(this.artifacts.length===0){this.err=`第 ${t} 号任务还没有成果物`;return}const i=Z._pickArtifact(this.artifacts,n);i&&this.openPreview(i)}async _onVoiceTaskContinue(e){if(!this.enabled)return;let t=NaN,n="";try{const i=JSON.parse(e.detail?.payload||"{}");t=Number(i.seq),n=String(i.text??"").trim()}catch{return}if(!Number.isFinite(t)||t<=0||!n)return;if(!await this._resolveAndSelectTask(t)){this.err=`没有找到第 ${t} 号任务`;return}this.contMsg=n,await this.continueTask()}async continueTask(){const e=this.contMsg.trim();if(!(!e||this.contBusy||this.selectedId==null||!this.enabled)){this.contBusy=!0,this.err=null;try{const t=await fetch(this.url(`/tasks/${this.selectedId}/messages`),{method:"POST",headers:{...this.authHeaders(),"Content-Type":"application/json"},body:JSON.stringify({prompt:e})});if(!t.ok)throw new Error(`HTTP ${t.status}`);this.contMsg="",await this.loadTasks(),this.detailStatus="running",this.stopPoll(),this.pullDetail(),this.pollTimer=window.setInterval(()=>{this.pullDetail()},pi)}catch(t){this.err=`${_("secretary.errContinue")}: ${String(t)}`}finally{this.contBusy=!1}}}async submit(e){e.preventDefault();const t=this.prompt.trim();if(!(!t||this.submitting||!this.enabled)){this.submitting=!0,this.err=null;try{const n=await fetch(this.url("/tasks"),{method:"POST",headers:{...this.authHeaders(),"Content-Type":"application/json"},body:JSON.stringify({prompt:t,slot_id:this.slotId})});if(!n.ok)throw new Error(`HTTP ${n.status}`);const s=await n.json();this.prompt="",await this.loadTasks(),this.select(s.id)}catch(n){this.err=`任务发布失败: ${String(n)}`}finally{this.submitting=!1}}}select(e){if(this.stopPoll(),this.selectedId===e){this.selectedId=null,this.artifacts=[];return}this.selectedId=e,this.artifacts=[],this.detailStatus=void 0,this.pullDetail(),this.pollTimer=window.setInterval(()=>{this.pullDetail()},pi)}stopPoll(){this.pollTimer!=null&&(clearInterval(this.pollTimer),this.pollTimer=null)}async pullDetail(){if(this.selectedId!=null)try{const e=await fetch(this.url(`/tasks/${this.selectedId}`),{headers:this.authHeaders()});if(e.status===404){this.stopPoll();return}if(!e.ok)throw new Error(`HTTP ${e.status}`);const t=await e.json();this.detailStatus=t.task.status,this.artifacts=t.artifacts??[],Fr.has(t.task.status)||(this.stopPoll(),this.loadTasks())}catch{}}async download(e){if(this.selectedId!=null)try{const t=await fetch(this.url(`/tasks/${this.selectedId}/artifacts/${e.id}`),{headers:this.authHeaders()});if(!t.ok)throw new Error(`HTTP ${t.status}`);const n=await t.blob(),s=URL.createObjectURL(n),i=document.createElement("a");i.href=s,i.download=e.filename,i.click(),URL.revokeObjectURL(s)}catch(t){this.err=`${_("secretary.errDownload")}: ${String(t)}`}}static _kind(e){const t=(e.split(".").pop()||"").toLowerCase();return["html","htm"].includes(t)?"html":t==="pdf"?"pdf":["png","jpg","jpeg","gif","svg","webp"].includes(t)?"image":["txt","md","json","csv","js","ts","py","css","log","yaml","yml","xml"].includes(t)?"text":"none"}async openPreview(e){if(this.selectedId==null)return;const t=Z._kind(e.filename);if(this.closePreview(),t==="none"){this.preview={name:e.filename,kind:t,art:e};return}try{const n=await fetch(this.url(`/tasks/${this.selectedId}/artifacts/${e.id}`),{headers:this.authHeaders()});if(!n.ok)throw new Error(`HTTP ${n.status}`);t==="html"||t==="text"?this.preview={name:e.filename,kind:t,text:await n.text(),art:e}:this.preview={name:e.filename,kind:t,url:URL.createObjectURL(await n.blob()),art:e}}catch(n){this.err=`${_("secretary.errPreview")}: ${String(n)}`}}closePreview(){if(this.preview?.url)try{URL.revokeObjectURL(this.preview.url)}catch{}this.preview=null}async loadNodeFiles(){try{const e=await fetch(this.url("/tasks/nodefiles"),{headers:this.authHeaders()});if(!e.ok)return;const n=(await e.json()).files??[],s=this._knownNodeFiles,i=s.size===0,a=n.filter(o=>!s.has(o.path));for(const o of n)this._knownNodeFiles.add(o.path);this.nodeFiles=n,!i&&a.length>0&&window.dispatchEvent(new CustomEvent("secretary-artifact-new",{detail:{files:a.map(o=>o.name)}}))}catch{}}async openPreviewNode(e){const t=Z._kind(e.name);if(this.closePreview(),t==="none"){this.preview={name:e.name,kind:t,nodePath:e.path};return}try{const n=await fetch(this.url(`/tasks/nodefile?path=${encodeURIComponent(e.path)}&disposition=inline`),{headers:this.authHeaders()});if(!n.ok)throw new Error(`HTTP ${n.status}`);t==="html"||t==="text"?this.preview={name:e.name,kind:t,text:await n.text(),nodePath:e.path}:this.preview={name:e.name,kind:t,url:URL.createObjectURL(await n.blob()),nodePath:e.path}}catch(n){this.err=`${_("secretary.errPreview")}: ${String(n)}`}}async openPreviewNodeByName(e){if(!this.enabled)return;if(this.nodeFiles.length===0)try{await this.loadNodeFiles()}catch{}const t=this.nodeFiles;if(t.length===0){this.err=_("secretary.noArtifactYet");return}const n=e.trim(),s=l=>l.toLowerCase().replace(/[\s_\-.]+/g,""),i=l=>s(l.replace(/\.[^.]+$/,"")),a=s(n);let o;if(a&&(o=t.find(l=>s(l.name)===a)??t.find(l=>s(l.name).includes(a))??t.find(l=>a.includes(i(l.name))&&i(l.name))??t.find(l=>i(l.name).includes(a))),!o){const l=c=>[...t].reverse().find(p=>c.test(p.name));/pdf/i.test(n)?o=l(/\.pdf$/i):/(图片|圖片|图|圖|image|photo|png|jpe?g)/i.test(n)?o=l(/\.(png|jpe?g|gif|webp|svg)$/i):/(表格|表|csv|excel|xlsx?)/i.test(n)?o=l(/\.(csv|xlsx?)$/i):/(文档|文檔|报告|報告|word|docx?)/i.test(n)&&(o=l(/\.(docx?|md|txt|pdf)$/i))}o||(o=t[t.length-1]),await this.openPreviewNode({name:o.name,path:o.path})}async downloadNode(e){try{const t=await fetch(this.url(`/tasks/nodefile?path=${encodeURIComponent(e.path)}&disposition=attachment`),{headers:this.authHeaders()});if(!t.ok)throw new Error(`HTTP ${t.status}`);const n=URL.createObjectURL(await t.blob()),s=document.createElement("a");s.href=n,s.download=e.name,s.click(),URL.revokeObjectURL(n)}catch(t){this.err=`${_("secretary.errDownload")}: ${String(t)}`}}badge(e){const t=e==="done"?"b-done":e==="error"?"b-err":e==="running"||e==="pending"?"b-run":"b-idle",n=_(e==="done"?"secretary.badgeDone":e==="error"?"secretary.badgeError":e==="running"||e==="pending"?"secretary.badgeRunning":"secretary.badgeIdle");return r`<span class="badge ${t}">${n}</span>`}render(){if(!this.enabled)return r`<div class="disabled-note">${_("secretary.disabledTitle")}<br />${_("secretary.disabledHint")}</div>`;const e=this.tasks.find(n=>n.id===this.selectedId)??null,t=this.detailStatus??e?.status;return r`
      <!-- ① 对话 / 字幕 -->
      <section class="card">
        <div class="head">
          <span class="ic i1">${cy}</span>
          <h3>${_("secretary.dialogTitle")}</h3>
          ${this.badge(t)}
        </div>
        <div class="statusbar">${this.subtitle||_("secretary.subtitlePlaceholder")}</div>
      </section>

      <!-- 🎵 音乐(内蔵 music bundle・docs/20): 語音点歌で _music が入ると出現。循环再生。 -->
      ${this._music?r`
          <section class="card">
            <div class="head"><span class="ic i1">${dy}</span><h3>音乐</h3></div>
            <dh-music-player
              .track=${this._music}
              .paused=${this._musicPaused}
              @music-stop=${()=>{this._music=null,this._musicPaused=!1}}
            ></dh-music-player>
          </section>`:v}

      <!-- ② 任务 & 成果物: 番号付き一覧 + 選択タスクの成果物 + 継続指示。
           「生成的成果物」独立区は削除(各タスク配下に成果物があるため。2026-07-05 要望)。 -->
      <section class="card">
        <div class="head"><span class="ic i2">${uy}</span><h3>${_("secretary.tasksTitle")}</h3></div>
        ${this.err?r`<p class="err">${this.err}</p>`:v}
        ${this.tasks.length===0?r`<p class="muted">${_("secretary.noTasks")}</p>`:r`<ul class="tasklist">${this.tasks.map(n=>{const s=n.id===this.selectedId,i=s&&this.detailStatus?this.detailStatus:n.status,a=n.slot_id!=null?this.slots.find(c=>c.id===n.slot_id)?.name:null,o=n.user_seq??n.id,l=n.name&&n.name.trim()||n.prompt;return r`<li>
                <button class="taskitem ${s?"sel":""}" @click=${()=>this.select(n.id)}>
                  <span class="chev">${hy}</span>
                  <span class="seq">#${o}</span>
                  <span class="p">${l}</span>
                  ${a?r`<span class="badge b-slot">${a}</span>`:v}
                  ${this.badge(i)}
                </button>
                ${s?r`<div class="arts">
                  ${n.github_url?r`<a class="art gh" href=${n.github_url} target="_blank" rel="noopener">${by} GitHub</a>`:v}
                  ${this.artifacts.length===0?r`<span class="muted">${Fr.has(i)?_("secretary.artifactsRunning"):_("secretary.artifactsEmpty")}</span>`:this.artifacts.map(c=>r`<span class="art" title=${_("secretary.preview")} @click=${()=>{this.openPreview(c)}}>${vy}<span class="art-nm">${c.filename}</span><span class="art-dl" title=${_("secretary.download")} @click=${p=>{p.stopPropagation(),this.download(c)}}>${gi}</span></span>`)}
                </div>
                <div class="cont">
                  <textarea
                    .value=${this.contMsg}
                    placeholder=${_("secretary.continuePlaceholder")}
                    @input=${c=>this.contMsg=c.target.value}
                    @compositionstart=${()=>this._composing=!0}
                    @compositionend=${()=>this._composing=!1}
                    @keydown=${c=>{c.key==="Enter"&&!c.shiftKey&&!this._composing&&!c.isComposing&&(c.preventDefault(),this.continueTask())}}></textarea>
                  <div class="row">
                    <button class="primary" ?disabled=${this.contBusy||this.contMsg.trim()===""} @click=${()=>{this.continueTask()}}>
                      ${this.contBusy?r`<span class="spin">${Nr}</span>`:gy}
                      ${this.contBusy?_("secretary.sending"):_("secretary.send")}
                    </button>
                  </div>
                </div>`:v}
              </li>`})}</ul>`}
      </section>

      <!-- ③ 资料 Slot(タスク管理画面と同等: 追加/削除/文件削除 + 相册/拍照アップロード) -->
      <section class="card">
        <div class="head"><span class="ic i3">${py}</span><h3>${_("secretary.slotTitle")}</h3></div>
        <div class="drop ${this.over?"over":""}"
          @click=${()=>this.pick("#fpick")}
          @dragover=${n=>{n.preventDefault(),this.over=!0}}
          @dragleave=${()=>this.over=!1}
          @drop=${n=>{n.preventDefault(),this.over=!1,this.doUpload(n.dataTransfer?Array.from(n.dataTransfer.files):[])}}>
          <span class="up">${this.uploading?r`<span class="spin">${Nr}</span>`:fy}</span>
          <span>${this.uploading?_("secretary.uploading"):_("secretary.dropHint")}</span>
        </div>
        <!-- 相册 / 拍照(新規 slot を作成) -->
        <div class="src-row">
          <button class="src-btn" @click=${()=>this.pick("#apick")}>${yy} ${_("secretary.fromAlbum")}</button>
          <button class="src-btn" @click=${()=>this.pick("#cpick")}>${xy} ${_("secretary.startCamera")}</button>
        </div>
        <!-- hidden inputs: 汎用 / 相册(image) / 拍照(camera) / slot追加 -->
        <input id="fpick" type="file" multiple style="display:none"
          @change=${n=>{const s=n.target;this.doUpload(s.files?Array.from(s.files):[]),s.value=""}} />
        <input id="apick" type="file" accept="image/*" multiple style="display:none"
          @change=${n=>{const s=n.target;this.doUpload(s.files?Array.from(s.files):[]),s.value=""}} />
        <input id="cpick" type="file" accept="image/*" capture="environment" style="display:none"
          @change=${n=>{const s=n.target;this.doUpload(s.files?Array.from(s.files):[]),s.value=""}} />
        <input id="addpick" type="file" multiple style="display:none"
          @change=${n=>{const s=n.target,i=this.addTargetSlot;this.addTargetSlot=null,i!=null&&this.addToSlot(i,s.files?Array.from(s.files):[]),s.value=""}} />
        ${this.slots.length===0?r`<p class="muted">${_("secretary.noSlots")}</p>`:r`<ul class="slotlist">${this.slots.map(n=>{const s=this.slotLocked(n.id);return r`<li class="slotcard">
              <div class="top">
                <span class="nm">${n.name}</span>
                <span class="muted">${_("secretary.fileCount",{count:n.files.length})}</span>
                <button class="act" title=${_("secretary.addFiles")} aria-label=${_("secretary.addFiles")}
                  ?disabled=${this.slotBusy} @click=${()=>this.pick("#addpick",n.id)}>${wy}</button>
                ${s?r`<span class="act lock" title=${_("secretary.slotInUse")} aria-label=${_("secretary.slotInUse")}>${Or}</span>`:r`<button class="act del" title=${_("secretary.deleteSlot")} aria-label=${_("secretary.deleteSlot")}
                      ?disabled=${this.slotBusy} @click=${()=>{this.deleteSlot(n.id)}}>${$y}</button>`}
              </div>
              ${n.files.map(i=>r`<div class="file">${my}<span class="fn">${i.filename}</span>
                <span class="fdel" title=${_("secretary.deleteFile")} aria-label=${_("secretary.deleteFile")}
                  @click=${()=>{this.deleteSlotFile(n.id,i.id)}}>${ky}</span></div>`)}
              ${s?r`<div class="lockhint">${Or}${_("secretary.slotInUse")}</div>`:v}
            </li>`})}</ul>`}
      </section>

      ${this.preview?r`
        <div class="pv-mask" @click=${()=>this.closePreview()}>
          <div class="pv-box" @click=${n=>n.stopPropagation()}>
            <div class="pv-head">
              <span class="pv-name">${this.preview.name}</span>
              ${this.preview.art?r`<button class="pv-dl" @click=${()=>this.preview?.art&&void this.download(this.preview.art)}>${gi} ${_("secretary.download")}</button>`:this.preview.nodePath?r`<button class="pv-dl" @click=${()=>{const n=this.preview;n?.nodePath&&this.downloadNode({name:n.name,path:n.nodePath})}}>${gi} ${_("secretary.download")}</button>`:v}
              <button class="pv-x" title=${_("secretary.close")} @click=${()=>this.closePreview()}>✕</button>
            </div>
            <div class="pv-body">
              ${this.preview.kind==="html"?r`<iframe class="pv-frame" sandbox="allow-scripts" .srcdoc=${this.preview.text??""}></iframe>`:this.preview.kind==="text"?r`<pre class="pv-pre">${this.preview.text??""}</pre>`:this.preview.kind==="image"?r`<img class="pv-img" src=${this.preview.url??""} alt=${this.preview.name} />`:this.preview.kind==="pdf"?r`<iframe class="pv-frame" src=${this.preview.url??""}></iframe>`:r`<div class="pv-none">${_("secretary.previewUnsupported")}</div>`}
            </div>
          </div>
        </div>`:v}
    `}};Z.styles=Qi`
    :host {
      /* ── brand token(ai-meta §3.4 复刻・值精确一致)────────────────────── */
      --brand-pink: #F0759B;
      --brand-coral: #FF8A65;
      --brand-lav: #8B78D6;
      --grad-warm: linear-gradient(135deg, #FF8A65, #F0759B 55%, #8B78D6);
      --ink: #0F0B15;
      --ink-2: #171120;
      --ink-3: #20182E;
      --ink-line: #332741;
      --gold: #C9962E;
      --live: #7CFFC0;
      --tx: #F6F1FB;
      --tx-mut: #B7AAC9;
      --r: 14px;
      /* 別名(既存クラスからの参照互換) */
      --accent: var(--brand-pink);
      --line: var(--ink-line);
      --muted: var(--tx-mut);
      display: block;
      height: 100%;
      overflow-y: auto;
      padding: 18px 16px 22px;
      box-sizing: border-box;
      background: radial-gradient(120% 60% at 50% -8%, rgba(247, 168, 196, .10), transparent 60%), var(--ink);
      color: var(--tx);
      font-size: 13px;
      font-family: "Inter", "Noto Sans SC", system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    :host::-webkit-scrollbar { width: 8px; }
    :host::-webkit-scrollbar-thumb { background: var(--ink-line); border-radius: 8px; }

    .card {
      background: var(--ink-2);
      border: 1px solid var(--ink-line);
      border-radius: var(--r);
      padding: 14px 14px 15px;
      margin-bottom: 14px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 10px 26px -14px rgba(0, 0, 0, .6);
    }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .head .ic {
      width: 26px; height: 26px; border-radius: 8px; flex: 0 0 auto;
      display: grid; place-items: center; color: #1a0f12;
      background: var(--grad-warm);
    }
    /* 3 段とも brand ウォームグラデ小方块(chat.html 右栏に統一) */
    .ic.i1, .ic.i2, .ic.i3 { background: var(--grad-warm); }
    .head h3 { font-size: 13.5px; font-weight: 650; margin: 0; flex: 1; letter-spacing: .01em; color: var(--tx);
      font-family: "Poppins", "Inter", "Noto Sans SC", sans-serif; }

    .badge { border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 650; white-space: nowrap; border: 1px solid transparent; }
    /* 暗底 + 安全色 */
    .b-run { background: rgba(201, 150, 46, .16); color: var(--gold); border-color: rgba(201, 150, 46, .4); }
    .b-done { background: rgba(124, 255, 192, .12); color: var(--live); border-color: rgba(124, 255, 192, .35); }
    .b-err { background: rgba(240, 117, 155, .16); color: #FF9DBB; border-color: rgba(240, 117, 155, .4); }
    .b-idle { background: rgba(139, 120, 214, .16); color: #C3B7F2; border-color: rgba(139, 120, 214, .4); }
    .b-slot { background: var(--ink-3); color: var(--tx-mut); font-weight: 600; border-color: var(--ink-line); }

    .statusbar {
      min-height: 42px; border-radius: 12px; padding: 9px 12px;
      background: var(--ink-3); border: 1px solid var(--ink-line); color: var(--tx-mut);
      line-height: 1.5;
    }

    textarea {
      width: 100%; box-sizing: border-box; resize: none; min-height: 54px;
      border: 1px solid var(--ink-line); border-radius: 12px; padding: 10px 12px; font: inherit;
      color: var(--tx); background: var(--ink-3); transition: border-color .15s, box-shadow .15s;
    }
    textarea:focus { outline: none; border-color: var(--brand-pink); box-shadow: 0 0 0 3px rgba(240, 117, 155, .18); }
    textarea::placeholder { color: var(--tx-mut); opacity: .8; }

    .composer-row { display: flex; align-items: center; gap: 8px; margin-top: 9px; }
    .selwrap { display: inline-flex; align-items: center; gap: 6px; color: var(--tx-mut); font-size: 12px; }
    select {
      border: 1px solid var(--ink-line); border-radius: 9px; padding: 5px 8px; font: inherit;
      color: var(--tx); background: var(--ink-3);
    }
    .grow { flex: 1; }

    button.primary {
      background: var(--grad-warm); color: #1a0f12; border: 0; border-radius: 11px;
      padding: 8px 16px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      box-shadow: 0 8px 20px -8px rgba(240, 117, 155, .6); transition: filter .15s, transform .05s;
    }
    button.primary:hover:not(:disabled) { filter: brightness(1.06); }
    button.primary:active:not(:disabled) { transform: translateY(1px); }
    button.primary:disabled { background: var(--ink-3); color: var(--tx-mut); box-shadow: none; cursor: not-allowed; }
    .mic {
      width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--ink-line); background: var(--ink-3);
      color: var(--tx-mut); display: grid; place-items: center; cursor: default;
    }

    .tasklist { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .taskitem {
      width: 100%; text-align: left; border: 1px solid var(--ink-line); border-radius: 12px;
      background: var(--ink-3); padding: 10px 12px; cursor: pointer; display: flex; gap: 9px; align-items: center;
      transition: border-color .15s, background .15s, box-shadow .15s; font: inherit; color: var(--tx);
    }
    .taskitem:hover { border-color: rgba(240, 117, 155, .45); box-shadow: 0 4px 14px -8px rgba(240, 117, 155, .4); }
    .taskitem.sel { border-color: var(--brand-pink); background: rgba(240, 117, 155, .08); }
    .taskitem .chev { color: var(--tx-mut); flex: 0 0 auto; transition: transform .15s; }
    .taskitem.sel .chev { transform: rotate(90deg); color: var(--brand-pink); }
    .taskitem .p { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }

    .arts { margin: 8px 0 2px 28px; display: flex; flex-direction: column; gap: 6px; }
    .art {
      display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
      color: var(--tx); text-decoration: none; font-size: 12px; padding: 4px 10px;
      border: 1px solid var(--ink-line); border-radius: 9px; background: var(--ink-3); cursor: pointer;
    }
    .art:hover { background: rgba(240, 117, 155, .1); border-color: rgba(240, 117, 155, .45); }
    .gh { color: var(--tx); }

    .drop {
      border: 1.5px dashed var(--ink-line); border-radius: var(--r); padding: 22px 14px; text-align: center;
      cursor: pointer; background: var(--ink-3); color: var(--tx-mut); transition: .15s;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .drop:hover, .drop.over { border-color: var(--brand-pink); background: rgba(240, 117, 155, .08); color: var(--brand-pink); }
    .drop .up { width: 30px; height: 30px; color: var(--brand-pink); }

    .slotlist { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
    .slotcard { border: 1px solid var(--ink-line); border-radius: 12px; background: var(--ink-3); padding: 11px 12px; }
    .slotcard .top { display: flex; align-items: center; gap: 8px; }
    .slotcard .nm { font-weight: 650; flex: 1; color: var(--tx); }
    .file { display: flex; gap: 7px; align-items: center; color: var(--tx-mut); font-size: 12px; margin-top: 6px; }

    .muted { color: var(--tx-mut); font-size: 12px; padding: 4px 2px; }
    .err { color: #FF9DBB; font-size: 12px; margin-top: 8px; background: rgba(240, 117, 155, .12); border: 1px solid rgba(240, 117, 155, .4);
      border-radius: 9px; padding: 6px 10px; }
    .spin { animation: sp 1s linear infinite; } @keyframes sp { to { transform: rotate(360deg); } }
    .disabled-note { padding: 14px; color: var(--tx-mut); text-align: center; }

    /* 成果物: プレビュー可能なチップ(名前=preview、DLアイコン=download) */
    .art { cursor: pointer; }
    .art-nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .art-dl { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px;
      color: var(--tx); flex: 0 0 auto; }
    .art-dl:hover { background: var(--ink-line); color: var(--brand-pink); }

    /* preview モーダル(暗壳。html iframe / 白底 PDF は内側で白のまま=枠で分離) */
    .pv-mask { position: fixed; inset: 0; background: rgba(6, 4, 10, .72); display: grid; place-items: center; z-index: 9999; }
    .pv-box { width: min(92vw, 940px); height: min(86vh, 760px); background: var(--ink-2); border-radius: 16px;
      display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--ink-line);
      box-shadow: 0 24px 70px -12px rgba(0, 0, 0, .7); }
    .pv-head { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-bottom: 1px solid var(--ink-line); }
    .pv-name { flex: 1; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tx); }
    .pv-dl { background: var(--grad-warm); color: #1a0f12; border: 0; border-radius: 9px; padding: 6px 13px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 5px; font: inherit; font-weight: 700; }
    .pv-dl:hover { filter: brightness(1.06); }
    .pv-x { background: var(--ink-3); border: 1px solid var(--ink-line); border-radius: 8px; width: 30px; height: 30px; cursor: pointer; font-size: 14px; color: var(--tx-mut); }
    .pv-x:hover { background: var(--ink-line); color: var(--tx); }
    .pv-body { flex: 1; overflow: auto; background: var(--ink); }
    /* html/pdf は白底コンテンツ → 枠+角丸で暗壳から分離 */
    .pv-frame { width: 100%; height: 100%; border: 0; background: #fff; }
    .pv-pre { margin: 0; padding: 14px; white-space: pre-wrap; word-break: break-word; font-size: 12.5px; line-height: 1.5; color: var(--tx); }
    .pv-img { max-width: 100%; display: block; margin: 12px auto; }
    .pv-none { padding: 44px 20px; text-align: center; color: var(--tx-mut); }

    /* 生成的成果物(node 実ファイル)一覧 */
    .nf-head { display: flex; align-items: center; gap: 8px; margin: 14px 0 6px; padding-top: 12px; border-top: 1px dashed var(--ink-line); }
    .nf-title { font-size: 12px; font-weight: 650; color: var(--tx-mut); flex: 1; }
    .nf-refresh { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; color: var(--tx-mut); cursor: pointer; }
    .nf-refresh:hover { background: var(--ink-line); color: var(--brand-pink); }
    .nf-list { margin: 0; }

    /* ── 任务编号 #N + name(タスク管理画面と統一)── */
    .taskitem .seq { flex: 0 0 auto; font-weight: 800; font-size: 12.5px; color: var(--tx-mut); font-variant-numeric: tabular-nums; }
    .taskitem.sel .seq { color: var(--brand-pink); }

    /* ── 継続指示コンポーザ(選択タスク配下)── */
    .cont { margin: 8px 0 2px 28px; display: flex; flex-direction: column; gap: 7px; }
    .cont textarea { min-height: 40px; font-size: 12.5px; }
    .cont .row { display: flex; justify-content: flex-end; }
    .cont button { padding: 6px 14px; font-size: 12.5px; }

    /* ── slot ヘッダのアクション(追加 / 削除 / lock)+ ファイル行の削除 ── */
    /* 暗底で見える様に:白アイコン + 明るめの箱(--ink-line 背景 + 明線)。 */
    .slotcard .act { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 8px;
      border: 1px solid #4a3a5e; background: var(--ink-line); color: var(--tx); cursor: pointer; flex: 0 0 auto; }
    .slotcard .act:hover { border-color: var(--brand-pink); background: rgba(240, 117, 155, .16); color: #fff; }
    .slotcard .act.del:hover { border-color: #FF9DBB; background: rgba(240, 117, 155, .16); color: #FF9DBB; }
    .slotcard .act.lock { cursor: not-allowed; background: var(--ink-2); color: var(--tx-mut); }
    .slotcard .act:disabled { opacity: .4; cursor: not-allowed; }
    .file { justify-content: flex-start; }
    .file .fn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* ファイル削除は常時表示(hover 依存を廃止)+ 暗底で見える白アイコン + 箱。 */
    .file .fdel { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 7px;
      border: 1px solid #4a3a5e; background: var(--ink-line); color: var(--tx); cursor: pointer; flex: 0 0 auto; }
    .file .fdel:hover { border-color: #FF9DBB; background: rgba(240, 117, 155, .16); color: #FF9DBB; }
    .lockhint { display: flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 11px; color: var(--tx-mut); }

    /* ── 上传来源ボタン(相册 / 拍照。拖拽エリア下)── */
    .src-row { display: flex; gap: 8px; margin-top: 9px; }
    .src-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      border: 1px solid #4a3a5e; border-radius: 10px; background: var(--ink-line); color: var(--tx);
      padding: 9px 10px; font: inherit; font-size: 12px; cursor: pointer; transition: .15s; }
    .src-btn:hover { border-color: var(--brand-pink); background: rgba(240, 117, 155, .16); color: #fff; }
  `;se([Ze({type:String})],Z.prototype,"aimetaToken",2);se([Ze({type:String})],Z.prototype,"aimetaApi",2);se([Ze({type:String})],Z.prototype,"subtitle",2);se([b()],Z.prototype,"slots",2);se([b()],Z.prototype,"tasks",2);se([b()],Z.prototype,"prompt",2);se([b()],Z.prototype,"slotId",2);se([b()],Z.prototype,"submitting",2);se([b()],Z.prototype,"uploading",2);se([b()],Z.prototype,"over",2);se([b()],Z.prototype,"selectedId",2);se([b()],Z.prototype,"detailStatus",2);se([b()],Z.prototype,"artifacts",2);se([b()],Z.prototype,"err",2);se([b()],Z.prototype,"preview",2);se([b()],Z.prototype,"nodeFiles",2);se([b()],Z.prototype,"contMsg",2);se([b()],Z.prototype,"contBusy",2);se([b()],Z.prototype,"slotBusy",2);se([b()],Z.prototype,"runtimeLocked",2);se([b()],Z.prototype,"_music",2);se([b()],Z.prototype,"_musicPaused",2);Z=se([hs("secretary-panel")],Z);const ae=(e,t=15)=>r`<svg viewBox="0 0 24 24" width=${t} height=${t} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${e}</svg>`,cy=ae(J`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,15),dy=ae(J`<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,15),uy=ae(J`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`,15),py=ae(J`<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`,15);ae(J`<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>`,16);const gy=ae(J`<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`,15),Nr=ae(J`<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`,15),hy=ae(J`<polyline points="9 18 15 12 9 6"/>`,15),fy=ae(J`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`,26),my=ae(J`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,14),gi=ae(J`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,14),vy=ae(J`<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>`,14);ae(J`<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,14);const by=ae(J`<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>`,14),yy=ae(J`<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>`,15),xy=ae(J`<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`,15),wy=ae(J`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,16),Or=ae(J`<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,14),$y=ae(J`<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,15),ky=ae(J`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,14),Sy=".shell--dh";function Rt(){return document.querySelector(Sy)}function Wi(e){Rt()?.classList.toggle("task-open",e)}function Uc(){const e=Rt();e&&e.classList.toggle("task-open")}function Br(e){Rt()?.classList.toggle("controls-hidden",!e)}function Hc(){const e=Rt();e&&e.classList.toggle("controls-hidden")}function Ur(e){Rt()?.classList.toggle("dh-immersive",e)}function Ay(){const e=Rt();e&&e.classList.toggle("dh-immersive")}let Hr=!1;function Cy(){if(Hr||typeof window>"u")return;let e=0;const t=()=>{const n=Rt();if(n){Hr=!0,window.innerWidth>=1024&&n.classList.add("task-open");return}e++<12&&setTimeout(t,60)};setTimeout(t,0)}let zr=!1;function Ty(){zr||typeof window>"u"||(zr=!0,window.addEventListener("dh-ui-action",e=>{const t=e.detail;if(!t)return;const n=t.action??"toggle",s=n==="show"||n==="open"||n==="on",i=n==="hide"||n==="close"||n==="off";t.target==="task_panel"?s?Wi(!0):i?Wi(!1):Uc():t.target==="controls"?s?Br(!0):i?Br(!1):Hc():t.target==="fullscreen"?s?Ur(!0):i?Ur(!1):Ay():t.target==="artifact"&&(i?window.dispatchEvent(new CustomEvent("dh-ui-artifact-close")):window.dispatchEvent(new CustomEvent("dh-ui-artifact",{detail:{name:t.name}})))}))}function _y(){return r`<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>`}function Ey(){return r`<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
    <polyline points="4 14 10 14 10 20"/>
    <polyline points="20 10 14 10 14 4"/>
    <line x1="10" y1="14" x2="3" y2="21"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
  </svg>`}function Ly(){return r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2"/>
    <line x1="15" y1="4" x2="15" y2="20"/>
  </svg>`}function Iy(){return r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`}async function zc(e){if(document.fullscreenElement)await document.exitFullscreen();else{const t=document.querySelector(e);t&&await t.requestFullscreen()}}function My(e){const t=!!document.fullscreenElement,n=_(t?"layout.exitFullscreen":"layout.dhFullscreen");return r`
    <button
      class="panel-fullscreen-btn"
      @click=${()=>zc(".panel-dh")}
      title=${n}
      aria-label=${n}
    >
      ${t?Ey():_y()}
    </button>
  `}function Ry(e){const t=["main-container",`layout-${e.layoutMode}`,`orientation-${e.orientation}`].join(" ");return Ty(),Cy(),r`
    <style>
      /* 数字人秘书 A案(docs/10 §4.2): DH タブ表示中のみ外側の顶栏/セッションタブを隠す
         (この <style> は DH レンダリング時だけ DOM に存在 → 他タブに影響しない)。 */
      .shell--dh > .topbar { display: none !important; }
      /* 旧 topbar 領域の余白を除去。shell は grid(named areas: topbar/main/statusbar)。
         topbar 行を 0 に潰す。★statusbar footer は削除済(ユーザ要望 2026-07-07)なので
         statusbar 行も 0 に潰す(でないと底部に 32px の空白帯が残る)。 */
      .shell--dh { padding: 0 !important; gap: 0 !important; grid-template-rows: 0 1fr 0 !important; }
      .shell--dh .shell--secretary {
        grid-template-rows: 0 1fr 0 !important; margin: 0 !important;
      }
      .shell--dh .session-tabs { display: none !important; }
      .shell--dh .content-header { display: none !important; }
      /* DH タブの外側余白/背景も設計稿(§4.2)に合わせて詰める */
      .shell--dh > .content { padding: 0 !important; gap: 0 !important; }
      .shell--dh .main-container { height: 100% !important; }

      /* ════════════════════════════════════════════════════════════════════
         Sprint D §4.4 視覚統一 — brand token(ai-meta §3.4 复刻・值精确一致)
         .shell--dh を作用域根に定義 → stage / 控制条(shadow 外 CSS)へ波及。
         ※品牌色変更時は ai-meta(tailwind)側と両方同期(方案 §7-10)。
         ════════════════════════════════════════════════════════════════════ */
      .shell--dh {
        --brand-pink: #F0759B;
        --brand-coral: #FF8A65;
        --brand-lav: #8B78D6;
        --grad-warm: linear-gradient(135deg, #FF8A65, #F0759B 55%, #8B78D6);
        --ink: #0F0B15;
        --ink-2: #171120;
        --ink-3: #20182E;
        --ink-line: #332741;
        --gold: #C9962E;
        --live: #7CFFC0;
        --tx: #F6F1FB;
        --tx-mut: #B7AAC9;
        --r: 14px;
      }

      /* ── stage(数字人区)= 暗底 + 顶部径向暖粉光晕(chat.html 対話面)──────── */
      .shell--dh .panel-dh { background: var(--ink) !important; border-right-color: var(--ink-line) !important; }
      .shell--dh .dh-panel {
        background:
          radial-gradient(75% 60% at 50% 26%, rgba(247, 168, 196, .22), transparent 70%),
          var(--ink) !important;
      }
      .shell--dh .dh-video-container {
        background: #06040a !important;
        box-shadow: inset 0 0 0 1px var(--ink-line) !important;
      }
      .shell--dh .dh-start-hint {
        background: var(--ink-3) !important; border-color: var(--ink-line) !important; color: var(--tx-mut) !important;
      }
      .shell--dh .dh-placeholder:hover .dh-start-hint { color: var(--brand-pink) !important; border-color: var(--brand-pink) !important; }
      /* 字幕を玻璃拟态浮层へ */
      .shell--dh .dh-subtitle {
        background: rgba(15, 11, 21, .66) !important;
        backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;
        border-top-color: var(--ink-line) !important;
      }
      .shell--dh .dh-subtitle-text { color: var(--tx) !important; }

      /* ── 悬浮控制条 = 玻璃拟态 pill(stage 底部中央、浮遊)───────────────── */
      .shell--dh .dh-panel { position: relative; }
      .shell--dh .dh-controls {
        position: absolute !important;
        left: 50%; bottom: 16px; transform: translateX(-50%);
        border-top: 0 !important;
        background: rgba(23, 17, 32, .62) !important;
        backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        border: 1px solid var(--ink-line) !important;
        border-radius: 999px !important;
        padding: 8px 12px !important;
        box-shadow: 0 12px 34px -14px rgba(0, 0, 0, .8);
        z-index: 25;
        transition: opacity .25s var(--ease-out, ease), transform .25s var(--ease-out, ease);
      }
      .shell--dh.controls-hidden .dh-controls {
        opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(12px);
      }
      /* pill 内ボタン = brand。既定は暗ガラスチップ、激活/primary は暖グラデ */
      .shell--dh .dh-btn {
        border-color: var(--ink-line) !important;
        background: rgba(32, 24, 46, .8) !important;
        color: var(--tx) !important;
      }
      .shell--dh .dh-btn:not(.active):not(.primary):not(.danger):hover {
        background: rgba(240, 117, 155, .14) !important; border-color: rgba(240, 117, 155, .45) !important;
      }
      .shell--dh .dh-btn.active {
        background: var(--grad-warm) !important; border-color: transparent !important; color: #1a0f12 !important;
      }
      .shell--dh .dh-btn.primary {
        background: var(--grad-warm) !important; border-color: transparent !important; color: #1a0f12 !important;
      }
      .shell--dh .dh-btn.primary:hover { filter: brightness(1.06); box-shadow: 0 8px 22px -8px rgba(240, 117, 155, .6) !important; }
      .shell--dh .dh-btn.danger {
        background: rgba(240, 117, 155, .16) !important; border-color: rgba(240, 117, 155, .45) !important; color: #FF9DBB !important;
      }
      .shell--dh .dh-thinking-badge { background: var(--grad-warm) !important; color: #1a0f12 !important; }

      /* ── 悬浮の切替コントロール(任务面板ボタン / 控制条把手)────────────── */
      .dh-float-btn {
        position: absolute; z-index: 30;
        display: inline-flex; align-items: center; justify-content: center;
        width: 38px; height: 38px; padding: 0; cursor: pointer;
        border-radius: 12px; border: 1px solid var(--ink-line);
        background: rgba(23, 17, 32, .7);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        color: var(--tx-mut);
        transition: color .15s, background .15s, border-color .15s, transform .15s;
      }
      .dh-float-btn:hover { color: var(--tx); border-color: rgba(240, 117, 155, .5); background: rgba(240, 117, 155, .14); }
      .dh-float-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(240, 117, 155, .35); }
      /* 任务面板切替: stage 右上(全屏フルスクリーンボタンの左隣) */
      .dh-task-toggle { top: 10px; right: 44px; }
      .shell--dh.task-open .dh-task-toggle { color: #1a0f12; background: var(--grad-warm); border-color: transparent; }
      /* 控制条把手: stage 右下(控制条隠し時に再表示する) */
      .dh-controls-handle { right: 12px; bottom: 16px; width: 34px; height: 34px; }
      .shell--dh:not(.controls-hidden) .dh-controls-handle .chev-ic { transform: rotate(180deg); }
      .dh-controls-handle .chev-ic { transition: transform .2s; display: inline-flex; }

      /* ── 沉浸(全屏)モード: 語音「全屏显示数字人」= stage を全画面化し、秘书面板/
         控制条/悬浮ボタンを隠す(browser fullscreen は gesture 必須のため CSS で代替)── */
      .shell--dh.dh-immersive .panel-secretary {
        flex: 0 0 0 !important; max-width: 0 !important; min-width: 0 !important;
        opacity: 0 !important; pointer-events: none !important;
      }
      .shell--dh.dh-immersive .dh-controls,
      .shell--dh.dh-immersive .dh-float-btn,
      .shell--dh.dh-immersive .panel-fullscreen-btn {
        opacity: 0 !important; pointer-events: none !important;
      }
      @media (max-width: 1023px) {
        .shell--dh.dh-immersive .panel-secretary { transform: translateY(102%) !important; }
      }

      /* ════════════════════════════════════════════════════════════════════
         §4.5 PC(≥1024): 左 stage + 右サイドバー面板。既定は隠す、.task-open で滑入
         ════════════════════════════════════════════════════════════════════ */
      .shell--dh .layout-split .panel-dh { flex: 1 1 auto !important; }
      .shell--dh .panel-secretary {
        border-left: 1px solid var(--ink-line);
      }
      @media (min-width: 1024px) {
        .shell--dh .layout-split .panel-secretary {
          flex: 0 0 0 !important; max-width: 0 !important; min-width: 0 !important;
          opacity: 0; pointer-events: none;
          transition: flex .3s var(--ease-out, ease), max-width .3s var(--ease-out, ease), opacity .2s ease;
        }
        /* 黄金分割: 视频区 61.8% / 任务面板 38.2%(ユーザ要望 2026-07-05)。
           panel-dh は flex:1 1 auto なので、面板を 38.2% 固定にすれば動画は残り 61.8%。 */
        .shell--dh.task-open .layout-split .panel-secretary {
          flex: 0 0 38.2% !important;
          max-width: 38.2% !important; min-width: 360px !important;
          opacity: 1; pointer-events: auto;
        }
      }

      /* ════════════════════════════════════════════════════════════════════
         §4.5 手机(<1024): 全屏 stage + 底部 sheet 面板(既定隠し / .task-open 弾出)
         + 控制条 safe-area 避け。orientation クラスに依らず幅で分岐。
         ════════════════════════════════════════════════════════════════════ */
      @media (max-width: 1023px) {
        /* stage を全屏に(上下均分を廃し、面板はオーバーレイ sheet 化)*/
        .shell--dh .main-container { position: relative; }
        .shell--dh .panel-dh {
          flex: 1 1 auto !important; min-height: 0 !important; border: 0 !important;
        }
        /* 面板 = 底部 sheet(既定は画面外へ)*/
        .shell--dh .panel-secretary {
          position: absolute !important; left: 0; right: 0; bottom: 0;
          height: min(82vh, 640px) !important; max-width: none !important;
          flex: none !important; z-index: 45;
          border-left: 0; border-top: 1px solid var(--ink-line);
          border-radius: 18px 18px 0 0;
          background: var(--ink-2);
          box-shadow: 0 -18px 44px -18px rgba(0, 0, 0, .8);
          transform: translateY(102%);
          transition: transform .32s var(--ease-out, cubic-bezier(.22,.61,.36,1));
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .shell--dh.task-open .panel-secretary { transform: translateY(0); }
        /* sheet ハンドル(上部つまみ)*/
        .shell--dh .panel-secretary::before {
          content: ""; position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
          width: 40px; height: 4px; border-radius: 999px; background: var(--ink-line); z-index: 2;
        }
        /* sheet 背後の暗幕(タップで閉じる)*/
        .dh-sheet-backdrop {
          position: absolute; inset: 0; z-index: 44; background: rgba(6, 4, 10, .5);
          opacity: 0; pointer-events: none; transition: opacity .28s ease;
        }
        .shell--dh.task-open .dh-sheet-backdrop { opacity: 1; pointer-events: auto; }
        /* 控制条は下部・safe-area 回避 */
        .shell--dh .dh-controls {
          bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
          max-width: calc(100vw - 24px); flex-wrap: wrap; justify-content: center;
        }
        .dh-controls-handle { bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
        /* 任务ボタンは手机でも右上 */
        .dh-task-toggle { top: calc(10px + env(safe-area-inset-top, 0px)); }
      }
      @media (min-width: 1024px) {
        .dh-sheet-backdrop { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .shell--dh .panel-secretary, .shell--dh .dh-controls { transition: none !important; }
      }
    </style>
    <div class="shell shell--chat shell--v3 shell--secretary">

      <div class=${t} role="main">
        <!-- ── Left / top: Digital Human panel ───────────────────────────── -->
        <section
          class="panel-dh"
          aria-label=${_("dh.panelLabel")}
          @dblclick=${n=>{n.target.closest("video")||zc(".panel-dh")}}
        >
          ${My()}

          <!-- §4.1 任务管理 切替(悬浮・右上)。ボタン + ui_action(task_panel) 双通道 -->
          <button
            class="dh-float-btn dh-task-toggle"
            @click=${()=>Uc()}
            title=${_("chat.panelLabel")}
            aria-label=${_("chat.panelLabel")}
          >
            ${Ly()}
          </button>

          ${yh(e.dhPanel)}

          <!-- §4.2 控制条 表示/隐藏 把手(悬浮・右下)。ボタン + ui_action(controls) 双通道 -->
          <button
            class="dh-float-btn dh-controls-handle"
            @click=${()=>Hc()}
            title=${_("dh.controlsLabel")}
            aria-label=${_("dh.controlsLabel")}
          >
            <span class="chev-ic">${Iy()}</span>
          </button>
        </section>

        <!-- 手机 sheet 背後の暗幕(タップで閉じる) -->
        <div class="dh-sheet-backdrop" @click=${()=>Wi(!1)} aria-hidden="true"></div>

        <!-- ── Right / bottom: 秘书面板(docs/10 §4.2 右区 3 段) ──────────── -->
        <section class="panel-chat panel-secretary" aria-label=${_("chat.panelLabel")}>
          <secretary-panel
            .aimetaToken=${e.aimetaToken??null}
            .aimetaApi=${e.aimetaApi??null}
            .subtitle=${e.dhPanel.currentSubtitle??null}
          ></secretary-panel>
        </section>
      </div>

      <!-- Status bar is rendered by the host component (renderStatusBar) -->
    </div>
  `}function Py(e={}){const t=rd(),n=od(),s=e.ariaLabel??"Language",i=["lang-select",e.className].filter(Boolean).join(" ");function a(o){const c=o.target.value;Xr(c)}return r`
    <div class="lang-select-wrapper" title=${s}>
      <span class="lang-select-globe" aria-hidden="true">
        <!-- Globe icon inline -->
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          stroke="currentColor"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path
            d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10
               15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
          />
        </svg>
      </span>
      <select
        class=${i}
        aria-label=${s}
        .value=${n}
        @change=${a}
      >
        ${t.map(o=>r`
            <option
              value=${o}
              ?selected=${o===n}
            >
              ${ld[o]}
            </option>
          `)}
      </select>
    </div>
  `}const Dy=["","off","minimal","low","medium","high","xhigh"],Fy=["","off","on"],Ny=[{value:"",label:"inherit"},{value:"off",label:"off (explicit)"},{value:"on",label:"on"},{value:"full",label:"full"}],Oy=["","off","on","stream"];function By(e){if(!e)return"";const t=e.trim().toLowerCase();return t==="z.ai"||t==="z-ai"?"zai":t}function jc(e){return By(e)==="zai"}function Uy(e){return jc(e)?Fy:Dy}function jr(e,t){return t?e.includes(t)?[...e]:[...e,t]:[...e]}function Hy(e,t){return t?e.some(n=>n.value===t)?[...e]:[...e,{value:t,label:`${t} (custom)`}]:[...e]}function zy(e,t){return!t||!e||e==="off"?e:"on"}function jy(e,t){return e?t&&e==="on"?"low":e:null}function Ky(e){const t=e.result?.sessions??[];return r`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Sessions</div>
          <div class="card-sub">Active session keys and per-session overrides.</div>
        </div>
        <button class="btn" ?disabled=${e.loading} @click=${e.onRefresh}>
          ${e.loading?"Loading…":"Refresh"}
        </button>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field">
          <span>Active within (minutes)</span>
          <input
            .value=${e.activeMinutes}
            @input=${n=>e.onFiltersChange({activeMinutes:n.target.value,limit:e.limit,includeGlobal:e.includeGlobal,includeUnknown:e.includeUnknown})}
          />
        </label>
        <label class="field">
          <span>Limit</span>
          <input
            .value=${e.limit}
            @input=${n=>e.onFiltersChange({activeMinutes:e.activeMinutes,limit:n.target.value,includeGlobal:e.includeGlobal,includeUnknown:e.includeUnknown})}
          />
        </label>
        <label class="field checkbox">
          <span>Include global</span>
          <input
            type="checkbox"
            .checked=${e.includeGlobal}
            @change=${n=>e.onFiltersChange({activeMinutes:e.activeMinutes,limit:e.limit,includeGlobal:n.target.checked,includeUnknown:e.includeUnknown})}
          />
        </label>
        <label class="field checkbox">
          <span>Include unknown</span>
          <input
            type="checkbox"
            .checked=${e.includeUnknown}
            @change=${n=>e.onFiltersChange({activeMinutes:e.activeMinutes,limit:e.limit,includeGlobal:e.includeGlobal,includeUnknown:n.target.checked})}
          />
        </label>
      </div>

      ${e.error?r`<div class="callout danger" style="margin-top: 12px;">${e.error}</div>`:v}

      <div class="muted" style="margin-top: 12px;">
        ${e.result?`Store: ${e.result.path}`:""}
      </div>

      <div class="table" style="margin-top: 16px;">
        <div class="table-head">
          <div>Key</div>
          <div>Label</div>
          <div>Kind</div>
          <div>Updated</div>
          <div>Tokens</div>
          <div>Thinking</div>
          <div>Verbose</div>
          <div>Reasoning</div>
          <div>Actions</div>
        </div>
        ${t.length===0?r`
                <div class="muted">No sessions found.</div>
              `:t.map(n=>Vy(n,e.basePath,e.onPatch,e.onDelete,e.loading))}
      </div>
    </section>
  `}function Vy(e,t,n,s,i){const a=e.updatedAt?Y(e.updatedAt):"n/a",o=e.thinkingLevel??"",l=jc(e.modelProvider),c=zy(o,l),p=jr(Uy(e.modelProvider),c),g=e.verboseLevel??"",u=Hy(Ny,g),h=e.reasoningLevel??"",f=jr(Oy,h),d=typeof e.displayName=="string"&&e.displayName.trim().length>0?e.displayName.trim():null,m=typeof e.label=="string"?e.label.trim():"",k=!!(d&&d!==e.key&&d!==m),S=e.kind!=="global",$=S?`${ya("chat",t)}?session=${encodeURIComponent(e.key)}`:null;return r`
    <div class="table-row">
      <div class="mono session-key-cell">
        ${S?r`<a href=${$} class="session-link">${e.key}</a>`:e.key}
        ${k?r`<span class="muted session-key-display-name">${d}</span>`:v}
      </div>
      <div>
        <input
          .value=${e.label??""}
          ?disabled=${i}
          placeholder="(optional)"
          @change=${C=>{const A=C.target.value.trim();n(e.key,{label:A||null})}}
        />
      </div>
      <div>${e.kind}</div>
      <div>${a}</div>
      <div>${Ih(e)}</div>
      <div>
        <select
          ?disabled=${i}
          @change=${C=>{const A=C.target.value;n(e.key,{thinkingLevel:jy(A,l)})}}
        >
          ${p.map(C=>r`<option value=${C} ?selected=${c===C}>
                ${C||"inherit"}
              </option>`)}
        </select>
      </div>
      <div>
        <select
          ?disabled=${i}
          @change=${C=>{const A=C.target.value;n(e.key,{verboseLevel:A||null})}}
        >
          ${u.map(C=>r`<option value=${C.value} ?selected=${g===C.value}>
                ${C.label}
              </option>`)}
        </select>
      </div>
      <div>
        <select
          ?disabled=${i}
          @change=${C=>{const A=C.target.value;n(e.key,{reasoningLevel:A||null})}}
        >
          ${f.map(C=>r`<option value=${C} ?selected=${h===C}>
                ${C||"inherit"}
              </option>`)}
        </select>
      </div>
      <div>
        <button class="btn danger" ?disabled=${i} @click=${()=>s(e.key)}>
          Delete
        </button>
      </div>
    </div>
  `}const Un=[{id:"workspace",label:"Workspace Skills",sources:["winclaw-workspace"]},{id:"built-in",label:"Built-in Skills",sources:["winclaw-bundled"]},{id:"installed",label:"Installed Skills",sources:["winclaw-managed"]},{id:"extra",label:"Extra Skills",sources:["winclaw-extra"]}];function Wy(e){const t=new Map;for(const a of Un)t.set(a.id,{id:a.id,label:a.label,skills:[]});const n=Un.find(a=>a.id==="built-in"),s={id:"other",label:"Other Skills",skills:[]};for(const a of e){const o=a.bundled?n:Un.find(l=>l.sources.includes(a.source));o?t.get(o.id)?.skills.push(a):s.skills.push(a)}const i=Un.map(a=>t.get(a.id)).filter(a=>!!(a&&a.skills.length>0));return s.skills.length>0&&i.push(s),i}function qy(e){const t=e.report?.skills??[],n=e.filter.trim().toLowerCase(),s=n?t.filter(a=>[a.name,a.description,a.source].join(" ").toLowerCase().includes(n)):t,i=Wy(s);return r`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Skills</div>
          <div class="card-sub">Bundled, managed, and workspace skills.</div>
        </div>
        <button class="btn" ?disabled=${e.loading} @click=${e.onRefresh}>
          ${e.loading?"Loading…":"Refresh"}
        </button>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="flex: 1;">
          <span>Filter</span>
          <input
            .value=${e.filter}
            @input=${a=>e.onFilterChange(a.target.value)}
            placeholder="Search skills"
          />
        </label>
        <div class="muted">${s.length} shown</div>
      </div>

      ${e.error?r`<div class="callout danger" style="margin-top: 12px;">${e.error}</div>`:v}

      ${s.length===0?r`
              <div class="muted" style="margin-top: 16px">No skills found.</div>
            `:r`
            <div class="agent-skills-groups" style="margin-top: 16px;">
              ${i.map(a=>{const o=a.id==="workspace"||a.id==="built-in";return r`
                  <details class="agent-skills-group" ?open=${!o}>
                    <summary class="agent-skills-header">
                      <span>${a.label}</span>
                      <span class="muted">${a.skills.length}</span>
                    </summary>
                    <div class="list skills-grid">
                      ${a.skills.map(l=>Gy(l,e))}
                    </div>
                  </details>
                `})}
            </div>
          `}
    </section>
  `}function Gy(e,t){const n=t.busyKey===e.skillKey,s=t.edits[e.skillKey]??"",i=t.messages[e.skillKey]??null,a=e.install.length>0&&e.missing.bins.length>0,o=!!(e.bundled&&e.source!=="winclaw-bundled"),l=[...e.missing.bins.map(p=>`bin:${p}`),...e.missing.env.map(p=>`env:${p}`),...e.missing.config.map(p=>`config:${p}`),...e.missing.os.map(p=>`os:${p}`)],c=[];return e.disabled&&c.push("disabled"),e.blockedByAllowlist&&c.push("blocked by allowlist"),r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">
          ${e.emoji?`${e.emoji} `:""}${e.name}
        </div>
        <div class="list-sub">${wi(e.description,140)}</div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${e.source}</span>
          ${o?r`
                  <span class="chip">bundled</span>
                `:v}
          <span class="chip ${e.eligible?"chip-ok":"chip-warn"}">
            ${e.eligible?"eligible":"blocked"}
          </span>
          ${e.disabled?r`
                  <span class="chip chip-warn">disabled</span>
                `:v}
        </div>
        ${l.length>0?r`
              <div class="muted" style="margin-top: 6px;">
                Missing: ${l.join(", ")}
              </div>
            `:v}
        ${c.length>0?r`
              <div class="muted" style="margin-top: 6px;">
                Reason: ${c.join(", ")}
              </div>
            `:v}
      </div>
      <div class="list-meta">
        <div class="row" style="justify-content: flex-end; flex-wrap: wrap;">
          <button
            class="btn"
            ?disabled=${n}
            @click=${()=>t.onToggle(e.skillKey,e.disabled)}
          >
            ${e.disabled?"Enable":"Disable"}
          </button>
          ${a?r`<button
                class="btn"
                ?disabled=${n}
                @click=${()=>t.onInstall(e.skillKey,e.name,e.install[0].id)}
              >
                ${n?"Installing…":e.install[0].label}
              </button>`:v}
        </div>
        ${i?r`<div
              class="muted"
              style="margin-top: 8px; color: ${i.kind==="error"?"var(--danger-color, #d14343)":"var(--success-color, #0a7f5a)"};"
            >
              ${i.message}
            </div>`:v}
        ${e.primaryEnv?r`
              <div class="field" style="margin-top: 10px;">
                <span>API key</span>
                <input
                  type="password"
                  .value=${s}
                  @input=${p=>t.onEdit(e.skillKey,p.target.value)}
                />
              </div>
              <button
                class="btn primary"
                style="margin-top: 8px;"
                ?disabled=${n}
                @click=${()=>t.onSaveKey(e.skillKey)}
              >
                Save key
              </button>
            `:v}
      </div>
    </div>
  `}const Qy=new Set(["agent","channel","chat","provider","model","tool","label","key","session","id","has","mintokens","maxtokens","mincost","maxcost","minmessages","maxmessages"]),ls=e=>e.trim().toLowerCase(),Yy=e=>{const t=e.replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*").replace(/\?/g,".");return new RegExp(`^${t}$`,"i")},vt=e=>{let t=e.trim().toLowerCase();if(!t)return null;t.startsWith("$")&&(t=t.slice(1));let n=1;t.endsWith("k")?(n=1e3,t=t.slice(0,-1)):t.endsWith("m")&&(n=1e6,t=t.slice(0,-1));const s=Number(t);return Number.isFinite(s)?s*n:null},Ha=e=>(e.match(/"[^"]+"|\S+/g)??[]).map(n=>{const s=n.replace(/^"|"$/g,""),i=s.indexOf(":");if(i>0){const a=s.slice(0,i),o=s.slice(i+1);return{key:a,value:o,raw:s}}return{value:s,raw:s}}),Jy=e=>[e.label,e.key,e.sessionId].filter(n=>!!n).map(n=>n.toLowerCase()),Kr=e=>{const t=new Set;e.modelProvider&&t.add(e.modelProvider.toLowerCase()),e.providerOverride&&t.add(e.providerOverride.toLowerCase()),e.origin?.provider&&t.add(e.origin.provider.toLowerCase());for(const n of e.usage?.modelUsage??[])n.provider&&t.add(n.provider.toLowerCase());return Array.from(t)},Vr=e=>{const t=new Set;e.model&&t.add(e.model.toLowerCase());for(const n of e.usage?.modelUsage??[])n.model&&t.add(n.model.toLowerCase());return Array.from(t)},Zy=e=>(e.usage?.toolUsage?.tools??[]).map(t=>t.name.toLowerCase()),Xy=(e,t)=>{const n=ls(t.value??"");if(!n)return!0;if(!t.key)return Jy(e).some(i=>i.includes(n));switch(ls(t.key)){case"agent":return e.agentId?.toLowerCase().includes(n)??!1;case"channel":return e.channel?.toLowerCase().includes(n)??!1;case"chat":return e.chatType?.toLowerCase().includes(n)??!1;case"provider":return Kr(e).some(i=>i.includes(n));case"model":return Vr(e).some(i=>i.includes(n));case"tool":return Zy(e).some(i=>i.includes(n));case"label":return e.label?.toLowerCase().includes(n)??!1;case"key":case"session":case"id":if(n.includes("*")||n.includes("?")){const i=Yy(n);return i.test(e.key)||(e.sessionId?i.test(e.sessionId):!1)}return e.key.toLowerCase().includes(n)||(e.sessionId?.toLowerCase().includes(n)??!1);case"has":switch(n){case"tools":return(e.usage?.toolUsage?.totalCalls??0)>0;case"errors":return(e.usage?.messageCounts?.errors??0)>0;case"context":return!!e.contextWeight;case"usage":return!!e.usage;case"model":return Vr(e).length>0;case"provider":return Kr(e).length>0;default:return!0}case"mintokens":{const i=vt(n);return i===null?!0:(e.usage?.totalTokens??0)>=i}case"maxtokens":{const i=vt(n);return i===null?!0:(e.usage?.totalTokens??0)<=i}case"mincost":{const i=vt(n);return i===null?!0:(e.usage?.totalCost??0)>=i}case"maxcost":{const i=vt(n);return i===null?!0:(e.usage?.totalCost??0)<=i}case"minmessages":{const i=vt(n);return i===null?!0:(e.usage?.messageCounts?.total??0)>=i}case"maxmessages":{const i=vt(n);return i===null?!0:(e.usage?.messageCounts?.total??0)<=i}default:return!0}},e0=(e,t)=>{const n=Ha(t);if(n.length===0)return{sessions:e,warnings:[]};const s=[];for(const a of n){if(!a.key)continue;const o=ls(a.key);if(!Qy.has(o)){s.push(`Unknown filter: ${a.key}`);continue}if(a.value===""&&s.push(`Missing value for ${a.key}`),o==="has"){const l=new Set(["tools","errors","context","usage","model","provider"]);a.value&&!l.has(ls(a.value))&&s.push(`Unknown has:${a.value}`)}["mintokens","maxtokens","mincost","maxcost","minmessages","maxmessages"].includes(o)&&a.value&&vt(a.value)===null&&s.push(`Invalid number for ${a.key}`)}return{sessions:e.filter(a=>n.every(o=>Xy(a,o))),warnings:s}};function t0(e){const t=e.split(`
`),n=new Map,s=[];for(const l of t){const c=/^\[Tool:\s*([^\]]+)\]/.exec(l.trim());if(c){const p=c[1];n.set(p,(n.get(p)??0)+1);continue}l.trim().startsWith("[Tool Result]")||s.push(l)}const i=Array.from(n.entries()).toSorted((l,c)=>c[1]-l[1]),a=i.reduce((l,[,c])=>l+c,0),o=i.length>0?`Tools: ${i.map(([l,c])=>`${l}×${c}`).join(", ")} (${a} calls)`:"";return{tools:i,summary:o,cleanContent:s.join(`
`).trim()}}const n0=`
  .usage-page-header {
    margin: 4px 0 12px;
  }
  .usage-page-title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .usage-page-subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 12px;
  }
  /* ===== FILTERS & HEADER ===== */
  .usage-filters-inline {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .usage-filters-inline select {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
  }
  .usage-filters-inline input[type="date"] {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
  }
  .usage-filters-inline input[type="text"] {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    min-width: 180px;
  }
  .usage-filters-inline .btn-sm {
    padding: 6px 12px;
    font-size: 14px;
  }
  .usage-refresh-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(255, 77, 77, 0.1);
    border-radius: 4px;
    font-size: 12px;
    color: #ff4d4d;
  }
  .usage-refresh-indicator::before {
    content: "";
    width: 10px;
    height: 10px;
    border: 2px solid #ff4d4d;
    border-top-color: transparent;
    border-radius: 50%;
    animation: usage-spin 0.6s linear infinite;
  }
  @keyframes usage-spin {
    to { transform: rotate(360deg); }
  }
  .active-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 12px;
    background: var(--accent-subtle);
    border: 1px solid var(--accent);
    border-radius: 16px;
    font-size: 12px;
  }
  .filter-chip-label {
    color: var(--accent);
    font-weight: 500;
  }
  .filter-chip-remove {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.15s;
  }
  .filter-chip-remove:hover {
    opacity: 1;
  }
  .filter-clear-btn {
    padding: 4px 10px !important;
    font-size: 12px !important;
    line-height: 1 !important;
    margin-left: 8px;
  }
  .usage-query-bar {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    gap: 10px;
    align-items: center;
    /* Keep the dropdown filter row from visually touching the query row. */
    margin-bottom: 10px;
  }
  .usage-query-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
    justify-self: end;
  }
  .usage-query-actions .btn {
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 13px;
    line-height: 1;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text);
    box-shadow: none;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .usage-query-actions .btn:hover {
    background: var(--bg);
    border-color: var(--border-strong);
  }
  .usage-action-btn {
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 13px;
    line-height: 1;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text);
    box-shadow: none;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .usage-action-btn:hover {
    background: var(--bg);
    border-color: var(--border-strong);
  }
  .usage-primary-btn {
    background: #ff4d4d;
    color: #fff;
    border-color: #ff4d4d;
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.12);
  }
  .btn.usage-primary-btn {
    background: #ff4d4d !important;
    border-color: #ff4d4d !important;
    color: #fff !important;
  }
  .usage-primary-btn:hover {
    background: #e64545;
    border-color: #e64545;
  }
  .btn.usage-primary-btn:hover {
    background: #e64545 !important;
    border-color: #e64545 !important;
  }
  .usage-primary-btn:disabled {
    background: rgba(255, 77, 77, 0.18);
    border-color: rgba(255, 77, 77, 0.3);
    color: #ff4d4d;
    box-shadow: none;
    cursor: default;
    opacity: 1;
  }
  .usage-primary-btn[disabled] {
    background: rgba(255, 77, 77, 0.18) !important;
    border-color: rgba(255, 77, 77, 0.3) !important;
    color: #ff4d4d !important;
    opacity: 1 !important;
  }
  .usage-secondary-btn {
    background: var(--bg-secondary);
    color: var(--text);
    border-color: var(--border);
  }
  .usage-query-input {
    width: 100%;
    min-width: 220px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
  }
  .usage-query-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .usage-query-suggestion {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 11px;
    color: var(--text);
    cursor: pointer;
    transition: background 0.15s;
  }
  .usage-query-suggestion:hover {
    background: var(--bg-hover);
  }
  .usage-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 14px;
  }
  details.usage-filter-select {
    position: relative;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 6px 10px;
    background: var(--bg);
    font-size: 12px;
    min-width: 140px;
  }
  details.usage-filter-select summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    font-weight: 500;
  }
  details.usage-filter-select summary::-webkit-details-marker {
    display: none;
  }
  .usage-filter-badge {
    font-size: 11px;
    color: var(--text-muted);
  }
  .usage-filter-popover {
    position: absolute;
    left: 0;
    top: calc(100% + 6px);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    min-width: 220px;
    z-index: 20;
  }
  .usage-filter-actions {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .usage-filter-actions button {
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
  }
  .usage-filter-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow: auto;
  }
  .usage-filter-option {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .usage-query-hint {
    font-size: 11px;
    color: var(--text-muted);
  }
  .usage-query-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .usage-query-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 11px;
  }
  .usage-query-chip button {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .usage-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--bg);
  }
  .usage-header.pinned {
    position: sticky;
    top: 12px;
    z-index: 6;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  }
  .usage-pin-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 11px;
    color: var(--text);
    cursor: pointer;
  }
  .usage-pin-btn.active {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
  }
  .usage-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .usage-header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .usage-header-metrics {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .usage-metric-badge {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: transparent;
    font-size: 11px;
    color: var(--text-muted);
  }
  .usage-metric-badge strong {
    font-size: 12px;
    color: var(--text);
  }
  .usage-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .usage-controls .active-filters {
    flex: 1 1 100%;
  }
  .usage-controls input[type="date"] {
    min-width: 140px;
  }
  .usage-presets {
    display: inline-flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .usage-presets .btn {
    padding: 4px 8px;
    font-size: 11px;
  }
  .usage-quick-filters {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .usage-select {
    min-width: 120px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
  }
  .usage-export-menu summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--text);
    list-style: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .usage-export-menu summary::-webkit-details-marker {
    display: none;
  }
  .usage-export-menu {
    position: relative;
  }
  .usage-export-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    font-size: 12px;
  }
  .usage-export-popover {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    min-width: 160px;
    z-index: 10;
  }
  .usage-export-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .usage-export-item {
    text-align: left;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 12px;
  }
  .usage-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .usage-summary-card {
    padding: 12px;
    border-radius: 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
  }
  .usage-mosaic {
    margin-top: 16px;
    padding: 16px;
  }
  .usage-mosaic-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .usage-mosaic-title {
    font-weight: 600;
  }
  .usage-mosaic-sub {
    font-size: 12px;
    color: var(--text-muted);
  }
  .usage-mosaic-grid {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) minmax(260px, 2fr);
    gap: 16px;
    align-items: start;
  }
  .usage-mosaic-section {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
  }
  .usage-mosaic-section-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .usage-mosaic-total {
    font-size: 20px;
    font-weight: 700;
  }
  .usage-daypart-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: 8px;
  }
  .usage-daypart-cell {
    border-radius: 8px;
    padding: 10px;
    color: var(--text);
    background: rgba(255, 77, 77, 0.08);
    border: 1px solid rgba(255, 77, 77, 0.2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .usage-daypart-label {
    font-size: 12px;
    font-weight: 600;
  }
  .usage-daypart-value {
    font-size: 14px;
  }
  .usage-hour-grid {
    display: grid;
    grid-template-columns: repeat(24, minmax(6px, 1fr));
    gap: 4px;
  }
  .usage-hour-cell {
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 77, 77, 0.1);
    border: 1px solid rgba(255, 77, 77, 0.2);
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .usage-hour-cell.selected {
    border-color: rgba(255, 77, 77, 0.8);
    box-shadow: 0 0 0 2px rgba(255, 77, 77, 0.2);
  }
  .usage-hour-labels {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
    margin-top: 8px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .usage-hour-legend {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .usage-hour-legend span {
    display: inline-block;
    width: 14px;
    height: 10px;
    border-radius: 4px;
    background: rgba(255, 77, 77, 0.15);
    border: 1px solid rgba(255, 77, 77, 0.2);
  }
  .usage-calendar-labels {
    display: grid;
    grid-template-columns: repeat(7, minmax(10px, 1fr));
    gap: 6px;
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .usage-calendar {
    display: grid;
    grid-template-columns: repeat(7, minmax(10px, 1fr));
    gap: 6px;
  }
  .usage-calendar-cell {
    height: 18px;
    border-radius: 4px;
    border: 1px solid rgba(255, 77, 77, 0.2);
    background: rgba(255, 77, 77, 0.08);
  }
  .usage-calendar-cell.empty {
    background: transparent;
    border-color: transparent;
  }
  .usage-summary-title {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 6px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .usage-info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 6px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg);
    font-size: 10px;
    color: var(--text-muted);
    cursor: help;
  }
  .usage-summary-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-strong);
  }
  .usage-summary-value.good {
    color: #1f8f4e;
  }
  .usage-summary-value.warn {
    color: #c57a00;
  }
  .usage-summary-value.bad {
    color: #c9372c;
  }
  .usage-summary-hint {
    font-size: 10px;
    color: var(--text-muted);
    cursor: help;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0 6px;
    line-height: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .usage-summary-sub {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .usage-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .usage-list-item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: var(--text);
    align-items: flex-start;
  }
  .usage-list-value {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    text-align: right;
  }
  .usage-list-sub {
    font-size: 11px;
    color: var(--text-muted);
  }
  .usage-list-item.button {
    border: none;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .usage-list-item.button:hover {
    color: var(--text-strong);
  }
  .usage-list-item .muted {
    font-size: 11px;
  }
  .usage-error-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .usage-error-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
  .usage-error-date {
    font-weight: 600;
  }
  .usage-error-rate {
    font-variant-numeric: tabular-nums;
  }
  .usage-error-sub {
    grid-column: 1 / -1;
    font-size: 11px;
    color: var(--text-muted);
  }
  .usage-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .usage-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 11px;
    background: var(--bg);
    color: var(--text);
  }
  .usage-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
  .usage-meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }
  .usage-meta-item span {
    color: var(--text-muted);
    font-size: 11px;
  }
  .usage-insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-top: 12px;
  }
  .usage-insight-card {
    padding: 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
  }
  .usage-insight-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 10px;
  }
  .usage-insight-subtitle {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 6px;
  }
  /* ===== CHART TOGGLE ===== */
  .chart-toggle {
    display: flex;
    background: var(--bg);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .chart-toggle .toggle-btn {
    padding: 6px 14px;
    font-size: 13px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .chart-toggle .toggle-btn:hover {
    color: var(--text);
  }
  .chart-toggle .toggle-btn.active {
    background: #ff4d4d;
    color: white;
  }
  .chart-toggle.small .toggle-btn {
    padding: 4px 8px;
    font-size: 11px;
  }
  .sessions-toggle {
    border-radius: 4px;
  }
  .sessions-toggle .toggle-btn {
    border-radius: 4px;
  }
  .daily-chart-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    margin-bottom: 6px;
  }

  /* ===== DAILY BAR CHART ===== */
  .daily-chart {
    margin-top: 12px;
  }
  .daily-chart-bars {
    display: flex;
    align-items: flex-end;
    height: 200px;
    gap: 4px;
    padding: 8px 4px 36px;
  }
  .daily-bar-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
    cursor: pointer;
    position: relative;
    border-radius: 4px 4px 0 0;
    transition: background 0.15s;
    min-width: 0;
  }
  .daily-bar-wrapper:hover {
    background: var(--bg-hover);
  }
  .daily-bar-wrapper.selected {
    background: var(--accent-subtle);
  }
  .daily-bar-wrapper.selected .daily-bar {
    background: var(--accent);
  }
  .daily-bar {
    width: 100%;
    max-width: var(--bar-max-width, 32px);
    background: #ff4d4d;
    border-radius: 3px 3px 0 0;
    min-height: 2px;
    transition: all 0.15s;
    overflow: hidden;
  }
  .daily-bar-wrapper:hover .daily-bar {
    background: #cc3d3d;
  }
  .daily-bar-label {
    position: absolute;
    bottom: -28px;
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
    text-align: center;
    transform: rotate(-35deg);
    transform-origin: top center;
  }
  .daily-bar-total {
    position: absolute;
    top: -16px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .daily-bar-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .daily-bar-wrapper:hover .daily-bar-tooltip {
    opacity: 1;
  }

  /* ===== COST/TOKEN BREAKDOWN BAR ===== */
  .cost-breakdown {
    margin-top: 18px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }
  .cost-breakdown-header {
    font-weight: 600;
    font-size: 15px;
    letter-spacing: -0.02em;
    margin-bottom: 12px;
    color: var(--text-strong);
  }
  .cost-breakdown-bar {
    height: 28px;
    background: var(--bg);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
  }
  .cost-segment {
    height: 100%;
    transition: width 0.3s ease;
    position: relative;
  }
  .cost-segment.output {
    background: #ef4444;
  }
  .cost-segment.input {
    background: #f59e0b;
  }
  .cost-segment.cache-write {
    background: #10b981;
  }
  .cost-segment.cache-read {
    background: #06b6d4;
  }
  .cost-breakdown-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 12px;
  }
  .cost-breakdown-total {
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text);
    cursor: help;
  }
  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .legend-dot.output {
    background: #ef4444;
  }
  .legend-dot.input {
    background: #f59e0b;
  }
  .legend-dot.cache-write {
    background: #10b981;
  }
  .legend-dot.cache-read {
    background: #06b6d4;
  }
  .legend-dot.system {
    background: #ff4d4d;
  }
  .legend-dot.skills {
    background: #8b5cf6;
  }
  .legend-dot.tools {
    background: #ec4899;
  }
  .legend-dot.files {
    background: #f59e0b;
  }
  .cost-breakdown-note {
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* ===== SESSION BARS (scrollable list) ===== */
  .session-bars {
    margin-top: 16px;
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
  }
  .session-bar-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.15s;
  }
  .session-bar-row:last-child {
    border-bottom: none;
  }
  .session-bar-row:hover {
    background: var(--bg-hover);
  }
  .session-bar-row.selected {
    background: var(--accent-subtle);
  }
  .session-bar-label {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 13px;
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .session-bar-title {
    /* Prefer showing the full name; wrap instead of truncating. */
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .session-bar-meta {
    font-size: 10px;
    color: var(--text-muted);
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .session-bar-track {
    flex: 0 0 90px;
    height: 6px;
    background: var(--bg-secondary);
    border-radius: 4px;
    overflow: hidden;
    opacity: 0.6;
  }
  .session-bar-fill {
    height: 100%;
    background: rgba(255, 77, 77, 0.7);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .session-bar-value {
    flex: 0 0 70px;
    text-align: right;
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }
  .session-bar-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
  }
  .session-copy-btn {
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .session-copy-btn:hover {
    background: var(--bg);
    border-color: var(--border-strong);
    color: var(--text);
  }

  /* ===== TIME SERIES CHART ===== */
  .session-timeseries {
    margin-top: 24px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }
  .timeseries-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .timeseries-controls {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .timeseries-header {
    font-weight: 600;
    color: var(--text);
  }
  .timeseries-chart {
    width: 100%;
    overflow: hidden;
  }
  .timeseries-svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .timeseries-svg .axis-label {
    font-size: 10px;
    fill: var(--text-muted);
  }
  .timeseries-svg .ts-area {
    fill: #ff4d4d;
    fill-opacity: 0.1;
  }
  .timeseries-svg .ts-line {
    fill: none;
    stroke: #ff4d4d;
    stroke-width: 2;
  }
  .timeseries-svg .ts-dot {
    fill: #ff4d4d;
    transition: r 0.15s, fill 0.15s;
  }
  .timeseries-svg .ts-dot:hover {
    r: 5;
  }
  .timeseries-svg .ts-bar {
    fill: #ff4d4d;
    transition: fill 0.15s;
  }
  .timeseries-svg .ts-bar:hover {
    fill: #cc3d3d;
  }
  .timeseries-svg .ts-bar.output { fill: #ef4444; }
  .timeseries-svg .ts-bar.input { fill: #f59e0b; }
  .timeseries-svg .ts-bar.cache-write { fill: #10b981; }
  .timeseries-svg .ts-bar.cache-read { fill: #06b6d4; }
  .timeseries-summary {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .timeseries-loading {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
  }

  /* ===== SESSION LOGS ===== */
  .session-logs {
    margin-top: 24px;
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow: hidden;
  }
  .session-logs-header {
    padding: 10px 14px;
    font-weight: 600;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    background: var(--bg-secondary);
  }
  .session-logs-loading {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
  }
  .session-logs-list {
    max-height: 400px;
    overflow-y: auto;
  }
  .session-log-entry {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg);
  }
  .session-log-entry:last-child {
    border-bottom: none;
  }
  .session-log-entry.user {
    border-left: 3px solid var(--accent);
  }
  .session-log-entry.assistant {
    border-left: 3px solid var(--border-strong);
  }
  .session-log-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 11px;
    color: var(--text-muted);
    flex-wrap: wrap;
  }
  .session-log-role {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
  }
  .session-log-entry.user .session-log-role {
    color: var(--accent);
  }
  .session-log-entry.assistant .session-log-role {
    color: var(--text-muted);
  }
  .session-log-content {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    max-height: 220px;
    overflow-y: auto;
  }

  /* ===== CONTEXT WEIGHT BREAKDOWN ===== */
  .context-weight-breakdown {
    margin-top: 24px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }
  .context-weight-breakdown .context-weight-header {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 4px;
    color: var(--text);
  }
  .context-weight-desc {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 0 12px 0;
  }
  .context-stacked-bar {
    height: 24px;
    background: var(--bg);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
  }
  .context-segment {
    height: 100%;
    transition: width 0.3s ease;
  }
  .context-segment.system {
    background: #ff4d4d;
  }
  .context-segment.skills {
    background: #8b5cf6;
  }
  .context-segment.tools {
    background: #ec4899;
  }
  .context-segment.files {
    background: #f59e0b;
  }
  .context-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 12px;
  }
  .context-total {
    margin-top: 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .context-details {
    margin-top: 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .context-details summary {
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  .context-details[open] summary {
    border-bottom: 1px solid var(--border);
  }
  .context-list {
    max-height: 200px;
    overflow-y: auto;
  }
  .context-list-header {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }
  .context-list-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    font-size: 12px;
    border-bottom: 1px solid var(--border);
  }
  .context-list-item:last-child {
    border-bottom: none;
  }
  .context-list-item .mono {
    font-family: var(--font-mono);
    color: var(--text);
  }
  .context-list-item .muted {
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  /* ===== NO CONTEXT NOTE ===== */
  .no-context-note {
    margin-top: 24px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ===== TWO COLUMN LAYOUT ===== */
  .usage-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-top: 18px;
    align-items: stretch;
  }
  .usage-grid-left {
    display: flex;
    flex-direction: column;
  }
  .usage-grid-right {
    display: flex;
    flex-direction: column;
  }
  
  /* ===== LEFT CARD (Daily + Breakdown) ===== */
  .usage-left-card {
    /* inherits background, border, shadow from .card */
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .usage-left-card .daily-chart-bars {
    flex: 1;
    min-height: 200px;
  }
  .usage-left-card .sessions-panel-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 12px;
  }
  
  /* ===== COMPACT DAILY CHART ===== */
  .daily-chart-compact {
    margin-bottom: 16px;
  }
  .daily-chart-compact .sessions-panel-title {
    margin-bottom: 8px;
  }
  .daily-chart-compact .daily-chart-bars {
    height: 100px;
    padding-bottom: 20px;
  }
  
  /* ===== COMPACT COST BREAKDOWN ===== */
  .cost-breakdown-compact {
    padding: 0;
    margin: 0;
    background: transparent;
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }
  .cost-breakdown-compact .cost-breakdown-header {
    margin-bottom: 8px;
  }
  .cost-breakdown-compact .cost-breakdown-legend {
    gap: 12px;
  }
  .cost-breakdown-compact .cost-breakdown-note {
    display: none;
  }
  
  /* ===== SESSIONS CARD ===== */
  .sessions-card {
    /* inherits background, border, shadow from .card */
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .sessions-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .sessions-card-title {
    font-weight: 600;
    font-size: 14px;
  }
  .sessions-card-count {
    font-size: 12px;
    color: var(--text-muted);
  }
  .sessions-card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 0 10px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .sessions-card-stats {
    display: inline-flex;
    gap: 12px;
  }
  .sessions-sort {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .sessions-sort select {
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
  }
  .sessions-action-btn {
    height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1;
  }
  .sessions-action-btn.icon {
    width: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .sessions-card-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .sessions-card .session-bars {
    max-height: 280px;
    background: var(--bg);
    border-radius: 6px;
    border: 1px solid var(--border);
    margin: 0;
    overflow-y: auto;
    padding: 8px;
  }
  .sessions-card .session-bar-row {
    padding: 6px 8px;
    border-radius: 6px;
    margin-bottom: 3px;
    border: 1px solid transparent;
    transition: all 0.15s;
  }
  .sessions-card .session-bar-row:hover {
    border-color: var(--border);
    background: var(--bg-hover);
  }
  .sessions-card .session-bar-row.selected {
    border-color: var(--accent);
    background: var(--accent-subtle);
    box-shadow: inset 0 0 0 1px rgba(255, 77, 77, 0.15);
  }
  .sessions-card .session-bar-label {
    flex: 1 1 auto;
    min-width: 140px;
    font-size: 12px;
  }
  .sessions-card .session-bar-value {
    flex: 0 0 60px;
    font-size: 11px;
    font-weight: 600;
  }
  .sessions-card .session-bar-track {
    flex: 0 0 70px;
    height: 5px;
    opacity: 0.5;
  }
  .sessions-card .session-bar-fill {
    background: rgba(255, 77, 77, 0.55);
  }
  .sessions-clear-btn {
    margin-left: auto;
  }
  
  /* ===== EMPTY DETAIL STATE ===== */
  .session-detail-empty {
    margin-top: 18px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 2px dashed var(--border);
    padding: 32px;
    text-align: center;
  }
  .session-detail-empty-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 8px;
  }
  .session-detail-empty-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .session-detail-empty-features {
    display: flex;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
  }
  .session-detail-empty-feature {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .session-detail-empty-feature .icon {
    font-size: 16px;
  }
  
  /* ===== SESSION DETAIL PANEL ===== */
  .session-detail-panel {
    margin-top: 12px;
    /* inherits background, border-radius, shadow from .card */
    border: 2px solid var(--accent) !important;
  }
  .session-detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }
  .session-detail-header:hover {
    background: var(--bg-hover);
  }
  .session-detail-title {
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .session-detail-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .session-close-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    cursor: pointer;
    padding: 2px 8px;
    font-size: 16px;
    line-height: 1;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }
  .session-close-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
    border-color: var(--accent);
  }
  .session-detail-stats {
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .session-detail-stats strong {
    color: var(--text);
    font-family: var(--font-mono);
  }
  .session-detail-content {
    padding: 12px;
  }
  .session-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }
  .session-summary-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    background: var(--bg-secondary);
  }
  .session-summary-title {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .session-summary-value {
    font-size: 14px;
    font-weight: 600;
  }
  .session-summary-meta {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .session-detail-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    /* Separate "Usage Over Time" from the summary + Top Tools/Model Mix cards above. */
    margin-top: 12px;
    margin-bottom: 10px;
  }
  .session-detail-bottom {
    display: grid;
    grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
    gap: 10px;
    align-items: stretch;
  }
  .session-detail-bottom .session-logs-compact {
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  .session-detail-bottom .session-logs-compact .session-logs-list {
    flex: 1 1 auto;
    max-height: none;
  }
  .context-details-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg);
    border-radius: 6px;
    border: 1px solid var(--border);
    padding: 12px;
  }
  .context-breakdown-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
    margin-top: 8px;
  }
  .context-breakdown-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    background: var(--bg-secondary);
  }
  .context-breakdown-title {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .context-breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 11px;
  }
  .context-breakdown-item {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .context-breakdown-more {
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .context-breakdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .context-expand-btn {
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .context-expand-btn:hover {
    color: var(--text);
    border-color: var(--border-strong);
    background: var(--bg);
  }
  
  /* ===== COMPACT TIMESERIES ===== */
  .session-timeseries-compact {
    background: var(--bg);
    border-radius: 6px;
    border: 1px solid var(--border);
    padding: 12px;
    margin: 0;
  }
  .session-timeseries-compact .timeseries-header-row {
    margin-bottom: 8px;
  }
  .session-timeseries-compact .timeseries-header {
    font-size: 12px;
  }
  .session-timeseries-compact .timeseries-summary {
    font-size: 11px;
    margin-top: 8px;
  }
  
  /* ===== COMPACT CONTEXT ===== */
  .context-weight-compact {
    background: var(--bg);
    border-radius: 6px;
    border: 1px solid var(--border);
    padding: 12px;
    margin: 0;
  }
  .context-weight-compact .context-weight-header {
    font-size: 12px;
    margin-bottom: 4px;
  }
  .context-weight-compact .context-weight-desc {
    font-size: 11px;
    margin-bottom: 8px;
  }
  .context-weight-compact .context-stacked-bar {
    height: 16px;
  }
  .context-weight-compact .context-legend {
    font-size: 11px;
    gap: 10px;
    margin-top: 8px;
  }
  .context-weight-compact .context-total {
    font-size: 11px;
    margin-top: 6px;
  }
  .context-weight-compact .context-details {
    margin-top: 8px;
  }
  .context-weight-compact .context-details summary {
    font-size: 12px;
    padding: 6px 10px;
  }
  
  /* ===== COMPACT LOGS ===== */
  .session-logs-compact {
    background: var(--bg);
    border-radius: 10px;
    border: 1px solid var(--border);
    overflow: hidden;
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  .session-logs-compact .session-logs-header {
    padding: 10px 12px;
    font-size: 12px;
  }
  .session-logs-compact .session-logs-list {
    max-height: none;
    flex: 1 1 auto;
    overflow: auto;
  }
  .session-logs-compact .session-log-entry {
    padding: 8px 12px;
  }
  .session-logs-compact .session-log-content {
    font-size: 12px;
    max-height: 160px;
  }
  .session-log-tools {
    margin-top: 6px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    padding: 6px 8px;
    font-size: 11px;
    color: var(--text);
  }
  .session-log-tools summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }
  .session-log-tools summary::-webkit-details-marker {
    display: none;
  }
  .session-log-tools-list {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .session-log-tools-pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10px;
    background: var(--bg);
    color: var(--text);
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 900px) {
    .usage-grid {
      grid-template-columns: 1fr;
    }
    .session-detail-row {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 600px) {
    .session-bar-label {
      flex: 0 0 100px;
    }
    .cost-breakdown-legend {
      gap: 10px;
    }
    .legend-item {
      font-size: 11px;
    }
    .daily-chart-bars {
      height: 170px;
      gap: 6px;
      padding-bottom: 40px;
    }
    .daily-bar-label {
      font-size: 8px;
      bottom: -30px;
      transform: rotate(-45deg);
    }
    .usage-mosaic-grid {
      grid-template-columns: 1fr;
    }
    .usage-hour-grid {
      grid-template-columns: repeat(12, minmax(10px, 1fr));
    }
    .usage-hour-cell {
      height: 22px;
    }
  }
`,s0=4;function ft(e){return Math.round(e/s0)}function B(e){return e>=1e6?`${(e/1e6).toFixed(1)}M`:e>=1e3?`${(e/1e3).toFixed(1)}K`:String(e)}function i0(e){const t=new Date;return t.setHours(e,0,0,0),t.toLocaleTimeString(void 0,{hour:"numeric"})}function a0(e,t){const n=Array.from({length:24},()=>0),s=Array.from({length:24},()=>0);for(const i of e){const a=i.usage;if(!a?.messageCounts||a.messageCounts.total===0)continue;const o=a.firstActivity??i.updatedAt,l=a.lastActivity??i.updatedAt;if(!o||!l)continue;const c=Math.min(o,l),p=Math.max(o,l),u=Math.max(p-c,1)/6e4;let h=c;for(;h<p;){const f=new Date(h),d=za(f,t),m=ja(f,t),k=Math.min(m.getTime(),p),$=Math.max((k-h)/6e4,0)/u;n[d]+=a.messageCounts.errors*$,s[d]+=a.messageCounts.total*$,h=k+1}}return s.map((i,a)=>{const o=n[a],l=i>0?o/i:0;return{hour:a,rate:l,errors:o,msgs:i}}).filter(i=>i.msgs>0&&i.errors>0).toSorted((i,a)=>a.rate-i.rate).slice(0,5).map(i=>({label:i0(i.hour),value:`${(i.rate*100).toFixed(2)}%`,sub:`${Math.round(i.errors)} errors · ${Math.round(i.msgs)} msgs`}))}const o0=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];function za(e,t){return t==="utc"?e.getUTCHours():e.getHours()}function r0(e,t){return t==="utc"?e.getUTCDay():e.getDay()}function ja(e,t){const n=new Date(e);return t==="utc"?n.setUTCMinutes(59,59,999):n.setMinutes(59,59,999),n}function l0(e,t){const n=Array.from({length:24},()=>0),s=Array.from({length:7},()=>0);let i=0,a=!1;for(const l of e){const c=l.usage;if(!c||!c.totalTokens||c.totalTokens<=0)continue;i+=c.totalTokens;const p=c.firstActivity??l.updatedAt,g=c.lastActivity??l.updatedAt;if(!p||!g)continue;a=!0;const u=Math.min(p,g),h=Math.max(p,g),d=Math.max(h-u,1)/6e4;let m=u;for(;m<h;){const k=new Date(m),S=za(k,t),$=r0(k,t),C=ja(k,t),A=Math.min(C.getTime(),h),E=Math.max((A-m)/6e4,0)/d;n[S]+=c.totalTokens*E,s[$]+=c.totalTokens*E,m=A+1}}const o=o0.map((l,c)=>({label:l,tokens:s[c]}));return{hasData:a,totalTokens:i,hourTotals:n,weekdayTotals:o}}function c0(e,t,n,s){const i=l0(e,t);if(!i.hasData)return r`
      <div class="card usage-mosaic">
        <div class="usage-mosaic-header">
          <div>
            <div class="usage-mosaic-title">Activity by Time</div>
            <div class="usage-mosaic-sub">Estimates require session timestamps.</div>
          </div>
          <div class="usage-mosaic-total">${B(0)} tokens</div>
        </div>
        <div class="muted" style="padding: 12px; text-align: center;">No timeline data yet.</div>
      </div>
    `;const a=Math.max(...i.hourTotals,1),o=Math.max(...i.weekdayTotals.map(l=>l.tokens),1);return r`
    <div class="card usage-mosaic">
      <div class="usage-mosaic-header">
        <div>
          <div class="usage-mosaic-title">Activity by Time</div>
          <div class="usage-mosaic-sub">
            Estimated from session spans (first/last activity). Time zone: ${t==="utc"?"UTC":"Local"}.
          </div>
        </div>
        <div class="usage-mosaic-total">${B(i.totalTokens)} tokens</div>
      </div>
      <div class="usage-mosaic-grid">
        <div class="usage-mosaic-section">
          <div class="usage-mosaic-section-title">Day of Week</div>
          <div class="usage-daypart-grid">
            ${i.weekdayTotals.map(l=>{const c=Math.min(l.tokens/o,1),p=l.tokens>0?`rgba(255, 77, 77, ${.12+c*.6})`:"transparent";return r`
                <div class="usage-daypart-cell" style="background: ${p};">
                  <div class="usage-daypart-label">${l.label}</div>
                  <div class="usage-daypart-value">${B(l.tokens)}</div>
                </div>
              `})}
          </div>
        </div>
        <div class="usage-mosaic-section">
          <div class="usage-mosaic-section-title">
            <span>Hours</span>
            <span class="usage-mosaic-sub">0 → 23</span>
          </div>
          <div class="usage-hour-grid">
            ${i.hourTotals.map((l,c)=>{const p=Math.min(l/a,1),g=l>0?`rgba(255, 77, 77, ${.08+p*.7})`:"transparent",u=`${c}:00 · ${B(l)} tokens`,h=p>.7?"rgba(255, 77, 77, 0.6)":"rgba(255, 77, 77, 0.2)",f=n.includes(c);return r`
                <div
                  class="usage-hour-cell ${f?"selected":""}"
                  style="background: ${g}; border-color: ${h};"
                  title="${u}"
                  @click=${d=>s(c,d.shiftKey)}
                ></div>
              `})}
          </div>
          <div class="usage-hour-labels">
            <span>Midnight</span>
            <span>4am</span>
            <span>8am</span>
            <span>Noon</span>
            <span>4pm</span>
            <span>8pm</span>
          </div>
          <div class="usage-hour-legend">
            <span></span>
            Low → High token density
          </div>
        </div>
      </div>
    </div>
  `}function G(e,t=2){return`$${e.toFixed(t)}`}function hi(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function Kc(e){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return null;const[,n,s,i]=t,a=new Date(Date.UTC(Number(n),Number(s)-1,Number(i)));return Number.isNaN(a.valueOf())?null:a}function Vc(e){const t=Kc(e);return t?t.toLocaleDateString(void 0,{month:"short",day:"numeric"}):e}function d0(e){const t=Kc(e);return t?t.toLocaleDateString(void 0,{month:"long",day:"numeric",year:"numeric"}):e}function fi(e,t,n="text/plain"){const s=new Blob([t],{type:n}),i=URL.createObjectURL(s),a=document.createElement("a");a.href=i,a.download=e,a.click(),URL.revokeObjectURL(i)}function u0(e){return e.includes('"')||e.includes(",")||e.includes(`
`)?`"${e.replace(/"/g,'""')}"`:e}function cs(e){return e.map(t=>t==null?"":u0(String(t))).join(",")}const Hn=()=>({input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,totalCost:0,inputCost:0,outputCost:0,cacheReadCost:0,cacheWriteCost:0,missingCostEntries:0}),zn=(e,t)=>{e.input+=t.input??0,e.output+=t.output??0,e.cacheRead+=t.cacheRead??0,e.cacheWrite+=t.cacheWrite??0,e.totalTokens+=t.totalTokens??0,e.totalCost+=t.totalCost??0,e.inputCost+=t.inputCost??0,e.outputCost+=t.outputCost??0,e.cacheReadCost+=t.cacheReadCost??0,e.cacheWriteCost+=t.cacheWriteCost??0,e.missingCostEntries+=t.missingCostEntries??0},p0=(e,t)=>{if(e.length===0)return t??{messages:{total:0,user:0,assistant:0,toolCalls:0,toolResults:0,errors:0},tools:{totalCalls:0,uniqueTools:0,tools:[]},byModel:[],byProvider:[],byAgent:[],byChannel:[],daily:[]};const n={total:0,user:0,assistant:0,toolCalls:0,toolResults:0,errors:0},s=new Map,i=new Map,a=new Map,o=new Map,l=new Map,c=new Map,p=new Map,g=new Map,u={count:0,sum:0,min:Number.POSITIVE_INFINITY,max:0,p95Max:0};for(const h of e){const f=h.usage;if(f){if(f.messageCounts&&(n.total+=f.messageCounts.total,n.user+=f.messageCounts.user,n.assistant+=f.messageCounts.assistant,n.toolCalls+=f.messageCounts.toolCalls,n.toolResults+=f.messageCounts.toolResults,n.errors+=f.messageCounts.errors),f.toolUsage)for(const d of f.toolUsage.tools)s.set(d.name,(s.get(d.name)??0)+d.count);if(f.modelUsage)for(const d of f.modelUsage){const m=`${d.provider??"unknown"}::${d.model??"unknown"}`,k=i.get(m)??{provider:d.provider,model:d.model,count:0,totals:Hn()};k.count+=d.count,zn(k.totals,d.totals),i.set(m,k);const S=d.provider??"unknown",$=a.get(S)??{provider:d.provider,model:void 0,count:0,totals:Hn()};$.count+=d.count,zn($.totals,d.totals),a.set(S,$)}if(f.latency){const{count:d,avgMs:m,minMs:k,maxMs:S,p95Ms:$}=f.latency;d>0&&(u.count+=d,u.sum+=m*d,u.min=Math.min(u.min,k),u.max=Math.max(u.max,S),u.p95Max=Math.max(u.p95Max,$))}if(h.agentId){const d=o.get(h.agentId)??Hn();zn(d,f),o.set(h.agentId,d)}if(h.channel){const d=l.get(h.channel)??Hn();zn(d,f),l.set(h.channel,d)}for(const d of f.dailyBreakdown??[]){const m=c.get(d.date)??{date:d.date,tokens:0,cost:0,messages:0,toolCalls:0,errors:0};m.tokens+=d.tokens,m.cost+=d.cost,c.set(d.date,m)}for(const d of f.dailyMessageCounts??[]){const m=c.get(d.date)??{date:d.date,tokens:0,cost:0,messages:0,toolCalls:0,errors:0};m.messages+=d.total,m.toolCalls+=d.toolCalls,m.errors+=d.errors,c.set(d.date,m)}for(const d of f.dailyLatency??[]){const m=p.get(d.date)??{date:d.date,count:0,sum:0,min:Number.POSITIVE_INFINITY,max:0,p95Max:0};m.count+=d.count,m.sum+=d.avgMs*d.count,m.min=Math.min(m.min,d.minMs),m.max=Math.max(m.max,d.maxMs),m.p95Max=Math.max(m.p95Max,d.p95Ms),p.set(d.date,m)}for(const d of f.dailyModelUsage??[]){const m=`${d.date}::${d.provider??"unknown"}::${d.model??"unknown"}`,k=g.get(m)??{date:d.date,provider:d.provider,model:d.model,tokens:0,cost:0,count:0};k.tokens+=d.tokens,k.cost+=d.cost,k.count+=d.count,g.set(m,k)}}}return{messages:n,tools:{totalCalls:Array.from(s.values()).reduce((h,f)=>h+f,0),uniqueTools:s.size,tools:Array.from(s.entries()).map(([h,f])=>({name:h,count:f})).toSorted((h,f)=>f.count-h.count)},byModel:Array.from(i.values()).toSorted((h,f)=>f.totals.totalCost-h.totals.totalCost),byProvider:Array.from(a.values()).toSorted((h,f)=>f.totals.totalCost-h.totals.totalCost),byAgent:Array.from(o.entries()).map(([h,f])=>({agentId:h,totals:f})).toSorted((h,f)=>f.totals.totalCost-h.totals.totalCost),byChannel:Array.from(l.entries()).map(([h,f])=>({channel:h,totals:f})).toSorted((h,f)=>f.totals.totalCost-h.totals.totalCost),latency:u.count>0?{count:u.count,avgMs:u.sum/u.count,minMs:u.min===Number.POSITIVE_INFINITY?0:u.min,maxMs:u.max,p95Ms:u.p95Max}:void 0,dailyLatency:Array.from(p.values()).map(h=>({date:h.date,count:h.count,avgMs:h.count?h.sum/h.count:0,minMs:h.min===Number.POSITIVE_INFINITY?0:h.min,maxMs:h.max,p95Ms:h.p95Max})).toSorted((h,f)=>h.date.localeCompare(f.date)),modelDaily:Array.from(g.values()).toSorted((h,f)=>h.date.localeCompare(f.date)||f.cost-h.cost),daily:Array.from(c.values()).toSorted((h,f)=>h.date.localeCompare(f.date))}},g0=(e,t,n)=>{let s=0,i=0;for(const g of e){const u=g.usage?.durationMs??0;u>0&&(s+=u,i+=1)}const a=i?s/i:0,o=t&&s>0?t.totalTokens/(s/6e4):void 0,l=t&&s>0?t.totalCost/(s/6e4):void 0,c=n.messages.total?n.messages.errors/n.messages.total:0,p=n.daily.filter(g=>g.messages>0&&g.errors>0).map(g=>({date:g.date,errors:g.errors,messages:g.messages,rate:g.errors/g.messages})).toSorted((g,u)=>u.rate-g.rate||u.errors-g.errors)[0];return{durationSumMs:s,durationCount:i,avgDurationMs:a,throughputTokensPerMin:o,throughputCostPerMin:l,errorRate:c,peakErrorDay:p}},h0=e=>{const t=[cs(["key","label","agentId","channel","provider","model","updatedAt","durationMs","messages","errors","toolCalls","inputTokens","outputTokens","cacheReadTokens","cacheWriteTokens","totalTokens","totalCost"])];for(const n of e){const s=n.usage;t.push(cs([n.key,n.label??"",n.agentId??"",n.channel??"",n.modelProvider??n.providerOverride??"",n.model??n.modelOverride??"",n.updatedAt?new Date(n.updatedAt).toISOString():"",s?.durationMs??"",s?.messageCounts?.total??"",s?.messageCounts?.errors??"",s?.messageCounts?.toolCalls??"",s?.input??"",s?.output??"",s?.cacheRead??"",s?.cacheWrite??"",s?.totalTokens??"",s?.totalCost??""]))}return t.join(`
`)},f0=e=>{const t=[cs(["date","inputTokens","outputTokens","cacheReadTokens","cacheWriteTokens","totalTokens","inputCost","outputCost","cacheReadCost","cacheWriteCost","totalCost"])];for(const n of e)t.push(cs([n.date,n.input,n.output,n.cacheRead,n.cacheWrite,n.totalTokens,n.inputCost??"",n.outputCost??"",n.cacheReadCost??"",n.cacheWriteCost??"",n.totalCost]));return t.join(`
`)},m0=(e,t,n)=>{const s=e.trim();if(!s)return[];const i=s.length?s.split(/\s+/):[],a=i.length?i[i.length-1]:"",[o,l]=a.includes(":")?[a.slice(0,a.indexOf(":")),a.slice(a.indexOf(":")+1)]:["",""],c=o.toLowerCase(),p=l.toLowerCase(),g=$=>{const C=new Set;for(const A of $)A&&C.add(A);return Array.from(C)},u=g(t.map($=>$.agentId)).slice(0,6),h=g(t.map($=>$.channel)).slice(0,6),f=g([...t.map($=>$.modelProvider),...t.map($=>$.providerOverride),...n?.byProvider.map($=>$.provider)??[]]).slice(0,6),d=g([...t.map($=>$.model),...n?.byModel.map($=>$.model)??[]]).slice(0,6),m=g(n?.tools.tools.map($=>$.name)??[]).slice(0,6);if(!c)return[{label:"agent:",value:"agent:"},{label:"channel:",value:"channel:"},{label:"provider:",value:"provider:"},{label:"model:",value:"model:"},{label:"tool:",value:"tool:"},{label:"has:errors",value:"has:errors"},{label:"has:tools",value:"has:tools"},{label:"minTokens:",value:"minTokens:"},{label:"maxCost:",value:"maxCost:"}];const k=[],S=($,C)=>{for(const A of C)(!p||A.toLowerCase().includes(p))&&k.push({label:`${$}:${A}`,value:`${$}:${A}`})};switch(c){case"agent":S("agent",u);break;case"channel":S("channel",h);break;case"provider":S("provider",f);break;case"model":S("model",d);break;case"tool":S("tool",m);break;case"has":["errors","tools","context","usage","model","provider"].forEach($=>{(!p||$.includes(p))&&k.push({label:`has:${$}`,value:`has:${$}`})});break}return k},v0=(e,t)=>{const n=e.trim();if(!n)return`${t} `;const s=n.split(/\s+/);return s[s.length-1]=t,`${s.join(" ")} `},yt=e=>e.trim().toLowerCase(),b0=(e,t)=>{const n=e.trim();if(!n)return`${t} `;const s=n.split(/\s+/),i=s[s.length-1]??"",a=t.includes(":")?t.split(":")[0]:null,o=i.includes(":")?i.split(":")[0]:null;return i.endsWith(":")&&a&&o===a?(s[s.length-1]=t,`${s.join(" ")} `):s.includes(t)?`${s.join(" ")} `:`${s.join(" ")} ${t} `},Wr=(e,t)=>{const s=e.trim().split(/\s+/).filter(Boolean).filter(i=>i!==t);return s.length?`${s.join(" ")} `:""},qr=(e,t,n)=>{const s=yt(t),a=[...Ha(e).filter(o=>yt(o.key??"")!==s).map(o=>o.raw),...n.map(o=>`${t}:${o}`)];return a.length?`${a.join(" ")} `:""};function ve(e,t){return t===0?0:e/t*100}function y0(e){const t=e.totalCost||0;return{input:{tokens:e.input,cost:e.inputCost||0,pct:ve(e.inputCost||0,t)},output:{tokens:e.output,cost:e.outputCost||0,pct:ve(e.outputCost||0,t)},cacheRead:{tokens:e.cacheRead,cost:e.cacheReadCost||0,pct:ve(e.cacheReadCost||0,t)},cacheWrite:{tokens:e.cacheWrite,cost:e.cacheWriteCost||0,pct:ve(e.cacheWriteCost||0,t)},totalCost:t}}function x0(e,t,n,s,i,a,o,l){if(!(e.length>0||t.length>0||n.length>0))return v;const p=n.length===1?s.find(d=>d.key===n[0]):null,g=p?(p.label||p.key).slice(0,20)+((p.label||p.key).length>20?"…":""):n.length===1?n[0].slice(0,8)+"…":`${n.length} sessions`,u=p?p.label||p.key:n.length===1?n[0]:n.join(", "),h=e.length===1?e[0]:`${e.length} days`,f=t.length===1?`${t[0]}:00`:`${t.length} hours`;return r`
    <div class="active-filters">
      ${e.length>0?r`
            <div class="filter-chip">
              <span class="filter-chip-label">Days: ${h}</span>
              <button class="filter-chip-remove" @click=${i} title="Remove filter">×</button>
            </div>
          `:v}
      ${t.length>0?r`
            <div class="filter-chip">
              <span class="filter-chip-label">Hours: ${f}</span>
              <button class="filter-chip-remove" @click=${a} title="Remove filter">×</button>
            </div>
          `:v}
      ${n.length>0?r`
            <div class="filter-chip" title="${u}">
              <span class="filter-chip-label">Session: ${g}</span>
              <button class="filter-chip-remove" @click=${o} title="Remove filter">×</button>
            </div>
          `:v}
      ${(e.length>0||t.length>0)&&n.length>0?r`
            <button class="btn btn-sm filter-clear-btn" @click=${l}>
              Clear All
            </button>
          `:v}
    </div>
  `}function w0(e,t,n,s,i,a){if(!e.length)return r`
      <div class="daily-chart-compact">
        <div class="sessions-panel-title">Daily Usage</div>
        <div class="muted" style="padding: 20px; text-align: center">No data</div>
      </div>
    `;const o=n==="tokens",l=e.map(u=>o?u.totalTokens:u.totalCost),c=Math.max(...l,o?1:1e-4),p=e.length>30?12:e.length>20?18:e.length>14?24:32,g=e.length<=14;return r`
    <div class="daily-chart-compact">
      <div class="daily-chart-header">
        <div class="chart-toggle small sessions-toggle">
          <button
            class="toggle-btn ${s==="total"?"active":""}"
            @click=${()=>i("total")}
          >
            Total
          </button>
          <button
            class="toggle-btn ${s==="by-type"?"active":""}"
            @click=${()=>i("by-type")}
          >
            By Type
          </button>
        </div>
        <div class="card-title">Daily ${o?"Token":"Cost"} Usage</div>
      </div>
      <div class="daily-chart">
        <div class="daily-chart-bars" style="--bar-max-width: ${p}px">
          ${e.map((u,h)=>{const d=l[h]/c*100,m=t.includes(u.date),k=Vc(u.date),S=e.length>20?String(parseInt(u.date.slice(8),10)):k,$=e.length>20?"font-size: 8px":"",C=s==="by-type"?o?[{value:u.output,class:"output"},{value:u.input,class:"input"},{value:u.cacheWrite,class:"cache-write"},{value:u.cacheRead,class:"cache-read"}]:[{value:u.outputCost??0,class:"output"},{value:u.inputCost??0,class:"input"},{value:u.cacheWriteCost??0,class:"cache-write"},{value:u.cacheReadCost??0,class:"cache-read"}]:[],A=s==="by-type"?o?[`Output ${B(u.output)}`,`Input ${B(u.input)}`,`Cache write ${B(u.cacheWrite)}`,`Cache read ${B(u.cacheRead)}`]:[`Output ${G(u.outputCost??0)}`,`Input ${G(u.inputCost??0)}`,`Cache write ${G(u.cacheWriteCost??0)}`,`Cache read ${G(u.cacheReadCost??0)}`]:[],T=o?B(u.totalTokens):G(u.totalCost);return r`
              <div
                class="daily-bar-wrapper ${m?"selected":""}"
                @click=${E=>a(u.date,E.shiftKey)}
              >
                ${s==="by-type"?r`
                        <div
                          class="daily-bar"
                          style="height: ${d.toFixed(1)}%; display: flex; flex-direction: column;"
                        >
                          ${(()=>{const E=C.reduce((M,V)=>M+V.value,0)||1;return C.map(M=>r`
                                <div
                                  class="cost-segment ${M.class}"
                                  style="height: ${M.value/E*100}%"
                                ></div>
                              `)})()}
                        </div>
                      `:r`
                        <div class="daily-bar" style="height: ${d.toFixed(1)}%"></div>
                      `}
                ${g?r`<div class="daily-bar-total">${T}</div>`:v}
                <div class="daily-bar-label" style="${$}">${S}</div>
                <div class="daily-bar-tooltip">
                  <strong>${d0(u.date)}</strong><br />
                  ${B(u.totalTokens)} tokens<br />
                  ${G(u.totalCost)}
                  ${A.length?r`${A.map(E=>r`<div>${E}</div>`)}`:v}
                </div>
              </div>
            `})}
        </div>
      </div>
    </div>
  `}function $0(e,t){const n=y0(e),s=t==="tokens",i=e.totalTokens||1,a={output:ve(e.output,i),input:ve(e.input,i),cacheWrite:ve(e.cacheWrite,i),cacheRead:ve(e.cacheRead,i)};return r`
    <div class="cost-breakdown cost-breakdown-compact">
      <div class="cost-breakdown-header">${s?"Tokens":"Cost"} by Type</div>
      <div class="cost-breakdown-bar">
        <div class="cost-segment output" style="width: ${(s?a.output:n.output.pct).toFixed(1)}%"
          title="Output: ${s?B(e.output):G(n.output.cost)}"></div>
        <div class="cost-segment input" style="width: ${(s?a.input:n.input.pct).toFixed(1)}%"
          title="Input: ${s?B(e.input):G(n.input.cost)}"></div>
        <div class="cost-segment cache-write" style="width: ${(s?a.cacheWrite:n.cacheWrite.pct).toFixed(1)}%"
          title="Cache Write: ${s?B(e.cacheWrite):G(n.cacheWrite.cost)}"></div>
        <div class="cost-segment cache-read" style="width: ${(s?a.cacheRead:n.cacheRead.pct).toFixed(1)}%"
          title="Cache Read: ${s?B(e.cacheRead):G(n.cacheRead.cost)}"></div>
      </div>
      <div class="cost-breakdown-legend">
        <span class="legend-item"><span class="legend-dot output"></span>Output ${s?B(e.output):G(n.output.cost)}</span>
        <span class="legend-item"><span class="legend-dot input"></span>Input ${s?B(e.input):G(n.input.cost)}</span>
        <span class="legend-item"><span class="legend-dot cache-write"></span>Cache Write ${s?B(e.cacheWrite):G(n.cacheWrite.cost)}</span>
        <span class="legend-item"><span class="legend-dot cache-read"></span>Cache Read ${s?B(e.cacheRead):G(n.cacheRead.cost)}</span>
      </div>
      <div class="cost-breakdown-total">
        Total: ${s?B(e.totalTokens):G(e.totalCost)}
      </div>
    </div>
  `}function xt(e,t,n){return r`
    <div class="usage-insight-card">
      <div class="usage-insight-title">${e}</div>
      ${t.length===0?r`<div class="muted">${n}</div>`:r`
              <div class="usage-list">
                ${t.map(s=>r`
                    <div class="usage-list-item">
                      <span>${s.label}</span>
                      <span class="usage-list-value">
                        <span>${s.value}</span>
                        ${s.sub?r`<span class="usage-list-sub">${s.sub}</span>`:v}
                      </span>
                    </div>
                  `)}
              </div>
            `}
    </div>
  `}function Gr(e,t,n){return r`
    <div class="usage-insight-card">
      <div class="usage-insight-title">${e}</div>
      ${t.length===0?r`<div class="muted">${n}</div>`:r`
              <div class="usage-error-list">
                ${t.map(s=>r`
                    <div class="usage-error-row">
                      <div class="usage-error-date">${s.label}</div>
                      <div class="usage-error-rate">${s.value}</div>
                      ${s.sub?r`<div class="usage-error-sub">${s.sub}</div>`:v}
                    </div>
                  `)}
              </div>
            `}
    </div>
  `}function k0(e,t,n,s,i,a,o){if(!e)return v;const l=t.messages.total?Math.round(e.totalTokens/t.messages.total):0,c=t.messages.total?e.totalCost/t.messages.total:0,p=e.input+e.cacheRead,g=p>0?e.cacheRead/p:0,u=p>0?`${(g*100).toFixed(1)}%`:"—",h=n.errorRate*100,f=n.throughputTokensPerMin!==void 0?`${B(Math.round(n.throughputTokensPerMin))} tok/min`:"—",d=n.throughputCostPerMin!==void 0?`${G(n.throughputCostPerMin,4)} / min`:"—",m=n.durationCount>0?ra(n.avgDurationMs,{spaced:!0})??"—":"—",k="Cache hit rate = cache read / (input + cache read). Higher is better.",S="Error rate = errors / total messages. Lower is better.",$="Throughput shows tokens per minute over active time. Higher is better.",C="Average tokens per message in this range.",A=s?"Average cost per message when providers report costs. Cost data is missing for some or all sessions in this range.":"Average cost per message when providers report costs.",T=t.daily.filter(N=>N.messages>0&&N.errors>0).map(N=>{const z=N.errors/N.messages;return{label:Vc(N.date),value:`${(z*100).toFixed(2)}%`,sub:`${N.errors} errors · ${N.messages} msgs · ${B(N.tokens)}`,rate:z}}).toSorted((N,z)=>z.rate-N.rate).slice(0,5).map(({rate:N,...z})=>z),E=t.byModel.slice(0,5).map(N=>({label:N.model??"unknown",value:G(N.totals.totalCost),sub:`${B(N.totals.totalTokens)} · ${N.count} msgs`})),M=t.byProvider.slice(0,5).map(N=>({label:N.provider??"unknown",value:G(N.totals.totalCost),sub:`${B(N.totals.totalTokens)} · ${N.count} msgs`})),V=t.tools.tools.slice(0,6).map(N=>({label:N.name,value:`${N.count}`,sub:"calls"})),K=t.byAgent.slice(0,5).map(N=>({label:N.agentId,value:G(N.totals.totalCost),sub:B(N.totals.totalTokens)})),oe=t.byChannel.slice(0,5).map(N=>({label:N.channel,value:G(N.totals.totalCost),sub:B(N.totals.totalTokens)}));return r`
    <section class="card" style="margin-top: 16px;">
      <div class="card-title">Usage Overview</div>
      <div class="usage-summary-grid">
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Messages
            <span class="usage-summary-hint" title="Total user + assistant messages in range.">?</span>
          </div>
          <div class="usage-summary-value">${t.messages.total}</div>
          <div class="usage-summary-sub">
            ${t.messages.user} user · ${t.messages.assistant} assistant
          </div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Tool Calls
            <span class="usage-summary-hint" title="Total tool call count across sessions.">?</span>
          </div>
          <div class="usage-summary-value">${t.tools.totalCalls}</div>
          <div class="usage-summary-sub">${t.tools.uniqueTools} tools used</div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Errors
            <span class="usage-summary-hint" title="Total message/tool errors in range.">?</span>
          </div>
          <div class="usage-summary-value">${t.messages.errors}</div>
          <div class="usage-summary-sub">${t.messages.toolResults} tool results</div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Avg Tokens / Msg
            <span class="usage-summary-hint" title=${C}>?</span>
          </div>
          <div class="usage-summary-value">${B(l)}</div>
          <div class="usage-summary-sub">Across ${t.messages.total||0} messages</div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Avg Cost / Msg
            <span class="usage-summary-hint" title=${A}>?</span>
          </div>
          <div class="usage-summary-value">${G(c,4)}</div>
          <div class="usage-summary-sub">${G(e.totalCost)} total</div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Sessions
            <span class="usage-summary-hint" title="Distinct sessions in the range.">?</span>
          </div>
          <div class="usage-summary-value">${a}</div>
          <div class="usage-summary-sub">of ${o} in range</div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Throughput
            <span class="usage-summary-hint" title=${$}>?</span>
          </div>
          <div class="usage-summary-value">${f}</div>
          <div class="usage-summary-sub">${d}</div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Error Rate
            <span class="usage-summary-hint" title=${S}>?</span>
          </div>
          <div class="usage-summary-value ${h>5?"bad":h>1?"warn":"good"}">${h.toFixed(2)}%</div>
          <div class="usage-summary-sub">
            ${t.messages.errors} errors · ${m} avg session
          </div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Cache Hit Rate
            <span class="usage-summary-hint" title=${k}>?</span>
          </div>
          <div class="usage-summary-value ${g>.6?"good":g>.3?"warn":"bad"}">${u}</div>
          <div class="usage-summary-sub">
            ${B(e.cacheRead)} cached · ${B(p)} prompt
          </div>
        </div>
      </div>
      <div class="usage-insights-grid">
        ${xt("Top Models",E,"No model data")}
        ${xt("Top Providers",M,"No provider data")}
        ${xt("Top Tools",V,"No tool calls")}
        ${xt("Top Agents",K,"No agent data")}
        ${xt("Top Channels",oe,"No channel data")}
        ${Gr("Peak Error Days",T,"No error data")}
        ${Gr("Peak Error Hours",i,"No error data")}
      </div>
    </section>
  `}function S0(e,t,n,s,i,a,o,l,c,p,g,u,h,f,d){const m=L=>h.includes(L),k=L=>{const U=L.label||L.key;return U.startsWith("agent:")&&U.includes("?token=")?U.slice(0,U.indexOf("?token=")):U},S=async L=>{const U=k(L);try{await navigator.clipboard.writeText(U)}catch{}},$=L=>{const U=[];return m("channel")&&L.channel&&U.push(`channel:${L.channel}`),m("agent")&&L.agentId&&U.push(`agent:${L.agentId}`),m("provider")&&(L.modelProvider||L.providerOverride)&&U.push(`provider:${L.modelProvider??L.providerOverride}`),m("model")&&L.model&&U.push(`model:${L.model}`),m("messages")&&L.usage?.messageCounts&&U.push(`msgs:${L.usage.messageCounts.total}`),m("tools")&&L.usage?.toolUsage&&U.push(`tools:${L.usage.toolUsage.totalCalls}`),m("errors")&&L.usage?.messageCounts&&U.push(`errors:${L.usage.messageCounts.errors}`),m("duration")&&L.usage?.durationMs&&U.push(`dur:${ra(L.usage.durationMs,{spaced:!0})??"—"}`),U},C=L=>{const U=L.usage;if(!U)return 0;if(n.length>0&&U.dailyBreakdown&&U.dailyBreakdown.length>0){const ce=U.dailyBreakdown.filter(de=>n.includes(de.date));return s?ce.reduce((de,te)=>de+te.tokens,0):ce.reduce((de,te)=>de+te.cost,0)}return s?U.totalTokens??0:U.totalCost??0},A=[...e].toSorted((L,U)=>{switch(i){case"recent":return(U.updatedAt??0)-(L.updatedAt??0);case"messages":return(U.usage?.messageCounts?.total??0)-(L.usage?.messageCounts?.total??0);case"errors":return(U.usage?.messageCounts?.errors??0)-(L.usage?.messageCounts?.errors??0);case"cost":return C(U)-C(L);default:return C(U)-C(L)}}),T=a==="asc"?A.toReversed():A,E=T.reduce((L,U)=>L+C(U),0),M=T.length?E/T.length:0,V=T.reduce((L,U)=>L+(U.usage?.messageCounts?.errors??0),0),K=new Set(t),oe=T.filter(L=>K.has(L.key)),N=oe.length,z=new Map(T.map(L=>[L.key,L])),he=o.map(L=>z.get(L)).filter(L=>!!L);return r`
    <div class="card sessions-card">
      <div class="sessions-card-header">
        <div class="card-title">Sessions</div>
        <div class="sessions-card-count">
          ${e.length} shown${f!==e.length?` · ${f} total`:""}
        </div>
      </div>
      <div class="sessions-card-meta">
        <div class="sessions-card-stats">
          <span>${s?B(M):G(M)} avg</span>
          <span>${V} errors</span>
        </div>
        <div class="chart-toggle small">
          <button
            class="toggle-btn ${l==="all"?"active":""}"
            @click=${()=>u("all")}
          >
            All
          </button>
          <button
            class="toggle-btn ${l==="recent"?"active":""}"
            @click=${()=>u("recent")}
          >
            Recently viewed
          </button>
        </div>
        <label class="sessions-sort">
          <span>Sort</span>
          <select
            @change=${L=>p(L.target.value)}
          >
            <option value="cost" ?selected=${i==="cost"}>Cost</option>
            <option value="errors" ?selected=${i==="errors"}>Errors</option>
            <option value="messages" ?selected=${i==="messages"}>Messages</option>
            <option value="recent" ?selected=${i==="recent"}>Recent</option>
            <option value="tokens" ?selected=${i==="tokens"}>Tokens</option>
          </select>
        </label>
        <button
          class="btn btn-sm sessions-action-btn icon"
          @click=${()=>g(a==="desc"?"asc":"desc")}
          title=${a==="desc"?"Descending":"Ascending"}
        >
          ${a==="desc"?"↓":"↑"}
        </button>
        ${N>0?r`
                <button class="btn btn-sm sessions-action-btn sessions-clear-btn" @click=${d}>
                  Clear Selection
                </button>
              `:v}
      </div>
      ${l==="recent"?he.length===0?r`
                <div class="muted" style="padding: 20px; text-align: center">No recent sessions</div>
              `:r`
                <div class="session-bars" style="max-height: 220px; margin-top: 6px;">
                  ${he.map(L=>{const U=C(L),ce=K.has(L.key),de=k(L),te=$(L);return r`
                      <div
                        class="session-bar-row ${ce?"selected":""}"
                        @click=${re=>c(L.key,re.shiftKey)}
                        title="${L.key}"
                      >
                        <div class="session-bar-label">
                          <div class="session-bar-title">${de}</div>
                          ${te.length>0?r`<div class="session-bar-meta">${te.join(" · ")}</div>`:v}
                        </div>
                        <div class="session-bar-track" style="display: none;"></div>
                        <div class="session-bar-actions">
                          <button
                            class="session-copy-btn"
                            title="Copy session name"
                            @click=${re=>{re.stopPropagation(),S(L)}}
                          >
                            Copy
                          </button>
                          <div class="session-bar-value">${s?B(U):G(U)}</div>
                        </div>
                      </div>
                    `})}
                </div>
              `:e.length===0?r`
                <div class="muted" style="padding: 20px; text-align: center">No sessions in range</div>
              `:r`
                <div class="session-bars">
                  ${T.slice(0,50).map(L=>{const U=C(L),ce=t.includes(L.key),de=k(L),te=$(L);return r`
                      <div
                        class="session-bar-row ${ce?"selected":""}"
                        @click=${re=>c(L.key,re.shiftKey)}
                        title="${L.key}"
                      >
                        <div class="session-bar-label">
                          <div class="session-bar-title">${de}</div>
                          ${te.length>0?r`<div class="session-bar-meta">${te.join(" · ")}</div>`:v}
                        </div>
                        <div class="session-bar-track" style="display: none;"></div>
                        <div class="session-bar-actions">
                          <button
                            class="session-copy-btn"
                            title="Copy session name"
                            @click=${re=>{re.stopPropagation(),S(L)}}
                          >
                            Copy
                          </button>
                          <div class="session-bar-value">${s?B(U):G(U)}</div>
                        </div>
                      </div>
                    `})}
                  ${e.length>50?r`<div class="muted" style="padding: 8px; text-align: center; font-size: 11px;">+${e.length-50} more</div>`:v}
                </div>
              `}
      ${N>1?r`
              <div style="margin-top: 10px;">
                <div class="sessions-card-count">Selected (${N})</div>
                <div class="session-bars" style="max-height: 160px; margin-top: 6px;">
                  ${oe.map(L=>{const U=C(L),ce=k(L),de=$(L);return r`
                      <div
                        class="session-bar-row selected"
                        @click=${te=>c(L.key,te.shiftKey)}
                        title="${L.key}"
                      >
                        <div class="session-bar-label">
                          <div class="session-bar-title">${ce}</div>
                          ${de.length>0?r`<div class="session-bar-meta">${de.join(" · ")}</div>`:v}
                        </div>
                  <div class="session-bar-track" style="display: none;"></div>
                        <div class="session-bar-actions">
                          <button
                            class="session-copy-btn"
                            title="Copy session name"
                            @click=${te=>{te.stopPropagation(),S(L)}}
                          >
                            Copy
                          </button>
                          <div class="session-bar-value">${s?B(U):G(U)}</div>
                        </div>
                      </div>
                    `})}
                </div>
              </div>
            `:v}
    </div>
  `}function A0(){return v}function C0(e){const t=e.usage;if(!t)return r`
      <div class="muted">No usage data for this session.</div>
    `;const n=o=>o?new Date(o).toLocaleString():"—",s=[];e.channel&&s.push(`channel:${e.channel}`),e.agentId&&s.push(`agent:${e.agentId}`),(e.modelProvider||e.providerOverride)&&s.push(`provider:${e.modelProvider??e.providerOverride}`),e.model&&s.push(`model:${e.model}`);const i=t.toolUsage?.tools.slice(0,6).map(o=>({label:o.name,value:`${o.count}`,sub:"calls"}))??[],a=t.modelUsage?.slice(0,6).map(o=>({label:o.model??"unknown",value:G(o.totals.totalCost),sub:B(o.totals.totalTokens)}))??[];return r`
    ${s.length>0?r`<div class="usage-badges">${s.map(o=>r`<span class="usage-badge">${o}</span>`)}</div>`:v}
    <div class="session-summary-grid">
      <div class="session-summary-card">
        <div class="session-summary-title">Messages</div>
        <div class="session-summary-value">${t.messageCounts?.total??0}</div>
        <div class="session-summary-meta">${t.messageCounts?.user??0} user · ${t.messageCounts?.assistant??0} assistant</div>
      </div>
      <div class="session-summary-card">
        <div class="session-summary-title">Tool Calls</div>
        <div class="session-summary-value">${t.toolUsage?.totalCalls??0}</div>
        <div class="session-summary-meta">${t.toolUsage?.uniqueTools??0} tools</div>
      </div>
      <div class="session-summary-card">
        <div class="session-summary-title">Errors</div>
        <div class="session-summary-value">${t.messageCounts?.errors??0}</div>
        <div class="session-summary-meta">${t.messageCounts?.toolResults??0} tool results</div>
      </div>
      <div class="session-summary-card">
        <div class="session-summary-title">Duration</div>
        <div class="session-summary-value">${ra(t.durationMs,{spaced:!0})??"—"}</div>
        <div class="session-summary-meta">${n(t.firstActivity)} → ${n(t.lastActivity)}</div>
      </div>
    </div>
    <div class="usage-insights-grid" style="margin-top: 12px;">
      ${xt("Top Tools",i,"No tool calls")}
      ${xt("Model Mix",a,"No model data")}
    </div>
  `}function T0(e,t,n,s,i,a,o,l,c,p,g,u,h,f,d,m,k,S,$,C,A,T,E){const M=e.label||e.key,V=M.length>50?M.slice(0,50)+"…":M,K=e.usage;return r`
    <div class="card session-detail-panel">
      <div class="session-detail-header">
        <div class="session-detail-header-left">
          <div class="session-detail-title">${V}</div>
        </div>
        <div class="session-detail-stats">
          ${K?r`
            <span><strong>${B(K.totalTokens)}</strong> tokens</span>
            <span><strong>${G(K.totalCost)}</strong></span>
          `:v}
        </div>
        <button class="session-close-btn" @click=${E} title="Close session details">×</button>
      </div>
      <div class="session-detail-content">
        ${C0(e)}
        <div class="session-detail-row">
          ${_0(t,n,s,i,a,o,l,c,p)}
        </div>
        <div class="session-detail-bottom">
          ${L0(g,u,h,f,d,m,k,S,$,C)}
          ${E0(e.contextWeight,K,A,T)}
        </div>
      </div>
    </div>
  `}function _0(e,t,n,s,i,a,o,l,c){if(t)return r`
      <div class="session-timeseries-compact">
        <div class="muted" style="padding: 20px; text-align: center">Loading...</div>
      </div>
    `;if(!e||e.points.length<2)return r`
      <div class="session-timeseries-compact">
        <div class="muted" style="padding: 20px; text-align: center">No timeline data</div>
      </div>
    `;let p=e.points;if(o||l||c&&c.length>0){const z=o?new Date(o+"T00:00:00").getTime():0,he=l?new Date(l+"T23:59:59").getTime():1/0;p=e.points.filter(L=>{if(L.timestamp<z||L.timestamp>he)return!1;if(c&&c.length>0){const U=new Date(L.timestamp),ce=`${U.getFullYear()}-${String(U.getMonth()+1).padStart(2,"0")}-${String(U.getDate()).padStart(2,"0")}`;return c.includes(ce)}return!0})}if(p.length<2)return r`
      <div class="session-timeseries-compact">
        <div class="muted" style="padding: 20px; text-align: center">No data in range</div>
      </div>
    `;let g=0,u=0,h=0,f=0,d=0,m=0;p=p.map(z=>(g+=z.totalTokens,u+=z.cost,h+=z.output,f+=z.input,d+=z.cacheRead,m+=z.cacheWrite,{...z,cumulativeTokens:g,cumulativeCost:u}));const k=400,S=80,$={top:16,right:10,bottom:20,left:40},C=k-$.left-$.right,A=S-$.top-$.bottom,T=n==="cumulative",E=n==="per-turn"&&i==="by-type",M=h+f+d+m,V=p.map(z=>T?z.cumulativeTokens:E?z.input+z.output+z.cacheRead+z.cacheWrite:z.totalTokens),K=Math.max(...V,1),oe=Math.max(2,Math.min(8,C/p.length*.7)),N=Math.max(1,(C-oe*p.length)/(p.length-1||1));return r`
    <div class="session-timeseries-compact">
      <div class="timeseries-header-row">
        <div class="card-title" style="font-size: 13px;">Usage Over Time</div>
        <div class="timeseries-controls">
          <div class="chart-toggle small">
            <button
              class="toggle-btn ${T?"":"active"}"
              @click=${()=>s("per-turn")}
            >
              Per Turn
            </button>
            <button
              class="toggle-btn ${T?"active":""}"
              @click=${()=>s("cumulative")}
            >
              Cumulative
            </button>
          </div>
          ${T?v:r`
                  <div class="chart-toggle small">
                    <button
                      class="toggle-btn ${i==="total"?"active":""}"
                      @click=${()=>a("total")}
                    >
                      Total
                    </button>
                    <button
                      class="toggle-btn ${i==="by-type"?"active":""}"
                      @click=${()=>a("by-type")}
                    >
                      By Type
                    </button>
                  </div>
                `}
        </div>
      </div>
      <svg viewBox="0 0 ${k} ${S+15}" class="timeseries-svg" style="width: 100%; height: auto;">
        <!-- Y axis -->
        <line x1="${$.left}" y1="${$.top}" x2="${$.left}" y2="${$.top+A}" stroke="var(--border)" />
        <!-- X axis -->
        <line x1="${$.left}" y1="${$.top+A}" x2="${k-$.right}" y2="${$.top+A}" stroke="var(--border)" />
        <!-- Y axis labels -->
        <text x="${$.left-4}" y="${$.top+4}" text-anchor="end" class="axis-label" style="font-size: 9px; fill: var(--text-muted)">${B(K)}</text>
        <text x="${$.left-4}" y="${$.top+A}" text-anchor="end" class="axis-label" style="font-size: 9px; fill: var(--text-muted)">0</text>
        <!-- X axis labels (first and last) -->
        ${p.length>0?J`
          <text x="${$.left}" y="${$.top+A+12}" text-anchor="start" style="font-size: 8px; fill: var(--text-muted)">${new Date(p[0].timestamp).toLocaleDateString(void 0,{month:"short",day:"numeric"})}</text>
          <text x="${k-$.right}" y="${$.top+A+12}" text-anchor="end" style="font-size: 8px; fill: var(--text-muted)">${new Date(p[p.length-1].timestamp).toLocaleDateString(void 0,{month:"short",day:"numeric"})}</text>
        `:v}
        <!-- Bars -->
        ${p.map((z,he)=>{const L=V[he],U=$.left+he*(oe+N),ce=L/K*A,de=$.top+A-ce,re=[new Date(z.timestamp).toLocaleDateString(void 0,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),`${B(L)} tokens`];E&&(re.push(`Output ${B(z.output)}`),re.push(`Input ${B(z.input)}`),re.push(`Cache write ${B(z.cacheWrite)}`),re.push(`Cache read ${B(z.cacheRead)}`));const R=re.join(" · ");if(!E)return J`<rect x="${U}" y="${de}" width="${oe}" height="${ce}" class="ts-bar" rx="1" style="cursor: pointer;"><title>${R}</title></rect>`;const P=[{value:z.output,class:"output"},{value:z.input,class:"input"},{value:z.cacheWrite,class:"cache-write"},{value:z.cacheRead,class:"cache-read"}];let D=$.top+A;return J`
            ${P.map(j=>{if(j.value<=0||L<=0)return v;const Ce=ce*(j.value/L);return D-=Ce,J`<rect x="${U}" y="${D}" width="${oe}" height="${Ce}" class="ts-bar ${j.class}" rx="1"><title>${R}</title></rect>`})}
          `})}
      </svg>
      <div class="timeseries-summary">${p.length} msgs · ${B(g)} · ${G(u)}</div>
      ${E?r`
              <div style="margin-top: 8px;">
                <div class="card-title" style="font-size: 12px; margin-bottom: 6px;">Tokens by Type</div>
                <div class="cost-breakdown-bar" style="height: 18px;">
                  <div class="cost-segment output" style="width: ${ve(h,M).toFixed(1)}%"></div>
                  <div class="cost-segment input" style="width: ${ve(f,M).toFixed(1)}%"></div>
                  <div class="cost-segment cache-write" style="width: ${ve(m,M).toFixed(1)}%"></div>
                  <div class="cost-segment cache-read" style="width: ${ve(d,M).toFixed(1)}%"></div>
                </div>
                <div class="cost-breakdown-legend">
                  <div class="legend-item" title="Assistant output tokens">
                    <span class="legend-dot output"></span>Output ${B(h)}
                  </div>
                  <div class="legend-item" title="User + tool input tokens">
                    <span class="legend-dot input"></span>Input ${B(f)}
                  </div>
                  <div class="legend-item" title="Tokens written to cache">
                    <span class="legend-dot cache-write"></span>Cache Write ${B(m)}
                  </div>
                  <div class="legend-item" title="Tokens read from cache">
                    <span class="legend-dot cache-read"></span>Cache Read ${B(d)}
                  </div>
                </div>
                <div class="cost-breakdown-total">Total: ${B(M)}</div>
              </div>
            `:v}
    </div>
  `}function E0(e,t,n,s){if(!e)return r`
      <div class="context-details-panel">
        <div class="muted" style="padding: 20px; text-align: center">No context data</div>
      </div>
    `;const i=ft(e.systemPrompt.chars),a=ft(e.skills.promptChars),o=ft(e.tools.listChars+e.tools.schemaChars),l=ft(e.injectedWorkspaceFiles.reduce((C,A)=>C+A.injectedChars,0)),c=i+a+o+l;let p="";if(t&&t.totalTokens>0){const C=t.input+t.cacheRead;C>0&&(p=`~${Math.min(c/C*100,100).toFixed(0)}% of input`)}const g=e.skills.entries.toSorted((C,A)=>A.blockChars-C.blockChars),u=e.tools.entries.toSorted((C,A)=>A.summaryChars+A.schemaChars-(C.summaryChars+C.schemaChars)),h=e.injectedWorkspaceFiles.toSorted((C,A)=>A.injectedChars-C.injectedChars),f=4,d=n,m=d?g:g.slice(0,f),k=d?u:u.slice(0,f),S=d?h:h.slice(0,f),$=g.length>f||u.length>f||h.length>f;return r`
    <div class="context-details-panel">
      <div class="context-breakdown-header">
        <div class="card-title" style="font-size: 13px;">System Prompt Breakdown</div>
        ${$?r`<button class="context-expand-btn" @click=${s}>
                ${d?"Collapse":"Expand all"}
              </button>`:v}
      </div>
      <p class="context-weight-desc">${p||"Base context per message"}</p>
      <div class="context-stacked-bar">
        <div class="context-segment system" style="width: ${ve(i,c).toFixed(1)}%" title="System: ~${B(i)}"></div>
        <div class="context-segment skills" style="width: ${ve(a,c).toFixed(1)}%" title="Skills: ~${B(a)}"></div>
        <div class="context-segment tools" style="width: ${ve(o,c).toFixed(1)}%" title="Tools: ~${B(o)}"></div>
        <div class="context-segment files" style="width: ${ve(l,c).toFixed(1)}%" title="Files: ~${B(l)}"></div>
      </div>
      <div class="context-legend">
        <span class="legend-item"><span class="legend-dot system"></span>Sys ~${B(i)}</span>
        <span class="legend-item"><span class="legend-dot skills"></span>Skills ~${B(a)}</span>
        <span class="legend-item"><span class="legend-dot tools"></span>Tools ~${B(o)}</span>
        <span class="legend-item"><span class="legend-dot files"></span>Files ~${B(l)}</span>
      </div>
      <div class="context-total">Total: ~${B(c)}</div>
      <div class="context-breakdown-grid">
        ${g.length>0?(()=>{const C=g.length-m.length;return r`
                  <div class="context-breakdown-card">
                    <div class="context-breakdown-title">Skills (${g.length})</div>
                    <div class="context-breakdown-list">
                      ${m.map(A=>r`
                          <div class="context-breakdown-item">
                            <span class="mono">${A.name}</span>
                            <span class="muted">~${B(ft(A.blockChars))}</span>
                          </div>
                        `)}
                    </div>
                    ${C>0?r`<div class="context-breakdown-more">+${C} more</div>`:v}
                  </div>
                `})():v}
        ${u.length>0?(()=>{const C=u.length-k.length;return r`
                  <div class="context-breakdown-card">
                    <div class="context-breakdown-title">Tools (${u.length})</div>
                    <div class="context-breakdown-list">
                      ${k.map(A=>r`
                          <div class="context-breakdown-item">
                            <span class="mono">${A.name}</span>
                            <span class="muted">~${B(ft(A.summaryChars+A.schemaChars))}</span>
                          </div>
                        `)}
                    </div>
                    ${C>0?r`<div class="context-breakdown-more">+${C} more</div>`:v}
                  </div>
                `})():v}
        ${h.length>0?(()=>{const C=h.length-S.length;return r`
                  <div class="context-breakdown-card">
                    <div class="context-breakdown-title">Files (${h.length})</div>
                    <div class="context-breakdown-list">
                      ${S.map(A=>r`
                          <div class="context-breakdown-item">
                            <span class="mono">${A.name}</span>
                            <span class="muted">~${B(ft(A.injectedChars))}</span>
                          </div>
                        `)}
                    </div>
                    ${C>0?r`<div class="context-breakdown-more">+${C} more</div>`:v}
                  </div>
                `})():v}
      </div>
    </div>
  `}function L0(e,t,n,s,i,a,o,l,c,p){if(t)return r`
      <div class="session-logs-compact">
        <div class="session-logs-header">Conversation</div>
        <div class="muted" style="padding: 20px; text-align: center">Loading...</div>
      </div>
    `;if(!e||e.length===0)return r`
      <div class="session-logs-compact">
        <div class="session-logs-header">Conversation</div>
        <div class="muted" style="padding: 20px; text-align: center">No messages</div>
      </div>
    `;const g=i.query.trim().toLowerCase(),u=e.map(S=>{const $=t0(S.content),C=$.cleanContent||S.content;return{log:S,toolInfo:$,cleanContent:C}}),h=Array.from(new Set(u.flatMap(S=>S.toolInfo.tools.map(([$])=>$)))).toSorted((S,$)=>S.localeCompare($)),f=u.filter(S=>!(i.roles.length>0&&!i.roles.includes(S.log.role)||i.hasTools&&S.toolInfo.tools.length===0||i.tools.length>0&&!S.toolInfo.tools.some(([C])=>i.tools.includes(C))||g&&!S.cleanContent.toLowerCase().includes(g))),d=i.roles.length>0||i.tools.length>0||i.hasTools||g?`${f.length} of ${e.length}`:`${e.length}`,m=new Set(i.roles),k=new Set(i.tools);return r`
    <div class="session-logs-compact">
      <div class="session-logs-header">
        <span>Conversation <span style="font-weight: normal; color: var(--text-muted);">(${d} messages)</span></span>
        <button class="btn btn-sm usage-action-btn usage-secondary-btn" @click=${s}>
          ${n?"Collapse All":"Expand All"}
        </button>
      </div>
      <div class="usage-filters-inline" style="margin: 10px 12px;">
        <select
          multiple
          size="4"
          @change=${S=>a(Array.from(S.target.selectedOptions).map($=>$.value))}
        >
          <option value="user" ?selected=${m.has("user")}>User</option>
          <option value="assistant" ?selected=${m.has("assistant")}>Assistant</option>
          <option value="tool" ?selected=${m.has("tool")}>Tool</option>
          <option value="toolResult" ?selected=${m.has("toolResult")}>Tool result</option>
        </select>
        <select
          multiple
          size="4"
          @change=${S=>o(Array.from(S.target.selectedOptions).map($=>$.value))}
        >
          ${h.map(S=>r`<option value=${S} ?selected=${k.has(S)}>${S}</option>`)}
        </select>
        <label class="usage-filters-inline" style="gap: 6px;">
          <input
            type="checkbox"
            .checked=${i.hasTools}
            @change=${S=>l(S.target.checked)}
          />
          Has tools
        </label>
        <input
          type="text"
          placeholder="Search conversation"
          .value=${i.query}
          @input=${S=>c(S.target.value)}
        />
        <button class="btn btn-sm usage-action-btn usage-secondary-btn" @click=${p}>
          Clear
        </button>
      </div>
      <div class="session-logs-list">
        ${f.map(S=>{const{log:$,toolInfo:C,cleanContent:A}=S,T=$.role==="user"?"user":"assistant",E=$.role==="user"?"You":$.role==="assistant"?"Assistant":"Tool";return r`
          <div class="session-log-entry ${T}">
            <div class="session-log-meta">
              <span class="session-log-role">${E}</span>
              <span>${new Date($.timestamp).toLocaleString()}</span>
              ${$.tokens?r`<span>${B($.tokens)}</span>`:v}
            </div>
            <div class="session-log-content">${A}</div>
            ${C.tools.length>0?r`
                    <details class="session-log-tools" ?open=${n}>
                      <summary>${C.summary}</summary>
                      <div class="session-log-tools-list">
                        ${C.tools.map(([M,V])=>r`
                            <span class="session-log-tools-pill">${M} × ${V}</span>
                          `)}
                      </div>
                    </details>
                  `:v}
          </div>
        `})}
        ${f.length===0?r`
                <div class="muted" style="padding: 12px">No messages match the filters.</div>
              `:v}
      </div>
    </div>
  `}function I0(e){if(e.loading&&!e.totals)return r`
      <style>
        @keyframes initial-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes initial-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      </style>
      <section class="card">
        <div class="row" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
          <div style="flex: 1; min-width: 250px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 2px;">
              <div class="card-title" style="margin: 0;">Token Usage</div>
              <span style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                background: rgba(255, 77, 77, 0.1);
                border-radius: 4px;
                font-size: 12px;
                color: #ff4d4d;
              ">
                <span style="
                  width: 10px;
                  height: 10px;
                  border: 2px solid #ff4d4d;
                  border-top-color: transparent;
                  border-radius: 50%;
                  animation: initial-spin 0.6s linear infinite;
                "></span>
                Loading
              </span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="date" .value=${e.startDate} disabled style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 13px; opacity: 0.6;" />
              <span style="color: var(--text-muted);">to</span>
              <input type="date" .value=${e.endDate} disabled style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 13px; opacity: 0.6;" />
            </div>
          </div>
        </div>
      </section>
    `;const t=e.chartMode==="tokens",n=e.query.trim().length>0,s=e.queryDraft.trim().length>0,i=[...e.sessions].toSorted((R,P)=>{const D=t?R.usage?.totalTokens??0:R.usage?.totalCost??0;return(t?P.usage?.totalTokens??0:P.usage?.totalCost??0)-D}),a=e.selectedDays.length>0?i.filter(R=>{if(R.usage?.activityDates?.length)return R.usage.activityDates.some(j=>e.selectedDays.includes(j));if(!R.updatedAt)return!1;const P=new Date(R.updatedAt),D=`${P.getFullYear()}-${String(P.getMonth()+1).padStart(2,"0")}-${String(P.getDate()).padStart(2,"0")}`;return e.selectedDays.includes(D)}):i,o=(R,P)=>{if(P.length===0)return!0;const D=R.usage,j=D?.firstActivity??R.updatedAt,Ce=D?.lastActivity??R.updatedAt;if(!j||!Ce)return!1;const X=Math.min(j,Ce),_e=Math.max(j,Ce);let ne=X;for(;ne<=_e;){const be=new Date(ne),je=za(be,e.timeZone);if(P.includes(je))return!0;const Ke=ja(be,e.timeZone);ne=Math.min(Ke.getTime(),_e)+1}return!1},l=e.selectedHours.length>0?a.filter(R=>o(R,e.selectedHours)):a,c=e0(l,e.query),p=c.sessions,g=c.warnings,u=m0(e.queryDraft,i,e.aggregates),h=Ha(e.query),f=R=>{const P=yt(R);return h.filter(D=>yt(D.key??"")===P).map(D=>D.value).filter(Boolean)},d=R=>{const P=new Set;for(const D of R)D&&P.add(D);return Array.from(P)},m=d(i.map(R=>R.agentId)).slice(0,12),k=d(i.map(R=>R.channel)).slice(0,12),S=d([...i.map(R=>R.modelProvider),...i.map(R=>R.providerOverride),...e.aggregates?.byProvider.map(R=>R.provider)??[]]).slice(0,12),$=d([...i.map(R=>R.model),...e.aggregates?.byModel.map(R=>R.model)??[]]).slice(0,12),C=d(e.aggregates?.tools.tools.map(R=>R.name)??[]).slice(0,12),A=e.selectedSessions.length===1?e.sessions.find(R=>R.key===e.selectedSessions[0])??p.find(R=>R.key===e.selectedSessions[0]):null,T=R=>R.reduce((P,D)=>(D.usage&&(P.input+=D.usage.input,P.output+=D.usage.output,P.cacheRead+=D.usage.cacheRead,P.cacheWrite+=D.usage.cacheWrite,P.totalTokens+=D.usage.totalTokens,P.totalCost+=D.usage.totalCost,P.inputCost+=D.usage.inputCost??0,P.outputCost+=D.usage.outputCost??0,P.cacheReadCost+=D.usage.cacheReadCost??0,P.cacheWriteCost+=D.usage.cacheWriteCost??0,P.missingCostEntries+=D.usage.missingCostEntries??0),P),{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,totalCost:0,inputCost:0,outputCost:0,cacheReadCost:0,cacheWriteCost:0,missingCostEntries:0}),E=R=>e.costDaily.filter(D=>R.includes(D.date)).reduce((D,j)=>(D.input+=j.input,D.output+=j.output,D.cacheRead+=j.cacheRead,D.cacheWrite+=j.cacheWrite,D.totalTokens+=j.totalTokens,D.totalCost+=j.totalCost,D.inputCost+=j.inputCost??0,D.outputCost+=j.outputCost??0,D.cacheReadCost+=j.cacheReadCost??0,D.cacheWriteCost+=j.cacheWriteCost??0,D),{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,totalCost:0,inputCost:0,outputCost:0,cacheReadCost:0,cacheWriteCost:0,missingCostEntries:0});let M,V;const K=i.length;if(e.selectedSessions.length>0){const R=p.filter(P=>e.selectedSessions.includes(P.key));M=T(R),V=R.length}else e.selectedDays.length>0&&e.selectedHours.length===0?(M=E(e.selectedDays),V=p.length):e.selectedHours.length>0||n?(M=T(p),V=p.length):(M=e.totals,V=K);const oe=e.selectedSessions.length>0?p.filter(R=>e.selectedSessions.includes(R.key)):n||e.selectedHours.length>0?p:e.selectedDays.length>0?a:i,N=p0(oe,e.aggregates),z=e.selectedSessions.length>0?(()=>{const R=p.filter(D=>e.selectedSessions.includes(D.key)),P=new Set;for(const D of R)for(const j of D.usage?.activityDates??[])P.add(j);return P.size>0?e.costDaily.filter(D=>P.has(D.date)):e.costDaily})():e.costDaily,he=g0(oe,M,N),L=!e.loading&&!e.totals&&e.sessions.length===0,U=(M?.missingCostEntries??0)>0||(M?M.totalTokens>0&&M.totalCost===0&&M.input+M.output+M.cacheRead+M.cacheWrite>0:!1),ce=[{label:"Today",days:1},{label:"7d",days:7},{label:"30d",days:30}],de=R=>{const P=new Date,D=new Date;D.setDate(D.getDate()-(R-1)),e.onStartDateChange(hi(D)),e.onEndDateChange(hi(P))},te=(R,P,D)=>{if(D.length===0)return v;const j=f(R),Ce=new Set(j.map(ne=>yt(ne))),X=D.length>0&&D.every(ne=>Ce.has(yt(ne))),_e=j.length;return r`
      <details
        class="usage-filter-select"
        @toggle=${ne=>{const be=ne.currentTarget;if(!be.open)return;const je=Ke=>{Ke.composedPath().includes(be)||(be.open=!1,window.removeEventListener("click",je,!0))};window.addEventListener("click",je,!0)}}
      >
        <summary>
          <span>${P}</span>
          ${_e>0?r`<span class="usage-filter-badge">${_e}</span>`:r`
                  <span class="usage-filter-badge">All</span>
                `}
        </summary>
        <div class="usage-filter-popover">
          <div class="usage-filter-actions">
            <button
              class="btn btn-sm"
              @click=${ne=>{ne.preventDefault(),ne.stopPropagation(),e.onQueryDraftChange(qr(e.queryDraft,R,D))}}
              ?disabled=${X}
            >
              Select All
            </button>
            <button
              class="btn btn-sm"
              @click=${ne=>{ne.preventDefault(),ne.stopPropagation(),e.onQueryDraftChange(qr(e.queryDraft,R,[]))}}
              ?disabled=${_e===0}
            >
              Clear
            </button>
          </div>
          <div class="usage-filter-options">
            ${D.map(ne=>{const be=Ce.has(yt(ne));return r`
                <label class="usage-filter-option">
                  <input
                    type="checkbox"
                    .checked=${be}
                    @change=${je=>{const Ke=je.target,ct=`${R}:${ne}`;e.onQueryDraftChange(Ke.checked?b0(e.queryDraft,ct):Wr(e.queryDraft,ct))}}
                  />
                  <span>${ne}</span>
                </label>
              `})}
          </div>
        </div>
      </details>
    `},re=hi(new Date);return r`
    <style>${n0}</style>

    <section class="usage-page-header">
      <div class="usage-page-title">Usage</div>
      <div class="usage-page-subtitle">See where tokens go, when sessions spike, and what drives cost.</div>
    </section>

    <section class="card usage-header ${e.headerPinned?"pinned":""}">
      <div class="usage-header-row">
        <div class="usage-header-title">
          <div class="card-title" style="margin: 0;">Filters</div>
          ${e.loading?r`
                  <span class="usage-refresh-indicator">Loading</span>
                `:v}
          ${L?r`
                  <span class="usage-query-hint">Select a date range and click Refresh to load usage.</span>
                `:v}
        </div>
        <div class="usage-header-metrics">
          ${M?r`
                <span class="usage-metric-badge">
                  <strong>${B(M.totalTokens)}</strong> tokens
                </span>
                <span class="usage-metric-badge">
                  <strong>${G(M.totalCost)}</strong> cost
                </span>
                <span class="usage-metric-badge">
                  <strong>${V}</strong>
                  session${V!==1?"s":""}
                </span>
              `:v}
          <button
            class="usage-pin-btn ${e.headerPinned?"active":""}"
            title=${e.headerPinned?"Unpin filters":"Pin filters"}
            @click=${e.onToggleHeaderPinned}
          >
            ${e.headerPinned?"Pinned":"Pin"}
          </button>
          <details
            class="usage-export-menu"
            @toggle=${R=>{const P=R.currentTarget;if(!P.open)return;const D=j=>{j.composedPath().includes(P)||(P.open=!1,window.removeEventListener("click",D,!0))};window.addEventListener("click",D,!0)}}
          >
            <summary class="usage-export-button">Export ▾</summary>
            <div class="usage-export-popover">
              <div class="usage-export-list">
                <button
                  class="usage-export-item"
                  @click=${()=>fi(`winclaw-usage-sessions-${re}.csv`,h0(p),"text/csv")}
                  ?disabled=${p.length===0}
                >
                  Sessions CSV
                </button>
                <button
                  class="usage-export-item"
                  @click=${()=>fi(`winclaw-usage-daily-${re}.csv`,f0(z),"text/csv")}
                  ?disabled=${z.length===0}
                >
                  Daily CSV
                </button>
                <button
                  class="usage-export-item"
                  @click=${()=>fi(`winclaw-usage-${re}.json`,JSON.stringify({totals:M,sessions:p,daily:z,aggregates:N},null,2),"application/json")}
                  ?disabled=${p.length===0&&z.length===0}
                >
                  JSON
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
      <div class="usage-header-row">
        <div class="usage-controls">
          ${x0(e.selectedDays,e.selectedHours,e.selectedSessions,e.sessions,e.onClearDays,e.onClearHours,e.onClearSessions,e.onClearFilters)}
          <div class="usage-presets">
            ${ce.map(R=>r`
                <button class="btn btn-sm" @click=${()=>de(R.days)}>
                  ${R.label}
                </button>
              `)}
          </div>
          <input
            type="date"
            .value=${e.startDate}
            title="Start Date"
            @change=${R=>e.onStartDateChange(R.target.value)}
          />
          <span style="color: var(--text-muted);">to</span>
          <input
            type="date"
            .value=${e.endDate}
            title="End Date"
            @change=${R=>e.onEndDateChange(R.target.value)}
          />
          <select
            title="Time zone"
            .value=${e.timeZone}
            @change=${R=>e.onTimeZoneChange(R.target.value)}
          >
            <option value="local">Local</option>
            <option value="utc">UTC</option>
          </select>
          <div class="chart-toggle">
            <button
              class="toggle-btn ${t?"active":""}"
              @click=${()=>e.onChartModeChange("tokens")}
            >
              Tokens
            </button>
            <button
              class="toggle-btn ${t?"":"active"}"
              @click=${()=>e.onChartModeChange("cost")}
            >
              Cost
            </button>
          </div>
          <button
            class="btn btn-sm usage-action-btn usage-primary-btn"
            @click=${e.onRefresh}
            ?disabled=${e.loading}
          >
            Refresh
          </button>
        </div>
        
      </div>

      <div style="margin-top: 12px;">
          <div class="usage-query-bar">
          <input
            class="usage-query-input"
            type="text"
            .value=${e.queryDraft}
            placeholder="Filter sessions (e.g. key:agent:main:cron* model:gpt-4o has:errors minTokens:2000)"
            @input=${R=>e.onQueryDraftChange(R.target.value)}
            @keydown=${R=>{R.key==="Enter"&&(R.preventDefault(),e.onApplyQuery())}}
          />
          <div class="usage-query-actions">
            <button
              class="btn btn-sm usage-action-btn usage-secondary-btn"
              @click=${e.onApplyQuery}
              ?disabled=${e.loading||!s&&!n}
            >
              Filter (client-side)
            </button>
            ${s||n?r`<button class="btn btn-sm usage-action-btn usage-secondary-btn" @click=${e.onClearQuery}>Clear</button>`:v}
            <span class="usage-query-hint">
              ${n?`${p.length} of ${K} sessions match`:`${K} sessions in range`}
            </span>
          </div>
        </div>
        <div class="usage-filter-row">
          ${te("agent","Agent",m)}
          ${te("channel","Channel",k)}
          ${te("provider","Provider",S)}
          ${te("model","Model",$)}
          ${te("tool","Tool",C)}
          <span class="usage-query-hint">
            Tip: use filters or click bars to filter days.
          </span>
        </div>
        ${h.length>0?r`
                <div class="usage-query-chips">
                  ${h.map(R=>{const P=R.raw;return r`
                      <span class="usage-query-chip">
                        ${P}
                        <button
                          title="Remove filter"
                          @click=${()=>e.onQueryDraftChange(Wr(e.queryDraft,P))}
                        >
                          ×
                        </button>
                      </span>
                    `})}
                </div>
              `:v}
        ${u.length>0?r`
                <div class="usage-query-suggestions">
                  ${u.map(R=>r`
                      <button
                        class="usage-query-suggestion"
                        @click=${()=>e.onQueryDraftChange(v0(e.queryDraft,R.value))}
                      >
                        ${R.label}
                      </button>
                    `)}
                </div>
              `:v}
        ${g.length>0?r`
                <div class="callout warning" style="margin-top: 8px;">
                  ${g.join(" · ")}
                </div>
              `:v}
      </div>

      ${e.error?r`<div class="callout danger" style="margin-top: 12px;">${e.error}</div>`:v}

      ${e.sessionsLimitReached?r`
              <div class="callout warning" style="margin-top: 12px">
                Showing first 1,000 sessions. Narrow date range for complete results.
              </div>
            `:v}
    </section>

    ${k0(M,N,he,U,a0(oe,e.timeZone),V,K)}

    ${c0(oe,e.timeZone,e.selectedHours,e.onSelectHour)}

    <!-- Two-column layout: Daily+Breakdown on left, Sessions on right -->
    <div class="usage-grid">
      <div class="usage-grid-left">
        <div class="card usage-left-card">
          ${w0(z,e.selectedDays,e.chartMode,e.dailyChartMode,e.onDailyChartModeChange,e.onSelectDay)}
          ${M?$0(M,e.chartMode):v}
        </div>
      </div>
      <div class="usage-grid-right">
        ${S0(p,e.selectedSessions,e.selectedDays,t,e.sessionSort,e.sessionSortDir,e.recentSessions,e.sessionsTab,e.onSelectSession,e.onSessionSortChange,e.onSessionSortDirChange,e.onSessionsTabChange,e.visibleColumns,K,e.onClearSessions)}
      </div>
    </div>

    <!-- Session Detail Panel (when selected) or Empty State -->
    ${A?T0(A,e.timeSeries,e.timeSeriesLoading,e.timeSeriesMode,e.onTimeSeriesModeChange,e.timeSeriesBreakdownMode,e.onTimeSeriesBreakdownChange,e.startDate,e.endDate,e.selectedDays,e.sessionLogs,e.sessionLogsLoading,e.sessionLogsExpanded,e.onToggleSessionLogsExpanded,{roles:e.logFilterRoles,tools:e.logFilterTools,hasTools:e.logFilterHasTools,query:e.logFilterQuery},e.onLogFilterRolesChange,e.onLogFilterToolsChange,e.onLogFilterHasToolsChange,e.onLogFilterQueryChange,e.onLogFilterClear,e.contextExpanded,e.onToggleContextExpanded,e.onClearSessions):A0()}
  `}let mi=null;const Qr=e=>{mi&&clearTimeout(mi),mi=window.setTimeout(()=>{lc(e)},400)},M0=/^data:/i,R0=/^https?:\/\//i;let Yr=!1;function P0(e){Yr||(Yr=!0,window.addEventListener("dh-ui-action",t=>{const n=t.detail;if(!n||typeof n.target!="string")return;const{target:s,action:i,name:a}=n,o=i==="hide"||i==="close"||i==="off",l=i==="show"||i==="open"||i==="on";switch(s){case"mic":{D0(e,o?!1:l?!0:void 0);break}case"camera":{F0(e,o?!1:l?!0:void 0);break}case"avatar":{N0(e,o?!1:l?!0:void 0);break}case"subtitle":{e.dhSubtitleVisible=o?!1:l?!0:!(e.dhSubtitleVisible??!0);break}case"voice":{a&&B0(e,a);break}case"task_continue":{a&&window.dispatchEvent(new CustomEvent("dh-ui-task-continue",{detail:{payload:a}}));break}case"task_artifact":{a&&window.dispatchEvent(new CustomEvent("dh-ui-task-artifact",{detail:{payload:a}}));break}case"music":{window.dispatchEvent(new CustomEvent("dh-ui-music",{detail:{action:i,payload:a}}));break}case"artifact":case"task_panel":case"controls":case"fullscreen":break;default:console.debug("[dh-ui-action] Unknown target:",s);break}}))}function D0(e,t){const n=e.dhMicEnabled??!1;if(t!==void 0&&t===n)return;const s=!n;e.dhMicEnabled=s;try{const a=window.__dhController;if(a){for(const o of Object.values(a))if(o&&typeof o=="object"&&"setMuted"in o){o.setMuted(!s);break}}}catch(i){console.error("[Mic] Voice-action toggle error:",i)}}function F0(e,t){const n=e.dhCameraEnabled??!1;if(!(t!==void 0&&t===n))try{const i=window.__dhController;if(!i||typeof i.toggleCamera!="function"){console.warn("[Camera] Controller not ready — start a DH session first");return}e.dhCameraEnabled=i.toggleCamera()}catch(s){console.error("[Camera] Voice-action toggle failed:",s),e.dhCameraEnabled=!1}}function N0(e,t){const n=e.dhAvatarActive??!1;if(t!==void 0&&t===n)return;const i=window.__dhController;if(!i||typeof i.toggleAvatar!="function"){console.warn("[Avatar] Controller not ready — Qwen セッション未接続");return}e.dhAvatarActive=i.toggleAvatar()}const O0=[{id:"Cherry",alias:/cherry|年轻|年輕|活泼|活潑/i},{id:"Chelsie",alias:/chelsie|明亮/i},{id:"Bella",alias:/bella/i},{id:"Aria",alias:/aria/i},{id:"Serena",alias:/serena|温柔|溫柔|温暖|溫暖|默认|默認|女声|女聲|女性|female/i},{id:"River",alias:/river|浑厚|渾厚/i},{id:"Cove",alias:/cove|冷静|冷靜/i},{id:"Daniel",alias:/daniel/i},{id:"Frank",alias:/frank|低沉/i},{id:"Ethan",alias:/ethan|沉稳|沉穩|男声|男聲|男性|male/i}];function B0(e,t){const n=O0.find(i=>i.alias.test(t));if(!n){console.debug("[Voice] no voice matched for:",t);return}e.dhSelectedVoice=n.id,window.__dhSelectedVoice=n.id;const s=window.__dhController;s&&typeof s.setVoice=="function"&&s.setVoice(n.id),console.info("[Voice] Voice-action set voice:",n.id)}async function jn(e){const s=`agent:${ea(e.sessionKey)?.agentId??"main"}:${$s()}`;e.addChatSession(s),e.chatMessages=[],e.chatToolMessages=[],e.chatStream=null,e.chatStreamStartedAt=null,e.chatRunId=null,e.chatQueue=[],e.chatMessage="",e.chatAttachments=[],e.resetToolStream(),e.resetChatScroll(),e.sessionKey=s,e.applySettings({...e.settings,sessionKey:s,lastActiveSessionKey:s,openChatSessions:e.openChatSessions}),e.loadAssistantIdentity(),await at(e),Et(e)}function Wc(e){const t=e.agentsList?.agents??[],s=ea(e.sessionKey)?.agentId??e.agentsList?.defaultId??"main",a=t.find(l=>l.id===s)?.identity,o=a?.avatarUrl??a?.avatar;if(o)return M0.test(o)||R0.test(o)?o:a?.avatarUrl}function U0(e,t){const n=Wc(e),s=e.chatAvatarUrl??n??null,i=e.connected?null:"Disconnected from gateway.",a=e.onboarding?!1:e.settings.chatShowThinking;return{layoutMode:e.dhLayoutMode??"split",orientation:window.innerWidth>=768?"landscape":"portrait",assistantName:e.assistantName??"WinClaw",dhOnline:e.dhConnectionStatus==="connected",basePath:e.basePath??"",aimetaToken:e.settings.aimetaToken||null,aimetaApi:e.settings.aimetaApi||null,onSetLayoutMode:o=>{e.dhLayoutMode=o},onOpenSettings:()=>e.openTabFromPalette("config"),onToggleTheme:()=>{const o=e.themeResolved==="dark"?"light":"dark";e.setTheme(o)},dhPanel:{isConnected:e.dhConnectionStatus==="connected",connectionStatus:e.dhConnectionStatus??"disconnected",errorMessage:e.dhErrorMessage??null,micEnabled:e.dhMicEnabled??!1,cameraEnabled:e.dhCameraEnabled??!1,subtitleVisible:e.dhSubtitleVisible??!0,isThinking:e.dhIsThinking??!1,currentSubtitle:e.dhCurrentSubtitle??"",onStart:()=>{if(e.dhConnectionStatus==="connecting"||e.dhConnectionStatus==="connected")return;e.dhConnectionStatus="connecting",e.dhErrorMessage=null;const o=e.settings?.token??"";fetch("/api/dh/health",{headers:o?{Authorization:`Bearer ${o}`}:{}}).then(async l=>{if(!l.ok)throw new Error(`DH health check failed: ${l.status} ${l.statusText}`);const p=(await l.json()).wsPort;if(!p)throw new Error("DH health response missing wsPort");const g=new Mi({onConnectionStatusChange:f=>{e.dhConnectionStatus=f,f==="disconnected"&&(e.dhCurrentSubtitle="")},onSubtitleUpdate:(f,d)=>{d?e.dhCurrentSubtitle=(e.dhCurrentSubtitle??"")+f:e.dhCurrentSubtitle=f},onErrorMessage:f=>{e.dhErrorMessage=f},onUserTranscript:f=>{},onThinkingChange:f=>{e.dhIsThinking=f},onAvatarActiveChange:f=>{e.dhAvatarActive=f}});e.dhController=g,window.__dhController=g,console.log("[DH] Controller stored on window, starting session..."),await g.start(p,o),console.log("[DH] Session started, recorder:",!!g.recorder);const h=window.__dhCameraStream;h&&h.active&&e.dhCameraEnabled&&setTimeout(()=>{const f=document.getElementById("camera-preview");f&&!f.srcObject&&(f.srcObject=h)},200)}).catch(l=>{console.error("[DH] Session start failed:",l),e.dhConnectionStatus="error",e.dhErrorMessage=l instanceof Error?l.message:"Failed to start DH session",e.dhController=void 0,window.__dhController=null})},onStop:()=>{const o=e.dhController;e.dhCurrentSubtitle="",o?o.stop():e.dhConnectionStatus="disconnected"},avatarActive:e.dhAvatarActive??!1,onToggleAvatar:()=>{const l=window.__dhController;if(!l||typeof l.toggleAvatar!="function"){console.warn("[Avatar] Controller not ready — Qwen セッション未接続");return}e.dhAvatarActive=l.toggleAvatar()},onToggleMic:()=>{const o=!(e.dhMicEnabled??!1);e.dhMicEnabled=o;try{const c=window.__dhController;if(c){for(const p of Object.values(c))if(p&&typeof p=="object"&&"setMuted"in p){p.setMuted(!o);break}}}catch(l){console.error("[Mic] Toggle error:",l)}},onToggleCamera:()=>{try{const l=window.__dhController;if(!l||typeof l.toggleCamera!="function"){console.warn("[Camera] Controller not ready — start a DH session first");return}const c=l.toggleCamera();e.dhCameraEnabled=c,console.log(`[Camera] Toggled via controller → enabled=${c}`)}catch(o){console.error("[Camera] Toggle failed:",o),e.dhCameraEnabled=!1}},onToggleSubtitle:()=>{e.dhSubtitleVisible=!(e.dhSubtitleVisible??!0)},onVideoDoubleClick:async()=>{if(document.fullscreenElement)await document.exitFullscreen();else{const o=document.querySelector(".panel-dh");o&&await o.requestFullscreen()}},selectedVoice:e.dhSelectedVoice??uh,onVoiceChange:o=>{e.dhSelectedVoice=o,window.__dhSelectedVoice=o;const l=window.__dhController;l&&typeof l.setVoice=="function"?l.setVoice(o):console.warn("[Voice] Controller not ready — start a DH session first")}},chatPanel:{sessionKey:e.sessionKey,onSessionKeyChange:o=>{e.sessionKey=o,e.chatMessage="",e.chatAttachments=[],e.chatStream=null,e.chatStreamStartedAt=null,e.chatRunId=null,e.chatQueue=[],e.resetToolStream(),e.resetChatScroll(),e.applySettings({...e.settings,sessionKey:o,lastActiveSessionKey:o}),e.loadAssistantIdentity(),at(e),Et(e)},thinkingLevel:e.chatThinkingLevel,showThinking:a,loading:e.chatLoading,sending:e.chatSending,canAbort:!!e.chatRunId,compactionStatus:e.compactionStatus,assistantAvatarUrl:s,messages:e.chatMessages,toolMessages:e.chatToolMessages,stream:e.chatStream,streamStartedAt:e.chatStreamStartedAt,draft:e.chatMessage,queue:e.chatQueue,connected:e.connected,canSend:e.connected,disabledReason:i,error:e.lastError,sessions:e.sessionsResult,focusMode:!1,sidebarOpen:e.sidebarOpen,sidebarContent:e.sidebarContent,sidebarError:e.sidebarError,sidebarMode:e.sidebarMode,splitRatio:e.splitRatio,execLogEntries:e.execLogEntries,execLogActive:e.execLogActive,execLogAutoScroll:e.execLogAutoScroll,assistantName:e.assistantName,assistantAvatar:e.assistantAvatar,attachments:e.chatAttachments,onAttachmentsChange:o=>e.chatAttachments=o,showNewMessages:e.chatNewMessagesBelow&&!e.chatManualRefreshInFlight,onScrollToBottom:()=>e.scrollToBottom(),onRefresh:()=>(e.resetToolStream(),Promise.all([at(e),Et(e)])),onToggleFocusMode:()=>{},onChatScroll:o=>e.handleChatScroll(o),onDraftChange:o=>e.chatMessage=o,onSend:()=>e.handleSendChat(),onAbort:()=>{e.handleAbortChat()},onQueueRemove:o=>e.removeQueuedMessage(o),onNewSession:t,onOpenSidebar:o=>e.handleOpenSidebar(o),onCloseSidebar:()=>e.handleCloseSidebar(),onSplitRatioChange:o=>e.handleSplitRatioChange(o),onOpenExecLog:()=>e.handleOpenExecLog(),onCloseExecLog:()=>e.handleCloseExecLog(),onClearExecLog:()=>e.handleClearExecLog(),onToggleExecLogAutoScroll:()=>e.handleToggleExecLogAutoScroll()}}}function H0(e){const t=e.sessionsResult?.sessions;if(!t)return;const n=t.find(s=>s.key===e.sessionKey);return n?.derivedTitle||n?.displayName||n?.label||void 0}function z0(e,t){const n=e.dhConnectionStatus??"disconnected";return!e.dhAutoStartAttempted&&!e.dhController&&n==="disconnected"&&(e.dhAutoStartAttempted=!0,queueMicrotask(()=>{try{t.dhPanel.onStart()}catch{}})),t}function j0(e){P0(e);const t=e.presenceEntries.length,n=e.sessionsResult?.count??null,s=e.cronStatus?.nextWakeAtMs??null,i=e.connected?null:"Disconnected from gateway.",a=e.tab==="chat",o=e.tab==="digital-human",l=a&&(e.settings.chatFocusMode||e.onboarding),c=e.onboarding?!1:e.settings.chatShowThinking,p=Wc(e),g=e.chatAvatarUrl??p??null,u=e.configForm??e.configSnapshot?.config,h=wn(e.basePath??""),f=e.agentsSelectedId??e.agentsList?.defaultId??e.agentsList?.agents?.[0]?.id??null;return r`
    <div class="shell ${a?"shell--chat":""} ${o?"shell--dh":""} ${e.onboarding?"shell--onboarding":""}">
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand">
            <div class="brand-logo">
              <img src=${h?`${h}/favicon.svg`:"/favicon.svg"} alt="WinClaw" />
            </div>
            <div class="brand-title">WinClaw</div>
          </div>
        </div>
        <div class="topbar-center">
          <span class="statusDot ${e.connected?"ok":""}"></span>
          <span>${e.connected?"Connected":"Disconnected"}</span>
        </div>
        <div class="topbar-right">
          ${Py({className:"topbar-lang"})}
          <button class="topbar-cmd-btn" @click=${()=>e.toggleCommandPalette()} title="Command Palette (Ctrl+K)">
            Ctrl+K
          </button>
          <button class="topbar-add-btn" @click=${()=>e.toggleCommandPalette()} title="Open command palette">
            +
          </button>
        </div>
      </header>
      <main class="content ${a?"content--chat":""}">
        ${qg({activeTab:e.tab,openTabs:e.openTabs,chatSessionTitle:H0(e),onTabSelect:d=>e.openTabFromPalette(d),onTabClose:d=>e.closeTab(d),onAddTab:()=>e.toggleCommandPalette()})}
        ${a?v:r`
              <section class="content-header">
                <div>
                  ${e.tab==="usage"?v:r`<div class="page-title">${Ci(e.tab)}</div>`}
                  ${e.tab==="usage"?v:r`<div class="page-sub">${mp(e.tab)}</div>`}
                </div>
                <div class="page-meta">
                  ${e.lastError?r`<div class="pill danger">${e.lastError}</div>`:v}
                </div>
              </section>
            `}

        ${e.tab==="overview"?Zb({connected:e.connected,hello:e.hello,settings:e.settings,password:e.password,lastError:e.lastError,presenceCount:t,sessionsCount:n,cronEnabled:e.cronStatus?.enabled??null,cronNext:s,lastChannelsRefresh:e.channelsLastSuccess,onSettingsChange:d=>e.applySettings(d),onPasswordChange:d=>e.password=d,onSessionKeyChange:d=>{e.sessionKey=d,e.chatMessage="",e.resetToolStream(),e.applySettings({...e.settings,sessionKey:d,lastActiveSessionKey:d}),e.loadAssistantIdentity()},onConnect:()=>e.connect(),onRefresh:()=>e.loadOverview()}):v}

        ${e.tab==="channels"?Of({connected:e.connected,loading:e.channelsLoading,snapshot:e.channelsSnapshot,lastError:e.channelsError,lastSuccessAt:e.channelsLastSuccess,whatsappMessage:e.whatsappLoginMessage,whatsappQrDataUrl:e.whatsappLoginQrDataUrl,whatsappConnected:e.whatsappLoginConnected,whatsappBusy:e.whatsappBusy,configSchema:e.configSchema,configSchemaLoading:e.configSchemaLoading,configForm:e.configForm,configUiHints:e.configUiHints,configSaving:e.configSaving,configFormDirty:e.configFormDirty,nostrProfileFormState:e.nostrProfileFormState,nostrProfileAccountId:e.nostrProfileAccountId,onRefresh:d=>$e(e,d),onWhatsAppStart:d=>e.handleWhatsAppStart(d),onWhatsAppWait:()=>e.handleWhatsAppWait(),onWhatsAppLogout:()=>e.handleWhatsAppLogout(),onConfigPatch:(d,m)=>Te(e,d,m),onConfigSave:()=>e.handleChannelConfigSave(),onConfigReload:()=>e.handleChannelConfigReload(),onNostrProfileEdit:(d,m)=>e.handleNostrProfileEdit(d,m),onNostrProfileCancel:()=>e.handleNostrProfileCancel(),onNostrProfileFieldChange:(d,m)=>e.handleNostrProfileFieldChange(d,m),onNostrProfileSave:()=>e.handleNostrProfileSave(),onNostrProfileImport:()=>e.handleNostrProfileImport(),onNostrProfileToggleAdvanced:()=>e.handleNostrProfileToggleAdvanced()}):v}

        ${e.tab==="instances"?$b({loading:e.presenceLoading,entries:e.presenceEntries,lastError:e.presenceError,statusMessage:e.presenceStatus,onRefresh:()=>va(e)}):v}

        ${e.tab==="sessions"?Ky({loading:e.sessionsLoading,result:e.sessionsResult,error:e.sessionsError,activeMinutes:e.sessionsFilterActive,limit:e.sessionsFilterLimit,includeGlobal:e.sessionsIncludeGlobal,includeUnknown:e.sessionsIncludeUnknown,basePath:e.basePath,onFiltersChange:d=>{e.sessionsFilterActive=d.activeMinutes,e.sessionsFilterLimit=d.limit,e.sessionsIncludeGlobal=d.includeGlobal,e.sessionsIncludeUnknown=d.includeUnknown},onRefresh:()=>lt(e),onPatch:(d,m)=>ba(e,d,m),onDelete:d=>cp(e,d)}):v}

        ${e.tab==="usage"?I0({loading:e.usageLoading,error:e.usageError,startDate:e.usageStartDate,endDate:e.usageEndDate,sessions:e.usageResult?.sessions??[],sessionsLimitReached:(e.usageResult?.sessions?.length??0)>=1e3,totals:e.usageResult?.totals??null,aggregates:e.usageResult?.aggregates??null,costDaily:e.usageCostSummary?.daily??[],selectedSessions:e.usageSelectedSessions,selectedDays:e.usageSelectedDays,selectedHours:e.usageSelectedHours,chartMode:e.usageChartMode,dailyChartMode:e.usageDailyChartMode,timeSeriesMode:e.usageTimeSeriesMode,timeSeriesBreakdownMode:e.usageTimeSeriesBreakdownMode,timeSeries:e.usageTimeSeries,timeSeriesLoading:e.usageTimeSeriesLoading,sessionLogs:e.usageSessionLogs,sessionLogsLoading:e.usageSessionLogsLoading,sessionLogsExpanded:e.usageSessionLogsExpanded,logFilterRoles:e.usageLogFilterRoles,logFilterTools:e.usageLogFilterTools,logFilterHasTools:e.usageLogFilterHasTools,logFilterQuery:e.usageLogFilterQuery,query:e.usageQuery,queryDraft:e.usageQueryDraft,sessionSort:e.usageSessionSort,sessionSortDir:e.usageSessionSortDir,recentSessions:e.usageRecentSessions,sessionsTab:e.usageSessionsTab,visibleColumns:e.usageVisibleColumns,timeZone:e.usageTimeZone,contextExpanded:e.usageContextExpanded,headerPinned:e.usageHeaderPinned,onStartDateChange:d=>{e.usageStartDate=d,e.usageSelectedDays=[],e.usageSelectedHours=[],e.usageSelectedSessions=[],Qr(e)},onEndDateChange:d=>{e.usageEndDate=d,e.usageSelectedDays=[],e.usageSelectedHours=[],e.usageSelectedSessions=[],Qr(e)},onRefresh:()=>lc(e),onTimeZoneChange:d=>{e.usageTimeZone=d},onToggleContextExpanded:()=>{e.usageContextExpanded=!e.usageContextExpanded},onToggleSessionLogsExpanded:()=>{e.usageSessionLogsExpanded=!e.usageSessionLogsExpanded},onLogFilterRolesChange:d=>{e.usageLogFilterRoles=d},onLogFilterToolsChange:d=>{e.usageLogFilterTools=d},onLogFilterHasToolsChange:d=>{e.usageLogFilterHasTools=d},onLogFilterQueryChange:d=>{e.usageLogFilterQuery=d},onLogFilterClear:()=>{e.usageLogFilterRoles=[],e.usageLogFilterTools=[],e.usageLogFilterHasTools=!1,e.usageLogFilterQuery=""},onToggleHeaderPinned:()=>{e.usageHeaderPinned=!e.usageHeaderPinned},onSelectHour:(d,m)=>{if(m&&e.usageSelectedHours.length>0){const k=Array.from({length:24},(A,T)=>T),S=e.usageSelectedHours[e.usageSelectedHours.length-1],$=k.indexOf(S),C=k.indexOf(d);if($!==-1&&C!==-1){const[A,T]=$<C?[$,C]:[C,$],E=k.slice(A,T+1);e.usageSelectedHours=[...new Set([...e.usageSelectedHours,...E])]}}else e.usageSelectedHours.includes(d)?e.usageSelectedHours=e.usageSelectedHours.filter(k=>k!==d):e.usageSelectedHours=[...e.usageSelectedHours,d]},onQueryDraftChange:d=>{e.usageQueryDraft=d,e.usageQueryDebounceTimer&&window.clearTimeout(e.usageQueryDebounceTimer),e.usageQueryDebounceTimer=window.setTimeout(()=>{e.usageQuery=e.usageQueryDraft,e.usageQueryDebounceTimer=null},250)},onApplyQuery:()=>{e.usageQueryDebounceTimer&&(window.clearTimeout(e.usageQueryDebounceTimer),e.usageQueryDebounceTimer=null),e.usageQuery=e.usageQueryDraft},onClearQuery:()=>{e.usageQueryDebounceTimer&&(window.clearTimeout(e.usageQueryDebounceTimer),e.usageQueryDebounceTimer=null),e.usageQueryDraft="",e.usageQuery=""},onSessionSortChange:d=>{e.usageSessionSort=d},onSessionSortDirChange:d=>{e.usageSessionSortDir=d},onSessionsTabChange:d=>{e.usageSessionsTab=d},onToggleColumn:d=>{e.usageVisibleColumns.includes(d)?e.usageVisibleColumns=e.usageVisibleColumns.filter(m=>m!==d):e.usageVisibleColumns=[...e.usageVisibleColumns,d]},onSelectSession:(d,m)=>{if(e.usageTimeSeries=null,e.usageSessionLogs=null,e.usageRecentSessions=[d,...e.usageRecentSessions.filter(k=>k!==d)].slice(0,8),m&&e.usageSelectedSessions.length>0){const k=e.usageChartMode==="tokens",$=[...e.usageResult?.sessions??[]].toSorted((E,M)=>{const V=k?E.usage?.totalTokens??0:E.usage?.totalCost??0;return(k?M.usage?.totalTokens??0:M.usage?.totalCost??0)-V}).map(E=>E.key),C=e.usageSelectedSessions[e.usageSelectedSessions.length-1],A=$.indexOf(C),T=$.indexOf(d);if(A!==-1&&T!==-1){const[E,M]=A<T?[A,T]:[T,A],V=$.slice(E,M+1),K=[...new Set([...e.usageSelectedSessions,...V])];e.usageSelectedSessions=K}}else e.usageSelectedSessions.length===1&&e.usageSelectedSessions[0]===d?e.usageSelectedSessions=[]:e.usageSelectedSessions=[d];e.usageSelectedSessions.length===1&&(Yg(e,e.usageSelectedSessions[0]),Jg(e,e.usageSelectedSessions[0]))},onSelectDay:(d,m)=>{if(m&&e.usageSelectedDays.length>0){const k=(e.usageCostSummary?.daily??[]).map(A=>A.date),S=e.usageSelectedDays[e.usageSelectedDays.length-1],$=k.indexOf(S),C=k.indexOf(d);if($!==-1&&C!==-1){const[A,T]=$<C?[$,C]:[C,$],E=k.slice(A,T+1),M=[...new Set([...e.usageSelectedDays,...E])];e.usageSelectedDays=M}}else e.usageSelectedDays.includes(d)?e.usageSelectedDays=e.usageSelectedDays.filter(k=>k!==d):e.usageSelectedDays=[d]},onChartModeChange:d=>{e.usageChartMode=d},onDailyChartModeChange:d=>{e.usageDailyChartMode=d},onTimeSeriesModeChange:d=>{e.usageTimeSeriesMode=d},onTimeSeriesBreakdownChange:d=>{e.usageTimeSeriesBreakdownMode=d},onClearDays:()=>{e.usageSelectedDays=[]},onClearHours:()=>{e.usageSelectedHours=[]},onClearSessions:()=>{e.usageSelectedSessions=[],e.usageTimeSeries=null,e.usageSessionLogs=null},onClearFilters:()=>{e.usageSelectedDays=[],e.usageSelectedHours=[],e.usageSelectedSessions=[],e.usageTimeSeries=null,e.usageSessionLogs=null}}):v}

        ${e.tab==="cron"?pb({basePath:e.basePath,loading:e.cronLoading,status:e.cronStatus,jobs:e.cronJobs,error:e.cronError,busy:e.cronBusy,form:e.cronForm,channels:e.channelsSnapshot?.channelMeta?.length?e.channelsSnapshot.channelMeta.map(d=>d.id):e.channelsSnapshot?.channelOrder??[],channelLabels:e.channelsSnapshot?.channelLabels??{},channelMeta:e.channelsSnapshot?.channelMeta??[],runsJobId:e.cronRunsJobId,runs:e.cronRuns,onFormChange:d=>e.cronForm={...e.cronForm,...d},onRefresh:()=>e.loadCron(),onAdd:()=>xu(e),onToggle:(d,m)=>wu(e,d,m),onRun:d=>$u(e,d),onRemove:d=>ku(e,d),onLoadRuns:d=>vl(e,d)}):v}

        ${e.tab==="agents"?jh({loading:e.agentsLoading,error:e.agentsError,agentsList:e.agentsList,selectedAgentId:f,activePanel:e.agentsPanel,configForm:u,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configFormDirty,channelsLoading:e.channelsLoading,channelsError:e.channelsError,channelsSnapshot:e.channelsSnapshot,channelsLastSuccess:e.channelsLastSuccess,cronLoading:e.cronLoading,cronStatus:e.cronStatus,cronJobs:e.cronJobs,cronError:e.cronError,agentFilesLoading:e.agentFilesLoading,agentFilesError:e.agentFilesError,agentFilesList:e.agentFilesList,agentFileActive:e.agentFileActive,agentFileContents:e.agentFileContents,agentFileDrafts:e.agentFileDrafts,agentFileSaving:e.agentFileSaving,agentIdentityLoading:e.agentIdentityLoading,agentIdentityError:e.agentIdentityError,agentIdentityById:e.agentIdentityById,agentSkillsLoading:e.agentSkillsLoading,agentSkillsReport:e.agentSkillsReport,agentSkillsError:e.agentSkillsError,agentSkillsAgentId:e.agentSkillsAgentId,skillsFilter:e.skillsFilter,onRefresh:async()=>{await oa(e);const d=e.agentsList?.agents?.map(m=>m.id)??[];d.length>0&&fl(e,d)},onSelectAgent:d=>{e.agentsSelectedId!==d&&(e.agentsSelectedId=d,e.agentFilesList=null,e.agentFilesError=null,e.agentFilesLoading=!1,e.agentFileActive=null,e.agentFileContents={},e.agentFileDrafts={},e.agentSkillsReport=null,e.agentSkillsError=null,e.agentSkillsAgentId=null,hl(e,d),e.agentsPanel==="files"&&ti(e,d),e.agentsPanel==="skills"&&Wn(e,d))},onSelectPanel:d=>{e.agentsPanel=d,d==="files"&&f&&e.agentFilesList?.agentId!==f&&(e.agentFilesList=null,e.agentFilesError=null,e.agentFileActive=null,e.agentFileContents={},e.agentFileDrafts={},ti(e,f)),d==="skills"&&f&&Wn(e,f),d==="channels"&&$e(e,!1),d==="cron"&&e.loadCron()},onLoadFiles:d=>ti(e,d),onSelectFile:d=>{e.agentFileActive=d,f&&Gg(e,f,d)},onFileDraftChange:(d,m)=>{e.agentFileDrafts={...e.agentFileDrafts,[d]:m}},onFileReset:d=>{const m=e.agentFileContents[d]??"";e.agentFileDrafts={...e.agentFileDrafts,[d]:m}},onFileSave:d=>{if(!f)return;const m=e.agentFileDrafts[d]??e.agentFileContents[d]??"";Qg(e,f,d,m)},onToolsProfileChange:(d,m,k)=>{if(!u)return;const S=u.agents?.list;if(!Array.isArray(S))return;const $=S.findIndex(A=>A&&typeof A=="object"&&"id"in A&&A.id===d);if($<0)return;const C=["agents","list",$,"tools"];m?Te(e,[...C,"profile"],m):Ge(e,[...C,"profile"]),k&&Ge(e,[...C,"allow"])},onToolsOverridesChange:(d,m,k)=>{if(!u)return;const S=u.agents?.list;if(!Array.isArray(S))return;const $=S.findIndex(A=>A&&typeof A=="object"&&"id"in A&&A.id===d);if($<0)return;const C=["agents","list",$,"tools"];m.length>0?Te(e,[...C,"alsoAllow"],m):Ge(e,[...C,"alsoAllow"]),k.length>0?Te(e,[...C,"deny"],k):Ge(e,[...C,"deny"])},onConfigReload:()=>De(e),onConfigSave:()=>Vn(e),onChannelsRefresh:()=>$e(e,!1),onCronRefresh:()=>e.loadCron(),onSkillsFilterChange:d=>e.skillsFilter=d,onSkillsRefresh:()=>{f&&Wn(e,f)},onAgentSkillToggle:(d,m,k)=>{if(!u)return;const S=u.agents?.list;if(!Array.isArray(S))return;const $=S.findIndex(K=>K&&typeof K=="object"&&"id"in K&&K.id===d);if($<0)return;const C=S[$],A=m.trim();if(!A)return;const T=e.agentSkillsReport?.skills?.map(K=>K.name).filter(Boolean)??[],M=(Array.isArray(C.skills)?C.skills.map(K=>String(K).trim()).filter(Boolean):void 0)??T,V=new Set(M);k?V.add(A):V.delete(A),Te(e,["agents","list",$,"skills"],[...V])},onAgentSkillsClear:d=>{if(!u)return;const m=u.agents?.list;if(!Array.isArray(m))return;const k=m.findIndex(S=>S&&typeof S=="object"&&"id"in S&&S.id===d);k<0||Ge(e,["agents","list",k,"skills"])},onAgentSkillsDisableAll:d=>{if(!u)return;const m=u.agents?.list;if(!Array.isArray(m))return;const k=m.findIndex(S=>S&&typeof S=="object"&&"id"in S&&S.id===d);k<0||Te(e,["agents","list",k,"skills"],[])},onModelChange:(d,m)=>{if(!u)return;const k=u.agents?.list;if(!Array.isArray(k))return;const S=k.findIndex(T=>T&&typeof T=="object"&&"id"in T&&T.id===d);if(S<0)return;const $=["agents","list",S,"model"];if(!m){Ge(e,$);return}const A=k[S]?.model;if(A&&typeof A=="object"&&!Array.isArray(A)){const T=A.fallbacks,E={primary:m,...Array.isArray(T)?{fallbacks:T}:{}};Te(e,$,E)}else Te(e,$,m)},onModelFallbacksChange:(d,m)=>{if(!u)return;const k=u.agents?.list;if(!Array.isArray(k))return;const S=k.findIndex(K=>K&&typeof K=="object"&&"id"in K&&K.id===d);if(S<0)return;const $=["agents","list",S,"model"],C=k[S],A=m.map(K=>K.trim()).filter(Boolean),T=C.model,M=(()=>{if(typeof T=="string")return T.trim()||null;if(T&&typeof T=="object"&&!Array.isArray(T)){const K=T.primary;if(typeof K=="string")return K.trim()||null}return null})();if(A.length===0){M?Te(e,$,M):Ge(e,$);return}Te(e,$,M?{primary:M,fallbacks:A}:{fallbacks:A})}}):v}

        ${e.tab==="skills"?qy({loading:e.skillsLoading,report:e.skillsReport,error:e.skillsError,filter:e.skillsFilter,edits:e.skillEdits,messages:e.skillMessages,busyKey:e.skillsBusyKey,onFilterChange:d=>e.skillsFilter=d,onRefresh:()=>xn(e,{clearMessages:!0}),onToggle:(d,m)=>up(e,d,m),onEdit:(d,m)=>dp(e,d,m),onSaveKey:d=>pp(e,d),onInstall:(d,m,k)=>gp(e,d,m,k)}):v}

        ${e.tab==="nodes"?Tb({loading:e.nodesLoading,nodes:e.nodes,devicesLoading:e.devicesLoading,devicesError:e.devicesError,devicesList:e.devicesList,configForm:e.configForm??e.configSnapshot?.config,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configFormDirty,configFormMode:e.configFormMode,execApprovalsLoading:e.execApprovalsLoading,execApprovalsSaving:e.execApprovalsSaving,execApprovalsDirty:e.execApprovalsDirty,execApprovalsSnapshot:e.execApprovalsSnapshot,execApprovalsForm:e.execApprovalsForm,execApprovalsSelectedAgent:e.execApprovalsSelectedAgent,execApprovalsTarget:e.execApprovalsTarget,execApprovalsTargetNodeId:e.execApprovalsTargetNodeId,onRefresh:()=>ms(e),onDevicesRefresh:()=>rt(e),onDeviceApprove:d=>Ju(e,d),onDeviceReject:d=>Zu(e,d),onDeviceRotate:(d,m,k)=>Xu(e,{deviceId:d,role:m,scopes:k}),onDeviceRevoke:(d,m)=>ep(e,{deviceId:d,role:m}),onLoadConfig:()=>De(e),onLoadExecApprovals:()=>{const d=e.execApprovalsTarget==="node"&&e.execApprovalsTargetNodeId?{kind:"node",nodeId:e.execApprovalsTargetNodeId}:{kind:"gateway"};return fa(e,d)},onBindDefault:d=>{d?Te(e,["tools","exec","node"],d):Ge(e,["tools","exec","node"])},onBindAgent:(d,m)=>{const k=["agents","list",d,"tools","exec","node"];m?Te(e,k,m):Ge(e,k)},onSaveBindings:()=>Vn(e),onExecApprovalsTargetChange:(d,m)=>{e.execApprovalsTarget=d,e.execApprovalsTargetNodeId=m,e.execApprovalsSnapshot=null,e.execApprovalsForm=null,e.execApprovalsDirty=!1,e.execApprovalsSelectedAgent=null},onExecApprovalsSelectAgent:d=>{e.execApprovalsSelectedAgent=d},onExecApprovalsPatch:(d,m)=>ap(e,d,m),onExecApprovalsRemove:d=>op(e,d),onSaveExecApprovals:()=>{const d=e.execApprovalsTarget==="node"&&e.execApprovalsTargetNodeId?{kind:"node",nodeId:e.execApprovalsTargetNodeId}:{kind:"gateway"};return ip(e,d)}}):v}

        ${o&&e.dhAvailable?Ry(z0(e,U0(e,()=>{jn(e)}))):v}

        ${e.tab==="chat"||o&&!e.dhAvailable?r`${Ng(e,{onNewSession:()=>{jn(e)}})}${sb({sessionKey:e.sessionKey,onSessionKeyChange:d=>{e.sessionKey=d,e.chatMessage="",e.chatAttachments=[],e.chatStream=null,e.chatStreamStartedAt=null,e.chatRunId=null,e.chatQueue=[],e.resetToolStream(),e.resetChatScroll(),e.applySettings({...e.settings,sessionKey:d,lastActiveSessionKey:d}),e.loadAssistantIdentity(),at(e),Et(e)},thinkingLevel:e.chatThinkingLevel,showThinking:c,loading:e.chatLoading,sending:e.chatSending,compactionStatus:e.compactionStatus,assistantAvatarUrl:g,messages:e.chatMessages,toolMessages:e.chatToolMessages,stream:e.chatStream,streamStartedAt:e.chatStreamStartedAt,draft:e.chatMessage,queue:e.chatQueue,connected:e.connected,canSend:e.connected,disabledReason:i,error:e.lastError,sessions:e.sessionsResult,focusMode:l,onRefresh:()=>(e.resetToolStream(),Promise.all([at(e),Et(e)])),onToggleFocusMode:()=>{e.onboarding||e.applySettings({...e.settings,chatFocusMode:!e.settings.chatFocusMode})},onChatScroll:d=>e.handleChatScroll(d),onDraftChange:d=>e.chatMessage=d,attachments:e.chatAttachments,onAttachmentsChange:d=>e.chatAttachments=d,onSend:()=>e.handleSendChat(),canAbort:!!e.chatRunId,onAbort:()=>{e.handleAbortChat()},onQueueRemove:d=>e.removeQueuedMessage(d),onNewSession:()=>{jn(e)},showNewMessages:e.chatNewMessagesBelow&&!e.chatManualRefreshInFlight,onScrollToBottom:()=>e.scrollToBottom(),sidebarOpen:e.sidebarOpen,sidebarContent:e.sidebarContent,sidebarError:e.sidebarError,sidebarMode:e.sidebarMode,splitRatio:e.splitRatio,onOpenSidebar:d=>e.handleOpenSidebar(d),onCloseSidebar:()=>e.handleCloseSidebar(),onSplitRatioChange:d=>e.handleSplitRatioChange(d),execLogEntries:e.execLogEntries,execLogActive:e.execLogActive,execLogAutoScroll:e.execLogAutoScroll,onOpenExecLog:()=>e.handleOpenExecLog(),onCloseExecLog:()=>e.handleCloseExecLog(),onClearExecLog:()=>e.handleClearExecLog(),onToggleExecLogAutoScroll:()=>e.handleToggleExecLogAutoScroll(),assistantName:e.assistantName,assistantAvatar:e.assistantAvatar})}`:v}

        ${e.tab==="personal"?Xb({loading:e.personalInfoLoading,saving:e.personalInfoSaving,data:e.personalInfo,form:e.personalInfoForm,dirty:e.personalInfoDirty,error:e.personalInfoError,success:e.personalInfoSuccess,onFieldChange:(d,m)=>lp(e,d,m),onSave:()=>{rp(e)},onRefresh:()=>{ma(e)}}):v}

        ${e.tab==="config"?cb({raw:e.configRaw,originalRaw:e.configRawOriginal,valid:e.configValid,issues:e.configIssues,loading:e.configLoading,saving:e.configSaving,applying:e.configApplying,updating:e.updateRunning,connected:e.connected,schema:e.configSchema,schemaLoading:e.configSchemaLoading,uiHints:e.configUiHints,formMode:e.configFormMode,formValue:e.configForm,originalValue:e.configFormOriginal,searchQuery:e.configSearchQuery,activeSection:e.configActiveSection,activeSubsection:e.configActiveSubsection,onRawChange:d=>{e.configRaw=d},onFormModeChange:d=>e.configFormMode=d,onFormPatch:(d,m)=>Te(e,d,m),onSearchChange:d=>e.configSearchQuery=d,onSectionChange:d=>{e.configActiveSection=d,e.configActiveSubsection=null},onSubsectionChange:d=>e.configActiveSubsection=d,onReload:()=>De(e),onSave:()=>Vn(e),onApply:()=>Ud(e),onUpdate:()=>Hd(e)}):v}

        ${e.tab==="debug"?bb({loading:e.debugLoading,status:e.debugStatus,health:e.debugHealth,models:e.debugModels,heartbeat:e.debugHeartbeat,eventLog:e.eventLog,callMethod:e.debugCallMethod,callParams:e.debugCallParams,callResult:e.debugCallResult,callError:e.debugCallError,onCallMethodChange:d=>e.debugCallMethod=d,onCallParamsChange:d=>e.debugCallParams=d,onRefresh:()=>fs(e),onCall:()=>ru(e)}):v}

        ${e.tab==="logs"?Cb({loading:e.logsLoading,error:e.logsError,file:e.logsFile,entries:e.logsEntries,filterText:e.logsFilterText,levelFilters:e.logsLevelFilters,autoFollow:e.logsAutoFollow,truncated:e.logsTruncated,onFilterTextChange:d=>e.logsFilterText=d,onLevelToggle:(d,m)=>{e.logsLevelFilters={...e.logsLevelFilters,[d]:m}},onToggleAutoFollow:d=>e.logsAutoFollow=d,onRefresh:()=>ta(e,{reset:!0}),onExport:(d,m)=>e.exportLogs(d,m),onScroll:d=>e.handleLogsScroll(d)}):v}
      </main>
      <!-- statusbar footer 削除（ユーザ要望 2026-07-07: 「Gateway: OK」状態条を非表示） -->
      ${Wg({open:e.commandPaletteOpen,recentCommandIds:e.recentCommands,onSelect:d=>{e.addRecentCommand(d.id),d.id==="new-chat"?(e.openTabFromPalette("chat"),jn(e)):d.tab&&e.openTabFromPalette(d.tab),e.commandPaletteOpen=!1},onClose:()=>{e.commandPaletteOpen=!1}})}
      ${xb(e)}
      ${wb(e)}
    </div>
  `}var K0=Object.defineProperty,V0=Object.getOwnPropertyDescriptor,x=(e,t,n,s)=>{for(var i=s>1?void 0:s?V0(t,n):t,a=e.length-1,o;a>=0;a--)(o=e[a])&&(i=(s?o(t,n,i):o(i))||i);return s&&i&&K0(t,n,i),i};const vi=ug();function W0(){if(!window.location.search)return!1;const t=new URLSearchParams(window.location.search).get("onboarding");if(!t)return!1;const n=t.trim().toLowerCase();return n==="1"||n==="true"||n==="yes"||n==="on"}let y=class extends nt{constructor(){super(...arguments),this.settings=vp(),this.password="",this.tab="chat",this.onboarding=W0(),this.connected=!1,this.dhConnectionStatus="disconnected",this.dhMicEnabled=!0,this.dhCameraEnabled=!1,this.dhSubtitleVisible=!0,this.dhCurrentSubtitle="",this.dhErrorMessage=null,this.dhLayoutMode="split",this.dhIsThinking=!1,this.dhAvailable=!1,this.theme=this.settings.theme??"system",this.themeResolved="dark",this.hello=null,this.lastError=null,this.eventLog=[],this.eventLogBuffer=[],this.toolStreamSyncTimer=null,this.sidebarCloseTimer=null,this._onFullscreenChange=()=>this.requestUpdate(),this.assistantName=vi.name,this.assistantAvatar=vi.avatar,this.assistantAgentId=vi.agentId??null,this.sessionKey=this.settings.sessionKey,this.chatLoading=!1,this.chatSending=!1,this.chatMessage="",this.chatMessages=[],this.chatToolMessages=[],this.chatStream=null,this.chatStreamStartedAt=null,this.chatRunId=null,this.compactionStatus=null,this.chatAvatarUrl=null,this.chatThinkingLevel=null,this.chatQueue=[],this.chatAttachments=[],this.chatManualRefreshInFlight=!1,this.sidebarOpen=!1,this.sidebarContent=null,this.sidebarError=null,this.sidebarMode=null,this.execLogEntries=[],this.execLogActive=!1,this.execLogAutoScroll=!0,this.execLogManuallyDismissed=!1,this.splitRatio=this.settings.splitRatio,this.nodesLoading=!1,this.nodes=[],this.devicesLoading=!1,this.devicesError=null,this.devicesList=null,this.execApprovalsLoading=!1,this.execApprovalsSaving=!1,this.execApprovalsDirty=!1,this.execApprovalsSnapshot=null,this.execApprovalsForm=null,this.execApprovalsSelectedAgent=null,this.execApprovalsTarget="gateway",this.execApprovalsTargetNodeId=null,this.execApprovalQueue=[],this.execApprovalBusy=!1,this.execApprovalError=null,this.pendingGatewayUrl=null,this.personalInfoLoading=!1,this.personalInfoSaving=!1,this.personalInfo=null,this.personalInfoForm=null,this.personalInfoError=null,this.personalInfoDirty=!1,this.personalInfoSuccess=null,this.configLoading=!1,this.configRaw=`{
}
`,this.configRawOriginal="",this.configValid=null,this.configIssues=[],this.configSaving=!1,this.configApplying=!1,this.updateRunning=!1,this.applySessionKey=this.settings.lastActiveSessionKey,this.configSnapshot=null,this.configSchema=null,this.configSchemaVersion=null,this.configSchemaLoading=!1,this.configUiHints={},this.configForm=null,this.configFormOriginal=null,this.configFormDirty=!1,this.configFormMode="form",this.configSearchQuery="",this.configActiveSection=null,this.configActiveSubsection=null,this.channelsLoading=!1,this.channelsSnapshot=null,this.channelsError=null,this.channelsLastSuccess=null,this.whatsappLoginMessage=null,this.whatsappLoginQrDataUrl=null,this.whatsappLoginConnected=null,this.whatsappBusy=!1,this.nostrProfileFormState=null,this.nostrProfileAccountId=null,this.presenceLoading=!1,this.presenceEntries=[],this.presenceError=null,this.presenceStatus=null,this.agentsLoading=!1,this.agentsList=null,this.agentsError=null,this.agentsSelectedId=null,this.agentsPanel="overview",this.agentFilesLoading=!1,this.agentFilesError=null,this.agentFilesList=null,this.agentFileContents={},this.agentFileDrafts={},this.agentFileActive=null,this.agentFileSaving=!1,this.agentIdentityLoading=!1,this.agentIdentityError=null,this.agentIdentityById={},this.agentSkillsLoading=!1,this.agentSkillsError=null,this.agentSkillsReport=null,this.agentSkillsAgentId=null,this.sessionsLoading=!1,this.sessionsResult=null,this.sessionsError=null,this.sessionsFilterActive="",this.sessionsFilterLimit="120",this.sessionsIncludeGlobal=!0,this.sessionsIncludeUnknown=!1,this.usageLoading=!1,this.usageResult=null,this.usageCostSummary=null,this.usageError=null,this.usageStartDate=(()=>{const e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`})(),this.usageEndDate=(()=>{const e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`})(),this.usageSelectedSessions=[],this.usageSelectedDays=[],this.usageSelectedHours=[],this.usageChartMode="tokens",this.usageDailyChartMode="by-type",this.usageTimeSeriesMode="per-turn",this.usageTimeSeriesBreakdownMode="by-type",this.usageTimeSeries=null,this.usageTimeSeriesLoading=!1,this.usageSessionLogs=null,this.usageSessionLogsLoading=!1,this.usageSessionLogsExpanded=!1,this.usageQuery="",this.usageQueryDraft="",this.usageSessionSort="recent",this.usageSessionSortDir="desc",this.usageRecentSessions=[],this.usageTimeZone="local",this.usageContextExpanded=!1,this.usageHeaderPinned=!1,this.usageSessionsTab="all",this.usageVisibleColumns=["channel","agent","provider","model","messages","tools","errors","duration"],this.usageLogFilterRoles=[],this.usageLogFilterTools=[],this.usageLogFilterHasTools=!1,this.usageLogFilterQuery="",this.usageQueryDebounceTimer=null,this.cronLoading=!1,this.cronJobs=[],this.cronStatus=null,this.cronError=null,this.cronForm={...rg},this.cronRunsJobId=null,this.cronRuns=[],this.cronBusy=!1,this.skillsLoading=!1,this.skillsReport=null,this.skillsError=null,this.skillsFilter="",this.skillEdits={},this.skillsBusyKey=null,this.skillMessages={},this.modelCatalog=null,this.modelCatalogLoading=!1,this.debugLoading=!1,this.debugStatus=null,this.debugHealth=null,this.debugModels=[],this.debugHeartbeat=null,this.debugCallMethod="",this.debugCallParams="{}",this.debugCallResult=null,this.debugCallError=null,this.logsLoading=!1,this.logsError=null,this.logsFile=null,this.logsEntries=[],this.logsFilterText="",this.logsLevelFilters={...og},this.logsAutoFollow=!0,this.logsTruncated=!1,this.logsCursor=null,this.logsLastFetchAt=null,this.logsLimit=500,this.logsMaxBytes=25e4,this.logsAtBottom=!0,this.commandPaletteOpen=!1,this.openTabs=this.settings.openTabs?.length?this.settings.openTabs:["chat"],this.statusBarExpanded=!1,this.recentCommands=this.settings.recentCommands??[],this.openChatSessions=(()=>{const e=this.settings.openChatSessions,t=this.settings.sessionKey||"main";return e&&e.length>0?e.includes(t)?e:[t,...e]:[t]})(),this.client=null,this.chatScrollFrame=null,this.chatScrollTimeout=null,this.chatHasAutoScrolled=!1,this.chatUserNearBottom=!0,this.chatNewMessagesBelow=!1,this.nodesPollInterval=null,this.logsPollInterval=null,this.debugPollInterval=null,this.logsScrollFrame=null,this.toolStreamById=new Map,this.toolStreamOrder=[],this.refreshSessionsAfterChat=new Set,this.basePath="",this.popStateHandler=()=>Lp(this),this.themeMedia=null,this.themeMediaHandler=null,this.topbarObserver=null}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this._unsubLocale=el(()=>this.requestUpdate()),document.addEventListener("fullscreenchange",this._onFullscreenChange),Ag(this)}firstUpdated(){Cg(this)}disconnectedCallback(){this._unsubLocale?.(),document.removeEventListener("fullscreenchange",this._onFullscreenChange),Tg(this),super.disconnectedCallback()}updated(e){_g(this,e)}connect(){ic(this)}handleChatScroll(e){su(this,e)}handleLogsScroll(e){iu(this,e)}exportLogs(e,t){au(e,t)}resetToolStream(){ws(this)}resetChatScroll(){wo(this)}scrollToBottom(e){wo(this),bn(this,!0,!!e?.smooth)}async loadAssistantIdentity(){await tc(this)}applySettings(e){Ye(this,e)}setTab(e){kp(this,e)}setTheme(e,t){Sp(this,e,t)}async loadOverview(){await jl(this)}async loadCron(){await es(this)}async handleAbortChat(){await ka(this)}removeQueuedMessage(e){Jl(this,e)}async handleSendChat(e,t){await Zl(this,e,t)}async handleWhatsAppStart(e){await Vd(this,e)}async handleWhatsAppWait(){await Wd(this)}async handleWhatsAppLogout(){await qd(this)}async handleChannelConfigSave(){await Gd(this)}async handleChannelConfigReload(){await Qd(this)}handleNostrProfileEdit(e,t){Jd(this,e,t)}handleNostrProfileCancel(){Zd(this)}handleNostrProfileFieldChange(e,t){Xd(this,e,t)}async handleNostrProfileSave(){await tu(this)}async handleNostrProfileImport(){await nu(this)}handleNostrProfileToggleAdvanced(){eu(this)}async handleExecApprovalDecision(e){const t=this.execApprovalQueue[0];if(!(!t||!this.client||this.execApprovalBusy)){this.execApprovalBusy=!0,this.execApprovalError=null;try{await this.client.request("exec.approval.resolve",{id:t.id,decision:e}),this.execApprovalQueue=this.execApprovalQueue.filter(n=>n.id!==t.id)}catch(n){this.execApprovalError=`Exec approval failed: ${String(n)}`}finally{this.execApprovalBusy=!1}}}handleGatewayUrlConfirm(){const e=this.pendingGatewayUrl;e&&(this.pendingGatewayUrl=null,Ye(this,{...this.settings,gatewayUrl:e}),this.connect())}handleGatewayUrlCancel(){this.pendingGatewayUrl=null}handleOpenSidebar(e){this.sidebarCloseTimer!=null&&(window.clearTimeout(this.sidebarCloseTimer),this.sidebarCloseTimer=null),this.sidebarContent=e,this.sidebarError=null,this.sidebarMode="markdown",this.sidebarOpen=!0}handleCloseSidebar(){this.sidebarOpen=!1,this.sidebarMode=null,this.sidebarCloseTimer!=null&&window.clearTimeout(this.sidebarCloseTimer),this.sidebarCloseTimer=window.setTimeout(()=>{this.sidebarOpen||(this.sidebarContent=null,this.sidebarError=null,this.sidebarCloseTimer=null)},200)}handleSplitRatioChange(e){const t=Math.max(.4,Math.min(.7,e));this.splitRatio=t,this.applySettings({...this.settings,splitRatio:t})}handleOpenExecLog(){this.sidebarMode="exec-log",this.sidebarOpen=!0,this.execLogManuallyDismissed=!1}handleCloseExecLog(){this.sidebarMode=null,this.sidebarOpen=!1,this.execLogManuallyDismissed=!0}handleClearExecLog(){this.execLogEntries=[]}handleToggleExecLogAutoScroll(){this.execLogAutoScroll=!this.execLogAutoScroll}toggleCommandPalette(){this.commandPaletteOpen=!this.commandPaletteOpen}openTabFromPalette(e){this.openTabs.includes(e)||(this.openTabs=[...this.openTabs,e]),this.setTab(e),this.commandPaletteOpen=!1,this.applySettings({...this.settings,openTabs:this.openTabs})}closeTab(e){e!=="chat"&&(this.openTabs=this.openTabs.filter(t=>t!==e),this.tab===e&&this.setTab("chat"),this.applySettings({...this.settings,openTabs:this.openTabs}))}addRecentCommand(e){const t=[e,...this.recentCommands.filter(n=>n!==e)].slice(0,5);this.recentCommands=t,this.applySettings({...this.settings,recentCommands:t})}addChatSession(e){this.openChatSessions.includes(e)||(this.openChatSessions=[...this.openChatSessions,e],this.applySettings({...this.settings,openChatSessions:this.openChatSessions}))}removeChatSession(e){if(this.openChatSessions.length<=1)return;const t=this.openChatSessions.indexOf(e);if(t!==-1){if(this.openChatSessions=this.openChatSessions.filter(n=>n!==e),this.sessionKey===e){const n=Math.min(t,this.openChatSessions.length-1),s=this.openChatSessions[n]??this.openChatSessions[0];this.switchChatSession(s)}this.applySettings({...this.settings,openChatSessions:this.openChatSessions})}}switchChatSession(e){e!==this.sessionKey&&(this.sessionKey=e,this.chatMessage="",this.chatAttachments=[],this.chatStream=null,this.chatStreamStartedAt=null,this.chatRunId=null,this.chatQueue=[],this.resetToolStream(),this.resetChatScroll(),this.applySettings({...this.settings,sessionKey:e,lastActiveSessionKey:e,openChatSessions:this.openChatSessions}),this.loadAssistantIdentity(),xe(async()=>{const{loadChatHistory:t}=await Promise.resolve().then(()=>eg);return{loadChatHistory:t}},[],import.meta.url).then(({loadChatHistory:t})=>t(this)),xe(async()=>{const{refreshChatAvatar:t}=await Promise.resolve().then(()=>ag);return{refreshChatAvatar:t}},void 0,import.meta.url).then(({refreshChatAvatar:t})=>t(this)))}render(){return j0(this)}};x([b()],y.prototype,"settings",2);x([b()],y.prototype,"password",2);x([b()],y.prototype,"tab",2);x([b()],y.prototype,"onboarding",2);x([b()],y.prototype,"connected",2);x([b()],y.prototype,"dhConnectionStatus",2);x([b()],y.prototype,"dhMicEnabled",2);x([b()],y.prototype,"dhCameraEnabled",2);x([b()],y.prototype,"dhSubtitleVisible",2);x([b()],y.prototype,"dhCurrentSubtitle",2);x([b()],y.prototype,"dhErrorMessage",2);x([b()],y.prototype,"dhLayoutMode",2);x([b()],y.prototype,"dhIsThinking",2);x([b()],y.prototype,"dhAvailable",2);x([b()],y.prototype,"theme",2);x([b()],y.prototype,"themeResolved",2);x([b()],y.prototype,"hello",2);x([b()],y.prototype,"lastError",2);x([b()],y.prototype,"eventLog",2);x([b()],y.prototype,"assistantName",2);x([b()],y.prototype,"assistantAvatar",2);x([b()],y.prototype,"assistantAgentId",2);x([b()],y.prototype,"sessionKey",2);x([b()],y.prototype,"chatLoading",2);x([b()],y.prototype,"chatSending",2);x([b()],y.prototype,"chatMessage",2);x([b()],y.prototype,"chatMessages",2);x([b()],y.prototype,"chatToolMessages",2);x([b()],y.prototype,"chatStream",2);x([b()],y.prototype,"chatStreamStartedAt",2);x([b()],y.prototype,"chatRunId",2);x([b()],y.prototype,"compactionStatus",2);x([b()],y.prototype,"chatAvatarUrl",2);x([b()],y.prototype,"chatThinkingLevel",2);x([b()],y.prototype,"chatQueue",2);x([b()],y.prototype,"chatAttachments",2);x([b()],y.prototype,"chatManualRefreshInFlight",2);x([b()],y.prototype,"sidebarOpen",2);x([b()],y.prototype,"sidebarContent",2);x([b()],y.prototype,"sidebarError",2);x([b()],y.prototype,"sidebarMode",2);x([b()],y.prototype,"execLogEntries",2);x([b()],y.prototype,"execLogActive",2);x([b()],y.prototype,"execLogAutoScroll",2);x([b()],y.prototype,"execLogManuallyDismissed",2);x([b()],y.prototype,"splitRatio",2);x([b()],y.prototype,"nodesLoading",2);x([b()],y.prototype,"nodes",2);x([b()],y.prototype,"devicesLoading",2);x([b()],y.prototype,"devicesError",2);x([b()],y.prototype,"devicesList",2);x([b()],y.prototype,"execApprovalsLoading",2);x([b()],y.prototype,"execApprovalsSaving",2);x([b()],y.prototype,"execApprovalsDirty",2);x([b()],y.prototype,"execApprovalsSnapshot",2);x([b()],y.prototype,"execApprovalsForm",2);x([b()],y.prototype,"execApprovalsSelectedAgent",2);x([b()],y.prototype,"execApprovalsTarget",2);x([b()],y.prototype,"execApprovalsTargetNodeId",2);x([b()],y.prototype,"execApprovalQueue",2);x([b()],y.prototype,"execApprovalBusy",2);x([b()],y.prototype,"execApprovalError",2);x([b()],y.prototype,"pendingGatewayUrl",2);x([b()],y.prototype,"personalInfoLoading",2);x([b()],y.prototype,"personalInfoSaving",2);x([b()],y.prototype,"personalInfo",2);x([b()],y.prototype,"personalInfoForm",2);x([b()],y.prototype,"personalInfoError",2);x([b()],y.prototype,"personalInfoDirty",2);x([b()],y.prototype,"personalInfoSuccess",2);x([b()],y.prototype,"configLoading",2);x([b()],y.prototype,"configRaw",2);x([b()],y.prototype,"configRawOriginal",2);x([b()],y.prototype,"configValid",2);x([b()],y.prototype,"configIssues",2);x([b()],y.prototype,"configSaving",2);x([b()],y.prototype,"configApplying",2);x([b()],y.prototype,"updateRunning",2);x([b()],y.prototype,"applySessionKey",2);x([b()],y.prototype,"configSnapshot",2);x([b()],y.prototype,"configSchema",2);x([b()],y.prototype,"configSchemaVersion",2);x([b()],y.prototype,"configSchemaLoading",2);x([b()],y.prototype,"configUiHints",2);x([b()],y.prototype,"configForm",2);x([b()],y.prototype,"configFormOriginal",2);x([b()],y.prototype,"configFormDirty",2);x([b()],y.prototype,"configFormMode",2);x([b()],y.prototype,"configSearchQuery",2);x([b()],y.prototype,"configActiveSection",2);x([b()],y.prototype,"configActiveSubsection",2);x([b()],y.prototype,"channelsLoading",2);x([b()],y.prototype,"channelsSnapshot",2);x([b()],y.prototype,"channelsError",2);x([b()],y.prototype,"channelsLastSuccess",2);x([b()],y.prototype,"whatsappLoginMessage",2);x([b()],y.prototype,"whatsappLoginQrDataUrl",2);x([b()],y.prototype,"whatsappLoginConnected",2);x([b()],y.prototype,"whatsappBusy",2);x([b()],y.prototype,"nostrProfileFormState",2);x([b()],y.prototype,"nostrProfileAccountId",2);x([b()],y.prototype,"presenceLoading",2);x([b()],y.prototype,"presenceEntries",2);x([b()],y.prototype,"presenceError",2);x([b()],y.prototype,"presenceStatus",2);x([b()],y.prototype,"agentsLoading",2);x([b()],y.prototype,"agentsList",2);x([b()],y.prototype,"agentsError",2);x([b()],y.prototype,"agentsSelectedId",2);x([b()],y.prototype,"agentsPanel",2);x([b()],y.prototype,"agentFilesLoading",2);x([b()],y.prototype,"agentFilesError",2);x([b()],y.prototype,"agentFilesList",2);x([b()],y.prototype,"agentFileContents",2);x([b()],y.prototype,"agentFileDrafts",2);x([b()],y.prototype,"agentFileActive",2);x([b()],y.prototype,"agentFileSaving",2);x([b()],y.prototype,"agentIdentityLoading",2);x([b()],y.prototype,"agentIdentityError",2);x([b()],y.prototype,"agentIdentityById",2);x([b()],y.prototype,"agentSkillsLoading",2);x([b()],y.prototype,"agentSkillsError",2);x([b()],y.prototype,"agentSkillsReport",2);x([b()],y.prototype,"agentSkillsAgentId",2);x([b()],y.prototype,"sessionsLoading",2);x([b()],y.prototype,"sessionsResult",2);x([b()],y.prototype,"sessionsError",2);x([b()],y.prototype,"sessionsFilterActive",2);x([b()],y.prototype,"sessionsFilterLimit",2);x([b()],y.prototype,"sessionsIncludeGlobal",2);x([b()],y.prototype,"sessionsIncludeUnknown",2);x([b()],y.prototype,"usageLoading",2);x([b()],y.prototype,"usageResult",2);x([b()],y.prototype,"usageCostSummary",2);x([b()],y.prototype,"usageError",2);x([b()],y.prototype,"usageStartDate",2);x([b()],y.prototype,"usageEndDate",2);x([b()],y.prototype,"usageSelectedSessions",2);x([b()],y.prototype,"usageSelectedDays",2);x([b()],y.prototype,"usageSelectedHours",2);x([b()],y.prototype,"usageChartMode",2);x([b()],y.prototype,"usageDailyChartMode",2);x([b()],y.prototype,"usageTimeSeriesMode",2);x([b()],y.prototype,"usageTimeSeriesBreakdownMode",2);x([b()],y.prototype,"usageTimeSeries",2);x([b()],y.prototype,"usageTimeSeriesLoading",2);x([b()],y.prototype,"usageSessionLogs",2);x([b()],y.prototype,"usageSessionLogsLoading",2);x([b()],y.prototype,"usageSessionLogsExpanded",2);x([b()],y.prototype,"usageQuery",2);x([b()],y.prototype,"usageQueryDraft",2);x([b()],y.prototype,"usageSessionSort",2);x([b()],y.prototype,"usageSessionSortDir",2);x([b()],y.prototype,"usageRecentSessions",2);x([b()],y.prototype,"usageTimeZone",2);x([b()],y.prototype,"usageContextExpanded",2);x([b()],y.prototype,"usageHeaderPinned",2);x([b()],y.prototype,"usageSessionsTab",2);x([b()],y.prototype,"usageVisibleColumns",2);x([b()],y.prototype,"usageLogFilterRoles",2);x([b()],y.prototype,"usageLogFilterTools",2);x([b()],y.prototype,"usageLogFilterHasTools",2);x([b()],y.prototype,"usageLogFilterQuery",2);x([b()],y.prototype,"cronLoading",2);x([b()],y.prototype,"cronJobs",2);x([b()],y.prototype,"cronStatus",2);x([b()],y.prototype,"cronError",2);x([b()],y.prototype,"cronForm",2);x([b()],y.prototype,"cronRunsJobId",2);x([b()],y.prototype,"cronRuns",2);x([b()],y.prototype,"cronBusy",2);x([b()],y.prototype,"skillsLoading",2);x([b()],y.prototype,"skillsReport",2);x([b()],y.prototype,"skillsError",2);x([b()],y.prototype,"skillsFilter",2);x([b()],y.prototype,"skillEdits",2);x([b()],y.prototype,"skillsBusyKey",2);x([b()],y.prototype,"skillMessages",2);x([b()],y.prototype,"modelCatalog",2);x([b()],y.prototype,"modelCatalogLoading",2);x([b()],y.prototype,"debugLoading",2);x([b()],y.prototype,"debugStatus",2);x([b()],y.prototype,"debugHealth",2);x([b()],y.prototype,"debugModels",2);x([b()],y.prototype,"debugHeartbeat",2);x([b()],y.prototype,"debugCallMethod",2);x([b()],y.prototype,"debugCallParams",2);x([b()],y.prototype,"debugCallResult",2);x([b()],y.prototype,"debugCallError",2);x([b()],y.prototype,"logsLoading",2);x([b()],y.prototype,"logsError",2);x([b()],y.prototype,"logsFile",2);x([b()],y.prototype,"logsEntries",2);x([b()],y.prototype,"logsFilterText",2);x([b()],y.prototype,"logsLevelFilters",2);x([b()],y.prototype,"logsAutoFollow",2);x([b()],y.prototype,"logsTruncated",2);x([b()],y.prototype,"logsCursor",2);x([b()],y.prototype,"logsLastFetchAt",2);x([b()],y.prototype,"logsLimit",2);x([b()],y.prototype,"logsMaxBytes",2);x([b()],y.prototype,"logsAtBottom",2);x([b()],y.prototype,"commandPaletteOpen",2);x([b()],y.prototype,"openTabs",2);x([b()],y.prototype,"statusBarExpanded",2);x([b()],y.prototype,"recentCommands",2);x([b()],y.prototype,"openChatSessions",2);x([b()],y.prototype,"chatNewMessagesBelow",2);y=x([hs("winclaw-app")],y);Xr(id());
//# sourceMappingURL=index-DerWP9vO.js.map
