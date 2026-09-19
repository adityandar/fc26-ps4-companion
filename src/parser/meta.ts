import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

export interface DbMeta { readonly tableNames: Map<string, string>; readonly fieldNames: Map<string, string>; readonly fieldRange: Map<string, number> }
const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
export function parseDbMeta(xml: string): DbMeta {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml) as any;
  const meta: DbMeta = { tableNames: new Map(), fieldNames: new Map(), fieldRange: new Map() };
  for (const table of array(doc.database?.table)) { const tableName = String(table['@_name']); meta.tableNames.set(String(table['@_shortname']), tableName); for (const field of array(table.fields?.field)) { const name = String(field['@_name']); meta.fieldNames.set(String(field['@_shortname']), name); meta.fieldRange.set(tableName + name, Number(field['@_rangelow'] ?? 0) || 0); } }
  if (!meta.tableNames.size) throw new Error('meta XML contains no database tables');
  return meta;
}
export const loadDbMeta = (path: string): DbMeta => parseDbMeta(readFileSync(path, 'utf8'));
