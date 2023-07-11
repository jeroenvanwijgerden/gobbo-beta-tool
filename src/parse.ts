// deno-lint-ignore-file no-fallthrough
import { EOF, ERROR_TYPE, EXCEPTION_NAME, Position } from "./common.ts";
import { prstr } from "./fmt.ts";

export enum Concept {
  File,
  Name,
  Node,
  Node_type,
  Classes,
  Class,
  Properties,
  Property_setting,
  Property_value,
  Property_name,
  Preamble,
  Preamble_element,
  Preamble_element_Class,
  Preamble_element_Default,
  Text_Escaped,
  Text_Escaped_line_padding,
  Content_Bound,
  Property_value_Bound,
}

export interface Parse_info {
  // TODO:
  // this module shouldn't care about lines and columns.
  // Just report the index and the source string;
  // let any potential view calculate the liens and columns, possibly
  // with tab-size information.
  // Such calculations are not cheap, but only happen in case of error, so fine.
  start: Position;
}

export interface Word {
  parse: Parse_info;
  content: string;
}

export type Name = Word;

export interface Property_value_Literal {
  type: "literal";
  parse: Parse_info;
  content: string;
}

export interface Property_value_Bound {
  type: "bound";
  parse: Parse_info; // for the <  >
  name: Name;
}

export type Property_value =
  | Property_value_Literal
  | Property_value_Bound
  | Text_Escaped;

export interface Class {
  parse: Parse_info; // for the '.'
  name: Name;
}

export interface Property_setting_Pair {
  type: "pair";
  name: Name;
  value: Property_value;
}

export interface Property_setting_Flag_False {
  type: "flag/false";
  parse: Parse_info;
  name: Name;
}

export interface Property_setting_Flag_True {
  type: "flag/true";
  name: Name;
}

export type Property_setting =
  | Property_setting_Pair
  | Property_setting_Flag_True
  | Property_setting_Flag_False;

export interface Properties {
  parse: Parse_info;
  main?: Property_value;
  other: Property_setting[];
}

export interface Node_type_Global {
  type: "global";
  name: Name;
}

export interface Node_type_Child {
  type: "child";
  parse: Parse_info; // for the '\'.
  name: Name;
}

export type Node_type = Node_type_Global | Node_type_Child;

export interface Node_type_path_Absolute {
  type: "absolute";
  global: Node_type_Global;
  children: Node_type_Child[];
}

export interface Node_type_path_Relative {
  type: "relative";
  children: [Node_type_Child, ...Node_type_Child[]];
}

export type Node_type_path = Node_type_path_Absolute | Node_type_path_Relative;

interface Preamble_element_ {
  type: string;
  parse: Parse_info;
  fallback?: Position;
}

export interface Preamble_element_Value extends Preamble_element_ {
  type: "value";
  name: Name;
  value: Property_value;
}

export interface Preamble_element_Default extends Preamble_element_ {
  type: "default";
  type_paths: Node_type_path[];
  classes: Class[];
  properties?: Properties;
}

export interface Preamble_element_Class extends Preamble_element_ {
  type: "class";
  class: Class;
  type_paths: Node_type_path[];
  classes: Class[];
  properties?: Properties;
}

export interface Preamble_element_Content extends Preamble_element_ {
  type: "content";
  name: Name;
  content: Pre_content;
}

export type Preamble_element =
  | Preamble_element_Value
  | Preamble_element_Default
  | Preamble_element_Class
  | Preamble_element_Content;

export type Preamble = Preamble_element[];

export interface Text {
  type: "text";
  parse: Parse_info;
  content: string;
}

export interface Text_Escaped {
  type: "text/escaped";
  parse: Parse_info; // for the delimeters
  text: Text;
}

interface Node_ {
  type: string;
  parse: Parse_info;
}

export interface Node_Content extends Node_ {
  type: "node/content";
  name: Name;
  preamble: Preamble;
}

export interface Node_Preamble extends Node_ {
  type: "node/preamble";
  content: Pre_content;
}

export interface Node_Value extends Node_ {
  type: "node/value";
  name: Name;
}

interface Node_with_properties extends Node_ {
  classes: Class[];
  properties?: Properties;
}

interface Name_Text extends Omit<Name, "content"> {
  content: "text";
}

interface Node_type_Global_Text extends Omit<Node_type_Global, "name"> {
  name: Name_Text;
}

export interface Node_Text extends Node_with_properties {
  type: "node/text";
  node_type?: Node_type_Global_Text;
  content: (Text | Text_Escaped)[];
}

export interface Node_Read extends Node_with_properties {
  type: "node/read";
}

export interface Node_Include extends Node_with_properties {
  type: "node/include";
  preamble: Preamble;
}

export interface Node_Typed extends Node_with_properties {
  type: "node/typed";
  type_path: Node_type_path;
  content: Pre_content;
}

export type Node =
  | Node_Content
  | Node_Preamble
  | Node_Value
  | Node_Text
  | Node_Read
  | Node_Include
  | Node_Typed;

export type Pre_content_element =
  | Text
  | Text_Escaped
  | Node;

export type Line = Pre_content_element[];

export interface Pre_content {
  preamble: Preamble;
  lines: Line[];
}

export const illegal_Name_char = /\r|\n|\t|\s|`|\\|{|}|\[|\]|<|>|=|\?|!|\./;
export const illegal_Property_value_char = /\r|\n|\t|\s|`|{|}|\[|\]|<|>/;

export interface Parse_error_info {
  source: string;
  position: Position;
  got: string;
  expected: (Concept | string)[];
  parsing?: Concept;
  start?: Position;
}

export function parse(source: string): Pre_content {
  let cur_line: number;
  let cur_column: number;
  let cur_i: number;
  let cur_c: string;

  function set_position([l, c, i]: Position) {
    cur_line = l;
    cur_column = c;
    cur_i = i;
    cur_c = source.length == 0 ? EOF : source[cur_i];
  }

  set_position([1, 1, 0]);

  function get_position(): Position {
    return [cur_line, cur_column, cur_i];
  }

  function get_character([_l, _c, i]: Position): string {
    return i < source.length ? source[i] : EOF;
  }

  function err(
    expected: (Concept | string)[],
    options?: {
      got?: string;
      position?: Position;
      parsing?: Concept;
      start?: Position;
    },
  ): never {
    const position = options?.position || get_position();
    const got = options?.got || get_character(position);

    const info: Parse_error_info = {
      source,
      position,
      got,
      expected,
      parsing: options?.parsing,
      start: options?.start,
    };

    throw {
      name: EXCEPTION_NAME,
      type: ERROR_TYPE.Parse,
      info,
    };
  }

  function advance() {
    if (cur_c == "\n") {
      cur_line++;
      cur_column = 0;
    }

    if (cur_i < source.length) {
      cur_i++;
      cur_column++;
    }

    if (cur_i == source.length) {
      cur_c = EOF;
    } else {
      cur_c = source[cur_i];
    }
  }

  function lookahead(): string {
    return cur_i >= source.length ? EOF : source[cur_i + 1];
  }

  function skip() {
    x:
    while (true) {
      switch (cur_c) {
        case ";":
          skip_line_comment();
          continue;
        case "/": {
          if (lookahead() == "*") {
            skip_block_comment();
            continue;
          } else {
            break x;
          }
        }
        case "\t":
        case "\r":
        case "\n":
        case " ":
          advance();
          continue;
        default:
          break x;
      }
    }
  }

  function skip_line_comment() {
    advance();

    while (true) {
      switch (cur_c) {
        case EOF:
          return;
        case "\n":
          advance();
          return;
        default:
          advance();
          continue;
      }
    }
  }

  function skip_block_comment() {
    let count = 1;

    advance();
    advance();

    while (true) {
      switch (cur_c) {
        case EOF:
          return;
        case "/":
          if (lookahead() == "*") {
            count++;
            advance();
            advance();
            continue;
          } else {
            advance();
            continue;
          }
        case "*":
          if (lookahead() == "/") {
            count--;

            advance();
            advance();

            if (count == 0) {
              return;
            } else {
              continue;
            }
          } else {
            advance();
            continue;
          }
        default:
          advance();
          continue;
      }
    }
  }

  function parse_Word(re: RegExp): Word {
    const start = get_position();

    const chars = [cur_c];

    advance();

    while (!re.test(cur_c)) {
      chars.push(cur_c);
      advance();
    }

    return { content: chars.join(""), parse: { start } };
  }

  function parse_Name(): Name {
    return parse_Word(illegal_Name_char);
  }

  function parse_Text(): Text {
    const start = get_position();
    const chars = [cur_c];

    advance();

    while (true) {
      switch (cur_c) {
        case EOF:
        case "\r":
        case "\n":
        case "`":
        case "[":
        case "]":
          return {
            type: "text",
            parse: { start },
            content: chars.join(""),
          };
        case "_":
          if (lookahead() == "[") {
            advance();
            parse_Node();
            continue;
          }
        default:
          chars.push(cur_c);
          advance();
          continue;
      }
    }
  }

  function maybe_parse_Properties(): Properties | undefined {
    return cur_c == "{" ? parse_Properties() : undefined;
  }

  function parse_Node_Preamble(): Omit<Node_Preamble, "parse"> {
    const content = parse_Pre_content();

    return { type: "node/preamble", content };
  }

  function parse_Node_Typed_Text_Implicit(): Omit<Node_Text, "parse"> {
    const classes = maybe_parse_classes_and_skip();
    const properties = maybe_parse_Properties();

    skip();

    const content: (Text | Text_Escaped)[] = [];

    while (true) {
      switch (cur_c) {
        case EOF:
        case "\r":
        case "\n":
        case "\]":
          return {
            type: "node/text",
            classes,
            properties,
            content,
          };
        case "`":
          content.push(parse_Text_Escaped());
          continue;
        default:
          content.push(parse_Text());
          continue;
      }
    }
  }

  function parse_Node_Typed(
    type_path: Node_type_path,
  ): Omit<Node_Typed, "parse"> {
    const classes = maybe_parse_classes_and_skip();
    const properties = maybe_parse_Properties();

    skip();

    const content = parse_Pre_content();

    const node_typed: Omit<Node_Typed, "parse"> = {
      type: "node/typed",
      type_path,
      classes,
      properties,
      content,
    };

    return node_typed;
  }

  function parse_Node(): Node {
    const start = get_position(); // [
    advance();

    skip();

    let node: Omit<Node, "parse">;

    switch (cur_c) {
      case "<":
        node = parse_Node_Preamble();
        break;
      case ".":
      case "{":
        node = parse_Node_Typed_Text_Implicit();
        break;
      case "\\": {
        const path = parse_Node_type_path_Relative();

        skip();

        node = parse_Node_Typed(path);
        break;
      }
      default:
        if (cur_c == EOF || illegal_Name_char.test(cur_c)) {
          err([
            "text",
            "read",
            "include",
            "con",
            "val",
            Concept.Node_type,
            Concept.Classes,
            Concept.Properties,
            Concept.Preamble,
          ], { parsing: Concept.Node });
        } else {
          const type = parse_Node_type_Global();
          skip();

          switch (type.name.content) {
            case "text": {
              const node_text = parse_Node_Typed_Text_Implicit();
              node_text.node_type = <Node_type_Global_Text> type;

              node = node_text;
              break;
            }
            case "read": {
              const classes = maybe_parse_classes_and_skip();
              const properties = maybe_parse_Properties();

              const node_read: Omit<Node_Read, "parse"> = {
                type: "node/read",
                classes,
                properties,
              };

              node = node_read;
              break;
            }
            case "include": {
              const classes = maybe_parse_classes_and_skip();
              const properties = maybe_parse_Properties();

              skip();

              const preamble = maybe_parse_Preamble_and_skip();

              const node_include: Omit<Node_Include, "parse"> = {
                type: "node/include",
                classes,
                properties,
                preamble,
              };

              node = node_include;
              break;
            }
            case "con": {
              const name = parse_Name();
              skip();
              const preamble = maybe_parse_Preamble_and_skip();
              const node_con: Omit<Node_Content, "parse"> = {
                type: "node/content",
                name,
                preamble,
              };
              node = node_con;
              break;
            }
            case "val": {
              const name = parse_Name();

              const node_val: Omit<Node_Value, "parse"> = {
                type: "node/value",
                name,
              };

              node = node_val;
              break;
            }
            default:
              const children = maybe_parse_child_types();

              node = parse_Node_Typed({
                type: "absolute",
                global: type,
                children,
              });
              break;
          }
        }
    }

    if (cur_c == "]") {
      advance();

      // cast to Node to prevent false-positive typescript error:
      // node previously declared as type Omit<Node, "parse">.
      return <Node> { ...node, parse: { start } };
    } else {
      err(["]"], { parsing: Concept.Node, start });
    }
  }

  function parse_Line(): Line {
    const elements: Line = [];

    while (true) {
      switch (cur_c) {
        case EOF:
        case "\r":
        case "\n":
        case "]":
          return elements;
        case "[":
          elements.push(parse_Node());
          continue;
        case "`":
          elements.push(parse_Text_Escaped());
          continue;
        case "_":
          if (lookahead() == "[") {
            advance();
            parse_Node();
            continue;
          }
        default:
          elements.push(parse_Text());
          continue;
      }
    }
  }

  function maybe_parse_Preamble_and_skip(): Preamble {
    const preamble = [];

    while (cur_c == "<") {
      preamble.push(parse_Preamble_element());
      skip();
    }

    return preamble;
  }

  function maybe_parse_lines_and_skip(): Line[] {
    const lines = [];

    while (true) {
      skip();

      switch (cur_c) {
        case EOF:
        case "]":
          return lines;
        default:
          lines.push(parse_Line());
          continue;
      }
    }
  }

  function parse_Pre_content(): Pre_content {
    const preamble = maybe_parse_Preamble_and_skip();
    const lines = maybe_parse_lines_and_skip();

    return { preamble, lines };
  }

  function parse_Class(): Class {
    const start = get_position(); // .
    advance();

    const name = parse_Name();

    return { parse: { start }, name };
  }

  function parse_Node_type_Global(): Node_type_Global {
    const name = parse_Name();

    return { type: "global", name: name };
  }

  function parse_Node_type_Child(): Node_type_Child {
    const start = get_position(); // \
    advance();

    const name = parse_Name();

    return { type: "child", parse: { start }, name };
  }

  function maybe_parse_child_types(): Node_type_Child[] {
    const children = [];

    while (cur_c == "\\") {
      children.push(parse_Node_type_Child());
    }

    return children;
  }

  function parse_Node_type_path_Absolute(): Node_type_path_Absolute {
    const global = parse_Node_type_Global();
    const children = maybe_parse_child_types();

    return { type: "absolute", global, children };
  }

  function parse_Node_type_path_Relative(): Node_type_path_Relative {
    const first = parse_Node_type_Child();
    const rest = maybe_parse_child_types();

    return { type: "relative", children: [first, ...rest] };
  }

  function maybe_parse_Type_paths_and_skip(): Node_type_path[] {
    const paths: Node_type_path[] = [];

    while (true) {
      skip();

      if (illegal_Name_char.test(cur_c)) {
        if (cur_c == "\\") {
          paths.push(parse_Node_type_path_Relative());
        } else {
          break;
        }
      } else {
        paths.push(parse_Node_type_path_Absolute());
      }
    }

    return paths;
  }

  function maybe_parse_classes_and_skip(): Class[] {
    const classes = [];

    while (cur_c == ".") {
      classes.push(parse_Class());
      skip();
    }

    return classes;
  }

  function parse_Text_Escaped(): Text_Escaped {
    const start = get_position();
    advance();

    const start_text = get_position();

    const chars = [];

    while (true) {
      switch (cur_c) {
        case EOF:
          err(["`"], { parsing: Concept.Text_Escaped, start });
        case "`":
          advance();
          return {
            type: "text/escaped",
            parse: { start },
            text: {
              type: "text",
              parse: { start: start_text },
              content: chars.join(""),
            },
          };
        case "\\": {
          switch (lookahead()) {
            case EOF:
              err(["`"], { parsing: Concept.Text_Escaped, start });
            case "`":
            case "\\":
              advance();
              chars.push(cur_c);
              advance();
              continue;
            default:
              chars.push(cur_c);
              advance();
              continue;
          }
        }
        case "\n": {
          chars.push(cur_c);
          advance();

          // start[0] is the opening `
          const start_column = start[1];

          // expect start_column whitespaces here.
          for (let i = 0; i < start_column; i++) {
            // as any to placate ts
            if (cur_c as any != " ") {
              err([Concept.Text_Escaped_line_padding], { got: cur_c });
            } else {
              advance();
            }
          }

          continue;
        }
        default:
          chars.push(cur_c);
          advance();
          continue;
      }
    }
  }

  function parse_Property_value_Bound(): Property_value_Bound {
    const start = get_position();
    advance();
    skip();

    if (illegal_Name_char.test(cur_c)) {
      err(["val"], { parsing: Concept.Property_value_Bound });
    } else {
      const word = parse_Name();

      if (word.content == "val") {
        skip();

        const name = parse_Name();

        skip();

        if (cur_c == ">") {
          advance();

          return {
            type: "bound",
            parse: { start },
            name,
          };
        } else {
          err([">"], { parsing: Concept.Property_value_Bound, start });
        }
      } else {
        err(["val"], {
          parsing: Concept.Property_value_Bound,
          got: word.content,
          position: word.parse.start,
        });
      }
    }
  }

  function parse_Property_value(): Property_value {
    if (illegal_Property_value_char.test(cur_c)) {
      switch (cur_c) {
        case "<":
          return parse_Property_value_Bound();
        case "`":
          return parse_Text_Escaped();
        default:
          err([Concept.Property_value]);
      }
    } else {
      return { type: "literal", ...parse_Word(illegal_Property_value_char) };
    }
  }

  function parse_Properties(): Properties {
    const start = get_position(); // {

    advance();
    skip();

    let main: Property_value | undefined;

    if (cur_c == "=") {
      advance();
      skip();

      main = parse_Property_value();
    }

    const other: Property_setting[] = [];
    const properties: Properties = { parse: { start }, main, other };

    while (true) {
      skip();

      switch (cur_c) {
        case EOF:
          err(["}"], { parsing: Concept.Properties, start });
        case "}":
          advance();
          return properties;
        case "!":
          const start_flag = get_position();
          advance();

          if (illegal_Name_char.test(cur_c)) {
            err([Concept.Property_name]);
          }

          const name = parse_Name();
          const flag: Property_setting_Flag_False = {
            type: "flag/false",
            parse: { start: start_flag },
            name,
          };

          properties.other.push(flag);

          continue;
        default: {
          if (illegal_Name_char.test(cur_c)) {
            err([Concept.Property_name, "!", "}"]);
          } else {
            const name = parse_Name();

            skip();

            if (cur_c == "=") {
              advance();
              skip();

              const value = parse_Property_value();
              const pair: Property_setting_Pair = { type: "pair", name, value };

              properties.other.push(pair);
            } else if (cur_c == "}" || cur_c == "!") {
              const flag: Property_setting_Flag_True = {
                type: "flag/true",
                name,
              };

              properties.other.push(flag);
            } else if (illegal_Name_char.test(cur_c)) {
              err(["=", Concept.Property_setting, "}"]);
            } else {
              const flag: Property_setting_Flag_True = {
                type: "flag/true",
                name,
              };

              properties.other.push(flag);
            }
          }
        }
      }
    }
  }

  function parse_Preamble_element_Class(): Omit<
    Preamble_element_Class,
    "parse" | "fallback"
  > {
    if (cur_c != ".") {
      err([Concept.Class]);
    }

    const cl = parse_Class();

    skip();

    const type_paths = maybe_parse_Type_paths_and_skip();
    const classes = maybe_parse_classes_and_skip();

    let properties: Properties | undefined;

    // 'as any' to override TS's false positive compile error
    if (cur_c as any == "{") {
      properties = parse_Properties();
    } else if (classes.length == 0) {
      err([Concept.Classes, Concept.Properties], {
        parsing: Concept.Preamble_element_Class,
      });
    }

    return { type: "class", class: cl, type_paths, classes, properties };
  }

  function parse_Preamble_element_Content(): Omit<
    Preamble_element_Content,
    "parse" | "fallback"
  > {
    if (illegal_Name_char.test(cur_c)) {
      err([Concept.Name]);
    }

    const name = parse_Name();

    skip();

    if (cur_c != "[") {
      err(["["]);
    }

    advance();

    const content_bound_start = get_position();

    const content = parse_Pre_content();

    // 'as any' to override TS's false positive compile error
    if (cur_c as any != "]") {
      err(["]"], {
        parsing: Concept.Content_Bound,
        start: content_bound_start,
      });
    }

    advance();

    return { type: "content", name, content };
  }

  function parse_Preamble_element_Default(): Omit<
    Preamble_element_Default,
    "parse" | "fallback"
  > {
    const type_paths = maybe_parse_Type_paths_and_skip();
    const classes = maybe_parse_classes_and_skip();

    let properties: Properties | undefined;

    // 'as any' to override TS's false positive compile error
    if (cur_c as any == "{") {
      properties = parse_Properties();
    } else if (classes.length == 0) {
      err([Concept.Classes, Concept.Properties], {
        parsing: Concept.Preamble_element_Default,
      });
    }

    return { type: "default", type_paths, classes, properties };
  }

  function parse_Preamble_element_Value(): Omit<
    Preamble_element_Value,
    "parse" | "fallback"
  > {
    const name = parse_Name();

    skip();

    const value = parse_Property_value();

    return { type: "value", name, value };
  }

  function parse_Preamble_element(): Preamble_element {
    const start = get_position(); // <
    advance();

    skip();

    let fallback: Position | undefined = undefined;

    if (cur_c == "?") {
      fallback = get_position();
      advance();
      skip();
    }

    if (cur_c == EOF || illegal_Name_char.test(cur_c)) {
      err(["cla", "con", "def", "val"]);
    }

    let element;

    const w = parse_Name();

    switch (w.content) {
      case "cla":
        skip();
        element = parse_Preamble_element_Class();
        break;
      case "con":
        skip();
        element = parse_Preamble_element_Content();
        break;
      case "def":
        skip();
        element = parse_Preamble_element_Default();
        break;
      case "val":
        skip();
        element = parse_Preamble_element_Value();
        break;
      default:
        err(["cla", "con", "def", "val"], {
          position: w.parse.start,
          got: w.content,
        });
    }

    skip();

    if (cur_c == ">") {
      advance();
    } else {
      err([">"], { parsing: Concept.Preamble_element, start });
    }

    return { parse: { start }, fallback, ...element };
  }

  function main(): Pre_content {
    skip();

    const content = parse_Pre_content();

    switch (cur_c) {
      case EOF:
        break;
      case "]":
        err([EOF], { parsing: Concept.File });
      default:
        throw new Error(`${prstr(cur_c)} Should be impossible.`);
    }

    return content;
  }

  return main();
}