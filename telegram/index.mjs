import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {escape, templates} from './templates.mjs';

const schemas = new Map(Object.keys(templates).map(name => [name, JSON.parse(
  readFileSync(new URL('./packs/'+name+'/schema.json', import.meta.url), 'utf8')
)]));

// Interpret the JSON Schema keywords used by this library.
function matches(schema, value) {
  switch (schema.type) {
    case 'string':
      return typeof value === 'string' && value.length > 0 && [...value].length <= schema.maxLength;
    case 'number':
      return Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
    case 'array':
      return Array.isArray(value) && value.length >= schema.minItems && value.length <= schema.maxItems &&
        Array.from(value).every(item => matches(schema.items,item));
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).length === schema.required.length &&
        schema.required.every(key => Object.hasOwn(value,key) && matches(schema.properties[key],value[key]));
    default:
      return false;
  }
}

export function validate(name, data) {
  return schemas.has(name) && matches(schemas.get(name), data) &&
    (name !== 'compare' || data.rows.every(row => row.length === data.columns.length));
}

const css = `
:root{color-scheme:light dark;--paper:#fffefa;--ink:#24251e;--line:#d8d7c9;--fill:#556521}
@media(prefers-color-scheme:dark){:root{--paper:#15150f;--ink:#faf8f2;--line:#494b40;--fill:#d4ff00}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.35 system-ui,sans-serif}
main{max-width:430px;margin:auto;padding:12px}
h1,h2,p,ol,ul{margin:0}h1{font-size:21px;margin-bottom:8px}h2{font-size:16px}
h1,.line,.number{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
section,li,th,td{border-top:1px solid var(--line);padding:6px 0}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.number{font-size:26px}
.track{background:var(--line);height:5px}.track i{display:block;height:100%;background:var(--fill)}
ol,ul{padding-left:26px}table{width:100%;table-layout:fixed;border-collapse:collapse}th,td{text-align:left;padding:6px 3px}
`;

const failure = code => ({error:{code}});
export function renderComponent(name, data, {chatData=false}={}) {
  if (!schemas.has(name)) return failure('UNKNOWN_PACK');
  if (!validate(name,data)) return failure('INVALID_DATA');
  if (chatData && Buffer.byteLength(JSON.stringify(data)) > 1024) return failure('CHAT_DATA_LIMIT');
  const template = templates[name];
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>'+css+'</style><main><h1>'+escape(data.title)+'</h1>'+template.body(data)+'</main>';
  if (Buffer.byteLength(html) > 32768 || deflateSync(html,{level:9}).length > 4096) return failure('HTML_LIMIT');
  let caption = data.title+'\n'+template.caption(data);
  if (caption.length > 1024) caption = caption.slice(0,1023).replace(/[\uD800-\uDBFF]$/,'')+'…';
  return {html,caption};
}
