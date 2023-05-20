import { EOF, Position } from "./common.ts";

export function prpos([l, c]: Position) : string {
  return `${l}:${c}`
}

export function prstr(c : string) : string {
  let s;

  switch (c) {
    case '\r': s = '\\r'; break;
    case '\n': s = '\\n'; break;
    case '\t': s = '\\t'; break;
    case EOF: s = 'end of file'; break;
    default: s = c;
  }

  return `'${s}'`
}