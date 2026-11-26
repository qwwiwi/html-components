const {labels,series}=data;
if(kind==='line-area'){
  const all=series.flatMap(s=>s.values),low=Math.min(...all),high=Math.max(...all);
  const x=i=>57+212*i/(labels.length-1);
  const y=v=>148-114*(v-low)/(high-low||1);
  textAt(6,45,high,{'text-anchor':'start',fill:'#c2ccb9'});
  textAt(6,147,low,{'text-anchor':'start',fill:'#c2ccb9'});
  for(let i=0;i<4;i++) line(4,34+38*i,275,34+38*i,{'stroke-dasharray':'2 4'});
  series.forEach(({values},j)=>{
    const color=colors[j],gradient=shape('linearGradient',{id:'g'+j,x2:0,y2:'100%'});
    for(const [offset,opacity] of [[0,.42],[1,.01]]) shape('stop',{offset,'stop-color':color,'stop-opacity':opacity},gradient);
    let path='M'+x(0)+' '+y(values[0]);
    values.slice(1).forEach((v,k)=>{
      const mid=(x(k)+x(k+1))/2;
      path+=' C'+[mid,y(values[k]),mid,y(v),x(k+1),y(v)].join(' ');
    });
    shape('path',{d:path+' V155 H57 Z',fill:'url(#g'+j+')'});
    shape('path',{d:path,stroke:color,fill:'none','stroke-width':2.5,pathLength:1,class:'draw'});
    for(const v of new Set([Math.min(...values),Math.max(...values)]))
      shape('circle',{cx:x(values.indexOf(v)),cy:y(v),r:3,fill:color,stroke:'#202820'});
    const last=values[values.length-1];
    shape('circle',{cx:x(values.length-1),cy:y(last),r:3,fill:color});
    const labelY=22+j*17;
    line(272,y(last),283,labelY-3,{stroke:color,'stroke-opacity':.55});
    textAt(314,labelY,last,{'text-anchor':'end',fill:color});
  });
  textAt(12,173,labels[0],{'text-anchor':'start'});
  textAt(302,173,labels[labels.length-1],{'text-anchor':'end'});
  finish(184);
}else{
  const point=(i,r)=>{const a=2*Math.PI*i/labels.length-Math.PI/2;return [160+r*Math.cos(a),111+r*Math.sin(a)]};
  for(const r of [18,36,54,72]) shape('polygon',{points:labels.map((_,i)=>point(i,r)).join(' '),fill:'none',stroke:'#556253'});
  labels.forEach((label,i)=>{
    line(160,111,...point(i,72));
    const [x,y]=point(i,79);
    textAt(x,y+3,label,{'text-anchor':x<155?'end':x>165?'start':'middle'});
  });
  series.forEach(({values},i)=>shape('polygon',{points:values.map((v,j)=>point(j,72*v/100)).join(' '),fill:colors[i],'fill-opacity':.18,stroke:colors[i],class:'grow'}));
  finish(222);
}

document.getElementById('matrix').style.display='none';
