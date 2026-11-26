import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {renderComponent} from './index.mjs';

for (const name of ['kpi','bars','progress','steps','compare','pros-cons','faq','status']) {
  test(name + ' schema, escaping, caption and budgets', () => {
    const data = JSON.parse(readFileSync(new URL('./packs/'+name+'/example.json', import.meta.url)));
    assert.equal(renderComponent(name, {}).error.code, 'INVALID_DATA');
    const input = '<svg>&"';
    if (name === 'status') data.m[0][0] = input;
    else data.title = input;
    const {html, caption} = renderComponent(name, data, {chatData:true});
    assert.ok(html.includes('&lt;svg&gt;&amp;&quot;'));
    assert.ok(!html.includes(input));
    assert.ok(caption.includes(input) && caption.length <= 1024);
    assert.ok(Buffer.byteLength(html) <= 32768 && deflateSync(html,{level:9}).length <= 4096);
  });
}

test('compare enforces rectangular rows and encoded chat data budget', () => {
  const data = {title:'Comparison', columns:['A','B','C'], rows:[['short']]};
  assert.equal(renderComponent('compare',data).error.code,'INVALID_DATA');
  data.rows = Array.from({length:6}, () => Array(3).fill('界'.repeat(30)));
  assert.equal(renderComponent('compare',data,{chatData:true}).error.code,'CHAT_DATA_LIMIT');
  assert.ok(renderComponent('compare',data).html);
});

test('long FAQ fallback truncates without splitting a surrogate pair', () => {
  const text = '𐐷';
  const item = {question:text.repeat(64),answer:text.repeat(120)};
  const data = {title:'FAQ',items:Array(4).fill(item)};
  const {caption} = renderComponent('faq',data);
  assert.ok(caption.endsWith('…') && caption.length <= 1024);
  assert.equal(Buffer.from(caption).toString(),caption);
});

test('pros-cons defaults and optional headings reach HTML and caption', () => {
  const data = {title:'Выбор',pros:['Быстро'],cons:['Дорого']};
  for (const labels of [{}, {prosLabel:'За & ещё',consLabel:'Против'}]) {
    const {html,caption} = renderComponent('pros-cons',{...data,...labels});
    assert.match(html, labels.prosLabel ? /За &amp; ещё/ : /Плюсы/);
    assert.ok(caption.includes(labels.prosLabel ?? 'Плюсы'));
    assert.ok(html.includes(labels.consLabel ?? 'Минусы'));
    assert.ok(caption.includes(labels.consLabel ?? 'Минусы'));
  }
});

test('status renders compact groups, jobs, details and overflow', () => {
  const data = {m:[['Группа',Array(9).fill(['Этап',105])]],j:[['Тест',31.6,'r',{m:'local',t:0,s:'Сверка',r:'Готово'}],['Сборка',0,'q']],l:'Лимит'};
  const {html,caption} = renderComponent('status',data);
  for (const text of ['Группа','+1','100%','32%','local','Минут: 0','Сверка','Готово','Сборка','Лимит']) assert.ok(html?.includes(text),text);
  assert.ok(caption.includes('Готово'));
  assert.ok(!html.includes('<script'));
});
