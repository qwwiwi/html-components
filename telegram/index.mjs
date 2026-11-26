import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {escape, templates} from './templates.mjs';

const schemas = new Map(Object.keys(templates).map(name => [name, JSON.parse(
  readFileSync(new URL('./packs/'+name+'/schema.json', import.meta.url), 'utf8')
)]));

// Interpret the JSON Schema keywords used by this library.
function matches(schema, value) {
  if (schema.anyOf) return schema.anyOf.some(option => matches(option,value));
  if (schema.enum) return schema.enum.includes(value);
  switch (schema.type) {
    case 'string':
      return typeof value === 'string' && [...value].length >= (schema.minLength ?? 0) && [...value].length <= (schema.maxLength ?? Infinity);
    case 'number':
      return Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
    case 'array':
      return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity) &&
        Array.from(value).every((item,i) => matches(schema.prefixItems?.[i] ?? schema.items,item));
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).every(key => Object.hasOwn(schema.properties,key) && matches(schema.properties[key],value[key])) &&
        schema.required.every(key => Object.hasOwn(value,key) );
    default:
      return false;
  }
}

export function validate(name, data) {
  return schemas.has(name) && matches(schemas.get(name), data) &&
    (name !== 'compare' || data.rows.every(row => row.length === data.columns.length));
}

const stylesheet = file => readFileSync(new URL(file, import.meta.url),'utf8');
const css = stylesheet('./widgets.css');
const statusCss = stylesheet('./status.css');

const failure = code => ({error:{code}});
export function renderComponent(name, data, {chatData=false}={}) {
  if (!schemas.has(name)) return failure('UNKNOWN_PACK');
  if (!validate(name,data)) return failure('INVALID_DATA');
  if (chatData && Buffer.byteLength(JSON.stringify(data)) > 1024) return failure('CHAT_DATA_LIMIT');
  const template = templates[name];
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>'+(name === 'status' && data.m ? statusCss : css)+'</style><main class="'+name+'">'+
    (data.title ? '<h1>'+escape(data.title)+'</h1>' : '')+template.body(data)+'</main>';
  if (Buffer.byteLength(html) > 32768 || deflateSync(html,{level:9}).length > 4096) return failure('HTML_LIMIT');
  let caption = [data.title,template.caption(data)].filter(Boolean).join('\n');
  if (caption.length > 1024) caption = caption.slice(0,1023).replace(/[\uD800-\uDBFF]$/,'')+'…';
  return {html,caption};
}
