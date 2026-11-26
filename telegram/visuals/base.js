// Build the drawing offscreen so a failed enhancement leaves the ledger intact.
const stage = document.getElementById('stage');
const colors = ['#d4ff00','#80c9ef','#ffa77f','#b4a3fa','#81d8b0','#f1bb64','#ed96bf','#c8d1cc'];
const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
function shape(tag, attrs, parent=svg) {
  const node=document.createElementNS(svg.namespaceURI,tag);
  for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  parent.appendChild(node);
  return node;
}
function textAt(x,y,value,attrs={}) {
  shape('text',{x,y,'text-anchor':'middle',fill:'#eef1df',...attrs}).textContent=value;
}
function line(x1,y1,x2,y2,attrs={}) {
  return shape('line',{x1,y1,x2,y2,stroke:'#65705e',...attrs});
}
function finish(height) {
  svg.setAttribute('viewBox','0 0 320 '+height);
  svg.setAttribute('aria-hidden','true');
  stage.appendChild(svg);
}
