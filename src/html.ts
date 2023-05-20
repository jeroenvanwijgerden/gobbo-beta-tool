import * as t from "../src/tokenize.ts";
import { Content_node } from "./reify.ts";

export function escape(str: string): string {
  let s = "";
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const c = str[i];

    switch (c) {
      case "&":
        s += "&amp;";
        break;
      case "\t":
        s += "&Tab;";
        break;
      case "\n":
        s += "&#10;";
        break;
      case "<":
        s += "&lt;";
        break;
      case ">":
        s += "&gt;";
        break;
      case '"':
        s += "&quot;";
        break;
      case "'":
        s += "&#39;";
        break;
      default:
        s += c;
        break;
    }
  }
  return s;
}

function css_class(type: t.Token_type): string {
  switch (type) {
    case t.Token_type.Preamble_open:
    case t.Token_type.Preamble_close:
      return "delimeter-preamble";
    case t.Token_type.Preamble_fallback:
      return "operator";
    case t.Token_type.Keyword:
      return "keyword";
    case t.Token_type.Class_start:
      return "delimeter-class";
    case t.Token_type.Name_Binding:
      return "name-binding";
      case t.Token_type.Name_Node_type:
      return "name-node-type";
      case t.Token_type.Name_Property:
      return "name-property";
    case t.Token_type.Child_type_start:
      return "delimeter-child";
    case t.Token_type.Properties_open:
    case t.Token_type.Properties_close:
      return "delimeter-properties";
    case t.Token_type.Property_setting_assign:
      return "operator";
    case t.Token_type.Property_setting_falsify:
      return "operator";
    case t.Token_type.Property_value_Literal:
      return "text-escaped";
    case t.Token_type.Text:
      return "text";
    case t.Token_type.Text_Escaped:
      return "text-escaped";
    case t.Token_type.Node_open:
    case t.Token_type.Node_close:
      return "delimeter-node";
    case t.Token_type.Comment:
      return "comment";
    case t.Token_type.Space:
      return "space";
    case t.Token_type.Ignore:
      return "ignore";
    case t.Token_type.No_parse:
      return "no-parse";
  }
}

export function to_span(token : t.Token) : string {
  return `<span class="gobbo-lang-token-${css_class(token.type)}${token.depth ? ` depth-${1 + ((token.depth - 1) % 3)}` : ""}">${escape(token.content)}</span>`
}

export type Render = (node: Content_node) => string;

export function node_id(id : string ) : string {
  return 'gobbo-node-' + id;
}