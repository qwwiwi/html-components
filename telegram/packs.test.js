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
  data.rows = Array.from({length:4}, () => Array(3).fill('界'.repeat(30)));
  assert.equal(renderComponent('compare',data,{chatData:true}).error.code,'CHAT_DATA_LIMIT');
  assert.ok(renderComponent('compare',data).html);
});

test('long status fallback truncates without splitting a surrogate pair', () => {
  const text = '𐐷';
  const {caption} = renderComponent('status',{m:[],j:[],l:text.repeat(520)});
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

test('status renders compact groups, jobs and details within row limits', () => {
  const data = {m:[['Группа',Array(4).fill(['Этап',105])]],j:[['Тест',31.6,'r',{m:'local',t:0,s:'Сверка',r:'Готово'}],['Сборка',0,'q']],l:'Лимит'};
  const {html,caption} = renderComponent('status',data);
  for (const text of ['Группа','100%','32%','local','Минут: 0','Сверка','Готово','Сборка','Лимит']) assert.ok(html?.includes(text),text);
  assert.ok(caption.includes('Готово'));
  assert.ok(!html.includes('<script'));
  data.m[0][1].push(['Ещё',0]);
  assert.equal(renderComponent('status',data).error.code,'INVALID_DATA');
});

for (const name of ['widgets', 'status']) {
  test(name + ' CSS allows full text to wrap', () => {
    const css = readFileSync(new URL('./' + name + '.css', import.meta.url), 'utf8');
    const wrappingRules = name === 'status'
      ? css.replace(/(^|})\s*\.pct\s*\{[^}]*\}/g, '$1')
      : css;
    assert.doesNotMatch(css, /text-overflow\s*:\s*ellipsis|(?:-webkit-)?line-clamp\s*:/i);
    assert.doesNotMatch(wrappingRules, /white-space\s*:\s*nowrap/i);
  });
}

const widgetStyles = readFileSync(new URL('./widgets.css', import.meta.url), 'utf8');
const statusStyles = readFileSync(new URL('./status.css', import.meta.url), 'utf8');

test('status percentage reserves intrinsic width for 100% on one line', () => {
  const rule = statusStyles.match(/(?:^|})\s*\.pct\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /(?:^|;)\s*white-space:\s*nowrap\s*(?:;|$)/);
  assert.match(rule, /(?:^|;)\s*min-width:\s*max-content\s*(?:;|$)/);
});

test('compare gives the label extra width and aligns value columns', () => {
  assert.match(widgetStyles, /th:first-child,td:first-child\s*\{[^}]*width:48%/);
  assert.match(widgetStyles, /th:not\(:first-child\),td:not\(:first-child\)\s*\{[^}]*text-align:right/);
});

test('status uses readable type and a separate running-state accent', () => {
  const sizes = [...statusStyles.matchAll(/font-size:\s*(\d+)px/g)];
  assert.ok(sizes.every(([,px]) => Number(px) >= 12));
  assert.match(statusStyles, /\.s-r \.bar i\{background:#f4511e\}/i);
  assert.match(statusStyles, /linear-gradient\(to right,#d4ff00/i);
});

test('dark mode distinguishes the step badge and featured KPI tile', () => {
  const dark = widgetStyles.split('@media(prefers-color-scheme:dark)')[1].split('\n}')[0];
  assert.match(dark, /\.steps li:before\{[^}]*background:var\(--lime\)/);
  assert.match(dark, /\.grid section:first-child\{[^}]*border-color:var\(--lime\)/);
});
