// chop up a given source string in annotated segments, including space and comments.
// Return a [succes, lines] pair.

export enum Token_type {
  Preamble_open,
  Preamble_close,
  Preamble_fallback,
  Keyword,
  Class_start,
  Name_Node_type,
  Name_Binding,
  Name_Property,
  Child_type_start,
  Properties_open,
  Properties_close,
  Property_setting_assign,
  Property_setting_falsify,
  Property_value_Literal,
  Text,
  Text_Escaped,
  Node_open,
  Node_close,
  Comment,
  Space,
  Ignore,
  No_parse,
}

interface Parse_info {
  start: number;
  end: number;
  content: string;
}

export interface Token extends Parse_info {
  type: Token_type;
  depth?: number;
}

const EOF = "end of file";

export const illegal_Name_char = /\r|\n|\t|\s|`|\\|{|}|\[|\]|<|>|=|\?|!|\./;
export const illegal_Property_value_char = /\r|\n|\t|\s|`|{|}|\[|\]|<|>/;

export function tokenize(source: string): Token[] {
  // Every single character in source will be part of token, except \r\n
  // also do rainbow brackets for node. Keep track of depth, add it to each Node_open
  // and Node_close token.

  let tokens: Token[] = [];

  function add_token(type: Token_type, start: number, end: number) {
    tokens.push({ type, start, end, content: source.slice(start, end + 1) });
  }

  function add(type: Token_type, start: number) {
    const end = cur_i - 1;
    tokens.push({ type, start, end, content: source.slice(start, end + 1) });
  }

  let cur_i = 0;
  let cur_c = source.length == 0 ? EOF : source[cur_i];
  let node_depth = 0;

  function advance() {
    if (cur_i < source.length) {
      cur_i++;
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

  function skip_block_comment() {
    let start = cur_i;

    let count = 1;

    advance();
    advance();

    while (true) {
      switch (cur_c) {
        case EOF:
          add(Token_type.Comment, start);
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
              add(Token_type.Comment, start);
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

  function skip_line_comment() {
    const start = cur_i;
    advance();

    while (true) {
      switch (cur_c) {
        case EOF:
          add(Token_type.Comment, start);
          return;
        case "\n":
          add(Token_type.Comment, start);
          return;
        default:
          advance();
          continue;
      }
    }
  }

  function skip_space() {
    const start = cur_i;

    x:
    while (true) {
      switch (cur_c) {
        case "\t":
        case "\r":
        case "\n":
        case " ":
          advance();
          continue;
        default:
          add(Token_type.Space, start);
          break x;
      }
    }
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
          skip_space();
          continue;
        default:
          break x;
      }
    }
  }

  function add_here(type: Token_type) {
    tokens.push({ type, start: cur_i, end: cur_i, content: cur_c });
  }

  function no_token_word(re: RegExp): Parse_info {
    const start = cur_i;

    const chars = [cur_c];

    advance();

    while (!re.test(cur_c)) {
      chars.push(cur_c);
      advance();
    }

    return { start: start, end: cur_i - 1, content: chars.join("") };
  }

  function no_token_name(): Parse_info {
    return no_token_word(illegal_Name_char);
  }

  function parse_name(type: Token_type) {
    tokens.push({ type, ...no_token_name() });
  }

  function parse_escaped_text() {
    const start = cur_i;
    advance();

    const chars = [];

    while (true) {
      switch (cur_c) {
        case EOF:
          err();
        case "`":
          advance();
          add(Token_type.Text_Escaped, start);
          return;
        case "\\": {
          switch (lookahead()) {
            case EOF:
              err();
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
        default:
          chars.push(cur_c);
          advance();
          continue;
      }
    }
  }

  function parse_property_value() {
    if (illegal_Property_value_char.test(cur_c)) {
      switch (cur_c) {
        case "<": {
          add_here(Token_type.Preamble_open);

          advance();
          skip();

          const w = no_token_name();

          if (w.content != "val") err();

          tokens.push({ type: Token_type.Keyword, ...w });

          skip();

          parse_name(Token_type.Name_Binding);

          skip();

          if (cur_c as any == ">") {
            add_here(Token_type.Preamble_close);
            advance();
            return;
          } else {
            err();
          }
        }
        case "`":
          parse_escaped_text();
          return;
        default:
          err();
      }
    } else {
      tokens.push({
        type: Token_type.Property_value_Literal,
        ...no_token_word(illegal_Property_value_char),
      });
    }
  }

  function parse_class() {
    add_here(Token_type.Class_start);
    advance();
    parse_name(Token_type.Name_Binding);
  }

  function parse_properties() {
    add_here(Token_type.Properties_open);
    advance();

    skip();

    if (cur_c == "=") {
      add_here(Token_type.Property_setting_assign);
      advance();

      skip();

      parse_property_value();

      skip();
    }

    while (true) {
      if (illegal_Name_char.test(cur_c)) {
        switch (cur_c) {
          case "}":
            add_here(Token_type.Properties_close);

            advance();
            skip();

            return;
          case "!":
            add_here(Token_type.Property_setting_falsify);

            advance();
            skip();

            parse_name(Token_type.Name_Property);

            skip();

            continue;
          default:
            err();
        }
      } else {
        parse_name(Token_type.Name_Property);
        skip();

        if (cur_c == "=") {
          add_here(Token_type.Property_setting_assign);
          advance();
          skip();

          parse_property_value();

          skip();
        }
      }
    }
  }

  function add_node_open() {
    node_depth++;

    const token: Token = {
      type: Token_type.Node_open,
      start: cur_i,
      end: cur_i,
      content: cur_c,
      depth: node_depth,
    };

    tokens.push(token);
  }

  function add_node_close() {
    const token: Token = {
      type: Token_type.Node_close,
      start: cur_i,
      end: cur_i,
      content: cur_c,
      depth: node_depth,
    };

    node_depth--;

    tokens.push(token);
  }

  function parse_preamble_element() {
    add_here(Token_type.Preamble_open);

    advance();
    skip();

    if (cur_c == "?") {
      add_here(Token_type.Preamble_fallback);

      advance();
      skip();
    }

    if (cur_c == EOF || illegal_Name_char.test(cur_c)) {
      err();
    }

    const w = no_token_name();

    switch (w.content) {
      case "cla":
      case "def": {
        tokens.push({ type: Token_type.Keyword, ...w });
        skip();

        if (cur_c == ".") {
          parse_class();
        }

        skip();

        while (true) {
          if (illegal_Name_char.test(cur_c)) {
            if (cur_c == "\\") {
              add_here(Token_type.Child_type_start);
              advance();
              skip();
            } else {
              break;
            }
          } else {
            parse_name(Token_type.Name_Node_type);
            skip();
          }
        }

        while (cur_c == ".") {
          parse_class();
          skip();
        }

        if (cur_c == "{") {
          parse_properties();
        }

        break;
      }
      case "con": {
        tokens.push({ type: Token_type.Keyword, ...w });
        skip();

        parse_name(Token_type.Name_Binding);

        skip();

        if (cur_c == "[") {
          add_node_open();
          advance();

          skip();

          parse_content();

          if (cur_c as any == "]") {
            add_node_close();
            advance();
          } else {
            err();
          }
        } else {
          err();
        }

        break;
      }
      case "val": {
        tokens.push({ type: Token_type.Keyword, ...w });
        skip();

        parse_name(Token_type.Name_Binding);

        skip();

        parse_property_value();

        break;
      }
      default:
        err();
    }

    skip();

    if (cur_c == ">") {
      add_here(Token_type.Preamble_close);
      advance();
    } else {
      err();
    }
  }

  function maybe_parse_preamble_and_skip() {
    while (cur_c == "<") {
      parse_preamble_element();
      skip();
    }
  }

  function parse_node() {
    add_node_open();

    advance();
    skip();

    if (illegal_Name_char.test(cur_c)) {
      while (cur_c == "\\") {
        add_here(Token_type.Child_type_start);
        advance();
        parse_name(Token_type.Name_Node_type);
      }
    } else {
      const w = no_token_name();

      switch (w.content) {
        case "con":
        case "val":
          tokens.push({ type: Token_type.Keyword, ...w });

          skip();

          parse_name(Token_type.Name_Binding);
          break;
        default:
          tokens.push({ type: Token_type.Name_Node_type, ...w });

          while (cur_c == "\\") {
            add_here(Token_type.Child_type_start);
            advance();
            parse_name(Token_type.Name_Node_type);
          }

          break;
      }
    }

    skip();

    while (cur_c == ".") {
      parse_class();
      skip();
    }

    if (cur_c == "{") {
      parse_properties();
      skip();
    }

    parse_content();

    if (cur_c == "]") {
      add_node_close();
      advance();
    } else {
      err();
    }
  }

  function parse_ignored_node() {
    const start = cur_i;
    advance();

    // beware: ugly hack!
    const tokens_backup = tokens;
    tokens = [];

    // any tokens are now dumped in the new array assigned to 'tokens';
    // which will be replaced by the original tokens array right after this parse,
    // removing the tokens parsed by parse_tokens from existance.
    parse_node();

    // the last token parsed by parse_node provides the end of the comment.
    const end = tokens[tokens.length - 1].end;

    tokens = tokens_backup;

    add_token(Token_type.Ignore, start, end)
  }

  function parse_text() {
    let start = cur_i;
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
        case "_":
          add(Token_type.Text, start);
          return;
        default:
          chars.push(cur_c);
          advance();
          continue;
      }
    }
  }

  function parse_line() {
    while (true) {
      switch (cur_c) {
        case EOF:
        case "\r":
        case "\n":
        case "]":
          return;
        case "[":
          parse_node();
          continue;
        case "`":
          parse_escaped_text();
          continue;
        case "_":
          if (lookahead() == "[") {
            parse_ignored_node();
            continue;
          }
        default:
          parse_text();
          continue;
      }
    }
  }

  function parse_content() {
    maybe_parse_preamble_and_skip();

    while (true) {
      skip();

      switch (cur_c) {
        case EOF:
        case "]":
          return;
        default:
          parse_line();
          continue;
      }
    }
  }

  function main() {
    skip();

    parse_content();

    if (cur_c !== EOF) {
      err();
    }
  }

  function err(): never {
    const start = tokens.length == 0 ? 0 : tokens[tokens.length - 1].end + 1;

    add_token(Token_type.No_parse, start, source.length - 1);

    throw {
      name: "TokenizeError",
    };
  }

  try {
    main();
    return tokens;
  } catch (e) {
    if (e.name == "TokenizeError") {
      return tokens;
    } else {
      throw e;
    }
  }
}

export function to_lines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [];
  let cur_line: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    const chunks = token.content.split("\n");

    if (chunks.length == 1) {
      cur_line.push(token);
    } else {
      // N.B. if a token starts with \n, means first_new's content will be empty.

      let offset = 0;

      function maybe_add_token(content: string) {
        if (content.length > 0) {
          const start = token.start + offset;

          cur_line.push({
            type: token.type,
            start,
            end: start + content.length - 1,
            content,
          });

          offset += content.length;
        }

        offset += 1; // for the \n
      }

      maybe_add_token(chunks[0]);

      for (let j = 1; j < chunks.length; j++) {
        lines.push(cur_line);
        cur_line = [];

        maybe_add_token(chunks[j]);
      }
    }
  }

  lines.push(cur_line);

  return lines;
}
