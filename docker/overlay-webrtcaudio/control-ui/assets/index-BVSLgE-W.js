(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&s(a)}).observe(document,{childList:!0,subtree:!0});function n(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(i){if(i.ep)return;i.ep=!0;const o=n(i);fetch(i.href,o)}})();const Fc="modulepreload",Nc=function(e,t){return new URL(e,t).href},Jo={},me=function(t,n,s){let i=Promise.resolve();if(n&&n.length>0){let g=function(p){return Promise.all(p.map(u=>Promise.resolve(u).then(h=>({status:"fulfilled",value:h}),h=>({status:"rejected",reason:h}))))};const a=document.getElementsByTagName("link"),l=document.querySelector("meta[property=csp-nonce]"),c=l?.nonce||l?.getAttribute("nonce");i=g(n.map(p=>{if(p=Nc(p,s),p in Jo)return;Jo[p]=!0;const u=p.endsWith(".css"),h=u?'[rel="stylesheet"]':"";if(s)for(let d=a.length-1;d>=0;d--){const m=a[d];if(m.href===p&&(!u||m.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${p}"]${h}`))return;const f=document.createElement("link");if(f.rel=u?"stylesheet":Fc,u||(f.as="script"),f.crossOrigin="",f.href=p,c&&f.setAttribute("nonce",c),document.head.appendChild(f),u)return new Promise((d,m)=>{f.addEventListener("load",d),f.addEventListener("error",()=>m(new Error(`Unable to preload CSS for ${p}`)))})}))}function o(a){const l=new Event("vite:preloadError",{cancelable:!0});if(l.payload=a,window.dispatchEvent(l),!l.defaultPrevented)throw a}return i.then(a=>{for(const l of a||[])l.status==="rejected"&&o(l.reason);return t().catch(o)})},Oc=(e,t,n)=>{const s=e[t];return s?typeof s=="function"?s():Promise.resolve(s):new Promise((i,o)=>{(typeof queueMicrotask=="function"?queueMicrotask:setTimeout)(o.bind(null,new Error("Unknown variable dynamic import: "+t+(t.split("/").length!==n?". Note that variables only represent file names one level deep.":""))))})},Fn=["zh-CN","zh-TW","en","ja","ko","fr","de","es","pt","ru","vi","th","id"];let Mr="en",Rr={};const Ms=new Map,li=new Set;function Bc(){try{const t=localStorage.getItem("winclaw-locale");if(t&&Fn.includes(t))return t}catch{}const e=[];typeof navigator<"u"&&(navigator.languages&&navigator.languages.length>0?e.push(...navigator.languages):navigator.language&&e.push(navigator.language));for(const t of e){if(Fn.includes(t))return t;const n=t.split("-")[0],s=Fn.find(i=>i===n||i.startsWith(`${n}-`));if(s)return s}return"en"}async function Pr(e){if(!Ms.has(e)){const t=await Oc(Object.assign({"./locales/de.json":()=>me(()=>import("./de-C8mcHdRV.js"),[],import.meta.url),"./locales/en.json":()=>me(()=>import("./en-D1yRb4ch.js"),[],import.meta.url),"./locales/es.json":()=>me(()=>import("./es-DJsynep1.js"),[],import.meta.url),"./locales/fr.json":()=>me(()=>import("./fr-BMuJqCYw.js"),[],import.meta.url),"./locales/id.json":()=>me(()=>import("./id-C_bYzpwA.js"),[],import.meta.url),"./locales/ja.json":()=>me(()=>import("./ja-DNpYfWYW.js"),[],import.meta.url),"./locales/ko.json":()=>me(()=>import("./ko-DSHFWiWF.js"),[],import.meta.url),"./locales/pt.json":()=>me(()=>import("./pt-DMDySQSU.js"),[],import.meta.url),"./locales/ru.json":()=>me(()=>import("./ru-C46zydAm.js"),[],import.meta.url),"./locales/th.json":()=>me(()=>import("./th-CAzuhG4l.js"),[],import.meta.url),"./locales/vi.json":()=>me(()=>import("./vi-CV7jpOvG.js"),[],import.meta.url),"./locales/zh-CN.json":()=>me(()=>import("./zh-CN-Bcgzag1f.js"),[],import.meta.url),"./locales/zh-TW.json":()=>me(()=>import("./zh-TW-CpseOcXs.js"),[],import.meta.url)}),`./locales/${e}.json`,3);Ms.set(e,t.default)}Mr=e,Rr=Ms.get(e);try{localStorage.setItem("winclaw-locale",e)}catch{}li.forEach(t=>t())}function R(e,t){const n=e.split(".");let s=Rr;for(const i of n){if(s==null||typeof s!="object")return e;s=s[i]}return typeof s!="string"?e:s}function Uc(e){return li.add(e),()=>li.delete(e)}function zc(){return Mr}function Hc(){return Fn}const jc={"zh-CN":"简体中文","zh-TW":"繁體中文",en:"English",ja:"日本語",ko:"한국어",fr:"Français",de:"Deutsch",es:"Español",pt:"Português",ru:"Русский",vi:"Tiếng Việt",th:"ภาษาไทย",id:"Bahasa Indonesia"};const Nn=globalThis,Di=Nn.ShadowRoot&&(Nn.ShadyCSS===void 0||Nn.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Fi=Symbol(),Zo=new WeakMap;let Dr=class{constructor(t,n,s){if(this._$cssResult$=!0,s!==Fi)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=n}get styleSheet(){let t=this.o;const n=this.t;if(Di&&t===void 0){const s=n!==void 0&&n.length===1;s&&(t=Zo.get(n)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&Zo.set(n,t))}return t}toString(){return this.cssText}};const Kc=e=>new Dr(typeof e=="string"?e:e+"",void 0,Fi),Wc=(e,...t)=>{const n=e.length===1?e[0]:t.reduce((s,i,o)=>s+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+e[o+1],e[0]);return new Dr(n,e,Fi)},Vc=(e,t)=>{if(Di)e.adoptedStyleSheets=t.map(n=>n instanceof CSSStyleSheet?n:n.styleSheet);else for(const n of t){const s=document.createElement("style"),i=Nn.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=n.cssText,e.appendChild(s)}},Xo=Di?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let n="";for(const s of t.cssRules)n+=s.cssText;return Kc(n)})(e):e;const{is:qc,defineProperty:Gc,getOwnPropertyDescriptor:Qc,getOwnPropertyNames:Yc,getOwnPropertySymbols:Jc,getPrototypeOf:Zc}=Object,ss=globalThis,ea=ss.trustedTypes,Xc=ea?ea.emptyScript:"",ed=ss.reactiveElementPolyfillSupport,Zt=(e,t)=>e,Hn={toAttribute(e,t){switch(t){case Boolean:e=e?Xc:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let n=e;switch(t){case Boolean:n=e!==null;break;case Number:n=e===null?null:Number(e);break;case Object:case Array:try{n=JSON.parse(e)}catch{n=null}}return n}},Ni=(e,t)=>!qc(e,t),ta={attribute:!0,type:String,converter:Hn,reflect:!1,useDefault:!1,hasChanged:Ni};Symbol.metadata??=Symbol("metadata"),ss.litPropertyMetadata??=new WeakMap;let Mt=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,n=ta){if(n.state&&(n.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((n=Object.create(n)).wrapped=!0),this.elementProperties.set(t,n),!n.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,n);i!==void 0&&Gc(this.prototype,t,i)}}static getPropertyDescriptor(t,n,s){const{get:i,set:o}=Qc(this.prototype,t)??{get(){return this[n]},set(a){this[n]=a}};return{get:i,set(a){const l=i?.call(this);o?.call(this,a),this.requestUpdate(t,l,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??ta}static _$Ei(){if(this.hasOwnProperty(Zt("elementProperties")))return;const t=Zc(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Zt("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Zt("properties"))){const n=this.properties,s=[...Yc(n),...Jc(n)];for(const i of s)this.createProperty(i,n[i])}const t=this[Symbol.metadata];if(t!==null){const n=litPropertyMetadata.get(t);if(n!==void 0)for(const[s,i]of n)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[n,s]of this.elementProperties){const i=this._$Eu(n,s);i!==void 0&&this._$Eh.set(i,n)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const n=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const i of s)n.unshift(Xo(i))}else t!==void 0&&n.push(Xo(t));return n}static _$Eu(t,n){const s=n.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,n=this.constructor.elementProperties;for(const s of n.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Vc(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,n,s){this._$AK(t,s)}_$ET(t,n){const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(i!==void 0&&s.reflect===!0){const o=(s.converter?.toAttribute!==void 0?s.converter:Hn).toAttribute(n,s.type);this._$Em=t,o==null?this.removeAttribute(i):this.setAttribute(i,o),this._$Em=null}}_$AK(t,n){const s=this.constructor,i=s._$Eh.get(t);if(i!==void 0&&this._$Em!==i){const o=s.getPropertyOptions(i),a=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:Hn;this._$Em=i;const l=a.fromAttribute(n,o.type);this[i]=l??this._$Ej?.get(i)??l,this._$Em=null}}requestUpdate(t,n,s,i=!1,o){if(t!==void 0){const a=this.constructor;if(i===!1&&(o=this[t]),s??=a.getPropertyOptions(t),!((s.hasChanged??Ni)(o,n)||s.useDefault&&s.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(a._$Eu(t,s))))return;this.C(t,n,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,n,{useDefault:s,reflect:i,wrapped:o},a){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,a??n??this[t]),o!==!0||a!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(n=void 0),this._$AL.set(t,n)),i===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(n){Promise.reject(n)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[i,o]of this._$Ep)this[i]=o;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,o]of s){const{wrapped:a}=o,l=this[i];a!==!0||this._$AL.has(i)||l===void 0||this.C(i,void 0,o,l)}}let t=!1;const n=this._$AL;try{t=this.shouldUpdate(n),t?(this.willUpdate(n),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(n)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(n)}willUpdate(t){}_$AE(t){this._$EO?.forEach(n=>n.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(n=>this._$ET(n,this[n])),this._$EM()}updated(t){}firstUpdated(t){}};Mt.elementStyles=[],Mt.shadowRootOptions={mode:"open"},Mt[Zt("elementProperties")]=new Map,Mt[Zt("finalized")]=new Map,ed?.({ReactiveElement:Mt}),(ss.reactiveElementVersions??=[]).push("2.1.2");const Oi=globalThis,na=e=>e,jn=Oi.trustedTypes,sa=jn?jn.createPolicy("lit-html",{createHTML:e=>e}):void 0,Fr="$lit$",Qe=`lit$${Math.random().toFixed(9).slice(2)}$`,Nr="?"+Qe,td=`<${Nr}>`,bt=document,sn=()=>bt.createComment(""),on=e=>e===null||typeof e!="object"&&typeof e!="function",Bi=Array.isArray,nd=e=>Bi(e)||typeof e?.[Symbol.iterator]=="function",Rs=`[ 	
\f\r]`,zt=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,ia=/-->/g,oa=/>/g,at=RegExp(`>|${Rs}(?:([^\\s"'>=/]+)(${Rs}*=${Rs}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),aa=/'/g,ra=/"/g,Or=/^(?:script|style|textarea|title)$/i,Br=e=>(t,...n)=>({_$litType$:e,strings:t,values:n}),r=Br(1),$n=Br(2),Je=Symbol.for("lit-noChange"),v=Symbol.for("lit-nothing"),la=new WeakMap,ft=bt.createTreeWalker(bt,129);function Ur(e,t){if(!Bi(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return sa!==void 0?sa.createHTML(t):t}const sd=(e,t)=>{const n=e.length-1,s=[];let i,o=t===2?"<svg>":t===3?"<math>":"",a=zt;for(let l=0;l<n;l++){const c=e[l];let g,p,u=-1,h=0;for(;h<c.length&&(a.lastIndex=h,p=a.exec(c),p!==null);)h=a.lastIndex,a===zt?p[1]==="!--"?a=ia:p[1]!==void 0?a=oa:p[2]!==void 0?(Or.test(p[2])&&(i=RegExp("</"+p[2],"g")),a=at):p[3]!==void 0&&(a=at):a===at?p[0]===">"?(a=i??zt,u=-1):p[1]===void 0?u=-2:(u=a.lastIndex-p[2].length,g=p[1],a=p[3]===void 0?at:p[3]==='"'?ra:aa):a===ra||a===aa?a=at:a===ia||a===oa?a=zt:(a=at,i=void 0);const f=a===at&&e[l+1].startsWith("/>")?" ":"";o+=a===zt?c+td:u>=0?(s.push(g),c.slice(0,u)+Fr+c.slice(u)+Qe+f):c+Qe+(u===-2?l:f)}return[Ur(e,o+(e[n]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class an{constructor({strings:t,_$litType$:n},s){let i;this.parts=[];let o=0,a=0;const l=t.length-1,c=this.parts,[g,p]=sd(t,n);if(this.el=an.createElement(g,s),ft.currentNode=this.el.content,n===2||n===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(i=ft.nextNode())!==null&&c.length<l;){if(i.nodeType===1){if(i.hasAttributes())for(const u of i.getAttributeNames())if(u.endsWith(Fr)){const h=p[a++],f=i.getAttribute(u).split(Qe),d=/([.?@])?(.*)/.exec(h);c.push({type:1,index:o,name:d[2],strings:f,ctor:d[1]==="."?od:d[1]==="?"?ad:d[1]==="@"?rd:os}),i.removeAttribute(u)}else u.startsWith(Qe)&&(c.push({type:6,index:o}),i.removeAttribute(u));if(Or.test(i.tagName)){const u=i.textContent.split(Qe),h=u.length-1;if(h>0){i.textContent=jn?jn.emptyScript:"";for(let f=0;f<h;f++)i.append(u[f],sn()),ft.nextNode(),c.push({type:2,index:++o});i.append(u[h],sn())}}}else if(i.nodeType===8)if(i.data===Nr)c.push({type:2,index:o});else{let u=-1;for(;(u=i.data.indexOf(Qe,u+1))!==-1;)c.push({type:7,index:o}),u+=Qe.length-1}o++}}static createElement(t,n){const s=bt.createElement("template");return s.innerHTML=t,s}}function Dt(e,t,n=e,s){if(t===Je)return t;let i=s!==void 0?n._$Co?.[s]:n._$Cl;const o=on(t)?void 0:t._$litDirective$;return i?.constructor!==o&&(i?._$AO?.(!1),o===void 0?i=void 0:(i=new o(e),i._$AT(e,n,s)),s!==void 0?(n._$Co??=[])[s]=i:n._$Cl=i),i!==void 0&&(t=Dt(e,i._$AS(e,t.values),i,s)),t}class id{constructor(t,n){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=n}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:n},parts:s}=this._$AD,i=(t?.creationScope??bt).importNode(n,!0);ft.currentNode=i;let o=ft.nextNode(),a=0,l=0,c=s[0];for(;c!==void 0;){if(a===c.index){let g;c.type===2?g=new is(o,o.nextSibling,this,t):c.type===1?g=new c.ctor(o,c.name,c.strings,this,t):c.type===6&&(g=new ld(o,this,t)),this._$AV.push(g),c=s[++l]}a!==c?.index&&(o=ft.nextNode(),a++)}return ft.currentNode=bt,i}p(t){let n=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,n),n+=s.strings.length-2):s._$AI(t[n])),n++}}let is=class zr{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,n,s,i){this.type=2,this._$AH=v,this._$AN=void 0,this._$AA=t,this._$AB=n,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const n=this._$AM;return n!==void 0&&t?.nodeType===11&&(t=n.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,n=this){t=Dt(this,t,n),on(t)?t===v||t==null||t===""?(this._$AH!==v&&this._$AR(),this._$AH=v):t!==this._$AH&&t!==Je&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):nd(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==v&&on(this._$AH)?this._$AA.nextSibling.data=t:this.T(bt.createTextNode(t)),this._$AH=t}$(t){const{values:n,_$litType$:s}=t,i=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=an.createElement(Ur(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(n);else{const o=new id(i,this),a=o.u(this.options);o.p(n),this.T(a),this._$AH=o}}_$AC(t){let n=la.get(t.strings);return n===void 0&&la.set(t.strings,n=new an(t)),n}k(t){Bi(this._$AH)||(this._$AH=[],this._$AR());const n=this._$AH;let s,i=0;for(const o of t)i===n.length?n.push(s=new zr(this.O(sn()),this.O(sn()),this,this.options)):s=n[i],s._$AI(o),i++;i<n.length&&(this._$AR(s&&s._$AB.nextSibling,i),n.length=i)}_$AR(t=this._$AA.nextSibling,n){for(this._$AP?.(!1,!0,n);t!==this._$AB;){const s=na(t).nextSibling;na(t).remove(),t=s}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},os=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,n,s,i,o){this.type=1,this._$AH=v,this._$AN=void 0,this.element=t,this.name=n,this._$AM=i,this.options=o,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=v}_$AI(t,n=this,s,i){const o=this.strings;let a=!1;if(o===void 0)t=Dt(this,t,n,0),a=!on(t)||t!==this._$AH&&t!==Je,a&&(this._$AH=t);else{const l=t;let c,g;for(t=o[0],c=0;c<o.length-1;c++)g=Dt(this,l[s+c],n,c),g===Je&&(g=this._$AH[c]),a||=!on(g)||g!==this._$AH[c],g===v?t=v:t!==v&&(t+=(g??"")+o[c+1]),this._$AH[c]=g}a&&!i&&this.j(t)}j(t){t===v?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},od=class extends os{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===v?void 0:t}},ad=class extends os{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==v)}},rd=class extends os{constructor(t,n,s,i,o){super(t,n,s,i,o),this.type=5}_$AI(t,n=this){if((t=Dt(this,t,n,0)??v)===Je)return;const s=this._$AH,i=t===v&&s!==v||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,o=t!==v&&(s===v||i);i&&this.element.removeEventListener(this.name,this,s),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},ld=class{constructor(t,n,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=n,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){Dt(this,t)}};const cd={I:is},dd=Oi.litHtmlPolyfillSupport;dd?.(an,is),(Oi.litHtmlVersions??=[]).push("3.3.2");const ud=(e,t,n)=>{const s=n?.renderBefore??t;let i=s._$litPart$;if(i===void 0){const o=n?.renderBefore??null;s._$litPart$=i=new is(t.insertBefore(sn(),o),o,void 0,n??{})}return i._$AI(e),i};const Ui=globalThis;let Pt=class extends Mt{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const n=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=ud(n,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return Je}};Pt._$litElement$=!0,Pt.finalized=!0,Ui.litElementHydrateSupport?.({LitElement:Pt});const gd=Ui.litElementPolyfillSupport;gd?.({LitElement:Pt});(Ui.litElementVersions??=[]).push("4.2.2");const Hr=e=>(t,n)=>{n!==void 0?n.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};const pd={attribute:!0,type:String,converter:Hn,reflect:!1,hasChanged:Ni},hd=(e=pd,t,n)=>{const{kind:s,metadata:i}=n;let o=globalThis.litPropertyMetadata.get(i);if(o===void 0&&globalThis.litPropertyMetadata.set(i,o=new Map),s==="setter"&&((e=Object.create(e)).wrapped=!0),o.set(n.name,e),s==="accessor"){const{name:a}=n;return{set(l){const c=t.get.call(this);t.set.call(this,l),this.requestUpdate(a,c,e,!0,l)},init(l){return l!==void 0&&this.C(a,void 0,e,l),l}}}if(s==="setter"){const{name:a}=n;return function(l){const c=this[a];t.call(this,l),this.requestUpdate(a,c,e,!0,l)}}throw Error("Unsupported decorator location: "+s)};function as(e){return(t,n)=>typeof n=="object"?hd(e,t,n):((s,i,o)=>{const a=i.hasOwnProperty(o);return i.constructor.createProperty(o,s),a?Object.getOwnPropertyDescriptor(i,o):void 0})(e,t,n)}function x(e){return as({...e,state:!0,attribute:!1})}async function be(e,t){if(!(!e.client||!e.connected)&&!e.channelsLoading){e.channelsLoading=!0,e.channelsError=null;try{const n=await e.client.request("channels.status",{probe:t,timeoutMs:8e3});e.channelsSnapshot=n,e.channelsLastSuccess=Date.now()}catch(n){e.channelsError=String(n)}finally{e.channelsLoading=!1}}}async function fd(e,t){if(!(!e.client||!e.connected||e.whatsappBusy)){e.whatsappBusy=!0;try{const n=await e.client.request("web.login.start",{force:t,timeoutMs:3e4});e.whatsappLoginMessage=n.message??null,e.whatsappLoginQrDataUrl=n.qrDataUrl??null,e.whatsappLoginConnected=null}catch(n){e.whatsappLoginMessage=String(n),e.whatsappLoginQrDataUrl=null,e.whatsappLoginConnected=null}finally{e.whatsappBusy=!1}}}async function md(e){if(!(!e.client||!e.connected||e.whatsappBusy)){e.whatsappBusy=!0;try{const t=await e.client.request("web.login.wait",{timeoutMs:12e4});e.whatsappLoginMessage=t.message??null,e.whatsappLoginConnected=t.connected??null,t.connected&&(e.whatsappLoginQrDataUrl=null)}catch(t){e.whatsappLoginMessage=String(t),e.whatsappLoginConnected=null}finally{e.whatsappBusy=!1}}}async function vd(e){if(!(!e.client||!e.connected||e.whatsappBusy)){e.whatsappBusy=!0;try{await e.client.request("channels.logout",{channel:"whatsapp"}),e.whatsappLoginMessage="Logged out.",e.whatsappLoginQrDataUrl=null,e.whatsappLoginConnected=null}catch(t){e.whatsappLoginMessage=String(t)}finally{e.whatsappBusy=!1}}}function yt(e){return typeof structuredClone=="function"?structuredClone(e):JSON.parse(JSON.stringify(e))}function Ft(e){return`${JSON.stringify(e,null,2).trimEnd()}
`}function jr(e,t,n){if(t.length===0)return;let s=e;for(let o=0;o<t.length-1;o+=1){const a=t[o],l=t[o+1];if(typeof a=="number"){if(!Array.isArray(s))return;s[a]==null&&(s[a]=typeof l=="number"?[]:{}),s=s[a]}else{if(typeof s!="object"||s==null)return;const c=s;c[a]==null&&(c[a]=typeof l=="number"?[]:{}),s=c[a]}}const i=t[t.length-1];if(typeof i=="number"){Array.isArray(s)&&(s[i]=n);return}typeof s=="object"&&s!=null&&(s[i]=n)}function Kr(e,t){if(t.length===0)return;let n=e;for(let i=0;i<t.length-1;i+=1){const o=t[i];if(typeof o=="number"){if(!Array.isArray(n))return;n=n[o]}else{if(typeof n!="object"||n==null)return;n=n[o]}if(n==null)return}const s=t[t.length-1];if(typeof s=="number"){Array.isArray(n)&&n.splice(s,1);return}typeof n=="object"&&n!=null&&delete n[s]}async function Ie(e){if(!(!e.client||!e.connected)){e.configLoading=!0,e.lastError=null;try{const t=await e.client.request("config.get",{});yd(e,t)}catch(t){e.lastError=String(t)}finally{e.configLoading=!1}}}async function Wr(e){if(!(!e.client||!e.connected)&&!e.configSchemaLoading){e.configSchemaLoading=!0;try{const t=await e.client.request("config.schema",{});bd(e,t)}catch(t){e.lastError=String(t)}finally{e.configSchemaLoading=!1}}}function bd(e,t){e.configSchema=t.schema??null,e.configUiHints=t.uiHints??{},e.configSchemaVersion=t.version??null}function yd(e,t){e.configSnapshot=t;const n=typeof t.raw=="string"?t.raw:t.config&&typeof t.config=="object"?Ft(t.config):e.configRaw;!e.configFormDirty||e.configFormMode==="raw"?e.configRaw=n:e.configForm?e.configRaw=Ft(e.configForm):e.configRaw=n,e.configValid=typeof t.valid=="boolean"?t.valid:null,e.configIssues=Array.isArray(t.issues)?t.issues:[],e.configFormDirty||(e.configForm=yt(t.config??{}),e.configFormOriginal=yt(t.config??{}),e.configRawOriginal=n)}async function On(e){if(!(!e.client||!e.connected)){e.configSaving=!0,e.lastError=null;try{const t=e.configFormMode==="form"&&e.configForm?Ft(e.configForm):e.configRaw,n=e.configSnapshot?.hash;if(!n){e.lastError="Config hash missing; reload and retry.";return}await e.client.request("config.set",{raw:t,baseHash:n}),e.configFormDirty=!1,await Ie(e)}catch(t){e.lastError=String(t)}finally{e.configSaving=!1}}}async function xd(e){if(!(!e.client||!e.connected)){e.configApplying=!0,e.lastError=null;try{const t=e.configFormMode==="form"&&e.configForm?Ft(e.configForm):e.configRaw,n=e.configSnapshot?.hash;if(!n){e.lastError="Config hash missing; reload and retry.";return}await e.client.request("config.apply",{raw:t,baseHash:n,sessionKey:e.applySessionKey}),e.configFormDirty=!1,await Ie(e)}catch(t){e.lastError=String(t)}finally{e.configApplying=!1}}}async function wd(e){if(!(!e.client||!e.connected)){e.updateRunning=!0,e.lastError=null;try{await e.client.request("update.run",{sessionKey:e.applySessionKey})}catch(t){e.lastError=String(t)}finally{e.updateRunning=!1}}}function ke(e,t,n){const s=yt(e.configForm??e.configSnapshot?.config??{});jr(s,t,n),e.configForm=s,e.configFormDirty=!0,e.configFormMode==="form"&&(e.configRaw=Ft(s))}function Ke(e,t){const n=yt(e.configForm??e.configSnapshot?.config??{});Kr(n,t),e.configForm=n,e.configFormDirty=!0,e.configFormMode==="form"&&(e.configRaw=Ft(n))}function $d(e){const{values:t,original:n}=e;return t.name!==n.name||t.displayName!==n.displayName||t.about!==n.about||t.picture!==n.picture||t.banner!==n.banner||t.website!==n.website||t.nip05!==n.nip05||t.lud16!==n.lud16}function kd(e){const{state:t,callbacks:n,accountId:s}=e,i=$d(t),o=(l,c,g={})=>{const{type:p="text",placeholder:u,maxLength:h,help:f}=g,d=t.values[l]??"",m=t.fieldErrors[l],k=`nostr-profile-${l}`;return p==="textarea"?r`
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
          type=${p}
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
    `},a=()=>{const l=t.values.picture;return l?r`
      <div style="margin-bottom: 12px;">
        <img
          src=${l}
          alt="Profile picture preview"
          style="max-width: 80px; max-height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);"
          @error=${c=>{const g=c.target;g.style.display="none"}}
          @load=${c=>{const g=c.target;g.style.display="block"}}
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

      ${a()}

      ${o("name","Username",{placeholder:"satoshi",maxLength:256,help:"Short username (e.g., satoshi)"})}

      ${o("displayName","Display Name",{placeholder:"Satoshi Nakamoto",maxLength:256,help:"Your full display name"})}

      ${o("about","Bio",{type:"textarea",placeholder:"Tell people about yourself...",maxLength:2e3,help:"A brief bio or description"})}

      ${o("picture","Avatar URL",{type:"url",placeholder:"https://example.com/avatar.jpg",help:"HTTPS URL to your profile picture"})}

      ${t.showAdvanced?r`
            <div style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
              <div style="font-weight: 500; margin-bottom: 12px; color: var(--text-muted);">Advanced</div>

              ${o("banner","Banner URL",{type:"url",placeholder:"https://example.com/banner.jpg",help:"HTTPS URL to a banner image"})}

              ${o("website","Website",{type:"url",placeholder:"https://example.com",help:"Your personal website"})}

              ${o("nip05","NIP-05 Identifier",{placeholder:"you@example.com",help:"Verifiable identifier (e.g., you@domain.com)"})}

              ${o("lud16","Lightning Address",{placeholder:"you@getalby.com",help:"Lightning address for tips (LUD-16)"})}
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
  `}function Sd(e){const t={name:e?.name??"",displayName:e?.displayName??"",about:e?.about??"",picture:e?.picture??"",banner:e?.banner??"",website:e?.website??"",nip05:e?.nip05??"",lud16:e?.lud16??""};return{values:t,original:{...t},saving:!1,importing:!1,error:null,success:null,fieldErrors:{},showAdvanced:!!(e?.banner||e?.website||e?.nip05||e?.lud16)}}async function Cd(e,t){await fd(e,t),await be(e,!0)}async function Ad(e){await md(e),await be(e,!0)}async function Td(e){await vd(e),await be(e,!0)}async function _d(e){await On(e),await Ie(e),await be(e,!0)}async function Ed(e){await Ie(e),await be(e,!0)}function Ld(e){if(!Array.isArray(e))return{};const t={};for(const n of e){if(typeof n!="string")continue;const[s,...i]=n.split(":");if(!s||i.length===0)continue;const o=s.trim(),a=i.join(":").trim();o&&a&&(t[o]=a)}return t}function Vr(e){return(e.channelsSnapshot?.channelAccounts?.nostr??[])[0]?.accountId??e.nostrProfileAccountId??"default"}function qr(e,t=""){return`/api/channels/nostr/${encodeURIComponent(e)}/profile${t}`}function Id(e,t,n){e.nostrProfileAccountId=t,e.nostrProfileFormState=Sd(n??void 0)}function Md(e){e.nostrProfileFormState=null,e.nostrProfileAccountId=null}function Rd(e,t,n){const s=e.nostrProfileFormState;s&&(e.nostrProfileFormState={...s,values:{...s.values,[t]:n},fieldErrors:{...s.fieldErrors,[t]:""}})}function Pd(e){const t=e.nostrProfileFormState;t&&(e.nostrProfileFormState={...t,showAdvanced:!t.showAdvanced})}async function Dd(e){const t=e.nostrProfileFormState;if(!t||t.saving)return;const n=Vr(e);e.nostrProfileFormState={...t,saving:!0,error:null,success:null,fieldErrors:{}};try{const s=await fetch(qr(n),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(t.values)}),i=await s.json().catch(()=>null);if(!s.ok||i?.ok===!1||!i){const o=i?.error??`Profile update failed (${s.status})`;e.nostrProfileFormState={...t,saving:!1,error:o,success:null,fieldErrors:Ld(i?.details)};return}if(!i.persisted){e.nostrProfileFormState={...t,saving:!1,error:"Profile publish failed on all relays.",success:null};return}e.nostrProfileFormState={...t,saving:!1,error:null,success:"Profile published to relays.",fieldErrors:{},original:{...t.values}},await be(e,!0)}catch(s){e.nostrProfileFormState={...t,saving:!1,error:`Profile update failed: ${String(s)}`,success:null}}}async function Fd(e){const t=e.nostrProfileFormState;if(!t||t.importing)return;const n=Vr(e);e.nostrProfileFormState={...t,importing:!0,error:null,success:null};try{const s=await fetch(qr(n,"/import"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({autoMerge:!0})}),i=await s.json().catch(()=>null);if(!s.ok||i?.ok===!1||!i){const c=i?.error??`Profile import failed (${s.status})`;e.nostrProfileFormState={...t,importing:!1,error:c,success:null};return}const o=i.merged??i.imported??null,a=o?{...t.values,...o}:t.values,l=!!(a.banner||a.website||a.nip05||a.lud16);e.nostrProfileFormState={...t,importing:!1,values:a,error:null,success:i.saved?"Profile imported from relays. Review and publish.":"Profile imported. Review and publish.",showAdvanced:l},i.saved&&await be(e,!0)}catch(s){e.nostrProfileFormState={...t,importing:!1,error:`Profile import failed: ${String(s)}`,success:null}}}function zi(e){const t=(e??"").trim().toLowerCase();if(!t)return null;const n=t.split(":").filter(Boolean);if(n.length<3||n[0]!=="agent")return null;const s=n[1]?.trim(),i=n.slice(2).join(":");return!s||!i?null:{agentId:s,rest:i}}const ci=450;function dn(e,t=!1,n=!1){e.chatScrollFrame&&cancelAnimationFrame(e.chatScrollFrame),e.chatScrollTimeout!=null&&(clearTimeout(e.chatScrollTimeout),e.chatScrollTimeout=null);const s=()=>{const i=e.querySelector(".chat-thread");if(i){const o=getComputedStyle(i).overflowY;if(o==="auto"||o==="scroll"||i.scrollHeight-i.clientHeight>1)return i}return document.scrollingElement??document.documentElement};e.updateComplete.then(()=>{e.chatScrollFrame=requestAnimationFrame(()=>{e.chatScrollFrame=null;const i=s();if(!i)return;const o=i.scrollHeight-i.scrollTop-i.clientHeight,a=t&&!e.chatHasAutoScrolled;if(!(a||e.chatUserNearBottom||o<ci)){e.chatNewMessagesBelow=!0;return}a&&(e.chatHasAutoScrolled=!0);const c=n&&(typeof window>"u"||typeof window.matchMedia!="function"||!window.matchMedia("(prefers-reduced-motion: reduce)").matches),g=i.scrollHeight;typeof i.scrollTo=="function"?i.scrollTo({top:g,behavior:c?"smooth":"auto"}):i.scrollTop=g,e.chatUserNearBottom=!0,e.chatNewMessagesBelow=!1;const p=a?150:120;e.chatScrollTimeout=window.setTimeout(()=>{e.chatScrollTimeout=null;const u=s();if(!u)return;const h=u.scrollHeight-u.scrollTop-u.clientHeight;(a||e.chatUserNearBottom||h<ci)&&(u.scrollTop=u.scrollHeight,e.chatUserNearBottom=!0)},p)})})}function Gr(e,t=!1){e.logsScrollFrame&&cancelAnimationFrame(e.logsScrollFrame),e.updateComplete.then(()=>{e.logsScrollFrame=requestAnimationFrame(()=>{e.logsScrollFrame=null;const n=e.querySelector(".log-stream");if(!n)return;const s=n.scrollHeight-n.scrollTop-n.clientHeight;(t||s<80)&&(n.scrollTop=n.scrollHeight)})})}function Nd(e,t){const n=t.currentTarget;if(!n)return;const s=n.scrollHeight-n.scrollTop-n.clientHeight;e.chatUserNearBottom=s<ci,e.chatUserNearBottom&&(e.chatNewMessagesBelow=!1)}function Od(e,t){const n=t.currentTarget;if(!n)return;const s=n.scrollHeight-n.scrollTop-n.clientHeight;e.logsAtBottom=s<80}function ca(e){e.chatHasAutoScrolled=!1,e.chatUserNearBottom=!0,e.chatNewMessagesBelow=!1}function Bd(e,t){if(e.length===0)return;const n=new Blob([`${e.join(`
`)}
`],{type:"text/plain"}),s=URL.createObjectURL(n),i=document.createElement("a"),o=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");i.href=s,i.download=`winclaw-logs-${t}-${o}.log`,i.click(),URL.revokeObjectURL(s)}function Ud(e){if(typeof ResizeObserver>"u")return;const t=e.querySelector(".topbar");if(!t)return;const n=()=>{const{height:s}=t.getBoundingClientRect();e.style.setProperty("--topbar-height",`${s}px`)};n(),e.topbarObserver=new ResizeObserver(()=>n()),e.topbarObserver.observe(t)}async function rs(e){if(!(!e.client||!e.connected)&&!e.debugLoading){e.debugLoading=!0;try{const[t,n,s,i]=await Promise.all([e.client.request("status",{}),e.client.request("health",{}),e.client.request("models.list",{}),e.client.request("last-heartbeat",{})]);e.debugStatus=t,e.debugHealth=n;const o=s;e.debugModels=Array.isArray(o?.models)?o?.models:[],e.debugHeartbeat=i}catch(t){e.debugCallError=String(t)}finally{e.debugLoading=!1}}}async function zd(e){if(!(!e.client||!e.connected)){e.debugCallError=null,e.debugCallResult=null;try{const t=e.debugCallParams.trim()?JSON.parse(e.debugCallParams):{},n=await e.client.request(e.debugCallMethod.trim(),t);e.debugCallResult=JSON.stringify(n,null,2)}catch(t){e.debugCallError=String(t)}}}const Hd=2e3,jd=new Set(["trace","debug","info","warn","error","fatal"]);function Kd(e){if(typeof e!="string")return null;const t=e.trim();if(!t.startsWith("{")||!t.endsWith("}"))return null;try{const n=JSON.parse(t);return!n||typeof n!="object"?null:n}catch{return null}}function Wd(e){if(typeof e!="string")return null;const t=e.toLowerCase();return jd.has(t)?t:null}function Vd(e){if(!e.trim())return{raw:e,message:e};try{const t=JSON.parse(e),n=t&&typeof t._meta=="object"&&t._meta!==null?t._meta:null,s=typeof t.time=="string"?t.time:typeof n?.date=="string"?n?.date:null,i=Wd(n?.logLevelName??n?.level),o=typeof t[0]=="string"?t[0]:typeof n?.name=="string"?n?.name:null,a=Kd(o);let l=null;a&&(typeof a.subsystem=="string"?l=a.subsystem:typeof a.module=="string"&&(l=a.module)),!l&&o&&o.length<120&&(l=o);let c=null;return typeof t[1]=="string"?c=t[1]:!a&&typeof t[0]=="string"?c=t[0]:typeof t.message=="string"&&(c=t.message),{raw:e,time:s,level:i,subsystem:l,message:c??e,meta:n??void 0}}catch{return{raw:e,message:e}}}async function Hi(e,t){if(!(!e.client||!e.connected)&&!(e.logsLoading&&!t?.quiet)){t?.quiet||(e.logsLoading=!0),e.logsError=null;try{const s=await e.client.request("logs.tail",{cursor:t?.reset?void 0:e.logsCursor??void 0,limit:e.logsLimit,maxBytes:e.logsMaxBytes}),o=(Array.isArray(s.lines)?s.lines.filter(l=>typeof l=="string"):[]).map(Vd),a=!!(t?.reset||s.reset||e.logsCursor==null);e.logsEntries=a?o:[...e.logsEntries,...o].slice(-Hd),typeof s.cursor=="number"&&(e.logsCursor=s.cursor),typeof s.file=="string"&&(e.logsFile=s.file),e.logsTruncated=!!s.truncated,e.logsLastFetchAt=Date.now()}catch(n){e.logsError=String(n)}finally{t?.quiet||(e.logsLoading=!1)}}}async function ls(e,t){if(!(!e.client||!e.connected)&&!e.nodesLoading){e.nodesLoading=!0,t?.quiet||(e.lastError=null);try{const n=await e.client.request("node.list",{});e.nodes=Array.isArray(n.nodes)?n.nodes:[]}catch(n){t?.quiet||(e.lastError=String(n))}finally{e.nodesLoading=!1}}}function qd(e){e.nodesPollInterval==null&&(e.nodesPollInterval=window.setInterval(()=>{ls(e,{quiet:!0})},5e3))}function Gd(e){e.nodesPollInterval!=null&&(clearInterval(e.nodesPollInterval),e.nodesPollInterval=null)}function ji(e){e.logsPollInterval==null&&(e.logsPollInterval=window.setInterval(()=>{e.tab==="logs"&&Hi(e,{quiet:!0})},2e3))}function Ki(e){e.logsPollInterval!=null&&(clearInterval(e.logsPollInterval),e.logsPollInterval=null)}function Wi(e){e.debugPollInterval==null&&(e.debugPollInterval=window.setInterval(()=>{e.tab==="debug"&&rs(e)},3e3))}function Vi(e){e.debugPollInterval!=null&&(clearInterval(e.debugPollInterval),e.debugPollInterval=null)}async function Qr(e,t){if(!(!e.client||!e.connected||e.agentIdentityLoading)&&!e.agentIdentityById[t]){e.agentIdentityLoading=!0,e.agentIdentityError=null;try{const n=await e.client.request("agent.identity.get",{agentId:t});n&&(e.agentIdentityById={...e.agentIdentityById,[t]:n})}catch(n){e.agentIdentityError=String(n)}finally{e.agentIdentityLoading=!1}}}async function Yr(e,t){if(!e.client||!e.connected||e.agentIdentityLoading)return;const n=t.filter(s=>!e.agentIdentityById[s]);if(n.length!==0){e.agentIdentityLoading=!0,e.agentIdentityError=null;try{for(const s of n){const i=await e.client.request("agent.identity.get",{agentId:s});i&&(e.agentIdentityById={...e.agentIdentityById,[s]:i})}}catch(s){e.agentIdentityError=String(s)}finally{e.agentIdentityLoading=!1}}}async function Bn(e,t){if(!(!e.client||!e.connected)&&!e.agentSkillsLoading){e.agentSkillsLoading=!0,e.agentSkillsError=null;try{const n=await e.client.request("skills.status",{agentId:t});n&&(e.agentSkillsReport=n,e.agentSkillsAgentId=t)}catch(n){e.agentSkillsError=String(n)}finally{e.agentSkillsLoading=!1}}}async function qi(e,t){if(!(!e.client||!e.connected)&&!e.agentsLoading){e.agentsLoading=!0,e.agentsError=null;try{const n=await e.client.request("agents.list",{});if(n){e.agentsList=n;const s=e.agentsSelectedId,i=n.agents.some(o=>o.id===s);(!s||!i)&&(e.agentsSelectedId=n.defaultId??n.agents[0]?.id??null)}}catch(n){e.agentsError=String(n)}finally{e.agentsLoading=!1}}}function Gi(e,t){if(e==null||!Number.isFinite(e)||e<=0)return;if(e<1e3)return`${Math.round(e)}ms`;const n=t?.spaced?" ":"",s=Math.round(e/1e3),i=Math.floor(s/3600),o=Math.floor(s%3600/60),a=s%60;if(i>=24){const l=Math.floor(i/24),c=i%24;return c>0?`${l}d${n}${c}h`:`${l}d`}return i>0?o>0?`${i}h${n}${o}m`:`${i}h`:o>0?a>0?`${o}m${n}${a}s`:`${o}m`:`${a}s`}function Qi(e,t="n/a"){if(e==null||!Number.isFinite(e)||e<0)return t;if(e<1e3)return`${Math.round(e)}ms`;const n=Math.round(e/1e3);if(n<60)return`${n}s`;const s=Math.round(n/60);if(s<60)return`${s}m`;const i=Math.round(s/60);return i<24?`${i}h`:`${Math.round(i/24)}d`}function Y(e,t){const n=t?.fallback??"n/a";if(e==null||!Number.isFinite(e))return n;const s=Date.now()-e,i=Math.abs(s),o=s>=0,a=Math.round(i/1e3);if(a<60)return o?"just now":"in <1m";const l=Math.round(a/60);if(l<60)return o?`${l}m ago`:`in ${l}m`;const c=Math.round(l/60);if(c<48)return o?`${c}h ago`:`in ${c}h`;const g=Math.round(c/24);return o?`${g}d ago`:`in ${g}d`}function da(e){const t=[],n=/(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(?:\n\2(?:\n|$)|$)/g;for(const i of e.matchAll(n)){const o=(i.index??0)+i[1].length;t.push({start:o,end:o+i[0].length-i[1].length})}const s=/`+[^`]+`+/g;for(const i of e.matchAll(s)){const o=i.index??0,a=o+i[0].length;t.some(c=>o>=c.start&&a<=c.end)||t.push({start:o,end:a})}return t.sort((i,o)=>i.start-o.start),t}function ua(e,t){return t.some(n=>e>=n.start&&e<n.end)}const Qd=/<\s*\/?\s*(?:think(?:ing)?|thought|antthinking|final)\b/i,kn=/<\s*\/?\s*final\b[^<>]*>/gi,ga=/<\s*(\/?)\s*(?:think(?:ing)?|thought|antthinking)\b[^<>]*>/gi;function Yd(e,t){return e.trimStart()}function Jd(e,t){if(!e||!Qd.test(e))return e;let n=e;if(kn.test(n)){kn.lastIndex=0;const l=[],c=da(n);for(const g of n.matchAll(kn)){const p=g.index??0;l.push({start:p,length:g[0].length,inCode:ua(p,c)})}for(let g=l.length-1;g>=0;g--){const p=l[g];p.inCode||(n=n.slice(0,p.start)+n.slice(p.start+p.length))}}else kn.lastIndex=0;const s=da(n);ga.lastIndex=0;let i="",o=0,a=!1;for(const l of n.matchAll(ga)){const c=l.index??0,g=l[1]==="/";ua(c,s)||(a?g&&(a=!1):(i+=n.slice(o,c),g||(a=!0)),o=c+l[0].length)}return i+=n.slice(o),Yd(i)}function xt(e){return!e&&e!==0?"n/a":new Date(e).toLocaleString()}function di(e){return!e||e.length===0?"none":e.filter(t=>!!(t&&t.trim())).join(", ")}function ui(e,t=120){return e.length<=t?e:`${e.slice(0,Math.max(0,t-1))}…`}function Jr(e,t){return e.length<=t?{text:e,truncated:!1,total:e.length}:{text:e.slice(0,Math.max(0,t)),truncated:!0,total:e.length}}function Kn(e,t){const n=Number(e);return Number.isFinite(n)?n:t}function Ps(e){return Jd(e)}async function un(e){if(!(!e.client||!e.connected))try{const t=await e.client.request("cron.status",{});e.cronStatus=t}catch(t){e.cronError=String(t)}}async function cs(e){if(!(!e.client||!e.connected)&&!e.cronLoading){e.cronLoading=!0,e.cronError=null;try{const t=await e.client.request("cron.list",{includeDisabled:!0});e.cronJobs=Array.isArray(t.jobs)?t.jobs:[]}catch(t){e.cronError=String(t)}finally{e.cronLoading=!1}}}function Zd(e){if(e.scheduleKind==="at"){const n=Date.parse(e.scheduleAt);if(!Number.isFinite(n))throw new Error("Invalid run time.");return{kind:"at",at:new Date(n).toISOString()}}if(e.scheduleKind==="every"){const n=Kn(e.everyAmount,0);if(n<=0)throw new Error("Invalid interval amount.");const s=e.everyUnit;return{kind:"every",everyMs:n*(s==="minutes"?6e4:s==="hours"?36e5:864e5)}}const t=e.cronExpr.trim();if(!t)throw new Error("Cron expression required.");return{kind:"cron",expr:t,tz:e.cronTz.trim()||void 0}}function Xd(e){if(e.payloadKind==="systemEvent"){const i=e.payloadText.trim();if(!i)throw new Error("System event text required.");return{kind:"systemEvent",text:i}}const t=e.payloadText.trim();if(!t)throw new Error("Agent message required.");const n={kind:"agentTurn",message:t},s=Kn(e.timeoutSeconds,0);return s>0&&(n.timeoutSeconds=s),n}async function eu(e){if(!(!e.client||!e.connected||e.cronBusy)){e.cronBusy=!0,e.cronError=null;try{const t=Zd(e.cronForm),n=Xd(e.cronForm),s=e.cronForm.sessionTarget==="isolated"&&e.cronForm.payloadKind==="agentTurn"&&e.cronForm.deliveryMode?{mode:e.cronForm.deliveryMode==="announce"?"announce":"none",channel:e.cronForm.deliveryChannel.trim()||"last",to:e.cronForm.deliveryTo.trim()||void 0}:void 0,i=e.cronForm.agentId.trim(),o={name:e.cronForm.name.trim(),description:e.cronForm.description.trim()||void 0,agentId:i||void 0,enabled:e.cronForm.enabled,schedule:t,sessionTarget:e.cronForm.sessionTarget,wakeMode:e.cronForm.wakeMode,payload:n,delivery:s};if(!o.name)throw new Error("Name required.");await e.client.request("cron.add",o),e.cronForm={...e.cronForm,name:"",description:"",payloadText:""},await cs(e),await un(e)}catch(t){e.cronError=String(t)}finally{e.cronBusy=!1}}}async function tu(e,t,n){if(!(!e.client||!e.connected||e.cronBusy)){e.cronBusy=!0,e.cronError=null;try{await e.client.request("cron.update",{id:t.id,patch:{enabled:n}}),await cs(e),await un(e)}catch(s){e.cronError=String(s)}finally{e.cronBusy=!1}}}async function nu(e,t){if(!(!e.client||!e.connected||e.cronBusy)){e.cronBusy=!0,e.cronError=null;try{await e.client.request("cron.run",{id:t.id,mode:"force"}),await Zr(e,t.id)}catch(n){e.cronError=String(n)}finally{e.cronBusy=!1}}}async function su(e,t){if(!(!e.client||!e.connected||e.cronBusy)){e.cronBusy=!0,e.cronError=null;try{await e.client.request("cron.remove",{id:t.id}),e.cronRunsJobId===t.id&&(e.cronRunsJobId=null,e.cronRuns=[]),await cs(e),await un(e)}catch(n){e.cronError=String(n)}finally{e.cronBusy=!1}}}async function Zr(e,t){if(!(!e.client||!e.connected))try{const n=await e.client.request("cron.runs",{id:t,limit:50});e.cronRunsJobId=t,e.cronRuns=Array.isArray(n.entries)?n.entries:[]}catch(n){e.cronError=String(n)}}const Xr="winclaw.device.auth.v1";function Yi(e){return e.trim()}function iu(e){if(!Array.isArray(e))return[];const t=new Set;for(const n of e){const s=n.trim();s&&t.add(s)}return[...t].toSorted()}function Ji(){try{const e=window.localStorage.getItem(Xr);if(!e)return null;const t=JSON.parse(e);return!t||t.version!==1||!t.deviceId||typeof t.deviceId!="string"||!t.tokens||typeof t.tokens!="object"?null:t}catch{return null}}function el(e){try{window.localStorage.setItem(Xr,JSON.stringify(e))}catch{}}function ou(e){const t=Ji();if(!t||t.deviceId!==e.deviceId)return null;const n=Yi(e.role),s=t.tokens[n];return!s||typeof s.token!="string"?null:s}function tl(e){const t=Yi(e.role),n={version:1,deviceId:e.deviceId,tokens:{}},s=Ji();s&&s.deviceId===e.deviceId&&(n.tokens={...s.tokens});const i={token:e.token,role:t,scopes:iu(e.scopes),updatedAtMs:Date.now()};return n.tokens[t]=i,el(n),i}function nl(e){const t=Ji();if(!t||t.deviceId!==e.deviceId)return;const n=Yi(e.role);if(!t.tokens[n])return;const s={...t,tokens:{...t.tokens}};delete s.tokens[n],el(s)}const sl={p:0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffedn,n:0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3edn,h:8n,a:0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffecn,d:0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3n,Gx:0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51an,Gy:0x6666666666666666666666666666666666666666666666666666666666666658n},{p:ge,n:Un,Gx:pa,Gy:ha,a:Ds,d:Fs,h:au}=sl,wt=32,Zi=64,ru=(...e)=>{"captureStackTrace"in Error&&typeof Error.captureStackTrace=="function"&&Error.captureStackTrace(...e)},re=(e="")=>{const t=new Error(e);throw ru(t,re),t},lu=e=>typeof e=="bigint",cu=e=>typeof e=="string",du=e=>e instanceof Uint8Array||ArrayBuffer.isView(e)&&e.constructor.name==="Uint8Array",et=(e,t,n="")=>{const s=du(e),i=e?.length,o=t!==void 0;if(!s||o&&i!==t){const a=n&&`"${n}" `,l=o?` of length ${t}`:"",c=s?`length=${i}`:`type=${typeof e}`;re(a+"expected Uint8Array"+l+", got "+c)}return e},ds=e=>new Uint8Array(e),il=e=>Uint8Array.from(e),ol=(e,t)=>e.toString(16).padStart(t,"0"),al=e=>Array.from(et(e)).map(t=>ol(t,2)).join(""),We={_0:48,_9:57,A:65,F:70,a:97,f:102},fa=e=>{if(e>=We._0&&e<=We._9)return e-We._0;if(e>=We.A&&e<=We.F)return e-(We.A-10);if(e>=We.a&&e<=We.f)return e-(We.a-10)},rl=e=>{const t="hex invalid";if(!cu(e))return re(t);const n=e.length,s=n/2;if(n%2)return re(t);const i=ds(s);for(let o=0,a=0;o<s;o++,a+=2){const l=fa(e.charCodeAt(a)),c=fa(e.charCodeAt(a+1));if(l===void 0||c===void 0)return re(t);i[o]=l*16+c}return i},ll=()=>globalThis?.crypto,uu=()=>ll()?.subtle??re("crypto.subtle must be defined, consider polyfill"),rn=(...e)=>{const t=ds(e.reduce((s,i)=>s+et(i).length,0));let n=0;return e.forEach(s=>{t.set(s,n),n+=s.length}),t},gu=(e=wt)=>ll().getRandomValues(ds(e)),Wn=BigInt,dt=(e,t,n,s="bad number: out of range")=>lu(e)&&t<=e&&e<n?e:re(s),F=(e,t=ge)=>{const n=e%t;return n>=0n?n:t+n},cl=e=>F(e,Un),pu=(e,t)=>{(e===0n||t<=0n)&&re("no inverse n="+e+" mod="+t);let n=F(e,t),s=t,i=0n,o=1n;for(;n!==0n;){const a=s/n,l=s%n,c=i-o*a;s=n,n=l,i=o,o=c}return s===1n?F(i,t):re("no inverse")},hu=e=>{const t=pl[e];return typeof t!="function"&&re("hashes."+e+" not set"),t},Ns=e=>e instanceof Ce?e:re("Point expected"),gi=2n**256n;class Ce{static BASE;static ZERO;X;Y;Z;T;constructor(t,n,s,i){const o=gi;this.X=dt(t,0n,o),this.Y=dt(n,0n,o),this.Z=dt(s,1n,o),this.T=dt(i,0n,o),Object.freeze(this)}static CURVE(){return sl}static fromAffine(t){return new Ce(t.x,t.y,1n,F(t.x*t.y))}static fromBytes(t,n=!1){const s=Fs,i=il(et(t,wt)),o=t[31];i[31]=o&-129;const a=ul(i);dt(a,0n,n?gi:ge);const c=F(a*a),g=F(c-1n),p=F(s*c+1n);let{isValid:u,value:h}=mu(g,p);u||re("bad point: y not sqrt");const f=(h&1n)===1n,d=(o&128)!==0;return!n&&h===0n&&d&&re("bad point: x==0, isLastByteOdd"),d!==f&&(h=F(-h)),new Ce(h,a,1n,F(h*a))}static fromHex(t,n){return Ce.fromBytes(rl(t),n)}get x(){return this.toAffine().x}get y(){return this.toAffine().y}assertValidity(){const t=Ds,n=Fs,s=this;if(s.is0())return re("bad point: ZERO");const{X:i,Y:o,Z:a,T:l}=s,c=F(i*i),g=F(o*o),p=F(a*a),u=F(p*p),h=F(c*t),f=F(p*F(h+g)),d=F(u+F(n*F(c*g)));if(f!==d)return re("bad point: equation left != right (1)");const m=F(i*o),k=F(a*l);return m!==k?re("bad point: equation left != right (2)"):this}equals(t){const{X:n,Y:s,Z:i}=this,{X:o,Y:a,Z:l}=Ns(t),c=F(n*l),g=F(o*i),p=F(s*l),u=F(a*i);return c===g&&p===u}is0(){return this.equals(Rt)}negate(){return new Ce(F(-this.X),this.Y,this.Z,F(-this.T))}double(){const{X:t,Y:n,Z:s}=this,i=Ds,o=F(t*t),a=F(n*n),l=F(2n*F(s*s)),c=F(i*o),g=t+n,p=F(F(g*g)-o-a),u=c+a,h=u-l,f=c-a,d=F(p*h),m=F(u*f),k=F(p*f),S=F(h*u);return new Ce(d,m,S,k)}add(t){const{X:n,Y:s,Z:i,T:o}=this,{X:a,Y:l,Z:c,T:g}=Ns(t),p=Ds,u=Fs,h=F(n*a),f=F(s*l),d=F(o*u*g),m=F(i*c),k=F((n+s)*(a+l)-h-f),S=F(m-d),$=F(m+d),A=F(f-p*h),C=F(k*S),T=F($*A),_=F(k*A),I=F(S*$);return new Ce(C,T,I,_)}subtract(t){return this.add(Ns(t).negate())}multiply(t,n=!0){if(!n&&(t===0n||this.is0()))return Rt;if(dt(t,1n,Un),t===1n)return this;if(this.equals($t))return Tu(t).p;let s=Rt,i=$t;for(let o=this;t>0n;o=o.double(),t>>=1n)t&1n?s=s.add(o):n&&(i=i.add(o));return s}multiplyUnsafe(t){return this.multiply(t,!1)}toAffine(){const{X:t,Y:n,Z:s}=this;if(this.equals(Rt))return{x:0n,y:1n};const i=pu(s,ge);F(s*i)!==1n&&re("invalid inverse");const o=F(t*i),a=F(n*i);return{x:o,y:a}}toBytes(){const{x:t,y:n}=this.assertValidity().toAffine(),s=dl(n);return s[31]|=t&1n?128:0,s}toHex(){return al(this.toBytes())}clearCofactor(){return this.multiply(Wn(au),!1)}isSmallOrder(){return this.clearCofactor().is0()}isTorsionFree(){let t=this.multiply(Un/2n,!1).double();return Un%2n&&(t=t.add(this)),t.is0()}}const $t=new Ce(pa,ha,1n,F(pa*ha)),Rt=new Ce(0n,1n,1n,0n);Ce.BASE=$t;Ce.ZERO=Rt;const dl=e=>rl(ol(dt(e,0n,gi),Zi)).reverse(),ul=e=>Wn("0x"+al(il(et(e)).reverse())),Pe=(e,t)=>{let n=e;for(;t-- >0n;)n*=n,n%=ge;return n},fu=e=>{const n=e*e%ge*e%ge,s=Pe(n,2n)*n%ge,i=Pe(s,1n)*e%ge,o=Pe(i,5n)*i%ge,a=Pe(o,10n)*o%ge,l=Pe(a,20n)*a%ge,c=Pe(l,40n)*l%ge,g=Pe(c,80n)*c%ge,p=Pe(g,80n)*c%ge,u=Pe(p,10n)*o%ge;return{pow_p_5_8:Pe(u,2n)*e%ge,b2:n}},ma=0x2b8324804fc1df0b2b4d00993dfbd7a72f431806ad2fe478c4ee1b274a0ea0b0n,mu=(e,t)=>{const n=F(t*t*t),s=F(n*n*t),i=fu(e*s).pow_p_5_8;let o=F(e*n*i);const a=F(t*o*o),l=o,c=F(o*ma),g=a===e,p=a===F(-e),u=a===F(-e*ma);return g&&(o=l),(p||u)&&(o=c),(F(o)&1n)===1n&&(o=F(-o)),{isValid:g||p,value:o}},pi=e=>cl(ul(e)),Xi=(...e)=>pl.sha512Async(rn(...e)),vu=(...e)=>hu("sha512")(rn(...e)),gl=e=>{const t=e.slice(0,wt);t[0]&=248,t[31]&=127,t[31]|=64;const n=e.slice(wt,Zi),s=pi(t),i=$t.multiply(s),o=i.toBytes();return{head:t,prefix:n,scalar:s,point:i,pointBytes:o}},eo=e=>Xi(et(e,wt)).then(gl),bu=e=>gl(vu(et(e,wt))),yu=e=>eo(e).then(t=>t.pointBytes),xu=e=>Xi(e.hashable).then(e.finish),wu=(e,t,n)=>{const{pointBytes:s,scalar:i}=e,o=pi(t),a=$t.multiply(o).toBytes();return{hashable:rn(a,s,n),finish:g=>{const p=cl(o+pi(g)*i);return et(rn(a,dl(p)),Zi)}}},$u=async(e,t)=>{const n=et(e),s=await eo(t),i=await Xi(s.prefix,n);return xu(wu(s,i,n))},pl={sha512Async:async e=>{const t=uu(),n=rn(e);return ds(await t.digest("SHA-512",n.buffer))},sha512:void 0},ku=(e=gu(wt))=>e,Su={getExtendedPublicKeyAsync:eo,getExtendedPublicKey:bu,randomSecretKey:ku},Vn=8,Cu=256,hl=Math.ceil(Cu/Vn)+1,hi=2**(Vn-1),Au=()=>{const e=[];let t=$t,n=t;for(let s=0;s<hl;s++){n=t,e.push(n);for(let i=1;i<hi;i++)n=n.add(t),e.push(n);t=n.double()}return e};let va;const ba=(e,t)=>{const n=t.negate();return e?n:t},Tu=e=>{const t=va||(va=Au());let n=Rt,s=$t;const i=2**Vn,o=i,a=Wn(i-1),l=Wn(Vn);for(let c=0;c<hl;c++){let g=Number(e&a);e>>=l,g>hi&&(g-=o,e+=1n);const p=c*hi,u=p,h=p+Math.abs(g)-1,f=c%2!==0,d=g<0;g===0?s=s.add(ba(f,t[u])):n=n.add(ba(d,t[h]))}return e!==0n&&re("invalid wnaf"),{p:n,f:s}},Os="winclaw-device-identity-v1";function fi(e){let t="";for(const n of e)t+=String.fromCharCode(n);return btoa(t).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}function fl(e){const t=e.replaceAll("-","+").replaceAll("_","/"),n=t+"=".repeat((4-t.length%4)%4),s=atob(n),i=new Uint8Array(s.length);for(let o=0;o<s.length;o+=1)i[o]=s.charCodeAt(o);return i}function _u(e){return Array.from(e).map(t=>t.toString(16).padStart(2,"0")).join("")}async function ml(e){const t=await crypto.subtle.digest("SHA-256",e.slice().buffer);return _u(new Uint8Array(t))}async function Eu(){const e=Su.randomSecretKey(),t=await yu(e);return{deviceId:await ml(t),publicKey:fi(t),privateKey:fi(e)}}async function to(){try{const n=localStorage.getItem(Os);if(n){const s=JSON.parse(n);if(s?.version===1&&typeof s.deviceId=="string"&&typeof s.publicKey=="string"&&typeof s.privateKey=="string"){const i=await ml(fl(s.publicKey));if(i!==s.deviceId){const o={...s,deviceId:i};return localStorage.setItem(Os,JSON.stringify(o)),{deviceId:i,publicKey:s.publicKey,privateKey:s.privateKey}}return{deviceId:s.deviceId,publicKey:s.publicKey,privateKey:s.privateKey}}}}catch{}const e=await Eu(),t={version:1,deviceId:e.deviceId,publicKey:e.publicKey,privateKey:e.privateKey,createdAtMs:Date.now()};return localStorage.setItem(Os,JSON.stringify(t)),e}async function Lu(e,t){const n=fl(e),s=new TextEncoder().encode(t),i=await $u(s,n);return fi(i)}async function tt(e,t){if(!(!e.client||!e.connected)&&!e.devicesLoading){e.devicesLoading=!0,t?.quiet||(e.devicesError=null);try{const n=await e.client.request("device.pair.list",{});e.devicesList={pending:Array.isArray(n?.pending)?n.pending:[],paired:Array.isArray(n?.paired)?n.paired:[]}}catch(n){t?.quiet||(e.devicesError=String(n))}finally{e.devicesLoading=!1}}}async function Iu(e,t){if(!(!e.client||!e.connected))try{await e.client.request("device.pair.approve",{requestId:t}),await tt(e)}catch(n){e.devicesError=String(n)}}async function Mu(e,t){if(!(!e.client||!e.connected||!window.confirm("Reject this device pairing request?")))try{await e.client.request("device.pair.reject",{requestId:t}),await tt(e)}catch(s){e.devicesError=String(s)}}async function Ru(e,t){if(!(!e.client||!e.connected))try{const n=await e.client.request("device.token.rotate",t);if(n?.token){const s=await to(),i=n.role??t.role;(n.deviceId===s.deviceId||t.deviceId===s.deviceId)&&tl({deviceId:s.deviceId,role:i,token:n.token,scopes:n.scopes??t.scopes??[]}),window.prompt("New device token (copy and store securely):",n.token)}await tt(e)}catch(n){e.devicesError=String(n)}}async function Pu(e,t){if(!(!e.client||!e.connected||!window.confirm(`Revoke token for ${t.deviceId} (${t.role})?`)))try{await e.client.request("device.token.revoke",t);const s=await to();t.deviceId===s.deviceId&&nl({deviceId:s.deviceId,role:t.role}),await tt(e)}catch(s){e.devicesError=String(s)}}function Du(e){if(!e||e.kind==="gateway")return{method:"exec.approvals.get",params:{}};const t=e.nodeId.trim();return t?{method:"exec.approvals.node.get",params:{nodeId:t}}:null}function Fu(e,t){if(!e||e.kind==="gateway")return{method:"exec.approvals.set",params:t};const n=e.nodeId.trim();return n?{method:"exec.approvals.node.set",params:{...t,nodeId:n}}:null}async function no(e,t){if(!(!e.client||!e.connected)&&!e.execApprovalsLoading){e.execApprovalsLoading=!0,e.lastError=null;try{const n=Du(t);if(!n){e.lastError="Select a node before loading exec approvals.";return}const s=await e.client.request(n.method,n.params);Nu(e,s)}catch(n){e.lastError=String(n)}finally{e.execApprovalsLoading=!1}}}function Nu(e,t){e.execApprovalsSnapshot=t,e.execApprovalsDirty||(e.execApprovalsForm=yt(t.file??{}))}async function Ou(e,t){if(!(!e.client||!e.connected)){e.execApprovalsSaving=!0,e.lastError=null;try{const n=e.execApprovalsSnapshot?.hash;if(!n){e.lastError="Exec approvals hash missing; reload and retry.";return}const s=e.execApprovalsForm??e.execApprovalsSnapshot?.file??{},i=Fu(t,{file:s,baseHash:n});if(!i){e.lastError="Select a node before saving exec approvals.";return}await e.client.request(i.method,i.params),e.execApprovalsDirty=!1,await no(e,t)}catch(n){e.lastError=String(n)}finally{e.execApprovalsSaving=!1}}}function Bu(e,t,n){const s=yt(e.execApprovalsForm??e.execApprovalsSnapshot?.file??{});jr(s,t,n),e.execApprovalsForm=s,e.execApprovalsDirty=!0}function Uu(e,t){const n=yt(e.execApprovalsForm??e.execApprovalsSnapshot?.file??{});Kr(n,t),e.execApprovalsForm=n,e.execApprovalsDirty=!0}async function so(e){if(!(!e.client||!e.connected)&&!e.personalInfoLoading){e.personalInfoLoading=!0,e.personalInfoError=null,e.personalInfoSuccess=null;try{const t=await e.client.request("personal-info.get",{});e.personalInfo=t,e.personalInfoForm={...t},e.personalInfoDirty=!1}catch(t){e.personalInfoError=String(t)}finally{e.personalInfoLoading=!1}}}async function zu(e){if(!(!e.client||!e.connected||!e.personalInfoForm)){e.personalInfoSaving=!0,e.personalInfoError=null,e.personalInfoSuccess=null;try{const t=await e.client.request("personal-info.save",{employeeId:e.personalInfoForm.employeeId,employeeName:e.personalInfoForm.employeeName,employeeEmail:e.personalInfoForm.employeeEmail,grcUrl:e.personalInfoForm.grcUrl});e.personalInfoDirty=!1;let n="保存しました";t.grcSynced?n+=" (GRC同期完了)":t.grcError&&(n+=` (GRC同期失敗: ${t.grcError})`),e.personalInfoSuccess=n,await so(e)}catch(t){e.personalInfoError=String(t)}finally{e.personalInfoSaving=!1}}}function Hu(e,t,n){e.personalInfoForm&&(e.personalInfoForm={...e.personalInfoForm,[t]:n},e.personalInfoDirty=!0,e.personalInfoSuccess=null)}async function io(e){if(!(!e.client||!e.connected)&&!e.presenceLoading){e.presenceLoading=!0,e.presenceError=null,e.presenceStatus=null;try{const t=await e.client.request("system-presence",{});Array.isArray(t)?(e.presenceEntries=t,e.presenceStatus=t.length===0?"No instances yet.":null):(e.presenceEntries=[],e.presenceStatus="No presence payload.")}catch(t){e.presenceError=String(t)}finally{e.presenceLoading=!1}}}async function nt(e,t){if(!(!e.client||!e.connected)&&!e.sessionsLoading){e.sessionsLoading=!0,e.sessionsError=null;try{const n=t?.includeGlobal??e.sessionsIncludeGlobal,s=t?.includeUnknown??e.sessionsIncludeUnknown,i=t?.activeMinutes??Kn(e.sessionsFilterActive,0),o=t?.limit??Kn(e.sessionsFilterLimit,0),a={includeGlobal:n,includeUnknown:s,includeDerivedTitles:!0};i>0&&(a.activeMinutes=i),o>0&&(a.limit=o);const l=await e.client.request("sessions.list",a);l&&(e.sessionsResult=l)}catch(n){e.sessionsError=String(n)}finally{e.sessionsLoading=!1}}}async function oo(e,t,n){if(!e.client||!e.connected)return;const s={key:t};"label"in n&&(s.label=n.label),"thinkingLevel"in n&&(s.thinkingLevel=n.thinkingLevel),"verboseLevel"in n&&(s.verboseLevel=n.verboseLevel),"reasoningLevel"in n&&(s.reasoningLevel=n.reasoningLevel),"model"in n&&(s.model=n.model),"workspace"in n&&(s.workspace=n.workspace);try{await e.client.request("sessions.patch",s),await nt(e)}catch(i){e.sessionsError=String(i)}}async function ju(e,t){if(!(!e.client||!e.connected||e.sessionsLoading||!window.confirm(`Delete session "${t}"?

Deletes the session entry and archives its transcript.`))){e.sessionsLoading=!0,e.sessionsError=null;try{await e.client.request("sessions.delete",{key:t,deleteTranscript:!0}),await nt(e)}catch(s){e.sessionsError=String(s)}finally{e.sessionsLoading=!1}}}function Nt(e,t,n){if(!t.trim())return;const s={...e.skillMessages};n?s[t]=n:delete s[t],e.skillMessages=s}function us(e){return e instanceof Error?e.message:String(e)}async function gn(e,t){if(t?.clearMessages&&Object.keys(e.skillMessages).length>0&&(e.skillMessages={}),!(!e.client||!e.connected)&&!e.skillsLoading){e.skillsLoading=!0,e.skillsError=null;try{const n=await e.client.request("skills.status",{});n&&(e.skillsReport=n)}catch(n){e.skillsError=us(n)}finally{e.skillsLoading=!1}}}function Ku(e,t,n){e.skillEdits={...e.skillEdits,[t]:n}}async function Wu(e,t,n){if(!(!e.client||!e.connected)){e.skillsBusyKey=t,e.skillsError=null;try{await e.client.request("skills.update",{skillKey:t,enabled:n}),await gn(e),Nt(e,t,{kind:"success",message:n?"Skill enabled":"Skill disabled"})}catch(s){const i=us(s);e.skillsError=i,Nt(e,t,{kind:"error",message:i})}finally{e.skillsBusyKey=null}}}async function Vu(e,t){if(!(!e.client||!e.connected)){e.skillsBusyKey=t,e.skillsError=null;try{const n=e.skillEdits[t]??"";await e.client.request("skills.update",{skillKey:t,apiKey:n}),await gn(e),Nt(e,t,{kind:"success",message:"API key saved"})}catch(n){const s=us(n);e.skillsError=s,Nt(e,t,{kind:"error",message:s})}finally{e.skillsBusyKey=null}}}async function qu(e,t,n,s){if(!(!e.client||!e.connected)){e.skillsBusyKey=t,e.skillsError=null;try{const i=await e.client.request("skills.install",{name:n,installId:s,timeoutMs:12e4});await gn(e),Nt(e,t,{kind:"success",message:i?.message??"Installed"})}catch(i){const o=us(i);e.skillsError=o,Nt(e,t,{kind:"error",message:o})}finally{e.skillsBusyKey=null}}}const vl={agents:"/agents",overview:"/overview",channels:"/channels",instances:"/instances",sessions:"/sessions",usage:"/usage",cron:"/cron",skills:"/skills",nodes:"/nodes",chat:"/chat","digital-human":"/digital-human",personal:"/personal",config:"/config",debug:"/debug",logs:"/logs"},bl=new Map(Object.entries(vl).map(([e,t])=>[t,e]));function pn(e){if(!e)return"";let t=e.trim();return t.startsWith("/")||(t=`/${t}`),t==="/"?"":(t.endsWith("/")&&(t=t.slice(0,-1)),t)}function ln(e){if(!e)return"/";let t=e.trim();return t.startsWith("/")||(t=`/${t}`),t.length>1&&t.endsWith("/")&&(t=t.slice(0,-1)),t}function ao(e,t=""){const n=pn(t),s=vl[e];return n?`${n}${s}`:s}function yl(e,t=""){const n=pn(t);let s=e||"/";n&&(s===n?s="/":s.startsWith(`${n}/`)&&(s=s.slice(n.length)));let i=ln(s).toLowerCase();return i.endsWith("/index.html")&&(i="/"),i==="/"?"chat":bl.get(i)??null}function Gu(e){let t=ln(e);if(t.endsWith("/index.html")&&(t=ln(t.slice(0,-11))),t==="/")return"";const n=t.split("/").filter(Boolean);if(n.length===0)return"";for(let s=0;s<n.length;s++){const i=`/${n.slice(s).join("/")}`.toLowerCase();if(bl.has(i)){const o=n.slice(0,s);return o.length?`/${o.join("/")}`:""}}return`/${n.join("/")}`}function Qu(e){switch(e){case"agents":return"folder";case"chat":return"messageSquare";case"overview":return"barChart";case"channels":return"link";case"instances":return"radio";case"sessions":return"fileText";case"usage":return"barChart";case"cron":return"loader";case"skills":return"zap";case"nodes":return"monitor";case"personal":return"user";case"config":return"settings";case"debug":return"bug";case"logs":return"scrollText";case"digital-human":return"monitor";default:return"folder"}}function mi(e){switch(e){case"agents":return"Agents";case"overview":return"Overview";case"channels":return"Channels";case"instances":return"Instances";case"sessions":return"Sessions";case"usage":return"Usage";case"cron":return"Cron Jobs";case"skills":return"Skills";case"nodes":return"Nodes";case"chat":return"Chat";case"personal":return R("commands.personalInfo");case"config":return"Config";case"debug":return"Debug";case"logs":return"Logs";case"digital-human":return"Digital Human";default:return"Control"}}function ya(){return[R("commands.chat"),R("commands.services"),R("commands.system")]}function Bs(){const e=R("commands.chat"),t=R("commands.services"),n=R("commands.system");return[{id:"new-chat",label:R("commands.newConversation"),category:e,icon:"messageSquare",shortcut:"Ctrl+N",keywords:["new","chat","会話","新規"]},{id:"history",label:R("commands.conversationHistory"),category:e,icon:"fileText",tab:"sessions",shortcut:"Ctrl+H",keywords:["history","履歴","sessions"]},{id:"channels",label:R("commands.channelManagement"),category:t,icon:"link",tab:"channels",keywords:["channels","チャネル","slack","discord","telegram"]},{id:"agents",label:R("commands.agentSettings"),category:t,icon:"folder",tab:"agents",keywords:["agents","エージェント"]},{id:"cron",label:R("commands.scheduleManagement"),category:t,icon:"loader",tab:"cron",keywords:["cron","schedule","スケジュール"]},{id:"personal",label:R("commands.personalInfo"),category:n,icon:"user",tab:"personal",keywords:["personal","個人情報","従業員","employee","profile"]},{id:"settings",label:R("commands.settings"),category:n,icon:"settings",tab:"config",shortcut:"Ctrl+,",keywords:["config","設定","settings"]},{id:"overview",label:R("commands.dashboard"),category:n,icon:"barChart",tab:"overview",keywords:["overview","ダッシュボード","dashboard"]},{id:"usage",label:R("commands.checkUsage"),category:n,icon:"barChart",tab:"usage",keywords:["usage","使用量","cost","コスト"]},{id:"skills",label:R("commands.skillManagement"),category:n,icon:"zap",tab:"skills",keywords:["skills","スキル"]},{id:"logs",label:R("commands.showLogs"),category:n,icon:"scrollText",tab:"logs",keywords:["logs","ログ"]},{id:"debug",label:R("commands.debug"),category:n,icon:"bug",tab:"debug",keywords:["debug","デバッグ"]},{id:"nodes",label:R("commands.nodeManagement"),category:n,icon:"monitor",tab:"nodes",keywords:["nodes","ノード"]},{id:"instances",label:R("commands.instances"),category:n,icon:"radio",tab:"instances",keywords:["instances","インスタンス"]}]}function Yu(e){switch(e){case"agents":return"Manage agent workspaces, tools, and identities.";case"overview":return"Gateway status, entry points, and a fast health read.";case"channels":return"Manage channels and settings.";case"instances":return"Presence beacons from connected clients and nodes.";case"sessions":return"Inspect active sessions and adjust per-session defaults.";case"usage":return"";case"cron":return"Schedule wakeups and recurring agent runs.";case"skills":return"Manage skill availability and API key injection.";case"nodes":return"Paired devices, capabilities, and command exposure.";case"chat":return"Direct gateway chat session for quick interventions.";case"personal":return R("personal.subtitle");case"config":return"Edit ~/.winclaw/winclaw.json (WinClaw config) safely.";case"debug":return"Gateway snapshots, events, and manual RPC calls.";case"logs":return"Live tail of the gateway file logs.";case"digital-human":return"Real-time voice conversation with your digital human avatar.";default:return""}}const xl="winclaw.control.settings.v1";function Ju(){const t={gatewayUrl:`${location.protocol==="https:"?"wss":"ws"}://${location.host}`,token:"",sessionKey:"main",lastActiveSessionKey:"main",theme:"system",chatFocusMode:!1,chatShowThinking:!0,splitRatio:.6,navCollapsed:!1,navGroupsCollapsed:{},openTabs:["chat"],recentCommands:[],openChatSessions:[]};try{const n=localStorage.getItem(xl);if(!n)return t;const s=JSON.parse(n);return{gatewayUrl:typeof s.gatewayUrl=="string"&&s.gatewayUrl.trim()?s.gatewayUrl.trim():t.gatewayUrl,token:typeof s.token=="string"?s.token:t.token,sessionKey:typeof s.sessionKey=="string"&&s.sessionKey.trim()?s.sessionKey.trim():t.sessionKey,lastActiveSessionKey:typeof s.lastActiveSessionKey=="string"&&s.lastActiveSessionKey.trim()?s.lastActiveSessionKey.trim():typeof s.sessionKey=="string"&&s.sessionKey.trim()||t.lastActiveSessionKey,theme:s.theme==="light"||s.theme==="dark"||s.theme==="system"?s.theme:t.theme,chatFocusMode:typeof s.chatFocusMode=="boolean"?s.chatFocusMode:t.chatFocusMode,chatShowThinking:typeof s.chatShowThinking=="boolean"?s.chatShowThinking:t.chatShowThinking,splitRatio:typeof s.splitRatio=="number"&&s.splitRatio>=.4&&s.splitRatio<=.7?s.splitRatio:t.splitRatio,navCollapsed:typeof s.navCollapsed=="boolean"?s.navCollapsed:t.navCollapsed,navGroupsCollapsed:typeof s.navGroupsCollapsed=="object"&&s.navGroupsCollapsed!==null?s.navGroupsCollapsed:t.navGroupsCollapsed,openTabs:Array.isArray(s.openTabs)&&s.openTabs.every(i=>typeof i=="string")?s.openTabs:t.openTabs,recentCommands:Array.isArray(s.recentCommands)&&s.recentCommands.every(i=>typeof i=="string")?s.recentCommands:t.recentCommands,openChatSessions:Array.isArray(s.openChatSessions)&&s.openChatSessions.every(i=>typeof i=="string")?s.openChatSessions:t.openChatSessions}}catch{return t}}function Zu(e){localStorage.setItem(xl,JSON.stringify(e))}const Sn=e=>Number.isNaN(e)?.5:e<=0?0:e>=1?1:e,Xu=()=>typeof window>"u"||typeof window.matchMedia!="function"?!1:window.matchMedia("(prefers-reduced-motion: reduce)").matches??!1,Cn=e=>{e.classList.remove("theme-transition"),e.style.removeProperty("--theme-switch-x"),e.style.removeProperty("--theme-switch-y")},eg=({nextTheme:e,applyTheme:t,context:n,currentTheme:s})=>{if(s===e)return;const i=globalThis.document??null;if(!i){t();return}const o=i.documentElement,a=i,l=Xu();if(!!a.startViewTransition&&!l){let g=.5,p=.5;if(n?.pointerClientX!==void 0&&n?.pointerClientY!==void 0&&typeof window<"u")g=Sn(n.pointerClientX/window.innerWidth),p=Sn(n.pointerClientY/window.innerHeight);else if(n?.element){const u=n.element.getBoundingClientRect();u.width>0&&u.height>0&&typeof window<"u"&&(g=Sn((u.left+u.width/2)/window.innerWidth),p=Sn((u.top+u.height/2)/window.innerHeight))}o.style.setProperty("--theme-switch-x",`${g*100}%`),o.style.setProperty("--theme-switch-y",`${p*100}%`),o.classList.add("theme-transition");try{const u=a.startViewTransition?.(()=>{t()});u?.finished?u.finished.finally(()=>Cn(o)):Cn(o)}catch{Cn(o),t()}return}t(),Cn(o)};function tg(){return typeof window>"u"||typeof window.matchMedia!="function"||window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function ro(e){return e==="system"?tg():e}function Ze(e,t){const n={...t,lastActiveSessionKey:t.lastActiveSessionKey?.trim()||t.sessionKey.trim()||"main"};e.settings=n,Zu(n),t.theme!==e.theme&&(e.theme=t.theme,gs(e,ro(t.theme))),e.applySessionKey=e.settings.lastActiveSessionKey}function wl(e,t){const n=t.trim();n&&e.settings.lastActiveSessionKey!==n&&Ze(e,{...e.settings,lastActiveSessionKey:n})}function ng(e){if(!window.location.search&&!window.location.hash)return;const t=new URL(window.location.href),n=new URLSearchParams(t.search),s=new URLSearchParams(t.hash.startsWith("#")?t.hash.slice(1):t.hash),i=n.get("token")??s.get("token"),o=n.get("password")??s.get("password"),a=n.get("session")??s.get("session"),l=n.get("gatewayUrl")??s.get("gatewayUrl");let c=!1;if(i!=null){const p=i.trim();p&&p!==e.settings.token&&Ze(e,{...e.settings,token:p}),n.delete("token"),s.delete("token"),c=!0}if(o!=null){const p=o.trim();p&&(e.password=p),n.delete("password"),s.delete("password"),c=!0}if(a!=null){const p=a.trim();p&&(e.sessionKey=p,Ze(e,{...e.settings,sessionKey:p,lastActiveSessionKey:p}))}if(l!=null){const p=l.trim();p&&p!==e.settings.gatewayUrl&&(e.pendingGatewayUrl=p),n.delete("gatewayUrl"),s.delete("gatewayUrl"),c=!0}if(!c)return;t.search=n.toString();const g=s.toString();t.hash=g?`#${g}`:"",window.history.replaceState({},"",t.toString())}function sg(e,t){e.tab!==t&&(e.tab=t),t==="chat"&&(e.chatHasAutoScrolled=!1),t==="logs"?ji(e):Ki(e),t==="debug"?Wi(e):Vi(e),lo(e),kl(e,t,!1)}function ig(e,t,n){eg({nextTheme:t,applyTheme:()=>{e.theme=t,Ze(e,{...e.settings,theme:t}),gs(e,ro(t))},context:n,currentTheme:e.theme})}async function lo(e){if(e.tab==="personal"&&await so(e),e.tab==="overview"&&await Sl(e),e.tab==="channels"&&await ug(e),e.tab==="instances"&&await io(e),e.tab==="sessions"&&await nt(e),e.tab==="cron"&&await qn(e),e.tab==="skills"&&await gn(e),e.tab==="agents"){await qi(e),await Ie(e);const t=e.agentsList?.agents?.map(s=>s.id)??[];t.length>0&&Yr(e,t);const n=e.agentsSelectedId??e.agentsList?.defaultId??e.agentsList?.agents?.[0]?.id;n&&(Qr(e,n),e.agentsPanel==="skills"&&Bn(e,n),e.agentsPanel==="channels"&&be(e,!1),e.agentsPanel==="cron"&&qn(e))}e.tab==="nodes"&&(await ls(e),await tt(e),await Ie(e),await no(e)),e.tab==="chat"&&(await Pl(e),dn(e,!e.chatHasAutoScrolled)),e.tab==="config"&&(await Wr(e),await Ie(e)),e.tab==="debug"&&(await rs(e),e.eventLog=e.eventLogBuffer),e.tab==="logs"&&(e.logsAtBottom=!0,await Hi(e,{reset:!0}),Gr(e,!0))}function og(){if(typeof window>"u")return"";const e=window.__WINCLAW_CONTROL_UI_BASE_PATH__;return typeof e=="string"&&e.trim()?pn(e):Gu(window.location.pathname)}function ag(e){e.theme=e.settings.theme??"system",gs(e,ro(e.theme))}function gs(e,t){if(e.themeResolved=t,typeof document>"u")return;const n=document.documentElement;n.dataset.theme=t,n.style.colorScheme=t}function rg(e){if(typeof window>"u"||typeof window.matchMedia!="function")return;if(e.themeMedia=window.matchMedia("(prefers-color-scheme: dark)"),e.themeMediaHandler=n=>{e.theme==="system"&&gs(e,n.matches?"dark":"light")},typeof e.themeMedia.addEventListener=="function"){e.themeMedia.addEventListener("change",e.themeMediaHandler);return}e.themeMedia.addListener(e.themeMediaHandler)}function lg(e){if(!e.themeMedia||!e.themeMediaHandler)return;if(typeof e.themeMedia.removeEventListener=="function"){e.themeMedia.removeEventListener("change",e.themeMediaHandler);return}e.themeMedia.removeListener(e.themeMediaHandler),e.themeMedia=null,e.themeMediaHandler=null}function cg(e,t){if(typeof window>"u")return;const n=yl(window.location.pathname,e.basePath)??"chat";$l(e,n),kl(e,n,t)}function dg(e){if(typeof window>"u")return;const t=yl(window.location.pathname,e.basePath);if(!t)return;const s=new URL(window.location.href).searchParams.get("session")?.trim();s&&(e.sessionKey=s,Ze(e,{...e.settings,sessionKey:s,lastActiveSessionKey:s})),$l(e,t)}function $l(e,t){e.tab!==t&&(e.tab=t),t==="chat"&&(e.chatHasAutoScrolled=!1),t==="logs"?ji(e):Ki(e),t==="debug"?Wi(e):Vi(e),e.connected&&lo(e)}function kl(e,t,n){if(typeof window>"u")return;const s=ln(ao(t,e.basePath)),i=ln(window.location.pathname),o=new URL(window.location.href);t==="chat"&&e.sessionKey?o.searchParams.set("session",e.sessionKey):o.searchParams.delete("session"),i!==s&&(o.pathname=s),n?window.history.replaceState({},"",o.toString()):window.history.pushState({},"",o.toString())}async function Sl(e){await Promise.all([be(e,!1),io(e),nt(e),un(e),rs(e)])}async function ug(e){await Promise.all([be(e,!0),Wr(e),Ie(e)])}async function qn(e){await Promise.all([be(e,!1),un(e),cs(e)])}const xa=50,gg=80,pg=12e4,wa=5e3;function hg(e){if(!e||typeof e!="object")return null;const t=e;if(typeof t.text=="string")return t.text;const n=t.content;if(!Array.isArray(n))return null;const s=n.map(i=>{if(!i||typeof i!="object")return null;const o=i;return o.type==="text"&&typeof o.text=="string"?o.text:null}).filter(i=>!!i);return s.length===0?null:s.join(`
`)}function Gn(e){if(e==null)return null;if(typeof e=="number"||typeof e=="boolean")return String(e);const t=hg(e);let n;if(typeof e=="string")n=e;else if(t)n=t;else try{n=JSON.stringify(e,null,2)}catch{n=String(e)}const s=Jr(n,pg);return s.truncated?`${s.text}

… truncated (${s.total} chars, showing first ${s.text.length}).`:s.text}function fg(e){const t=[];return t.push({type:"toolcall",name:e.name,arguments:e.args??{}}),e.output&&t.push({type:"toolresult",name:e.name,text:e.output}),{role:"assistant",toolCallId:e.toolCallId,runId:e.runId,content:t,timestamp:e.startedAt}}function mg(e){if(e.toolStreamOrder.length<=xa)return;const t=e.toolStreamOrder.length-xa,n=e.toolStreamOrder.splice(0,t);for(const s of n)e.toolStreamById.delete(s)}function vg(e){e.chatToolMessages=e.toolStreamOrder.map(t=>e.toolStreamById.get(t)?.message).filter(t=>!!t)}function vi(e){e.toolStreamSyncTimer!=null&&(clearTimeout(e.toolStreamSyncTimer),e.toolStreamSyncTimer=null),vg(e)}function bg(e,t=!1){if(t){vi(e);return}e.toolStreamSyncTimer==null&&(e.toolStreamSyncTimer=window.setTimeout(()=>vi(e),gg))}function ps(e){e.toolStreamById.clear(),e.toolStreamOrder=[],e.chatToolMessages=[],vi(e)}const yg=5e3;function xg(e,t){const n=t.data??{},s=typeof n.phase=="string"?n.phase:"";e.compactionClearTimer!=null&&(window.clearTimeout(e.compactionClearTimer),e.compactionClearTimer=null),s==="start"?e.compactionStatus={active:!0,startedAt:Date.now(),completedAt:null}:s==="end"&&(e.compactionStatus={active:!1,startedAt:e.compactionStatus?.startedAt??null,completedAt:Date.now()},e.compactionClearTimer=window.setTimeout(()=>{e.compactionStatus=null,e.compactionClearTimer=null},yg))}function wg(e,t){if(!t)return;if(t.stream==="compaction"){xg(e,t);return}if(t.stream!=="tool")return;const n=typeof t.sessionKey=="string"?t.sessionKey:void 0;if(n&&n!==e.sessionKey||!n&&e.chatRunId&&t.runId!==e.chatRunId||e.chatRunId&&t.runId!==e.chatRunId||!e.chatRunId)return;const s=t.data??{},i=typeof s.toolCallId=="string"?s.toolCallId:"";if(!i)return;const o=typeof s.name=="string"?s.name:"tool",a=typeof s.phase=="string"?s.phase:"",l=a==="start"?s.args:void 0,c=a==="update"?Gn(s.partialResult):a==="result"?Gn(s.result):void 0,g=Date.now();let p=e.toolStreamById.get(i);p?(p.name=o,l!==void 0&&(p.args=l),c!==void 0&&(p.output=c||void 0),p.updatedAt=g):(p={toolCallId:i,runId:t.runId,sessionKey:n,name:o,args:l,output:c||void 0,startedAt:typeof t.ts=="number"?t.ts:g,updatedAt:g,message:{}},e.toolStreamById.set(i,p),e.toolStreamOrder.push(i)),p.message=fg(p),mg(e),bg(e,a==="result"),Sg(e,t,s,o,a)}function $g(e){return e==="Bash"||e==="bash"||e==="execute_command"}function kg(e,t){return t==="update"?Gn(e.partialResult):t==="result"?Gn(e.result):null}function Us(e){return e.length<=wa?e:e.slice(-wa)}function Sg(e,t,n,s,i){if(!$g(s))return;const o=typeof t.ts=="number"?t.ts:Date.now(),a=typeof n.toolCallId=="string"?n.toolCallId:void 0;if(i==="start"){const l=n.args,c=typeof l?.command=="string"?l.command:"",p=(typeof l?.description=="string"?l.description:"")||c;e.execLogActive=!0,e.execLogEntries=Us([...e.execLogEntries,{ts:o,stream:"system",text:`▶ ${p}`,toolCallId:a}]),!e.execLogManuallyDismissed&&e.sidebarMode!=="exec-log"&&(e.sidebarMode="exec-log",e.sidebarOpen=!0);return}if(i==="update"||i==="result"){const l=kg(n,i);l&&(e.execLogEntries=Us([...e.execLogEntries,{ts:o,stream:"stdout",text:l,toolCallId:a}]))}if(i==="result"){e.execLogActive=!1;const l=n.exitCode??n.exit_code,c=typeof l=="number"&&l!==0?"✗ Failed":"✓ Done";e.execLogEntries=Us([...e.execLogEntries,{ts:o,stream:l!==0?"stderr":"system",text:`${c} (exit ${l??"?"})`,toolCallId:a}])}}const Cg=/^\[([^\]]+)\]\s*/,Ag=["WebChat","WhatsApp","Telegram","Signal","Slack","Discord","iMessage","Teams","Matrix","Zalo","Zalo Personal","BlueBubbles"],zs=new WeakMap,Hs=new WeakMap;function Tg(e){return/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(e)||/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(e)?!0:Ag.some(t=>e.startsWith(`${t} `))}function js(e){const t=e.match(Cg);if(!t)return e;const n=t[1]??"";return Tg(n)?e.slice(t[0].length):e}function bi(e){const t=e,n=typeof t.role=="string"?t.role:"",s=t.content;if(typeof s=="string")return n==="assistant"?Ps(s):js(s);if(Array.isArray(s)){const i=s.map(o=>{const a=o;return a.type==="text"&&typeof a.text=="string"?a.text:null}).filter(o=>typeof o=="string");if(i.length>0){const o=i.join(`
`);return n==="assistant"?Ps(o):js(o)}}return typeof t.text=="string"?n==="assistant"?Ps(t.text):js(t.text):null}function Cl(e){if(!e||typeof e!="object")return bi(e);const t=e;if(zs.has(t))return zs.get(t)??null;const n=bi(e);return zs.set(t,n),n}function $a(e){const n=e.content,s=[];if(Array.isArray(n))for(const l of n){const c=l;if(c.type==="thinking"&&typeof c.thinking=="string"){const g=c.thinking.trim();g&&s.push(g)}}if(s.length>0)return s.join(`
`);const i=Eg(e);if(!i)return null;const a=[...i.matchAll(/<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi)].map(l=>(l[1]??"").trim()).filter(Boolean);return a.length>0?a.join(`
`):null}function _g(e){if(!e||typeof e!="object")return $a(e);const t=e;if(Hs.has(t))return Hs.get(t)??null;const n=$a(e);return Hs.set(t,n),n}function Eg(e){const t=e,n=t.content;if(typeof n=="string")return n;if(Array.isArray(n)){const s=n.map(i=>{const o=i;return o.type==="text"&&typeof o.text=="string"?o.text:null}).filter(i=>typeof i=="string");if(s.length>0)return s.join(`
`)}return typeof t.text=="string"?t.text:null}function Lg(e){const t=e.trim();if(!t)return"";const n=t.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>`_${s}_`);return n.length?["_Reasoning:_",...n].join(`
`):""}let ka=!1;function Sa(e){e[6]=e[6]&15|64,e[8]=e[8]&63|128;let t="";for(let n=0;n<e.length;n++)t+=e[n].toString(16).padStart(2,"0");return`${t.slice(0,8)}-${t.slice(8,12)}-${t.slice(12,16)}-${t.slice(16,20)}-${t.slice(20)}`}function Ig(){const e=new Uint8Array(16),t=Date.now();for(let n=0;n<e.length;n++)e[n]=Math.floor(Math.random()*256);return e[0]^=t&255,e[1]^=t>>>8&255,e[2]^=t>>>16&255,e[3]^=t>>>24&255,e}function Mg(){ka||(ka=!0,console.warn("[uuid] crypto API missing; falling back to weak randomness"))}function hs(e=globalThis.crypto){if(e&&typeof e.randomUUID=="function")return e.randomUUID();if(e&&typeof e.getRandomValues=="function"){const t=new Uint8Array(16);return e.getRandomValues(t),Sa(t)}return Mg(),Sa(Ig())}async function Xe(e){if(!(!e.client||!e.connected)){e.chatLoading=!0,e.lastError=null;try{const t=await e.client.request("chat.history",{sessionKey:e.sessionKey,limit:200});e.chatMessages=Array.isArray(t.messages)?t.messages:[],e.chatThinkingLevel=t.thinkingLevel??null}catch(t){e.lastError=String(t)}finally{e.chatLoading=!1}}}function Rg(e){const t=/^data:([^;]+);base64,(.+)$/.exec(e);return t?{mimeType:t[1],content:t[2]}:null}async function Al(e,t,n,s){if(!e.client||!e.connected)return null;const i=t.trim(),o=n&&n.length>0;if(!i&&!o)return null;const a=Date.now(),l=[];if(i&&l.push({type:"text",text:i}),o)for(const p of n)l.push({type:"image",source:{type:"base64",media_type:p.mimeType,data:p.dataUrl}});s?.silent||(e.chatMessages=[...e.chatMessages,{role:"user",content:l,timestamp:a}]),e.chatSending=!0,e.lastError=null;const c=hs();e.chatRunId=c,e.chatStream="",e.chatStreamStartedAt=a;const g=o?n.map(p=>{const u=Rg(p.dataUrl);return u?{type:"image",mimeType:u.mimeType,content:u.content}:null}).filter(p=>p!==null):void 0;try{return await e.client.request("chat.send",{sessionKey:e.sessionKey,message:i,deliver:!1,idempotencyKey:c,attachments:g}),c}catch(p){const u=String(p);return e.chatRunId=null,e.chatStream=null,e.chatStreamStartedAt=null,e.lastError=u,e.chatMessages=[...e.chatMessages,{role:"assistant",content:[{type:"text",text:"Error: "+u}],timestamp:Date.now()}],null}finally{e.chatSending=!1}}async function Tl(e){if(!e.client||!e.connected)return!1;const t=e.chatRunId;try{return await e.client.request("chat.abort",t?{sessionKey:e.sessionKey,runId:t}:{sessionKey:e.sessionKey}),!0}catch(n){return e.lastError=String(n),!1}}function _l(e,t){if(!t||t.sessionKey!==e.sessionKey)return null;if(t.runId&&e.chatRunId&&t.runId!==e.chatRunId)return t.state==="final"?"final":null;if(t.state==="delta"){const n=bi(t.message);if(typeof n=="string"){const s=e.chatStream??"";(!s||n.length>=s.length)&&(e.chatStream=n)}}else t.state==="final"||t.state==="aborted"?(e.chatStream=null,e.chatRunId=null,e.chatStreamStartedAt=null):t.state==="error"&&(e.chatStream=null,e.chatRunId=null,e.chatStreamStartedAt=null,e.lastError=t.errorMessage??"chat error");return t.state}const Pg=Object.freeze(Object.defineProperty({__proto__:null,abortChatRun:Tl,handleChatEvent:_l,loadChatHistory:Xe,sendChatMessage:Al},Symbol.toStringTag,{value:"Module"})),fs=120;function co(e){return e.chatSending||!!e.chatRunId}function El(e){const t=e.trim();if(!t)return!1;const n=t.toLowerCase();return n==="/stop"?!0:n==="stop"||n==="esc"||n==="abort"||n==="wait"||n==="exit"}function Dg(e){const t=e.trim();if(!t)return!1;const n=t.toLowerCase();return n==="/new"||n==="/reset"?!0:n.startsWith("/new ")||n.startsWith("/reset ")}async function uo(e){e.connected&&(e.chatMessage="",await Tl(e))}function Fg(e,t,n,s){const i=t.trim(),o=!!(n&&n.length>0);!i&&!o||(e.chatQueue=[...e.chatQueue,{id:hs(),text:i,createdAt:Date.now(),attachments:o?n?.map(a=>({...a})):void 0,refreshSessions:s}])}async function Ll(e,t,n){ps(e);const s=await Al(e,t,n?.attachments,{silent:n?.silent}),i=!!s;return!i&&n?.previousDraft!=null&&(e.chatMessage=n.previousDraft),!i&&n?.previousAttachments&&(e.chatAttachments=n.previousAttachments),i&&wl(e,e.sessionKey),i&&n?.restoreDraft&&n.previousDraft?.trim()&&(e.chatMessage=n.previousDraft),i&&n?.restoreAttachments&&n.previousAttachments?.length&&(e.chatAttachments=n.previousAttachments),dn(e),i&&!e.chatRunId&&Il(e),i&&n?.refreshSessions&&s&&e.refreshSessionsAfterChat.add(s),i}async function Il(e){if(!e.connected||co(e))return;const[t,...n]=e.chatQueue;if(!t)return;e.chatQueue=n,await Ll(e,t.text,{attachments:t.attachments,refreshSessions:t.refreshSessions})||(e.chatQueue=[t,...e.chatQueue])}function Ml(e,t){e.chatQueue=e.chatQueue.filter(n=>n.id!==t)}async function Rl(e,t,n){if(!e.connected)return;const s=e.chatMessage,i=(t??e.chatMessage).trim(),o=e.chatAttachments??[],a=t==null?o:[],l=a.length>0;if(!i&&!l)return;if(El(i)){await uo(e);return}const c=Dg(i);if(t==null&&(e.chatMessage="",e.chatAttachments=[]),co(e)){Fg(e,i,a,c);return}await Ll(e,i,{previousDraft:t==null?s:void 0,restoreDraft:!!(t&&n?.restoreDraft),attachments:l?a:void 0,previousAttachments:t==null?o:void 0,restoreAttachments:!!(t&&n?.restoreDraft),refreshSessions:c,silent:c})}async function Pl(e,t){await Promise.all([Xe(e),nt(e,{activeMinutes:fs}),kt(e)]),dn(e)}const Dl=Il;function Ng(e){const t=zi(e.sessionKey);return t?.agentId?t.agentId:e.hello?.snapshot?.sessionDefaults?.defaultAgentId?.trim()||"main"}function Og(e,t){const n=pn(e),s=encodeURIComponent(t);return n?`${n}/avatar/${s}?meta=1`:`/avatar/${s}?meta=1`}async function kt(e){if(!e.connected){e.chatAvatarUrl=null;return}const t=Ng(e);if(!t){e.chatAvatarUrl=null;return}e.chatAvatarUrl=null;const n=Og(e.basePath,t);try{const s=await fetch(n,{method:"GET"});if(!s.ok){e.chatAvatarUrl=null;return}const i=await s.json(),o=typeof i.avatarUrl=="string"?i.avatarUrl.trim():"";e.chatAvatarUrl=o||null}catch{e.chatAvatarUrl=null}}const Bg=Object.freeze(Object.defineProperty({__proto__:null,CHAT_SESSIONS_ACTIVE_MINUTES:fs,flushChatQueueForEvent:Dl,handleAbortChat:uo,handleSendChat:Rl,isChatBusy:co,isChatStopCommand:El,refreshChat:Pl,refreshChatAvatar:kt,removeQueuedMessage:Ml},Symbol.toStringTag,{value:"Module"})),Ug={trace:!0,debug:!0,info:!0,warn:!0,error:!0,fatal:!0},zg={name:"",description:"",agentId:"",enabled:!0,scheduleKind:"every",scheduleAt:"",everyAmount:"30",everyUnit:"minutes",cronExpr:"0 7 * * *",cronTz:"",sessionTarget:"isolated",wakeMode:"now",payloadKind:"agentTurn",payloadText:"",deliveryMode:"announce",deliveryChannel:"last",deliveryTo:"",timeoutSeconds:""},Hg=50,jg=200,Kg="Assistant";function Ca(e,t){if(typeof e!="string")return;const n=e.trim();if(n)return n.length<=t?n:n.slice(0,t)}function yi(e){const t=Ca(e?.name,Hg)??Kg,n=Ca(e?.avatar??void 0,jg)??null;return{agentId:typeof e?.agentId=="string"&&e.agentId.trim()?e.agentId.trim():null,name:t,avatar:n}}function Wg(){return yi(typeof window>"u"?{}:{name:window.__WINCLAW_ASSISTANT_NAME__,avatar:window.__WINCLAW_ASSISTANT_AVATAR__})}async function Fl(e,t){if(!e.client||!e.connected)return;const n=e.sessionKey.trim(),s=n?{sessionKey:n}:{};try{const i=await e.client.request("agent.identity.get",s);if(!i)return;const o=yi(i);e.assistantName=o.name,e.assistantAvatar=o.avatar,e.assistantAgentId=o.agentId??null}catch{}}function xi(e){return typeof e=="object"&&e!==null}function Vg(e){if(!xi(e))return null;const t=typeof e.id=="string"?e.id.trim():"",n=e.request;if(!t||!xi(n))return null;const s=typeof n.command=="string"?n.command.trim():"";if(!s)return null;const i=typeof e.createdAtMs=="number"?e.createdAtMs:0,o=typeof e.expiresAtMs=="number"?e.expiresAtMs:0;return!i||!o?null:{id:t,request:{command:s,cwd:typeof n.cwd=="string"?n.cwd:null,host:typeof n.host=="string"?n.host:null,security:typeof n.security=="string"?n.security:null,ask:typeof n.ask=="string"?n.ask:null,agentId:typeof n.agentId=="string"?n.agentId:null,resolvedPath:typeof n.resolvedPath=="string"?n.resolvedPath:null,sessionKey:typeof n.sessionKey=="string"?n.sessionKey:null},createdAtMs:i,expiresAtMs:o}}function qg(e){if(!xi(e))return null;const t=typeof e.id=="string"?e.id.trim():"";return t?{id:t,decision:typeof e.decision=="string"?e.decision:null,resolvedBy:typeof e.resolvedBy=="string"?e.resolvedBy:null,ts:typeof e.ts=="number"?e.ts:null}:null}function Nl(e){const t=Date.now();return e.filter(n=>n.expiresAtMs>t)}function Gg(e,t){const n=Nl(e).filter(s=>s.id!==t.id);return n.push(t),n}function Aa(e,t){return Nl(e).filter(n=>n.id!==t)}async function Qg(e){if(!(!e.client||!e.connected)&&!e.modelCatalogLoading){e.modelCatalogLoading=!0;try{const t=await e.client.request("models.list",{});t?.models&&(e.modelCatalog=t.models)}catch(t){console.error("[models] loadModelCatalog error:",t)}finally{e.modelCatalogLoading=!1}}}function Yg(e){const t=e.scopes.join(","),n=e.token??"";return["v2",e.deviceId,e.clientId,e.clientMode,e.role,t,String(e.signedAtMs),n,e.nonce].join("|")}const Ol={WEBCHAT_UI:"webchat-ui",CONTROL_UI:"winclaw-control-ui",WEBCHAT:"webchat",CLI:"cli",GATEWAY_CLIENT:"gateway-client",MACOS_APP:"winclaw-macos",IOS_APP:"winclaw-ios",ANDROID_APP:"winclaw-android",NODE_HOST:"node-host",TEST:"test",FINGERPRINT:"fingerprint",PROBE:"winclaw-probe"},Ta=Ol,wi={WEBCHAT:"webchat",CLI:"cli",UI:"ui",BACKEND:"backend",NODE:"node",PROBE:"probe",TEST:"test"},Jg={TOOL_EVENTS:"tool-events"};new Set(Object.values(Ol));new Set(Object.values(wi));const Zg=4008;class Xg{constructor(t){this.opts=t,this.ws=null,this.pending=new Map,this.closed=!1,this.lastSeq=null,this.connectNonce=null,this.connectSent=!1,this.connectTimer=null,this.backoffMs=800}start(){this.closed=!1,this.connect()}stop(){this.closed=!0,this.ws?.close(),this.ws=null,this.flushPending(new Error("gateway client stopped"))}get connected(){return this.ws?.readyState===WebSocket.OPEN}connect(){this.closed||(this.ws=new WebSocket(this.opts.url),this.ws.addEventListener("open",()=>this.queueConnect()),this.ws.addEventListener("message",t=>this.handleMessage(String(t.data??""))),this.ws.addEventListener("close",t=>{const n=String(t.reason??"");this.ws=null,this.flushPending(new Error(`gateway closed (${t.code}): ${n}`)),this.opts.onClose?.({code:t.code,reason:n}),this.scheduleReconnect()}),this.ws.addEventListener("error",()=>{}))}scheduleReconnect(){if(this.closed)return;const t=this.backoffMs;this.backoffMs=Math.min(this.backoffMs*1.7,15e3),window.setTimeout(()=>this.connect(),t)}flushPending(t){for(const[,n]of this.pending)n.reject(t);this.pending.clear()}async sendConnect(){if(this.connectSent)return;this.connectSent=!0,this.connectTimer!==null&&(window.clearTimeout(this.connectTimer),this.connectTimer=null);const t=typeof crypto<"u"&&!!crypto.subtle,n=["operator.admin","operator.approvals","operator.pairing"],s="operator";let i=null,o=!1,a=this.opts.token;if(t){i=await to();const p=ou({deviceId:i.deviceId,role:s})?.token;a=p??this.opts.token,o=!!(p&&this.opts.token)}const l=a||this.opts.password?{token:a,password:this.opts.password}:void 0;let c;if(t&&i){const p=Date.now(),u=this.connectNonce??void 0,h=Yg({deviceId:i.deviceId,clientId:this.opts.clientName??Ta.CONTROL_UI,clientMode:this.opts.mode??wi.WEBCHAT,role:s,scopes:n,signedAtMs:p,token:a??null,nonce:u}),f=await Lu(i.privateKey,h);c={id:i.deviceId,publicKey:i.publicKey,signature:f,signedAt:p,nonce:u}}const g={minProtocol:3,maxProtocol:3,client:{id:this.opts.clientName??Ta.CONTROL_UI,version:this.opts.clientVersion??"dev",platform:this.opts.platform??navigator.platform??"web",mode:this.opts.mode??wi.WEBCHAT,instanceId:this.opts.instanceId},role:s,scopes:n,device:c,caps:[Jg.TOOL_EVENTS],auth:l,userAgent:navigator.userAgent,locale:navigator.language};this.request("connect",g).then(p=>{p?.auth?.deviceToken&&i&&tl({deviceId:i.deviceId,role:p.auth.role??s,token:p.auth.deviceToken,scopes:p.auth.scopes??[]}),this.backoffMs=800,this.opts.onHello?.(p)}).catch(()=>{o&&i&&nl({deviceId:i.deviceId,role:s}),this.ws?.close(Zg,"connect failed")})}handleMessage(t){let n;try{n=JSON.parse(t)}catch{return}const s=n;if(s.type==="event"){const i=n;if(i.event==="connect.challenge"){const a=i.payload,l=a&&typeof a.nonce=="string"?a.nonce:null;l&&(this.connectNonce=l,this.sendConnect());return}const o=typeof i.seq=="number"?i.seq:null;o!==null&&(this.lastSeq!==null&&o>this.lastSeq+1&&this.opts.onGap?.({expected:this.lastSeq+1,received:o}),this.lastSeq=o);try{this.opts.onEvent?.(i)}catch(a){console.error("[gateway] event handler error:",a)}return}if(s.type==="res"){const i=n,o=this.pending.get(i.id);if(!o)return;this.pending.delete(i.id),i.ok?o.resolve(i.payload):o.reject(new Error(i.error?.message??"request failed"));return}}request(t,n){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return Promise.reject(new Error("gateway not connected"));const s=hs(),i={type:"req",id:s,method:t,params:n},o=new Promise((a,l)=>{this.pending.set(s,{resolve:c=>a(c),reject:l})});return this.ws.send(JSON.stringify(i)),o}queueConnect(){this.connectNonce=null,this.connectSent=!1,this.connectTimer!==null&&window.clearTimeout(this.connectTimer),this.connectTimer=window.setTimeout(()=>{this.sendConnect()},750)}}function Ks(e,t){const n=(e??"").trim(),s=t.mainSessionKey?.trim();if(!s)return n;if(!n)return s;const i=t.mainKey?.trim()||"main",o=t.defaultAgentId?.trim();return n==="main"||n===i||o&&(n===`agent:${o}:main`||n===`agent:${o}:${i}`)?s:n}function ep(e,t){if(!t?.mainSessionKey)return;const n=Ks(e.sessionKey,t),s=Ks(e.settings.sessionKey,t),i=Ks(e.settings.lastActiveSessionKey,t),o=n||s||e.sessionKey,a={...e.settings,sessionKey:s||o,lastActiveSessionKey:i||o},l=a.sessionKey!==e.settings.sessionKey||a.lastActiveSessionKey!==e.settings.lastActiveSessionKey;o!==e.sessionKey&&(e.sessionKey=o),l&&Ze(e,a)}function Bl(e){e.lastError=null,e.hello=null,e.connected=!1,e.execApprovalQueue=[],e.execApprovalError=null,e.client?.stop(),e.client=new Xg({url:e.settings.gatewayUrl,token:e.settings.token.trim()?e.settings.token:void 0,password:e.password.trim()?e.password:void 0,clientName:"winclaw-control-ui",mode:"webchat",onHello:t=>{e.connected=!0,e.lastError=null,e.hello=t,ip(e,t),e.chatRunId=null,e.chatStream=null,e.chatStreamStartedAt=null,ps(e),Fl(e),qi(e),nt(e,{activeMinutes:fs}),Qg(e),ls(e,{quiet:!0}),tt(e,{quiet:!0}),be(e,!1),lo(e),sp(e)},onClose:({code:t,reason:n})=>{e.connected=!1,t!==1012&&(e.lastError=`disconnected (${t}): ${n||"no reason"}`)},onEvent:t=>tp(e,t),onGap:({expected:t,received:n})=>{e.lastError=`event gap detected (expected seq ${t}, got ${n}); refresh recommended`}}),e.client.start()}function tp(e,t){try{np(e,t)}catch(n){console.error("[gateway] handleGatewayEvent error:",t.event,n)}}function np(e,t){if(e.eventLogBuffer=[{ts:Date.now(),event:t.event,payload:t.payload},...e.eventLogBuffer].slice(0,250),e.tab==="debug"&&(e.eventLog=e.eventLogBuffer),t.event==="agent"){if(e.onboarding)return;wg(e,t.payload);return}if(t.event==="chat"){const n=t.payload;n?.sessionKey&&wl(e,n.sessionKey);const s=_l(e,n);if(s==="final"||s==="error"||s==="aborted"){ps(e),Dl(e);const i=n?.runId;i&&e.refreshSessionsAfterChat.delete(i)}s==="final"&&(nt(e,{activeMinutes:fs}),Xe(e));return}if(t.event==="presence"){const n=t.payload;n?.presence&&Array.isArray(n.presence)&&(e.presenceEntries=n.presence,e.presenceError=null,e.presenceStatus=null);return}if(t.event==="cron"&&e.tab==="cron"&&qn(e),(t.event==="device.pair.requested"||t.event==="device.pair.resolved")&&tt(e,{quiet:!0}),t.event==="exec.approval.requested"){const n=Vg(t.payload);if(n){e.execApprovalQueue=Gg(e.execApprovalQueue,n),e.execApprovalError=null;const s=Math.max(0,n.expiresAtMs-Date.now()+500);window.setTimeout(()=>{e.execApprovalQueue=Aa(e.execApprovalQueue,n.id)},s)}return}if(t.event==="exec.approval.resolved"){const n=qg(t.payload);n&&(e.execApprovalQueue=Aa(e.execApprovalQueue,n.id))}}function sp(e){const t=e.settings?.token??"";fetch("/api/dh/health",{headers:t?{Authorization:`Bearer ${t}`}:{}}).then(n=>{e.dhAvailable=n.ok}).catch(()=>{e.dhAvailable=!1})}function ip(e,t){const n=t.snapshot;n?.presence&&Array.isArray(n.presence)&&(e.presenceEntries=n.presence),n?.health&&(e.debugHealth=n.health),n?.sessionDefaults&&ep(e,n.sessionDefaults)}function op(e){e.basePath=og(),ng(e),cg(e,!0),ag(e),rg(e),window.addEventListener("popstate",e.popStateHandler),e.keydownHandler=t=>{(t.ctrlKey||t.metaKey)&&t.key==="k"&&(t.preventDefault(),e.toggleCommandPalette()),t.key==="Escape"&&e.commandPaletteOpen&&(t.preventDefault(),e.toggleCommandPalette())},window.addEventListener("keydown",e.keydownHandler),Bl(e),qd(e),e.tab==="logs"&&ji(e),e.tab==="debug"&&Wi(e)}function ap(e){Ud(e)}function rp(e){window.removeEventListener("popstate",e.popStateHandler),e.keydownHandler&&(window.removeEventListener("keydown",e.keydownHandler),e.keydownHandler=void 0),Gd(e),Ki(e),Vi(e),lg(e),e.topbarObserver?.disconnect(),e.topbarObserver=null}function lp(e,t){if(!(e.tab==="chat"&&e.chatManualRefreshInFlight)){if(e.tab==="chat"&&(t.has("chatMessages")||t.has("chatToolMessages")||t.has("chatStream")||t.has("chatLoading")||t.has("tab"))){const n=t.has("tab"),s=t.has("chatLoading")&&t.get("chatLoading")===!0&&!e.chatLoading;dn(e,n||s||!e.chatHasAutoScrolled)}e.tab==="logs"&&(t.has("logsEntries")||t.has("logsAutoFollow")||t.has("tab"))&&e.logsAutoFollow&&e.logsAtBottom&&Gr(e,t.has("tab")||t.has("logsAutoFollow"))}}const go={CHILD:2},po=e=>(...t)=>({_$litDirective$:e,values:t});let ho=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,n,s){this._$Ct=t,this._$AM=n,this._$Ci=s}_$AS(t,n){return this.update(t,n)}update(t,n){return this.render(...n)}};const{I:cp}=cd,_a=e=>e,dp=e=>e.strings===void 0,Ea=()=>document.createComment(""),Ht=(e,t,n)=>{const s=e._$AA.parentNode,i=t===void 0?e._$AB:t._$AA;if(n===void 0){const o=s.insertBefore(Ea(),i),a=s.insertBefore(Ea(),i);n=new cp(o,a,e,e.options)}else{const o=n._$AB.nextSibling,a=n._$AM,l=a!==e;if(l){let c;n._$AQ?.(e),n._$AM=e,n._$AP!==void 0&&(c=e._$AU)!==a._$AU&&n._$AP(c)}if(o!==i||l){let c=n._$AA;for(;c!==o;){const g=_a(c).nextSibling;_a(s).insertBefore(c,i),c=g}}}return n},rt=(e,t,n=e)=>(e._$AI(t,n),e),up={},gp=(e,t=up)=>e._$AH=t,pp=e=>e._$AH,Ws=e=>{e._$AR(),e._$AA.remove()};const La=(e,t,n)=>{const s=new Map;for(let i=t;i<=n;i++)s.set(e[i],i);return s},vt=po(class extends ho{constructor(e){if(super(e),e.type!==go.CHILD)throw Error("repeat() can only be used in text expressions")}dt(e,t,n){let s;n===void 0?n=t:t!==void 0&&(s=t);const i=[],o=[];let a=0;for(const l of e)i[a]=s?s(l,a):a,o[a]=n(l,a),a++;return{values:o,keys:i}}render(e,t,n){return this.dt(e,t,n).values}update(e,[t,n,s]){const i=pp(e),{values:o,keys:a}=this.dt(t,n,s);if(!Array.isArray(i))return this.ut=a,o;const l=this.ut??=[],c=[];let g,p,u=0,h=i.length-1,f=0,d=o.length-1;for(;u<=h&&f<=d;)if(i[u]===null)u++;else if(i[h]===null)h--;else if(l[u]===a[f])c[f]=rt(i[u],o[f]),u++,f++;else if(l[h]===a[d])c[d]=rt(i[h],o[d]),h--,d--;else if(l[u]===a[d])c[d]=rt(i[u],o[d]),Ht(e,c[d+1],i[u]),u++,d--;else if(l[h]===a[f])c[f]=rt(i[h],o[f]),Ht(e,i[u],i[h]),h--,f++;else if(g===void 0&&(g=La(a,f,d),p=La(l,u,h)),g.has(l[u]))if(g.has(l[h])){const m=p.get(a[f]),k=m!==void 0?i[m]:null;if(k===null){const S=Ht(e,i[u]);rt(S,o[f]),c[f]=S}else c[f]=rt(k,o[f]),Ht(e,i[u],k),i[m]=null;f++}else Ws(i[h]),h--;else Ws(i[u]),u++;for(;f<=d;){const m=Ht(e,c[d+1]);rt(m,o[f]),c[f++]=m}for(;u<=h;){const m=i[u++];m!==null&&Ws(m)}return this.ut=a,gp(e,c),Je}});function hp(e,t){const n=t?.sessions?.find(o=>o.key===e);if(n?.derivedTitle?.trim())return n.derivedTitle.trim();if(n?.displayName?.trim()&&n.displayName!==e)return n.displayName.trim();if(n?.label?.trim()&&n.label!==e)return n.label.trim();const s=e.split(":"),i=s[s.length-1]??e;return/^[0-9a-f]{8}-/.test(i)?"New Chat":i.charAt(0).toUpperCase()+i.slice(1)}function fp(e){return e.openSessions.length<=1?r`
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
        ${vt(e.openSessions,t=>t,t=>{const n=t===e.activeSessionKey,s=hp(t,e.sessionsResult);return r`
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
  `}const le={messageSquare:r`
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
  `};function Ul(e){const t=e.sessionsResult?.sessions?.find(l=>l.key===e.sessionKey);if(t?.workspace)return t.workspace;const n=e.agentsList?.agents;if(!n||n.length===0)return;const o=(e.sessionKey??"").match(/^agent:([^:]+):/)?.[1]??e.agentsList?.defaultId;return(n.find(l=>l.id===o)??n[0])?.workspace}function mp(e){const n=e.sessionsResult?.sessions?.find(i=>i.key===e.sessionKey);if(n?.model&&n?.modelProvider)return`${n.modelProvider}/${n.model}`;if(n?.model)return n.model;const s=e.sessionsResult?.defaults;return s?.model&&s?.modelProvider?`${s.modelProvider}/${s.model}`:s?.model?s.model:""}function vp(e,t){return r`
    <div class="chat-controls">
      ${fp({activeSessionKey:e.sessionKey,openSessions:e.openChatSessions,sessionsResult:e.sessionsResult,onSelect:n=>e.switchChatSession(n),onClose:n=>e.removeChatSession(n),onNew:()=>t?.onNewSession?.()})}
      ${yp(e)}
      ${xp(e)}
    </div>
  `}async function bp(e){const t=Ul(e)??"";let n=null;const s=window.chrome;if(s?.webview?.hostObjects?.winclawBridge)try{const o=await s.webview.hostObjects.winclawBridge.ShowFolderDialog(t);if(n=typeof o=="string"&&o.trim()?o.trim():null,!n)return}catch(o){console.warn("[workspace] WebView2 bridge failed:",o)}if(!n&&e.client)try{const o=await e.client.request("system.showFolderDialog",{initialPath:t});if(o?.path)n=o.path;else if(o?.path===null)return}catch(o){console.warn("[workspace] Gateway folder dialog failed:",o)}if(n||(n=window.prompt("Enter workspace directory path:",t)),!n||n.trim()===t)return;const i=n.trim();try{await oo(e,e.sessionKey,{workspace:i})}catch(o){console.error("[workspace] change failed:",o)}}function yp(e){const t=Ul(e);return t?r`
    <div
      class="chat-controls__workspace"
      title="Workspace: ${t} (click to change)"
      @click=${()=>bp(e)}
    >
      <span class="chat-controls__workspace-icon">📁</span>
      <span class="chat-controls__workspace-path">${t}</span>
    </div>
  `:r``}function xp(e){const t=e.modelCatalog;if(!t||t.length===0)return r``;const n=mp(e);return r`
    <span class="chat-controls__separator">|</span>
    <label class="field chat-controls__model">
      <select
        .value=${n}
        ?disabled=${!e.connected}
        @change=${async s=>{const i=s.target.value;!i||i===n||await oo(e,e.sessionKey,{model:i})}}
        title="Switch model"
      >
        ${vt(t,s=>`${s.provider}/${s.id}`,s=>{const i=`${s.provider}/${s.id}`;return r`<option
              value=${i}
              ?selected=${i===n}
            >
              ${s.name||s.id} (${s.provider})
            </option>`})}
      </select>
    </label>
  `}const Xt=(e,t)=>{const n=e._$AN;if(n===void 0)return!1;for(const s of n)s._$AO?.(t,!1),Xt(s,t);return!0},Qn=e=>{let t,n;do{if((t=e._$AM)===void 0)break;n=t._$AN,n.delete(e),e=t}while(n?.size===0)},zl=e=>{for(let t;t=e._$AM;e=t){let n=t._$AN;if(n===void 0)t._$AN=n=new Set;else if(n.has(e))break;n.add(e),kp(t)}};function wp(e){this._$AN!==void 0?(Qn(this),this._$AM=e,zl(this)):this._$AM=e}function $p(e,t=!1,n=0){const s=this._$AH,i=this._$AN;if(i!==void 0&&i.size!==0)if(t)if(Array.isArray(s))for(let o=n;o<s.length;o++)Xt(s[o],!1),Qn(s[o]);else s!=null&&(Xt(s,!1),Qn(s));else Xt(this,e)}const kp=e=>{e.type==go.CHILD&&(e._$AP??=$p,e._$AQ??=wp)};class Sp extends ho{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,n,s){super._$AT(t,n,s),zl(this),this.isConnected=t._$AU}_$AO(t,n=!0){t!==this.isConnected&&(this.isConnected=t,t?this.reconnected?.():this.disconnected?.()),n&&(Xt(this,t),Qn(this))}setValue(t){if(dp(this._$Ct))this._$Ct._$AI(t,this);else{const n=[...this._$Ct._$AH];n[this._$Ci]=t,this._$Ct._$AI(n,this,0)}}disconnected(){}reconnected(){}}const Vs=new WeakMap,fo=po(class extends Sp{render(e){return v}update(e,[t]){const n=t!==this.G;return n&&this.G!==void 0&&this.rt(void 0),(n||this.lt!==this.ct)&&(this.G=t,this.ht=e.options?.host,this.rt(this.ct=e.element)),v}rt(e){if(this.isConnected||(e=void 0),typeof this.G=="function"){const t=this.ht??globalThis;let n=Vs.get(t);n===void 0&&(n=new WeakMap,Vs.set(t,n)),n.get(this.G)!==void 0&&this.G.call(this.ht,void 0),n.set(this.G,e),e!==void 0&&this.G.call(this.ht,e)}else this.G.value=e}get lt(){return typeof this.G=="function"?Vs.get(this.ht??globalThis)?.get(this.G):this.G?.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});function Cp(e,t){const n=t.toLowerCase();return e.label.toLowerCase().includes(n)||e.id.toLowerCase().includes(n)?!0:e.keywords.some(s=>s.toLowerCase().includes(n))}function Ap(e){if(!e.open)return v;let t="",n=0;const s=u=>{const h=Bs();return u.trim()?h.filter(f=>Cp(f,u)):h},i=u=>{const f=u.target.closest(".command-palette")?.querySelector(".command-palette__list")?.querySelectorAll(".command-palette__item");if(f?.length)if(u.key==="ArrowDown")u.preventDefault(),n=Math.min(n+1,f.length-1),f.forEach((d,m)=>d.classList.toggle("highlighted",m===n)),f[n]?.scrollIntoView({block:"nearest"});else if(u.key==="ArrowUp")u.preventDefault(),n=Math.max(n-1,0),f.forEach((d,m)=>d.classList.toggle("highlighted",m===n)),f[n]?.scrollIntoView({block:"nearest"});else if(u.key==="Enter"){u.preventDefault();const d=f[n];d&&d.click()}else u.key==="Escape"&&(u.preventDefault(),e.onClose())},o=u=>{const h=u.target;t=h.value,n=0;const d=h.closest(".command-palette")?.querySelector(".command-palette__list");if(!d)return;const m=s(t),k=e.recentCommandIds,S=t.trim()?[]:k.map(T=>m.find(_=>_.id===T)).filter(Boolean),$=t.trim()?m:m.filter(T=>!k.includes(T.id));let A=0,C="";if(S.length>0){C+=`<div class="command-palette__category">${R("commands.recentCommands")}</div>`;for(const T of S)C+=Ma(T,A===n),A++}for(const T of ya()){const _=$.filter(I=>I.category===T);if(_.length!==0){C+=`<div class="command-palette__category">${T}</div>`;for(const I of _)C+=Ma(I,A===n),A++}}d.innerHTML=C,d.querySelectorAll(".command-palette__item").forEach(T=>{T.addEventListener("click",()=>{const _=T.dataset.cmdId,I=Bs().find(W=>W.id===_);I&&e.onSelect(I)})})},a=Bs(),l=e.recentCommandIds,c=l.map(u=>a.find(h=>h.id===u)).filter(Boolean),g=a.filter(u=>!l.includes(u.id));let p=0;return r`
    <div
      class="command-palette-overlay"
      @click=${u=>{u.target.classList.contains("command-palette-overlay")&&e.onClose()}}
      @keydown=${u=>{u.key==="Escape"&&e.onClose()}}
    >
      <div class="command-palette">
        <div class="command-palette__search">
          <span class="command-palette__search-icon">${le.search??r`
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
            `}</span>
          <input
            type="text"
            class="command-palette__input"
            placeholder=${R("commands.searchPlaceholder")}
            @input=${o}
            @keydown=${i}
            ${fo(u=>{u&&requestAnimationFrame(()=>u.focus())})}
          />
        </div>
        <div class="command-palette__list">
          ${c.length>0?r`
                <div class="command-palette__category">${R("commands.recentCommands")}</div>
                ${vt(c,u=>`recent-${u.id}`,u=>{const h=p++;return Ia(u,h===0,e.onSelect)})}
              `:v}
          ${vt(ya(),u=>u,u=>{const h=g.filter(f=>f.category===u);return h.length===0?v:r`
                <div class="command-palette__category">${u}</div>
                ${vt(h,f=>f.id,f=>{const d=p++;return Ia(f,d===0,e.onSelect)})}
              `})}
        </div>
      </div>
    </div>
  `}function Ia(e,t,n){return r`
    <button
      class="command-palette__item ${t?"highlighted":""}"
      data-cmd-id=${e.id}
      @click=${()=>n(e)}
    >
      <span class="command-palette__item-icon">${le[e.icon]}</span>
      <span class="command-palette__item-label">${e.label}</span>
      ${e.shortcut?r`<span class="command-palette__item-shortcut">${e.shortcut}</span>`:e.tab?r`<span class="command-palette__item-shortcut">${e.tab}</span>`:v}
    </button>
  `}function Ma(e,t){const n=e.shortcut?`<span class="command-palette__item-shortcut">${e.shortcut}</span>`:e.tab?`<span class="command-palette__item-shortcut">${e.tab}</span>`:"";return`<button class="command-palette__item ${t?"highlighted":""}" data-cmd-id="${e.id}">
    <span class="command-palette__item-icon"></span>
    <span class="command-palette__item-label">${e.label}</span>
    ${n}
  </button>`}function Tp(e){return r`
    <div class="session-tabs">
      ${vt(e.openTabs,t=>t,t=>{const n=t===e.activeTab,s=t==="chat";return r`
            <button
              class="session-tabs__tab ${n?"session-tabs__tab--active":""}"
              @click=${()=>e.onTabSelect(t)}
              title=${mi(t)}
            >
              <span class="session-tabs__tab-icon">${le[Qu(t)]}</span>
              <span class="session-tabs__tab-label">${s?e.chatSessionTitle||"New Chat":mi(t)}</span>
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
  `}function Ra(e){return e==null?"--":`$${e.toFixed(2)}`}function _p(e){const t=e.channels?.channelLabels??{},n=e.channels?.channelOrder??[],s=e.channels?.channelMeta??[],i=[];for(const o of s)if(o&&typeof o=="object"&&"id"in o){const a=o.id;if(o.connected){const c=t[a]??a;i.push(c)}}if(i.length===0&&n.length>0)for(const o of n){const a=t[o]??o;i.push(a)}return r`
    <div class="statusbar__content" @click=${e.onToggle}>
      <div class="statusbar__section">
        <span class="statusDot ${e.connected?"ok":""}"></span>
        <span class="statusbar__label">Gateway: ${e.connected?"OK":"Offline"}</span>
      </div>
      <span class="statusbar__sep"></span>
      <div class="statusbar__section">
        ${i.length>0?i.map(o=>r`<span class="statusbar__channel">${o} &#10003;</span>`):r`
                <span class="statusbar__muted">No channels</span>
              `}
      </div>
      <span class="statusbar__sep"></span>
      <div class="statusbar__section">
        <span>${Ra(e.totalCost)} this month</span>
      </div>
    </div>
    ${e.expanded?r`
          <div class="statusbar__expanded">
            <div class="statusbar__panel">
              <div class="statusbar__panel-title">Gateway</div>
              <div>Status: ${e.connected?"Running":"Offline"}</div>
            </div>
            <div class="statusbar__panel">
              <div class="statusbar__panel-title">Channels</div>
              ${i.length>0?i.map(o=>r`<div>${o}: connected</div>`):r`
                      <div class="statusbar__muted">None connected</div>
                    `}
            </div>
            <div class="statusbar__panel">
              <div class="statusbar__panel-title">Cost</div>
              <div>Month: ${Ra(e.totalCost)}</div>
            </div>
          </div>
        `:v}
  `}function Hl(e,t){if(!e)return e;const s=e.files.some(i=>i.name===t.name)?e.files.map(i=>i.name===t.name?t:i):[...e.files,t];return{...e,files:s}}async function qs(e,t){if(!(!e.client||!e.connected||e.agentFilesLoading)){e.agentFilesLoading=!0,e.agentFilesError=null;try{const n=await e.client.request("agents.files.list",{agentId:t});n&&(e.agentFilesList=n,e.agentFileActive&&!n.files.some(s=>s.name===e.agentFileActive)&&(e.agentFileActive=null))}catch(n){e.agentFilesError=String(n)}finally{e.agentFilesLoading=!1}}}async function Ep(e,t,n,s){if(!(!e.client||!e.connected||e.agentFilesLoading)&&!Object.hasOwn(e.agentFileContents,n)){e.agentFilesLoading=!0,e.agentFilesError=null;try{const i=await e.client.request("agents.files.get",{agentId:t,name:n});if(i?.file){const o=i.file.content??"",a=e.agentFileContents[n]??"",l=e.agentFileDrafts[n],c=s?.preserveDraft??!0;e.agentFilesList=Hl(e.agentFilesList,i.file),e.agentFileContents={...e.agentFileContents,[n]:o},(!c||!Object.hasOwn(e.agentFileDrafts,n)||l===a)&&(e.agentFileDrafts={...e.agentFileDrafts,[n]:o})}}catch(i){e.agentFilesError=String(i)}finally{e.agentFilesLoading=!1}}}async function Lp(e,t,n,s){if(!(!e.client||!e.connected||e.agentFileSaving)){e.agentFileSaving=!0,e.agentFilesError=null;try{const i=await e.client.request("agents.files.set",{agentId:t,name:n,content:s});i?.file&&(e.agentFilesList=Hl(e.agentFilesList,i.file),e.agentFileContents={...e.agentFileContents,[n]:s},e.agentFileDrafts={...e.agentFileDrafts,[n]:s})}catch(i){e.agentFilesError=String(i)}finally{e.agentFileSaving=!1}}}async function jl(e,t){if(!(!e.client||!e.connected)&&!e.usageLoading){e.usageLoading=!0,e.usageError=null;try{const n=t?.startDate??e.usageStartDate,s=t?.endDate??e.usageEndDate,[i,o]=await Promise.all([e.client.request("sessions.usage",{startDate:n,endDate:s,limit:1e3,includeContextWeight:!0}),e.client.request("usage.cost",{startDate:n,endDate:s})]);i&&(e.usageResult=i),o&&(e.usageCostSummary=o)}catch(n){e.usageError=String(n)}finally{e.usageLoading=!1}}}async function Ip(e,t){if(!(!e.client||!e.connected)&&!e.usageTimeSeriesLoading){e.usageTimeSeriesLoading=!0,e.usageTimeSeries=null;try{const n=await e.client.request("sessions.usage.timeseries",{key:t});n&&(e.usageTimeSeries=n)}catch{e.usageTimeSeries=null}finally{e.usageTimeSeriesLoading=!1}}}async function Mp(e,t){if(!(!e.client||!e.connected)&&!e.usageSessionLogsLoading){e.usageSessionLogsLoading=!0,e.usageSessionLogs=null;try{const n=await e.client.request("sessions.usage.logs",{key:t,limit:500});n&&Array.isArray(n.logs)&&(e.usageSessionLogs=n.logs)}catch{e.usageSessionLogs=null}finally{e.usageSessionLogsLoading=!1}}}const Gs=5,Rp=15e3;class Pp{constructor(t){this.ws=null,this.url="",this.reconnectAttempts=0,this.isManualClose=!1,this.pingTimer=null,this.handlers=t,this.onMuseTalkAnswer=t.onMuseTalkAnswer}connect(t){this.ws&&this.ws.readyState===WebSocket.OPEN&&(console.warn("[DHWebSocket] Already connected, closing previous connection"),this.closeInternal()),this.url=t,this.isManualClose=!1,this.reconnectAttempts=0,this.openConnection()}sendAudio(t){this.send({type:"audio",data:t})}sendText(t){this.send({type:"text",text:t})}sendVideo(t){this.send({type:"video",data:t})}sendMuseTalkOffer(t,n){this.send({type:"musetalk_offer",data:{sdp:t,webrtcId:n}})}disconnect(){this.isManualClose=!0,this.closeInternal(),console.log("[DHWebSocket] Disconnected")}get isConnected(){return this.ws?.readyState===WebSocket.OPEN}openConnection(){try{this.ws=new WebSocket(this.url)}catch(t){console.error("[DHWebSocket] Failed to create WebSocket:",t),this.scheduleReconnect();return}this.ws.onopen=()=>{console.log("[DHWebSocket] Connected:",this.url),this.reconnectAttempts=0,this.startPing(),this.handlers.onConnected?.()},this.ws.onmessage=t=>{this.handleMessage(t.data)},this.ws.onerror=t=>{console.error("[DHWebSocket] WebSocket error:",t)},this.ws.onclose=t=>{console.log(`[DHWebSocket] Connection closed: code=${t.code}, reason=${t.reason}`),this.stopPing(),this.isManualClose?this.handlers.onClose?.():this.scheduleReconnect()}}closeInternal(){this.stopPing(),this.ws&&(this.ws.onopen=null,this.ws.onmessage=null,this.ws.onerror=null,this.ws.onclose=null,this.ws.close(),this.ws=null)}scheduleReconnect(){if(this.reconnectAttempts>=Gs){console.error(`[DHWebSocket] Giving up after ${Gs} reconnect attempts`),this.handlers.onClose?.();return}this.reconnectAttempts++;const t=1e3*Math.pow(2,this.reconnectAttempts-1);console.log(`[DHWebSocket] Reconnecting in ${t} ms (attempt ${this.reconnectAttempts}/${Gs})`),setTimeout(()=>{this.isManualClose||this.openConnection()},t)}startPing(){this.stopPing(),this.pingTimer=setInterval(()=>{this.isConnected&&this.send({type:"ping"})},Rp)}stopPing(){this.pingTimer!==null&&(clearInterval(this.pingTimer),this.pingTimer=null)}send(t){if(!this.isConnected){console.warn("[DHWebSocket] Cannot send: not connected");return}try{this.ws.send(JSON.stringify(t))}catch(n){console.error("[DHWebSocket] Send failed:",n)}}handleMessage(t){let n;try{n=JSON.parse(t)}catch(s){console.error("[DHWebSocket] Failed to parse message:",s,t);return}try{this.dispatch(n)}catch(s){console.error("[DHWebSocket] Handler threw an error:",s)}}dispatch(t){const n=t.data??{};switch(t.type){case"dh_stream_info":case"stream_info":{const s=n;this.handlers.onDhStreamInfo?.(s);break}case"ai_text":{const s=n.content??n.text??t.content??"",i=!!(n.is_delta??n.isDelta??t.is_delta??!1);this.handlers.onAiText?.(s,i);break}case"ai_audio":{const s=n.audio??t.audio??"",i=n.sample_rate??n.sampleRate??t.sample_rate??24e3;s&&this.handlers.onAiAudio?.(s,i);break}case"ai_thinking":{const s=!!(n.thinking??t.thinking??!1);this.handlers.onAiThinking?.(s);break}case"response_started":case"ai_response_started":this.handlers.onAiResponseStarted?.();break;case"response_done":case"ai_response_done":this.handlers.onAiResponseDone?.();break;case"speech_started":case"ai_speech_interrupted":this.handlers.onAiSpeechInterrupted?.();break;case"user_transcript":{const s=n.content??n.transcript??t.content??"";this.handlers.onUserTranscript?.(s);break}case"musetalk_answer":{const s=n.sdp,i=n.error;this.onMuseTalkAnswer?.({sdp:s,error:i});break}case"error":{const s=t.code??n.code??"UNKNOWN",i=t.message??n.message??"Unknown error";console.error(`[DHWebSocket] Backend error: [${s}] ${i}`),this.handlers.onError?.(s,i);break}case"session.created":console.log("[DHWebSocket] Session created:",t.sessionId);break;case"pong":break;default:console.debug("[DHWebSocket] Unhandled message type:",t.type,t);break}}}const Dp=1,Fp=2,Pa=3,Np=0;class Op{constructor(t,n,s={}){this.engine=null,this.firstRemoteSet=!1,this.autoplayFailedUsers=new Set,this.initialized=!1,this.appId=t,this.renderDomId=n,this.callbacks=s}async ensureEngine(){if(this.engine)return this.engine;if(this.initialized)throw new Error("[ByteRTC] Engine initialization already in progress");this.initialized=!0;try{const n=await import(new URL("./vendor/byteplus-rtc.esm.js",window.location.href).href),s=n.default??n;return this.engine=s.createEngine(this.appId),console.log(`[ByteRTC] Engine created: appId=${this.appId}, SDK v${s.getSdkVersion()}`),this.bindEvents(s),this.engine}catch(t){throw this.initialized=!1,console.error("[ByteRTC] Failed to load @byteplus/rtc SDK:",t),this.callbacks.onError?.(t),t}}bindEvents(t){this.engine&&(this.engine.on(t.events.onUserPublishStream,async n=>{const{userId:s,mediaType:i}=n;if(console.log(`[ByteRTC] User published stream: userId=${s}, mediaType=${i}`),(i&Pa)!==0||(i&Fp)!==0||(i&Dp)!==0)try{if(await this.engine.subscribeStream(s,Pa),console.log(`[ByteRTC] Subscribed to stream: userId=${s}`),!this.firstRemoteSet){const a=document.getElementById(this.renderDomId);a&&(a.innerHTML=""),await this.engine.setRemoteVideoPlayer(Np,{userId:s,renderDom:this.renderDomId}),this.firstRemoteSet=!0,this.callbacks.onStreamReady?.(),console.log(`[ByteRTC] Video player set: userId=${s}, dom=#${this.renderDomId}`)}}catch(a){console.error("[ByteRTC] Subscribe error:",a),this.callbacks.onError?.(a)}}),this.engine.on(t.events.onUserJoined,n=>{const s=n?.userInfo?.userId;s&&(console.log(`[ByteRTC] User joined: ${s}`),this.callbacks.onUserJoined?.(s))}),this.engine.on(t.events.onUserLeave,n=>{const s=n?.userInfo?.userId;s&&(console.log(`[ByteRTC] User left: ${s}`),this.callbacks.onUserLeave?.(s))}),this.engine.on(t.events.onAutoplayFailed,n=>{const{userId:s,kind:i}=n;console.warn(`[ByteRTC] Autoplay failed: userId=${s}, kind=${i}`),this.autoplayFailedUsers.add(s),this.callbacks.onAutoplayFailed?.(s,i)}),this.engine.on(t.events.onError,n=>{console.error("[ByteRTC] SDK error:",n),this.callbacks.onError?.(n)}))}async join(t,n,s){const i=await this.ensureEngine();console.log(`[ByteRTC] Joining room: roomId=${n}, userId=${s}`),await i.joinRoom(t,n,{userId:s},{isAutoPublish:!1,isAutoSubscribeAudio:!0,isAutoSubscribeVideo:!0})}play(t){if(this.engine)try{this.engine.play?.(t),this.autoplayFailedUsers.delete(t)}catch{}}playAll(){for(const t of this.autoplayFailedUsers)this.play(t)}async leave(){if(this.engine){try{await this.engine.leaveRoom(),console.log("[ByteRTC] Left room")}catch(t){console.warn("[ByteRTC] Error leaving room:",t)}this.firstRemoteSet=!1,this.autoplayFailedUsers.clear()}}destroy(){this.leave().catch(()=>{}),this.engine=null,this.initialized=!1,console.log("[ByteRTC] Viewer destroyed")}}class Yn{constructor(t,n={}){this.pc=null,this.videoEl=null,this.mediaStream=null,this.localStream=null,this.cleaned=!1,this.streamReadyFired=!1,this.playWebRtcAudio=(()=>{try{return new URLSearchParams(location.search).get("webrtcAudio")==="1"}catch{return!1}})(),this.containerId=t,this.callbacks=n}async join(t){const{exchangeOffer:n}=t,s=t.sessionId||Yn.uuid(),i=t.iceServers&&t.iceServers.length>0?t.iceServers:[{urls:"stun:stun.l.google.com:19302"}];console.log("[MuseTalkViewer] join (offer proxied via DH WS)","webrtc_id=",s,"iceServers=",i.length);const o=new RTCPeerConnection({iceServers:i});this.pc=o,this.mediaStream=new MediaStream;const a=o.createDataChannel("control",{ordered:!0});a.onopen=()=>console.log("[MuseTalkViewer] DataChannel open (unblocks VM audio_emit)"),a.onclose=()=>console.log("[MuseTalkViewer] DataChannel closed"),a.onerror=c=>console.warn("[MuseTalkViewer] DataChannel error:",c);const l=Yn.createSilentAudioTrack();l?(this.localStream=new MediaStream([l]),o.addTransceiver(l,{direction:"sendrecv",streams:[this.localStream]}),console.log("[MuseTalkViewer] Attached silent wake-up audio track (sendrecv)")):(o.addTransceiver("audio",{direction:"sendrecv"}),console.warn("[MuseTalkViewer] No AudioContext — silent wake-up track unavailable; emit() may not start")),o.addTransceiver("video",{direction:"sendrecv"}),o.ontrack=c=>{console.log("[MuseTalkViewer] ontrack:",c.track.kind,"muted=",c.track.muted),this.mediaStream&&!this.mediaStream.getTracks().includes(c.track)&&this.mediaStream.addTrack(c.track),this.attachToVideoElement()},o.onconnectionstatechange=()=>{const c=o.connectionState;console.log("[MuseTalkViewer] connectionState:",c),c==="connected"?(this.callbacks.onUserJoined?.(s),this.streamReadyFired||(this.streamReadyFired=!0,this.callbacks.onStreamReady?.())):(c==="failed"||c==="disconnected"||c==="closed")&&(this.cleaned||this.callbacks.onUserLeave?.(s))},o.oniceconnectionstatechange=()=>{console.log("[MuseTalkViewer] iceConnectionState:",o.iceConnectionState)};try{const c=await o.createOffer();await o.setLocalDescription(c),await this.waitForIceGathering(o,2e3);const g=o.localDescription?.sdp||"",p=await n(g,s);if(!p||typeof p!="string")throw new Error("offer exchange returned empty answer SDP");await o.setRemoteDescription({type:"answer",sdp:p}),console.log("[MuseTalkViewer] Remote description set, waiting for media...")}catch(c){throw console.error("[MuseTalkViewer] join failed:",c),this.callbacks.onError?.(c),c}}waitForIceGathering(t,n){return new Promise(s=>{if(t.iceGatheringState==="complete"){s();return}const i=setTimeout(()=>s(),n),o=()=>{t.iceGatheringState==="complete"&&(clearTimeout(i),t.removeEventListener("icegatheringstatechange",o),s())};t.addEventListener("icegatheringstatechange",o)})}attachToVideoElement(){if(!this.mediaStream)return;const t=document.getElementById(this.containerId);if(!t){console.warn("[MuseTalkViewer] container not found:",this.containerId);return}let n=this.videoEl;n||(n=document.createElement("video"),n.autoplay=!0,n.playsInline=!0,n.muted=!0,n.controls=!1,n.style.backgroundColor="#000",n.style.width="100%",n.style.height="100%",n.style.objectFit="cover",n.setAttribute("data-source","musetalk-webrtc"),t.appendChild(n),this.videoEl=n,this.playWebRtcAudio&&this.armWebRtcAudioUnmute()),n.srcObject=this.mediaStream;const s=n.play();s&&typeof s.then=="function"&&s.then(()=>{console.log("[MuseTalkViewer] Video playing"),this.callbacks.onStreamReady?.()}).catch(i=>{console.warn("[MuseTalkViewer] Autoplay blocked:",i?.message??i),this.callbacks.onAutoplayFailed?.("avatar","video"),this.callbacks.onStreamReady?.()})}async play(t){if(this.videoEl)try{await this.videoEl.play()}catch(n){console.warn("[MuseTalkViewer] play() still failed:",n)}}armWebRtcAudioUnmute(){const t=()=>{const n=this.videoEl;n&&(n.muted=!1,n.play().catch(()=>{}),console.log("[MuseTalkViewer] WebRTC audio un-muted on user gesture")),document.removeEventListener("pointerdown",t),document.removeEventListener("keydown",t)};document.addEventListener("pointerdown",t,{once:!0}),document.addEventListener("keydown",t,{once:!0})}async leave(){if(this.cleaned=!0,this.pc){try{this.pc.close()}catch{}this.pc=null}if(this.localStream){for(const t of this.localStream.getTracks())try{t.stop()}catch{}this.localStream=null}this.videoEl?.parentNode&&(this.videoEl.pause(),this.videoEl.srcObject=null,this.videoEl.parentNode.removeChild(this.videoEl),this.videoEl=null),this.mediaStream=null}destroy(){this.leave().catch(()=>{})}static createSilentAudioTrack(){try{const t=window.AudioContext||window.webkitAudioContext;if(!t)return null;const n=new t;n.state==="suspended"&&typeof n.resume=="function"&&n.resume().catch(()=>{});const s=n.createOscillator(),i=n.createGain();i.gain.value=1e-4,s.frequency.value=440,s.connect(i);const o=n.createMediaStreamDestination();return i.connect(o),s.start(),o.stream.getAudioTracks()[0]||null}catch(t){return console.warn("[MuseTalkViewer] createSilentAudioTrack failed:",t),null}}static uuid(){const t=globalThis.crypto;return t&&typeof t.randomUUID=="function"?t.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,n=>{const s=Math.random()*16|0;return(n==="x"?s:s&3|8).toString(16)})}}class Bp{constructor(t){this.audioContext=null,this.mediaStream=null,this.sourceNode=null,this.processorNode=null,this._isRecording=!1,this._isMuted=!1,this.targetSampleRate=16e3,this.bufferSize=4096,this.onAudioData=t}get isRecording(){return this._isRecording}get isMuted(){return this._isMuted}async start(){if(this._isRecording){console.warn("[AudioRecorder] Already recording");return}if(!navigator.mediaDevices?.getUserMedia)throw new Error("[AudioRecorder] Microphone requires a secure context (HTTPS or localhost).");try{this.mediaStream=await navigator.mediaDevices.getUserMedia({audio:{sampleRate:{ideal:this.targetSampleRate},channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}});const t=window.AudioContext??window.webkitAudioContext;this.audioContext=new t,this.sourceNode=this.audioContext.createMediaStreamSource(this.mediaStream),this.processorNode=this.audioContext.createScriptProcessor(this.bufferSize,1,1),this.processorNode.onaudioprocess=n=>{if(n.outputBuffer.getChannelData(0).fill(0),!this._isRecording)return;const s=n.inputBuffer.getChannelData(0),i=this.audioContext.sampleRate,o=this.downsample(s,i,this.targetSampleRate);if(o.length===0)return;const a=this.float32ToPCM16(o),l=this.arrayBufferToBase64(a.buffer);this.onAudioData(l)},this.sourceNode.connect(this.processorNode),this.processorNode.connect(this.audioContext.destination),this._isRecording=!0,console.log(`[AudioRecorder] Started: native=${this.audioContext.sampleRate} Hz → target=${this.targetSampleRate} Hz, buffer=${this.bufferSize}`)}catch(t){throw console.error("[AudioRecorder] Failed to start:",t),this.cleanup(),t}}stop(){this._isRecording&&(this._isRecording=!1,this.cleanup(),console.log("[AudioRecorder] Stopped"))}setMuted(t){if(this._isMuted=t,this.mediaStream)for(const n of this.mediaStream.getAudioTracks())n.enabled=!t}cleanup(){if(this.processorNode&&(this.processorNode.disconnect(),this.processorNode.onaudioprocess=null,this.processorNode=null),this.sourceNode&&(this.sourceNode.disconnect(),this.sourceNode=null),this.audioContext&&(this.audioContext.close().catch(()=>{}),this.audioContext=null),this.mediaStream){for(const t of this.mediaStream.getTracks())t.stop();this.mediaStream=null}}downsample(t,n,s){if(n===s)return t;const i=n/s,o=Math.round(t.length/i),a=new Float32Array(o);for(let l=0;l<o;l++){const c=Math.round(l*i),g=Math.round((l+1)*i);let p=0,u=0;for(let h=c;h<g&&h<t.length;h++)p+=t[h],u++;a[l]=u>0?p/u:0}return a}float32ToPCM16(t){const n=new Int16Array(t.length);for(let s=0;s<t.length;s++){const i=Math.max(-1,Math.min(1,t[s]));n[s]=i<0?i*32768:i*32767}return n}arrayBufferToBase64(t){const n=new Uint8Array(t);let s="";for(let i=0;i<n.length;i++)s+=String.fromCharCode(n[i]);return btoa(s)}}class Up{constructor(t=24e3,n=0){this.audioContext=null,this.nextStartTime=0,this._isPlaying=!1,this.freshStart=!0,this.activeSources=new Set,this.defaultSampleRate=t,this.playbackDelaySec=Number.isFinite(n)&&n>0?n:0}playChunk(t,n){try{const s=this.ensureContext(),i=n??this.defaultSampleRate,o=atob(t),a=new Uint8Array(o.length);for(let f=0;f<o.length;f++)a[f]=o.charCodeAt(f);const l=Math.floor(a.length/2);if(l===0)return;const c=new Float32Array(l),g=new DataView(a.buffer);for(let f=0;f<l;f++)c[f]=g.getInt16(f*2,!0)/32768;const p=s.createBuffer(1,l,i);p.copyToChannel(c,0);const u=s.createBufferSource();u.buffer=p,u.connect(s.destination);const h=s.currentTime;this.freshStart?(this.nextStartTime=h+this.playbackDelaySec,this.freshStart=!1):this.nextStartTime<h&&(this.nextStartTime=h),u.start(this.nextStartTime),this.nextStartTime+=p.duration,this._isPlaying=!0,this.activeSources.add(u),u.onended=()=>{this.activeSources.delete(u),s.currentTime>=this.nextStartTime-.01&&(this._isPlaying=!1)}}catch(s){console.error("[AudioPlayer] Error playing chunk:",s)}}stop(){this.cancelActiveSources(),this.audioContext&&(this.audioContext.close().catch(()=>{}),this.audioContext=null),this.nextStartTime=0,this._isPlaying=!1,this.freshStart=!0}flush(){this.cancelActiveSources(),this.nextStartTime=0,this._isPlaying=!1,this.freshStart=!0}cancelActiveSources(){for(const t of this.activeSources)try{t.onended=null,t.stop(),t.disconnect()}catch{}this.activeSources.clear()}resume(){this.nextStartTime=0,this._isPlaying=!1,this.freshStart=!0,this.audioContext?.state==="suspended"&&this.audioContext.resume().catch(()=>{})}get isPlaying(){return this._isPlaying}ensureContext(){return(!this.audioContext||this.audioContext.state==="closed")&&(this.audioContext=new AudioContext({sampleRate:this.defaultSampleRate})),this.audioContext.state==="suspended"&&this.audioContext.resume().catch(()=>{}),this.audioContext}}class zp{constructor(){this.videoElement=null,this.canvas=null,this.canvasCtx=null,this.mediaStream=null,this.captureInterval=null,this._isCapturing=!1,this.onFrame=null,this.width=640,this.height=480,this.fps=2,this.jpegQuality=.7}get isCapturing(){return this._isCapturing}get stream(){return this.mediaStream}async start(t,n){if(this._isCapturing)return console.warn("[VideoCapture] Already capturing"),this.mediaStream;this.onFrame=t;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera requires a secure context (HTTPS or localhost). Please access via https:// or http://localhost.");if(this.mediaStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:this.width},height:{ideal:this.height},facingMode:"user"}}),n&&(n.srcObject=this.mediaStream,n.muted=!0,n.playsInline=!0,await n.play().catch(()=>{console.warn("[VideoCapture] Preview autoplay blocked — user interaction required")})),this.videoElement=document.createElement("video"),this.videoElement.srcObject=this.mediaStream,this.videoElement.muted=!0,this.videoElement.playsInline=!0,await this.videoElement.play(),this.canvas=document.createElement("canvas"),this.canvas.width=this.width,this.canvas.height=this.height,this.canvasCtx=this.canvas.getContext("2d"),!this.canvasCtx)throw new Error("[VideoCapture] Failed to obtain 2D canvas context");return this.captureInterval=setInterval(()=>this.captureFrame(),1e3/this.fps),this._isCapturing=!0,console.log(`[VideoCapture] Started — ${this.width}x${this.height} @ ${this.fps} fps, JPEG quality=${this.jpegQuality}`),this.mediaStream}catch(s){throw console.error("[VideoCapture] Failed to start:",s),this.cleanup(),s}}stop(){this._isCapturing&&(this._isCapturing=!1,this.cleanup(),console.log("[VideoCapture] Stopped"))}setEnabled(t){this.mediaStream&&this.mediaStream.getVideoTracks().forEach(n=>{n.enabled=t})}captureFrame(){if(!this._isCapturing||!this.videoElement||!this.canvasCtx||!this.canvas||!this.onFrame||this.videoElement.readyState<this.videoElement.HAVE_CURRENT_DATA)return;this.canvasCtx.drawImage(this.videoElement,0,0,this.width,this.height);const n=this.canvas.toDataURL("image/jpeg",this.jpegQuality).split(",")[1];n&&this.onFrame(n)}cleanup(){this.captureInterval!==null&&(clearInterval(this.captureInterval),this.captureInterval=null),this.videoElement&&(this.videoElement.pause(),this.videoElement.srcObject=null,this.videoElement=null),this.mediaStream&&(this.mediaStream.getTracks().forEach(t=>t.stop()),this.mediaStream=null),this.canvas=null,this.canvasCtx=null,this.onFrame=null}}const Hp=800,Da="dh-video-player",Qs=250;function jp(){try{const e=new URLSearchParams(location.search).get("audioDelay"),t=e==null?Qs:Number(e);return Number.isFinite(t)?Math.min(2e3,Math.max(0,t))/1e3:Qs/1e3}catch{return Qs/1e3}}function Kp(){try{return new URLSearchParams(location.search).get("webrtcAudio")==="1"}catch{return!1}}class Wp{constructor(t){this.ws=null,this.rtcViewer=null,this.recorder=null,this.museTalkMode=!1,this.player=null,this.unmuteTimer=null,this.cameraStream=null,this.cameraEnabled=!1,this.videoCapture=null,this.callbacks=t}async start(t,n){await this.stop(),this.callbacks.onConnectionStatusChange("connecting");const i=location.protocol==="https:"?`wss://${location.host}/api/dh/connect/${n}`:`ws://${location.hostname}:${t}/api/dh/connect/${n}`;this.ws=new Pp(this.buildMessageHandlers()),this.ws.connect(i),this.player=new Up(24e3,jp()),this.recorder=new Bp(o=>{this.ws?.sendAudio(o)});try{await this.recorder.start()}catch(o){console.error("[DHSessionController] Microphone access denied:",o),this.callbacks.onErrorMessage(o instanceof Error?o.message:"Microphone access denied")}}async stop(){this.unmuteTimer!==null&&(clearTimeout(this.unmuteTimer),this.unmuteTimer=null),this.museTalkMode=!1,this.recorder&&(this.recorder.stop(),this.recorder=null),this.stopCamera(),this.rtcViewer&&(await this.rtcViewer.leave().catch(()=>{}),this.rtcViewer=null),this.player&&(this.player.stop(),this.player=null),this.ws&&(this.ws.disconnect(),this.ws=null),this.callbacks.onConnectionStatusChange("disconnected")}toggleMic(){if(!this.recorder)return!1;const t=!this.recorder.isMuted;return this.recorder.setMuted(t),!t}toggleCamera(){return this.cameraEnabled=!this.cameraEnabled,this.cameraEnabled?this.startCamera():this.stopCamera(),this.cameraEnabled}async startCamera(){try{let t=null;for(let s=0;s<20&&(await new Promise(i=>setTimeout(i,50)),t=document.getElementById("camera-preview"),!t);s++);t||console.warn("[DHSessionController] #camera-preview not found after 1s"),this.videoCapture=new zp;let n=0;this.cameraStream=await this.videoCapture.start(s=>{n++,(n===1||n%10===0)&&console.log(`[DHSessionController] 📹 captured frame #${n} (base64 len=${s.length}); ws.connected=${this.ws?.isConnected}`);try{this.ws?.sendVideo(s)}catch(i){console.warn("[DHSessionController] sendVideo failed:",i)}},t),console.log("[DHSessionController] Camera started — VideoCapture is now emitting frames")}catch(t){if(console.error("[DHSessionController] Camera access denied or capture failed:",t),this.cameraEnabled=!1,this.cameraStream=null,this.videoCapture){try{this.videoCapture.stop()}catch{}this.videoCapture=null}}}stopCamera(){const t=!!this.videoCapture||!!this.cameraStream;if(this.videoCapture){try{this.videoCapture.stop()}catch{}this.videoCapture=null}this.cameraStream=null;const n=document.getElementById("camera-preview");n&&(n.srcObject=null),t&&console.log("[DHSessionController] Camera stopped")}buildMessageHandlers(){return{onConnected:()=>{console.log("[DHSessionController] WebSocket connected"),this.callbacks.onConnectionStatusChange("connected")},onDhStreamInfo:t=>{console.log("[DHSessionController] DH stream info received:",t),this.initRtcViewer(t)},onAiText:(t,n)=>{this.callbacks.onSubtitleUpdate(t,n)},onAiAudio:(t,n)=>{const s=this.museTalkMode&&Kp();(this.museTalkMode||!this.rtcViewer)&&!s&&this.player?.playChunk(t,n)},onAiResponseStarted:()=>{this.recorder&&this.recorder.setMuted(!0),this.player?.resume()},onAiSpeechInterrupted:()=>{this.player?.flush(),this.unmuteTimer!==null&&(clearTimeout(this.unmuteTimer),this.unmuteTimer=null)},onAiResponseDone:()=>{this.unmuteTimer!==null&&clearTimeout(this.unmuteTimer),this.unmuteTimer=setTimeout(()=>{this.unmuteTimer=null,this.recorder&&this.recorder.setMuted(!1)},Hp)},onUserTranscript:t=>{this.callbacks.onUserTranscript(t)},onAiThinking:t=>{this.callbacks.onThinkingChange?.(t)},onError:(t,n)=>{console.error(`[DHSessionController] Backend error [${t}]: ${n}`),this.callbacks.onErrorMessage(n),this.callbacks.onConnectionStatusChange("error")},onClose:()=>{console.log("[DHSessionController] WebSocket closed"),this.callbacks.onConnectionStatusChange("disconnected")}}}initRtcViewer(t){this.rtcViewer&&(this.rtcViewer.destroy(),this.rtcViewer=null),t.provider==="musetalk"?this.initMuseTalkViewer(t):this.initByteRtcViewer(t)}initMuseTalkViewer(t){this.museTalkMode=!0;const n=new Yn(Da,{onStreamReady:()=>{console.log("[DHSessionController] MuseTalk WebRTC stream ready")},onAutoplayFailed:(i,o)=>{console.warn(`[DHSessionController] MuseTalk autoplay failed for userId=${i}, kind=${o}`)},onError:i=>{console.error("[DHSessionController] MuseTalk error:",i),this.callbacks.onErrorMessage(i instanceof Error?i.message:"MuseTalk error")}});this.rtcViewer=n;const s=(i,o)=>new Promise((a,l)=>{const c=this.ws;if(!c){l(new Error("DH WebSocket not available for offer exchange"));return}const g=setTimeout(()=>l(new Error("musetalk offer proxy timeout")),2e4);c.onMuseTalkAnswer=p=>{clearTimeout(g),p.error?l(new Error(p.error)):p.sdp?a(p.sdp):l(new Error("empty answer"))},c.sendMuseTalkOffer(i,o)});n.join({exchangeOffer:s,sessionId:t.sessionId,iceServers:t.iceServers}).catch(i=>{console.error("[DHSessionController] MuseTalk join failed:",i),this.callbacks.onErrorMessage(i instanceof Error?i.message:"MuseTalk join failed")})}initByteRtcViewer(t){const n=new Op(t.rtcAppId,Da,{onStreamReady:()=>{console.log("[DHSessionController] ByteRTC stream ready")},onAutoplayFailed:(s,i)=>{console.warn(`[DHSessionController] Autoplay failed for userId=${s}, kind=${i}`)},onError:s=>{console.error("[DHSessionController] ByteRTC error:",s),this.callbacks.onErrorMessage(s instanceof Error?s.message:"ByteRTC error")}});this.rtcViewer=n,n.join(t.viewerToken,t.roomId,t.viewerUid).catch(s=>{console.error("[DHSessionController] ByteRTC join failed:",s),this.callbacks.onErrorMessage(s instanceof Error?s.message:"ByteRTC join failed")})}}const Jn=[{id:"read",label:"read",description:"Read file contents",sectionId:"fs",profiles:["coding"]},{id:"write",label:"write",description:"Create or overwrite files",sectionId:"fs",profiles:["coding"]},{id:"edit",label:"edit",description:"Make precise edits",sectionId:"fs",profiles:["coding"]},{id:"apply_patch",label:"apply_patch",description:"Patch files (OpenAI)",sectionId:"fs",profiles:["coding"]},{id:"exec",label:"exec",description:"Run shell commands",sectionId:"runtime",profiles:["coding"]},{id:"process",label:"process",description:"Manage background processes",sectionId:"runtime",profiles:["coding"]},{id:"web_search",label:"web_search",description:"Search the web",sectionId:"web",profiles:[],includeInWinClawGroup:!0},{id:"web_fetch",label:"web_fetch",description:"Fetch web content",sectionId:"web",profiles:[],includeInWinClawGroup:!0},{id:"memory_search",label:"memory_search",description:"Semantic search",sectionId:"memory",profiles:["coding"],includeInWinClawGroup:!0},{id:"memory_get",label:"memory_get",description:"Read memory files",sectionId:"memory",profiles:["coding"],includeInWinClawGroup:!0},{id:"sessions_list",label:"sessions_list",description:"List sessions",sectionId:"sessions",profiles:["coding","messaging"],includeInWinClawGroup:!0},{id:"sessions_history",label:"sessions_history",description:"Session history",sectionId:"sessions",profiles:["coding","messaging"],includeInWinClawGroup:!0},{id:"sessions_send",label:"sessions_send",description:"Send to session",sectionId:"sessions",profiles:["coding","messaging"],includeInWinClawGroup:!0},{id:"sessions_spawn",label:"sessions_spawn",description:"Spawn sub-agent",sectionId:"sessions",profiles:["coding"],includeInWinClawGroup:!0},{id:"subagents",label:"subagents",description:"Manage sub-agents",sectionId:"sessions",profiles:["coding"],includeInWinClawGroup:!0},{id:"session_status",label:"session_status",description:"Session status",sectionId:"sessions",profiles:["minimal","coding","messaging"],includeInWinClawGroup:!0},{id:"browser",label:"browser",description:"Control web browser",sectionId:"ui",profiles:[],includeInWinClawGroup:!0},{id:"canvas",label:"canvas",description:"Control canvases",sectionId:"ui",profiles:[],includeInWinClawGroup:!0},{id:"message",label:"message",description:"Send messages",sectionId:"messaging",profiles:["messaging"],includeInWinClawGroup:!0},{id:"cron",label:"cron",description:"Schedule tasks",sectionId:"automation",profiles:["coding"],includeInWinClawGroup:!0},{id:"gateway",label:"gateway",description:"Gateway control",sectionId:"automation",profiles:[],includeInWinClawGroup:!0},{id:"nodes",label:"nodes",description:"Nodes + devices",sectionId:"nodes",profiles:[],includeInWinClawGroup:!0},{id:"agents_list",label:"agents_list",description:"List agents",sectionId:"agents",profiles:[],includeInWinClawGroup:!0},{id:"image",label:"image",description:"Image understanding",sectionId:"media",profiles:["coding"],includeInWinClawGroup:!0},{id:"tts",label:"tts",description:"Text-to-speech conversion",sectionId:"media",profiles:[],includeInWinClawGroup:!0}];new Map(Jn.map(e=>[e.id,e]));function Ys(e){return Jn.filter(t=>t.profiles.includes(e)).map(t=>t.id)}const Vp={minimal:{allow:Ys("minimal")},coding:{allow:Ys("coding")},messaging:{allow:Ys("messaging")},full:{}};function qp(){const e=new Map;for(const n of Jn){const s=`group:${n.sectionId}`,i=e.get(s)??[];i.push(n.id),e.set(s,i)}return{"group:winclaw":Jn.filter(n=>n.includeInWinClawGroup).map(n=>n.id),...Object.fromEntries(e.entries())}}const Gp=qp();function Qp(e){if(!e)return;const t=Vp[e];if(t&&!(!t.allow&&!t.deny))return{allow:t.allow?[...t.allow]:void 0,deny:t.deny?[...t.deny]:void 0}}const Yp={bash:"exec","apply-patch":"apply_patch"},Jp={...Gp};function Ne(e){const t=e.trim().toLowerCase();return Yp[t]??t}function Zp(e){return e?e.map(Ne).filter(Boolean):[]}function Xp(e){const t=Zp(e),n=[];for(const s of t){const i=Jp[s];if(i){n.push(...i);continue}n.push(s)}return Array.from(new Set(n))}function eh(e){return Qp(e)}function th(e){const t=e.host??"unknown",n=e.ip?`(${e.ip})`:"",s=e.mode??"",i=e.version??"";return`${t} ${n} ${s} ${i}`.trim()}function nh(e){const t=e.ts??null;return t?Y(t):"n/a"}function mo(e){return e?`${xt(e)} (${Y(e)})`:"n/a"}function sh(e){if(e.totalTokens==null)return"n/a";const t=e.totalTokens??0,n=e.contextTokens??0;return n?`${t} / ${n}`:String(t)}function ih(e){if(e==null)return"";try{return JSON.stringify(e,null,2)}catch{return String(e)}}function oh(e){const t=e.state??{},n=t.nextRunAtMs?xt(t.nextRunAtMs):"n/a",s=t.lastRunAtMs?xt(t.lastRunAtMs):"n/a";return`${t.lastStatus??"n/a"} · next ${n} · last ${s}`}function Kl(e){const t=e.schedule;if(t.kind==="at"){const n=Date.parse(t.at);return Number.isFinite(n)?`At ${xt(n)}`:`At ${t.at}`}return t.kind==="every"?`Every ${Qi(t.everyMs)}`:`Cron ${t.expr}${t.tz?` (${t.tz})`:""}`}function ah(e){const t=e.payload;if(t.kind==="systemEvent")return`System: ${t.text}`;const n=`Agent: ${t.message}`,s=e.delivery;if(s&&s.mode!=="none"){const i=s.channel||s.to?` (${s.channel??"last"}${s.to?` -> ${s.to}`:""})`:"";return`${n} · ${s.mode}${i}`}return n}const Fa=[{id:"fs",label:"Files",tools:[{id:"read",label:"read",description:"Read file contents"},{id:"write",label:"write",description:"Create or overwrite files"},{id:"edit",label:"edit",description:"Make precise edits"},{id:"apply_patch",label:"apply_patch",description:"Patch files (OpenAI)"}]},{id:"runtime",label:"Runtime",tools:[{id:"exec",label:"exec",description:"Run shell commands"},{id:"process",label:"process",description:"Manage background processes"}]},{id:"web",label:"Web",tools:[{id:"web_search",label:"web_search",description:"Search the web"},{id:"web_fetch",label:"web_fetch",description:"Fetch web content"}]},{id:"memory",label:"Memory",tools:[{id:"memory_search",label:"memory_search",description:"Semantic search"},{id:"memory_get",label:"memory_get",description:"Read memory files"}]},{id:"sessions",label:"Sessions",tools:[{id:"sessions_list",label:"sessions_list",description:"List sessions"},{id:"sessions_history",label:"sessions_history",description:"Session history"},{id:"sessions_send",label:"sessions_send",description:"Send to session"},{id:"sessions_spawn",label:"sessions_spawn",description:"Spawn sub-agent"},{id:"session_status",label:"session_status",description:"Session status"}]},{id:"ui",label:"UI",tools:[{id:"browser",label:"browser",description:"Control web browser"},{id:"canvas",label:"canvas",description:"Control canvases"}]},{id:"messaging",label:"Messaging",tools:[{id:"message",label:"message",description:"Send messages"}]},{id:"automation",label:"Automation",tools:[{id:"cron",label:"cron",description:"Schedule tasks"},{id:"gateway",label:"gateway",description:"Gateway control"}]},{id:"nodes",label:"Nodes",tools:[{id:"nodes",label:"nodes",description:"Nodes + devices"}]},{id:"agents",label:"Agents",tools:[{id:"agents_list",label:"agents_list",description:"List agents"}]},{id:"media",label:"Media",tools:[{id:"image",label:"image",description:"Image understanding"}]}],rh=[{id:"minimal",label:"Minimal"},{id:"coding",label:"Coding"},{id:"messaging",label:"Messaging"},{id:"full",label:"Full"}];function $i(e){return e.name?.trim()||e.identity?.name?.trim()||e.id}function An(e){const t=e.trim();if(!t||t.length>16)return!1;let n=!1;for(let s=0;s<t.length;s+=1)if(t.charCodeAt(s)>127){n=!0;break}return!(!n||t.includes("://")||t.includes("/")||t.includes("."))}function ms(e,t){const n=t?.emoji?.trim();if(n&&An(n))return n;const s=e.identity?.emoji?.trim();if(s&&An(s))return s;const i=t?.avatar?.trim();if(i&&An(i))return i;const o=e.identity?.avatar?.trim();return o&&An(o)?o:""}function Wl(e,t){return t&&e===t?"default":null}function lh(e){if(e==null||!Number.isFinite(e))return"-";if(e<1024)return`${e} B`;const t=["KB","MB","GB","TB"];let n=e/1024,s=0;for(;n>=1024&&s<t.length-1;)n/=1024,s+=1;return`${n.toFixed(n<10?1:0)} ${t[s]}`}function vs(e,t){const n=e;return{entry:(n?.agents?.list??[]).find(o=>o?.id===t),defaults:n?.agents?.defaults,globalTools:n?.tools}}function Vl(e,t,n,s,i){const o=vs(t,e.id),l=(n&&n.agentId===e.id?n.workspace:null)||o.entry?.workspace||o.defaults?.workspace||"default",c=o.entry?.model?en(o.entry?.model):en(o.defaults?.model),g=i?.name?.trim()||e.identity?.name?.trim()||e.name?.trim()||o.entry?.name||e.id,p=ms(e,i)||"-",u=Array.isArray(o.entry?.skills)?o.entry?.skills:null,h=u?.length??null;return{workspace:l,model:c,identityName:g,identityEmoji:p,skillsLabel:u?`${h} selected`:"all skills",isDefault:!!(s&&e.id===s)}}function en(e){if(!e)return"-";if(typeof e=="string")return e.trim()||"-";if(typeof e=="object"&&e){const t=e,n=t.primary?.trim();if(n){const s=Array.isArray(t.fallbacks)?t.fallbacks.length:0;return s>0?`${n} (+${s} fallback)`:n}}return"-"}function Na(e){const t=e.match(/^(.+) \(\+\d+ fallback\)$/);return t?t[1]:e}function Oa(e){if(!e)return null;if(typeof e=="string")return e.trim()||null;if(typeof e=="object"&&e){const t=e;return(typeof t.primary=="string"?t.primary:typeof t.model=="string"?t.model:typeof t.id=="string"?t.id:typeof t.value=="string"?t.value:null)?.trim()||null}return null}function ch(e){if(!e||typeof e=="string")return null;if(typeof e=="object"&&e){const t=e,n=Array.isArray(t.fallbacks)?t.fallbacks:Array.isArray(t.fallback)?t.fallback:null;return n?n.filter(s=>typeof s=="string"):null}return null}function dh(e){return e.split(",").map(t=>t.trim()).filter(Boolean)}function uh(e){const n=e?.agents?.defaults?.models;if(!n||typeof n!="object")return[];const s=[];for(const[i,o]of Object.entries(n)){const a=i.trim();if(!a)continue;const l=o&&typeof o=="object"&&"alias"in o&&typeof o.alias=="string"?o.alias?.trim():void 0,c=l&&l!==a?`${l} (${a})`:a;s.push({value:a,label:c})}return s}function gh(e,t){const n=uh(e),s=t?n.some(i=>i.value===t):!1;return t&&!s&&n.unshift({value:t,label:`Current (${t})`}),n.length===0?r`
      <option value="" disabled>No configured models</option>
    `:n.map(i=>r`<option value=${i.value}>${i.label}</option>`)}function ph(e){const t=Ne(e);if(!t)return{kind:"exact",value:""};if(t==="*")return{kind:"all"};if(!t.includes("*"))return{kind:"exact",value:t};const n=t.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&");return{kind:"regex",value:new RegExp(`^${n.replaceAll("\\*",".*")}$`)}}function ki(e){return Array.isArray(e)?Xp(e).map(ph).filter(t=>t.kind!=="exact"||t.value.length>0):[]}function tn(e,t){for(const n of t)if(n.kind==="all"||n.kind==="exact"&&e===n.value||n.kind==="regex"&&n.value.test(e))return!0;return!1}function hh(e,t){if(!t)return!0;const n=Ne(e),s=ki(t.deny);if(tn(n,s))return!1;const i=ki(t.allow);return!!(i.length===0||tn(n,i)||n==="apply_patch"&&tn("exec",i))}function Ba(e,t){if(!Array.isArray(t)||t.length===0)return!1;const n=Ne(e),s=ki(t);return!!(tn(n,s)||n==="apply_patch"&&tn("exec",s))}function fh(e){const t=e.agentsList?.agents??[],n=e.agentsList?.defaultId??null,s=e.selectedAgentId??n??t[0]?.id??null,i=s?t.find(o=>o.id===s)??null:null;return r`
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
                `:t.map(o=>{const a=Wl(o.id,n),l=ms(o,e.agentIdentityById[o.id]??null);return r`
                    <button
                      type="button"
                      class="agent-row ${s===o.id?"active":""}"
                      @click=${()=>e.onSelectAgent(o.id)}
                    >
                      <div class="agent-avatar">
                        ${l||$i(o).slice(0,1)}
                      </div>
                      <div class="agent-info">
                        <div class="agent-title">${$i(o)}</div>
                        <div class="agent-sub mono">${o.id}</div>
                      </div>
                      ${a?r`<span class="agent-pill">${a}</span>`:v}
                    </button>
                  `})}
        </div>
      </section>
      <section class="agents-main">
        ${i?r`
              ${mh(i,n,e.agentIdentityById[i.id]??null)}
              ${vh(e.activePanel,o=>e.onSelectPanel(o))}
              ${e.activePanel==="overview"?bh({agent:i,defaultId:n,configForm:e.configForm,agentFilesList:e.agentFilesList,agentIdentity:e.agentIdentityById[i.id]??null,agentIdentityError:e.agentIdentityError,agentIdentityLoading:e.agentIdentityLoading,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configDirty,onConfigReload:e.onConfigReload,onConfigSave:e.onConfigSave,onModelChange:e.onModelChange,onModelFallbacksChange:e.onModelFallbacksChange}):v}
              ${e.activePanel==="files"?_h({agentId:i.id,agentFilesList:e.agentFilesList,agentFilesLoading:e.agentFilesLoading,agentFilesError:e.agentFilesError,agentFileActive:e.agentFileActive,agentFileContents:e.agentFileContents,agentFileDrafts:e.agentFileDrafts,agentFileSaving:e.agentFileSaving,onLoadFiles:e.onLoadFiles,onSelectFile:e.onSelectFile,onFileDraftChange:e.onFileDraftChange,onFileReset:e.onFileReset,onFileSave:e.onFileSave}):v}
              ${e.activePanel==="tools"?Lh({agentId:i.id,configForm:e.configForm,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configDirty,onProfileChange:e.onToolsProfileChange,onOverridesChange:e.onToolsOverridesChange,onConfigReload:e.onConfigReload,onConfigSave:e.onConfigSave}):v}
              ${e.activePanel==="skills"?Mh({agentId:i.id,report:e.agentSkillsReport,loading:e.agentSkillsLoading,error:e.agentSkillsError,activeAgentId:e.agentSkillsAgentId,configForm:e.configForm,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configDirty,filter:e.skillsFilter,onFilterChange:e.onSkillsFilterChange,onRefresh:e.onSkillsRefresh,onToggle:e.onAgentSkillToggle,onClear:e.onAgentSkillsClear,onDisableAll:e.onAgentSkillsDisableAll,onConfigReload:e.onConfigReload,onConfigSave:e.onConfigSave}):v}
              ${e.activePanel==="channels"?Ah({agent:i,defaultId:n,configForm:e.configForm,agentFilesList:e.agentFilesList,agentIdentity:e.agentIdentityById[i.id]??null,snapshot:e.channelsSnapshot,loading:e.channelsLoading,error:e.channelsError,lastSuccess:e.channelsLastSuccess,onRefresh:e.onChannelsRefresh}):v}
              ${e.activePanel==="cron"?Th({agent:i,defaultId:n,configForm:e.configForm,agentFilesList:e.agentFilesList,agentIdentity:e.agentIdentityById[i.id]??null,jobs:e.cronJobs,status:e.cronStatus,loading:e.cronLoading,error:e.cronError,onRefresh:e.onCronRefresh}):v}
            `:r`
                <div class="card">
                  <div class="card-title">Select an agent</div>
                  <div class="card-sub">Pick an agent to inspect its workspace and tools.</div>
                </div>
              `}
      </section>
    </div>
  `}function mh(e,t,n){const s=Wl(e.id,t),i=$i(e),o=e.identity?.theme?.trim()||"Agent workspace and routing.",a=ms(e,n);return r`
    <section class="card agent-header">
      <div class="agent-header-main">
        <div class="agent-avatar agent-avatar--lg">
          ${a||i.slice(0,1)}
        </div>
        <div>
          <div class="card-title">${i}</div>
          <div class="card-sub">${o}</div>
        </div>
      </div>
      <div class="agent-header-meta">
        <div class="mono">${e.id}</div>
        ${s?r`<span class="agent-pill">${s}</span>`:v}
      </div>
    </section>
  `}function vh(e,t){return r`
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
  `}function bh(e){const{agent:t,configForm:n,agentFilesList:s,agentIdentity:i,agentIdentityLoading:o,agentIdentityError:a,configLoading:l,configSaving:c,configDirty:g,onConfigReload:p,onConfigSave:u,onModelChange:h,onModelFallbacksChange:f}=e,d=vs(n,t.id),k=(s&&s.agentId===t.id?s.workspace:null)||d.entry?.workspace||d.defaults?.workspace||"default",S=d.entry?.model?en(d.entry?.model):en(d.defaults?.model),$=en(d.defaults?.model),A=Oa(d.entry?.model)||(S!=="-"?Na(S):null),C=Oa(d.defaults?.model)||($!=="-"?Na($):null),T=A??C??null,_=ch(d.entry?.model),I=_?_.join(", "):"",W=i?.name?.trim()||t.identity?.name?.trim()||t.name?.trim()||d.entry?.name||"-",ne=ms(t,i)||"-",N=Array.isArray(d.entry?.skills)?d.entry?.skills:null,H=N?.length??null,de=o?"Loading…":a?"Unavailable":"",E=!!(e.defaultId&&t.id===e.defaultId);return r`
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
          <div>${W}</div>
          ${de?r`<div class="agent-kv-sub muted">${de}</div>`:v}
        </div>
        <div class="agent-kv">
          <div class="label">Default</div>
          <div>${E?"yes":"no"}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Identity Emoji</div>
          <div>${ne}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Skills Filter</div>
          <div>${N?`${H} selected`:"all skills"}</div>
        </div>
      </div>

      <div class="agent-model-select" style="margin-top: 20px;">
        <div class="label">Model Selection</div>
        <div class="row" style="gap: 12px; flex-wrap: wrap;">
          <label class="field" style="min-width: 260px; flex: 1;">
            <span>Primary model${E?" (default)":""}</span>
            <select
              .value=${T??""}
              ?disabled=${!n||l||c}
              @change=${U=>h(t.id,U.target.value||null)}
            >
              ${E?v:r`
                      <option value="">
                        ${C?`Inherit default (${C})`:"Inherit default"}
                      </option>
                    `}
              ${gh(n,T??void 0)}
            </select>
          </label>
          <label class="field" style="min-width: 260px; flex: 1;">
            <span>Fallbacks (comma-separated)</span>
            <input
              .value=${I}
              ?disabled=${!n||l||c}
              placeholder="provider/model, provider/model"
              @input=${U=>f(t.id,dh(U.target.value))}
            />
          </label>
        </div>
        <div class="row" style="justify-content: flex-end; gap: 8px;">
          <button
            class="btn btn--sm"
            ?disabled=${l}
            @click=${p}
          >
            Reload Config
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${c||!g}
            @click=${u}
          >
            ${c?"Saving…":"Save"}
          </button>
        </div>
      </div>
    </section>
  `}function ql(e,t){return r`
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
  `}function yh(e,t){const n=e.channelMeta?.find(s=>s.id===t);return n?.label?n.label:e.channelLabels?.[t]??t}function xh(e){if(!e)return[];const t=new Set;for(const i of e.channelOrder??[])t.add(i);for(const i of e.channelMeta??[])t.add(i.id);for(const i of Object.keys(e.channelAccounts??{}))t.add(i);const n=[],s=e.channelOrder?.length?e.channelOrder:Array.from(t);for(const i of s)t.has(i)&&(n.push(i),t.delete(i));for(const i of t)n.push(i);return n.map(i=>({id:i,label:yh(e,i),accounts:e.channelAccounts?.[i]??[]}))}const wh=["groupPolicy","streamMode","dmPolicy"];function $h(e,t){if(!e)return null;const s=(e.channels??{})[t];if(s&&typeof s=="object")return s;const i=e[t];return i&&typeof i=="object"?i:null}function kh(e){if(e==null)return"n/a";if(typeof e=="string"||typeof e=="number"||typeof e=="boolean")return String(e);try{return JSON.stringify(e)}catch{return"n/a"}}function Sh(e,t){const n=$h(e,t);return n?wh.flatMap(s=>s in n?[{label:s,value:kh(n[s])}]:[]):[]}function Ch(e){let t=0,n=0,s=0;for(const i of e){const o=i.probe&&typeof i.probe=="object"&&"ok"in i.probe?!!i.probe.ok:!1;(i.connected===!0||i.running===!0||o)&&(t+=1),i.configured&&(n+=1),i.enabled&&(s+=1)}return{total:e.length,connected:t,configured:n,enabled:s}}function Ah(e){const t=Vl(e.agent,e.configForm,e.agentFilesList,e.defaultId,e.agentIdentity),n=xh(e.snapshot),s=e.lastSuccess?Y(e.lastSuccess):"never";return r`
    <section class="grid grid-cols-2">
      ${ql(t,"Workspace, identity, and model configuration.")}
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
                ${n.map(i=>{const o=Ch(i.accounts),a=o.total?`${o.connected}/${o.total} connected`:"no accounts",l=o.configured?`${o.configured} configured`:"not configured",c=o.total?`${o.enabled} enabled`:"disabled",g=Sh(e.configForm,i.id);return r`
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${i.label}</div>
                        <div class="list-sub mono">${i.id}</div>
                      </div>
                      <div class="list-meta">
                        <div>${a}</div>
                        <div>${l}</div>
                        <div>${c}</div>
                        ${g.length>0?g.map(p=>r`<div>${p.label}: ${p.value}</div>`):v}
                      </div>
                    </div>
                  `})}
              </div>
            `}
      </section>
    </section>
  `}function Th(e){const t=Vl(e.agent,e.configForm,e.agentFilesList,e.defaultId,e.agentIdentity),n=e.jobs.filter(s=>s.agentId===e.agent.id);return r`
    <section class="grid grid-cols-2">
      ${ql(t,"Workspace and scheduling targets.")}
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
            <div class="stat-value">${mo(e.status?.nextWakeAtMs??null)}</div>
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
                        <span class="chip">${Kl(s)}</span>
                        <span class="chip ${s.enabled?"chip-ok":"chip-warn"}">
                          ${s.enabled?"enabled":"disabled"}
                        </span>
                        <span class="chip">${s.sessionTarget}</span>
                      </div>
                    </div>
                    <div class="list-meta">
                      <div class="mono">${oh(s)}</div>
                      <div class="muted">${ah(s)}</div>
                    </div>
                  </div>
                `)}
              </div>
            `}
    </section>
  `}function _h(e){const t=e.agentFilesList?.agentId===e.agentId?e.agentFilesList:null,n=t?.files??[],s=e.agentFileActive??null,i=s?n.find(c=>c.name===s)??null:null,o=s?e.agentFileContents[s]??"":"",a=s?e.agentFileDrafts[s]??o:"",l=s?a!==o:!1;return r`
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
                        `:n.map(c=>Eh(c,s,()=>e.onSelectFile(c.name)))}
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
                              .value=${a}
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
  `}function Eh(e,t,n){const s=e.missing?"Missing":`${lh(e.size)} · ${Y(e.updatedAtMs??null)}`;return r`
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
  `}function Lh(e){const t=vs(e.configForm,e.agentId),n=t.entry?.tools??{},s=t.globalTools??{},i=n.profile??s.profile??"full",o=n.profile?"agent override":s.profile?"global default":"default",a=Array.isArray(n.allow)&&n.allow.length>0,l=Array.isArray(s.allow)&&s.allow.length>0,c=!!e.configForm&&!e.configLoading&&!e.configSaving&&!a,g=a?[]:Array.isArray(n.alsoAllow)?n.alsoAllow:[],p=a?[]:Array.isArray(n.deny)?n.deny:[],u=a?{allow:n.allow??[],deny:n.deny??[]}:eh(i)??void 0,h=Fa.flatMap(S=>S.tools.map($=>$.id)),f=S=>{const $=hh(S,u),A=Ba(S,g),C=Ba(S,p);return{allowed:($||A)&&!C,baseAllowed:$,denied:C}},d=h.filter(S=>f(S).allowed).length,m=(S,$)=>{const A=new Set(g.map(I=>Ne(I)).filter(I=>I.length>0)),C=new Set(p.map(I=>Ne(I)).filter(I=>I.length>0)),T=f(S).baseAllowed,_=Ne(S);$?(C.delete(_),T||A.add(_)):(A.delete(_),C.add(_)),e.onOverridesChange(e.agentId,[...A],[...C])},k=S=>{const $=new Set(g.map(C=>Ne(C)).filter(C=>C.length>0)),A=new Set(p.map(C=>Ne(C)).filter(C=>C.length>0));for(const C of h){const T=f(C).baseAllowed,_=Ne(C);S?(A.delete(_),T||$.add(_)):($.delete(_),A.add(_))}e.onOverridesChange(e.agentId,[...$],[...A])};return r`
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
      ${a?r`
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
          <div>${o}</div>
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
          ${rh.map(S=>r`
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
        ${Fa.map(S=>r`
            <div class="agent-tools-section">
              <div class="agent-tools-header">${S.label}</div>
              <div class="agent-tools-list">
                ${S.tools.map($=>{const{allowed:A}=f($.id);return r`
                    <div class="agent-tool-row">
                      <div>
                        <div class="agent-tool-title mono">${$.label}</div>
                        <div class="agent-tool-sub">${$.description}</div>
                      </div>
                      <label class="cfg-toggle">
                        <input
                          type="checkbox"
                          .checked=${A}
                          ?disabled=${!c}
                          @change=${C=>m($.id,C.target.checked)}
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
  `}const Tn=[{id:"workspace",label:"Workspace Skills",sources:["winclaw-workspace"]},{id:"built-in",label:"Built-in Skills",sources:["winclaw-bundled"]},{id:"installed",label:"Installed Skills",sources:["winclaw-managed"]},{id:"extra",label:"Extra Skills",sources:["winclaw-extra"]}];function Ih(e){const t=new Map;for(const o of Tn)t.set(o.id,{id:o.id,label:o.label,skills:[]});const n=Tn.find(o=>o.id==="built-in"),s={id:"other",label:"Other Skills",skills:[]};for(const o of e){const a=o.bundled?n:Tn.find(l=>l.sources.includes(o.source));a?t.get(a.id)?.skills.push(o):s.skills.push(o)}const i=Tn.map(o=>t.get(o.id)).filter(o=>!!(o&&o.skills.length>0));return s.skills.length>0&&i.push(s),i}function Mh(e){const t=!!e.configForm&&!e.configLoading&&!e.configSaving,n=vs(e.configForm,e.agentId),s=Array.isArray(n.entry?.skills)?n.entry?.skills:void 0,i=new Set((s??[]).map(f=>f.trim()).filter(Boolean)),o=s!==void 0,a=!!(e.report&&e.activeAgentId===e.agentId),l=a?e.report?.skills??[]:[],c=e.filter.trim().toLowerCase(),g=c?l.filter(f=>[f.name,f.description,f.source].join(" ").toLowerCase().includes(c)):l,p=Ih(g),u=o?l.filter(f=>i.has(f.name)).length:l.length,h=l.length;return r`
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
      ${o?r`
              <div class="callout info" style="margin-top: 12px">This agent uses a custom skill allowlist.</div>
            `:r`
              <div class="callout info" style="margin-top: 12px">
                All skills are enabled. Disabling any skill will create a per-agent allowlist.
              </div>
            `}
      ${!a&&!e.loading?r`
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
        <div class="muted">${g.length} shown</div>
      </div>

      ${g.length===0?r`
              <div class="muted" style="margin-top: 16px">No skills found.</div>
            `:r`
              <div class="agent-skills-groups" style="margin-top: 16px;">
                ${p.map(f=>Rh(f,{agentId:e.agentId,allowSet:i,usingAllowlist:o,editable:t,onToggle:e.onToggle}))}
              </div>
            `}
    </section>
  `}function Rh(e,t){const n=e.id==="workspace"||e.id==="built-in";return r`
    <details class="agent-skills-group" ?open=${!n}>
      <summary class="agent-skills-header">
        <span>${e.label}</span>
        <span class="muted">${e.skills.length}</span>
      </summary>
      <div class="list skills-grid">
        ${e.skills.map(s=>Ph(s,{agentId:t.agentId,allowSet:t.allowSet,usingAllowlist:t.usingAllowlist,editable:t.editable,onToggle:t.onToggle}))}
      </div>
    </details>
  `}function Ph(e,t){const n=t.usingAllowlist?t.allowSet.has(e.name):!0,s=[...e.missing.bins.map(o=>`bin:${o}`),...e.missing.env.map(o=>`env:${o}`),...e.missing.config.map(o=>`config:${o}`),...e.missing.os.map(o=>`os:${o}`)],i=[];return e.disabled&&i.push("disabled"),e.blockedByAllowlist&&i.push("blocked by allowlist"),r`
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
            @change=${o=>t.onToggle(t.agentId,e.name,o.target.checked)}
          />
          <span class="cfg-toggle__track"></span>
        </label>
      </div>
    </div>
  `}function Oe(e){if(e)return Array.isArray(e.type)?e.type.filter(n=>n!=="null")[0]??e.type[0]:e.type}function Gl(e){if(!e)return"";if(e.default!==void 0)return e.default;switch(Oe(e)){case"object":return{};case"array":return[];case"boolean":return!1;case"number":case"integer":return 0;case"string":return"";default:return""}}function bs(e){return e.filter(t=>typeof t=="string").join(".")}function Ae(e,t){const n=bs(e),s=t[n];if(s)return s;const i=n.split(".");for(const[o,a]of Object.entries(t)){if(!o.includes("*"))continue;const l=o.split(".");if(l.length!==i.length)continue;let c=!0;for(let g=0;g<i.length;g+=1)if(l[g]!=="*"&&l[g]!==i[g]){c=!1;break}if(c)return a}}function qe(e){return e.replace(/_/g," ").replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/\s+/g," ").replace(/^./,t=>t.toUpperCase())}function Dh(e){const t=bs(e).toLowerCase();return t.includes("token")||t.includes("password")||t.includes("secret")||t.includes("apikey")||t.endsWith("key")}const Fh=new Set(["title","description","default","nullable"]);function Nh(e){return Object.keys(e??{}).filter(n=>!Fh.has(n)).length===0}function Oh(e){if(e===void 0)return"";try{return JSON.stringify(e,null,2)??""}catch{return""}}const cn={chevronDown:r`
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
  `};function Ve(e){const{schema:t,value:n,path:s,hints:i,unsupported:o,disabled:a,onPatch:l}=e,c=e.showLabel??!0,g=Oe(t),p=Ae(s,i),u=p?.label??t.title??qe(String(s.at(-1))),h=p?.help??t.description,f=bs(s);if(o.has(f))return r`<div class="cfg-field cfg-field--error">
      <div class="cfg-field__label">${u}</div>
      <div class="cfg-field__error">Unsupported schema node. Use Raw mode.</div>
    </div>`;if(t.anyOf||t.oneOf){const m=(t.anyOf??t.oneOf??[]).filter(T=>!(T.type==="null"||Array.isArray(T.type)&&T.type.includes("null")));if(m.length===1)return Ve({...e,schema:m[0]});const k=T=>{if(T.const!==void 0)return T.const;if(T.enum&&T.enum.length===1)return T.enum[0]},S=m.map(k),$=S.every(T=>T!==void 0);if($&&S.length>0&&S.length<=5){const T=n??t.default;return r`
        <div class="cfg-field">
          ${c?r`<label class="cfg-field__label">${u}</label>`:v}
          ${h?r`<div class="cfg-field__help">${h}</div>`:v}
          <div class="cfg-segmented">
            ${S.map(_=>r`
              <button
                type="button"
                class="cfg-segmented__btn ${_===T||String(_)===String(T)?"active":""}"
                ?disabled=${a}
                @click=${()=>l(s,_)}
              >
                ${String(_)}
              </button>
            `)}
          </div>
        </div>
      `}if($&&S.length>5)return za({...e,options:S,value:n??t.default});const A=new Set(m.map(T=>Oe(T)).filter(Boolean)),C=new Set([...A].map(T=>T==="integer"?"number":T));if([...C].every(T=>["string","number","boolean"].includes(T))){const T=C.has("string"),_=C.has("number");if(C.has("boolean")&&C.size===1)return Ve({...e,schema:{...t,type:"boolean",anyOf:void 0,oneOf:void 0}});if(T||_)return Ua({...e,inputType:_&&!T?"number":"text"})}}if(t.enum){const d=t.enum;if(d.length<=5){const m=n??t.default;return r`
        <div class="cfg-field">
          ${c?r`<label class="cfg-field__label">${u}</label>`:v}
          ${h?r`<div class="cfg-field__help">${h}</div>`:v}
          <div class="cfg-segmented">
            ${d.map(k=>r`
              <button
                type="button"
                class="cfg-segmented__btn ${k===m||String(k)===String(m)?"active":""}"
                ?disabled=${a}
                @click=${()=>l(s,k)}
              >
                ${String(k)}
              </button>
            `)}
          </div>
        </div>
      `}return za({...e,options:d,value:n??t.default})}if(g==="object")return Uh(e);if(g==="array")return zh(e);if(g==="boolean"){const d=typeof n=="boolean"?n:typeof t.default=="boolean"?t.default:!1;return r`
      <label class="cfg-toggle-row ${a?"disabled":""}">
        <div class="cfg-toggle-row__content">
          <span class="cfg-toggle-row__label">${u}</span>
          ${h?r`<span class="cfg-toggle-row__help">${h}</span>`:v}
        </div>
        <div class="cfg-toggle">
          <input
            type="checkbox"
            .checked=${d}
            ?disabled=${a}
            @change=${m=>l(s,m.target.checked)}
          />
          <span class="cfg-toggle__track"></span>
        </div>
      </label>
    `}return g==="number"||g==="integer"?Bh(e):g==="string"?Ua({...e,inputType:"text"}):r`
    <div class="cfg-field cfg-field--error">
      <div class="cfg-field__label">${u}</div>
      <div class="cfg-field__error">Unsupported type: ${g}. Use Raw mode.</div>
    </div>
  `}function Ua(e){const{schema:t,value:n,path:s,hints:i,disabled:o,onPatch:a,inputType:l}=e,c=e.showLabel??!0,g=Ae(s,i),p=g?.label??t.title??qe(String(s.at(-1))),u=g?.help??t.description,h=g?.sensitive??Dh(s),f=g?.placeholder??(h?"••••":t.default!==void 0?`Default: ${String(t.default)}`:""),d=n??"";return r`
    <div class="cfg-field">
      ${c?r`<label class="cfg-field__label">${p}</label>`:v}
      ${u?r`<div class="cfg-field__help">${u}</div>`:v}
      <div class="cfg-input-wrap">
        <input
          type=${h?"password":l}
          class="cfg-input"
          placeholder=${f}
          .value=${d==null?"":String(d)}
          ?disabled=${o}
          @input=${m=>{const k=m.target.value;if(l==="number"){if(k.trim()===""){a(s,void 0);return}const S=Number(k);a(s,Number.isNaN(S)?k:S);return}a(s,k)}}
          @change=${m=>{if(l==="number")return;const k=m.target.value;a(s,k.trim())}}
        />
        ${t.default!==void 0?r`
          <button
            type="button"
            class="cfg-input__reset"
            title="Reset to default"
            ?disabled=${o}
            @click=${()=>a(s,t.default)}
          >↺</button>
        `:v}
      </div>
    </div>
  `}function Bh(e){const{schema:t,value:n,path:s,hints:i,disabled:o,onPatch:a}=e,l=e.showLabel??!0,c=Ae(s,i),g=c?.label??t.title??qe(String(s.at(-1))),p=c?.help??t.description,u=n??t.default??"",h=typeof u=="number"?u:0;return r`
    <div class="cfg-field">
      ${l?r`<label class="cfg-field__label">${g}</label>`:v}
      ${p?r`<div class="cfg-field__help">${p}</div>`:v}
      <div class="cfg-number">
        <button
          type="button"
          class="cfg-number__btn"
          ?disabled=${o}
          @click=${()=>a(s,h-1)}
        >−</button>
        <input
          type="number"
          class="cfg-number__input"
          .value=${u==null?"":String(u)}
          ?disabled=${o}
          @input=${f=>{const d=f.target.value,m=d===""?void 0:Number(d);a(s,m)}}
        />
        <button
          type="button"
          class="cfg-number__btn"
          ?disabled=${o}
          @click=${()=>a(s,h+1)}
        >+</button>
      </div>
    </div>
  `}function za(e){const{schema:t,value:n,path:s,hints:i,disabled:o,options:a,onPatch:l}=e,c=e.showLabel??!0,g=Ae(s,i),p=g?.label??t.title??qe(String(s.at(-1))),u=g?.help??t.description,h=n??t.default,f=a.findIndex(m=>m===h||String(m)===String(h)),d="__unset__";return r`
    <div class="cfg-field">
      ${c?r`<label class="cfg-field__label">${p}</label>`:v}
      ${u?r`<div class="cfg-field__help">${u}</div>`:v}
      <select
        class="cfg-select"
        ?disabled=${o}
        .value=${f>=0?String(f):d}
        @change=${m=>{const k=m.target.value;l(s,k===d?void 0:a[Number(k)])}}
      >
        <option value=${d}>Select...</option>
        ${a.map((m,k)=>r`
          <option value=${String(k)}>${String(m)}</option>
        `)}
      </select>
    </div>
  `}function Uh(e){const{schema:t,value:n,path:s,hints:i,unsupported:o,disabled:a,onPatch:l}=e,c=Ae(s,i),g=c?.label??t.title??qe(String(s.at(-1))),p=c?.help??t.description,u=n??t.default,h=u&&typeof u=="object"&&!Array.isArray(u)?u:{},f=t.properties??{},m=Object.entries(f).toSorted((A,C)=>{const T=Ae([...s,A[0]],i)?.order??0,_=Ae([...s,C[0]],i)?.order??0;return T!==_?T-_:A[0].localeCompare(C[0])}),k=new Set(Object.keys(f)),S=t.additionalProperties,$=!!S&&typeof S=="object";return s.length===1?r`
      <div class="cfg-fields">
        ${m.map(([A,C])=>Ve({schema:C,value:h[A],path:[...s,A],hints:i,unsupported:o,disabled:a,onPatch:l}))}
        ${$?Ha({schema:S,value:h,path:s,hints:i,unsupported:o,disabled:a,reservedKeys:k,onPatch:l}):v}
      </div>
    `:r`
    <details class="cfg-object" open>
      <summary class="cfg-object__header">
        <span class="cfg-object__title">${g}</span>
        <span class="cfg-object__chevron">${cn.chevronDown}</span>
      </summary>
      ${p?r`<div class="cfg-object__help">${p}</div>`:v}
      <div class="cfg-object__content">
        ${m.map(([A,C])=>Ve({schema:C,value:h[A],path:[...s,A],hints:i,unsupported:o,disabled:a,onPatch:l}))}
        ${$?Ha({schema:S,value:h,path:s,hints:i,unsupported:o,disabled:a,reservedKeys:k,onPatch:l}):v}
      </div>
    </details>
  `}function zh(e){const{schema:t,value:n,path:s,hints:i,unsupported:o,disabled:a,onPatch:l}=e,c=e.showLabel??!0,g=Ae(s,i),p=g?.label??t.title??qe(String(s.at(-1))),u=g?.help??t.description,h=Array.isArray(t.items)?t.items[0]:t.items;if(!h)return r`
      <div class="cfg-field cfg-field--error">
        <div class="cfg-field__label">${p}</div>
        <div class="cfg-field__error">Unsupported array schema. Use Raw mode.</div>
      </div>
    `;const f=Array.isArray(n)?n:Array.isArray(t.default)?t.default:[];return r`
    <div class="cfg-array">
      <div class="cfg-array__header">
        ${c?r`<span class="cfg-array__label">${p}</span>`:v}
        <span class="cfg-array__count">${f.length} item${f.length!==1?"s":""}</span>
        <button
          type="button"
          class="cfg-array__add"
          ?disabled=${a}
          @click=${()=>{const d=[...f,Gl(h)];l(s,d)}}
        >
          <span class="cfg-array__add-icon">${cn.plus}</span>
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
                  ?disabled=${a}
                  @click=${()=>{const k=[...f];k.splice(m,1),l(s,k)}}
                >
                  ${cn.trash}
                </button>
              </div>
              <div class="cfg-array__item-content">
                ${Ve({schema:h,value:d,path:[...s,m],hints:i,unsupported:o,disabled:a,showLabel:!1,onPatch:l})}
              </div>
            </div>
          `)}
        </div>
      `}
    </div>
  `}function Ha(e){const{schema:t,value:n,path:s,hints:i,unsupported:o,disabled:a,reservedKeys:l,onPatch:c}=e,g=Nh(t),p=Object.entries(n??{}).filter(([u])=>!l.has(u));return r`
    <div class="cfg-map">
      <div class="cfg-map__header">
        <span class="cfg-map__label">Custom entries</span>
        <button
          type="button"
          class="cfg-map__add"
          ?disabled=${a}
          @click=${()=>{const u={...n};let h=1,f=`custom-${h}`;for(;f in u;)h+=1,f=`custom-${h}`;u[f]=g?{}:Gl(t),c(s,u)}}
        >
          <span class="cfg-map__add-icon">${cn.plus}</span>
          Add Entry
        </button>
      </div>

      ${p.length===0?r`
              <div class="cfg-map__empty">No custom entries.</div>
            `:r`
        <div class="cfg-map__items">
          ${p.map(([u,h])=>{const f=[...s,u],d=Oh(h);return r`
              <div class="cfg-map__item">
                <div class="cfg-map__item-key">
                  <input
                    type="text"
                    class="cfg-input cfg-input--sm"
                    placeholder="Key"
                    .value=${u}
                    ?disabled=${a}
                    @change=${m=>{const k=m.target.value.trim();if(!k||k===u)return;const S={...n};k in S||(S[k]=S[u],delete S[u],c(s,S))}}
                  />
                </div>
                <div class="cfg-map__item-value">
                  ${g?r`
                        <textarea
                          class="cfg-textarea cfg-textarea--sm"
                          placeholder="JSON value"
                          rows="2"
                          .value=${d}
                          ?disabled=${a}
                          @change=${m=>{const k=m.target,S=k.value.trim();if(!S){c(f,void 0);return}try{c(f,JSON.parse(S))}catch{k.value=d}}}
                        ></textarea>
                      `:Ve({schema:t,value:h,path:f,hints:i,unsupported:o,disabled:a,showLabel:!1,onPatch:c})}
                </div>
                <button
                  type="button"
                  class="cfg-map__item-remove"
                  title="Remove entry"
                  ?disabled=${a}
                  @click=${()=>{const m={...n};delete m[u],c(s,m)}}
                >
                  ${cn.trash}
                </button>
              </div>
            `})}
        </div>
      `}
    </div>
  `}const ja={env:r`
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
  `},vo={env:{label:"Environment Variables",description:"Environment variables passed to the gateway process"},update:{label:"Updates",description:"Auto-update settings and release channel"},agents:{label:"Agents",description:"Agent configurations, models, and identities"},auth:{label:"Authentication",description:"API keys and authentication profiles"},channels:{label:"Channels",description:"Messaging channels (Telegram, Discord, Slack, etc.)"},messages:{label:"Messages",description:"Message handling and routing settings"},commands:{label:"Commands",description:"Custom slash commands"},hooks:{label:"Hooks",description:"Webhooks and event hooks"},skills:{label:"Skills",description:"Skill packs and capabilities"},tools:{label:"Tools",description:"Tool configurations (browser, search, etc.)"},gateway:{label:"Gateway",description:"Gateway server settings (port, auth, binding)"},wizard:{label:"Setup Wizard",description:"Setup wizard state and history"},meta:{label:"Metadata",description:"Gateway metadata and version information"},logging:{label:"Logging",description:"Log levels and output configuration"},browser:{label:"Browser",description:"Browser automation settings"},ui:{label:"UI",description:"User interface preferences"},models:{label:"Models",description:"AI model configurations and providers"},bindings:{label:"Bindings",description:"Key bindings and shortcuts"},broadcast:{label:"Broadcast",description:"Broadcast and notification settings"},audio:{label:"Audio",description:"Audio input/output settings"},session:{label:"Session",description:"Session management and persistence"},cron:{label:"Cron",description:"Scheduled tasks and automation"},web:{label:"Web",description:"Web server and API settings"},discovery:{label:"Discovery",description:"Service discovery and networking"},canvasHost:{label:"Canvas Host",description:"Canvas rendering and display"},talk:{label:"Talk",description:"Voice and speech settings"},plugins:{label:"Plugins",description:"Plugin management and extensions"}};function Ka(e){return ja[e]??ja.default}function Hh(e,t,n){if(!n)return!0;const s=n.toLowerCase(),i=vo[e];return e.toLowerCase().includes(s)||i&&(i.label.toLowerCase().includes(s)||i.description.toLowerCase().includes(s))?!0:Yt(t,s)}function Yt(e,t){if(e.title?.toLowerCase().includes(t)||e.description?.toLowerCase().includes(t)||e.enum?.some(s=>String(s).toLowerCase().includes(t)))return!0;if(e.properties){for(const[s,i]of Object.entries(e.properties))if(s.toLowerCase().includes(t)||Yt(i,t))return!0}if(e.items){const s=Array.isArray(e.items)?e.items:[e.items];for(const i of s)if(i&&Yt(i,t))return!0}if(e.additionalProperties&&typeof e.additionalProperties=="object"&&Yt(e.additionalProperties,t))return!0;const n=e.anyOf??e.oneOf??e.allOf;if(n){for(const s of n)if(s&&Yt(s,t))return!0}return!1}function jh(e){if(!e.schema)return r`
      <div class="muted">Schema unavailable.</div>
    `;const t=e.schema,n=e.value??{};if(Oe(t)!=="object"||!t.properties)return r`
      <div class="callout danger">Unsupported schema. Use Raw.</div>
    `;const s=new Set(e.unsupportedPaths??[]),i=t.properties,o=e.searchQuery??"",a=e.activeSection,l=e.activeSubsection??null,g=Object.entries(i).toSorted((u,h)=>{const f=Ae([u[0]],e.uiHints)?.order??50,d=Ae([h[0]],e.uiHints)?.order??50;return f!==d?f-d:u[0].localeCompare(h[0])}).filter(([u,h])=>!(a&&u!==a||o&&!Hh(u,h,o)));let p=null;if(a&&l&&g.length===1){const u=g[0]?.[1];u&&Oe(u)==="object"&&u.properties&&u.properties[l]&&(p={sectionKey:a,subsectionKey:l,schema:u.properties[l]})}return g.length===0?r`
      <div class="config-empty">
        <div class="config-empty__icon">${le.search}</div>
        <div class="config-empty__text">
          ${o?`No settings match "${o}"`:"No settings in this section"}
        </div>
      </div>
    `:r`
    <div class="config-form config-form--modern">
      ${p?(()=>{const{sectionKey:u,subsectionKey:h,schema:f}=p,d=Ae([u,h],e.uiHints),m=d?.label??f.title??qe(h),k=d?.help??f.description??"",S=n[u],$=S&&typeof S=="object"?S[h]:void 0,A=`config-section-${u}-${h}`;return r`
              <section class="config-section-card" id=${A}>
                <div class="config-section-card__header">
                  <span class="config-section-card__icon">${Ka(u)}</span>
                  <div class="config-section-card__titles">
                    <h3 class="config-section-card__title">${m}</h3>
                    ${k?r`<p class="config-section-card__desc">${k}</p>`:v}
                  </div>
                </div>
                <div class="config-section-card__content">
                  ${Ve({schema:f,value:$,path:[u,h],hints:e.uiHints,unsupported:s,disabled:e.disabled??!1,showLabel:!1,onPatch:e.onPatch})}
                </div>
              </section>
            `})():g.map(([u,h])=>{const f=vo[u]??{label:u.charAt(0).toUpperCase()+u.slice(1),description:h.description??""};return r`
              <section class="config-section-card" id="config-section-${u}">
                <div class="config-section-card__header">
                  <span class="config-section-card__icon">${Ka(u)}</span>
                  <div class="config-section-card__titles">
                    <h3 class="config-section-card__title">${f.label}</h3>
                    ${f.description?r`<p class="config-section-card__desc">${f.description}</p>`:v}
                  </div>
                </div>
                <div class="config-section-card__content">
                  ${Ve({schema:h,value:n[u],path:[u],hints:e.uiHints,unsupported:s,disabled:e.disabled??!1,showLabel:!1,onPatch:e.onPatch})}
                </div>
              </section>
            `})}
    </div>
  `}const Kh=new Set(["title","description","default","nullable"]);function Wh(e){return Object.keys(e??{}).filter(n=>!Kh.has(n)).length===0}function Ql(e){const t=e.filter(i=>i!=null),n=t.length!==e.length,s=[];for(const i of t)s.some(o=>Object.is(o,i))||s.push(i);return{enumValues:s,nullable:n}}function Yl(e){return!e||typeof e!="object"?{schema:null,unsupportedPaths:["<root>"]}:nn(e,[])}function nn(e,t){const n=new Set,s={...e},i=bs(t)||"<root>";if(e.anyOf||e.oneOf||e.allOf){const l=Vh(e,t);return l||{schema:e,unsupportedPaths:[i]}}const o=Array.isArray(e.type)&&e.type.includes("null"),a=Oe(e)??(e.properties||e.additionalProperties?"object":void 0);if(s.type=a??e.type,s.nullable=o||e.nullable,s.enum){const{enumValues:l,nullable:c}=Ql(s.enum);s.enum=l,c&&(s.nullable=!0),l.length===0&&n.add(i)}if(a==="object"){const l=e.properties??{},c={};for(const[g,p]of Object.entries(l)){const u=nn(p,[...t,g]);u.schema&&(c[g]=u.schema);for(const h of u.unsupportedPaths)n.add(h)}if(s.properties=c,e.additionalProperties===!0)n.add(i);else if(e.additionalProperties===!1)s.additionalProperties=!1;else if(e.additionalProperties&&typeof e.additionalProperties=="object"&&!Wh(e.additionalProperties)){const g=nn(e.additionalProperties,[...t,"*"]);s.additionalProperties=g.schema??e.additionalProperties,g.unsupportedPaths.length>0&&n.add(i)}}else if(a==="array"){const l=Array.isArray(e.items)?e.items[0]:e.items;if(!l)n.add(i);else{const c=nn(l,[...t,"*"]);s.items=c.schema??l,c.unsupportedPaths.length>0&&n.add(i)}}else a!=="string"&&a!=="number"&&a!=="integer"&&a!=="boolean"&&!s.enum&&n.add(i);return{schema:s,unsupportedPaths:Array.from(n)}}function Vh(e,t){if(e.allOf)return null;const n=e.anyOf??e.oneOf;if(!n)return null;const s=[],i=[];let o=!1;for(const l of n){if(!l||typeof l!="object")return null;if(Array.isArray(l.enum)){const{enumValues:c,nullable:g}=Ql(l.enum);s.push(...c),g&&(o=!0);continue}if("const"in l){if(l.const==null){o=!0;continue}s.push(l.const);continue}if(Oe(l)==="null"){o=!0;continue}i.push(l)}if(s.length>0&&i.length===0){const l=[];for(const c of s)l.some(g=>Object.is(g,c))||l.push(c);return{schema:{...e,enum:l,nullable:o,anyOf:void 0,oneOf:void 0,allOf:void 0},unsupportedPaths:[]}}if(i.length===1){const l=nn(i[0],t);return l.schema&&(l.schema.nullable=o||l.schema.nullable),l}const a=new Set(["string","number","integer","boolean"]);return i.length>0&&s.length===0&&i.every(l=>l.type&&a.has(String(l.type)))?{schema:{...e,nullable:o},unsupportedPaths:[]}:null}function qh(e,t){let n=e;for(const s of t){if(!n)return null;const i=Oe(n);if(i==="object"){const o=n.properties??{};if(typeof s=="string"&&o[s]){n=o[s];continue}const a=n.additionalProperties;if(typeof s=="string"&&a&&typeof a=="object"){n=a;continue}return null}if(i==="array"){if(typeof s!="number")return null;n=(Array.isArray(n.items)?n.items[0]:n.items)??null;continue}return null}return n}function Gh(e,t){const s=(e.channels??{})[t],i=e[t];return(s&&typeof s=="object"?s:null)??(i&&typeof i=="object"?i:null)??{}}const Qh=["groupPolicy","streamMode","dmPolicy"];function Yh(e){if(e==null)return"n/a";if(typeof e=="string"||typeof e=="number"||typeof e=="boolean")return String(e);try{return JSON.stringify(e)}catch{return"n/a"}}function Jh(e){const t=Qh.flatMap(n=>n in e?[[n,e[n]]]:[]);return t.length===0?null:r`
    <div class="status-list" style="margin-top: 12px;">
      ${t.map(([n,s])=>r`
          <div>
            <span class="label">${n}</span>
            <span>${Yh(s)}</span>
          </div>
        `)}
    </div>
  `}function Zh(e){const t=Yl(e.schema),n=t.schema;if(!n)return r`
      <div class="callout danger">Schema unavailable. Use Raw.</div>
    `;const s=qh(n,["channels",e.channelId]);if(!s)return r`
      <div class="callout danger">Channel config schema unavailable.</div>
    `;const i=e.configValue??{},o=Gh(i,e.channelId);return r`
    <div class="config-form">
      ${Ve({schema:s,value:o,path:["channels",e.channelId],hints:e.uiHints,unsupported:new Set(t.unsupportedPaths),disabled:e.disabled,showLabel:!1,onPatch:e.onPatch})}
    </div>
    ${Jh(o)}
  `}function Ge(e){const{channelId:t,props:n}=e,s=n.configSaving||n.configSchemaLoading;return r`
    <div style="margin-top: 16px;">
      ${n.configSchemaLoading?r`
              <div class="muted">Loading config schema…</div>
            `:Zh({channelId:t,configValue:n.configForm,schema:n.configSchema,uiHints:n.configUiHints,disabled:s,onPatch:n.onConfigPatch})}
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
  `}function Xh(e){const{props:t,discord:n,accountCountLabel:s}=e;return r`
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

      ${Ge({channelId:"discord",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function ef(e){const{props:t,googleChat:n,accountCountLabel:s}=e;return r`
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

      ${Ge({channelId:"googlechat",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function tf(e){const{props:t,imessage:n,accountCountLabel:s}=e;return r`
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

      ${Ge({channelId:"imessage",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function Wa(e){return e?e.length<=20?e:`${e.slice(0,8)}...${e.slice(-8)}`:"n/a"}function nf(e){const{props:t,nostr:n,nostrAccounts:s,accountCountLabel:i,profileFormState:o,profileFormCallbacks:a,onEditProfile:l}=e,c=s[0],g=n?.configured??c?.configured??!1,p=n?.running??c?.running??!1,u=n?.publicKey??c?.publicKey,h=n?.lastStartAt??c?.lastStartAt??null,f=n?.lastError??c?.lastError??null,d=s.length>1,m=o!=null,k=$=>{const A=$.publicKey,C=$.profile,T=C?.displayName??C?.name??$.name??$.accountId;return r`
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
            <span class="monospace" title="${A??""}">${Wa(A)}</span>
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
    `},S=()=>{if(m&&a)return kd({state:o,callbacks:a,accountId:s[0]?.accountId??"default"});const $=c?.profile??n?.profile,{name:A,displayName:C,about:T,picture:_,nip05:I}=$??{},W=A||C||T||_||I;return r`
      <div style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-weight: 500;">Profile</div>
          ${g?r`
                <button
                  class="btn btn-sm"
                  @click=${l}
                  style="font-size: 12px; padding: 4px 8px;"
                >
                  Edit Profile
                </button>
              `:v}
        </div>
        ${W?r`
              <div class="status-list">
                ${_?r`
                      <div style="margin-bottom: 8px;">
                        <img
                          src=${_}
                          alt="Profile picture"
                          style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);"
                          @error=${K=>{K.target.style.display="none"}}
                        />
                      </div>
                    `:v}
                ${A?r`<div><span class="label">Name</span><span>${A}</span></div>`:v}
                ${C?r`<div><span class="label">Display Name</span><span>${C}</span></div>`:v}
                ${T?r`<div><span class="label">About</span><span style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${T}</span></div>`:v}
                ${I?r`<div><span class="label">NIP-05</span><span>${I}</span></div>`:v}
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
                <span>${g?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${p?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Public Key</span>
                <span class="monospace" title="${u??""}"
                  >${Wa(u)}</span
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

      ${Ge({channelId:"nostr",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!1)}>Refresh</button>
      </div>
    </div>
  `}function sf(e,t){const n=t.snapshot,s=n?.channels;if(!n||!s)return!1;const i=s[e],o=typeof i?.configured=="boolean"&&i.configured,a=typeof i?.running=="boolean"&&i.running,l=typeof i?.connected=="boolean"&&i.connected,g=(n.channelAccounts?.[e]??[]).some(p=>p.configured||p.running||p.connected);return o||a||l||g}function of(e,t){return t?.[e]?.length??0}function Jl(e,t){const n=of(e,t);return n<2?v:r`<div class="account-count">Accounts (${n})</div>`}function af(e){const{props:t,signal:n,accountCountLabel:s}=e;return r`
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

      ${Ge({channelId:"signal",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function rf(e){const{props:t,slack:n,accountCountLabel:s}=e;return r`
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

      ${Ge({channelId:"slack",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function lf(e){const{props:t,telegram:n,telegramAccounts:s,accountCountLabel:i}=e,o=s.length>1,a=l=>{const g=l.probe?.bot?.username,p=l.name||l.accountId;return r`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${g?`@${g}`:p}
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

      ${o?r`
            <div class="account-card-list">
              ${s.map(l=>a(l))}
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

      ${Ge({channelId:"telegram",props:t})}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${()=>t.onRefresh(!0)}>
          Probe
        </button>
      </div>
    </div>
  `}function cf(e){const{props:t,whatsapp:n,accountCountLabel:s}=e;return r`
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
            ${n?.authAgeMs!=null?Qi(n.authAgeMs):"n/a"}
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

      ${Ge({channelId:"whatsapp",props:t})}
    </div>
  `}function df(e){const t=e.snapshot?.channels,n=t?.whatsapp??void 0,s=t?.telegram??void 0,i=t?.discord??null,o=t?.googlechat??null,a=t?.slack??null,l=t?.signal??null,c=t?.imessage??null,g=t?.nostr??null,u=uf(e.snapshot).map((h,f)=>({key:h,enabled:sf(h,e),order:f})).toSorted((h,f)=>h.enabled!==f.enabled?h.enabled?-1:1:h.order-f.order);return r`
    <section class="grid grid-cols-2">
      ${u.map(h=>gf(h.key,e,{whatsapp:n,telegram:s,discord:i,googlechat:o,slack:a,signal:l,imessage:c,nostr:g,channelAccounts:e.snapshot?.channelAccounts??null}))}
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
  `}function uf(e){return e?.channelMeta?.length?e.channelMeta.map(t=>t.id):e?.channelOrder?.length?e.channelOrder:["whatsapp","telegram","discord","googlechat","slack","signal","imessage","nostr"]}function gf(e,t,n){const s=Jl(e,n.channelAccounts);switch(e){case"whatsapp":return cf({props:t,whatsapp:n.whatsapp,accountCountLabel:s});case"telegram":return lf({props:t,telegram:n.telegram,telegramAccounts:n.channelAccounts?.telegram??[],accountCountLabel:s});case"discord":return Xh({props:t,discord:n.discord,accountCountLabel:s});case"googlechat":return ef({props:t,googleChat:n.googlechat,accountCountLabel:s});case"slack":return rf({props:t,slack:n.slack,accountCountLabel:s});case"signal":return af({props:t,signal:n.signal,accountCountLabel:s});case"imessage":return tf({props:t,imessage:n.imessage,accountCountLabel:s});case"nostr":{const i=n.channelAccounts?.nostr??[],o=i[0],a=o?.accountId??"default",l=o?.profile??null,c=t.nostrProfileAccountId===a?t.nostrProfileFormState:null,g=c?{onFieldChange:t.onNostrProfileFieldChange,onSave:t.onNostrProfileSave,onImport:t.onNostrProfileImport,onCancel:t.onNostrProfileCancel,onToggleAdvanced:t.onNostrProfileToggleAdvanced}:null;return nf({props:t,nostr:n.nostr,nostrAccounts:i,accountCountLabel:s,profileFormState:c,profileFormCallbacks:g,onEditProfile:()=>t.onNostrProfileEdit(a,l)})}default:return pf(e,t,n.channelAccounts??{})}}function pf(e,t,n){const s=ff(t.snapshot,e),i=t.snapshot?.channels?.[e],o=typeof i?.configured=="boolean"?i.configured:void 0,a=typeof i?.running=="boolean"?i.running:void 0,l=typeof i?.connected=="boolean"?i.connected:void 0,c=typeof i?.lastError=="string"?i.lastError:void 0,g=n[e]??[],p=Jl(e,n);return r`
    <div class="card">
      <div class="card-title">${s}</div>
      <div class="card-sub">Channel status and configuration.</div>
      ${p}

      ${g.length>0?r`
            <div class="account-card-list">
              ${g.map(u=>yf(u))}
            </div>
          `:r`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">Configured</span>
                <span>${o==null?"n/a":o?"Yes":"No"}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${a==null?"n/a":a?"Yes":"No"}</span>
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

      ${Ge({channelId:e,props:t})}
    </div>
  `}function hf(e){return e?.channelMeta?.length?Object.fromEntries(e.channelMeta.map(t=>[t.id,t])):{}}function ff(e,t){return hf(e)[t]?.label??e?.channelLabels?.[t]??t}const mf=600*1e3;function Zl(e){return e.lastInboundAt?Date.now()-e.lastInboundAt<mf:!1}function vf(e){return e.running?"Yes":Zl(e)?"Active":"No"}function bf(e){return e.connected===!0?"Yes":e.connected===!1?"No":Zl(e)?"Active":"n/a"}function yf(e){const t=vf(e),n=bf(e);return r`
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
  `}class Si extends ho{constructor(t){if(super(t),this.it=v,t.type!==go.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(t){if(t===v||t==null)return this._t=void 0,this.it=t;if(t===Je)return t;if(typeof t!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(t===this.it)return this._t;this.it=t;const n=[t];return n.raw=n,this._t={_$litType$:this.constructor.resultType,strings:n,values:[]}}}Si.directiveName="unsafeHTML",Si.resultType=1;const Ci=po(Si);const{entries:Xl,setPrototypeOf:Va,isFrozen:xf,getPrototypeOf:wf,getOwnPropertyDescriptor:$f}=Object;let{freeze:ye,seal:Te,create:Ai}=Object,{apply:Ti,construct:_i}=typeof Reflect<"u"&&Reflect;ye||(ye=function(t){return t});Te||(Te=function(t){return t});Ti||(Ti=function(t,n){for(var s=arguments.length,i=new Array(s>2?s-2:0),o=2;o<s;o++)i[o-2]=arguments[o];return t.apply(n,i)});_i||(_i=function(t){for(var n=arguments.length,s=new Array(n>1?n-1:0),i=1;i<n;i++)s[i-1]=arguments[i];return new t(...s)});const _n=xe(Array.prototype.forEach),kf=xe(Array.prototype.lastIndexOf),qa=xe(Array.prototype.pop),jt=xe(Array.prototype.push),Sf=xe(Array.prototype.splice),zn=xe(String.prototype.toLowerCase),Js=xe(String.prototype.toString),Zs=xe(String.prototype.match),Kt=xe(String.prototype.replace),Cf=xe(String.prototype.indexOf),Af=xe(String.prototype.trim),_e=xe(Object.prototype.hasOwnProperty),fe=xe(RegExp.prototype.test),Wt=Tf(TypeError);function xe(e){return function(t){t instanceof RegExp&&(t.lastIndex=0);for(var n=arguments.length,s=new Array(n>1?n-1:0),i=1;i<n;i++)s[i-1]=arguments[i];return Ti(e,t,s)}}function Tf(e){return function(){for(var t=arguments.length,n=new Array(t),s=0;s<t;s++)n[s]=arguments[s];return _i(e,n)}}function V(e,t){let n=arguments.length>2&&arguments[2]!==void 0?arguments[2]:zn;Va&&Va(e,null);let s=t.length;for(;s--;){let i=t[s];if(typeof i=="string"){const o=n(i);o!==i&&(xf(t)||(t[s]=o),i=o)}e[i]=!0}return e}function _f(e){for(let t=0;t<e.length;t++)_e(e,t)||(e[t]=null);return e}function De(e){const t=Ai(null);for(const[n,s]of Xl(e))_e(e,n)&&(Array.isArray(s)?t[n]=_f(s):s&&typeof s=="object"&&s.constructor===Object?t[n]=De(s):t[n]=s);return t}function Vt(e,t){for(;e!==null;){const s=$f(e,t);if(s){if(s.get)return xe(s.get);if(typeof s.value=="function")return xe(s.value)}e=wf(e)}function n(){return null}return n}const Ga=ye(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),Xs=ye(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),ei=ye(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),Ef=ye(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),ti=ye(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),Lf=ye(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),Qa=ye(["#text"]),Ya=ye(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns","slot"]),ni=ye(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-rendering","textlength","type","u1","u2","unicode","values","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),Ja=ye(["accent","accentunder","align","bevelled","close","columnsalign","columnlines","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lspace","lquote","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),En=ye(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),If=Te(/\{\{[\w\W]*|[\w\W]*\}\}/gm),Mf=Te(/<%[\w\W]*|[\w\W]*%>/gm),Rf=Te(/\$\{[\w\W]*/gm),Pf=Te(/^data-[\-\w.\u00B7-\uFFFF]+$/),Df=Te(/^aria-[\-\w]+$/),ec=Te(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),Ff=Te(/^(?:\w+script|data):/i),Nf=Te(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),tc=Te(/^html$/i),Of=Te(/^[a-z][.\w]*(-[.\w]+)+$/i);var Za=Object.freeze({__proto__:null,ARIA_ATTR:Df,ATTR_WHITESPACE:Nf,CUSTOM_ELEMENT:Of,DATA_ATTR:Pf,DOCTYPE_NAME:tc,ERB_EXPR:Mf,IS_ALLOWED_URI:ec,IS_SCRIPT_OR_DATA:Ff,MUSTACHE_EXPR:If,TMPLIT_EXPR:Rf});const qt={element:1,text:3,progressingInstruction:7,comment:8,document:9},Bf=function(){return typeof window>"u"?null:window},Uf=function(t,n){if(typeof t!="object"||typeof t.createPolicy!="function")return null;let s=null;const i="data-tt-policy-suffix";n&&n.hasAttribute(i)&&(s=n.getAttribute(i));const o="dompurify"+(s?"#"+s:"");try{return t.createPolicy(o,{createHTML(a){return a},createScriptURL(a){return a}})}catch{return console.warn("TrustedTypes policy "+o+" could not be created."),null}},Xa=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}};function nc(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:Bf();const t=z=>nc(z);if(t.version="3.3.1",t.removed=[],!e||!e.document||e.document.nodeType!==qt.document||!e.Element)return t.isSupported=!1,t;let{document:n}=e;const s=n,i=s.currentScript,{DocumentFragment:o,HTMLTemplateElement:a,Node:l,Element:c,NodeFilter:g,NamedNodeMap:p=e.NamedNodeMap||e.MozNamedAttrMap,HTMLFormElement:u,DOMParser:h,trustedTypes:f}=e,d=c.prototype,m=Vt(d,"cloneNode"),k=Vt(d,"remove"),S=Vt(d,"nextSibling"),$=Vt(d,"childNodes"),A=Vt(d,"parentNode");if(typeof a=="function"){const z=n.createElement("template");z.content&&z.content.ownerDocument&&(n=z.content.ownerDocument)}let C,T="";const{implementation:_,createNodeIterator:I,createDocumentFragment:W,getElementsByTagName:K}=n,{importNode:ne}=s;let N=Xa();t.isSupported=typeof Xl=="function"&&typeof A=="function"&&_&&_.createHTMLDocument!==void 0;const{MUSTACHE_EXPR:H,ERB_EXPR:de,TMPLIT_EXPR:E,DATA_ATTR:U,ARIA_ATTR:oe,IS_SCRIPT_OR_DATA:ae,ATTR_WHITESPACE:X,CUSTOM_ELEMENT:se}=Za;let{IS_ALLOWED_URI:M}=Za,P=null;const D=V({},[...Ga,...Xs,...ei,...ti,...Qa]);let j=null;const $e=V({},[...Ya,...ni,...Ja,...En]);let J=Object.seal(Ai(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),Se=null,ee=null;const he=Object.seal(Ai(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}}));let Be=!0,Ue=!0,st=!1,Ro=!0,At=!1,fn=!0,it=!1,$s=!1,ks=!1,Tt=!1,mn=!1,vn=!1,Po=!0,Do=!1;const _c="user-content-";let Ss=!0,Bt=!1,_t={},Me=null;const Cs=V({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","style","svg","template","thead","title","video","xmp"]);let Fo=null;const No=V({},["audio","video","img","source","image","track"]);let As=null;const Oo=V({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),bn="http://www.w3.org/1998/Math/MathML",yn="http://www.w3.org/2000/svg",ze="http://www.w3.org/1999/xhtml";let Et=ze,Ts=!1,_s=null;const Ec=V({},[bn,yn,ze],Js);let xn=V({},["mi","mo","mn","ms","mtext"]),wn=V({},["annotation-xml"]);const Lc=V({},["title","style","font","a","script"]);let Ut=null;const Ic=["application/xhtml+xml","text/html"],Mc="text/html";let ie=null,Lt=null;const Rc=n.createElement("form"),Bo=function(w){return w instanceof RegExp||w instanceof Function},Es=function(){let w=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(!(Lt&&Lt===w)){if((!w||typeof w!="object")&&(w={}),w=De(w),Ut=Ic.indexOf(w.PARSER_MEDIA_TYPE)===-1?Mc:w.PARSER_MEDIA_TYPE,ie=Ut==="application/xhtml+xml"?Js:zn,P=_e(w,"ALLOWED_TAGS")?V({},w.ALLOWED_TAGS,ie):D,j=_e(w,"ALLOWED_ATTR")?V({},w.ALLOWED_ATTR,ie):$e,_s=_e(w,"ALLOWED_NAMESPACES")?V({},w.ALLOWED_NAMESPACES,Js):Ec,As=_e(w,"ADD_URI_SAFE_ATTR")?V(De(Oo),w.ADD_URI_SAFE_ATTR,ie):Oo,Fo=_e(w,"ADD_DATA_URI_TAGS")?V(De(No),w.ADD_DATA_URI_TAGS,ie):No,Me=_e(w,"FORBID_CONTENTS")?V({},w.FORBID_CONTENTS,ie):Cs,Se=_e(w,"FORBID_TAGS")?V({},w.FORBID_TAGS,ie):De({}),ee=_e(w,"FORBID_ATTR")?V({},w.FORBID_ATTR,ie):De({}),_t=_e(w,"USE_PROFILES")?w.USE_PROFILES:!1,Be=w.ALLOW_ARIA_ATTR!==!1,Ue=w.ALLOW_DATA_ATTR!==!1,st=w.ALLOW_UNKNOWN_PROTOCOLS||!1,Ro=w.ALLOW_SELF_CLOSE_IN_ATTR!==!1,At=w.SAFE_FOR_TEMPLATES||!1,fn=w.SAFE_FOR_XML!==!1,it=w.WHOLE_DOCUMENT||!1,Tt=w.RETURN_DOM||!1,mn=w.RETURN_DOM_FRAGMENT||!1,vn=w.RETURN_TRUSTED_TYPE||!1,ks=w.FORCE_BODY||!1,Po=w.SANITIZE_DOM!==!1,Do=w.SANITIZE_NAMED_PROPS||!1,Ss=w.KEEP_CONTENT!==!1,Bt=w.IN_PLACE||!1,M=w.ALLOWED_URI_REGEXP||ec,Et=w.NAMESPACE||ze,xn=w.MATHML_TEXT_INTEGRATION_POINTS||xn,wn=w.HTML_INTEGRATION_POINTS||wn,J=w.CUSTOM_ELEMENT_HANDLING||{},w.CUSTOM_ELEMENT_HANDLING&&Bo(w.CUSTOM_ELEMENT_HANDLING.tagNameCheck)&&(J.tagNameCheck=w.CUSTOM_ELEMENT_HANDLING.tagNameCheck),w.CUSTOM_ELEMENT_HANDLING&&Bo(w.CUSTOM_ELEMENT_HANDLING.attributeNameCheck)&&(J.attributeNameCheck=w.CUSTOM_ELEMENT_HANDLING.attributeNameCheck),w.CUSTOM_ELEMENT_HANDLING&&typeof w.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements=="boolean"&&(J.allowCustomizedBuiltInElements=w.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements),At&&(Ue=!1),mn&&(Tt=!0),_t&&(P=V({},Qa),j=[],_t.html===!0&&(V(P,Ga),V(j,Ya)),_t.svg===!0&&(V(P,Xs),V(j,ni),V(j,En)),_t.svgFilters===!0&&(V(P,ei),V(j,ni),V(j,En)),_t.mathMl===!0&&(V(P,ti),V(j,Ja),V(j,En))),w.ADD_TAGS&&(typeof w.ADD_TAGS=="function"?he.tagCheck=w.ADD_TAGS:(P===D&&(P=De(P)),V(P,w.ADD_TAGS,ie))),w.ADD_ATTR&&(typeof w.ADD_ATTR=="function"?he.attributeCheck=w.ADD_ATTR:(j===$e&&(j=De(j)),V(j,w.ADD_ATTR,ie))),w.ADD_URI_SAFE_ATTR&&V(As,w.ADD_URI_SAFE_ATTR,ie),w.FORBID_CONTENTS&&(Me===Cs&&(Me=De(Me)),V(Me,w.FORBID_CONTENTS,ie)),w.ADD_FORBID_CONTENTS&&(Me===Cs&&(Me=De(Me)),V(Me,w.ADD_FORBID_CONTENTS,ie)),Ss&&(P["#text"]=!0),it&&V(P,["html","head","body"]),P.table&&(V(P,["tbody"]),delete Se.tbody),w.TRUSTED_TYPES_POLICY){if(typeof w.TRUSTED_TYPES_POLICY.createHTML!="function")throw Wt('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof w.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw Wt('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');C=w.TRUSTED_TYPES_POLICY,T=C.createHTML("")}else C===void 0&&(C=Uf(f,i)),C!==null&&typeof T=="string"&&(T=C.createHTML(""));ye&&ye(w),Lt=w}},Uo=V({},[...Xs,...ei,...Ef]),zo=V({},[...ti,...Lf]),Pc=function(w){let L=A(w);(!L||!L.tagName)&&(L={namespaceURI:Et,tagName:"template"});const O=zn(w.tagName),Z=zn(L.tagName);return _s[w.namespaceURI]?w.namespaceURI===yn?L.namespaceURI===ze?O==="svg":L.namespaceURI===bn?O==="svg"&&(Z==="annotation-xml"||xn[Z]):!!Uo[O]:w.namespaceURI===bn?L.namespaceURI===ze?O==="math":L.namespaceURI===yn?O==="math"&&wn[Z]:!!zo[O]:w.namespaceURI===ze?L.namespaceURI===yn&&!wn[Z]||L.namespaceURI===bn&&!xn[Z]?!1:!zo[O]&&(Lc[O]||!Uo[O]):!!(Ut==="application/xhtml+xml"&&_s[w.namespaceURI]):!1},Re=function(w){jt(t.removed,{element:w});try{A(w).removeChild(w)}catch{k(w)}},ot=function(w,L){try{jt(t.removed,{attribute:L.getAttributeNode(w),from:L})}catch{jt(t.removed,{attribute:null,from:L})}if(L.removeAttribute(w),w==="is")if(Tt||mn)try{Re(L)}catch{}else try{L.setAttribute(w,"")}catch{}},Ho=function(w){let L=null,O=null;if(ks)w="<remove></remove>"+w;else{const te=Zs(w,/^[\r\n\t ]+/);O=te&&te[0]}Ut==="application/xhtml+xml"&&Et===ze&&(w='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+w+"</body></html>");const Z=C?C.createHTML(w):w;if(Et===ze)try{L=new h().parseFromString(Z,Ut)}catch{}if(!L||!L.documentElement){L=_.createDocument(Et,"template",null);try{L.documentElement.innerHTML=Ts?T:Z}catch{}}const ue=L.body||L.documentElement;return w&&O&&ue.insertBefore(n.createTextNode(O),ue.childNodes[0]||null),Et===ze?K.call(L,it?"html":"body")[0]:it?L.documentElement:ue},jo=function(w){return I.call(w.ownerDocument||w,w,g.SHOW_ELEMENT|g.SHOW_COMMENT|g.SHOW_TEXT|g.SHOW_PROCESSING_INSTRUCTION|g.SHOW_CDATA_SECTION,null)},Ls=function(w){return w instanceof u&&(typeof w.nodeName!="string"||typeof w.textContent!="string"||typeof w.removeChild!="function"||!(w.attributes instanceof p)||typeof w.removeAttribute!="function"||typeof w.setAttribute!="function"||typeof w.namespaceURI!="string"||typeof w.insertBefore!="function"||typeof w.hasChildNodes!="function")},Ko=function(w){return typeof l=="function"&&w instanceof l};function He(z,w,L){_n(z,O=>{O.call(t,w,L,Lt)})}const Wo=function(w){let L=null;if(He(N.beforeSanitizeElements,w,null),Ls(w))return Re(w),!0;const O=ie(w.nodeName);if(He(N.uponSanitizeElement,w,{tagName:O,allowedTags:P}),fn&&w.hasChildNodes()&&!Ko(w.firstElementChild)&&fe(/<[/\w!]/g,w.innerHTML)&&fe(/<[/\w!]/g,w.textContent)||w.nodeType===qt.progressingInstruction||fn&&w.nodeType===qt.comment&&fe(/<[/\w]/g,w.data))return Re(w),!0;if(!(he.tagCheck instanceof Function&&he.tagCheck(O))&&(!P[O]||Se[O])){if(!Se[O]&&qo(O)&&(J.tagNameCheck instanceof RegExp&&fe(J.tagNameCheck,O)||J.tagNameCheck instanceof Function&&J.tagNameCheck(O)))return!1;if(Ss&&!Me[O]){const Z=A(w)||w.parentNode,ue=$(w)||w.childNodes;if(ue&&Z){const te=ue.length;for(let we=te-1;we>=0;--we){const je=m(ue[we],!0);je.__removalCount=(w.__removalCount||0)+1,Z.insertBefore(je,S(w))}}}return Re(w),!0}return w instanceof c&&!Pc(w)||(O==="noscript"||O==="noembed"||O==="noframes")&&fe(/<\/no(script|embed|frames)/i,w.innerHTML)?(Re(w),!0):(At&&w.nodeType===qt.text&&(L=w.textContent,_n([H,de,E],Z=>{L=Kt(L,Z," ")}),w.textContent!==L&&(jt(t.removed,{element:w.cloneNode()}),w.textContent=L)),He(N.afterSanitizeElements,w,null),!1)},Vo=function(w,L,O){if(Po&&(L==="id"||L==="name")&&(O in n||O in Rc))return!1;if(!(Ue&&!ee[L]&&fe(U,L))){if(!(Be&&fe(oe,L))){if(!(he.attributeCheck instanceof Function&&he.attributeCheck(L,w))){if(!j[L]||ee[L]){if(!(qo(w)&&(J.tagNameCheck instanceof RegExp&&fe(J.tagNameCheck,w)||J.tagNameCheck instanceof Function&&J.tagNameCheck(w))&&(J.attributeNameCheck instanceof RegExp&&fe(J.attributeNameCheck,L)||J.attributeNameCheck instanceof Function&&J.attributeNameCheck(L,w))||L==="is"&&J.allowCustomizedBuiltInElements&&(J.tagNameCheck instanceof RegExp&&fe(J.tagNameCheck,O)||J.tagNameCheck instanceof Function&&J.tagNameCheck(O))))return!1}else if(!As[L]){if(!fe(M,Kt(O,X,""))){if(!((L==="src"||L==="xlink:href"||L==="href")&&w!=="script"&&Cf(O,"data:")===0&&Fo[w])){if(!(st&&!fe(ae,Kt(O,X,"")))){if(O)return!1}}}}}}}return!0},qo=function(w){return w!=="annotation-xml"&&Zs(w,se)},Go=function(w){He(N.beforeSanitizeAttributes,w,null);const{attributes:L}=w;if(!L||Ls(w))return;const O={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:j,forceKeepAttr:void 0};let Z=L.length;for(;Z--;){const ue=L[Z],{name:te,namespaceURI:we,value:je}=ue,It=ie(te),Is=je;let ce=te==="value"?Is:Af(Is);if(O.attrName=It,O.attrValue=ce,O.keepAttr=!0,O.forceKeepAttr=void 0,He(N.uponSanitizeAttribute,w,O),ce=O.attrValue,Do&&(It==="id"||It==="name")&&(ot(te,w),ce=_c+ce),fn&&fe(/((--!?|])>)|<\/(style|title|textarea)/i,ce)){ot(te,w);continue}if(It==="attributename"&&Zs(ce,"href")){ot(te,w);continue}if(O.forceKeepAttr)continue;if(!O.keepAttr){ot(te,w);continue}if(!Ro&&fe(/\/>/i,ce)){ot(te,w);continue}At&&_n([H,de,E],Yo=>{ce=Kt(ce,Yo," ")});const Qo=ie(w.nodeName);if(!Vo(Qo,It,ce)){ot(te,w);continue}if(C&&typeof f=="object"&&typeof f.getAttributeType=="function"&&!we)switch(f.getAttributeType(Qo,It)){case"TrustedHTML":{ce=C.createHTML(ce);break}case"TrustedScriptURL":{ce=C.createScriptURL(ce);break}}if(ce!==Is)try{we?w.setAttributeNS(we,te,ce):w.setAttribute(te,ce),Ls(w)?Re(w):qa(t.removed)}catch{ot(te,w)}}He(N.afterSanitizeAttributes,w,null)},Dc=function z(w){let L=null;const O=jo(w);for(He(N.beforeSanitizeShadowDOM,w,null);L=O.nextNode();)He(N.uponSanitizeShadowNode,L,null),Wo(L),Go(L),L.content instanceof o&&z(L.content);He(N.afterSanitizeShadowDOM,w,null)};return t.sanitize=function(z){let w=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},L=null,O=null,Z=null,ue=null;if(Ts=!z,Ts&&(z="<!-->"),typeof z!="string"&&!Ko(z))if(typeof z.toString=="function"){if(z=z.toString(),typeof z!="string")throw Wt("dirty is not a string, aborting")}else throw Wt("toString is not a function");if(!t.isSupported)return z;if($s||Es(w),t.removed=[],typeof z=="string"&&(Bt=!1),Bt){if(z.nodeName){const je=ie(z.nodeName);if(!P[je]||Se[je])throw Wt("root node is forbidden and cannot be sanitized in-place")}}else if(z instanceof l)L=Ho("<!---->"),O=L.ownerDocument.importNode(z,!0),O.nodeType===qt.element&&O.nodeName==="BODY"||O.nodeName==="HTML"?L=O:L.appendChild(O);else{if(!Tt&&!At&&!it&&z.indexOf("<")===-1)return C&&vn?C.createHTML(z):z;if(L=Ho(z),!L)return Tt?null:vn?T:""}L&&ks&&Re(L.firstChild);const te=jo(Bt?z:L);for(;Z=te.nextNode();)Wo(Z),Go(Z),Z.content instanceof o&&Dc(Z.content);if(Bt)return z;if(Tt){if(mn)for(ue=W.call(L.ownerDocument);L.firstChild;)ue.appendChild(L.firstChild);else ue=L;return(j.shadowroot||j.shadowrootmode)&&(ue=ne.call(s,ue,!0)),ue}let we=it?L.outerHTML:L.innerHTML;return it&&P["!doctype"]&&L.ownerDocument&&L.ownerDocument.doctype&&L.ownerDocument.doctype.name&&fe(tc,L.ownerDocument.doctype.name)&&(we="<!DOCTYPE "+L.ownerDocument.doctype.name+`>
`+we),At&&_n([H,de,E],je=>{we=Kt(we,je," ")}),C&&vn?C.createHTML(we):we},t.setConfig=function(){let z=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};Es(z),$s=!0},t.clearConfig=function(){Lt=null,$s=!1},t.isValidAttribute=function(z,w,L){Lt||Es({});const O=ie(z),Z=ie(w);return Vo(O,Z,L)},t.addHook=function(z,w){typeof w=="function"&&jt(N[z],w)},t.removeHook=function(z,w){if(w!==void 0){const L=kf(N[z],w);return L===-1?void 0:Sf(N[z],L,1)[0]}return qa(N[z])},t.removeHooks=function(z){N[z]=[]},t.removeAllHooks=function(){N=Xa()},t}var Ei=nc();function bo(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Ct=bo();function sc(e){Ct=e}var gt={exec:()=>null};function q(e,t=""){let n=typeof e=="string"?e:e.source,s={replace:(i,o)=>{let a=typeof o=="string"?o:o.source;return a=a.replace(ve.caret,"$1"),n=n.replace(i,a),s},getRegex:()=>new RegExp(n,t)};return s}var zf=(()=>{try{return!!new RegExp("(?<=1)(?<!1)")}catch{return!1}})(),ve={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>new RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}#`),htmlBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}<(?:[a-z].*>|!--)`,"i"),blockquoteBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}>`)},Hf=/^(?:[ \t]*(?:\n|$))+/,jf=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,Kf=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,hn=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,Wf=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,yo=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,ic=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,oc=q(ic).replace(/bull/g,yo).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),Vf=q(ic).replace(/bull/g,yo).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),xo=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,qf=/^[^\n]+/,wo=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,Gf=q(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",wo).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Qf=q(/^(bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,yo).getRegex(),ys="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",$o=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,Yf=q("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",$o).replace("tag",ys).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),ac=q(xo).replace("hr",hn).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",ys).getRegex(),Jf=q(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",ac).getRegex(),ko={blockquote:Jf,code:jf,def:Gf,fences:Kf,heading:Wf,hr:hn,html:Yf,lheading:oc,list:Qf,newline:Hf,paragraph:ac,table:gt,text:qf},er=q("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",hn).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",ys).getRegex(),Zf={...ko,lheading:Vf,table:er,paragraph:q(xo).replace("hr",hn).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",er).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",ys).getRegex()},Xf={...ko,html:q(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",$o).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:gt,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:q(xo).replace("hr",hn).replace("heading",` *#{1,6} *[^
]`).replace("lheading",oc).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},em=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,tm=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,rc=/^( {2,}|\\)\n(?!\s*$)/,nm=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,xs=/[\p{P}\p{S}]/u,So=/[\s\p{P}\p{S}]/u,lc=/[^\s\p{P}\p{S}]/u,sm=q(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,So).getRegex(),cc=/(?!~)[\p{P}\p{S}]/u,im=/(?!~)[\s\p{P}\p{S}]/u,om=/(?:[^\s\p{P}\p{S}]|~)/u,dc=/(?![*_])[\p{P}\p{S}]/u,am=/(?![*_])[\s\p{P}\p{S}]/u,rm=/(?:[^\s\p{P}\p{S}]|[*_])/u,lm=q(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",zf?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),uc=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,cm=q(uc,"u").replace(/punct/g,xs).getRegex(),dm=q(uc,"u").replace(/punct/g,cc).getRegex(),gc="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",um=q(gc,"gu").replace(/notPunctSpace/g,lc).replace(/punctSpace/g,So).replace(/punct/g,xs).getRegex(),gm=q(gc,"gu").replace(/notPunctSpace/g,om).replace(/punctSpace/g,im).replace(/punct/g,cc).getRegex(),pm=q("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,lc).replace(/punctSpace/g,So).replace(/punct/g,xs).getRegex(),hm=q(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,dc).getRegex(),fm="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",mm=q(fm,"gu").replace(/notPunctSpace/g,rm).replace(/punctSpace/g,am).replace(/punct/g,dc).getRegex(),vm=q(/\\(punct)/,"gu").replace(/punct/g,xs).getRegex(),bm=q(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),ym=q($o).replace("(?:-->|$)","-->").getRegex(),xm=q("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",ym).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Zn=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/,wm=q(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label",Zn).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),pc=q(/^!?\[(label)\]\[(ref)\]/).replace("label",Zn).replace("ref",wo).getRegex(),hc=q(/^!?\[(ref)\](?:\[\])?/).replace("ref",wo).getRegex(),$m=q("reflink|nolink(?!\\()","g").replace("reflink",pc).replace("nolink",hc).getRegex(),tr=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,Co={_backpedal:gt,anyPunctuation:vm,autolink:bm,blockSkip:lm,br:rc,code:tm,del:gt,delLDelim:gt,delRDelim:gt,emStrongLDelim:cm,emStrongRDelimAst:um,emStrongRDelimUnd:pm,escape:em,link:wm,nolink:hc,punctuation:sm,reflink:pc,reflinkSearch:$m,tag:xm,text:nm,url:gt},km={...Co,link:q(/^!?\[(label)\]\((.*?)\)/).replace("label",Zn).getRegex(),reflink:q(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Zn).getRegex()},Li={...Co,emStrongRDelimAst:gm,emStrongLDelim:dm,delLDelim:hm,delRDelim:mm,url:q(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",tr).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:q(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",tr).getRegex()},Sm={...Li,br:q(rc).replace("{2,}","*").getRegex(),text:q(Li.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},Ln={normal:ko,gfm:Zf,pedantic:Xf},Gt={normal:Co,gfm:Li,breaks:Sm,pedantic:km},Cm={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},nr=e=>Cm[e];function Fe(e,t){if(t){if(ve.escapeTest.test(e))return e.replace(ve.escapeReplace,nr)}else if(ve.escapeTestNoEncode.test(e))return e.replace(ve.escapeReplaceNoEncode,nr);return e}function sr(e){try{e=encodeURI(e).replace(ve.percentDecode,"%")}catch{return null}return e}function ir(e,t){let n=e.replace(ve.findPipe,(o,a,l)=>{let c=!1,g=a;for(;--g>=0&&l[g]==="\\";)c=!c;return c?"|":" |"}),s=n.split(ve.splitPipe),i=0;if(s[0].trim()||s.shift(),s.length>0&&!s.at(-1)?.trim()&&s.pop(),t)if(s.length>t)s.splice(t);else for(;s.length<t;)s.push("");for(;i<s.length;i++)s[i]=s[i].trim().replace(ve.slashPipe,"|");return s}function Qt(e,t,n){let s=e.length;if(s===0)return"";let i=0;for(;i<s&&e.charAt(s-i-1)===t;)i++;return e.slice(0,s-i)}function Am(e,t){if(e.indexOf(t[1])===-1)return-1;let n=0;for(let s=0;s<e.length;s++)if(e[s]==="\\")s++;else if(e[s]===t[0])n++;else if(e[s]===t[1]&&(n--,n<0))return s;return n>0?-2:-1}function Tm(e,t=0){let n=t,s="";for(let i of e)if(i==="	"){let o=4-n%4;s+=" ".repeat(o),n+=o}else s+=i,n++;return s}function or(e,t,n,s,i){let o=t.href,a=t.title||null,l=e[1].replace(i.other.outputLinkReplace,"$1");s.state.inLink=!0;let c={type:e[0].charAt(0)==="!"?"image":"link",raw:n,href:o,title:a,text:l,tokens:s.inlineTokens(l)};return s.state.inLink=!1,c}function _m(e,t,n){let s=e.match(n.other.indentCodeCompensation);if(s===null)return t;let i=s[1];return t.split(`
`).map(o=>{let a=o.match(n.other.beginningSpace);if(a===null)return o;let[l]=a;return l.length>=i.length?o.slice(i.length):o}).join(`
`)}var Xn=class{options;rules;lexer;constructor(e){this.options=e||Ct}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let n=t[0].replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:t[0],codeBlockStyle:"indented",text:this.options.pedantic?n:Qt(n,`
`)}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let n=t[0],s=_m(n,t[3]||"",this.rules);return{type:"code",raw:n,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:s}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let n=t[2].trim();if(this.rules.other.endingHash.test(n)){let s=Qt(n,"#");(this.options.pedantic||!s||this.rules.other.endingSpaceChar.test(s))&&(n=s.trim())}return{type:"heading",raw:t[0],depth:t[1].length,text:n,tokens:this.lexer.inline(n)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:Qt(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let n=Qt(t[0],`
`).split(`
`),s="",i="",o=[];for(;n.length>0;){let a=!1,l=[],c;for(c=0;c<n.length;c++)if(this.rules.other.blockquoteStart.test(n[c]))l.push(n[c]),a=!0;else if(!a)l.push(n[c]);else break;n=n.slice(c);let g=l.join(`
`),p=g.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");s=s?`${s}
${g}`:g,i=i?`${i}
${p}`:p;let u=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(p,o,!0),this.lexer.state.top=u,n.length===0)break;let h=o.at(-1);if(h?.type==="code")break;if(h?.type==="blockquote"){let f=h,d=f.raw+`
`+n.join(`
`),m=this.blockquote(d);o[o.length-1]=m,s=s.substring(0,s.length-f.raw.length)+m.raw,i=i.substring(0,i.length-f.text.length)+m.text;break}else if(h?.type==="list"){let f=h,d=f.raw+`
`+n.join(`
`),m=this.list(d);o[o.length-1]=m,s=s.substring(0,s.length-h.raw.length)+m.raw,i=i.substring(0,i.length-f.raw.length)+m.raw,n=d.substring(o.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:s,tokens:o,text:i}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim(),s=n.length>1,i={type:"list",raw:"",ordered:s,start:s?+n.slice(0,-1):"",loose:!1,items:[]};n=s?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=s?n:"[*+-]");let o=this.rules.other.listItemRegex(n),a=!1;for(;e;){let c=!1,g="",p="";if(!(t=o.exec(e))||this.rules.block.hr.test(e))break;g=t[0],e=e.substring(g.length);let u=Tm(t[2].split(`
`,1)[0],t[1].length),h=e.split(`
`,1)[0],f=!u.trim(),d=0;if(this.options.pedantic?(d=2,p=u.trimStart()):f?d=t[1].length+1:(d=u.search(this.rules.other.nonSpaceChar),d=d>4?1:d,p=u.slice(d),d+=t[1].length),f&&this.rules.other.blankLine.test(h)&&(g+=h+`
`,e=e.substring(h.length+1),c=!0),!c){let m=this.rules.other.nextBulletRegex(d),k=this.rules.other.hrRegex(d),S=this.rules.other.fencesBeginRegex(d),$=this.rules.other.headingBeginRegex(d),A=this.rules.other.htmlBeginRegex(d),C=this.rules.other.blockquoteBeginRegex(d);for(;e;){let T=e.split(`
`,1)[0],_;if(h=T,this.options.pedantic?(h=h.replace(this.rules.other.listReplaceNesting,"  "),_=h):_=h.replace(this.rules.other.tabCharGlobal,"    "),S.test(h)||$.test(h)||A.test(h)||C.test(h)||m.test(h)||k.test(h))break;if(_.search(this.rules.other.nonSpaceChar)>=d||!h.trim())p+=`
`+_.slice(d);else{if(f||u.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||S.test(u)||$.test(u)||k.test(u))break;p+=`
`+h}f=!h.trim(),g+=T+`
`,e=e.substring(T.length+1),u=_.slice(d)}}i.loose||(a?i.loose=!0:this.rules.other.doubleBlankLine.test(g)&&(a=!0)),i.items.push({type:"list_item",raw:g,task:!!this.options.gfm&&this.rules.other.listIsTask.test(p),loose:!1,text:p,tokens:[]}),i.raw+=g}let l=i.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;i.raw=i.raw.trimEnd();for(let c of i.items){if(this.lexer.state.top=!1,c.tokens=this.lexer.blockTokens(c.text,[]),c.task){if(c.text=c.text.replace(this.rules.other.listReplaceTask,""),c.tokens[0]?.type==="text"||c.tokens[0]?.type==="paragraph"){c.tokens[0].raw=c.tokens[0].raw.replace(this.rules.other.listReplaceTask,""),c.tokens[0].text=c.tokens[0].text.replace(this.rules.other.listReplaceTask,"");for(let p=this.lexer.inlineQueue.length-1;p>=0;p--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[p].src)){this.lexer.inlineQueue[p].src=this.lexer.inlineQueue[p].src.replace(this.rules.other.listReplaceTask,"");break}}let g=this.rules.other.listTaskCheckbox.exec(c.raw);if(g){let p={type:"checkbox",raw:g[0]+" ",checked:g[0]!=="[ ]"};c.checked=p.checked,i.loose?c.tokens[0]&&["paragraph","text"].includes(c.tokens[0].type)&&"tokens"in c.tokens[0]&&c.tokens[0].tokens?(c.tokens[0].raw=p.raw+c.tokens[0].raw,c.tokens[0].text=p.raw+c.tokens[0].text,c.tokens[0].tokens.unshift(p)):c.tokens.unshift({type:"paragraph",raw:p.raw,text:p.raw,tokens:[p]}):c.tokens.unshift(p)}}if(!i.loose){let g=c.tokens.filter(u=>u.type==="space"),p=g.length>0&&g.some(u=>this.rules.other.anyLine.test(u.raw));i.loose=p}}if(i.loose)for(let c of i.items){c.loose=!0;for(let g of c.tokens)g.type==="text"&&(g.type="paragraph")}return i}}html(e){let t=this.rules.block.html.exec(e);if(t)return{type:"html",block:!0,raw:t[0],pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:t[0]}}def(e){let t=this.rules.block.def.exec(e);if(t){let n=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),s=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",i=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:n,raw:t[0],href:s,title:i}}}table(e){let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let n=ir(t[1]),s=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),i=t[3]?.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],o={type:"table",raw:t[0],header:[],align:[],rows:[]};if(n.length===s.length){for(let a of s)this.rules.other.tableAlignRight.test(a)?o.align.push("right"):this.rules.other.tableAlignCenter.test(a)?o.align.push("center"):this.rules.other.tableAlignLeft.test(a)?o.align.push("left"):o.align.push(null);for(let a=0;a<n.length;a++)o.header.push({text:n[a],tokens:this.lexer.inline(n[a]),header:!0,align:o.align[a]});for(let a of i)o.rows.push(ir(a,o.header.length).map((l,c)=>({text:l,tokens:this.lexer.inline(l),header:!1,align:o.align[c]})));return o}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t)return{type:"heading",raw:t[0],depth:t[2].charAt(0)==="="?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let n=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:n,tokens:this.lexer.inline(n)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let n=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(n)){if(!this.rules.other.endAngleBracket.test(n))return;let o=Qt(n.slice(0,-1),"\\");if((n.length-o.length)%2===0)return}else{let o=Am(t[2],"()");if(o===-2)return;if(o>-1){let a=(t[0].indexOf("!")===0?5:4)+t[1].length+o;t[2]=t[2].substring(0,o),t[0]=t[0].substring(0,a).trim(),t[3]=""}}let s=t[2],i="";if(this.options.pedantic){let o=this.rules.other.pedanticHrefTitle.exec(s);o&&(s=o[1],i=o[3])}else i=t[3]?t[3].slice(1,-1):"";return s=s.trim(),this.rules.other.startAngleBracket.test(s)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(n)?s=s.slice(1):s=s.slice(1,-1)),or(t,{href:s&&s.replace(this.rules.inline.anyPunctuation,"$1"),title:i&&i.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){let s=(n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal," "),i=t[s.toLowerCase()];if(!i){let o=n[0].charAt(0);return{type:"text",raw:o,text:o}}return or(n,i,n[0],this.lexer,this.rules)}}emStrong(e,t,n=""){let s=this.rules.inline.emStrongLDelim.exec(e);if(!(!s||s[3]&&n.match(this.rules.other.unicodeAlphaNumeric))&&(!(s[1]||s[2])||!n||this.rules.inline.punctuation.exec(n))){let i=[...s[0]].length-1,o,a,l=i,c=0,g=s[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(g.lastIndex=0,t=t.slice(-1*e.length+i);(s=g.exec(t))!=null;){if(o=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!o)continue;if(a=[...o].length,s[3]||s[4]){l+=a;continue}else if((s[5]||s[6])&&i%3&&!((i+a)%3)){c+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l+c);let p=[...s[0]][0].length,u=e.slice(0,i+s.index+p+a);if(Math.min(i,a)%2){let f=u.slice(1,-1);return{type:"em",raw:u,text:f,tokens:this.lexer.inlineTokens(f)}}let h=u.slice(2,-2);return{type:"strong",raw:u,text:h,tokens:this.lexer.inlineTokens(h)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let n=t[2].replace(this.rules.other.newLineCharGlobal," "),s=this.rules.other.nonSpaceChar.test(n),i=this.rules.other.startingSpaceChar.test(n)&&this.rules.other.endingSpaceChar.test(n);return s&&i&&(n=n.substring(1,n.length-1)),{type:"codespan",raw:t[0],text:n}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e,t,n=""){let s=this.rules.inline.delLDelim.exec(e);if(s&&(!s[1]||!n||this.rules.inline.punctuation.exec(n))){let i=[...s[0]].length-1,o,a,l=i,c=this.rules.inline.delRDelim;for(c.lastIndex=0,t=t.slice(-1*e.length+i);(s=c.exec(t))!=null;){if(o=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!o||(a=[...o].length,a!==i))continue;if(s[3]||s[4]){l+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l);let g=[...s[0]][0].length,p=e.slice(0,i+s.index+g+a),u=p.slice(i,-i);return{type:"del",raw:p,text:u,tokens:this.lexer.inlineTokens(u)}}}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let n,s;return t[2]==="@"?(n=t[1],s="mailto:"+n):(n=t[1],s=n),{type:"link",raw:t[0],text:n,href:s,tokens:[{type:"text",raw:n,text:n}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let n,s;if(t[2]==="@")n=t[0],s="mailto:"+n;else{let i;do i=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??"";while(i!==t[0]);n=t[0],t[1]==="www."?s="http://"+t[0]:s=t[0]}return{type:"link",raw:t[0],text:n,href:s,tokens:[{type:"text",raw:n,text:n}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let n=this.lexer.state.inRawBlock;return{type:"text",raw:t[0],text:t[0],escaped:n}}}},Ee=class Ii{tokens;options;state;inlineQueue;tokenizer;constructor(t){this.tokens=[],this.tokens.links=Object.create(null),this.options=t||Ct,this.options.tokenizer=this.options.tokenizer||new Xn,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let n={other:ve,block:Ln.normal,inline:Gt.normal};this.options.pedantic?(n.block=Ln.pedantic,n.inline=Gt.pedantic):this.options.gfm&&(n.block=Ln.gfm,this.options.breaks?n.inline=Gt.breaks:n.inline=Gt.gfm),this.tokenizer.rules=n}static get rules(){return{block:Ln,inline:Gt}}static lex(t,n){return new Ii(n).lex(t)}static lexInline(t,n){return new Ii(n).inlineTokens(t)}lex(t){t=t.replace(ve.carriageReturn,`
`),this.blockTokens(t,this.tokens);for(let n=0;n<this.inlineQueue.length;n++){let s=this.inlineQueue[n];this.inlineTokens(s.src,s.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(t,n=[],s=!1){for(this.options.pedantic&&(t=t.replace(ve.tabCharGlobal,"    ").replace(ve.spaceLine,""));t;){let i;if(this.options.extensions?.block?.some(a=>(i=a.call({lexer:this},t,n))?(t=t.substring(i.raw.length),n.push(i),!0):!1))continue;if(i=this.tokenizer.space(t)){t=t.substring(i.raw.length);let a=n.at(-1);i.raw.length===1&&a!==void 0?a.raw+=`
`:n.push(i);continue}if(i=this.tokenizer.code(t)){t=t.substring(i.raw.length);let a=n.at(-1);a?.type==="paragraph"||a?.type==="text"?(a.raw+=(a.raw.endsWith(`
`)?"":`
`)+i.raw,a.text+=`
`+i.text,this.inlineQueue.at(-1).src=a.text):n.push(i);continue}if(i=this.tokenizer.fences(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.heading(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.hr(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.blockquote(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.list(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.html(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.def(t)){t=t.substring(i.raw.length);let a=n.at(-1);a?.type==="paragraph"||a?.type==="text"?(a.raw+=(a.raw.endsWith(`
`)?"":`
`)+i.raw,a.text+=`
`+i.raw,this.inlineQueue.at(-1).src=a.text):this.tokens.links[i.tag]||(this.tokens.links[i.tag]={href:i.href,title:i.title},n.push(i));continue}if(i=this.tokenizer.table(t)){t=t.substring(i.raw.length),n.push(i);continue}if(i=this.tokenizer.lheading(t)){t=t.substring(i.raw.length),n.push(i);continue}let o=t;if(this.options.extensions?.startBlock){let a=1/0,l=t.slice(1),c;this.options.extensions.startBlock.forEach(g=>{c=g.call({lexer:this},l),typeof c=="number"&&c>=0&&(a=Math.min(a,c))}),a<1/0&&a>=0&&(o=t.substring(0,a+1))}if(this.state.top&&(i=this.tokenizer.paragraph(o))){let a=n.at(-1);s&&a?.type==="paragraph"?(a.raw+=(a.raw.endsWith(`
`)?"":`
`)+i.raw,a.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=a.text):n.push(i),s=o.length!==t.length,t=t.substring(i.raw.length);continue}if(i=this.tokenizer.text(t)){t=t.substring(i.raw.length);let a=n.at(-1);a?.type==="text"?(a.raw+=(a.raw.endsWith(`
`)?"":`
`)+i.raw,a.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=a.text):n.push(i);continue}if(t){let a="Infinite loop on byte: "+t.charCodeAt(0);if(this.options.silent){console.error(a);break}else throw new Error(a)}}return this.state.top=!0,n}inline(t,n=[]){return this.inlineQueue.push({src:t,tokens:n}),n}inlineTokens(t,n=[]){let s=t,i=null;if(this.tokens.links){let c=Object.keys(this.tokens.links);if(c.length>0)for(;(i=this.tokenizer.rules.inline.reflinkSearch.exec(s))!=null;)c.includes(i[0].slice(i[0].lastIndexOf("[")+1,-1))&&(s=s.slice(0,i.index)+"["+"a".repeat(i[0].length-2)+"]"+s.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(i=this.tokenizer.rules.inline.anyPunctuation.exec(s))!=null;)s=s.slice(0,i.index)+"++"+s.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let o;for(;(i=this.tokenizer.rules.inline.blockSkip.exec(s))!=null;)o=i[2]?i[2].length:0,s=s.slice(0,i.index+o)+"["+"a".repeat(i[0].length-o-2)+"]"+s.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);s=this.options.hooks?.emStrongMask?.call({lexer:this},s)??s;let a=!1,l="";for(;t;){a||(l=""),a=!1;let c;if(this.options.extensions?.inline?.some(p=>(c=p.call({lexer:this},t,n))?(t=t.substring(c.raw.length),n.push(c),!0):!1))continue;if(c=this.tokenizer.escape(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.tag(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.link(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.reflink(t,this.tokens.links)){t=t.substring(c.raw.length);let p=n.at(-1);c.type==="text"&&p?.type==="text"?(p.raw+=c.raw,p.text+=c.text):n.push(c);continue}if(c=this.tokenizer.emStrong(t,s,l)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.codespan(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.br(t)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.del(t,s,l)){t=t.substring(c.raw.length),n.push(c);continue}if(c=this.tokenizer.autolink(t)){t=t.substring(c.raw.length),n.push(c);continue}if(!this.state.inLink&&(c=this.tokenizer.url(t))){t=t.substring(c.raw.length),n.push(c);continue}let g=t;if(this.options.extensions?.startInline){let p=1/0,u=t.slice(1),h;this.options.extensions.startInline.forEach(f=>{h=f.call({lexer:this},u),typeof h=="number"&&h>=0&&(p=Math.min(p,h))}),p<1/0&&p>=0&&(g=t.substring(0,p+1))}if(c=this.tokenizer.inlineText(g)){t=t.substring(c.raw.length),c.raw.slice(-1)!=="_"&&(l=c.raw.slice(-1)),a=!0;let p=n.at(-1);p?.type==="text"?(p.raw+=c.raw,p.text+=c.text):n.push(c);continue}if(t){let p="Infinite loop on byte: "+t.charCodeAt(0);if(this.options.silent){console.error(p);break}else throw new Error(p)}}return n}},es=class{options;parser;constructor(e){this.options=e||Ct}space(e){return""}code({text:e,lang:t,escaped:n}){let s=(t||"").match(ve.notSpaceStart)?.[0],i=e.replace(ve.endingNewline,"")+`
`;return s?'<pre><code class="language-'+Fe(s)+'">'+(n?i:Fe(i,!0))+`</code></pre>
`:"<pre><code>"+(n?i:Fe(i,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return""}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,n=e.start,s="";for(let a=0;a<e.items.length;a++){let l=e.items[a];s+=this.listitem(l)}let i=t?"ol":"ul",o=t&&n!==1?' start="'+n+'"':"";return"<"+i+o+`>
`+s+"</"+i+`>
`}listitem(e){return`<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",n="";for(let i=0;i<e.header.length;i++)n+=this.tablecell(e.header[i]);t+=this.tablerow({text:n});let s="";for(let i=0;i<e.rows.length;i++){let o=e.rows[i];n="";for(let a=0;a<o.length;a++)n+=this.tablecell(o[a]);s+=this.tablerow({text:n})}return s&&(s=`<tbody>${s}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+s+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),n=e.header?"th":"td";return(e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${Fe(e,!0)}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:n}){let s=this.parser.parseInline(n),i=sr(e);if(i===null)return s;e=i;let o='<a href="'+e+'"';return t&&(o+=' title="'+Fe(t)+'"'),o+=">"+s+"</a>",o}image({href:e,title:t,text:n,tokens:s}){s&&(n=this.parser.parseInline(s,this.parser.textRenderer));let i=sr(e);if(i===null)return Fe(n);e=i;let o=`<img src="${e}" alt="${Fe(n)}"`;return t&&(o+=` title="${Fe(t)}"`),o+=">",o}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:Fe(e.text)}},Ao=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}checkbox({raw:e}){return e}},Le=class Mi{options;renderer;textRenderer;constructor(t){this.options=t||Ct,this.options.renderer=this.options.renderer||new es,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new Ao}static parse(t,n){return new Mi(n).parse(t)}static parseInline(t,n){return new Mi(n).parseInline(t)}parse(t){let n="";for(let s=0;s<t.length;s++){let i=t[s];if(this.options.extensions?.renderers?.[i.type]){let a=i,l=this.options.extensions.renderers[a.type].call({parser:this},a);if(l!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(a.type)){n+=l||"";continue}}let o=i;switch(o.type){case"space":{n+=this.renderer.space(o);break}case"hr":{n+=this.renderer.hr(o);break}case"heading":{n+=this.renderer.heading(o);break}case"code":{n+=this.renderer.code(o);break}case"table":{n+=this.renderer.table(o);break}case"blockquote":{n+=this.renderer.blockquote(o);break}case"list":{n+=this.renderer.list(o);break}case"checkbox":{n+=this.renderer.checkbox(o);break}case"html":{n+=this.renderer.html(o);break}case"def":{n+=this.renderer.def(o);break}case"paragraph":{n+=this.renderer.paragraph(o);break}case"text":{n+=this.renderer.text(o);break}default:{let a='Token with "'+o.type+'" type was not found.';if(this.options.silent)return console.error(a),"";throw new Error(a)}}}return n}parseInline(t,n=this.renderer){let s="";for(let i=0;i<t.length;i++){let o=t[i];if(this.options.extensions?.renderers?.[o.type]){let l=this.options.extensions.renderers[o.type].call({parser:this},o);if(l!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(o.type)){s+=l||"";continue}}let a=o;switch(a.type){case"escape":{s+=n.text(a);break}case"html":{s+=n.html(a);break}case"link":{s+=n.link(a);break}case"image":{s+=n.image(a);break}case"checkbox":{s+=n.checkbox(a);break}case"strong":{s+=n.strong(a);break}case"em":{s+=n.em(a);break}case"codespan":{s+=n.codespan(a);break}case"br":{s+=n.br(a);break}case"del":{s+=n.del(a);break}case"text":{s+=n.text(a);break}default:{let l='Token with "'+a.type+'" type was not found.';if(this.options.silent)return console.error(l),"";throw new Error(l)}}}return s}},Jt=class{options;block;constructor(e){this.options=e||Ct}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens","emStrongMask"]);static passThroughHooksRespectAsync=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(){return this.block?Ee.lex:Ee.lexInline}provideParser(){return this.block?Le.parse:Le.parseInline}},Em=class{defaults=bo();options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=Le;Renderer=es;TextRenderer=Ao;Lexer=Ee;Tokenizer=Xn;Hooks=Jt;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(let s of e)switch(n=n.concat(t.call(this,s)),s.type){case"table":{let i=s;for(let o of i.header)n=n.concat(this.walkTokens(o.tokens,t));for(let o of i.rows)for(let a of o)n=n.concat(this.walkTokens(a.tokens,t));break}case"list":{let i=s;n=n.concat(this.walkTokens(i.items,t));break}default:{let i=s;this.defaults.extensions?.childTokens?.[i.type]?this.defaults.extensions.childTokens[i.type].forEach(o=>{let a=i[o].flat(1/0);n=n.concat(this.walkTokens(a,t))}):i.tokens&&(n=n.concat(this.walkTokens(i.tokens,t)))}}return n}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(n=>{let s={...n};if(s.async=this.defaults.async||s.async||!1,n.extensions&&(n.extensions.forEach(i=>{if(!i.name)throw new Error("extension name required");if("renderer"in i){let o=t.renderers[i.name];o?t.renderers[i.name]=function(...a){let l=i.renderer.apply(this,a);return l===!1&&(l=o.apply(this,a)),l}:t.renderers[i.name]=i.renderer}if("tokenizer"in i){if(!i.level||i.level!=="block"&&i.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let o=t[i.level];o?o.unshift(i.tokenizer):t[i.level]=[i.tokenizer],i.start&&(i.level==="block"?t.startBlock?t.startBlock.push(i.start):t.startBlock=[i.start]:i.level==="inline"&&(t.startInline?t.startInline.push(i.start):t.startInline=[i.start]))}"childTokens"in i&&i.childTokens&&(t.childTokens[i.name]=i.childTokens)}),s.extensions=t),n.renderer){let i=this.defaults.renderer||new es(this.defaults);for(let o in n.renderer){if(!(o in i))throw new Error(`renderer '${o}' does not exist`);if(["options","parser"].includes(o))continue;let a=o,l=n.renderer[a],c=i[a];i[a]=(...g)=>{let p=l.apply(i,g);return p===!1&&(p=c.apply(i,g)),p||""}}s.renderer=i}if(n.tokenizer){let i=this.defaults.tokenizer||new Xn(this.defaults);for(let o in n.tokenizer){if(!(o in i))throw new Error(`tokenizer '${o}' does not exist`);if(["options","rules","lexer"].includes(o))continue;let a=o,l=n.tokenizer[a],c=i[a];i[a]=(...g)=>{let p=l.apply(i,g);return p===!1&&(p=c.apply(i,g)),p}}s.tokenizer=i}if(n.hooks){let i=this.defaults.hooks||new Jt;for(let o in n.hooks){if(!(o in i))throw new Error(`hook '${o}' does not exist`);if(["options","block"].includes(o))continue;let a=o,l=n.hooks[a],c=i[a];Jt.passThroughHooks.has(o)?i[a]=g=>{if(this.defaults.async&&Jt.passThroughHooksRespectAsync.has(o))return(async()=>{let u=await l.call(i,g);return c.call(i,u)})();let p=l.call(i,g);return c.call(i,p)}:i[a]=(...g)=>{if(this.defaults.async)return(async()=>{let u=await l.apply(i,g);return u===!1&&(u=await c.apply(i,g)),u})();let p=l.apply(i,g);return p===!1&&(p=c.apply(i,g)),p}}s.hooks=i}if(n.walkTokens){let i=this.defaults.walkTokens,o=n.walkTokens;s.walkTokens=function(a){let l=[];return l.push(o.call(this,a)),i&&(l=l.concat(i.call(this,a))),l}}this.defaults={...this.defaults,...s}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return Ee.lex(e,t??this.defaults)}parser(e,t){return Le.parse(e,t??this.defaults)}parseMarkdown(e){return(t,n)=>{let s={...n},i={...this.defaults,...s},o=this.onError(!!i.silent,!!i.async);if(this.defaults.async===!0&&s.async===!1)return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof t>"u"||t===null)return o(new Error("marked(): input parameter is undefined or null"));if(typeof t!="string")return o(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(t)+", string expected"));if(i.hooks&&(i.hooks.options=i,i.hooks.block=e),i.async)return(async()=>{let a=i.hooks?await i.hooks.preprocess(t):t,l=await(i.hooks?await i.hooks.provideLexer():e?Ee.lex:Ee.lexInline)(a,i),c=i.hooks?await i.hooks.processAllTokens(l):l;i.walkTokens&&await Promise.all(this.walkTokens(c,i.walkTokens));let g=await(i.hooks?await i.hooks.provideParser():e?Le.parse:Le.parseInline)(c,i);return i.hooks?await i.hooks.postprocess(g):g})().catch(o);try{i.hooks&&(t=i.hooks.preprocess(t));let a=(i.hooks?i.hooks.provideLexer():e?Ee.lex:Ee.lexInline)(t,i);i.hooks&&(a=i.hooks.processAllTokens(a)),i.walkTokens&&this.walkTokens(a,i.walkTokens);let l=(i.hooks?i.hooks.provideParser():e?Le.parse:Le.parseInline)(a,i);return i.hooks&&(l=i.hooks.postprocess(l)),l}catch(a){return o(a)}}}onError(e,t){return n=>{if(n.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let s="<p>An error occurred:</p><pre>"+Fe(n.message+"",!0)+"</pre>";return t?Promise.resolve(s):s}if(t)return Promise.reject(n);throw n}}},St=new Em;function Q(e,t){return St.parse(e,t)}Q.options=Q.setOptions=function(e){return St.setOptions(e),Q.defaults=St.defaults,sc(Q.defaults),Q};Q.getDefaults=bo;Q.defaults=Ct;Q.use=function(...e){return St.use(...e),Q.defaults=St.defaults,sc(Q.defaults),Q};Q.walkTokens=function(e,t){return St.walkTokens(e,t)};Q.parseInline=St.parseInline;Q.Parser=Le;Q.parser=Le.parse;Q.Renderer=es;Q.TextRenderer=Ao;Q.Lexer=Ee;Q.lexer=Ee.lex;Q.Tokenizer=Xn;Q.Hooks=Jt;Q.parse=Q;Q.options;Q.setOptions;Q.use;Q.walkTokens;Q.parseInline;Le.parse;Ee.lex;Q.setOptions({gfm:!0,breaks:!0});const ar=["a","b","blockquote","br","code","del","em","h1","h2","h3","h4","hr","i","li","ol","p","pre","strong","table","tbody","td","th","thead","tr","ul"],rr=["class","href","rel","target","title","start"];let lr=!1;const Lm=14e4,Im=4e4,Mm=200,si=5e4,mt=new Map;function Rm(e){const t=mt.get(e);return t===void 0?null:(mt.delete(e),mt.set(e,t),t)}function cr(e,t){if(mt.set(e,t),mt.size<=Mm)return;const n=mt.keys().next().value;n&&mt.delete(n)}function Pm(){lr||(lr=!0,Ei.addHook("afterSanitizeAttributes",e=>{!(e instanceof HTMLAnchorElement)||!e.getAttribute("href")||(e.setAttribute("rel","noreferrer noopener"),e.setAttribute("target","_blank"))}))}function Ri(e){const t=e.trim();if(!t)return"";if(Pm(),t.length<=si){const a=Rm(t);if(a!==null)return a}const n=Jr(t,Lm),s=n.truncated?`

… truncated (${n.total} chars, showing first ${n.text.length}).`:"";if(n.text.length>Im){const l=`<pre class="code-block">${Dm(`${n.text}${s}`)}</pre>`,c=Ei.sanitize(l,{ALLOWED_TAGS:ar,ALLOWED_ATTR:rr});return t.length<=si&&cr(t,c),c}const i=Q.parse(`${n.text}${s}`),o=Ei.sanitize(i,{ALLOWED_TAGS:ar,ALLOWED_ATTR:rr});return t.length<=si&&cr(t,o),o}function Dm(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}const Fm=1500,Nm=2e3,fc="Copy as markdown",Om="Copied",Bm="Copy failed";async function Um(e){if(!e)return!1;try{return await navigator.clipboard.writeText(e),!0}catch{return!1}}function In(e,t){e.title=t,e.setAttribute("aria-label",t)}function zm(e){const t=e.label??fc;return r`
    <button
      class="chat-copy-btn"
      type="button"
      title=${t}
      aria-label=${t}
      @click=${async n=>{const s=n.currentTarget;if(!s||s.dataset.copying==="1")return;s.dataset.copying="1",s.setAttribute("aria-busy","true"),s.disabled=!0;const i=await Um(e.text());if(s.isConnected){if(delete s.dataset.copying,s.removeAttribute("aria-busy"),s.disabled=!1,!i){s.dataset.error="1",In(s,Bm),window.setTimeout(()=>{s.isConnected&&(delete s.dataset.error,In(s,t))},Nm);return}s.dataset.copied="1",In(s,Om),window.setTimeout(()=>{s.isConnected&&(delete s.dataset.copied,In(s,t))},Fm)}}}
    >
      <span class="chat-copy-btn__icon" aria-hidden="true">
        <span class="chat-copy-btn__icon-copy">${le.copy}</span>
        <span class="chat-copy-btn__icon-check">${le.check}</span>
      </span>
    </button>
  `}function Hm(e){return zm({text:()=>e,label:fc})}function mc(e){const t=e;let n=typeof t.role=="string"?t.role:"unknown";const s=typeof t.toolCallId=="string"||typeof t.tool_call_id=="string",i=t.content,o=Array.isArray(i)?i:null,a=Array.isArray(o)&&o.some(u=>{const h=u,f=(typeof h.type=="string"?h.type:"").toLowerCase();return f==="toolresult"||f==="tool_result"}),l=typeof t.toolName=="string"||typeof t.tool_name=="string";(s||a||l)&&(n="toolResult");let c=[];typeof t.content=="string"?c=[{type:"text",text:t.content}]:Array.isArray(t.content)?c=t.content.map(u=>({type:u.type||"text",text:u.text,name:u.name,args:u.args||u.arguments})):typeof t.text=="string"&&(c=[{type:"text",text:t.text}]);const g=typeof t.timestamp=="number"?t.timestamp:Date.now(),p=typeof t.id=="string"?t.id:void 0;return{role:n,content:c,timestamp:g,id:p}}function To(e){const t=e.toLowerCase();return e==="user"||e==="User"?e:e==="assistant"?"assistant":e==="system"?"system":t==="toolresult"||t==="tool_result"||t==="tool"||t==="function"?"tool":e}function vc(e){const t=e,n=typeof t.role=="string"?t.role.toLowerCase():"";return n==="toolresult"||n==="tool_result"}const jm={icon:"puzzle",detailKeys:["command","path","url","targetUrl","targetId","ref","element","node","nodeId","id","requestId","to","channelId","guildId","userId","name","query","pattern","messageId"]},Km={bash:{icon:"wrench",title:"Bash",detailKeys:["command"]},process:{icon:"wrench",title:"Process",detailKeys:["sessionId"]},read:{icon:"fileText",title:"Read",detailKeys:["path"]},write:{icon:"edit",title:"Write",detailKeys:["path"]},edit:{icon:"penLine",title:"Edit",detailKeys:["path"]},attach:{icon:"paperclip",title:"Attach",detailKeys:["path","url","fileName"]},browser:{icon:"globe",title:"Browser",actions:{status:{label:"status"},start:{label:"start"},stop:{label:"stop"},tabs:{label:"tabs"},open:{label:"open",detailKeys:["targetUrl"]},focus:{label:"focus",detailKeys:["targetId"]},close:{label:"close",detailKeys:["targetId"]},snapshot:{label:"snapshot",detailKeys:["targetUrl","targetId","ref","element","format"]},screenshot:{label:"screenshot",detailKeys:["targetUrl","targetId","ref","element"]},navigate:{label:"navigate",detailKeys:["targetUrl","targetId"]},console:{label:"console",detailKeys:["level","targetId"]},pdf:{label:"pdf",detailKeys:["targetId"]},upload:{label:"upload",detailKeys:["paths","ref","inputRef","element","targetId"]},dialog:{label:"dialog",detailKeys:["accept","promptText","targetId"]},act:{label:"act",detailKeys:["request.kind","request.ref","request.selector","request.text","request.value"]}}},canvas:{icon:"image",title:"Canvas",actions:{present:{label:"present",detailKeys:["target","node","nodeId"]},hide:{label:"hide",detailKeys:["node","nodeId"]},navigate:{label:"navigate",detailKeys:["url","node","nodeId"]},eval:{label:"eval",detailKeys:["javaScript","node","nodeId"]},snapshot:{label:"snapshot",detailKeys:["format","node","nodeId"]},a2ui_push:{label:"A2UI push",detailKeys:["jsonlPath","node","nodeId"]},a2ui_reset:{label:"A2UI reset",detailKeys:["node","nodeId"]}}},nodes:{icon:"smartphone",title:"Nodes",actions:{status:{label:"status"},describe:{label:"describe",detailKeys:["node","nodeId"]},pending:{label:"pending"},approve:{label:"approve",detailKeys:["requestId"]},reject:{label:"reject",detailKeys:["requestId"]},notify:{label:"notify",detailKeys:["node","nodeId","title","body"]},camera_snap:{label:"camera snap",detailKeys:["node","nodeId","facing","deviceId"]},camera_list:{label:"camera list",detailKeys:["node","nodeId"]},camera_clip:{label:"camera clip",detailKeys:["node","nodeId","facing","duration","durationMs"]},screen_record:{label:"screen record",detailKeys:["node","nodeId","duration","durationMs","fps","screenIndex"]}}},cron:{icon:"loader",title:"Cron",actions:{status:{label:"status"},list:{label:"list"},add:{label:"add",detailKeys:["job.name","job.id","job.schedule","job.cron"]},update:{label:"update",detailKeys:["id"]},remove:{label:"remove",detailKeys:["id"]},run:{label:"run",detailKeys:["id"]},runs:{label:"runs",detailKeys:["id"]},wake:{label:"wake",detailKeys:["text","mode"]}}},gateway:{icon:"plug",title:"Gateway",actions:{restart:{label:"restart",detailKeys:["reason","delayMs"]},"config.get":{label:"config get"},"config.schema":{label:"config schema"},"config.apply":{label:"config apply",detailKeys:["restartDelayMs"]},"update.run":{label:"update run",detailKeys:["restartDelayMs"]}}},whatsapp_login:{icon:"circle",title:"WhatsApp Login",actions:{start:{label:"start"},wait:{label:"wait"}}},discord:{icon:"messageSquare",title:"Discord",actions:{react:{label:"react",detailKeys:["channelId","messageId","emoji"]},reactions:{label:"reactions",detailKeys:["channelId","messageId"]},sticker:{label:"sticker",detailKeys:["to","stickerIds"]},poll:{label:"poll",detailKeys:["question","to"]},permissions:{label:"permissions",detailKeys:["channelId"]},readMessages:{label:"read messages",detailKeys:["channelId","limit"]},sendMessage:{label:"send",detailKeys:["to","content"]},editMessage:{label:"edit",detailKeys:["channelId","messageId"]},deleteMessage:{label:"delete",detailKeys:["channelId","messageId"]},threadCreate:{label:"thread create",detailKeys:["channelId","name"]},threadList:{label:"thread list",detailKeys:["guildId","channelId"]},threadReply:{label:"thread reply",detailKeys:["channelId","content"]},pinMessage:{label:"pin",detailKeys:["channelId","messageId"]},unpinMessage:{label:"unpin",detailKeys:["channelId","messageId"]},listPins:{label:"list pins",detailKeys:["channelId"]},searchMessages:{label:"search",detailKeys:["guildId","content"]},memberInfo:{label:"member",detailKeys:["guildId","userId"]},roleInfo:{label:"roles",detailKeys:["guildId"]},emojiList:{label:"emoji list",detailKeys:["guildId"]},roleAdd:{label:"role add",detailKeys:["guildId","userId","roleId"]},roleRemove:{label:"role remove",detailKeys:["guildId","userId","roleId"]},channelInfo:{label:"channel",detailKeys:["channelId"]},channelList:{label:"channels",detailKeys:["guildId"]},voiceStatus:{label:"voice",detailKeys:["guildId","userId"]},eventList:{label:"events",detailKeys:["guildId"]},eventCreate:{label:"event create",detailKeys:["guildId","name"]},timeout:{label:"timeout",detailKeys:["guildId","userId"]},kick:{label:"kick",detailKeys:["guildId","userId"]},ban:{label:"ban",detailKeys:["guildId","userId"]}}},slack:{icon:"messageSquare",title:"Slack",actions:{react:{label:"react",detailKeys:["channelId","messageId","emoji"]},reactions:{label:"reactions",detailKeys:["channelId","messageId"]},sendMessage:{label:"send",detailKeys:["to","content"]},editMessage:{label:"edit",detailKeys:["channelId","messageId"]},deleteMessage:{label:"delete",detailKeys:["channelId","messageId"]},readMessages:{label:"read messages",detailKeys:["channelId","limit"]},pinMessage:{label:"pin",detailKeys:["channelId","messageId"]},unpinMessage:{label:"unpin",detailKeys:["channelId","messageId"]},listPins:{label:"list pins",detailKeys:["channelId"]},memberInfo:{label:"member",detailKeys:["userId"]},emojiList:{label:"emoji list"}}}},Wm={fallback:jm,tools:Km},bc=Wm,dr=bc.fallback??{icon:"puzzle"},Vm=bc.tools??{};function qm(e){return(e??"tool").trim()}function Gm(e){const t=e.replace(/_/g," ").trim();return t?t.split(/\s+/).map(n=>n.length<=2&&n.toUpperCase()===n?n:`${n.at(0)?.toUpperCase()??""}${n.slice(1)}`).join(" "):"Tool"}function Qm(e){const t=e?.trim();if(t)return t.replace(/_/g," ")}function yc(e){if(e!=null){if(typeof e=="string"){const t=e.trim();if(!t)return;const n=t.split(/\r?\n/)[0]?.trim()??"";return n?n.length>160?`${n.slice(0,157)}…`:n:void 0}if(typeof e=="number"||typeof e=="boolean")return String(e);if(Array.isArray(e)){const t=e.map(s=>yc(s)).filter(s=>!!s);if(t.length===0)return;const n=t.slice(0,3).join(", ");return t.length>3?`${n}…`:n}}}function Ym(e,t){if(!e||typeof e!="object")return;let n=e;for(const s of t.split(".")){if(!s||!n||typeof n!="object")return;n=n[s]}return n}function Jm(e,t){for(const n of t){const s=Ym(e,n),i=yc(s);if(i)return i}}function Zm(e){if(!e||typeof e!="object")return;const t=e,n=typeof t.path=="string"?t.path:void 0;if(!n)return;const s=typeof t.offset=="number"?t.offset:void 0,i=typeof t.limit=="number"?t.limit:void 0;return s!==void 0&&i!==void 0?`${n}:${s}-${s+i}`:n}function Xm(e){if(!e||typeof e!="object")return;const t=e;return typeof t.path=="string"?t.path:void 0}function ev(e,t){if(!(!e||!t))return e.actions?.[t]??void 0}function tv(e){const t=qm(e.name),n=t.toLowerCase(),s=Vm[n],i=s?.icon??dr.icon??"puzzle",o=s?.title??Gm(t),a=s?.label??t,l=e.args&&typeof e.args=="object"?e.args.action:void 0,c=typeof l=="string"?l.trim():void 0,g=ev(s,c),p=Qm(g?.label??c);let u;n==="read"&&(u=Zm(e.args)),!u&&(n==="write"||n==="edit"||n==="attach")&&(u=Xm(e.args));const h=g?.detailKeys??s?.detailKeys??dr.detailKeys??[];return!u&&h.length>0&&(u=Jm(e.args,h)),!u&&e.meta&&(u=e.meta),u&&(u=sv(u)),{name:t,icon:i,title:o,label:a,verb:p,detail:u}}function nv(e){const t=[];if(e.verb&&t.push(e.verb),e.detail&&t.push(e.detail),t.length!==0)return t.join(" · ")}function sv(e){return e&&e.replace(/\/Users\/[^/]+/g,"~").replace(/\/home\/[^/]+/g,"~")}const iv=80,ov=2,ur=100;function av(e){const t=e.trim();if(t.startsWith("{")||t.startsWith("["))try{const n=JSON.parse(t);return"```json\n"+JSON.stringify(n,null,2)+"\n```"}catch{}return e}function rv(e){const t=e.split(`
`),n=t.slice(0,ov),s=n.join(`
`);return s.length>ur?s.slice(0,ur)+"…":n.length<t.length?s+"…":s}function lv(e){const t=e,n=cv(t.content),s=[];for(const i of n){const o=(typeof i.type=="string"?i.type:"").toLowerCase();(["toolcall","tool_call","tooluse","tool_use"].includes(o)||typeof i.name=="string"&&i.arguments!=null)&&s.push({kind:"call",name:i.name??"tool",args:dv(i.arguments??i.args)})}for(const i of n){const o=(typeof i.type=="string"?i.type:"").toLowerCase();if(o!=="toolresult"&&o!=="tool_result")continue;const a=uv(i),l=typeof i.name=="string"?i.name:"tool";s.push({kind:"result",name:l,text:a})}if(vc(e)&&!s.some(i=>i.kind==="result")){const i=typeof t.toolName=="string"&&t.toolName||typeof t.tool_name=="string"&&t.tool_name||"tool",o=Cl(e)??void 0;s.push({kind:"result",name:i,text:o})}return s}function gr(e,t){const n=tv({name:e.name,args:e.args}),s=nv(n),i=!!e.text?.trim(),o=!!t,a=o?()=>{if(i){t(av(e.text));return}const u=`## ${n.label}

${s?`**Command:** \`${s}\`

`:""}*No output — tool completed successfully.*`;t(u)}:void 0,l=i&&(e.text?.length??0)<=iv,c=i&&!l,g=i&&l,p=!i;return r`
    <div
      class="chat-tool-card ${o?"chat-tool-card--clickable":""}"
      @click=${a}
      role=${o?"button":v}
      tabindex=${o?"0":v}
      @keydown=${o?u=>{u.key!=="Enter"&&u.key!==" "||(u.preventDefault(),a?.())}:v}
    >
      <div class="chat-tool-card__header">
        <div class="chat-tool-card__title">
          <span class="chat-tool-card__icon">${le[n.icon]}</span>
          <span>${n.label}</span>
        </div>
        ${o?r`<span class="chat-tool-card__action">${i?"View":""} ${le.check}</span>`:v}
        ${p&&!o?r`<span class="chat-tool-card__status">${le.check}</span>`:v}
      </div>
      ${s?r`<div class="chat-tool-card__detail">${s}</div>`:v}
      ${p?r`
              <div class="chat-tool-card__status-text muted">Completed</div>
            `:v}
      ${c?r`<div class="chat-tool-card__preview mono">${rv(e.text)}</div>`:v}
      ${g?r`<div class="chat-tool-card__inline mono">${e.text}</div>`:v}
    </div>
  `}function cv(e){return Array.isArray(e)?e.filter(Boolean):[]}function dv(e){if(typeof e!="string")return e;const t=e.trim();if(!t||!t.startsWith("{")&&!t.startsWith("["))return e;try{return JSON.parse(t)}catch{return e}}function uv(e){if(typeof e.text=="string")return e.text;if(typeof e.content=="string")return e.content}function gv(e){const n=e.content,s=[];if(Array.isArray(n))for(const i of n){if(typeof i!="object"||i===null)continue;const o=i;if(o.type==="image"){const a=o.source;if(a?.type==="base64"&&typeof a.data=="string"){const l=a.data,c=a.media_type||"image/png",g=l.startsWith("data:")?l:`data:${c};base64,${l}`;s.push({url:g})}else typeof o.url=="string"&&s.push({url:o.url})}else if(o.type==="image_url"){const a=o.image_url;typeof a?.url=="string"&&s.push({url:a.url})}}return s}function pv(e){return r`
    <div class="chat-group assistant">
      ${_o("assistant",e)}
      <div class="chat-group-messages">
        <div class="chat-bubble chat-reading-indicator" aria-hidden="true">
          <span class="chat-reading-indicator__dots">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    </div>
  `}function hv(e,t,n,s){const i=new Date(t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}),o=s?.name??"Assistant";return r`
    <div class="chat-group assistant">
      ${_o("assistant",s)}
      <div class="chat-group-messages">
        ${xc({role:"assistant",content:[{type:"text",text:e}],timestamp:t},{isStreaming:!0,showReasoning:!1},n)}
        <div class="chat-group-footer">
          <span class="chat-sender-name">${o}</span>
          <span class="chat-group-timestamp">${i}</span>
        </div>
      </div>
    </div>
  `}function fv(e,t){const n=To(e.role),s=t.assistantName??"Assistant",i=n==="user"?"You":n==="assistant"?s:n,o=n==="user"?"user":n==="assistant"?"assistant":"other",a=new Date(e.timestamp).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});return r`
    <div class="chat-group ${o}">
      ${_o(e.role,{name:s,avatar:t.assistantAvatar??null})}
      <div class="chat-group-messages">
        ${e.messages.map((l,c)=>xc(l.message,{isStreaming:e.isStreaming&&c===e.messages.length-1,showReasoning:t.showReasoning},t.onOpenSidebar))}
        <div class="chat-group-footer">
          <span class="chat-sender-name">${i}</span>
          <span class="chat-group-timestamp">${a}</span>
        </div>
      </div>
    </div>
  `}function _o(e,t){const n=To(e),s=t?.name?.trim()||"Assistant",i=t?.avatar?.trim()||"",o=n==="user"?"U":n==="assistant"?s.charAt(0).toUpperCase()||"A":n==="tool"?"⚙":"?",a=n==="user"?"user":n==="assistant"?"assistant":n==="tool"?"tool":"other";return n==="assistant"?i&&mv(i)?r`<img
        class="chat-avatar ${a}"
        src="${i}"
        alt="${s}"
      />`:r`<div class="chat-avatar ${a}">${le.bot}</div>`:r`<div class="chat-avatar ${a}">${o}</div>`}function mv(e){return/^https?:\/\//i.test(e)||/^data:image\//i.test(e)||e.startsWith("/")}function vv(e){return e.length===0?v:r`
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
  `}function xc(e,t,n){const s=e,i=typeof s.role=="string"?s.role:"unknown",o=vc(e)||i.toLowerCase()==="toolresult"||i.toLowerCase()==="tool_result"||typeof s.toolCallId=="string"||typeof s.tool_call_id=="string",a=lv(e),l=a.length>0,c=gv(e),g=c.length>0;if(!!s._synthetic&&o)return v;const u=Cl(e),h=t.showReasoning&&i==="assistant"?_g(e):null,f=u?.trim()?u:null,d=h?Lg(h):null,m=f,k=i==="assistant"&&!!m?.trim(),S=["chat-bubble",k?"has-copy":"",t.isStreaming?"streaming":"","fade-in"].filter(Boolean).join(" ");return!m&&l&&o?r`${a.map($=>gr($,n))}`:!m&&!l&&!g?v:r`
    <div class="${S}">
      ${k?Hm(m):v}
      ${vv(c)}
      ${d?r`<div class="chat-thinking">${Ci(Ri(d))}</div>`:v}
      ${m?r`<div class="chat-text">${Ci(Ri(m))}</div>`:v}
      ${a.map($=>gr($,n))}
    </div>
  `}const pr=2e3;function bv(e){const t=new Date(e),n=String(t.getHours()).padStart(2,"0"),s=String(t.getMinutes()).padStart(2,"0"),i=String(t.getSeconds()).padStart(2,"0");return`${n}:${s}:${i}`}function yv(e){const t=e.stream==="stderr"?"exec-log__line--stderr":e.stream==="system"?"exec-log__line--system":"",n=e.text.split(`
`),s=bv(e.ts);return n.map((i,o)=>r`
      <div class="exec-log__line ${t}">
        ${o===0?r`<span class="exec-log__timestamp">${s}</span>`:r`
                <span class="exec-log__timestamp-pad"></span>
              `}
        <span class="exec-log__text">${i||" "}</span>
      </div>
    `)}function xv(e){const t=e.entries.length>pr?e.entries.slice(-pr):e.entries,n=t.reduce((s,i)=>s+i.text.split(`
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
            ${le.x}
          </button>
        </div>
      </div>

      <div
        class="exec-log__body"
        ${fo(s=>{s&&e.autoScroll&&t.length>0&&requestAnimationFrame(()=>{s.scrollTop=s.scrollHeight})})}
      >
        ${t.length===0?r`
                <div class="exec-log__empty">Waiting for execution output…</div>
              `:t.map(s=>yv(s))}
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
  `}function wv(e){return r`
    <div class="sidebar-panel">
      <div class="sidebar-header">
        <div class="sidebar-title">Tool Output</div>
        <button @click=${e.onClose} class="btn" title="Close sidebar">
          ${le.x}
        </button>
      </div>
      <div class="sidebar-content">
        ${e.error?r`
              <div class="callout danger">${e.error}</div>
              <button @click=${e.onViewRawText} class="btn" style="margin-top: 12px;">
                View Raw Text
              </button>
            `:e.content?r`<div class="sidebar-markdown">${Ci(Ri(e.content))}</div>`:r`
                  <div class="muted">No content available</div>
                `}
      </div>
    </div>
  `}var $v=Object.defineProperty,kv=Object.getOwnPropertyDescriptor,ws=(e,t,n,s)=>{for(var i=s>1?void 0:s?kv(t,n):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(i=(s?a(t,n,i):a(i))||i);return s&&i&&$v(t,n,i),i};let Ot=class extends Pt{constructor(){super(...arguments),this.splitRatio=.6,this.minRatio=.4,this.maxRatio=.7,this.isDragging=!1,this.startX=0,this.startRatio=0,this.handleMouseDown=e=>{this.isDragging=!0,this.startX=e.clientX,this.startRatio=this.splitRatio,this.classList.add("dragging"),document.addEventListener("mousemove",this.handleMouseMove),document.addEventListener("mouseup",this.handleMouseUp),e.preventDefault()},this.handleMouseMove=e=>{if(!this.isDragging)return;const t=this.parentElement;if(!t)return;const n=t.getBoundingClientRect().width,i=(e.clientX-this.startX)/n;let o=this.startRatio+i;o=Math.max(this.minRatio,Math.min(this.maxRatio,o)),this.dispatchEvent(new CustomEvent("resize",{detail:{splitRatio:o},bubbles:!0,composed:!0}))},this.handleMouseUp=()=>{this.isDragging=!1,this.classList.remove("dragging"),document.removeEventListener("mousemove",this.handleMouseMove),document.removeEventListener("mouseup",this.handleMouseUp)}}render(){return v}connectedCallback(){super.connectedCallback(),this.addEventListener("mousedown",this.handleMouseDown)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("mousedown",this.handleMouseDown),document.removeEventListener("mousemove",this.handleMouseMove),document.removeEventListener("mouseup",this.handleMouseUp)}};Ot.styles=Wc`
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
  `;ws([as({type:Number})],Ot.prototype,"splitRatio",2);ws([as({type:Number})],Ot.prototype,"minRatio",2);ws([as({type:Number})],Ot.prototype,"maxRatio",2);Ot=ws([Hr("resizable-divider")],Ot);const Sv=5e3;function hr(e){e.style.height="auto",e.style.height=`${e.scrollHeight}px`}function Cv(e){return e?e.active?r`
      <div class="compaction-indicator compaction-indicator--active" role="status" aria-live="polite">
        ${le.loader} Compacting context...
      </div>
    `:e.completedAt&&Date.now()-e.completedAt<Sv?r`
        <div class="compaction-indicator compaction-indicator--complete" role="status" aria-live="polite">
          ${le.check} Context compacted
        </div>
      `:v:v}function Av(){return`att-${Date.now()}-${Math.random().toString(36).slice(2,9)}`}function Tv(e,t){const n=e.clipboardData?.items;if(!n||!t.onAttachmentsChange)return;const s=[];for(let i=0;i<n.length;i++){const o=n[i];o.type.startsWith("image/")&&s.push(o)}if(s.length!==0){e.preventDefault();for(const i of s){const o=i.getAsFile();if(!o)continue;const a=new FileReader;a.addEventListener("load",()=>{const l=a.result,c={id:Av(),dataUrl:l,mimeType:o.type},g=t.attachments??[];t.onAttachmentsChange?.([...g,c])}),a.readAsDataURL(o)}}}function _v(e){const t=e.attachments??[];return t.length===0?v:r`
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
              ${le.x}
            </button>
          </div>
        `)}
    </div>
  `}function wc(e){const t=e.connected,n=e.sending||e.stream!==null,s=!!(e.canAbort&&e.onAbort),o=e.sessions?.sessions?.find(m=>m.key===e.sessionKey)?.reasoningLevel??"off",a=e.showThinking&&o!=="off",l={name:e.assistantName,avatar:e.assistantAvatar??e.assistantAvatarUrl??null},c=(e.attachments?.length??0)>0,g=e.connected?c?"Add a message or paste more images...":"Message (↩ to send, Shift+↩ for line breaks, paste images)":"Connect to the gateway to start chatting…",p=e.splitRatio??.6,u=e.sidebarMode??(e.sidebarOpen?"markdown":null),h=!!(u&&e.sidebarOpen),f=(e.execLogEntries?.length??0)>0,d=r`
    <div
      class="chat-thread"
      role="log"
      aria-live="polite"
      @scroll=${e.onChatScroll}
    >
      ${e.loading?r`
              <div class="muted">Loading chat…</div>
            `:v}
      ${vt(Lv(e),m=>m.key,m=>m.kind==="divider"?r`
              <div class="chat-divider" role="separator" data-ts=${String(m.timestamp)}>
                <span class="chat-divider__line"></span>
                <span class="chat-divider__label">${m.label}</span>
                <span class="chat-divider__line"></span>
              </div>
            `:m.kind==="reading-indicator"?pv(l):m.kind==="stream"?hv(m.text,m.startedAt,e.onOpenSidebar,l):m.kind==="group"?fv(m,{onOpenSidebar:e.onOpenSidebar,showReasoning:a,assistantName:e.assistantName,assistantAvatar:l.avatar}):v)}
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
              ${le.x}
            </button>
          `:v}

      <div
        class="chat-split-container ${h?"chat-split-container--open":""}"
      >
        <div
          class="chat-main"
          style="flex: ${h?`0 0 ${p*100}%`:"1 1 100%"}"
        >
          ${d}
        </div>

        ${h?r`
              <resizable-divider
                .splitRatio=${p}
                @resize=${m=>e.onSplitRatioChange?.(m.detail.splitRatio)}
              ></resizable-divider>
              <div class="chat-sidebar">
                ${u==="exec-log"?xv({entries:e.execLogEntries??[],isActive:e.execLogActive??!1,autoScroll:e.execLogAutoScroll??!0,onClose:()=>e.onCloseExecLog?.(),onClear:()=>e.onClearExecLog?.(),onToggleAutoScroll:()=>e.onToggleExecLogAutoScroll?.()}):wv({content:e.sidebarContent??null,error:e.sidebarError??null,onClose:e.onCloseSidebar,onViewRawText:()=>{!e.sidebarContent||!e.onOpenSidebar||e.onOpenSidebar(`\`\`\`
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
                        ${le.x}
                      </button>
                    </div>
                  `)}
              </div>
            </div>
          `:v}

      ${Cv(e.compactionStatus)}

      ${e.showNewMessages?r`
            <button
              class="btn chat-new-messages"
              type="button"
              @click=${e.onScrollToBottom}
            >
              New messages ${le.arrowDown}
            </button>
          `:v}

      <div class="chat-compose">
        ${_v(e)}
        <div class="chat-compose__row">
          <label class="field chat-compose__field">
            <span>Message</span>
            <textarea
              ${fo(m=>m&&hr(m))}
              .value=${e.draft}
              ?disabled=${!e.connected}
              @keydown=${m=>{m.key==="Enter"&&(m.isComposing||m.keyCode===229||m.shiftKey||e.connected&&(m.preventDefault(),t&&e.onSend()))}}
              @input=${m=>{const k=m.target;hr(k),e.onDraftChange(k.value)}}
              @paste=${m=>Tv(m,e)}
              placeholder=${g}
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
  `}const fr=200;function Ev(e){const t=[];let n=null;for(const s of e){if(s.kind!=="message"){n&&(t.push(n),n=null),t.push(s);continue}const i=mc(s.message),o=To(i.role),a=i.timestamp||Date.now();!n||n.role!==o?(n&&t.push(n),n={kind:"group",key:`group:${o}:${s.key}`,role:o,messages:[{message:s.message,key:s.key}],timestamp:a,isStreaming:!1}):n.messages.push({message:s.message,key:s.key})}return n&&t.push(n),t}function Lv(e){const t=[],n=Array.isArray(e.messages)?e.messages:[],s=Array.isArray(e.toolMessages)?e.toolMessages:[],i=Math.max(0,n.length-fr);i>0&&t.push({kind:"message",key:"chat:history:notice",message:{role:"system",content:`Showing last ${fr} messages (${i} hidden).`,timestamp:Date.now()}});for(let o=i;o<n.length;o++){const a=n[o],l=mc(a),g=a.__winclaw;if(g&&g.kind==="compaction"){t.push({kind:"divider",key:typeof g.id=="string"?`divider:compaction:${g.id}`:`divider:compaction:${l.timestamp}:${o}`,label:"Compaction",timestamp:l.timestamp??Date.now()});continue}!e.showThinking&&l.role.toLowerCase()==="toolresult"||t.push({kind:"message",key:mr(a,o),message:a})}if(e.showThinking)for(let o=0;o<s.length;o++)t.push({kind:"message",key:mr(s[o],o+n.length),message:s[o]});if(e.stream!==null){const o=`stream:${e.sessionKey}:${e.streamStartedAt??"live"}`;e.stream.trim().length>0?t.push({kind:"stream",key:o,text:e.stream,startedAt:e.streamStartedAt??Date.now()}):t.push({kind:"reading-indicator",key:o})}return Ev(t)}function mr(e,t){const n=e,s=typeof n.toolCallId=="string"?n.toolCallId:"";if(s)return`tool:${s}`;const i=typeof n.id=="string"?n.id:"";if(i)return`msg:${i}`;const o=typeof n.messageId=="string"?n.messageId:"";if(o)return`msg:${o}`;const a=typeof n.timestamp=="number"?n.timestamp:null,l=typeof n.role=="string"?n.role:"unknown";return a!=null?`msg:${l}:${a}:${t}`:`msg:${l}:${t}`}const Pi={all:r`
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
  `},vr=[{key:"env",label:"Environment"},{key:"update",label:"Updates"},{key:"agents",label:"Agents"},{key:"auth",label:"Authentication"},{key:"channels",label:"Channels"},{key:"messages",label:"Messages"},{key:"commands",label:"Commands"},{key:"hooks",label:"Hooks"},{key:"skills",label:"Skills"},{key:"tools",label:"Tools"},{key:"gateway",label:"Gateway"},{key:"wizard",label:"Setup Wizard"}],br="__all__";function yr(e){return Pi[e]??Pi.default}function Iv(e,t){const n=vo[e];return n||{label:t?.title??qe(e),description:t?.description??""}}function Mv(e){const{key:t,schema:n,uiHints:s}=e;if(!n||Oe(n)!=="object"||!n.properties)return[];const i=Object.entries(n.properties).map(([o,a])=>{const l=Ae([t,o],s),c=l?.label??a.title??qe(o),g=l?.help??a.description??"",p=l?.order??50;return{key:o,label:c,description:g,order:p}});return i.sort((o,a)=>o.order!==a.order?o.order-a.order:o.key.localeCompare(a.key)),i}function Rv(e,t){if(!e||!t)return[];const n=[];function s(i,o,a){if(i===o)return;if(typeof i!=typeof o){n.push({path:a,from:i,to:o});return}if(typeof i!="object"||i===null||o===null){i!==o&&n.push({path:a,from:i,to:o});return}if(Array.isArray(i)&&Array.isArray(o)){JSON.stringify(i)!==JSON.stringify(o)&&n.push({path:a,from:i,to:o});return}const l=i,c=o,g=new Set([...Object.keys(l),...Object.keys(c)]);for(const p of g)s(l[p],c[p],a?`${a}.${p}`:p)}return s(e,t,""),n}function xr(e,t=40){let n;try{n=JSON.stringify(e)??String(e)}catch{n=String(e)}return n.length<=t?n:n.slice(0,t-3)+"..."}function Pv(e){const t=e.valid==null?"unknown":e.valid?"valid":"invalid",n=Yl(e.schema),s=n.schema?n.unsupportedPaths.length>0:!1,i=n.schema?.properties??{},o=vr.filter(_=>_.key in i),a=new Set(vr.map(_=>_.key)),l=Object.keys(i).filter(_=>!a.has(_)).map(_=>({key:_,label:_.charAt(0).toUpperCase()+_.slice(1)})),c=[...o,...l],g=e.activeSection&&n.schema&&Oe(n.schema)==="object"?n.schema.properties?.[e.activeSection]:void 0,p=e.activeSection?Iv(e.activeSection,g):null,u=e.activeSection?Mv({key:e.activeSection,schema:g,uiHints:e.uiHints}):[],h=e.formMode==="form"&&!!e.activeSection&&u.length>0,f=e.activeSubsection===br,d=e.searchQuery||f?null:e.activeSubsection??u[0]?.key??null,m=e.formMode==="form"?Rv(e.originalValue,e.formValue):[],k=e.formMode==="raw"&&e.raw!==e.originalRaw,S=e.formMode==="form"?m.length>0:k,$=!!e.formValue&&!e.loading&&!!n.schema,A=e.connected&&!e.saving&&S&&(e.formMode==="raw"?!0:$),C=e.connected&&!e.applying&&!e.updating&&S&&(e.formMode==="raw"?!0:$),T=e.connected&&!e.applying&&!e.updating;return r`
    <div class="config-layout">
      <!-- Sidebar -->
      <aside class="config-sidebar">
        <div class="config-sidebar__header">
          <div class="config-sidebar__title">${R("settings.title")}</div>
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
            @input=${_=>e.onSearchChange(_.target.value)}
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
            <span class="config-nav__icon">${Pi.all}</span>
            <span class="config-nav__label">All Settings</span>
          </button>
          ${c.map(_=>r`
              <button
                class="config-nav__item ${e.activeSection===_.key?"active":""}"
                @click=${()=>e.onSectionChange(_.key)}
              >
                <span class="config-nav__icon"
                  >${yr(_.key)}</span
                >
                <span class="config-nav__label">${_.label}</span>
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
              ?disabled=${!A}
              @click=${e.onSave}
            >
              ${e.saving?"Saving…":"Save"}
            </button>
            <button
              class="btn btn--sm"
              ?disabled=${!C}
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
                  ${m.map(_=>r`
                      <div class="config-diff__item">
                        <div class="config-diff__path">${_.path}</div>
                        <div class="config-diff__values">
                          <span class="config-diff__from"
                            >${xr(_.from)}</span
                          >
                          <span class="config-diff__arrow">→</span>
                          <span class="config-diff__to"
                            >${xr(_.to)}</span
                          >
                        </div>
                      </div>
                    `)}
                </div>
              </details>
            `:v}
        ${p&&e.formMode==="form"?r`
              <div class="config-section-hero">
                <div class="config-section-hero__icon">
                  ${yr(e.activeSection??"")}
                </div>
                <div class="config-section-hero__text">
                  <div class="config-section-hero__title">
                    ${p.label}
                  </div>
                  ${p.description?r`<div class="config-section-hero__desc">
                        ${p.description}
                      </div>`:v}
                </div>
              </div>
            `:v}
        ${h?r`
              <div class="config-subnav">
                <button
                  class="config-subnav__item ${d===null?"active":""}"
                  @click=${()=>e.onSubsectionChange(br)}
                >
                  All
                </button>
                ${u.map(_=>r`
                    <button
                      class="config-subnav__item ${d===_.key?"active":""}"
                      title=${_.description||_.label}
                      @click=${()=>e.onSubsectionChange(_.key)}
                    >
                      ${_.label}
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
                      `:jh({schema:n.schema,uiHints:e.uiHints,value:e.formValue,disabled:e.loading||!e.formValue,unsupportedPaths:n.unsupportedPaths,onPatch:e.onFormPatch,searchQuery:e.searchQuery,activeSection:e.activeSection,activeSubsection:d})}
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
                    @input=${_=>e.onRawChange(_.target.value)}
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
  `}function Dv(e){const t=["last",...e.channels.filter(Boolean)],n=e.form.deliveryChannel?.trim();n&&!t.includes(n)&&t.push(n);const s=new Set;return t.filter(i=>s.has(i)?!1:(s.add(i),!0))}function Fv(e,t){if(t==="last")return"last";const n=e.channelMeta?.find(s=>s.id===t);return n?.label?n.label:e.channelLabels?.[t]??t}function Nv(e){const t=Dv(e),s=(e.runsJobId==null?void 0:e.jobs.find(o=>o.id===e.runsJobId))?.name??e.runsJobId??"(select a job)",i=e.runs.toSorted((o,a)=>a.ts-o.ts);return r`
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
            <div class="stat-value">${mo(e.status?.nextWakeAtMs??null)}</div>
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
              @input=${o=>e.onFormChange({name:o.target.value})}
            />
          </label>
          <label class="field">
            <span>Description</span>
            <input
              .value=${e.form.description}
              @input=${o=>e.onFormChange({description:o.target.value})}
            />
          </label>
          <label class="field">
            <span>Agent ID</span>
            <input
              .value=${e.form.agentId}
              @input=${o=>e.onFormChange({agentId:o.target.value})}
              placeholder="default"
            />
          </label>
          <label class="field checkbox">
            <span>Enabled</span>
            <input
              type="checkbox"
              .checked=${e.form.enabled}
              @change=${o=>e.onFormChange({enabled:o.target.checked})}
            />
          </label>
          <label class="field">
            <span>Schedule</span>
            <select
              .value=${e.form.scheduleKind}
              @change=${o=>e.onFormChange({scheduleKind:o.target.value})}
            >
              <option value="every">Every</option>
              <option value="at">At</option>
              <option value="cron">Cron</option>
            </select>
          </label>
        </div>
        ${Ov(e)}
        <div class="form-grid" style="margin-top: 12px;">
          <label class="field">
            <span>Session</span>
            <select
              .value=${e.form.sessionTarget}
              @change=${o=>e.onFormChange({sessionTarget:o.target.value})}
            >
              <option value="main">Main</option>
              <option value="isolated">Isolated</option>
            </select>
          </label>
          <label class="field">
            <span>Wake mode</span>
            <select
              .value=${e.form.wakeMode}
              @change=${o=>e.onFormChange({wakeMode:o.target.value})}
            >
              <option value="now">Now</option>
              <option value="next-heartbeat">Next heartbeat</option>
            </select>
          </label>
          <label class="field">
            <span>Payload</span>
            <select
              .value=${e.form.payloadKind}
              @change=${o=>e.onFormChange({payloadKind:o.target.value})}
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
            @input=${o=>e.onFormChange({payloadText:o.target.value})}
            rows="4"
          ></textarea>
        </label>
        ${e.form.payloadKind==="agentTurn"?r`
                <div class="form-grid" style="margin-top: 12px;">
                  <label class="field">
                    <span>Delivery</span>
                    <select
                      .value=${e.form.deliveryMode}
                      @change=${o=>e.onFormChange({deliveryMode:o.target.value})}
                    >
                      <option value="announce">Announce summary (default)</option>
                      <option value="none">None (internal)</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Timeout (seconds)</span>
                    <input
                      .value=${e.form.timeoutSeconds}
                      @input=${o=>e.onFormChange({timeoutSeconds:o.target.value})}
                    />
                  </label>
                  ${e.form.deliveryMode==="announce"?r`
                          <label class="field">
                            <span>Channel</span>
                            <select
                              .value=${e.form.deliveryChannel||"last"}
                              @change=${o=>e.onFormChange({deliveryChannel:o.target.value})}
                            >
                              ${t.map(o=>r`<option value=${o}>
                                    ${Fv(e,o)}
                                  </option>`)}
                            </select>
                          </label>
                          <label class="field">
                            <span>To</span>
                            <input
                              .value=${e.form.deliveryTo}
                              @input=${o=>e.onFormChange({deliveryTo:o.target.value})}
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
              ${e.jobs.map(o=>Bv(o,e))}
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
                ${i.map(o=>Hv(o,e.basePath))}
              </div>
            `}
    </section>
  `}function Ov(e){const t=e.form;return t.scheduleKind==="at"?r`
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
  `}function Bv(e,t){const s=`list-item list-item-clickable cron-job${t.runsJobId===e.id?" list-item-selected":""}`;return r`
    <div class=${s} @click=${()=>t.onLoadRuns(e.id)}>
      <div class="list-main">
        <div class="list-title">${e.name}</div>
        <div class="list-sub">${Kl(e)}</div>
        ${Uv(e)}
        ${e.agentId?r`<div class="muted cron-job-agent">Agent: ${e.agentId}</div>`:v}
      </div>
      <div class="list-meta">
        ${zv(e)}
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
  `}function Uv(e){if(e.payload.kind==="systemEvent")return r`<div class="cron-job-detail">
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
  `}function wr(e){return typeof e!="number"||!Number.isFinite(e)?"n/a":Y(e)}function zv(e){const t=e.state?.lastStatus??"n/a",n=t==="ok"?"cron-job-status-ok":t==="error"?"cron-job-status-error":t==="skipped"?"cron-job-status-skipped":"cron-job-status-na",s=e.state?.nextRunAtMs,i=e.state?.lastRunAtMs;return r`
    <div class="cron-job-state">
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Status</span>
        <span class=${`cron-job-status-pill ${n}`}>${t}</span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Next</span>
        <span class="cron-job-state-value" title=${xt(s)}>
          ${wr(s)}
        </span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Last</span>
        <span class="cron-job-state-value" title=${xt(i)}>
          ${wr(i)}
        </span>
      </div>
    </div>
  `}function Hv(e,t){const n=typeof e.sessionKey=="string"&&e.sessionKey.trim().length>0?`${ao("chat",t)}?session=${encodeURIComponent(e.sessionKey)}`:null;return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${e.status}</div>
        <div class="list-sub">${e.summary??""}</div>
      </div>
      <div class="list-meta">
        <div>${xt(e.ts)}</div>
        <div class="muted">${e.durationMs??0}ms</div>
        ${n?r`<div><a class="session-link" href=${n}>Open run chat</a></div>`:v}
        ${e.error?r`<div class="muted">${e.error}</div>`:v}
      </div>
    </div>
  `}function jv(e){const n=(e.status&&typeof e.status=="object"?e.status.securityAudit:null)?.summary??null,s=n?.critical??0,i=n?.warn??0,o=n?.info??0,a=s>0?"danger":i>0?"warn":"success",l=s>0?`${s} critical`:i>0?`${i} warnings`:"No critical issues";return r`
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
            ${n?r`<div class="callout ${a}" style="margin-top: 8px;">
                  Security audit: ${l}${o>0?` · ${o} info`:""}. Run
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
                      <pre class="code-block">${ih(c.payload)}</pre>
                    </div>
                  </div>
                `)}
            </div>
          `}
    </section>
  `}function Kv(e){const t=Math.max(0,e),n=Math.floor(t/1e3);if(n<60)return`${n}s`;const s=Math.floor(n/60);return s<60?`${s}m`:`${Math.floor(s/60)}h`}function lt(e,t){return t?r`<div class="exec-approval-meta-row"><span>${e}</span><span>${t}</span></div>`:v}function Wv(e){const t=e.execApprovalQueue[0];if(!t)return v;const n=t.request,s=t.expiresAtMs-Date.now(),i=s>0?`expires in ${Kv(s)}`:"expired",o=e.execApprovalQueue.length;return r`
    <div class="exec-approval-overlay" role="dialog" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">Exec approval needed</div>
            <div class="exec-approval-sub">${i}</div>
          </div>
          ${o>1?r`<div class="exec-approval-queue">${o} pending</div>`:v}
        </div>
        <div class="exec-approval-command mono">${n.command}</div>
        <div class="exec-approval-meta">
          ${lt("Host",n.host)}
          ${lt("Agent",n.agentId)}
          ${lt("Session",n.sessionKey)}
          ${lt("CWD",n.cwd)}
          ${lt("Resolved",n.resolvedPath)}
          ${lt("Security",n.security)}
          ${lt("Ask",n.ask)}
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
  `}function Vv(e){const{pendingGatewayUrl:t}=e;return t?r`
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
  `:v}function qv(e){return r`
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
              `:e.entries.map(t=>Gv(t))}
      </div>
    </section>
  `}function Gv(e){const t=e.lastInputSeconds!=null?`${e.lastInputSeconds}s ago`:"n/a",n=e.mode??"unknown",s=Array.isArray(e.roles)?e.roles.filter(Boolean):[],i=Array.isArray(e.scopes)?e.scopes.filter(Boolean):[],o=i.length>0?i.length>3?`${i.length} scopes`:`scopes: ${i.join(", ")}`:null;return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${e.host??"unknown host"}</div>
        <div class="list-sub">${th(e)}</div>
        <div class="chip-row">
          <span class="chip">${n}</span>
          ${s.map(a=>r`<span class="chip">${a}</span>`)}
          ${o?r`<span class="chip">${o}</span>`:v}
          ${e.platform?r`<span class="chip">${e.platform}</span>`:v}
          ${e.deviceFamily?r`<span class="chip">${e.deviceFamily}</span>`:v}
          ${e.modelIdentifier?r`<span class="chip">${e.modelIdentifier}</span>`:v}
          ${e.version?r`<span class="chip">${e.version}</span>`:v}
        </div>
      </div>
      <div class="list-meta">
        <div>${nh(e)}</div>
        <div class="muted">Last input ${t}</div>
        <div class="muted">Reason ${e.reason??""}</div>
      </div>
    </div>
  `}const $r=["trace","debug","info","warn","error","fatal"];function Qv(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleTimeString()}function Yv(e,t){return t?[e.message,e.subsystem,e.raw].filter(Boolean).join(" ").toLowerCase().includes(t):!0}function Jv(e){const t=e.filterText.trim().toLowerCase(),n=$r.some(o=>!e.levelFilters[o]),s=e.entries.filter(o=>o.level&&!e.levelFilters[o.level]?!1:Yv(o,t)),i=t||n?"filtered":"visible";return r`
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
            @click=${()=>e.onExport(s.map(o=>o.raw),i)}
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
            @input=${o=>e.onFilterTextChange(o.target.value)}
            placeholder="Search logs"
          />
        </label>
        <label class="field checkbox">
          <span>Auto-follow</span>
          <input
            type="checkbox"
            .checked=${e.autoFollow}
            @change=${o=>e.onToggleAutoFollow(o.target.checked)}
          />
        </label>
      </div>

      <div class="chip-row" style="margin-top: 12px;">
        ${$r.map(o=>r`
            <label class="chip log-chip ${o}">
              <input
                type="checkbox"
                .checked=${e.levelFilters[o]}
                @change=${a=>e.onLevelToggle(o,a.target.checked)}
              />
              <span>${o}</span>
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
              `:s.map(o=>r`
                <div class="log-row">
                  <div class="log-time mono">${Qv(o.time)}</div>
                  <div class="log-level ${o.level??""}">${o.level??""}</div>
                  <div class="log-subsystem mono">${o.subsystem??""}</div>
                  <div class="log-message mono">${o.message??o.raw}</div>
                </div>
              `)}
      </div>
    </section>
  `}function Zv(e){const t=ib(e),n=db(e);return r`
    ${gb(n)}
    ${ub(t)}
    ${Xv(e)}
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
              `:e.nodes.map(s=>$b(s))}
      </div>
    </section>
  `}function Xv(e){const t=e.devicesList??{pending:[],paired:[]},n=Array.isArray(t.pending)?t.pending:[],s=Array.isArray(t.paired)?t.paired:[];return r`
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
              ${n.map(i=>eb(i,e))}
            `:v}
        ${s.length>0?r`
              <div class="muted" style="margin-top: 12px; margin-bottom: 8px;">Paired</div>
              ${s.map(i=>tb(i,e))}
            `:v}
        ${n.length===0&&s.length===0?r`
                <div class="muted">No paired devices.</div>
              `:v}
      </div>
    </section>
  `}function eb(e,t){const n=e.displayName?.trim()||e.deviceId,s=typeof e.ts=="number"?Y(e.ts):"n/a",i=e.role?.trim()?`role: ${e.role}`:"role: -",o=e.isRepair?" · repair":"",a=e.remoteIp?` · ${e.remoteIp}`:"";return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${n}</div>
        <div class="list-sub">${e.deviceId}${a}</div>
        <div class="muted" style="margin-top: 6px;">
          ${i} · requested ${s}${o}
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
  `}function tb(e,t){const n=e.displayName?.trim()||e.deviceId,s=e.remoteIp?` · ${e.remoteIp}`:"",i=`roles: ${di(e.roles)}`,o=`scopes: ${di(e.scopes)}`,a=Array.isArray(e.tokens)?e.tokens:[];return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${n}</div>
        <div class="list-sub">${e.deviceId}${s}</div>
        <div class="muted" style="margin-top: 6px;">${i} · ${o}</div>
        ${a.length===0?r`
                <div class="muted" style="margin-top: 6px">Tokens: none</div>
              `:r`
              <div class="muted" style="margin-top: 10px;">Tokens</div>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                ${a.map(l=>nb(e.deviceId,l,t))}
              </div>
            `}
      </div>
    </div>
  `}function nb(e,t,n){const s=t.revokedAtMs?"revoked":"active",i=`scopes: ${di(t.scopes)}`,o=Y(t.rotatedAtMs??t.createdAtMs??t.lastUsedAtMs??null);return r`
    <div class="row" style="justify-content: space-between; gap: 8px;">
      <div class="list-sub">${t.role} · ${s} · ${i} · ${o}</div>
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
  `}const Ye="__defaults__",kr=[{value:"deny",label:"Deny"},{value:"allowlist",label:"Allowlist"},{value:"full",label:"Full"}],sb=[{value:"off",label:"Off"},{value:"on-miss",label:"On miss"},{value:"always",label:"Always"}];function ib(e){const t=e.configForm,n=yb(e.nodes),{defaultBinding:s,agents:i}=wb(t),o=!!t,a=e.configSaving||e.configFormMode==="raw";return{ready:o,disabled:a,configDirty:e.configDirty,configLoading:e.configLoading,configSaving:e.configSaving,defaultBinding:s,agents:i,nodes:n,onBindDefault:e.onBindDefault,onBindAgent:e.onBindAgent,onSave:e.onSaveBindings,onLoadConfig:e.onLoadConfig,formMode:e.configFormMode}}function Sr(e){return e==="allowlist"||e==="full"||e==="deny"?e:"deny"}function ob(e){return e==="always"||e==="off"||e==="on-miss"?e:"on-miss"}function ab(e){const t=e?.defaults??{};return{security:Sr(t.security),ask:ob(t.ask),askFallback:Sr(t.askFallback??"deny"),autoAllowSkills:!!(t.autoAllowSkills??!1)}}function rb(e){const t=e?.agents??{},n=Array.isArray(t.list)?t.list:[],s=[];return n.forEach(i=>{if(!i||typeof i!="object")return;const o=i,a=typeof o.id=="string"?o.id.trim():"";if(!a)return;const l=typeof o.name=="string"?o.name.trim():void 0,c=o.default===!0;s.push({id:a,name:l||void 0,isDefault:c})}),s}function lb(e,t){const n=rb(e),s=Object.keys(t?.agents??{}),i=new Map;n.forEach(a=>i.set(a.id,a)),s.forEach(a=>{i.has(a)||i.set(a,{id:a})});const o=Array.from(i.values());return o.length===0&&o.push({id:"main",isDefault:!0}),o.sort((a,l)=>{if(a.isDefault&&!l.isDefault)return-1;if(!a.isDefault&&l.isDefault)return 1;const c=a.name?.trim()?a.name:a.id,g=l.name?.trim()?l.name:l.id;return c.localeCompare(g)}),o}function cb(e,t){return e===Ye?Ye:e&&t.some(n=>n.id===e)?e:Ye}function db(e){const t=e.execApprovalsForm??e.execApprovalsSnapshot?.file??null,n=!!t,s=ab(t),i=lb(e.configForm,t),o=xb(e.nodes),a=e.execApprovalsTarget;let l=a==="node"&&e.execApprovalsTargetNodeId?e.execApprovalsTargetNodeId:null;a==="node"&&l&&!o.some(u=>u.id===l)&&(l=null);const c=cb(e.execApprovalsSelectedAgent,i),g=c!==Ye?(t?.agents??{})[c]??null:null,p=Array.isArray(g?.allowlist)?g.allowlist??[]:[];return{ready:n,disabled:e.execApprovalsSaving||e.execApprovalsLoading,dirty:e.execApprovalsDirty,loading:e.execApprovalsLoading,saving:e.execApprovalsSaving,form:t,defaults:s,selectedScope:c,selectedAgent:g,agents:i,allowlist:p,target:a,targetNodeId:l,targetNodes:o,onSelectScope:e.onExecApprovalsSelectAgent,onSelectTarget:e.onExecApprovalsTargetChange,onPatch:e.onExecApprovalsPatch,onRemove:e.onExecApprovalsRemove,onLoad:e.onLoadExecApprovals,onSave:e.onSaveExecApprovals}}function ub(e){const t=e.nodes.length>0,n=e.defaultBinding??"";return r`
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
                      @change=${s=>{const o=s.target.value.trim();e.onBindDefault(o||null)}}
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
                    `:e.agents.map(s=>bb(s,e))}
            </div>
          `:r`<div class="row" style="margin-top: 12px; gap: 12px;">
            <div class="muted">Load config to edit bindings.</div>
            <button class="btn" ?disabled=${e.configLoading} @click=${e.onLoadConfig}>
              ${e.configLoading?"Loading…":"Load config"}
            </button>
          </div>`}
    </section>
  `}function gb(e){const t=e.ready,n=e.target!=="node"||!!e.targetNodeId;return r`
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

      ${pb(e)}

      ${t?r`
            ${hb(e)}
            ${fb(e)}
            ${e.selectedScope===Ye?v:mb(e)}
          `:r`<div class="row" style="margin-top: 12px; gap: 12px;">
            <div class="muted">Load exec approvals to edit allowlists.</div>
            <button class="btn" ?disabled=${e.loading||!n} @click=${e.onLoad}>
              ${e.loading?"Loading…":"Load approvals"}
            </button>
          </div>`}
    </section>
  `}function pb(e){const t=e.targetNodes.length>0,n=e.targetNodeId??"";return r`
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
              @change=${s=>{if(s.target.value==="node"){const a=e.targetNodes[0]?.id??null;e.onSelectTarget("node",n||a)}else e.onSelectTarget("gateway",null)}}
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
                    @change=${s=>{const o=s.target.value.trim();e.onSelectTarget("node",o||null)}}
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
  `}function hb(e){return r`
    <div class="row" style="margin-top: 12px; gap: 8px; flex-wrap: wrap;">
      <span class="label">Scope</span>
      <div class="row" style="gap: 8px; flex-wrap: wrap;">
        <button
          class="btn btn--sm ${e.selectedScope===Ye?"active":""}"
          @click=${()=>e.onSelectScope(Ye)}
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
  `}function fb(e){const t=e.selectedScope===Ye,n=e.defaults,s=e.selectedAgent??{},i=t?["defaults"]:["agents",e.selectedScope],o=typeof s.security=="string"?s.security:void 0,a=typeof s.ask=="string"?s.ask:void 0,l=typeof s.askFallback=="string"?s.askFallback:void 0,c=t?n.security:o??"__default__",g=t?n.ask:a??"__default__",p=t?n.askFallback:l??"__default__",u=typeof s.autoAllowSkills=="boolean"?s.autoAllowSkills:void 0,h=u??n.autoAllowSkills,f=u==null;return r`
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
              ${kr.map(d=>r`<option
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
              ${t?v:r`<option value="__default__" ?selected=${g==="__default__"}>
                    Use default (${n.ask})
                  </option>`}
              ${sb.map(d=>r`<option
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
              ${t?v:r`<option value="__default__" ?selected=${p==="__default__"}>
                    Use default (${n.askFallback})
                  </option>`}
              ${kr.map(d=>r`<option
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
  `}function mb(e){const t=["agents",e.selectedScope,"allowlist"],n=e.allowlist;return r`
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
            `:n.map((s,i)=>vb(e,s,i))}
    </div>
  `}function vb(e,t,n){const s=t.lastUsedAt?Y(t.lastUsedAt):"never",i=t.lastUsedCommand?ui(t.lastUsedCommand,120):null,o=t.lastResolvedPath?ui(t.lastResolvedPath,120):null;return r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${t.pattern?.trim()?t.pattern:"New pattern"}</div>
        <div class="list-sub">Last used: ${s}</div>
        ${i?r`<div class="list-sub mono">${i}</div>`:v}
        ${o?r`<div class="list-sub mono">${o}</div>`:v}
      </div>
      <div class="list-meta">
        <label class="field">
          <span>Pattern</span>
          <input
            type="text"
            .value=${t.pattern??""}
            ?disabled=${e.disabled}
            @input=${a=>{const l=a.target;e.onPatch(["agents",e.selectedScope,"allowlist",n,"pattern"],l.value)}}
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
  `}function bb(e,t){const n=e.binding??"__default__",s=e.name?.trim()?`${e.name} (${e.id})`:e.id,i=t.nodes.length>0;return r`
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
            @change=${o=>{const l=o.target.value.trim();t.onBindAgent(e.index,l==="__default__"?null:l)}}
          >
            <option value="__default__" ?selected=${n==="__default__"}>
              Use default
            </option>
            ${t.nodes.map(o=>r`<option
                  value=${o.id}
                  ?selected=${n===o.id}
                >
                  ${o.label}
                </option>`)}
          </select>
        </label>
      </div>
    </div>
  `}function yb(e){const t=[];for(const n of e){if(!(Array.isArray(n.commands)?n.commands:[]).some(l=>String(l)==="system.run"))continue;const o=typeof n.nodeId=="string"?n.nodeId.trim():"";if(!o)continue;const a=typeof n.displayName=="string"&&n.displayName.trim()?n.displayName.trim():o;t.push({id:o,label:a===o?o:`${a} · ${o}`})}return t.sort((n,s)=>n.label.localeCompare(s.label)),t}function xb(e){const t=[];for(const n of e){if(!(Array.isArray(n.commands)?n.commands:[]).some(l=>String(l)==="system.execApprovals.get"||String(l)==="system.execApprovals.set"))continue;const o=typeof n.nodeId=="string"?n.nodeId.trim():"";if(!o)continue;const a=typeof n.displayName=="string"&&n.displayName.trim()?n.displayName.trim():o;t.push({id:o,label:a===o?o:`${a} · ${o}`})}return t.sort((n,s)=>n.label.localeCompare(s.label)),t}function wb(e){const t={id:"main",name:void 0,index:0,isDefault:!0,binding:null};if(!e||typeof e!="object")return{defaultBinding:null,agents:[t]};const s=(e.tools??{}).exec??{},i=typeof s.node=="string"&&s.node.trim()?s.node.trim():null,o=e.agents??{},a=Array.isArray(o.list)?o.list:[];if(a.length===0)return{defaultBinding:i,agents:[t]};const l=[];return a.forEach((c,g)=>{if(!c||typeof c!="object")return;const p=c,u=typeof p.id=="string"?p.id.trim():"";if(!u)return;const h=typeof p.name=="string"?p.name.trim():void 0,f=p.default===!0,m=(p.tools??{}).exec??{},k=typeof m.node=="string"&&m.node.trim()?m.node.trim():null;l.push({id:u,name:h||void 0,index:g,isDefault:f,binding:k})}),l.length===0&&l.push(t),{defaultBinding:i,agents:l}}function $b(e){const t=!!e.connected,n=!!e.paired,s=typeof e.displayName=="string"&&e.displayName.trim()||(typeof e.nodeId=="string"?e.nodeId:"unknown"),i=Array.isArray(e.caps)?e.caps:[],o=Array.isArray(e.commands)?e.commands:[];return r`
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
          ${i.slice(0,12).map(a=>r`<span class="chip">${String(a)}</span>`)}
          ${o.slice(0,8).map(a=>r`<span class="chip">${String(a)}</span>`)}
        </div>
      </div>
    </div>
  `}function kb(e){const t=e.hello?.snapshot,n=t?.uptimeMs?Qi(t.uptimeMs):"n/a",s=t?.policy?.tickIntervalMs?`${t.policy.tickIntervalMs}ms`:"n/a",i=(()=>{if(e.connected||!e.lastError)return null;const a=e.lastError.toLowerCase();if(!(a.includes("unauthorized")||a.includes("connect failed")))return null;const c=!!e.settings.token.trim(),g=!!e.password.trim();return!c&&!g?r`
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
    `})(),o=(()=>{if(e.connected||!e.lastError||(typeof window<"u"?window.isSecureContext:!0))return null;const l=e.lastError.toLowerCase();return!l.includes("secure context")&&!l.includes("device identity required")?null:r`
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
              @input=${a=>{const l=a.target.value;e.onSettingsChange({...e.settings,gatewayUrl:l})}}
              placeholder="ws://100.x.y.z:18789"
            />
          </label>
          <label class="field">
            <span>Gateway Token</span>
            <input
              .value=${e.settings.token}
              @input=${a=>{const l=a.target.value;e.onSettingsChange({...e.settings,token:l})}}
              placeholder="WINCLAW_GATEWAY_TOKEN"
            />
          </label>
          <label class="field">
            <span>Password (not stored)</span>
            <input
              type="password"
              .value=${e.password}
              @input=${a=>{const l=a.target.value;e.onPasswordChange(l)}}
              placeholder="system or shared password"
            />
          </label>
          <label class="field">
            <span>Default Session Key</span>
            <input
              .value=${e.settings.sessionKey}
              @input=${a=>{const l=a.target.value;e.onSessionKeyChange(l)}}
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
              ${o??""}
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
        <div class="muted">Next wake ${mo(e.cronNext)}</div>
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
  `}function Sb(e){const{form:t}=e;return r`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${R("personal.title")}</div>
          <div class="card-sub">
            ${R("personal.subtitle")}
          </div>
        </div>
        <button
          class="btn"
          ?disabled=${e.loading}
          @click=${e.onRefresh}
        >
          ${e.loading?R("personal.loading"):R("personal.reload")}
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
                  <span class="field-label">${R("personal.employeeId")}</span>
                  <input
                    type="text"
                    .value=${t.employeeId??""}
                    placeholder=${R("personal.employeeIdPlaceholder")}
                    @input=${n=>e.onFieldChange("employeeId",n.target.value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${R("personal.employeeName")}</span>
                  <input
                    type="text"
                    .value=${t.employeeName??""}
                    placeholder=${R("personal.employeeNamePlaceholder")}
                    @input=${n=>e.onFieldChange("employeeName",n.target.value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${R("personal.email")}</span>
                  <input
                    type="email"
                    .value=${t.employeeEmail??""}
                    placeholder=${R("personal.emailPlaceholder")}
                    @input=${n=>e.onFieldChange("employeeEmail",n.target.value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">${R("personal.grcUrl")}</span>
                  <input
                    type="url"
                    .value=${t.grcUrl??""}
                    placeholder=${R("personal.grcUrlPlaceholder")}
                    @input=${n=>e.onFieldChange("grcUrl",n.target.value)}
                  />
                </label>

                <div
                  class="callout"
                  style="margin-top: 4px; opacity: 0.7; font-size: 0.85em;"
                >
                  <div><strong>Node ID:</strong> ${t.nodeId||R("personal.notConnected")}</div>
                </div>

                <div class="row" style="margin-top: 8px; gap: 8px;">
                  <button
                    class="btn primary"
                    ?disabled=${!e.dirty||e.saving}
                    @click=${e.onSave}
                  >
                    ${e.saving?R("personal.saving"):R("personal.save")}
                  </button>
                </div>
              </div>
            `:e.loading?r`<div class="muted" style="margin-top: 16px;">${R("personal.loading")}</div>`:r`<div class="muted" style="margin-top: 16px;">${R("personal.loadError")}</div>`}
    </section>
  `}function Cb(e){return e==="disconnected"?v:r`
    <span class="dh-status-badge dh-status-badge--${e}" role="status">
      ${R(e==="connecting"?"dh.statusConnecting":e==="connected"?"dh.statusConnected":"dh.statusError")}
    </span>
  `}function Ab(e){return r`
    <div
      class="dh-placeholder"
      @click=${e}
      role="button"
      tabindex="0"
      aria-label=${R("dh.clickToStart")}
      @keydown=${t=>{(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),e())}}
    >
      <img
        src="/avatar-placeholder.png"
        class="dh-avatar-static"
        alt=${R("dh.avatarAlt")}
      />
      <span class="dh-start-hint">${R("dh.clickToStart")}</span>
    </div>
  `}function Tb(e){return e.isConnected?r`
    <div
      id="dh-video-player"
      class="dh-video-player-container"
      @dblclick=${e.onVideoDoubleClick}
      aria-label=${R("dh.videoLabel")}
    ></div>
  `:Ab(e.onStart)}function _b(e){return e?r`
    <video
      id="camera-preview"
      class="camera-pip"
      autoplay
      playsinline
      muted
      aria-label=${R("dh.cameraPreviewLabel")}
    ></video>
  `:v}function Eb(e){return r`
    <div class="dh-subtitle ${e.subtitleVisible?"":"collapsed"}">
      <div class="dh-subtitle-inner">
        <p class="dh-subtitle-text" aria-live="polite" aria-atomic="true">
          ${e.currentSubtitle||r`<span class="dh-subtitle-empty">&nbsp;</span>`}
        </p>
        <button
          class="dh-subtitle-toggle"
          @click=${e.onToggleSubtitle}
          title=${R(e.subtitleVisible?"dh.collapseSubtitle":"dh.expandSubtitle")}
          aria-expanded=${e.subtitleVisible?"true":"false"}
        >
          ${e.subtitleVisible?r`<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`:r`<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`}
        </button>
      </div>
    </div>
  `}function Lb(e){return e?r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
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
      </svg>`}function Ib(e){return e?r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <path d="M23 7 16 12 23 17V7z"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>`:r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/>
        <path d="M23 7l-7 5 7 5V7z"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>`}function Mb(e){const t=R(e.micEnabled?"dh.micOn":"dh.micOff"),n=R(e.cameraEnabled?"dh.camOn":"dh.camOff");return r`
    <div class="dh-controls" role="toolbar" aria-label=${R("dh.controlsLabel")}>
      <!-- Mic toggle -->
      <button
        class="dh-btn ${e.micEnabled?"active":"inactive"}"
        @click=${e.onToggleMic}
        title=${t}
        aria-pressed=${e.micEnabled?"true":"false"}
        aria-label=${t}
      >
        ${Lb(e.micEnabled)}
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
        ${Ib(e.cameraEnabled)}
        <span class="dh-btn-label">${n}</span>
      </button>

      <!-- Voice selector (CosyVoice) -->
      <select
        class="dh-voice-select"
        .value=${e.selectedVoice}
        @change=${s=>e.onVoiceChange(s.target.value)}
        title="Voice"
      >
        <optgroup label="女性">
          <option value="longxiaochun">小春·温柔</option>
          <option value="longxiaoxia">小夏·活泼</option>
          <option value="longxiaoqian">小芊·知性</option>
          <option value="longwan">小婉·优雅</option>
          <option value="longyue">小悦·甜美</option>
          <option value="longtong">小彤·自然</option>
        </optgroup>
        <optgroup label="男性">
          <option value="longxiaobai">小白·沉稳</option>
          <option value="longshu">书生·儒雅</option>
          <option value="longshuo">小硕·清朗</option>
          <option value="longlaotie">老铁·浑厚</option>
        </optgroup>
        <optgroup label="日本語">
          <option value="loongtomoka_v3">Tomoka·日語♀</option>
          <option value="loongriko_v3">Riko·二次元♀</option>
        </optgroup>
        <optgroup label="English">
          <option value="loongstella">Stella·EN♀</option>
          <option value="loongbella">Bella·EN♀</option>
        </optgroup>
        <optgroup label="特色">
          <option value="longjielidou">杰力豆·童声</option>
          <option value="loongkyong_v3">Kyong·한국어♀</option>
        </optgroup>
      </select>

      <!-- Start / End session -->
      ${e.isConnected?r`
            <button
              class="dh-btn danger"
              @click=${e.onStop}
              aria-label=${R("dh.endSession")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              </svg>
              <span class="dh-btn-label">${R("dh.endSession")}</span>
            </button>
          `:r`
            <button
              class="dh-btn primary"
              @click=${e.onStart}
              aria-label=${R("dh.startSession")}
              ?disabled=${e.connectionStatus==="connecting"}
            >
              ${e.connectionStatus==="connecting"?r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`:r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="currentColor" stroke-width="0"><polygon points="5 3 19 12 5 21 5 3"/></svg>`}
              <span class="dh-btn-label">
                ${e.connectionStatus==="connecting"?R("dh.statusConnecting"):R("dh.startSession")}
              </span>
            </button>
          `}
    </div>
  `}function Rb(e){return r`
    <div class="dh-panel" aria-label=${R("dh.panelLabel")}>

      <!-- Video / placeholder area -->
      <div class="dh-video-container">
        ${Cb(e.connectionStatus)}
        ${e.isThinking?r`<span class="dh-thinking-badge">正在思考中...</span>`:v}
        ${Tb(e)}
        ${_b(e.cameraEnabled)}

        ${e.connectionStatus==="error"&&e.errorMessage?r`
              <div class="dh-error-overlay" role="alert">
                <span class="dh-error-text">${e.errorMessage}</span>
              </div>
            `:v}
      </div>

      <!-- Subtitle area -->
      ${Eb(e)}

      <!-- Control toolbar -->
      ${Mb(e)}
    </div>
  `}function $c(){return r`<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>`}function kc(){return r`<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
    <polyline points="4 14 10 14 10 20"/>
    <polyline points="20 10 14 10 14 4"/>
    <line x1="10" y1="14" x2="3" y2="21"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
  </svg>`}function Pb(){return r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`}function Db(){return r`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`}function Fb(e){const t=e.basePath?`${e.basePath}/favicon.svg`:"/favicon.svg";return r`
    <header class="topbar topbar-v3" role="banner">
      <div class="topbar-v3__left">
        <div class="brand">
          <div class="brand-logo">
            <img src=${t} alt="WinClaw" />
          </div>
        </div>
        <div class="dh-identity" aria-label=${R("dh.panelLabel")}>
          <span
            class="statusDot ${e.dhOnline?"ok":""}"
            title=${R(e.dhOnline?"dh.statusConnected":"dh.statusDisconnected")}
          ></span>
          <span class="dh-identity__name">${e.assistantName}</span>
        </div>
      </div>

      <div class="topbar-v3__right">
        <!-- Language selector is rendered by the caller via a slot / container -->
        <div id="topbar-lang-slot" class="topbar-v3__lang-slot"></div>

        <button
          class="topbar-icon-btn"
          @click=${e.onOpenSettings}
          title=${R("nav.settings")}
          aria-label=${R("nav.settings")}
        >
          ${Pb()}
        </button>

        <button
          class="topbar-icon-btn"
          @click=${e.onToggleTheme}
          title=${R("nav.theme")}
          aria-label=${R("nav.theme")}
        >
          ${Db()}
        </button>
      </div>
    </header>
  `}async function Eo(e){if(document.fullscreenElement)await document.exitFullscreen();else{const t=document.querySelector(e);t&&await t.requestFullscreen()}}function Nb(e){const t=!!document.fullscreenElement,n=R(t?"layout.exitFullscreen":"layout.dhFullscreen");return r`
    <button
      class="panel-fullscreen-btn"
      @click=${()=>Eo(".panel-dh")}
      title=${n}
      aria-label=${n}
    >
      ${t?kc():$c()}
    </button>
  `}function Ob(e){const t=!!document.fullscreenElement,n=R(t?"layout.exitFullscreen":"layout.chatFullscreen");return r`
    <button
      class="panel-fullscreen-btn"
      @click=${()=>Eo(".panel-chat")}
      title=${n}
      aria-label=${n}
    >
      ${t?kc():$c()}
    </button>
  `}function Bb(e){const t=["main-container",`layout-${e.layoutMode}`,`orientation-${e.orientation}`].join(" ");return r`
    <div class="shell shell--chat shell--v3">
      ${Fb(e)}

      <div class=${t} role="main">
        <!-- ── Left / top: Digital Human panel ───────────────────────────── -->
        <section
          class="panel-dh"
          aria-label=${R("dh.panelLabel")}
          @dblclick=${n=>{n.target.closest("video")||Eo(".panel-dh")}}
        >
          ${Nb()}
          ${Rb(e.dhPanel)}
        </section>

        <!-- ── Right / bottom: Chat panel ───────────────────────────────── -->
        <section
          class="panel-chat"
          aria-label=${R("chat.panelLabel")}
        >
          ${Ob()}
          ${wc(e.chatPanel)}
        </section>
      </div>

      <!-- Status bar is rendered by the host component (renderStatusBar) -->
    </div>
  `}function Ub(e={}){const t=Hc(),n=zc(),s=e.ariaLabel??"Language",i=["lang-select",e.className].filter(Boolean).join(" ");function o(a){const c=a.target.value;Pr(c)}return r`
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
        @change=${o}
      >
        ${t.map(a=>r`
            <option
              value=${a}
              ?selected=${a===n}
            >
              ${jc[a]}
            </option>
          `)}
      </select>
    </div>
  `}const zb=["","off","minimal","low","medium","high","xhigh"],Hb=["","off","on"],jb=[{value:"",label:"inherit"},{value:"off",label:"off (explicit)"},{value:"on",label:"on"},{value:"full",label:"full"}],Kb=["","off","on","stream"];function Wb(e){if(!e)return"";const t=e.trim().toLowerCase();return t==="z.ai"||t==="z-ai"?"zai":t}function Sc(e){return Wb(e)==="zai"}function Vb(e){return Sc(e)?Hb:zb}function Cr(e,t){return t?e.includes(t)?[...e]:[...e,t]:[...e]}function qb(e,t){return t?e.some(n=>n.value===t)?[...e]:[...e,{value:t,label:`${t} (custom)`}]:[...e]}function Gb(e,t){return!t||!e||e==="off"?e:"on"}function Qb(e,t){return e?t&&e==="on"?"low":e:null}function Yb(e){const t=e.result?.sessions??[];return r`
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
              `:t.map(n=>Jb(n,e.basePath,e.onPatch,e.onDelete,e.loading))}
      </div>
    </section>
  `}function Jb(e,t,n,s,i){const o=e.updatedAt?Y(e.updatedAt):"n/a",a=e.thinkingLevel??"",l=Sc(e.modelProvider),c=Gb(a,l),g=Cr(Vb(e.modelProvider),c),p=e.verboseLevel??"",u=qb(jb,p),h=e.reasoningLevel??"",f=Cr(Kb,h),d=typeof e.displayName=="string"&&e.displayName.trim().length>0?e.displayName.trim():null,m=typeof e.label=="string"?e.label.trim():"",k=!!(d&&d!==e.key&&d!==m),S=e.kind!=="global",$=S?`${ao("chat",t)}?session=${encodeURIComponent(e.key)}`:null;return r`
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
          @change=${A=>{const C=A.target.value.trim();n(e.key,{label:C||null})}}
        />
      </div>
      <div>${e.kind}</div>
      <div>${o}</div>
      <div>${sh(e)}</div>
      <div>
        <select
          ?disabled=${i}
          @change=${A=>{const C=A.target.value;n(e.key,{thinkingLevel:Qb(C,l)})}}
        >
          ${g.map(A=>r`<option value=${A} ?selected=${c===A}>
                ${A||"inherit"}
              </option>`)}
        </select>
      </div>
      <div>
        <select
          ?disabled=${i}
          @change=${A=>{const C=A.target.value;n(e.key,{verboseLevel:C||null})}}
        >
          ${u.map(A=>r`<option value=${A.value} ?selected=${p===A.value}>
                ${A.label}
              </option>`)}
        </select>
      </div>
      <div>
        <select
          ?disabled=${i}
          @change=${A=>{const C=A.target.value;n(e.key,{reasoningLevel:C||null})}}
        >
          ${f.map(A=>r`<option value=${A} ?selected=${h===A}>
                ${A||"inherit"}
              </option>`)}
        </select>
      </div>
      <div>
        <button class="btn danger" ?disabled=${i} @click=${()=>s(e.key)}>
          Delete
        </button>
      </div>
    </div>
  `}const Mn=[{id:"workspace",label:"Workspace Skills",sources:["winclaw-workspace"]},{id:"built-in",label:"Built-in Skills",sources:["winclaw-bundled"]},{id:"installed",label:"Installed Skills",sources:["winclaw-managed"]},{id:"extra",label:"Extra Skills",sources:["winclaw-extra"]}];function Zb(e){const t=new Map;for(const o of Mn)t.set(o.id,{id:o.id,label:o.label,skills:[]});const n=Mn.find(o=>o.id==="built-in"),s={id:"other",label:"Other Skills",skills:[]};for(const o of e){const a=o.bundled?n:Mn.find(l=>l.sources.includes(o.source));a?t.get(a.id)?.skills.push(o):s.skills.push(o)}const i=Mn.map(o=>t.get(o.id)).filter(o=>!!(o&&o.skills.length>0));return s.skills.length>0&&i.push(s),i}function Xb(e){const t=e.report?.skills??[],n=e.filter.trim().toLowerCase(),s=n?t.filter(o=>[o.name,o.description,o.source].join(" ").toLowerCase().includes(n)):t,i=Zb(s);return r`
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
            @input=${o=>e.onFilterChange(o.target.value)}
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
              ${i.map(o=>{const a=o.id==="workspace"||o.id==="built-in";return r`
                  <details class="agent-skills-group" ?open=${!a}>
                    <summary class="agent-skills-header">
                      <span>${o.label}</span>
                      <span class="muted">${o.skills.length}</span>
                    </summary>
                    <div class="list skills-grid">
                      ${o.skills.map(l=>ey(l,e))}
                    </div>
                  </details>
                `})}
            </div>
          `}
    </section>
  `}function ey(e,t){const n=t.busyKey===e.skillKey,s=t.edits[e.skillKey]??"",i=t.messages[e.skillKey]??null,o=e.install.length>0&&e.missing.bins.length>0,a=!!(e.bundled&&e.source!=="winclaw-bundled"),l=[...e.missing.bins.map(g=>`bin:${g}`),...e.missing.env.map(g=>`env:${g}`),...e.missing.config.map(g=>`config:${g}`),...e.missing.os.map(g=>`os:${g}`)],c=[];return e.disabled&&c.push("disabled"),e.blockedByAllowlist&&c.push("blocked by allowlist"),r`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">
          ${e.emoji?`${e.emoji} `:""}${e.name}
        </div>
        <div class="list-sub">${ui(e.description,140)}</div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${e.source}</span>
          ${a?r`
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
          ${o?r`<button
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
                  @input=${g=>t.onEdit(e.skillKey,g.target.value)}
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
  `}const ty=new Set(["agent","channel","chat","provider","model","tool","label","key","session","id","has","mintokens","maxtokens","mincost","maxcost","minmessages","maxmessages"]),ts=e=>e.trim().toLowerCase(),ny=e=>{const t=e.replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*").replace(/\?/g,".");return new RegExp(`^${t}$`,"i")},ut=e=>{let t=e.trim().toLowerCase();if(!t)return null;t.startsWith("$")&&(t=t.slice(1));let n=1;t.endsWith("k")?(n=1e3,t=t.slice(0,-1)):t.endsWith("m")&&(n=1e6,t=t.slice(0,-1));const s=Number(t);return Number.isFinite(s)?s*n:null},Lo=e=>(e.match(/"[^"]+"|\S+/g)??[]).map(n=>{const s=n.replace(/^"|"$/g,""),i=s.indexOf(":");if(i>0){const o=s.slice(0,i),a=s.slice(i+1);return{key:o,value:a,raw:s}}return{value:s,raw:s}}),sy=e=>[e.label,e.key,e.sessionId].filter(n=>!!n).map(n=>n.toLowerCase()),Ar=e=>{const t=new Set;e.modelProvider&&t.add(e.modelProvider.toLowerCase()),e.providerOverride&&t.add(e.providerOverride.toLowerCase()),e.origin?.provider&&t.add(e.origin.provider.toLowerCase());for(const n of e.usage?.modelUsage??[])n.provider&&t.add(n.provider.toLowerCase());return Array.from(t)},Tr=e=>{const t=new Set;e.model&&t.add(e.model.toLowerCase());for(const n of e.usage?.modelUsage??[])n.model&&t.add(n.model.toLowerCase());return Array.from(t)},iy=e=>(e.usage?.toolUsage?.tools??[]).map(t=>t.name.toLowerCase()),oy=(e,t)=>{const n=ts(t.value??"");if(!n)return!0;if(!t.key)return sy(e).some(i=>i.includes(n));switch(ts(t.key)){case"agent":return e.agentId?.toLowerCase().includes(n)??!1;case"channel":return e.channel?.toLowerCase().includes(n)??!1;case"chat":return e.chatType?.toLowerCase().includes(n)??!1;case"provider":return Ar(e).some(i=>i.includes(n));case"model":return Tr(e).some(i=>i.includes(n));case"tool":return iy(e).some(i=>i.includes(n));case"label":return e.label?.toLowerCase().includes(n)??!1;case"key":case"session":case"id":if(n.includes("*")||n.includes("?")){const i=ny(n);return i.test(e.key)||(e.sessionId?i.test(e.sessionId):!1)}return e.key.toLowerCase().includes(n)||(e.sessionId?.toLowerCase().includes(n)??!1);case"has":switch(n){case"tools":return(e.usage?.toolUsage?.totalCalls??0)>0;case"errors":return(e.usage?.messageCounts?.errors??0)>0;case"context":return!!e.contextWeight;case"usage":return!!e.usage;case"model":return Tr(e).length>0;case"provider":return Ar(e).length>0;default:return!0}case"mintokens":{const i=ut(n);return i===null?!0:(e.usage?.totalTokens??0)>=i}case"maxtokens":{const i=ut(n);return i===null?!0:(e.usage?.totalTokens??0)<=i}case"mincost":{const i=ut(n);return i===null?!0:(e.usage?.totalCost??0)>=i}case"maxcost":{const i=ut(n);return i===null?!0:(e.usage?.totalCost??0)<=i}case"minmessages":{const i=ut(n);return i===null?!0:(e.usage?.messageCounts?.total??0)>=i}case"maxmessages":{const i=ut(n);return i===null?!0:(e.usage?.messageCounts?.total??0)<=i}default:return!0}},ay=(e,t)=>{const n=Lo(t);if(n.length===0)return{sessions:e,warnings:[]};const s=[];for(const o of n){if(!o.key)continue;const a=ts(o.key);if(!ty.has(a)){s.push(`Unknown filter: ${o.key}`);continue}if(o.value===""&&s.push(`Missing value for ${o.key}`),a==="has"){const l=new Set(["tools","errors","context","usage","model","provider"]);o.value&&!l.has(ts(o.value))&&s.push(`Unknown has:${o.value}`)}["mintokens","maxtokens","mincost","maxcost","minmessages","maxmessages"].includes(a)&&o.value&&ut(o.value)===null&&s.push(`Invalid number for ${o.key}`)}return{sessions:e.filter(o=>n.every(a=>oy(o,a))),warnings:s}};function ry(e){const t=e.split(`
`),n=new Map,s=[];for(const l of t){const c=/^\[Tool:\s*([^\]]+)\]/.exec(l.trim());if(c){const g=c[1];n.set(g,(n.get(g)??0)+1);continue}l.trim().startsWith("[Tool Result]")||s.push(l)}const i=Array.from(n.entries()).toSorted((l,c)=>c[1]-l[1]),o=i.reduce((l,[,c])=>l+c,0),a=i.length>0?`Tools: ${i.map(([l,c])=>`${l}×${c}`).join(", ")} (${o} calls)`:"";return{tools:i,summary:a,cleanContent:s.join(`
`).trim()}}const ly=`
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
`,cy=4;function ct(e){return Math.round(e/cy)}function B(e){return e>=1e6?`${(e/1e6).toFixed(1)}M`:e>=1e3?`${(e/1e3).toFixed(1)}K`:String(e)}function dy(e){const t=new Date;return t.setHours(e,0,0,0),t.toLocaleTimeString(void 0,{hour:"numeric"})}function uy(e,t){const n=Array.from({length:24},()=>0),s=Array.from({length:24},()=>0);for(const i of e){const o=i.usage;if(!o?.messageCounts||o.messageCounts.total===0)continue;const a=o.firstActivity??i.updatedAt,l=o.lastActivity??i.updatedAt;if(!a||!l)continue;const c=Math.min(a,l),g=Math.max(a,l),u=Math.max(g-c,1)/6e4;let h=c;for(;h<g;){const f=new Date(h),d=Io(f,t),m=Mo(f,t),k=Math.min(m.getTime(),g),$=Math.max((k-h)/6e4,0)/u;n[d]+=o.messageCounts.errors*$,s[d]+=o.messageCounts.total*$,h=k+1}}return s.map((i,o)=>{const a=n[o],l=i>0?a/i:0;return{hour:o,rate:l,errors:a,msgs:i}}).filter(i=>i.msgs>0&&i.errors>0).toSorted((i,o)=>o.rate-i.rate).slice(0,5).map(i=>({label:dy(i.hour),value:`${(i.rate*100).toFixed(2)}%`,sub:`${Math.round(i.errors)} errors · ${Math.round(i.msgs)} msgs`}))}const gy=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];function Io(e,t){return t==="utc"?e.getUTCHours():e.getHours()}function py(e,t){return t==="utc"?e.getUTCDay():e.getDay()}function Mo(e,t){const n=new Date(e);return t==="utc"?n.setUTCMinutes(59,59,999):n.setMinutes(59,59,999),n}function hy(e,t){const n=Array.from({length:24},()=>0),s=Array.from({length:7},()=>0);let i=0,o=!1;for(const l of e){const c=l.usage;if(!c||!c.totalTokens||c.totalTokens<=0)continue;i+=c.totalTokens;const g=c.firstActivity??l.updatedAt,p=c.lastActivity??l.updatedAt;if(!g||!p)continue;o=!0;const u=Math.min(g,p),h=Math.max(g,p),d=Math.max(h-u,1)/6e4;let m=u;for(;m<h;){const k=new Date(m),S=Io(k,t),$=py(k,t),A=Mo(k,t),C=Math.min(A.getTime(),h),_=Math.max((C-m)/6e4,0)/d;n[S]+=c.totalTokens*_,s[$]+=c.totalTokens*_,m=C+1}}const a=gy.map((l,c)=>({label:l,tokens:s[c]}));return{hasData:o,totalTokens:i,hourTotals:n,weekdayTotals:a}}function fy(e,t,n,s){const i=hy(e,t);if(!i.hasData)return r`
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
    `;const o=Math.max(...i.hourTotals,1),a=Math.max(...i.weekdayTotals.map(l=>l.tokens),1);return r`
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
            ${i.weekdayTotals.map(l=>{const c=Math.min(l.tokens/a,1),g=l.tokens>0?`rgba(255, 77, 77, ${.12+c*.6})`:"transparent";return r`
                <div class="usage-daypart-cell" style="background: ${g};">
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
            ${i.hourTotals.map((l,c)=>{const g=Math.min(l/o,1),p=l>0?`rgba(255, 77, 77, ${.08+g*.7})`:"transparent",u=`${c}:00 · ${B(l)} tokens`,h=g>.7?"rgba(255, 77, 77, 0.6)":"rgba(255, 77, 77, 0.2)",f=n.includes(c);return r`
                <div
                  class="usage-hour-cell ${f?"selected":""}"
                  style="background: ${p}; border-color: ${h};"
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
  `}function G(e,t=2){return`$${e.toFixed(t)}`}function ii(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function Cc(e){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return null;const[,n,s,i]=t,o=new Date(Date.UTC(Number(n),Number(s)-1,Number(i)));return Number.isNaN(o.valueOf())?null:o}function Ac(e){const t=Cc(e);return t?t.toLocaleDateString(void 0,{month:"short",day:"numeric"}):e}function my(e){const t=Cc(e);return t?t.toLocaleDateString(void 0,{month:"long",day:"numeric",year:"numeric"}):e}function oi(e,t,n="text/plain"){const s=new Blob([t],{type:n}),i=URL.createObjectURL(s),o=document.createElement("a");o.href=i,o.download=e,o.click(),URL.revokeObjectURL(i)}function vy(e){return e.includes('"')||e.includes(",")||e.includes(`
`)?`"${e.replace(/"/g,'""')}"`:e}function ns(e){return e.map(t=>t==null?"":vy(String(t))).join(",")}const Rn=()=>({input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,totalCost:0,inputCost:0,outputCost:0,cacheReadCost:0,cacheWriteCost:0,missingCostEntries:0}),Pn=(e,t)=>{e.input+=t.input??0,e.output+=t.output??0,e.cacheRead+=t.cacheRead??0,e.cacheWrite+=t.cacheWrite??0,e.totalTokens+=t.totalTokens??0,e.totalCost+=t.totalCost??0,e.inputCost+=t.inputCost??0,e.outputCost+=t.outputCost??0,e.cacheReadCost+=t.cacheReadCost??0,e.cacheWriteCost+=t.cacheWriteCost??0,e.missingCostEntries+=t.missingCostEntries??0},by=(e,t)=>{if(e.length===0)return t??{messages:{total:0,user:0,assistant:0,toolCalls:0,toolResults:0,errors:0},tools:{totalCalls:0,uniqueTools:0,tools:[]},byModel:[],byProvider:[],byAgent:[],byChannel:[],daily:[]};const n={total:0,user:0,assistant:0,toolCalls:0,toolResults:0,errors:0},s=new Map,i=new Map,o=new Map,a=new Map,l=new Map,c=new Map,g=new Map,p=new Map,u={count:0,sum:0,min:Number.POSITIVE_INFINITY,max:0,p95Max:0};for(const h of e){const f=h.usage;if(f){if(f.messageCounts&&(n.total+=f.messageCounts.total,n.user+=f.messageCounts.user,n.assistant+=f.messageCounts.assistant,n.toolCalls+=f.messageCounts.toolCalls,n.toolResults+=f.messageCounts.toolResults,n.errors+=f.messageCounts.errors),f.toolUsage)for(const d of f.toolUsage.tools)s.set(d.name,(s.get(d.name)??0)+d.count);if(f.modelUsage)for(const d of f.modelUsage){const m=`${d.provider??"unknown"}::${d.model??"unknown"}`,k=i.get(m)??{provider:d.provider,model:d.model,count:0,totals:Rn()};k.count+=d.count,Pn(k.totals,d.totals),i.set(m,k);const S=d.provider??"unknown",$=o.get(S)??{provider:d.provider,model:void 0,count:0,totals:Rn()};$.count+=d.count,Pn($.totals,d.totals),o.set(S,$)}if(f.latency){const{count:d,avgMs:m,minMs:k,maxMs:S,p95Ms:$}=f.latency;d>0&&(u.count+=d,u.sum+=m*d,u.min=Math.min(u.min,k),u.max=Math.max(u.max,S),u.p95Max=Math.max(u.p95Max,$))}if(h.agentId){const d=a.get(h.agentId)??Rn();Pn(d,f),a.set(h.agentId,d)}if(h.channel){const d=l.get(h.channel)??Rn();Pn(d,f),l.set(h.channel,d)}for(const d of f.dailyBreakdown??[]){const m=c.get(d.date)??{date:d.date,tokens:0,cost:0,messages:0,toolCalls:0,errors:0};m.tokens+=d.tokens,m.cost+=d.cost,c.set(d.date,m)}for(const d of f.dailyMessageCounts??[]){const m=c.get(d.date)??{date:d.date,tokens:0,cost:0,messages:0,toolCalls:0,errors:0};m.messages+=d.total,m.toolCalls+=d.toolCalls,m.errors+=d.errors,c.set(d.date,m)}for(const d of f.dailyLatency??[]){const m=g.get(d.date)??{date:d.date,count:0,sum:0,min:Number.POSITIVE_INFINITY,max:0,p95Max:0};m.count+=d.count,m.sum+=d.avgMs*d.count,m.min=Math.min(m.min,d.minMs),m.max=Math.max(m.max,d.maxMs),m.p95Max=Math.max(m.p95Max,d.p95Ms),g.set(d.date,m)}for(const d of f.dailyModelUsage??[]){const m=`${d.date}::${d.provider??"unknown"}::${d.model??"unknown"}`,k=p.get(m)??{date:d.date,provider:d.provider,model:d.model,tokens:0,cost:0,count:0};k.tokens+=d.tokens,k.cost+=d.cost,k.count+=d.count,p.set(m,k)}}}return{messages:n,tools:{totalCalls:Array.from(s.values()).reduce((h,f)=>h+f,0),uniqueTools:s.size,tools:Array.from(s.entries()).map(([h,f])=>({name:h,count:f})).toSorted((h,f)=>f.count-h.count)},byModel:Array.from(i.values()).toSorted((h,f)=>f.totals.totalCost-h.totals.totalCost),byProvider:Array.from(o.values()).toSorted((h,f)=>f.totals.totalCost-h.totals.totalCost),byAgent:Array.from(a.entries()).map(([h,f])=>({agentId:h,totals:f})).toSorted((h,f)=>f.totals.totalCost-h.totals.totalCost),byChannel:Array.from(l.entries()).map(([h,f])=>({channel:h,totals:f})).toSorted((h,f)=>f.totals.totalCost-h.totals.totalCost),latency:u.count>0?{count:u.count,avgMs:u.sum/u.count,minMs:u.min===Number.POSITIVE_INFINITY?0:u.min,maxMs:u.max,p95Ms:u.p95Max}:void 0,dailyLatency:Array.from(g.values()).map(h=>({date:h.date,count:h.count,avgMs:h.count?h.sum/h.count:0,minMs:h.min===Number.POSITIVE_INFINITY?0:h.min,maxMs:h.max,p95Ms:h.p95Max})).toSorted((h,f)=>h.date.localeCompare(f.date)),modelDaily:Array.from(p.values()).toSorted((h,f)=>h.date.localeCompare(f.date)||f.cost-h.cost),daily:Array.from(c.values()).toSorted((h,f)=>h.date.localeCompare(f.date))}},yy=(e,t,n)=>{let s=0,i=0;for(const p of e){const u=p.usage?.durationMs??0;u>0&&(s+=u,i+=1)}const o=i?s/i:0,a=t&&s>0?t.totalTokens/(s/6e4):void 0,l=t&&s>0?t.totalCost/(s/6e4):void 0,c=n.messages.total?n.messages.errors/n.messages.total:0,g=n.daily.filter(p=>p.messages>0&&p.errors>0).map(p=>({date:p.date,errors:p.errors,messages:p.messages,rate:p.errors/p.messages})).toSorted((p,u)=>u.rate-p.rate||u.errors-p.errors)[0];return{durationSumMs:s,durationCount:i,avgDurationMs:o,throughputTokensPerMin:a,throughputCostPerMin:l,errorRate:c,peakErrorDay:g}},xy=e=>{const t=[ns(["key","label","agentId","channel","provider","model","updatedAt","durationMs","messages","errors","toolCalls","inputTokens","outputTokens","cacheReadTokens","cacheWriteTokens","totalTokens","totalCost"])];for(const n of e){const s=n.usage;t.push(ns([n.key,n.label??"",n.agentId??"",n.channel??"",n.modelProvider??n.providerOverride??"",n.model??n.modelOverride??"",n.updatedAt?new Date(n.updatedAt).toISOString():"",s?.durationMs??"",s?.messageCounts?.total??"",s?.messageCounts?.errors??"",s?.messageCounts?.toolCalls??"",s?.input??"",s?.output??"",s?.cacheRead??"",s?.cacheWrite??"",s?.totalTokens??"",s?.totalCost??""]))}return t.join(`
`)},wy=e=>{const t=[ns(["date","inputTokens","outputTokens","cacheReadTokens","cacheWriteTokens","totalTokens","inputCost","outputCost","cacheReadCost","cacheWriteCost","totalCost"])];for(const n of e)t.push(ns([n.date,n.input,n.output,n.cacheRead,n.cacheWrite,n.totalTokens,n.inputCost??"",n.outputCost??"",n.cacheReadCost??"",n.cacheWriteCost??"",n.totalCost]));return t.join(`
`)},$y=(e,t,n)=>{const s=e.trim();if(!s)return[];const i=s.length?s.split(/\s+/):[],o=i.length?i[i.length-1]:"",[a,l]=o.includes(":")?[o.slice(0,o.indexOf(":")),o.slice(o.indexOf(":")+1)]:["",""],c=a.toLowerCase(),g=l.toLowerCase(),p=$=>{const A=new Set;for(const C of $)C&&A.add(C);return Array.from(A)},u=p(t.map($=>$.agentId)).slice(0,6),h=p(t.map($=>$.channel)).slice(0,6),f=p([...t.map($=>$.modelProvider),...t.map($=>$.providerOverride),...n?.byProvider.map($=>$.provider)??[]]).slice(0,6),d=p([...t.map($=>$.model),...n?.byModel.map($=>$.model)??[]]).slice(0,6),m=p(n?.tools.tools.map($=>$.name)??[]).slice(0,6);if(!c)return[{label:"agent:",value:"agent:"},{label:"channel:",value:"channel:"},{label:"provider:",value:"provider:"},{label:"model:",value:"model:"},{label:"tool:",value:"tool:"},{label:"has:errors",value:"has:errors"},{label:"has:tools",value:"has:tools"},{label:"minTokens:",value:"minTokens:"},{label:"maxCost:",value:"maxCost:"}];const k=[],S=($,A)=>{for(const C of A)(!g||C.toLowerCase().includes(g))&&k.push({label:`${$}:${C}`,value:`${$}:${C}`})};switch(c){case"agent":S("agent",u);break;case"channel":S("channel",h);break;case"provider":S("provider",f);break;case"model":S("model",d);break;case"tool":S("tool",m);break;case"has":["errors","tools","context","usage","model","provider"].forEach($=>{(!g||$.includes(g))&&k.push({label:`has:${$}`,value:`has:${$}`})});break}return k},ky=(e,t)=>{const n=e.trim();if(!n)return`${t} `;const s=n.split(/\s+/);return s[s.length-1]=t,`${s.join(" ")} `},pt=e=>e.trim().toLowerCase(),Sy=(e,t)=>{const n=e.trim();if(!n)return`${t} `;const s=n.split(/\s+/),i=s[s.length-1]??"",o=t.includes(":")?t.split(":")[0]:null,a=i.includes(":")?i.split(":")[0]:null;return i.endsWith(":")&&o&&a===o?(s[s.length-1]=t,`${s.join(" ")} `):s.includes(t)?`${s.join(" ")} `:`${s.join(" ")} ${t} `},_r=(e,t)=>{const s=e.trim().split(/\s+/).filter(Boolean).filter(i=>i!==t);return s.length?`${s.join(" ")} `:""},Er=(e,t,n)=>{const s=pt(t),o=[...Lo(e).filter(a=>pt(a.key??"")!==s).map(a=>a.raw),...n.map(a=>`${t}:${a}`)];return o.length?`${o.join(" ")} `:""};function pe(e,t){return t===0?0:e/t*100}function Cy(e){const t=e.totalCost||0;return{input:{tokens:e.input,cost:e.inputCost||0,pct:pe(e.inputCost||0,t)},output:{tokens:e.output,cost:e.outputCost||0,pct:pe(e.outputCost||0,t)},cacheRead:{tokens:e.cacheRead,cost:e.cacheReadCost||0,pct:pe(e.cacheReadCost||0,t)},cacheWrite:{tokens:e.cacheWrite,cost:e.cacheWriteCost||0,pct:pe(e.cacheWriteCost||0,t)},totalCost:t}}function Ay(e,t,n,s,i,o,a,l){if(!(e.length>0||t.length>0||n.length>0))return v;const g=n.length===1?s.find(d=>d.key===n[0]):null,p=g?(g.label||g.key).slice(0,20)+((g.label||g.key).length>20?"…":""):n.length===1?n[0].slice(0,8)+"…":`${n.length} sessions`,u=g?g.label||g.key:n.length===1?n[0]:n.join(", "),h=e.length===1?e[0]:`${e.length} days`,f=t.length===1?`${t[0]}:00`:`${t.length} hours`;return r`
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
              <button class="filter-chip-remove" @click=${o} title="Remove filter">×</button>
            </div>
          `:v}
      ${n.length>0?r`
            <div class="filter-chip" title="${u}">
              <span class="filter-chip-label">Session: ${p}</span>
              <button class="filter-chip-remove" @click=${a} title="Remove filter">×</button>
            </div>
          `:v}
      ${(e.length>0||t.length>0)&&n.length>0?r`
            <button class="btn btn-sm filter-clear-btn" @click=${l}>
              Clear All
            </button>
          `:v}
    </div>
  `}function Ty(e,t,n,s,i,o){if(!e.length)return r`
      <div class="daily-chart-compact">
        <div class="sessions-panel-title">Daily Usage</div>
        <div class="muted" style="padding: 20px; text-align: center">No data</div>
      </div>
    `;const a=n==="tokens",l=e.map(u=>a?u.totalTokens:u.totalCost),c=Math.max(...l,a?1:1e-4),g=e.length>30?12:e.length>20?18:e.length>14?24:32,p=e.length<=14;return r`
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
        <div class="card-title">Daily ${a?"Token":"Cost"} Usage</div>
      </div>
      <div class="daily-chart">
        <div class="daily-chart-bars" style="--bar-max-width: ${g}px">
          ${e.map((u,h)=>{const d=l[h]/c*100,m=t.includes(u.date),k=Ac(u.date),S=e.length>20?String(parseInt(u.date.slice(8),10)):k,$=e.length>20?"font-size: 8px":"",A=s==="by-type"?a?[{value:u.output,class:"output"},{value:u.input,class:"input"},{value:u.cacheWrite,class:"cache-write"},{value:u.cacheRead,class:"cache-read"}]:[{value:u.outputCost??0,class:"output"},{value:u.inputCost??0,class:"input"},{value:u.cacheWriteCost??0,class:"cache-write"},{value:u.cacheReadCost??0,class:"cache-read"}]:[],C=s==="by-type"?a?[`Output ${B(u.output)}`,`Input ${B(u.input)}`,`Cache write ${B(u.cacheWrite)}`,`Cache read ${B(u.cacheRead)}`]:[`Output ${G(u.outputCost??0)}`,`Input ${G(u.inputCost??0)}`,`Cache write ${G(u.cacheWriteCost??0)}`,`Cache read ${G(u.cacheReadCost??0)}`]:[],T=a?B(u.totalTokens):G(u.totalCost);return r`
              <div
                class="daily-bar-wrapper ${m?"selected":""}"
                @click=${_=>o(u.date,_.shiftKey)}
              >
                ${s==="by-type"?r`
                        <div
                          class="daily-bar"
                          style="height: ${d.toFixed(1)}%; display: flex; flex-direction: column;"
                        >
                          ${(()=>{const _=A.reduce((I,W)=>I+W.value,0)||1;return A.map(I=>r`
                                <div
                                  class="cost-segment ${I.class}"
                                  style="height: ${I.value/_*100}%"
                                ></div>
                              `)})()}
                        </div>
                      `:r`
                        <div class="daily-bar" style="height: ${d.toFixed(1)}%"></div>
                      `}
                ${p?r`<div class="daily-bar-total">${T}</div>`:v}
                <div class="daily-bar-label" style="${$}">${S}</div>
                <div class="daily-bar-tooltip">
                  <strong>${my(u.date)}</strong><br />
                  ${B(u.totalTokens)} tokens<br />
                  ${G(u.totalCost)}
                  ${C.length?r`${C.map(_=>r`<div>${_}</div>`)}`:v}
                </div>
              </div>
            `})}
        </div>
      </div>
    </div>
  `}function _y(e,t){const n=Cy(e),s=t==="tokens",i=e.totalTokens||1,o={output:pe(e.output,i),input:pe(e.input,i),cacheWrite:pe(e.cacheWrite,i),cacheRead:pe(e.cacheRead,i)};return r`
    <div class="cost-breakdown cost-breakdown-compact">
      <div class="cost-breakdown-header">${s?"Tokens":"Cost"} by Type</div>
      <div class="cost-breakdown-bar">
        <div class="cost-segment output" style="width: ${(s?o.output:n.output.pct).toFixed(1)}%"
          title="Output: ${s?B(e.output):G(n.output.cost)}"></div>
        <div class="cost-segment input" style="width: ${(s?o.input:n.input.pct).toFixed(1)}%"
          title="Input: ${s?B(e.input):G(n.input.cost)}"></div>
        <div class="cost-segment cache-write" style="width: ${(s?o.cacheWrite:n.cacheWrite.pct).toFixed(1)}%"
          title="Cache Write: ${s?B(e.cacheWrite):G(n.cacheWrite.cost)}"></div>
        <div class="cost-segment cache-read" style="width: ${(s?o.cacheRead:n.cacheRead.pct).toFixed(1)}%"
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
  `}function ht(e,t,n){return r`
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
  `}function Lr(e,t,n){return r`
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
  `}function Ey(e,t,n,s,i,o,a){if(!e)return v;const l=t.messages.total?Math.round(e.totalTokens/t.messages.total):0,c=t.messages.total?e.totalCost/t.messages.total:0,g=e.input+e.cacheRead,p=g>0?e.cacheRead/g:0,u=g>0?`${(p*100).toFixed(1)}%`:"—",h=n.errorRate*100,f=n.throughputTokensPerMin!==void 0?`${B(Math.round(n.throughputTokensPerMin))} tok/min`:"—",d=n.throughputCostPerMin!==void 0?`${G(n.throughputCostPerMin,4)} / min`:"—",m=n.durationCount>0?Gi(n.avgDurationMs,{spaced:!0})??"—":"—",k="Cache hit rate = cache read / (input + cache read). Higher is better.",S="Error rate = errors / total messages. Lower is better.",$="Throughput shows tokens per minute over active time. Higher is better.",A="Average tokens per message in this range.",C=s?"Average cost per message when providers report costs. Cost data is missing for some or all sessions in this range.":"Average cost per message when providers report costs.",T=t.daily.filter(N=>N.messages>0&&N.errors>0).map(N=>{const H=N.errors/N.messages;return{label:Ac(N.date),value:`${(H*100).toFixed(2)}%`,sub:`${N.errors} errors · ${N.messages} msgs · ${B(N.tokens)}`,rate:H}}).toSorted((N,H)=>H.rate-N.rate).slice(0,5).map(({rate:N,...H})=>H),_=t.byModel.slice(0,5).map(N=>({label:N.model??"unknown",value:G(N.totals.totalCost),sub:`${B(N.totals.totalTokens)} · ${N.count} msgs`})),I=t.byProvider.slice(0,5).map(N=>({label:N.provider??"unknown",value:G(N.totals.totalCost),sub:`${B(N.totals.totalTokens)} · ${N.count} msgs`})),W=t.tools.tools.slice(0,6).map(N=>({label:N.name,value:`${N.count}`,sub:"calls"})),K=t.byAgent.slice(0,5).map(N=>({label:N.agentId,value:G(N.totals.totalCost),sub:B(N.totals.totalTokens)})),ne=t.byChannel.slice(0,5).map(N=>({label:N.channel,value:G(N.totals.totalCost),sub:B(N.totals.totalTokens)}));return r`
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
            <span class="usage-summary-hint" title=${A}>?</span>
          </div>
          <div class="usage-summary-value">${B(l)}</div>
          <div class="usage-summary-sub">Across ${t.messages.total||0} messages</div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Avg Cost / Msg
            <span class="usage-summary-hint" title=${C}>?</span>
          </div>
          <div class="usage-summary-value">${G(c,4)}</div>
          <div class="usage-summary-sub">${G(e.totalCost)} total</div>
        </div>
        <div class="usage-summary-card">
          <div class="usage-summary-title">
            Sessions
            <span class="usage-summary-hint" title="Distinct sessions in the range.">?</span>
          </div>
          <div class="usage-summary-value">${o}</div>
          <div class="usage-summary-sub">of ${a} in range</div>
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
          <div class="usage-summary-value ${p>.6?"good":p>.3?"warn":"bad"}">${u}</div>
          <div class="usage-summary-sub">
            ${B(e.cacheRead)} cached · ${B(g)} prompt
          </div>
        </div>
      </div>
      <div class="usage-insights-grid">
        ${ht("Top Models",_,"No model data")}
        ${ht("Top Providers",I,"No provider data")}
        ${ht("Top Tools",W,"No tool calls")}
        ${ht("Top Agents",K,"No agent data")}
        ${ht("Top Channels",ne,"No channel data")}
        ${Lr("Peak Error Days",T,"No error data")}
        ${Lr("Peak Error Hours",i,"No error data")}
      </div>
    </section>
  `}function Ly(e,t,n,s,i,o,a,l,c,g,p,u,h,f,d){const m=E=>h.includes(E),k=E=>{const U=E.label||E.key;return U.startsWith("agent:")&&U.includes("?token=")?U.slice(0,U.indexOf("?token=")):U},S=async E=>{const U=k(E);try{await navigator.clipboard.writeText(U)}catch{}},$=E=>{const U=[];return m("channel")&&E.channel&&U.push(`channel:${E.channel}`),m("agent")&&E.agentId&&U.push(`agent:${E.agentId}`),m("provider")&&(E.modelProvider||E.providerOverride)&&U.push(`provider:${E.modelProvider??E.providerOverride}`),m("model")&&E.model&&U.push(`model:${E.model}`),m("messages")&&E.usage?.messageCounts&&U.push(`msgs:${E.usage.messageCounts.total}`),m("tools")&&E.usage?.toolUsage&&U.push(`tools:${E.usage.toolUsage.totalCalls}`),m("errors")&&E.usage?.messageCounts&&U.push(`errors:${E.usage.messageCounts.errors}`),m("duration")&&E.usage?.durationMs&&U.push(`dur:${Gi(E.usage.durationMs,{spaced:!0})??"—"}`),U},A=E=>{const U=E.usage;if(!U)return 0;if(n.length>0&&U.dailyBreakdown&&U.dailyBreakdown.length>0){const oe=U.dailyBreakdown.filter(ae=>n.includes(ae.date));return s?oe.reduce((ae,X)=>ae+X.tokens,0):oe.reduce((ae,X)=>ae+X.cost,0)}return s?U.totalTokens??0:U.totalCost??0},C=[...e].toSorted((E,U)=>{switch(i){case"recent":return(U.updatedAt??0)-(E.updatedAt??0);case"messages":return(U.usage?.messageCounts?.total??0)-(E.usage?.messageCounts?.total??0);case"errors":return(U.usage?.messageCounts?.errors??0)-(E.usage?.messageCounts?.errors??0);case"cost":return A(U)-A(E);default:return A(U)-A(E)}}),T=o==="asc"?C.toReversed():C,_=T.reduce((E,U)=>E+A(U),0),I=T.length?_/T.length:0,W=T.reduce((E,U)=>E+(U.usage?.messageCounts?.errors??0),0),K=new Set(t),ne=T.filter(E=>K.has(E.key)),N=ne.length,H=new Map(T.map(E=>[E.key,E])),de=a.map(E=>H.get(E)).filter(E=>!!E);return r`
    <div class="card sessions-card">
      <div class="sessions-card-header">
        <div class="card-title">Sessions</div>
        <div class="sessions-card-count">
          ${e.length} shown${f!==e.length?` · ${f} total`:""}
        </div>
      </div>
      <div class="sessions-card-meta">
        <div class="sessions-card-stats">
          <span>${s?B(I):G(I)} avg</span>
          <span>${W} errors</span>
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
            @change=${E=>g(E.target.value)}
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
          @click=${()=>p(o==="desc"?"asc":"desc")}
          title=${o==="desc"?"Descending":"Ascending"}
        >
          ${o==="desc"?"↓":"↑"}
        </button>
        ${N>0?r`
                <button class="btn btn-sm sessions-action-btn sessions-clear-btn" @click=${d}>
                  Clear Selection
                </button>
              `:v}
      </div>
      ${l==="recent"?de.length===0?r`
                <div class="muted" style="padding: 20px; text-align: center">No recent sessions</div>
              `:r`
                <div class="session-bars" style="max-height: 220px; margin-top: 6px;">
                  ${de.map(E=>{const U=A(E),oe=K.has(E.key),ae=k(E),X=$(E);return r`
                      <div
                        class="session-bar-row ${oe?"selected":""}"
                        @click=${se=>c(E.key,se.shiftKey)}
                        title="${E.key}"
                      >
                        <div class="session-bar-label">
                          <div class="session-bar-title">${ae}</div>
                          ${X.length>0?r`<div class="session-bar-meta">${X.join(" · ")}</div>`:v}
                        </div>
                        <div class="session-bar-track" style="display: none;"></div>
                        <div class="session-bar-actions">
                          <button
                            class="session-copy-btn"
                            title="Copy session name"
                            @click=${se=>{se.stopPropagation(),S(E)}}
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
                  ${T.slice(0,50).map(E=>{const U=A(E),oe=t.includes(E.key),ae=k(E),X=$(E);return r`
                      <div
                        class="session-bar-row ${oe?"selected":""}"
                        @click=${se=>c(E.key,se.shiftKey)}
                        title="${E.key}"
                      >
                        <div class="session-bar-label">
                          <div class="session-bar-title">${ae}</div>
                          ${X.length>0?r`<div class="session-bar-meta">${X.join(" · ")}</div>`:v}
                        </div>
                        <div class="session-bar-track" style="display: none;"></div>
                        <div class="session-bar-actions">
                          <button
                            class="session-copy-btn"
                            title="Copy session name"
                            @click=${se=>{se.stopPropagation(),S(E)}}
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
                  ${ne.map(E=>{const U=A(E),oe=k(E),ae=$(E);return r`
                      <div
                        class="session-bar-row selected"
                        @click=${X=>c(E.key,X.shiftKey)}
                        title="${E.key}"
                      >
                        <div class="session-bar-label">
                          <div class="session-bar-title">${oe}</div>
                          ${ae.length>0?r`<div class="session-bar-meta">${ae.join(" · ")}</div>`:v}
                        </div>
                  <div class="session-bar-track" style="display: none;"></div>
                        <div class="session-bar-actions">
                          <button
                            class="session-copy-btn"
                            title="Copy session name"
                            @click=${X=>{X.stopPropagation(),S(E)}}
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
  `}function Iy(){return v}function My(e){const t=e.usage;if(!t)return r`
      <div class="muted">No usage data for this session.</div>
    `;const n=a=>a?new Date(a).toLocaleString():"—",s=[];e.channel&&s.push(`channel:${e.channel}`),e.agentId&&s.push(`agent:${e.agentId}`),(e.modelProvider||e.providerOverride)&&s.push(`provider:${e.modelProvider??e.providerOverride}`),e.model&&s.push(`model:${e.model}`);const i=t.toolUsage?.tools.slice(0,6).map(a=>({label:a.name,value:`${a.count}`,sub:"calls"}))??[],o=t.modelUsage?.slice(0,6).map(a=>({label:a.model??"unknown",value:G(a.totals.totalCost),sub:B(a.totals.totalTokens)}))??[];return r`
    ${s.length>0?r`<div class="usage-badges">${s.map(a=>r`<span class="usage-badge">${a}</span>`)}</div>`:v}
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
        <div class="session-summary-value">${Gi(t.durationMs,{spaced:!0})??"—"}</div>
        <div class="session-summary-meta">${n(t.firstActivity)} → ${n(t.lastActivity)}</div>
      </div>
    </div>
    <div class="usage-insights-grid" style="margin-top: 12px;">
      ${ht("Top Tools",i,"No tool calls")}
      ${ht("Model Mix",o,"No model data")}
    </div>
  `}function Ry(e,t,n,s,i,o,a,l,c,g,p,u,h,f,d,m,k,S,$,A,C,T,_){const I=e.label||e.key,W=I.length>50?I.slice(0,50)+"…":I,K=e.usage;return r`
    <div class="card session-detail-panel">
      <div class="session-detail-header">
        <div class="session-detail-header-left">
          <div class="session-detail-title">${W}</div>
        </div>
        <div class="session-detail-stats">
          ${K?r`
            <span><strong>${B(K.totalTokens)}</strong> tokens</span>
            <span><strong>${G(K.totalCost)}</strong></span>
          `:v}
        </div>
        <button class="session-close-btn" @click=${_} title="Close session details">×</button>
      </div>
      <div class="session-detail-content">
        ${My(e)}
        <div class="session-detail-row">
          ${Py(t,n,s,i,o,a,l,c,g)}
        </div>
        <div class="session-detail-bottom">
          ${Fy(p,u,h,f,d,m,k,S,$,A)}
          ${Dy(e.contextWeight,K,C,T)}
        </div>
      </div>
    </div>
  `}function Py(e,t,n,s,i,o,a,l,c){if(t)return r`
      <div class="session-timeseries-compact">
        <div class="muted" style="padding: 20px; text-align: center">Loading...</div>
      </div>
    `;if(!e||e.points.length<2)return r`
      <div class="session-timeseries-compact">
        <div class="muted" style="padding: 20px; text-align: center">No timeline data</div>
      </div>
    `;let g=e.points;if(a||l||c&&c.length>0){const H=a?new Date(a+"T00:00:00").getTime():0,de=l?new Date(l+"T23:59:59").getTime():1/0;g=e.points.filter(E=>{if(E.timestamp<H||E.timestamp>de)return!1;if(c&&c.length>0){const U=new Date(E.timestamp),oe=`${U.getFullYear()}-${String(U.getMonth()+1).padStart(2,"0")}-${String(U.getDate()).padStart(2,"0")}`;return c.includes(oe)}return!0})}if(g.length<2)return r`
      <div class="session-timeseries-compact">
        <div class="muted" style="padding: 20px; text-align: center">No data in range</div>
      </div>
    `;let p=0,u=0,h=0,f=0,d=0,m=0;g=g.map(H=>(p+=H.totalTokens,u+=H.cost,h+=H.output,f+=H.input,d+=H.cacheRead,m+=H.cacheWrite,{...H,cumulativeTokens:p,cumulativeCost:u}));const k=400,S=80,$={top:16,right:10,bottom:20,left:40},A=k-$.left-$.right,C=S-$.top-$.bottom,T=n==="cumulative",_=n==="per-turn"&&i==="by-type",I=h+f+d+m,W=g.map(H=>T?H.cumulativeTokens:_?H.input+H.output+H.cacheRead+H.cacheWrite:H.totalTokens),K=Math.max(...W,1),ne=Math.max(2,Math.min(8,A/g.length*.7)),N=Math.max(1,(A-ne*g.length)/(g.length-1||1));return r`
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
                      @click=${()=>o("total")}
                    >
                      Total
                    </button>
                    <button
                      class="toggle-btn ${i==="by-type"?"active":""}"
                      @click=${()=>o("by-type")}
                    >
                      By Type
                    </button>
                  </div>
                `}
        </div>
      </div>
      <svg viewBox="0 0 ${k} ${S+15}" class="timeseries-svg" style="width: 100%; height: auto;">
        <!-- Y axis -->
        <line x1="${$.left}" y1="${$.top}" x2="${$.left}" y2="${$.top+C}" stroke="var(--border)" />
        <!-- X axis -->
        <line x1="${$.left}" y1="${$.top+C}" x2="${k-$.right}" y2="${$.top+C}" stroke="var(--border)" />
        <!-- Y axis labels -->
        <text x="${$.left-4}" y="${$.top+4}" text-anchor="end" class="axis-label" style="font-size: 9px; fill: var(--text-muted)">${B(K)}</text>
        <text x="${$.left-4}" y="${$.top+C}" text-anchor="end" class="axis-label" style="font-size: 9px; fill: var(--text-muted)">0</text>
        <!-- X axis labels (first and last) -->
        ${g.length>0?$n`
          <text x="${$.left}" y="${$.top+C+12}" text-anchor="start" style="font-size: 8px; fill: var(--text-muted)">${new Date(g[0].timestamp).toLocaleDateString(void 0,{month:"short",day:"numeric"})}</text>
          <text x="${k-$.right}" y="${$.top+C+12}" text-anchor="end" style="font-size: 8px; fill: var(--text-muted)">${new Date(g[g.length-1].timestamp).toLocaleDateString(void 0,{month:"short",day:"numeric"})}</text>
        `:v}
        <!-- Bars -->
        ${g.map((H,de)=>{const E=W[de],U=$.left+de*(ne+N),oe=E/K*C,ae=$.top+C-oe,se=[new Date(H.timestamp).toLocaleDateString(void 0,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),`${B(E)} tokens`];_&&(se.push(`Output ${B(H.output)}`),se.push(`Input ${B(H.input)}`),se.push(`Cache write ${B(H.cacheWrite)}`),se.push(`Cache read ${B(H.cacheRead)}`));const M=se.join(" · ");if(!_)return $n`<rect x="${U}" y="${ae}" width="${ne}" height="${oe}" class="ts-bar" rx="1" style="cursor: pointer;"><title>${M}</title></rect>`;const P=[{value:H.output,class:"output"},{value:H.input,class:"input"},{value:H.cacheWrite,class:"cache-write"},{value:H.cacheRead,class:"cache-read"}];let D=$.top+C;return $n`
            ${P.map(j=>{if(j.value<=0||E<=0)return v;const $e=oe*(j.value/E);return D-=$e,$n`<rect x="${U}" y="${D}" width="${ne}" height="${$e}" class="ts-bar ${j.class}" rx="1"><title>${M}</title></rect>`})}
          `})}
      </svg>
      <div class="timeseries-summary">${g.length} msgs · ${B(p)} · ${G(u)}</div>
      ${_?r`
              <div style="margin-top: 8px;">
                <div class="card-title" style="font-size: 12px; margin-bottom: 6px;">Tokens by Type</div>
                <div class="cost-breakdown-bar" style="height: 18px;">
                  <div class="cost-segment output" style="width: ${pe(h,I).toFixed(1)}%"></div>
                  <div class="cost-segment input" style="width: ${pe(f,I).toFixed(1)}%"></div>
                  <div class="cost-segment cache-write" style="width: ${pe(m,I).toFixed(1)}%"></div>
                  <div class="cost-segment cache-read" style="width: ${pe(d,I).toFixed(1)}%"></div>
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
                <div class="cost-breakdown-total">Total: ${B(I)}</div>
              </div>
            `:v}
    </div>
  `}function Dy(e,t,n,s){if(!e)return r`
      <div class="context-details-panel">
        <div class="muted" style="padding: 20px; text-align: center">No context data</div>
      </div>
    `;const i=ct(e.systemPrompt.chars),o=ct(e.skills.promptChars),a=ct(e.tools.listChars+e.tools.schemaChars),l=ct(e.injectedWorkspaceFiles.reduce((A,C)=>A+C.injectedChars,0)),c=i+o+a+l;let g="";if(t&&t.totalTokens>0){const A=t.input+t.cacheRead;A>0&&(g=`~${Math.min(c/A*100,100).toFixed(0)}% of input`)}const p=e.skills.entries.toSorted((A,C)=>C.blockChars-A.blockChars),u=e.tools.entries.toSorted((A,C)=>C.summaryChars+C.schemaChars-(A.summaryChars+A.schemaChars)),h=e.injectedWorkspaceFiles.toSorted((A,C)=>C.injectedChars-A.injectedChars),f=4,d=n,m=d?p:p.slice(0,f),k=d?u:u.slice(0,f),S=d?h:h.slice(0,f),$=p.length>f||u.length>f||h.length>f;return r`
    <div class="context-details-panel">
      <div class="context-breakdown-header">
        <div class="card-title" style="font-size: 13px;">System Prompt Breakdown</div>
        ${$?r`<button class="context-expand-btn" @click=${s}>
                ${d?"Collapse":"Expand all"}
              </button>`:v}
      </div>
      <p class="context-weight-desc">${g||"Base context per message"}</p>
      <div class="context-stacked-bar">
        <div class="context-segment system" style="width: ${pe(i,c).toFixed(1)}%" title="System: ~${B(i)}"></div>
        <div class="context-segment skills" style="width: ${pe(o,c).toFixed(1)}%" title="Skills: ~${B(o)}"></div>
        <div class="context-segment tools" style="width: ${pe(a,c).toFixed(1)}%" title="Tools: ~${B(a)}"></div>
        <div class="context-segment files" style="width: ${pe(l,c).toFixed(1)}%" title="Files: ~${B(l)}"></div>
      </div>
      <div class="context-legend">
        <span class="legend-item"><span class="legend-dot system"></span>Sys ~${B(i)}</span>
        <span class="legend-item"><span class="legend-dot skills"></span>Skills ~${B(o)}</span>
        <span class="legend-item"><span class="legend-dot tools"></span>Tools ~${B(a)}</span>
        <span class="legend-item"><span class="legend-dot files"></span>Files ~${B(l)}</span>
      </div>
      <div class="context-total">Total: ~${B(c)}</div>
      <div class="context-breakdown-grid">
        ${p.length>0?(()=>{const A=p.length-m.length;return r`
                  <div class="context-breakdown-card">
                    <div class="context-breakdown-title">Skills (${p.length})</div>
                    <div class="context-breakdown-list">
                      ${m.map(C=>r`
                          <div class="context-breakdown-item">
                            <span class="mono">${C.name}</span>
                            <span class="muted">~${B(ct(C.blockChars))}</span>
                          </div>
                        `)}
                    </div>
                    ${A>0?r`<div class="context-breakdown-more">+${A} more</div>`:v}
                  </div>
                `})():v}
        ${u.length>0?(()=>{const A=u.length-k.length;return r`
                  <div class="context-breakdown-card">
                    <div class="context-breakdown-title">Tools (${u.length})</div>
                    <div class="context-breakdown-list">
                      ${k.map(C=>r`
                          <div class="context-breakdown-item">
                            <span class="mono">${C.name}</span>
                            <span class="muted">~${B(ct(C.summaryChars+C.schemaChars))}</span>
                          </div>
                        `)}
                    </div>
                    ${A>0?r`<div class="context-breakdown-more">+${A} more</div>`:v}
                  </div>
                `})():v}
        ${h.length>0?(()=>{const A=h.length-S.length;return r`
                  <div class="context-breakdown-card">
                    <div class="context-breakdown-title">Files (${h.length})</div>
                    <div class="context-breakdown-list">
                      ${S.map(C=>r`
                          <div class="context-breakdown-item">
                            <span class="mono">${C.name}</span>
                            <span class="muted">~${B(ct(C.injectedChars))}</span>
                          </div>
                        `)}
                    </div>
                    ${A>0?r`<div class="context-breakdown-more">+${A} more</div>`:v}
                  </div>
                `})():v}
      </div>
    </div>
  `}function Fy(e,t,n,s,i,o,a,l,c,g){if(t)return r`
      <div class="session-logs-compact">
        <div class="session-logs-header">Conversation</div>
        <div class="muted" style="padding: 20px; text-align: center">Loading...</div>
      </div>
    `;if(!e||e.length===0)return r`
      <div class="session-logs-compact">
        <div class="session-logs-header">Conversation</div>
        <div class="muted" style="padding: 20px; text-align: center">No messages</div>
      </div>
    `;const p=i.query.trim().toLowerCase(),u=e.map(S=>{const $=ry(S.content),A=$.cleanContent||S.content;return{log:S,toolInfo:$,cleanContent:A}}),h=Array.from(new Set(u.flatMap(S=>S.toolInfo.tools.map(([$])=>$)))).toSorted((S,$)=>S.localeCompare($)),f=u.filter(S=>!(i.roles.length>0&&!i.roles.includes(S.log.role)||i.hasTools&&S.toolInfo.tools.length===0||i.tools.length>0&&!S.toolInfo.tools.some(([A])=>i.tools.includes(A))||p&&!S.cleanContent.toLowerCase().includes(p))),d=i.roles.length>0||i.tools.length>0||i.hasTools||p?`${f.length} of ${e.length}`:`${e.length}`,m=new Set(i.roles),k=new Set(i.tools);return r`
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
          @change=${S=>o(Array.from(S.target.selectedOptions).map($=>$.value))}
        >
          <option value="user" ?selected=${m.has("user")}>User</option>
          <option value="assistant" ?selected=${m.has("assistant")}>Assistant</option>
          <option value="tool" ?selected=${m.has("tool")}>Tool</option>
          <option value="toolResult" ?selected=${m.has("toolResult")}>Tool result</option>
        </select>
        <select
          multiple
          size="4"
          @change=${S=>a(Array.from(S.target.selectedOptions).map($=>$.value))}
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
        <button class="btn btn-sm usage-action-btn usage-secondary-btn" @click=${g}>
          Clear
        </button>
      </div>
      <div class="session-logs-list">
        ${f.map(S=>{const{log:$,toolInfo:A,cleanContent:C}=S,T=$.role==="user"?"user":"assistant",_=$.role==="user"?"You":$.role==="assistant"?"Assistant":"Tool";return r`
          <div class="session-log-entry ${T}">
            <div class="session-log-meta">
              <span class="session-log-role">${_}</span>
              <span>${new Date($.timestamp).toLocaleString()}</span>
              ${$.tokens?r`<span>${B($.tokens)}</span>`:v}
            </div>
            <div class="session-log-content">${C}</div>
            ${A.tools.length>0?r`
                    <details class="session-log-tools" ?open=${n}>
                      <summary>${A.summary}</summary>
                      <div class="session-log-tools-list">
                        ${A.tools.map(([I,W])=>r`
                            <span class="session-log-tools-pill">${I} × ${W}</span>
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
  `}function Ny(e){if(e.loading&&!e.totals)return r`
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
    `;const t=e.chartMode==="tokens",n=e.query.trim().length>0,s=e.queryDraft.trim().length>0,i=[...e.sessions].toSorted((M,P)=>{const D=t?M.usage?.totalTokens??0:M.usage?.totalCost??0;return(t?P.usage?.totalTokens??0:P.usage?.totalCost??0)-D}),o=e.selectedDays.length>0?i.filter(M=>{if(M.usage?.activityDates?.length)return M.usage.activityDates.some(j=>e.selectedDays.includes(j));if(!M.updatedAt)return!1;const P=new Date(M.updatedAt),D=`${P.getFullYear()}-${String(P.getMonth()+1).padStart(2,"0")}-${String(P.getDate()).padStart(2,"0")}`;return e.selectedDays.includes(D)}):i,a=(M,P)=>{if(P.length===0)return!0;const D=M.usage,j=D?.firstActivity??M.updatedAt,$e=D?.lastActivity??M.updatedAt;if(!j||!$e)return!1;const J=Math.min(j,$e),Se=Math.max(j,$e);let ee=J;for(;ee<=Se;){const he=new Date(ee),Be=Io(he,e.timeZone);if(P.includes(Be))return!0;const Ue=Mo(he,e.timeZone);ee=Math.min(Ue.getTime(),Se)+1}return!1},l=e.selectedHours.length>0?o.filter(M=>a(M,e.selectedHours)):o,c=ay(l,e.query),g=c.sessions,p=c.warnings,u=$y(e.queryDraft,i,e.aggregates),h=Lo(e.query),f=M=>{const P=pt(M);return h.filter(D=>pt(D.key??"")===P).map(D=>D.value).filter(Boolean)},d=M=>{const P=new Set;for(const D of M)D&&P.add(D);return Array.from(P)},m=d(i.map(M=>M.agentId)).slice(0,12),k=d(i.map(M=>M.channel)).slice(0,12),S=d([...i.map(M=>M.modelProvider),...i.map(M=>M.providerOverride),...e.aggregates?.byProvider.map(M=>M.provider)??[]]).slice(0,12),$=d([...i.map(M=>M.model),...e.aggregates?.byModel.map(M=>M.model)??[]]).slice(0,12),A=d(e.aggregates?.tools.tools.map(M=>M.name)??[]).slice(0,12),C=e.selectedSessions.length===1?e.sessions.find(M=>M.key===e.selectedSessions[0])??g.find(M=>M.key===e.selectedSessions[0]):null,T=M=>M.reduce((P,D)=>(D.usage&&(P.input+=D.usage.input,P.output+=D.usage.output,P.cacheRead+=D.usage.cacheRead,P.cacheWrite+=D.usage.cacheWrite,P.totalTokens+=D.usage.totalTokens,P.totalCost+=D.usage.totalCost,P.inputCost+=D.usage.inputCost??0,P.outputCost+=D.usage.outputCost??0,P.cacheReadCost+=D.usage.cacheReadCost??0,P.cacheWriteCost+=D.usage.cacheWriteCost??0,P.missingCostEntries+=D.usage.missingCostEntries??0),P),{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,totalCost:0,inputCost:0,outputCost:0,cacheReadCost:0,cacheWriteCost:0,missingCostEntries:0}),_=M=>e.costDaily.filter(D=>M.includes(D.date)).reduce((D,j)=>(D.input+=j.input,D.output+=j.output,D.cacheRead+=j.cacheRead,D.cacheWrite+=j.cacheWrite,D.totalTokens+=j.totalTokens,D.totalCost+=j.totalCost,D.inputCost+=j.inputCost??0,D.outputCost+=j.outputCost??0,D.cacheReadCost+=j.cacheReadCost??0,D.cacheWriteCost+=j.cacheWriteCost??0,D),{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,totalCost:0,inputCost:0,outputCost:0,cacheReadCost:0,cacheWriteCost:0,missingCostEntries:0});let I,W;const K=i.length;if(e.selectedSessions.length>0){const M=g.filter(P=>e.selectedSessions.includes(P.key));I=T(M),W=M.length}else e.selectedDays.length>0&&e.selectedHours.length===0?(I=_(e.selectedDays),W=g.length):e.selectedHours.length>0||n?(I=T(g),W=g.length):(I=e.totals,W=K);const ne=e.selectedSessions.length>0?g.filter(M=>e.selectedSessions.includes(M.key)):n||e.selectedHours.length>0?g:e.selectedDays.length>0?o:i,N=by(ne,e.aggregates),H=e.selectedSessions.length>0?(()=>{const M=g.filter(D=>e.selectedSessions.includes(D.key)),P=new Set;for(const D of M)for(const j of D.usage?.activityDates??[])P.add(j);return P.size>0?e.costDaily.filter(D=>P.has(D.date)):e.costDaily})():e.costDaily,de=yy(ne,I,N),E=!e.loading&&!e.totals&&e.sessions.length===0,U=(I?.missingCostEntries??0)>0||(I?I.totalTokens>0&&I.totalCost===0&&I.input+I.output+I.cacheRead+I.cacheWrite>0:!1),oe=[{label:"Today",days:1},{label:"7d",days:7},{label:"30d",days:30}],ae=M=>{const P=new Date,D=new Date;D.setDate(D.getDate()-(M-1)),e.onStartDateChange(ii(D)),e.onEndDateChange(ii(P))},X=(M,P,D)=>{if(D.length===0)return v;const j=f(M),$e=new Set(j.map(ee=>pt(ee))),J=D.length>0&&D.every(ee=>$e.has(pt(ee))),Se=j.length;return r`
      <details
        class="usage-filter-select"
        @toggle=${ee=>{const he=ee.currentTarget;if(!he.open)return;const Be=Ue=>{Ue.composedPath().includes(he)||(he.open=!1,window.removeEventListener("click",Be,!0))};window.addEventListener("click",Be,!0)}}
      >
        <summary>
          <span>${P}</span>
          ${Se>0?r`<span class="usage-filter-badge">${Se}</span>`:r`
                  <span class="usage-filter-badge">All</span>
                `}
        </summary>
        <div class="usage-filter-popover">
          <div class="usage-filter-actions">
            <button
              class="btn btn-sm"
              @click=${ee=>{ee.preventDefault(),ee.stopPropagation(),e.onQueryDraftChange(Er(e.queryDraft,M,D))}}
              ?disabled=${J}
            >
              Select All
            </button>
            <button
              class="btn btn-sm"
              @click=${ee=>{ee.preventDefault(),ee.stopPropagation(),e.onQueryDraftChange(Er(e.queryDraft,M,[]))}}
              ?disabled=${Se===0}
            >
              Clear
            </button>
          </div>
          <div class="usage-filter-options">
            ${D.map(ee=>{const he=$e.has(pt(ee));return r`
                <label class="usage-filter-option">
                  <input
                    type="checkbox"
                    .checked=${he}
                    @change=${Be=>{const Ue=Be.target,st=`${M}:${ee}`;e.onQueryDraftChange(Ue.checked?Sy(e.queryDraft,st):_r(e.queryDraft,st))}}
                  />
                  <span>${ee}</span>
                </label>
              `})}
          </div>
        </div>
      </details>
    `},se=ii(new Date);return r`
    <style>${ly}</style>

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
          ${E?r`
                  <span class="usage-query-hint">Select a date range and click Refresh to load usage.</span>
                `:v}
        </div>
        <div class="usage-header-metrics">
          ${I?r`
                <span class="usage-metric-badge">
                  <strong>${B(I.totalTokens)}</strong> tokens
                </span>
                <span class="usage-metric-badge">
                  <strong>${G(I.totalCost)}</strong> cost
                </span>
                <span class="usage-metric-badge">
                  <strong>${W}</strong>
                  session${W!==1?"s":""}
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
            @toggle=${M=>{const P=M.currentTarget;if(!P.open)return;const D=j=>{j.composedPath().includes(P)||(P.open=!1,window.removeEventListener("click",D,!0))};window.addEventListener("click",D,!0)}}
          >
            <summary class="usage-export-button">Export ▾</summary>
            <div class="usage-export-popover">
              <div class="usage-export-list">
                <button
                  class="usage-export-item"
                  @click=${()=>oi(`winclaw-usage-sessions-${se}.csv`,xy(g),"text/csv")}
                  ?disabled=${g.length===0}
                >
                  Sessions CSV
                </button>
                <button
                  class="usage-export-item"
                  @click=${()=>oi(`winclaw-usage-daily-${se}.csv`,wy(H),"text/csv")}
                  ?disabled=${H.length===0}
                >
                  Daily CSV
                </button>
                <button
                  class="usage-export-item"
                  @click=${()=>oi(`winclaw-usage-${se}.json`,JSON.stringify({totals:I,sessions:g,daily:H,aggregates:N},null,2),"application/json")}
                  ?disabled=${g.length===0&&H.length===0}
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
          ${Ay(e.selectedDays,e.selectedHours,e.selectedSessions,e.sessions,e.onClearDays,e.onClearHours,e.onClearSessions,e.onClearFilters)}
          <div class="usage-presets">
            ${oe.map(M=>r`
                <button class="btn btn-sm" @click=${()=>ae(M.days)}>
                  ${M.label}
                </button>
              `)}
          </div>
          <input
            type="date"
            .value=${e.startDate}
            title="Start Date"
            @change=${M=>e.onStartDateChange(M.target.value)}
          />
          <span style="color: var(--text-muted);">to</span>
          <input
            type="date"
            .value=${e.endDate}
            title="End Date"
            @change=${M=>e.onEndDateChange(M.target.value)}
          />
          <select
            title="Time zone"
            .value=${e.timeZone}
            @change=${M=>e.onTimeZoneChange(M.target.value)}
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
            @input=${M=>e.onQueryDraftChange(M.target.value)}
            @keydown=${M=>{M.key==="Enter"&&(M.preventDefault(),e.onApplyQuery())}}
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
              ${n?`${g.length} of ${K} sessions match`:`${K} sessions in range`}
            </span>
          </div>
        </div>
        <div class="usage-filter-row">
          ${X("agent","Agent",m)}
          ${X("channel","Channel",k)}
          ${X("provider","Provider",S)}
          ${X("model","Model",$)}
          ${X("tool","Tool",A)}
          <span class="usage-query-hint">
            Tip: use filters or click bars to filter days.
          </span>
        </div>
        ${h.length>0?r`
                <div class="usage-query-chips">
                  ${h.map(M=>{const P=M.raw;return r`
                      <span class="usage-query-chip">
                        ${P}
                        <button
                          title="Remove filter"
                          @click=${()=>e.onQueryDraftChange(_r(e.queryDraft,P))}
                        >
                          ×
                        </button>
                      </span>
                    `})}
                </div>
              `:v}
        ${u.length>0?r`
                <div class="usage-query-suggestions">
                  ${u.map(M=>r`
                      <button
                        class="usage-query-suggestion"
                        @click=${()=>e.onQueryDraftChange(ky(e.queryDraft,M.value))}
                      >
                        ${M.label}
                      </button>
                    `)}
                </div>
              `:v}
        ${p.length>0?r`
                <div class="callout warning" style="margin-top: 8px;">
                  ${p.join(" · ")}
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

    ${Ey(I,N,de,U,uy(ne,e.timeZone),W,K)}

    ${fy(ne,e.timeZone,e.selectedHours,e.onSelectHour)}

    <!-- Two-column layout: Daily+Breakdown on left, Sessions on right -->
    <div class="usage-grid">
      <div class="usage-grid-left">
        <div class="card usage-left-card">
          ${Ty(H,e.selectedDays,e.chartMode,e.dailyChartMode,e.onDailyChartModeChange,e.onSelectDay)}
          ${I?_y(I,e.chartMode):v}
        </div>
      </div>
      <div class="usage-grid-right">
        ${Ly(g,e.selectedSessions,e.selectedDays,t,e.sessionSort,e.sessionSortDir,e.recentSessions,e.sessionsTab,e.onSelectSession,e.onSessionSortChange,e.onSessionSortDirChange,e.onSessionsTabChange,e.visibleColumns,K,e.onClearSessions)}
      </div>
    </div>

    <!-- Session Detail Panel (when selected) or Empty State -->
    ${C?Ry(C,e.timeSeries,e.timeSeriesLoading,e.timeSeriesMode,e.onTimeSeriesModeChange,e.timeSeriesBreakdownMode,e.onTimeSeriesBreakdownChange,e.startDate,e.endDate,e.selectedDays,e.sessionLogs,e.sessionLogsLoading,e.sessionLogsExpanded,e.onToggleSessionLogsExpanded,{roles:e.logFilterRoles,tools:e.logFilterTools,hasTools:e.logFilterHasTools,query:e.logFilterQuery},e.onLogFilterRolesChange,e.onLogFilterToolsChange,e.onLogFilterHasToolsChange,e.onLogFilterQueryChange,e.onLogFilterClear,e.contextExpanded,e.onToggleContextExpanded,e.onClearSessions):Iy()}
  `}let ai=null;const Ir=e=>{ai&&clearTimeout(ai),ai=window.setTimeout(()=>{jl(e)},400)},Oy=/^data:/i,By=/^https?:\/\//i;async function Dn(e){const s=`agent:${zi(e.sessionKey)?.agentId??"main"}:${hs()}`;e.addChatSession(s),e.chatMessages=[],e.chatToolMessages=[],e.chatStream=null,e.chatStreamStartedAt=null,e.chatRunId=null,e.chatQueue=[],e.chatMessage="",e.chatAttachments=[],e.resetToolStream(),e.resetChatScroll(),e.sessionKey=s,e.applySettings({...e.settings,sessionKey:s,lastActiveSessionKey:s,openChatSessions:e.openChatSessions}),e.loadAssistantIdentity(),await Xe(e),kt(e)}function Tc(e){const t=e.agentsList?.agents??[],s=zi(e.sessionKey)?.agentId??e.agentsList?.defaultId??"main",o=t.find(l=>l.id===s)?.identity,a=o?.avatarUrl??o?.avatar;if(a)return Oy.test(a)||By.test(a)?a:o?.avatarUrl}function Uy(e,t){const n=Tc(e),s=e.chatAvatarUrl??n??null,i=e.connected?null:"Disconnected from gateway.",o=e.onboarding?!1:e.settings.chatShowThinking;return{layoutMode:e.dhLayoutMode??"split",orientation:window.innerWidth>=768?"landscape":"portrait",assistantName:e.assistantName??"WinClaw",dhOnline:e.dhConnectionStatus==="connected",basePath:e.basePath??"",onSetLayoutMode:a=>{e.dhLayoutMode=a},onOpenSettings:()=>e.openTabFromPalette("config"),onToggleTheme:()=>{const a=e.themeResolved==="dark"?"light":"dark";e.setTheme(a)},dhPanel:{isConnected:e.dhConnectionStatus==="connected",connectionStatus:e.dhConnectionStatus??"disconnected",errorMessage:e.dhErrorMessage??null,micEnabled:e.dhMicEnabled??!1,cameraEnabled:e.dhCameraEnabled??!1,subtitleVisible:e.dhSubtitleVisible??!0,isThinking:e.dhIsThinking??!1,currentSubtitle:e.dhCurrentSubtitle??"",onStart:()=>{if(e.dhConnectionStatus==="connecting"||e.dhConnectionStatus==="connected")return;e.dhConnectionStatus="connecting",e.dhErrorMessage=null;const a=e.settings?.token??"";fetch("/api/dh/health",{headers:a?{Authorization:`Bearer ${a}`}:{}}).then(async l=>{if(!l.ok)throw new Error(`DH health check failed: ${l.status} ${l.statusText}`);const g=(await l.json()).wsPort;if(!g)throw new Error("DH health response missing wsPort");const p=new Wp({onConnectionStatusChange:f=>{e.dhConnectionStatus=f,f==="disconnected"&&(e.dhCurrentSubtitle="")},onSubtitleUpdate:(f,d)=>{d?e.dhCurrentSubtitle=(e.dhCurrentSubtitle??"")+f:e.dhCurrentSubtitle=f},onErrorMessage:f=>{e.dhErrorMessage=f},onUserTranscript:f=>{},onThinkingChange:f=>{e.dhIsThinking=f}});e.dhController=p,window.__dhController=p,console.log("[DH] Controller stored on window, starting session..."),await p.start(g,a),console.log("[DH] Session started, recorder:",!!p.recorder);const h=window.__dhCameraStream;h&&h.active&&e.dhCameraEnabled&&setTimeout(()=>{const f=document.getElementById("camera-preview");f&&!f.srcObject&&(f.srcObject=h)},200)}).catch(l=>{console.error("[DH] Session start failed:",l),e.dhConnectionStatus="error",e.dhErrorMessage=l instanceof Error?l.message:"Failed to start DH session",e.dhController=void 0,window.__dhController=null})},onStop:()=>{const a=e.dhController;e.dhCurrentSubtitle="",a?a.stop():e.dhConnectionStatus="disconnected"},onToggleMic:()=>{const a=!(e.dhMicEnabled??!1);e.dhMicEnabled=a;try{const c=window.__dhController;if(c){for(const g of Object.values(c))if(g&&typeof g=="object"&&"setMuted"in g){g.setMuted(!a);break}}}catch(l){console.error("[Mic] Toggle error:",l)}},onToggleCamera:()=>{try{const l=window.__dhController;if(!l||typeof l.toggleCamera!="function"){console.warn("[Camera] Controller not ready — start a DH session first");return}const c=l.toggleCamera();e.dhCameraEnabled=c,console.log(`[Camera] Toggled via controller → enabled=${c}`)}catch(a){console.error("[Camera] Toggle failed:",a),e.dhCameraEnabled=!1}},onToggleSubtitle:()=>{e.dhSubtitleVisible=!(e.dhSubtitleVisible??!0)},onVideoDoubleClick:async()=>{if(document.fullscreenElement)await document.exitFullscreen();else{const a=document.querySelector(".panel-dh");a&&await a.requestFullscreen()}},selectedVoice:e.dhSelectedVoice??"longxiaochun",onVoiceChange:a=>{e.dhSelectedVoice=a,window.__dhSelectedVoice=a}},chatPanel:{sessionKey:e.sessionKey,onSessionKeyChange:a=>{e.sessionKey=a,e.chatMessage="",e.chatAttachments=[],e.chatStream=null,e.chatStreamStartedAt=null,e.chatRunId=null,e.chatQueue=[],e.resetToolStream(),e.resetChatScroll(),e.applySettings({...e.settings,sessionKey:a,lastActiveSessionKey:a}),e.loadAssistantIdentity(),Xe(e),kt(e)},thinkingLevel:e.chatThinkingLevel,showThinking:o,loading:e.chatLoading,sending:e.chatSending,canAbort:!!e.chatRunId,compactionStatus:e.compactionStatus,assistantAvatarUrl:s,messages:e.chatMessages,toolMessages:e.chatToolMessages,stream:e.chatStream,streamStartedAt:e.chatStreamStartedAt,draft:e.chatMessage,queue:e.chatQueue,connected:e.connected,canSend:e.connected,disabledReason:i,error:e.lastError,sessions:e.sessionsResult,focusMode:!1,sidebarOpen:e.sidebarOpen,sidebarContent:e.sidebarContent,sidebarError:e.sidebarError,sidebarMode:e.sidebarMode,splitRatio:e.splitRatio,execLogEntries:e.execLogEntries,execLogActive:e.execLogActive,execLogAutoScroll:e.execLogAutoScroll,assistantName:e.assistantName,assistantAvatar:e.assistantAvatar,attachments:e.chatAttachments,onAttachmentsChange:a=>e.chatAttachments=a,showNewMessages:e.chatNewMessagesBelow&&!e.chatManualRefreshInFlight,onScrollToBottom:()=>e.scrollToBottom(),onRefresh:()=>(e.resetToolStream(),Promise.all([Xe(e),kt(e)])),onToggleFocusMode:()=>{},onChatScroll:a=>e.handleChatScroll(a),onDraftChange:a=>e.chatMessage=a,onSend:()=>e.handleSendChat(),onAbort:()=>{e.handleAbortChat()},onQueueRemove:a=>e.removeQueuedMessage(a),onNewSession:t,onOpenSidebar:a=>e.handleOpenSidebar(a),onCloseSidebar:()=>e.handleCloseSidebar(),onSplitRatioChange:a=>e.handleSplitRatioChange(a),onOpenExecLog:()=>e.handleOpenExecLog(),onCloseExecLog:()=>e.handleCloseExecLog(),onClearExecLog:()=>e.handleClearExecLog(),onToggleExecLogAutoScroll:()=>e.handleToggleExecLogAutoScroll()}}}function zy(e){const t=e.sessionsResult?.sessions;if(!t)return;const n=t.find(s=>s.key===e.sessionKey);return n?.derivedTitle||n?.displayName||n?.label||void 0}function Hy(e){const t=e.presenceEntries.length,n=e.sessionsResult?.count??null,s=e.cronStatus?.nextWakeAtMs??null,i=e.connected?null:"Disconnected from gateway.",o=e.tab==="chat",a=e.tab==="digital-human",l=o&&(e.settings.chatFocusMode||e.onboarding),c=e.onboarding?!1:e.settings.chatShowThinking,g=Tc(e),p=e.chatAvatarUrl??g??null,u=e.configForm??e.configSnapshot?.config,h=pn(e.basePath??""),f=e.agentsSelectedId??e.agentsList?.defaultId??e.agentsList?.agents?.[0]?.id??null;return r`
    <div class="shell ${o?"shell--chat":""} ${a?"shell--dh":""} ${e.onboarding?"shell--onboarding":""}">
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
          ${Ub({className:"topbar-lang"})}
          <button class="topbar-cmd-btn" @click=${()=>e.toggleCommandPalette()} title="Command Palette (Ctrl+K)">
            Ctrl+K
          </button>
          <button class="topbar-add-btn" @click=${()=>e.toggleCommandPalette()} title="Open command palette">
            +
          </button>
        </div>
      </header>
      <main class="content ${o?"content--chat":""}">
        ${Tp({activeTab:e.tab,openTabs:e.openTabs,chatSessionTitle:zy(e),onTabSelect:d=>e.openTabFromPalette(d),onTabClose:d=>e.closeTab(d),onAddTab:()=>e.toggleCommandPalette()})}
        ${o?v:r`
              <section class="content-header">
                <div>
                  ${e.tab==="usage"?v:r`<div class="page-title">${mi(e.tab)}</div>`}
                  ${e.tab==="usage"?v:r`<div class="page-sub">${Yu(e.tab)}</div>`}
                </div>
                <div class="page-meta">
                  ${e.lastError?r`<div class="pill danger">${e.lastError}</div>`:v}
                </div>
              </section>
            `}

        ${e.tab==="overview"?kb({connected:e.connected,hello:e.hello,settings:e.settings,password:e.password,lastError:e.lastError,presenceCount:t,sessionsCount:n,cronEnabled:e.cronStatus?.enabled??null,cronNext:s,lastChannelsRefresh:e.channelsLastSuccess,onSettingsChange:d=>e.applySettings(d),onPasswordChange:d=>e.password=d,onSessionKeyChange:d=>{e.sessionKey=d,e.chatMessage="",e.resetToolStream(),e.applySettings({...e.settings,sessionKey:d,lastActiveSessionKey:d}),e.loadAssistantIdentity()},onConnect:()=>e.connect(),onRefresh:()=>e.loadOverview()}):v}

        ${e.tab==="channels"?df({connected:e.connected,loading:e.channelsLoading,snapshot:e.channelsSnapshot,lastError:e.channelsError,lastSuccessAt:e.channelsLastSuccess,whatsappMessage:e.whatsappLoginMessage,whatsappQrDataUrl:e.whatsappLoginQrDataUrl,whatsappConnected:e.whatsappLoginConnected,whatsappBusy:e.whatsappBusy,configSchema:e.configSchema,configSchemaLoading:e.configSchemaLoading,configForm:e.configForm,configUiHints:e.configUiHints,configSaving:e.configSaving,configFormDirty:e.configFormDirty,nostrProfileFormState:e.nostrProfileFormState,nostrProfileAccountId:e.nostrProfileAccountId,onRefresh:d=>be(e,d),onWhatsAppStart:d=>e.handleWhatsAppStart(d),onWhatsAppWait:()=>e.handleWhatsAppWait(),onWhatsAppLogout:()=>e.handleWhatsAppLogout(),onConfigPatch:(d,m)=>ke(e,d,m),onConfigSave:()=>e.handleChannelConfigSave(),onConfigReload:()=>e.handleChannelConfigReload(),onNostrProfileEdit:(d,m)=>e.handleNostrProfileEdit(d,m),onNostrProfileCancel:()=>e.handleNostrProfileCancel(),onNostrProfileFieldChange:(d,m)=>e.handleNostrProfileFieldChange(d,m),onNostrProfileSave:()=>e.handleNostrProfileSave(),onNostrProfileImport:()=>e.handleNostrProfileImport(),onNostrProfileToggleAdvanced:()=>e.handleNostrProfileToggleAdvanced()}):v}

        ${e.tab==="instances"?qv({loading:e.presenceLoading,entries:e.presenceEntries,lastError:e.presenceError,statusMessage:e.presenceStatus,onRefresh:()=>io(e)}):v}

        ${e.tab==="sessions"?Yb({loading:e.sessionsLoading,result:e.sessionsResult,error:e.sessionsError,activeMinutes:e.sessionsFilterActive,limit:e.sessionsFilterLimit,includeGlobal:e.sessionsIncludeGlobal,includeUnknown:e.sessionsIncludeUnknown,basePath:e.basePath,onFiltersChange:d=>{e.sessionsFilterActive=d.activeMinutes,e.sessionsFilterLimit=d.limit,e.sessionsIncludeGlobal=d.includeGlobal,e.sessionsIncludeUnknown=d.includeUnknown},onRefresh:()=>nt(e),onPatch:(d,m)=>oo(e,d,m),onDelete:d=>ju(e,d)}):v}

        ${e.tab==="usage"?Ny({loading:e.usageLoading,error:e.usageError,startDate:e.usageStartDate,endDate:e.usageEndDate,sessions:e.usageResult?.sessions??[],sessionsLimitReached:(e.usageResult?.sessions?.length??0)>=1e3,totals:e.usageResult?.totals??null,aggregates:e.usageResult?.aggregates??null,costDaily:e.usageCostSummary?.daily??[],selectedSessions:e.usageSelectedSessions,selectedDays:e.usageSelectedDays,selectedHours:e.usageSelectedHours,chartMode:e.usageChartMode,dailyChartMode:e.usageDailyChartMode,timeSeriesMode:e.usageTimeSeriesMode,timeSeriesBreakdownMode:e.usageTimeSeriesBreakdownMode,timeSeries:e.usageTimeSeries,timeSeriesLoading:e.usageTimeSeriesLoading,sessionLogs:e.usageSessionLogs,sessionLogsLoading:e.usageSessionLogsLoading,sessionLogsExpanded:e.usageSessionLogsExpanded,logFilterRoles:e.usageLogFilterRoles,logFilterTools:e.usageLogFilterTools,logFilterHasTools:e.usageLogFilterHasTools,logFilterQuery:e.usageLogFilterQuery,query:e.usageQuery,queryDraft:e.usageQueryDraft,sessionSort:e.usageSessionSort,sessionSortDir:e.usageSessionSortDir,recentSessions:e.usageRecentSessions,sessionsTab:e.usageSessionsTab,visibleColumns:e.usageVisibleColumns,timeZone:e.usageTimeZone,contextExpanded:e.usageContextExpanded,headerPinned:e.usageHeaderPinned,onStartDateChange:d=>{e.usageStartDate=d,e.usageSelectedDays=[],e.usageSelectedHours=[],e.usageSelectedSessions=[],Ir(e)},onEndDateChange:d=>{e.usageEndDate=d,e.usageSelectedDays=[],e.usageSelectedHours=[],e.usageSelectedSessions=[],Ir(e)},onRefresh:()=>jl(e),onTimeZoneChange:d=>{e.usageTimeZone=d},onToggleContextExpanded:()=>{e.usageContextExpanded=!e.usageContextExpanded},onToggleSessionLogsExpanded:()=>{e.usageSessionLogsExpanded=!e.usageSessionLogsExpanded},onLogFilterRolesChange:d=>{e.usageLogFilterRoles=d},onLogFilterToolsChange:d=>{e.usageLogFilterTools=d},onLogFilterHasToolsChange:d=>{e.usageLogFilterHasTools=d},onLogFilterQueryChange:d=>{e.usageLogFilterQuery=d},onLogFilterClear:()=>{e.usageLogFilterRoles=[],e.usageLogFilterTools=[],e.usageLogFilterHasTools=!1,e.usageLogFilterQuery=""},onToggleHeaderPinned:()=>{e.usageHeaderPinned=!e.usageHeaderPinned},onSelectHour:(d,m)=>{if(m&&e.usageSelectedHours.length>0){const k=Array.from({length:24},(C,T)=>T),S=e.usageSelectedHours[e.usageSelectedHours.length-1],$=k.indexOf(S),A=k.indexOf(d);if($!==-1&&A!==-1){const[C,T]=$<A?[$,A]:[A,$],_=k.slice(C,T+1);e.usageSelectedHours=[...new Set([...e.usageSelectedHours,..._])]}}else e.usageSelectedHours.includes(d)?e.usageSelectedHours=e.usageSelectedHours.filter(k=>k!==d):e.usageSelectedHours=[...e.usageSelectedHours,d]},onQueryDraftChange:d=>{e.usageQueryDraft=d,e.usageQueryDebounceTimer&&window.clearTimeout(e.usageQueryDebounceTimer),e.usageQueryDebounceTimer=window.setTimeout(()=>{e.usageQuery=e.usageQueryDraft,e.usageQueryDebounceTimer=null},250)},onApplyQuery:()=>{e.usageQueryDebounceTimer&&(window.clearTimeout(e.usageQueryDebounceTimer),e.usageQueryDebounceTimer=null),e.usageQuery=e.usageQueryDraft},onClearQuery:()=>{e.usageQueryDebounceTimer&&(window.clearTimeout(e.usageQueryDebounceTimer),e.usageQueryDebounceTimer=null),e.usageQueryDraft="",e.usageQuery=""},onSessionSortChange:d=>{e.usageSessionSort=d},onSessionSortDirChange:d=>{e.usageSessionSortDir=d},onSessionsTabChange:d=>{e.usageSessionsTab=d},onToggleColumn:d=>{e.usageVisibleColumns.includes(d)?e.usageVisibleColumns=e.usageVisibleColumns.filter(m=>m!==d):e.usageVisibleColumns=[...e.usageVisibleColumns,d]},onSelectSession:(d,m)=>{if(e.usageTimeSeries=null,e.usageSessionLogs=null,e.usageRecentSessions=[d,...e.usageRecentSessions.filter(k=>k!==d)].slice(0,8),m&&e.usageSelectedSessions.length>0){const k=e.usageChartMode==="tokens",$=[...e.usageResult?.sessions??[]].toSorted((_,I)=>{const W=k?_.usage?.totalTokens??0:_.usage?.totalCost??0;return(k?I.usage?.totalTokens??0:I.usage?.totalCost??0)-W}).map(_=>_.key),A=e.usageSelectedSessions[e.usageSelectedSessions.length-1],C=$.indexOf(A),T=$.indexOf(d);if(C!==-1&&T!==-1){const[_,I]=C<T?[C,T]:[T,C],W=$.slice(_,I+1),K=[...new Set([...e.usageSelectedSessions,...W])];e.usageSelectedSessions=K}}else e.usageSelectedSessions.length===1&&e.usageSelectedSessions[0]===d?e.usageSelectedSessions=[]:e.usageSelectedSessions=[d];e.usageSelectedSessions.length===1&&(Ip(e,e.usageSelectedSessions[0]),Mp(e,e.usageSelectedSessions[0]))},onSelectDay:(d,m)=>{if(m&&e.usageSelectedDays.length>0){const k=(e.usageCostSummary?.daily??[]).map(C=>C.date),S=e.usageSelectedDays[e.usageSelectedDays.length-1],$=k.indexOf(S),A=k.indexOf(d);if($!==-1&&A!==-1){const[C,T]=$<A?[$,A]:[A,$],_=k.slice(C,T+1),I=[...new Set([...e.usageSelectedDays,..._])];e.usageSelectedDays=I}}else e.usageSelectedDays.includes(d)?e.usageSelectedDays=e.usageSelectedDays.filter(k=>k!==d):e.usageSelectedDays=[d]},onChartModeChange:d=>{e.usageChartMode=d},onDailyChartModeChange:d=>{e.usageDailyChartMode=d},onTimeSeriesModeChange:d=>{e.usageTimeSeriesMode=d},onTimeSeriesBreakdownChange:d=>{e.usageTimeSeriesBreakdownMode=d},onClearDays:()=>{e.usageSelectedDays=[]},onClearHours:()=>{e.usageSelectedHours=[]},onClearSessions:()=>{e.usageSelectedSessions=[],e.usageTimeSeries=null,e.usageSessionLogs=null},onClearFilters:()=>{e.usageSelectedDays=[],e.usageSelectedHours=[],e.usageSelectedSessions=[],e.usageTimeSeries=null,e.usageSessionLogs=null}}):v}

        ${e.tab==="cron"?Nv({basePath:e.basePath,loading:e.cronLoading,status:e.cronStatus,jobs:e.cronJobs,error:e.cronError,busy:e.cronBusy,form:e.cronForm,channels:e.channelsSnapshot?.channelMeta?.length?e.channelsSnapshot.channelMeta.map(d=>d.id):e.channelsSnapshot?.channelOrder??[],channelLabels:e.channelsSnapshot?.channelLabels??{},channelMeta:e.channelsSnapshot?.channelMeta??[],runsJobId:e.cronRunsJobId,runs:e.cronRuns,onFormChange:d=>e.cronForm={...e.cronForm,...d},onRefresh:()=>e.loadCron(),onAdd:()=>eu(e),onToggle:(d,m)=>tu(e,d,m),onRun:d=>nu(e,d),onRemove:d=>su(e,d),onLoadRuns:d=>Zr(e,d)}):v}

        ${e.tab==="agents"?fh({loading:e.agentsLoading,error:e.agentsError,agentsList:e.agentsList,selectedAgentId:f,activePanel:e.agentsPanel,configForm:u,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configFormDirty,channelsLoading:e.channelsLoading,channelsError:e.channelsError,channelsSnapshot:e.channelsSnapshot,channelsLastSuccess:e.channelsLastSuccess,cronLoading:e.cronLoading,cronStatus:e.cronStatus,cronJobs:e.cronJobs,cronError:e.cronError,agentFilesLoading:e.agentFilesLoading,agentFilesError:e.agentFilesError,agentFilesList:e.agentFilesList,agentFileActive:e.agentFileActive,agentFileContents:e.agentFileContents,agentFileDrafts:e.agentFileDrafts,agentFileSaving:e.agentFileSaving,agentIdentityLoading:e.agentIdentityLoading,agentIdentityError:e.agentIdentityError,agentIdentityById:e.agentIdentityById,agentSkillsLoading:e.agentSkillsLoading,agentSkillsReport:e.agentSkillsReport,agentSkillsError:e.agentSkillsError,agentSkillsAgentId:e.agentSkillsAgentId,skillsFilter:e.skillsFilter,onRefresh:async()=>{await qi(e);const d=e.agentsList?.agents?.map(m=>m.id)??[];d.length>0&&Yr(e,d)},onSelectAgent:d=>{e.agentsSelectedId!==d&&(e.agentsSelectedId=d,e.agentFilesList=null,e.agentFilesError=null,e.agentFilesLoading=!1,e.agentFileActive=null,e.agentFileContents={},e.agentFileDrafts={},e.agentSkillsReport=null,e.agentSkillsError=null,e.agentSkillsAgentId=null,Qr(e,d),e.agentsPanel==="files"&&qs(e,d),e.agentsPanel==="skills"&&Bn(e,d))},onSelectPanel:d=>{e.agentsPanel=d,d==="files"&&f&&e.agentFilesList?.agentId!==f&&(e.agentFilesList=null,e.agentFilesError=null,e.agentFileActive=null,e.agentFileContents={},e.agentFileDrafts={},qs(e,f)),d==="skills"&&f&&Bn(e,f),d==="channels"&&be(e,!1),d==="cron"&&e.loadCron()},onLoadFiles:d=>qs(e,d),onSelectFile:d=>{e.agentFileActive=d,f&&Ep(e,f,d)},onFileDraftChange:(d,m)=>{e.agentFileDrafts={...e.agentFileDrafts,[d]:m}},onFileReset:d=>{const m=e.agentFileContents[d]??"";e.agentFileDrafts={...e.agentFileDrafts,[d]:m}},onFileSave:d=>{if(!f)return;const m=e.agentFileDrafts[d]??e.agentFileContents[d]??"";Lp(e,f,d,m)},onToolsProfileChange:(d,m,k)=>{if(!u)return;const S=u.agents?.list;if(!Array.isArray(S))return;const $=S.findIndex(C=>C&&typeof C=="object"&&"id"in C&&C.id===d);if($<0)return;const A=["agents","list",$,"tools"];m?ke(e,[...A,"profile"],m):Ke(e,[...A,"profile"]),k&&Ke(e,[...A,"allow"])},onToolsOverridesChange:(d,m,k)=>{if(!u)return;const S=u.agents?.list;if(!Array.isArray(S))return;const $=S.findIndex(C=>C&&typeof C=="object"&&"id"in C&&C.id===d);if($<0)return;const A=["agents","list",$,"tools"];m.length>0?ke(e,[...A,"alsoAllow"],m):Ke(e,[...A,"alsoAllow"]),k.length>0?ke(e,[...A,"deny"],k):Ke(e,[...A,"deny"])},onConfigReload:()=>Ie(e),onConfigSave:()=>On(e),onChannelsRefresh:()=>be(e,!1),onCronRefresh:()=>e.loadCron(),onSkillsFilterChange:d=>e.skillsFilter=d,onSkillsRefresh:()=>{f&&Bn(e,f)},onAgentSkillToggle:(d,m,k)=>{if(!u)return;const S=u.agents?.list;if(!Array.isArray(S))return;const $=S.findIndex(K=>K&&typeof K=="object"&&"id"in K&&K.id===d);if($<0)return;const A=S[$],C=m.trim();if(!C)return;const T=e.agentSkillsReport?.skills?.map(K=>K.name).filter(Boolean)??[],I=(Array.isArray(A.skills)?A.skills.map(K=>String(K).trim()).filter(Boolean):void 0)??T,W=new Set(I);k?W.add(C):W.delete(C),ke(e,["agents","list",$,"skills"],[...W])},onAgentSkillsClear:d=>{if(!u)return;const m=u.agents?.list;if(!Array.isArray(m))return;const k=m.findIndex(S=>S&&typeof S=="object"&&"id"in S&&S.id===d);k<0||Ke(e,["agents","list",k,"skills"])},onAgentSkillsDisableAll:d=>{if(!u)return;const m=u.agents?.list;if(!Array.isArray(m))return;const k=m.findIndex(S=>S&&typeof S=="object"&&"id"in S&&S.id===d);k<0||ke(e,["agents","list",k,"skills"],[])},onModelChange:(d,m)=>{if(!u)return;const k=u.agents?.list;if(!Array.isArray(k))return;const S=k.findIndex(T=>T&&typeof T=="object"&&"id"in T&&T.id===d);if(S<0)return;const $=["agents","list",S,"model"];if(!m){Ke(e,$);return}const C=k[S]?.model;if(C&&typeof C=="object"&&!Array.isArray(C)){const T=C.fallbacks,_={primary:m,...Array.isArray(T)?{fallbacks:T}:{}};ke(e,$,_)}else ke(e,$,m)},onModelFallbacksChange:(d,m)=>{if(!u)return;const k=u.agents?.list;if(!Array.isArray(k))return;const S=k.findIndex(K=>K&&typeof K=="object"&&"id"in K&&K.id===d);if(S<0)return;const $=["agents","list",S,"model"],A=k[S],C=m.map(K=>K.trim()).filter(Boolean),T=A.model,I=(()=>{if(typeof T=="string")return T.trim()||null;if(T&&typeof T=="object"&&!Array.isArray(T)){const K=T.primary;if(typeof K=="string")return K.trim()||null}return null})();if(C.length===0){I?ke(e,$,I):Ke(e,$);return}ke(e,$,I?{primary:I,fallbacks:C}:{fallbacks:C})}}):v}

        ${e.tab==="skills"?Xb({loading:e.skillsLoading,report:e.skillsReport,error:e.skillsError,filter:e.skillsFilter,edits:e.skillEdits,messages:e.skillMessages,busyKey:e.skillsBusyKey,onFilterChange:d=>e.skillsFilter=d,onRefresh:()=>gn(e,{clearMessages:!0}),onToggle:(d,m)=>Wu(e,d,m),onEdit:(d,m)=>Ku(e,d,m),onSaveKey:d=>Vu(e,d),onInstall:(d,m,k)=>qu(e,d,m,k)}):v}

        ${e.tab==="nodes"?Zv({loading:e.nodesLoading,nodes:e.nodes,devicesLoading:e.devicesLoading,devicesError:e.devicesError,devicesList:e.devicesList,configForm:e.configForm??e.configSnapshot?.config,configLoading:e.configLoading,configSaving:e.configSaving,configDirty:e.configFormDirty,configFormMode:e.configFormMode,execApprovalsLoading:e.execApprovalsLoading,execApprovalsSaving:e.execApprovalsSaving,execApprovalsDirty:e.execApprovalsDirty,execApprovalsSnapshot:e.execApprovalsSnapshot,execApprovalsForm:e.execApprovalsForm,execApprovalsSelectedAgent:e.execApprovalsSelectedAgent,execApprovalsTarget:e.execApprovalsTarget,execApprovalsTargetNodeId:e.execApprovalsTargetNodeId,onRefresh:()=>ls(e),onDevicesRefresh:()=>tt(e),onDeviceApprove:d=>Iu(e,d),onDeviceReject:d=>Mu(e,d),onDeviceRotate:(d,m,k)=>Ru(e,{deviceId:d,role:m,scopes:k}),onDeviceRevoke:(d,m)=>Pu(e,{deviceId:d,role:m}),onLoadConfig:()=>Ie(e),onLoadExecApprovals:()=>{const d=e.execApprovalsTarget==="node"&&e.execApprovalsTargetNodeId?{kind:"node",nodeId:e.execApprovalsTargetNodeId}:{kind:"gateway"};return no(e,d)},onBindDefault:d=>{d?ke(e,["tools","exec","node"],d):Ke(e,["tools","exec","node"])},onBindAgent:(d,m)=>{const k=["agents","list",d,"tools","exec","node"];m?ke(e,k,m):Ke(e,k)},onSaveBindings:()=>On(e),onExecApprovalsTargetChange:(d,m)=>{e.execApprovalsTarget=d,e.execApprovalsTargetNodeId=m,e.execApprovalsSnapshot=null,e.execApprovalsForm=null,e.execApprovalsDirty=!1,e.execApprovalsSelectedAgent=null},onExecApprovalsSelectAgent:d=>{e.execApprovalsSelectedAgent=d},onExecApprovalsPatch:(d,m)=>Bu(e,d,m),onExecApprovalsRemove:d=>Uu(e,d),onSaveExecApprovals:()=>{const d=e.execApprovalsTarget==="node"&&e.execApprovalsTargetNodeId?{kind:"node",nodeId:e.execApprovalsTargetNodeId}:{kind:"gateway"};return Ou(e,d)}}):v}

        ${a&&e.dhAvailable?Bb(Uy(e,()=>{Dn(e)})):v}

        ${e.tab==="chat"||a&&!e.dhAvailable?r`${vp(e,{onNewSession:()=>{Dn(e)}})}${wc({sessionKey:e.sessionKey,onSessionKeyChange:d=>{e.sessionKey=d,e.chatMessage="",e.chatAttachments=[],e.chatStream=null,e.chatStreamStartedAt=null,e.chatRunId=null,e.chatQueue=[],e.resetToolStream(),e.resetChatScroll(),e.applySettings({...e.settings,sessionKey:d,lastActiveSessionKey:d}),e.loadAssistantIdentity(),Xe(e),kt(e)},thinkingLevel:e.chatThinkingLevel,showThinking:c,loading:e.chatLoading,sending:e.chatSending,compactionStatus:e.compactionStatus,assistantAvatarUrl:p,messages:e.chatMessages,toolMessages:e.chatToolMessages,stream:e.chatStream,streamStartedAt:e.chatStreamStartedAt,draft:e.chatMessage,queue:e.chatQueue,connected:e.connected,canSend:e.connected,disabledReason:i,error:e.lastError,sessions:e.sessionsResult,focusMode:l,onRefresh:()=>(e.resetToolStream(),Promise.all([Xe(e),kt(e)])),onToggleFocusMode:()=>{e.onboarding||e.applySettings({...e.settings,chatFocusMode:!e.settings.chatFocusMode})},onChatScroll:d=>e.handleChatScroll(d),onDraftChange:d=>e.chatMessage=d,attachments:e.chatAttachments,onAttachmentsChange:d=>e.chatAttachments=d,onSend:()=>e.handleSendChat(),canAbort:!!e.chatRunId,onAbort:()=>{e.handleAbortChat()},onQueueRemove:d=>e.removeQueuedMessage(d),onNewSession:()=>{Dn(e)},showNewMessages:e.chatNewMessagesBelow&&!e.chatManualRefreshInFlight,onScrollToBottom:()=>e.scrollToBottom(),sidebarOpen:e.sidebarOpen,sidebarContent:e.sidebarContent,sidebarError:e.sidebarError,sidebarMode:e.sidebarMode,splitRatio:e.splitRatio,onOpenSidebar:d=>e.handleOpenSidebar(d),onCloseSidebar:()=>e.handleCloseSidebar(),onSplitRatioChange:d=>e.handleSplitRatioChange(d),execLogEntries:e.execLogEntries,execLogActive:e.execLogActive,execLogAutoScroll:e.execLogAutoScroll,onOpenExecLog:()=>e.handleOpenExecLog(),onCloseExecLog:()=>e.handleCloseExecLog(),onClearExecLog:()=>e.handleClearExecLog(),onToggleExecLogAutoScroll:()=>e.handleToggleExecLogAutoScroll(),assistantName:e.assistantName,assistantAvatar:e.assistantAvatar})}`:v}

        ${e.tab==="personal"?Sb({loading:e.personalInfoLoading,saving:e.personalInfoSaving,data:e.personalInfo,form:e.personalInfoForm,dirty:e.personalInfoDirty,error:e.personalInfoError,success:e.personalInfoSuccess,onFieldChange:(d,m)=>Hu(e,d,m),onSave:()=>{zu(e)},onRefresh:()=>{so(e)}}):v}

        ${e.tab==="config"?Pv({raw:e.configRaw,originalRaw:e.configRawOriginal,valid:e.configValid,issues:e.configIssues,loading:e.configLoading,saving:e.configSaving,applying:e.configApplying,updating:e.updateRunning,connected:e.connected,schema:e.configSchema,schemaLoading:e.configSchemaLoading,uiHints:e.configUiHints,formMode:e.configFormMode,formValue:e.configForm,originalValue:e.configFormOriginal,searchQuery:e.configSearchQuery,activeSection:e.configActiveSection,activeSubsection:e.configActiveSubsection,onRawChange:d=>{e.configRaw=d},onFormModeChange:d=>e.configFormMode=d,onFormPatch:(d,m)=>ke(e,d,m),onSearchChange:d=>e.configSearchQuery=d,onSectionChange:d=>{e.configActiveSection=d,e.configActiveSubsection=null},onSubsectionChange:d=>e.configActiveSubsection=d,onReload:()=>Ie(e),onSave:()=>On(e),onApply:()=>xd(e),onUpdate:()=>wd(e)}):v}

        ${e.tab==="debug"?jv({loading:e.debugLoading,status:e.debugStatus,health:e.debugHealth,models:e.debugModels,heartbeat:e.debugHeartbeat,eventLog:e.eventLog,callMethod:e.debugCallMethod,callParams:e.debugCallParams,callResult:e.debugCallResult,callError:e.debugCallError,onCallMethodChange:d=>e.debugCallMethod=d,onCallParamsChange:d=>e.debugCallParams=d,onRefresh:()=>rs(e),onCall:()=>zd(e)}):v}

        ${e.tab==="logs"?Jv({loading:e.logsLoading,error:e.logsError,file:e.logsFile,entries:e.logsEntries,filterText:e.logsFilterText,levelFilters:e.logsLevelFilters,autoFollow:e.logsAutoFollow,truncated:e.logsTruncated,onFilterTextChange:d=>e.logsFilterText=d,onLevelToggle:(d,m)=>{e.logsLevelFilters={...e.logsLevelFilters,[d]:m}},onToggleAutoFollow:d=>e.logsAutoFollow=d,onRefresh:()=>Hi(e,{reset:!0}),onExport:(d,m)=>e.exportLogs(d,m),onScroll:d=>e.handleLogsScroll(d)}):v}
      </main>
      <footer class="statusbar">
        ${_p({connected:e.connected,channels:e.channelsSnapshot,totalCost:e.usageCostSummary?.totals?.totalCost??null,expanded:e.statusBarExpanded,onToggle:()=>{e.statusBarExpanded=!e.statusBarExpanded}})}
      </footer>
      ${Ap({open:e.commandPaletteOpen,recentCommandIds:e.recentCommands,onSelect:d=>{e.addRecentCommand(d.id),d.id==="new-chat"?(e.openTabFromPalette("chat"),Dn(e)):d.tab&&e.openTabFromPalette(d.tab),e.commandPaletteOpen=!1},onClose:()=>{e.commandPaletteOpen=!1}})}
      ${Wv(e)}
      ${Vv(e)}
    </div>
  `}var jy=Object.defineProperty,Ky=Object.getOwnPropertyDescriptor,y=(e,t,n,s)=>{for(var i=s>1?void 0:s?Ky(t,n):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(i=(s?a(t,n,i):a(i))||i);return s&&i&&jy(t,n,i),i};const ri=Wg();function Wy(){if(!window.location.search)return!1;const t=new URLSearchParams(window.location.search).get("onboarding");if(!t)return!1;const n=t.trim().toLowerCase();return n==="1"||n==="true"||n==="yes"||n==="on"}let b=class extends Pt{constructor(){super(...arguments),this.settings=Ju(),this.password="",this.tab="chat",this.onboarding=Wy(),this.connected=!1,this.dhConnectionStatus="disconnected",this.dhMicEnabled=!0,this.dhCameraEnabled=!1,this.dhSubtitleVisible=!0,this.dhCurrentSubtitle="",this.dhErrorMessage=null,this.dhLayoutMode="split",this.dhIsThinking=!1,this.dhAvailable=!1,this.theme=this.settings.theme??"system",this.themeResolved="dark",this.hello=null,this.lastError=null,this.eventLog=[],this.eventLogBuffer=[],this.toolStreamSyncTimer=null,this.sidebarCloseTimer=null,this._onFullscreenChange=()=>this.requestUpdate(),this.assistantName=ri.name,this.assistantAvatar=ri.avatar,this.assistantAgentId=ri.agentId??null,this.sessionKey=this.settings.sessionKey,this.chatLoading=!1,this.chatSending=!1,this.chatMessage="",this.chatMessages=[],this.chatToolMessages=[],this.chatStream=null,this.chatStreamStartedAt=null,this.chatRunId=null,this.compactionStatus=null,this.chatAvatarUrl=null,this.chatThinkingLevel=null,this.chatQueue=[],this.chatAttachments=[],this.chatManualRefreshInFlight=!1,this.sidebarOpen=!1,this.sidebarContent=null,this.sidebarError=null,this.sidebarMode=null,this.execLogEntries=[],this.execLogActive=!1,this.execLogAutoScroll=!0,this.execLogManuallyDismissed=!1,this.splitRatio=this.settings.splitRatio,this.nodesLoading=!1,this.nodes=[],this.devicesLoading=!1,this.devicesError=null,this.devicesList=null,this.execApprovalsLoading=!1,this.execApprovalsSaving=!1,this.execApprovalsDirty=!1,this.execApprovalsSnapshot=null,this.execApprovalsForm=null,this.execApprovalsSelectedAgent=null,this.execApprovalsTarget="gateway",this.execApprovalsTargetNodeId=null,this.execApprovalQueue=[],this.execApprovalBusy=!1,this.execApprovalError=null,this.pendingGatewayUrl=null,this.personalInfoLoading=!1,this.personalInfoSaving=!1,this.personalInfo=null,this.personalInfoForm=null,this.personalInfoError=null,this.personalInfoDirty=!1,this.personalInfoSuccess=null,this.configLoading=!1,this.configRaw=`{
}
`,this.configRawOriginal="",this.configValid=null,this.configIssues=[],this.configSaving=!1,this.configApplying=!1,this.updateRunning=!1,this.applySessionKey=this.settings.lastActiveSessionKey,this.configSnapshot=null,this.configSchema=null,this.configSchemaVersion=null,this.configSchemaLoading=!1,this.configUiHints={},this.configForm=null,this.configFormOriginal=null,this.configFormDirty=!1,this.configFormMode="form",this.configSearchQuery="",this.configActiveSection=null,this.configActiveSubsection=null,this.channelsLoading=!1,this.channelsSnapshot=null,this.channelsError=null,this.channelsLastSuccess=null,this.whatsappLoginMessage=null,this.whatsappLoginQrDataUrl=null,this.whatsappLoginConnected=null,this.whatsappBusy=!1,this.nostrProfileFormState=null,this.nostrProfileAccountId=null,this.presenceLoading=!1,this.presenceEntries=[],this.presenceError=null,this.presenceStatus=null,this.agentsLoading=!1,this.agentsList=null,this.agentsError=null,this.agentsSelectedId=null,this.agentsPanel="overview",this.agentFilesLoading=!1,this.agentFilesError=null,this.agentFilesList=null,this.agentFileContents={},this.agentFileDrafts={},this.agentFileActive=null,this.agentFileSaving=!1,this.agentIdentityLoading=!1,this.agentIdentityError=null,this.agentIdentityById={},this.agentSkillsLoading=!1,this.agentSkillsError=null,this.agentSkillsReport=null,this.agentSkillsAgentId=null,this.sessionsLoading=!1,this.sessionsResult=null,this.sessionsError=null,this.sessionsFilterActive="",this.sessionsFilterLimit="120",this.sessionsIncludeGlobal=!0,this.sessionsIncludeUnknown=!1,this.usageLoading=!1,this.usageResult=null,this.usageCostSummary=null,this.usageError=null,this.usageStartDate=(()=>{const e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`})(),this.usageEndDate=(()=>{const e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`})(),this.usageSelectedSessions=[],this.usageSelectedDays=[],this.usageSelectedHours=[],this.usageChartMode="tokens",this.usageDailyChartMode="by-type",this.usageTimeSeriesMode="per-turn",this.usageTimeSeriesBreakdownMode="by-type",this.usageTimeSeries=null,this.usageTimeSeriesLoading=!1,this.usageSessionLogs=null,this.usageSessionLogsLoading=!1,this.usageSessionLogsExpanded=!1,this.usageQuery="",this.usageQueryDraft="",this.usageSessionSort="recent",this.usageSessionSortDir="desc",this.usageRecentSessions=[],this.usageTimeZone="local",this.usageContextExpanded=!1,this.usageHeaderPinned=!1,this.usageSessionsTab="all",this.usageVisibleColumns=["channel","agent","provider","model","messages","tools","errors","duration"],this.usageLogFilterRoles=[],this.usageLogFilterTools=[],this.usageLogFilterHasTools=!1,this.usageLogFilterQuery="",this.usageQueryDebounceTimer=null,this.cronLoading=!1,this.cronJobs=[],this.cronStatus=null,this.cronError=null,this.cronForm={...zg},this.cronRunsJobId=null,this.cronRuns=[],this.cronBusy=!1,this.skillsLoading=!1,this.skillsReport=null,this.skillsError=null,this.skillsFilter="",this.skillEdits={},this.skillsBusyKey=null,this.skillMessages={},this.modelCatalog=null,this.modelCatalogLoading=!1,this.debugLoading=!1,this.debugStatus=null,this.debugHealth=null,this.debugModels=[],this.debugHeartbeat=null,this.debugCallMethod="",this.debugCallParams="{}",this.debugCallResult=null,this.debugCallError=null,this.logsLoading=!1,this.logsError=null,this.logsFile=null,this.logsEntries=[],this.logsFilterText="",this.logsLevelFilters={...Ug},this.logsAutoFollow=!0,this.logsTruncated=!1,this.logsCursor=null,this.logsLastFetchAt=null,this.logsLimit=500,this.logsMaxBytes=25e4,this.logsAtBottom=!0,this.commandPaletteOpen=!1,this.openTabs=this.settings.openTabs?.length?this.settings.openTabs:["chat"],this.statusBarExpanded=!1,this.recentCommands=this.settings.recentCommands??[],this.openChatSessions=(()=>{const e=this.settings.openChatSessions,t=this.settings.sessionKey||"main";return e&&e.length>0?e.includes(t)?e:[t,...e]:[t]})(),this.client=null,this.chatScrollFrame=null,this.chatScrollTimeout=null,this.chatHasAutoScrolled=!1,this.chatUserNearBottom=!0,this.chatNewMessagesBelow=!1,this.nodesPollInterval=null,this.logsPollInterval=null,this.debugPollInterval=null,this.logsScrollFrame=null,this.toolStreamById=new Map,this.toolStreamOrder=[],this.refreshSessionsAfterChat=new Set,this.basePath="",this.popStateHandler=()=>dg(this),this.themeMedia=null,this.themeMediaHandler=null,this.topbarObserver=null}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this._unsubLocale=Uc(()=>this.requestUpdate()),document.addEventListener("fullscreenchange",this._onFullscreenChange),op(this)}firstUpdated(){ap(this)}disconnectedCallback(){this._unsubLocale?.(),document.removeEventListener("fullscreenchange",this._onFullscreenChange),rp(this),super.disconnectedCallback()}updated(e){lp(this,e)}connect(){Bl(this)}handleChatScroll(e){Nd(this,e)}handleLogsScroll(e){Od(this,e)}exportLogs(e,t){Bd(e,t)}resetToolStream(){ps(this)}resetChatScroll(){ca(this)}scrollToBottom(e){ca(this),dn(this,!0,!!e?.smooth)}async loadAssistantIdentity(){await Fl(this)}applySettings(e){Ze(this,e)}setTab(e){sg(this,e)}setTheme(e,t){ig(this,e,t)}async loadOverview(){await Sl(this)}async loadCron(){await qn(this)}async handleAbortChat(){await uo(this)}removeQueuedMessage(e){Ml(this,e)}async handleSendChat(e,t){await Rl(this,e,t)}async handleWhatsAppStart(e){await Cd(this,e)}async handleWhatsAppWait(){await Ad(this)}async handleWhatsAppLogout(){await Td(this)}async handleChannelConfigSave(){await _d(this)}async handleChannelConfigReload(){await Ed(this)}handleNostrProfileEdit(e,t){Id(this,e,t)}handleNostrProfileCancel(){Md(this)}handleNostrProfileFieldChange(e,t){Rd(this,e,t)}async handleNostrProfileSave(){await Dd(this)}async handleNostrProfileImport(){await Fd(this)}handleNostrProfileToggleAdvanced(){Pd(this)}async handleExecApprovalDecision(e){const t=this.execApprovalQueue[0];if(!(!t||!this.client||this.execApprovalBusy)){this.execApprovalBusy=!0,this.execApprovalError=null;try{await this.client.request("exec.approval.resolve",{id:t.id,decision:e}),this.execApprovalQueue=this.execApprovalQueue.filter(n=>n.id!==t.id)}catch(n){this.execApprovalError=`Exec approval failed: ${String(n)}`}finally{this.execApprovalBusy=!1}}}handleGatewayUrlConfirm(){const e=this.pendingGatewayUrl;e&&(this.pendingGatewayUrl=null,Ze(this,{...this.settings,gatewayUrl:e}),this.connect())}handleGatewayUrlCancel(){this.pendingGatewayUrl=null}handleOpenSidebar(e){this.sidebarCloseTimer!=null&&(window.clearTimeout(this.sidebarCloseTimer),this.sidebarCloseTimer=null),this.sidebarContent=e,this.sidebarError=null,this.sidebarMode="markdown",this.sidebarOpen=!0}handleCloseSidebar(){this.sidebarOpen=!1,this.sidebarMode=null,this.sidebarCloseTimer!=null&&window.clearTimeout(this.sidebarCloseTimer),this.sidebarCloseTimer=window.setTimeout(()=>{this.sidebarOpen||(this.sidebarContent=null,this.sidebarError=null,this.sidebarCloseTimer=null)},200)}handleSplitRatioChange(e){const t=Math.max(.4,Math.min(.7,e));this.splitRatio=t,this.applySettings({...this.settings,splitRatio:t})}handleOpenExecLog(){this.sidebarMode="exec-log",this.sidebarOpen=!0,this.execLogManuallyDismissed=!1}handleCloseExecLog(){this.sidebarMode=null,this.sidebarOpen=!1,this.execLogManuallyDismissed=!0}handleClearExecLog(){this.execLogEntries=[]}handleToggleExecLogAutoScroll(){this.execLogAutoScroll=!this.execLogAutoScroll}toggleCommandPalette(){this.commandPaletteOpen=!this.commandPaletteOpen}openTabFromPalette(e){this.openTabs.includes(e)||(this.openTabs=[...this.openTabs,e]),this.setTab(e),this.commandPaletteOpen=!1,this.applySettings({...this.settings,openTabs:this.openTabs})}closeTab(e){e!=="chat"&&(this.openTabs=this.openTabs.filter(t=>t!==e),this.tab===e&&this.setTab("chat"),this.applySettings({...this.settings,openTabs:this.openTabs}))}addRecentCommand(e){const t=[e,...this.recentCommands.filter(n=>n!==e)].slice(0,5);this.recentCommands=t,this.applySettings({...this.settings,recentCommands:t})}addChatSession(e){this.openChatSessions.includes(e)||(this.openChatSessions=[...this.openChatSessions,e],this.applySettings({...this.settings,openChatSessions:this.openChatSessions}))}removeChatSession(e){if(this.openChatSessions.length<=1)return;const t=this.openChatSessions.indexOf(e);if(t!==-1){if(this.openChatSessions=this.openChatSessions.filter(n=>n!==e),this.sessionKey===e){const n=Math.min(t,this.openChatSessions.length-1),s=this.openChatSessions[n]??this.openChatSessions[0];this.switchChatSession(s)}this.applySettings({...this.settings,openChatSessions:this.openChatSessions})}}switchChatSession(e){e!==this.sessionKey&&(this.sessionKey=e,this.chatMessage="",this.chatAttachments=[],this.chatStream=null,this.chatStreamStartedAt=null,this.chatRunId=null,this.chatQueue=[],this.resetToolStream(),this.resetChatScroll(),this.applySettings({...this.settings,sessionKey:e,lastActiveSessionKey:e,openChatSessions:this.openChatSessions}),this.loadAssistantIdentity(),me(async()=>{const{loadChatHistory:t}=await Promise.resolve().then(()=>Pg);return{loadChatHistory:t}},[],import.meta.url).then(({loadChatHistory:t})=>t(this)),me(async()=>{const{refreshChatAvatar:t}=await Promise.resolve().then(()=>Bg);return{refreshChatAvatar:t}},void 0,import.meta.url).then(({refreshChatAvatar:t})=>t(this)))}render(){return Hy(this)}};y([x()],b.prototype,"settings",2);y([x()],b.prototype,"password",2);y([x()],b.prototype,"tab",2);y([x()],b.prototype,"onboarding",2);y([x()],b.prototype,"connected",2);y([x()],b.prototype,"dhConnectionStatus",2);y([x()],b.prototype,"dhMicEnabled",2);y([x()],b.prototype,"dhCameraEnabled",2);y([x()],b.prototype,"dhSubtitleVisible",2);y([x()],b.prototype,"dhCurrentSubtitle",2);y([x()],b.prototype,"dhErrorMessage",2);y([x()],b.prototype,"dhLayoutMode",2);y([x()],b.prototype,"dhIsThinking",2);y([x()],b.prototype,"dhAvailable",2);y([x()],b.prototype,"theme",2);y([x()],b.prototype,"themeResolved",2);y([x()],b.prototype,"hello",2);y([x()],b.prototype,"lastError",2);y([x()],b.prototype,"eventLog",2);y([x()],b.prototype,"assistantName",2);y([x()],b.prototype,"assistantAvatar",2);y([x()],b.prototype,"assistantAgentId",2);y([x()],b.prototype,"sessionKey",2);y([x()],b.prototype,"chatLoading",2);y([x()],b.prototype,"chatSending",2);y([x()],b.prototype,"chatMessage",2);y([x()],b.prototype,"chatMessages",2);y([x()],b.prototype,"chatToolMessages",2);y([x()],b.prototype,"chatStream",2);y([x()],b.prototype,"chatStreamStartedAt",2);y([x()],b.prototype,"chatRunId",2);y([x()],b.prototype,"compactionStatus",2);y([x()],b.prototype,"chatAvatarUrl",2);y([x()],b.prototype,"chatThinkingLevel",2);y([x()],b.prototype,"chatQueue",2);y([x()],b.prototype,"chatAttachments",2);y([x()],b.prototype,"chatManualRefreshInFlight",2);y([x()],b.prototype,"sidebarOpen",2);y([x()],b.prototype,"sidebarContent",2);y([x()],b.prototype,"sidebarError",2);y([x()],b.prototype,"sidebarMode",2);y([x()],b.prototype,"execLogEntries",2);y([x()],b.prototype,"execLogActive",2);y([x()],b.prototype,"execLogAutoScroll",2);y([x()],b.prototype,"execLogManuallyDismissed",2);y([x()],b.prototype,"splitRatio",2);y([x()],b.prototype,"nodesLoading",2);y([x()],b.prototype,"nodes",2);y([x()],b.prototype,"devicesLoading",2);y([x()],b.prototype,"devicesError",2);y([x()],b.prototype,"devicesList",2);y([x()],b.prototype,"execApprovalsLoading",2);y([x()],b.prototype,"execApprovalsSaving",2);y([x()],b.prototype,"execApprovalsDirty",2);y([x()],b.prototype,"execApprovalsSnapshot",2);y([x()],b.prototype,"execApprovalsForm",2);y([x()],b.prototype,"execApprovalsSelectedAgent",2);y([x()],b.prototype,"execApprovalsTarget",2);y([x()],b.prototype,"execApprovalsTargetNodeId",2);y([x()],b.prototype,"execApprovalQueue",2);y([x()],b.prototype,"execApprovalBusy",2);y([x()],b.prototype,"execApprovalError",2);y([x()],b.prototype,"pendingGatewayUrl",2);y([x()],b.prototype,"personalInfoLoading",2);y([x()],b.prototype,"personalInfoSaving",2);y([x()],b.prototype,"personalInfo",2);y([x()],b.prototype,"personalInfoForm",2);y([x()],b.prototype,"personalInfoError",2);y([x()],b.prototype,"personalInfoDirty",2);y([x()],b.prototype,"personalInfoSuccess",2);y([x()],b.prototype,"configLoading",2);y([x()],b.prototype,"configRaw",2);y([x()],b.prototype,"configRawOriginal",2);y([x()],b.prototype,"configValid",2);y([x()],b.prototype,"configIssues",2);y([x()],b.prototype,"configSaving",2);y([x()],b.prototype,"configApplying",2);y([x()],b.prototype,"updateRunning",2);y([x()],b.prototype,"applySessionKey",2);y([x()],b.prototype,"configSnapshot",2);y([x()],b.prototype,"configSchema",2);y([x()],b.prototype,"configSchemaVersion",2);y([x()],b.prototype,"configSchemaLoading",2);y([x()],b.prototype,"configUiHints",2);y([x()],b.prototype,"configForm",2);y([x()],b.prototype,"configFormOriginal",2);y([x()],b.prototype,"configFormDirty",2);y([x()],b.prototype,"configFormMode",2);y([x()],b.prototype,"configSearchQuery",2);y([x()],b.prototype,"configActiveSection",2);y([x()],b.prototype,"configActiveSubsection",2);y([x()],b.prototype,"channelsLoading",2);y([x()],b.prototype,"channelsSnapshot",2);y([x()],b.prototype,"channelsError",2);y([x()],b.prototype,"channelsLastSuccess",2);y([x()],b.prototype,"whatsappLoginMessage",2);y([x()],b.prototype,"whatsappLoginQrDataUrl",2);y([x()],b.prototype,"whatsappLoginConnected",2);y([x()],b.prototype,"whatsappBusy",2);y([x()],b.prototype,"nostrProfileFormState",2);y([x()],b.prototype,"nostrProfileAccountId",2);y([x()],b.prototype,"presenceLoading",2);y([x()],b.prototype,"presenceEntries",2);y([x()],b.prototype,"presenceError",2);y([x()],b.prototype,"presenceStatus",2);y([x()],b.prototype,"agentsLoading",2);y([x()],b.prototype,"agentsList",2);y([x()],b.prototype,"agentsError",2);y([x()],b.prototype,"agentsSelectedId",2);y([x()],b.prototype,"agentsPanel",2);y([x()],b.prototype,"agentFilesLoading",2);y([x()],b.prototype,"agentFilesError",2);y([x()],b.prototype,"agentFilesList",2);y([x()],b.prototype,"agentFileContents",2);y([x()],b.prototype,"agentFileDrafts",2);y([x()],b.prototype,"agentFileActive",2);y([x()],b.prototype,"agentFileSaving",2);y([x()],b.prototype,"agentIdentityLoading",2);y([x()],b.prototype,"agentIdentityError",2);y([x()],b.prototype,"agentIdentityById",2);y([x()],b.prototype,"agentSkillsLoading",2);y([x()],b.prototype,"agentSkillsError",2);y([x()],b.prototype,"agentSkillsReport",2);y([x()],b.prototype,"agentSkillsAgentId",2);y([x()],b.prototype,"sessionsLoading",2);y([x()],b.prototype,"sessionsResult",2);y([x()],b.prototype,"sessionsError",2);y([x()],b.prototype,"sessionsFilterActive",2);y([x()],b.prototype,"sessionsFilterLimit",2);y([x()],b.prototype,"sessionsIncludeGlobal",2);y([x()],b.prototype,"sessionsIncludeUnknown",2);y([x()],b.prototype,"usageLoading",2);y([x()],b.prototype,"usageResult",2);y([x()],b.prototype,"usageCostSummary",2);y([x()],b.prototype,"usageError",2);y([x()],b.prototype,"usageStartDate",2);y([x()],b.prototype,"usageEndDate",2);y([x()],b.prototype,"usageSelectedSessions",2);y([x()],b.prototype,"usageSelectedDays",2);y([x()],b.prototype,"usageSelectedHours",2);y([x()],b.prototype,"usageChartMode",2);y([x()],b.prototype,"usageDailyChartMode",2);y([x()],b.prototype,"usageTimeSeriesMode",2);y([x()],b.prototype,"usageTimeSeriesBreakdownMode",2);y([x()],b.prototype,"usageTimeSeries",2);y([x()],b.prototype,"usageTimeSeriesLoading",2);y([x()],b.prototype,"usageSessionLogs",2);y([x()],b.prototype,"usageSessionLogsLoading",2);y([x()],b.prototype,"usageSessionLogsExpanded",2);y([x()],b.prototype,"usageQuery",2);y([x()],b.prototype,"usageQueryDraft",2);y([x()],b.prototype,"usageSessionSort",2);y([x()],b.prototype,"usageSessionSortDir",2);y([x()],b.prototype,"usageRecentSessions",2);y([x()],b.prototype,"usageTimeZone",2);y([x()],b.prototype,"usageContextExpanded",2);y([x()],b.prototype,"usageHeaderPinned",2);y([x()],b.prototype,"usageSessionsTab",2);y([x()],b.prototype,"usageVisibleColumns",2);y([x()],b.prototype,"usageLogFilterRoles",2);y([x()],b.prototype,"usageLogFilterTools",2);y([x()],b.prototype,"usageLogFilterHasTools",2);y([x()],b.prototype,"usageLogFilterQuery",2);y([x()],b.prototype,"cronLoading",2);y([x()],b.prototype,"cronJobs",2);y([x()],b.prototype,"cronStatus",2);y([x()],b.prototype,"cronError",2);y([x()],b.prototype,"cronForm",2);y([x()],b.prototype,"cronRunsJobId",2);y([x()],b.prototype,"cronRuns",2);y([x()],b.prototype,"cronBusy",2);y([x()],b.prototype,"skillsLoading",2);y([x()],b.prototype,"skillsReport",2);y([x()],b.prototype,"skillsError",2);y([x()],b.prototype,"skillsFilter",2);y([x()],b.prototype,"skillEdits",2);y([x()],b.prototype,"skillsBusyKey",2);y([x()],b.prototype,"skillMessages",2);y([x()],b.prototype,"modelCatalog",2);y([x()],b.prototype,"modelCatalogLoading",2);y([x()],b.prototype,"debugLoading",2);y([x()],b.prototype,"debugStatus",2);y([x()],b.prototype,"debugHealth",2);y([x()],b.prototype,"debugModels",2);y([x()],b.prototype,"debugHeartbeat",2);y([x()],b.prototype,"debugCallMethod",2);y([x()],b.prototype,"debugCallParams",2);y([x()],b.prototype,"debugCallResult",2);y([x()],b.prototype,"debugCallError",2);y([x()],b.prototype,"logsLoading",2);y([x()],b.prototype,"logsError",2);y([x()],b.prototype,"logsFile",2);y([x()],b.prototype,"logsEntries",2);y([x()],b.prototype,"logsFilterText",2);y([x()],b.prototype,"logsLevelFilters",2);y([x()],b.prototype,"logsAutoFollow",2);y([x()],b.prototype,"logsTruncated",2);y([x()],b.prototype,"logsCursor",2);y([x()],b.prototype,"logsLastFetchAt",2);y([x()],b.prototype,"logsLimit",2);y([x()],b.prototype,"logsMaxBytes",2);y([x()],b.prototype,"logsAtBottom",2);y([x()],b.prototype,"commandPaletteOpen",2);y([x()],b.prototype,"openTabs",2);y([x()],b.prototype,"statusBarExpanded",2);y([x()],b.prototype,"recentCommands",2);y([x()],b.prototype,"openChatSessions",2);y([x()],b.prototype,"chatNewMessagesBelow",2);b=y([Hr("winclaw-app")],b);Pr(Bc());
//# sourceMappingURL=index-BVSLgE-W.js.map
