import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import * as api from './index.mjs';
const names='flowchart architecture line-area donut timeline-roadmap radar bars3d network3d'.split(' ');
const example = name => JSON.parse(readFileSync(new URL('./packs/'+name+'/example.json',import.meta.url)));
test('compact footer has a finite cap',()=>assert.equal(api.validate('status',{m:[],j:[],l:'a'.repeat(33000)}),false));
test('inclusive byte ceilings',()=>{
  assert.equal(api.budgetError('Ж'.repeat(16384),0),undefined);
  assert.equal(api.budgetError('Ж'.repeat(16384)+'a',0),'HTML_LIMIT');
  const noise=Array.from({length:160},(_,i)=>createHash('sha256').update(String(i)).digest('base64')).join('');
  const seen=new Set();
  for(let n=4900;n<=5400 && seen.size<2;n++){
    const html=noise.slice(0,n),size=deflateSync(html,{level:9}).length;
    if(size===3900 || size===3901){
      assert.equal(api.budgetError(html,0),size===3900?undefined:'HTML_LIMIT');
      seen.add(size);
    }
  }
  assert.equal(seen.size,2);
  const d={m:[],j:[],l:''};
  const left=1024-Buffer.byteLength(JSON.stringify(d));
  d.l='Ж'.repeat(Math.floor(left/2))+'a'.repeat(left%2);
  assert.ok(api.renderComponent('status',d,{chatData:true}).html);
  d.l+='a';
  assert.equal(api.renderComponent('status',d,{chatData:true}).error.code,'CHAT_DATA_LIMIT');
});
for(const name of names) test(name+' offline example and nested escaping',()=>{
  const d=example(name);
  const {html,caption}=api.renderComponent(name,d,{chatData:true});
  assert.ok(html && caption);
  assert.ok(Buffer.byteLength(html)<=32768 && deflateSync(html,{level:9}).length<=3900);
  assert.doesNotMatch(html,/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  const first=d.nodes?.[0]??d.series?.[0]??d.items?.[0];
  first.label='</script><x>';
  const changed=api.renderComponent(name,d);
  assert.ok(changed.html && !changed.html.includes(first.label) && changed.caption.includes(first.label));
});

function maximum(s){
  if(s.anyOf)return maximum(s.anyOf[0]);
  if(s.enum)return s.enum[0];
  if(s.type==='string')return 'Ш'.repeat(s.maxLength);
  if(s.type==='object')return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,maximum(v)]));
  if(s.type==='array')return Array.from({length:s.maxItems},(_,i)=>maximum(s.prefixItems?.[i]??s.items));
  return s.maximum??99;
}
test('maximum fixtures have a bounded layout and disclose omitted lines',()=>{
  for(const name of [...names,'bars','progress','steps','compare','pros-cons','faq','kpi','status']){
    const schema=JSON.parse(readFileSync(new URL('./packs/'+name+'/schema.json',import.meta.url)));
    const d=maximum(schema);
    if(d.edges)d.edges.forEach((e,i)=>Object.assign(e,{source:i%7,target:i%7+1}));
    const layout=api.widgetLayout(name,d);
    assert.ok(layout.height<=600,name+' '+layout.height);
    const {html}=api.renderComponent(name,d);
    assert.ok(html?.includes('max-height:600px'),name);
    if(layout.omitted)assert.ok(html.includes('…ещё '+layout.omitted),name);
    if(name==='status')assert.ok(layout.omitted>0);
  }
});

test('all schema collections are capped and original fixtures are offline',()=>{
  function walk(s){
    if(s.type==='array')assert.ok(Number.isInteger(s.maxItems));
    if(s.type==='string')assert.ok(Number.isInteger(s.maxLength));
    Object.values(s).filter(v=>v && typeof v==='object').forEach(walk);
  }
  for(const name of readdirSync(new URL('./packs/',import.meta.url))){
    walk(JSON.parse(readFileSync(new URL('./packs/'+name+'/schema.json',import.meta.url))));
    const {html}=api.renderComponent(name,example(name),{chatData:true});
    assert.ok(html && Buffer.byteLength(html)<=32768 && deflateSync(html,{level:9}).length<=3900,name);
    assert.doesNotMatch(html,/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  }
});

test('graph and series references are valid and donut totals positive',()=>{
  for(const n of ['flowchart','architecture','network3d']){
    const d=example(n);
    d.edges[0].target=d.nodes.length;
    assert.equal(api.validate(n,d),false);
  }
  const f=example('flowchart');
  f.edges.push({source:5,target:0});
  assert.equal(api.validate('flowchart',f),false);
  for(const n of ['line-area','radar']){
    const d=example(n);d.series[0].values.pop();
    assert.equal(api.validate(n,d),false);
  }
  const d=example('donut');d.items.forEach(v=>v.value=0);
  assert.equal(api.validate('donut',d),false);
});

test('embedded programs draw and handle taps with DOM and canvas test doubles',()=>{
  for(const kind of names.filter(n=>n!=='timeline-roadmap')){
    const data=example(kind);
    const {html}=api.renderComponent(kind,data);
    const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const node=(ns,tag)=>({
      tag,namespaceURI:ns,children:[],attrs:{},style:{},
      appendChild(child){this.children.push(child)},
      setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},
      getContext(){return new Proxy({},{get:(_,key)=>key==='measureText'?text=>({width:text.length*8}):()=>{}})}
    });
    const stage=node(),matrix=node(),buttons=(data.items??[]).map(()=>node());
    let tick;
    const document={getElementById:id=>id==='stage'?stage:matrix,createElement:tag=>node('',tag),
      createElementNS:node,querySelectorAll:()=>buttons};
    runInNewContext(script,{document,setInterval:fn=>{tick=fn;return 1},clearInterval:()=>{tick=null}});
    assert.ok(stage.children.length,kind);
    if(kind.endsWith('3d')){
      tick();
      const toggle=stage.children[1];toggle.onclick();assert.equal(tick,null);
      toggle.onclick();assert.equal(typeof tick,'function');
    }else assert.ok(stage.children[0].children.length>=3);
    if(kind==='donut'){
      buttons[0].onclick();assert.equal(buttons[0].attrs['aria-pressed'],'true');
      buttons[1].onclick();assert.equal(buttons[0].attrs['aria-pressed'],'false');
    }
    if(data.series)assert.equal(matrix.style.display,'none');
  }
});

test('legacy nested values remain inert in rich layouts and previews',()=>{
  const input='<b>&"';
  const cases={
    kpi:d=>d.metrics[0].label=input, bars:d=>d.rows[0].label=input,
    progress:d=>d.label=input, steps:d=>d.steps[0]=input,
    compare:d=>d.rows[0][1]=input, 'pros-cons':d=>d.cons[0]=input,
    faq:d=>d.items[0].answer=input, status:d=>d.j[0][3].r=input
  };
  for(const [name,mutate] of Object.entries(cases)){
    const d=example(name);mutate(d);
    const {html,caption}=api.renderComponent(name,d);
    assert.ok(html.includes('&lt;b&gt;&amp;&quot;') && !html.includes(input),name);
    assert.ok(caption.includes(input),name);
  }
});

test('wave titles wrap and enhanced example heights fit 360px',()=>{
  for(const name of names){
    const d=example(name),{html}=api.renderComponent(name,d);
    const headingRules=[...html.matchAll(/([^{}]*\bh1\b[^{}]*)\{([^{}]*)\}/g)];
    for(const [,selector,style] of headingRules)
      assert.doesNotMatch(style,/text-overflow|nowrap|line-clamp/,selector);
    assert.ok(api.widgetLayout(name,d).height<=360,name);
  }
});

test('radar renders percentage ticks and bars retain legend values',()=>{
  const data=example('radar'), labels=[];
  const node=()=>({style:{},setAttribute(){},appendChild(){},set textContent(value){labels.push(value)}});
  const document={createElementNS:node,getElementById:node};
  runInNewContext(api.renderComponent('radar',data).html.match(/<script>(.*?)<\/script>/s)[1],{document});
  assert.ok(labels.includes('40%'));
  assert.doesNotMatch(api.renderComponent('bars3d',example('bars3d')).html,/\.bars3d [^{}]*ledger b\{display:none/);
});

function drawing(kind){
  const data=example(kind), shapes=[], calls=[];
  const ctx=new Proxy({measureText:s=>({width:s.length*8})},{
    get:(target,key)=>target[key]??((...args)=>calls.push([key,...args]))
  });
  const node=tag=>({tag,style:{},appendChild(){},getContext:()=>ctx,
    setAttribute(k,v){this[k]=v}});
  const document={getElementById:node,createElement:node,createElementNS:(_,tag)=>{
    const el=node(tag);shapes.push(el);return el;
  }};
  const html=api.renderComponent(kind,data).html;
  runInNewContext(html.match(/<script>(.*?)<\/script>/s)[1],{document,setInterval(){},clearInterval(){}});
  return {shapes,calls};
}

test('architecture titles and route pills have clearance',()=>{
  const {shapes}=drawing('architecture');
  for(const title of ['Шлюз','Агенты']){
    const el=shapes.find(s=>s.textContent===title);
    const zone=shapes.find(s=>s.fill==='var(--zone)' && el.y>s.y && el.y<s.y+s.height);
    assert.ok(el.y-zone.y>=20,title);
  }
  for(const pill of shapes.filter(s=>s.rx===8)){
    for(const path of shapes.filter(s=>s.tag==='path' && s.fill==='none')){
      let x,y;
      for(const [,op,a,b] of path.d.matchAll(/([MHV])([\d.]+)(?: ([\d.]+))?/g)){
        const nx=op==='V'?x:+a,ny=op==='H'?y:op==='V'?+a:+b;
        if(op!=='M')assert.ok(Math.max(x,nx)<pill.x-1 || Math.min(x,nx)>pill.x+pill.width+1 ||
          Math.max(y,ny)<pill.y-1 || Math.min(y,ny)>pill.y+pill.height+1,path.d);
        x=nx;y=ny;
      }
    }
  }
});

test('radar ticks stay below the center and left axis has a gutter',()=>{
  const {shapes}=drawing('radar');
  assert.ok(shapes.filter(s=>String(s.textContent).endsWith('%')).every(s=>s.y>=111));
  const left=shapes.find(s=>s.textContent==='Поддержка');
  assert.ok(left['text-anchor']==='start' && left.x>=9);
});

test('network captions clear every projected node',()=>{
  const {calls}=drawing('network3d');
  const labels=calls.filter(c=>c[0]==='fillText');
  assert.equal(labels.length,example('network3d').nodes.length);
  for(const [i,[,s,x,y]] of labels.entries()){
    for(const [,t,tx,ty] of labels.slice(i+1))
      assert.ok(Math.abs(x-tx)>=(s.length+t.length)*4+4 || Math.abs(y-ty)>=21,s+' / '+t);
    for(const [index,[op,ax,ay]] of calls.entries()){
      if(op!=='moveTo')continue;
      const [,bx,by]=calls[index+1];
      for(let step=0;step<=100;step++){
        const ex=ax+(bx-ax)*step/100,ey=ay+(by-ay)*step/100;
        assert.ok(Math.abs(x-ex)>s.length*4+2 || ey<y-16 || ey>y+5,s);
      }
    }
  }
  for(const [,s,x,y] of labels)for(const [,cx,cy,r] of calls.filter(c=>c[0]==='arc')){
    const dx=Math.max(0,Math.abs(cx-x)-s.length*4),dy=Math.max(0,y-14-cy,cy-y-3);
    assert.ok(Math.hypot(dx,dy)>=r+2,s);
  }
});

test('line legend puts value before cutoff',()=>{
  assert.match(api.renderComponent('line-area',example('line-area')).html,/Принято<\/span><b>· 45 к 18:00/);
});

test('rotation control has a 44px minimum height',()=>{
  for(const n of ['bars3d','network3d'])
    assert.match(api.renderComponent(n,example(n)).html,/#stage button\{[^}]*min-height:44px/);
});
