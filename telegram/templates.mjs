// Templates receive validated data. All text passes through the same encoder.
const entities = {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
export const escape = value => String(value).replace(/[&<>"']/g, char => entities[char]);
const line = value => '<span class="line">' + escape(value) + '</span>';
const meter = ({label,value}) => '<section>'+line(label)+'<strong>'+value+'%</strong><div class="track"><i style="width:'+value+'%"></i></div></section>';
const list = items => items.map(item => '<li>'+line(item)+'</li>').join('');
const join = items => items.join('\n');

export const templates = {
  kpi: {
    body: d => '<div class="grid">'+d.metrics.map(m => '<section><strong class="number">'+escape(m.value)+'</strong>'+line(m.label)+'</section>').join('')+'</div>',
    caption: d => join(d.metrics.map(m => m.label+' '+m.value))
  },
  bars: {body: d => d.rows.map(meter).join(''), caption: d => join(d.rows.map(r => r.label+' '+r.value+'%'))},
  progress: {body: meter, caption: d => d.label+' '+d.value+'%'},
  steps: {body: d => '<ol>'+list(d.steps)+'</ol>', caption: d => join(d.steps.map((s,i) => (i+1)+'. '+s))},
  compare: {
    body: d => '<table><thead><tr>'+d.columns.map(c => '<th>'+line(c)+'</th>').join('')+'</tr></thead><tbody>'+
      d.rows.map(row => '<tr>'+row.map(c => '<td>'+line(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>',
    caption: d => join([d.columns,...d.rows].map(row => row.join(' | ')))
  },
  'pros-cons': {
    body: d => ['pros','cons'].map(key => '<section><h2>'+key+'</h2><ul>'+list(d[key])+'</ul></section>').join(''),
    caption: d => 'Pros\n'+join(d.pros)+'\nCons\n'+join(d.cons)
  },
  faq: {
    body: d => d.items.map(i => '<section><h2>'+line(i.question)+'</h2><p>'+escape(i.answer)+'</p></section>').join(''),
    caption: d => join(d.items.map(i => i.question+'\n'+i.answer))
  },
  status: {body: d => '<section><strong>'+line(d.state)+'</strong><p>'+escape(d.detail)+'</p></section>', caption: d => d.state+'\n'+d.detail}
};
