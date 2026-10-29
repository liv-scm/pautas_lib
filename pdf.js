/* Leitor de PDF sem dependências: extrai texto e metadados (XMP, Info) no próprio navegador.
   Cobre PDFs de periódicos (FlateDecode, object streams, fontes com ToUnicode). Não lê PDFs escaneados nem protegidos. */
const PDFREAD=(()=>{
const bin=u8=>{let s="";for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return s};
const W1252=new TextDecoder("windows-1252");
const WIN=[...Array(256)].map((_,b)=>b<32&&b!==9&&b!==10&&b!==13?"":W1252.decode(new Uint8Array([b])));
const GLYPH={space:" ",period:".",comma:",",hyphen:"-",minus:"−",endash:"–",emdash:"—",quoteright:"’",quoteleft:"‘",quotedblleft:"“",quotedblright:"”",quotesingle:"'",quotedbl:'"',fi:"fi",fl:"fl",ff:"ff",ffi:"ffi",ffl:"ffl",colon:":",semicolon:";",parenleft:"(",parenright:")",bracketleft:"[",bracketright:"]",percent:"%",plus:"+",equal:"=",less:"<",greater:">",slash:"/",asterisk:"*",ampersand:"&",numbersign:"#",at:"@",question:"?",exclam:"!",plusminus:"±",multiply:"×",degree:"°",bullet:"•",periodcentered:"·",
  zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",
  aacute:"á",agrave:"à",acircumflex:"â",atilde:"ã",eacute:"é",ecircumflex:"ê",iacute:"í",oacute:"ó",ocircumflex:"ô",otilde:"õ",uacute:"ú",ccedilla:"ç",udieresis:"ü",odieresis:"ö",adieresis:"ä",
  Aacute:"Á",Eacute:"É",Iacute:"Í",Oacute:"Ó",Uacute:"Ú",Ccedilla:"Ç",Atilde:"Ã",Otilde:"Õ"};

async function inflate(u8){
  const ds=new DecompressionStream("deflate"),w=ds.writable.getWriter();
  w.write(u8).catch(()=>{});w.close().catch(()=>{});
  const r=ds.readable.getReader(),parts=[];let len=0;
  try{for(;;){const {done,value}=await r.read();if(done)break;parts.push(value);len+=value.length}}catch(e){/* lixo após o fim do fluxo: mantém o que já saiu */}
  const out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out;
}
// string literal PDF a partir de s[i]==="(" → [texto, índice após ")"]
function lit(s,i){
  let d=1,j=i+1,str="";const n=s.length,E={n:"\n",r:"\r",t:"\t",b:"\b",f:"\f","(":"(",")":")","\\":"\\"};
  while(j<n){const ch=s[j];
    if(ch==="\\"){const nx=s[j+1];
      if(nx!==undefined&&E[nx]!==undefined){str+=E[nx];j+=2}
      else if(nx>="0"&&nx<="7"){let k=j+1,o="";while(k<j+4&&s[k]>="0"&&s[k]<="7")o+=s[k++];str+=String.fromCharCode(parseInt(o,8)&255);j=k}
      else if(nx==="\r"||nx==="\n"){j+=2;if(nx==="\r"&&s[j]==="\n")j++}
      else j++;
      continue}
    if(ch==="(")d++;else if(ch===")"){d--;if(!d)break}
    str+=ch;j++}
  return [str,j+1];
}
function balanced(s,i){let d=0;for(;i<s.length;i++){if(s[i]==="("){i=lit(s,i)[1]-1;continue}
  if(s[i]==="<"&&s[i+1]==="<"){d++;i++}else if(s[i]===">"&&s[i+1]===">"){d--;i++;if(!d)return i+1}}return s.length}
const utf16=s=>{let r="";for(let k=2;k+1<s.length;k+=2)r+=String.fromCharCode((s.charCodeAt(k)<<8)|s.charCodeAt(k+1));return r};
const pdfText=s=>s.startsWith("\xFE\xFF")?utf16(s):[...s].map(c=>WIN[c.charCodeAt(0)]||"").join("");
const ent=s=>s.replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");

function parseCMap(t){
  const map=new Map();let bpc=1;
  const cs=/begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(t);if(cs)bpc=Math.max(1,cs[1].length/2);
  const hx=h=>{if(h.length<4)return String.fromCharCode(parseInt(h||"0",16));let r="";for(let i=0;i+3<h.length;i+=4)r+=String.fromCharCode(parseInt(h.substr(i,4),16));return r};
  for(const b of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for(const p of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g))map.set(parseInt(p[1],16),hx(p[2]));
  for(const b of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
    for(const p of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)){
      const lo=parseInt(p[1],16),hi=Math.min(parseInt(p[2],16),lo+65535);
      if(p[3][0]==="["){const arr=[...p[3].matchAll(/<([0-9a-fA-F]*)>/g)].map(x=>hx(x[1]));for(let c=lo;c<=hi&&c-lo<arr.length;c++)map.set(c,arr[c-lo])}
      else{const base=hx(p[3].slice(1,-1));const head=base.slice(0,-1),last=base.charCodeAt(base.length-1);for(let c=lo;c<=hi;c++)map.set(c,head+String.fromCharCode(last+c-lo))}
    }
  return {map,bpc};
}

async function read(buf){
  const u8=new Uint8Array(buf),s=bin(u8);
  if(s.indexOf("%PDF")<0)throw new Error("O arquivo não parece ser um PDF.");
  if(/\/Encrypt\s+\d+\s+\d+\s+R/.test(s))throw new Error("PDF protegido por senha ou criptografado.");
  const objs=new Map(),re=/(\d+)\s+(\d+)\s+obj\b/g;let m;
  while((m=re.exec(s))){
    const num=+m[1],start=re.lastIndex;let endobj=s.indexOf("endobj",start);if(endobj<0)endobj=s.length;
    const st=s.indexOf("stream",start),o={};
    if(st>=0&&st<endobj){
      o.dict=s.slice(start,st);let ds=st+6;if(s[ds]==="\r")ds++;if(s[ds]==="\n")ds++;
      const L=/\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(o.dict);let de=-1;
      if(L){const e=ds+ +L[1];if(s.slice(e,e+24).indexOf("endstream")>=0)de=e}
      if(de<0){de=s.indexOf("endstream",ds);if(de<0)de=s.length}
      o.data=u8.subarray(ds,de);endobj=s.indexOf("endobj",de);if(endobj<0)endobj=s.length;
    }else o.dict=s.slice(start,endobj);
    objs.set(num,o);re.lastIndex=endobj;
  }
  const get=n=>objs.get(n);
  async function stream(o){
    if(!o||!o.data)return null;if(o._d!==undefined)return o._d;
    const f=/\/Filter\s*\[?\s*\/(\w+)/.exec(o.dict);let d=o.data;
    if(f)d=(f[1]==="FlateDecode"||f[1]==="Fl")?await inflate(d):null;
    return o._d=d;
  }
  // object streams (PDF 1.5+)
  for(const o of [...objs.values()])if(/\/Type\s*\/ObjStm/.test(o.dict)){
    const d=await stream(o);if(!d)continue;const t=bin(d);
    const N=+(/\/N\s+(\d+)/.exec(o.dict)||[])[1],F=+(/\/First\s+(\d+)/.exec(o.dict)||[])[1];if(!N||!F)continue;
    const h=t.slice(0,F).trim().split(/\s+/).map(Number);
    for(let k=0;k<N;k++){const num=h[2*k],off=h[2*k+1],nx=k+1<N?h[2*k+3]:t.length-F;if(!objs.has(num))objs.set(num,{dict:t.slice(F+off,F+nx)})}
  }
  const refOf=(d,key)=>{const r=new RegExp("/"+key+"\\s+(\\d+)\\s+\\d+\\s+R").exec(d||"");return r?+r[1]:null};
  const dictOf=(d,key)=>{if(!d)return null;const r=new RegExp("/"+key+"(?![A-Za-z])\\s*").exec(d);if(!r)return null;const i=r.index+r[0].length;
    if(d[i]==="<"&&d[i+1]==="<")return d.slice(i,balanced(d,i));const ref=/^(\d+)\s+\d+\s+R/.exec(d.slice(i));return ref?(get(+ref[1])||{}).dict||null:null};
  const strOf=(d,key)=>{if(!d)return "";const r=new RegExp("/"+key+"\\s*([(<])").exec(d);if(!r)return "";const i=r.index+r[0].length-1;
    if(r[1]==="(")return pdfText(lit(d,i)[0]);const e=d.indexOf(">",i);const h=d.slice(i+1,e).replace(/\s/g,"");let x="";for(let k=0;k+1<h.length;k+=2)x+=String.fromCharCode(parseInt(h.substr(k,2),16));return pdfText(x)};

  const fontCache=new Map();
  async function font(num){
    if(fontCache.has(num))return fontCache.get(num);
    const d=(get(num)||{}).dict||"",f={bpc:/\/Subtype\s*\/Type0/.test(d)?2:1,cmap:null,diff:null};
    const tu=refOf(d,"ToUnicode");
    if(tu){const b=await stream(get(tu));if(b){const c=parseCMap(bin(b));f.cmap=c.map;if(f.bpc===1&&c.bpc===2)f.bpc=2}}
    const enc=dictOf(d,"Encoding");
    if(enc&&f.bpc===1){const df=/\/Differences\s*\[([^\]]*)\]/.exec(enc);if(df){f.diff={};let c=0;
      for(const t of df[1].match(/\d+|\/[^\s\/\[\]]+/g)||[]){if(t[0]!=="/"){c=+t;continue}const g=t.slice(1);
        f.diff[c++]=GLYPH[g]??(g.length===1?g:/^uni[0-9A-F]{4}$/.test(g)?String.fromCharCode(parseInt(g.slice(3),16)):undefined)}}}
    fontCache.set(num,f);return f;
  }
  function dec(str,f){
    if(!f)return [...str].map(c=>WIN[c.charCodeAt(0)]).join("");
    let r="";for(let k=0;k<str.length;k+=f.bpc){
      const code=f.bpc===2?(str.charCodeAt(k)<<8)|(str.charCodeAt(k+1)||0):str.charCodeAt(k);
      let u=f.cmap&&f.cmap.get(code);
      if(u===undefined)u=f.bpc===1?(f.diff&&f.diff[code]!==undefined?f.diff[code]:WIN[code]):"";
      r+=u}
    return r;
  }
  const WS=c=>c===" "||c==="\n"||c==="\r"||c==="\t"||c==="\f"||c==="\0",DL="()<>[]{}/%";
  function run(s,fonts){
    let i=0,ops=[],f=null,out="",lastY=null;const n=s.length;
    const nl=()=>{if(out&&!out.endsWith("\n"))out+="\n"},sp=()=>{if(out&&!/\s$/.test(out))out+=" "};
    while(i<n){const c=s[i];
      if(WS(c)){i++;continue}
      if(c==="%"){while(i<n&&s[i]!=="\n"&&s[i]!=="\r")i++;continue}
      if(c==="("){const [t,e]=lit(s,i);ops.push({s:t});i=e;continue}
      if(c==="<"){if(s[i+1]==="<"){ops.push("<<");i+=2;continue}let j=s.indexOf(">",i);if(j<0)j=n;
        let h=s.slice(i+1,j).replace(/[^0-9a-fA-F]/g,"");if(h.length%2)h+="0";let t="";for(let k=0;k<h.length;k+=2)t+=String.fromCharCode(parseInt(h.substr(k,2),16));ops.push({s:t});i=j+1;continue}
      if(c===">"){i+=s[i+1]===">"?2:1;continue}
      if(c==="["){ops.push("[");i++;continue}
      if(c==="]"){const k=ops.lastIndexOf("[");const a=k>=0?ops.splice(k).slice(1):[];ops.push({a});i++;continue}
      if(c==="{"||c==="}"){i++;continue}
      if(c==="/"){let j=i+1;while(j<n&&!WS(s[j])&&DL.indexOf(s[j])<0)j++;ops.push({nm:s.slice(i+1,j)});i=j;continue}
      let j=i;while(j<n&&!WS(s[j])&&DL.indexOf(s[j])<0)j++;if(j===i){i++;continue}
      const t=s.slice(i,j);i=j;
      if(/^[+\-]?(\d+\.?\d*|\.\d+)$/.test(t)){ops.push(+t);continue}
      const L=ops.length;
      switch(t){
        case "Tf":{const nm=ops.find(o=>o&&o.nm);f=nm?fonts[nm.nm]||null:null;break}
        case "Tj":case "'":case '"':{if(t!=="Tj")nl();const st=[...ops].reverse().find(o=>o&&o.s!==undefined);if(st)out+=dec(st.s,f);break}
        case "TJ":{const a=ops.find(o=>o&&o.a);if(a)for(const e of a.a){if(typeof e==="number"){if(e<-180)sp()}else if(e&&e.s!==undefined)out+=dec(e.s,f)}break}
        case "Td":case "TD":{const ty=ops[L-1],tx=ops[L-2];if(typeof ty==="number"&&Math.abs(ty)>0.5)nl();else if(typeof tx==="number"&&tx>0)sp();break}
        case "T*":nl();break;
        case "Tm":{const y=ops[L-1];if(typeof y==="number"){if(lastY!==null&&Math.abs(y-lastY)>1)nl();else sp();lastY=y}break}
        case "ET":sp();break;
        case "BI":{let k=s.indexOf("ID",i)+2;for(;;){k=s.indexOf("EI",k);if(k<0){k=n;break}if(WS(s[k-1])&&(k+2>=n||WS(s[k+2])))break;k+=2}i=k+2;break}
      }
      ops=[];
    }
    return out;
  }
  // páginas na ordem do documento
  const pages=[];
  const cat=[...objs.values()].find(o=>/\/Type\s*\/Catalog/.test(o.dict));
  const walk=(num,res,depth)=>{const o=get(num);if(!o||depth>25||pages.length>=60)return;const d=o.dict,r=dictOf(d,"Resources")||res;
    if(/\/Type\s*\/Pages/.test(d)){const k=/\/Kids\s*\[([^\]]*)\]/.exec(d);if(k)for(const x of k[1].matchAll(/(\d+)\s+\d+\s+R/g))walk(+x[1],r,depth+1)}
    else pages.push({d,res:r})};
  if(cat){const p=refOf(cat.dict,"Pages");if(p)walk(p,null,0)}
  if(!pages.length)for(const o of objs.values())if(/\/Type\s*\/Page(?!s)/.test(o.dict))pages.push({d:o.dict,res:dictOf(o.dict,"Resources")});
  let text="";
  for(const p of pages.slice(0,40)){
    const fonts={},fd=dictOf(p.res,"Font")||"";
    for(const x of fd.matchAll(/\/([^\s\/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g))fonts[x[1]]=await font(+x[2]);
    let refs=[];const c1=/\/Contents\s*\[([^\]]*)\]/.exec(p.d),c2=refOf(p.d,"Contents");
    if(c1)refs=[...c1[1].matchAll(/(\d+)\s+\d+\s+R/g)].map(x=>+x[1]);
    else if(c2){const o=get(c2);refs=o&&!o.data?[...o.dict.matchAll(/(\d+)\s+\d+\s+R/g)].map(x=>+x[1]):[c2]}
    let cs="";for(const r of refs){const b=await stream(get(r));if(b)cs+=bin(b)+"\n"}
    text+=run(cs,fonts)+"\n\f\n";
  }
  text=text.replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").replace(/(\p{L})-\n(\p{Ll})/gu,"$1$2");
  // metadados
  const infoRefs=[...s.matchAll(/\/Info\s+(\d+)\s+\d+\s+R/g)],info=infoRefs.length?(get(+infoRefs[infoRefs.length-1][1])||{}).dict:"";
  let xmp="";const xa=s.indexOf("<x:xmpmeta"),xb=s.indexOf("</x:xmpmeta>");
  if(xa>=0&&xb>xa)xmp=new TextDecoder().decode(u8.subarray(xa,xb));
  else for(const o of objs.values())if(/\/Type\s*\/Metadata/.test(o.dict)){const b=await stream(o);if(b){xmp=new TextDecoder().decode(b);break}}
  const tag=n=>{const r=new RegExp("<"+n+"[^>]*>([\\s\\S]*?)</"+n+">").exec(xmp);if(r){const li=[...r[1].matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/g)].map(x=>ent(x[1]).trim()).filter(Boolean);return li.length?li:[ent(r[1]).trim()]}
    const a=new RegExp(n+'="([^"]*)"').exec(xmp);return a?[ent(a[1]).trim()]:[]};
  return {text,pages:pages.length,
    info:{title:strOf(info,"Title"),author:strOf(info,"Author"),subject:strOf(info,"Subject"),date:strOf(info,"CreationDate")},
    xmp:{title:tag("dc:title")[0]||"",creators:tag("dc:creator"),doi:tag("prism:doi")[0]||(tag("dc:identifier").find(x=>/10\.\d{4}/.test(x))||""),
      journal:tag("prism:publicationName")[0]||"",date:tag("prism:coverDate")[0]||tag("prism:publicationDate")[0]||"",volume:tag("prism:volume")[0]||"",
      sp:tag("prism:startingPage")[0]||"",ep:tag("prism:endingPage")[0]||""}};
}

/* transforma o resultado em campos de fonte para o formulário */
function meta(r,fileName){
  const text=r.text,flat=text.replace(/\s+/g," ").trim(),x=r.xmp,inf=r.info,warn=[];
  const letters=(flat.match(/\p{L}/gu)||[]).length;
  if(flat.length<300)warn.push("Quase nenhum texto legível: o PDF pode ser escaneado (imagem). Preencha os campos manualmente.");
  else if(letters/flat.length<0.55)warn.push("Parte do texto saiu ilegível (fonte sem mapa de caracteres). Confira os campos.");
  const badT=t=>!t||t.length<12||/\.(docx?|pdf|tex|indd)$|untitled|microsoft word|^doi:|^\d+$/i.test(t);
  let title=[x.title,inf.title].find(t=>!badT(t))||"";
  if(!title){const p1=text.split("\f")[0].split("\n").map(l=>l.trim());
    title=p1.find(l=>l.length>=25&&l.length<=250&&/\p{Ll}/u.test(l)&&!/doi|journal|http|www\.|©|copyright|received|accepted|issn|vol\.|volume|original (article|research)|review article|downloaded|elsevier|springer|licen[cs]e/i.test(l))||"";}
  title=title.replace(/\s+/g," ").trim();
  let authors=x.creators.length?x.creators:(inf.author?inf.author.split(/\s*;\s*|\s*,\s*(?=\S+\s+\S)|\s+and\s+|\s*&\s*/).filter(a=>a.trim().length>2):[]);
  authors=authors.map(a=>a.replace(/[\d*†‡§¹²³]+/g,"").replace(/\s+/g," ").trim()).filter(Boolean);
  const sur=n=>n.includes(",")?n.split(",")[0].trim():n.split(" ").pop();
  const ini=n=>{const g=n.includes(",")?n.split(",")[1]||"":n.split(" ").slice(0,-1).join(" ");return g.split(/[\s.\-]+/).filter(Boolean).map(w=>w[0].toUpperCase()).join("")};
  const head=flat.slice(0,4000),yNow=new Date().getFullYear()+1;
  const yrOK=y=>y&&+y>=1950&&+y<=yNow;
  let year=(/(19|20)\d{2}/.exec(x.date)||[])[0];
  if(!yrOK(year)){const ys=[...head.matchAll(/(?:©|\(|\b)((?:19|20)\d{2})(?=[);,.\s])/g)].map(m=>m[1]).filter(yrOK);year=ys[0]}
  if(!yrOK(year))year=(/D:((?:19|20)\d{2})/.exec(inf.date)||[])[1]||"";
  let doi=x.doi.replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i,"");
  if(!doi){const d=/\b(10\.\d{4,9}\/[^\s"<>,;]+)/.exec(flat);if(d)doi=d[1]}
  doi=doi.replace(/[.)\]]+$/,"");
  let short="";
  if(authors.length===1)short=`${sur(authors[0])}${year?", "+year:""}`;
  else if(authors.length===2)short=`${sur(authors[0])} & ${sur(authors[1])}${year?", "+year:""}`;
  else if(authors.length>2)short=`${sur(authors[0])} et al.${year?", "+year:""}`;
  else{short=(title.split(" ").slice(0,5).join(" ")||fileName.replace(/\.pdf$/i,""))+(year?` (${year})`:"");warn.push("Autores não encontrados nos metadados: ajuste o campo “Autor e ano”.")}
  const au=authors.slice(0,3).map(a=>`${sur(a)} ${ini(a)}`.trim()).join(", ")+(authors.length>3?" et al":"");
  const pg=x.sp?(x.ep?`${x.sp}–${x.ep}`:x.sp):"";
  const full=[au,title,[x.journal,[year,x.volume].filter(Boolean).join(";")+(pg?":"+pg:"")].filter(Boolean).join(", "),doi?"doi:"+doi:""].filter(Boolean).join(". ").replace(/\.\./g,".")||fileName;
  const ai=head.search(/\b(abstract|resumo|summary)\b/i);
  const abs=(ai>=0?flat.slice(ai,ai+1800):flat.slice(0,1800)).trim();
  const low=(title+" "+abs).toLowerCase();
  const type=/umbrella review|revisão guarda-chuva/.test(low)?"Umbrella review":/network meta-analy|meta-análise em rede|metanálise em rede/.test(low)?"Meta-análise em rede":/meta-analy|meta-análise|metanálise|metaanálise/.test(low)?"Meta-análise":/systematic review|revisão sistemática/.test(low)?"Revisão sistemática":/randomi[sz]ed|randomizado|ensaio clínico|controlled trial|crossover/.test(low)?"Ensaio clínico":/\breview\b|revisão/.test(low)?"Revisão narrativa":"Estudo original";
  const st=/(\d{1,4})\s+(?:studies|trials|articles|estudos|artigos|ensaios)/i.exec(abs),pa=/(\d[\d,.]{0,6})\s+(?:healthy\s+|trained\s+|untrained\s+|young\s+|older\s+)?(?:participants|subjects|individuals|volunteers|men|women|athletes|adults|participantes|sujeitos|indivíduos|voluntários|homens|mulheres)/i.exec(abs),ne=/\bn\s*=\s*(\d+)/i.exec(abs);
  const n=[st&&`${st[1]} estudos`,pa?`${pa[1]} participantes`:ne&&`n = ${ne[1]}`].filter(Boolean).join(", ");
  const sents=abs.replace(/^(abstract|resumo|summary)[:.\s]*/i,"").split(/(?<=[.;])\s+(?=[A-Z(])/);
  const hits=sents.filter(z=>/\d/.test(z)&&/%|p\s*[<=≤]|\bES\s*=|SMD|effect size|tamanho de efeito|\bCI\b|IC\s*95|\bg\s*=|\bd\s*=|±|\bvs\.?\b|\bfold\b/i.test(z)&&!/doi|©|copyright/i.test(z));
  let stat=hits[0]||"";if(stat&&stat.length<130&&hits[1])stat+=" "+hits[1];if(stat.length>300)stat=stat.slice(0,297).replace(/\s\S*$/,"")+"…";
  return {short,full,type,n,url:doi?"https://doi.org/"+doi:"",stat,abs,title,doi,warn,pages:r.pages,flat};
}
return {read,meta};
})();
