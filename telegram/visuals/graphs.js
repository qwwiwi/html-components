const {nodes,edges}=data;
const flow=kind==='flowchart';
const ranks=nodes.map(()=>0);
if(flow) for(let pass=0;pass<nodes.length;pass++)
  for(const {source,target} of edges) ranks[target]=Math.max(ranks[target],ranks[source]+1);
const groups=[...new Set(nodes.map((n,i)=>flow?ranks[i]:n.lane))];
if(flow) groups.sort((a,b)=>a-b);
const points=[];
let y=0;
for(const [g,key] of groups.entries()){
  const members=nodes.map((n,i)=>i).filter(i=>(flow?ranks[i]:nodes[i].lane)===key);
  const rowHeight=flow?42:57;
  if(!flow){
    shape('rect',{x:4,y:y+2,width:312,height:53,rx:7,fill:g%2?'#262f29':'#303730'});
    textAt(11,y+14,key,{'text-anchor':'start',fill:'#b6c6ac'});
  }
  members.forEach((i,j)=>points[i]={x:320*(j+.5)/members.length,y:y+(flow?21:33),w:Math.min(82,300/members.length-4)});
  y+=rowHeight;
}
for(const [i,{source,target,label}] of edges.entries()){
  const a=points[source],b=points[target],dx=b.x-a.x,dy=b.y-a.y;
  const factor=Math.max(Math.abs(dx)/(b.w/2+2),Math.abs(dy)/12);
  const end={x:b.x-dx/factor,y:b.y-dy/factor};
  const attrs={stroke:colors[i%3],'stroke-width':1.4};
  line(a.x,a.y,end.x,end.y,{...attrs,class:flow?'dash':''});
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  shape('path',{d:'M0 0l-6 -3v6z',fill:attrs.stroke,transform:'translate('+end.x+' '+end.y+') rotate('+angle+')'});
  if(!flow){
    const dot=shape('circle',{cx:a.x,cy:a.y,r:2.8,fill:colors[i%3],class:'packet'});
    dot.setAttribute('style','--dx:'+dx+'px;--dy:'+dy+'px');
    textAt((a.x+b.x)/2+5,(a.y+b.y)/2-3,label,{'text-anchor':'start','font-size':8});
  }
}
nodes.forEach((n,i)=>{
  const {x,y,w}=points[i],attrs={stroke:colors[i%3],fill:'#202820'};
  if(n.kind==='decision') shape('polygon',{points:[[x-w/2,y],[x,y-15],[x+w/2,y],[x,y+15]].join(' '),...attrs});
  else shape('rect',{x:x-w/2,y:y-10,width:w,height:20,rx:7,...attrs});
  textAt(x,y+3,n.label.length*6<w-6?n.label:i+1);
});
finish(y);
