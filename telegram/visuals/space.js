const stage=document.getElementById('stage'),canvas=document.createElement('canvas');
canvas.width=640;canvas.height=400;
const ctx=canvas.getContext('2d');
if(!ctx) return;
ctx.scale(2,2);
const bars=kind==='bars3d',items=bars?data.items:data.nodes;
let angle=-.62,timer;
function project(x,y,z){
  const depth=x*Math.sin(angle)+z*Math.cos(angle);
  const side=x*Math.cos(angle)-z*Math.sin(angle),scale=230/(240-depth*.45);
  return {x:160+side*scale,y:(bars?153:100)+(depth*.38-y)*scale,depth,scale};
}
function face(points,color){
  ctx.beginPath();
  points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function label(p,value){
  ctx.fillStyle='#faf8f2';ctx.font='bold 11px sans-serif';ctx.textAlign='center';
  ctx.fillText(String(value),p.x,p.y-7);
}
function frame(){
  ctx.clearRect(0,0,320,200);
  const n=items.length,peak=bars?Math.max(1,...items.map(v=>v.value)):1;
  const points=items.map((v,i)=>{
    const a=2*Math.PI*i/n,z=1-2*(i+.5)/n,r=Math.sqrt(1-z*z);
    const x=bars?(i-(n-1)/2)*Math.min(35,200/n):95*r*Math.cos(i*2.4);
    const y=bars?0:66*z;
    const depth=bars?15*Math.sin(a):90*r*Math.sin(i*2.4);
    return {i,x,y,z:depth,p:project(x,y,depth)};
  });
  if(!bars) for(const {source,target} of data.edges){
    const a=points[source].p,b=points[target].p;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#658474';ctx.stroke();
  }
  for(const {i,x,y,z,p} of points.sort((a,b)=>a.p.depth-b.p.depth)){
    if(bars){
      const h=items[i].value/peak*89,w=Math.min(10,70/n);
      const corners=[[-w,-w],[w,-w],[w,w],[-w,w]];
      const layer=height=>corners.map(([dx,dz])=>project(x+dx,height,z+dz));
      const bottom=layer(0),top=layer(h);
      const sides=corners.map((_,j)=>{
        const k=(j+1)%4;
        return {depth:bottom[j].depth+bottom[k].depth,points:[bottom[j],bottom[k],top[k],top[j]],color:j%2?'#88a824':'#526f37'};
      });
      for(const side of sides.sort((a,b)=>a.depth-b.depth)) face(side.points,side.color);
      face(top,'#d4ff00');label(project(x,h,z),items[i].value);
      label({...p,y:p.y+22},i+1);
    }else{
      ctx.globalAlpha=.68+(p.depth+90)/560;
      ctx.beginPath();ctx.arc(p.x,p.y,7*p.scale,0,2*Math.PI);ctx.fillStyle=i?'#8ecfc2':'#d4ff00';ctx.fill();
      label({...p,y:p.y-4},items[i].label);ctx.globalAlpha=1;
    }
  }
}
frame();stage.appendChild(canvas);
const toggle=document.createElement('button');
function rotation(on){
  clearInterval(timer);
  if(on) timer=setInterval(()=>{angle+=.009;frame()},75);
  toggle.textContent=on?'Пауза':'Вращать';
  toggle.setAttribute('aria-pressed',String(on));
}
toggle.onclick=()=>rotation(toggle.getAttribute('aria-pressed')!=='true');
stage.appendChild(toggle);
rotation(true);
