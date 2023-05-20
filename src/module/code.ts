import {
  Node,
  Node_List,
  Node_Map,
  Node_Text,
  Node_type_List,
  Node_type_Map,
} from "../reify.ts";
import { to_lines as tokens_to_lines, tokenize } from "../tokenize.ts";
import * as HTML from "../html.ts";
import { hljs } from "../../deps.ts";

const hljs_supported_languages = new Set<string>(hljs.listLanguages());

export const type_code: Node_type_List = {
  name: "code",
  type: "list",
  main_property_name: "language",
  in_paragraph: true,
  contains_paragraphs: false,
};

export const type_code_block: Node_type_Map = {
  name: "code-block",
  type: "map",
  main_property_name: "language",
  in_paragraph: false,
  child_types: {
    "title": {
      name: "title",
      type: "list",
      in_paragraph: false,
      contains_paragraphs: false,
    },
    "line": {
      name: "line",
      type: "list",
      in_paragraph: false,
      contains_paragraphs: false,
    },
  },
  mapped_child_types: {
    "title": true,
    "line": true,
  },
  mapped_child_type_order: ["title", "line"],
  main_mapped_child_type: {
    name: "line",
    use_content: "line",
  },
};

export const type_highlight: Node_type_List = {
  name: "highlight",
  type: "list",
  in_paragraph: true,
  contains_paragraphs: false,
  main_property_name: "group",
};

export function render_code(node: Node): string {
  const code = <Node_List> node;

  const language = code.properties["language"] || "";

  const text = (<Node_Text[]> code.content).map((text) => text.content).join(
    "",
  );

  let inner: string;

  switch (language) {
    case "gobbo":
      inner = tokenize(text).map(HTML.to_span).join("");
      break;
    default: {
      if (hljs_supported_languages.has(language)) {
        inner = hljs.highlight(text, { language, ignoreIllegals: true }).value;
        break;
      } else {
        inner = HTML.escape(text);
      }
    }
  }

  return `<code class="inline">${inner}</code>`;
}

type Line = number;
type Column_Start = number | "first";
type Column_End = number | "last";
type Range = [[Line, Column_Start], [Line, Column_End]];
type Line_range = [Line, Column_Start, Column_End];

function parse_range(s: string): Range {
  const range = s.split("-");

  if (range.length == 1) {
    let [l, c] = range[0].split(":");

    const line: Line = parseInt(l);

    if (c) {
      const column = parseInt(c);

      return [[line, column], [line, column]];
    } else {
      return [[line, "first"], [line, "last"]];
    }
  } else {
    const [start, end] = range;
    const [sl, sc] = start.split(":");
    const [el, ec] = end.split(":");

    return [
      [parseInt(sl), sc ? parseInt(sc) : "first"],
      [parseInt(el), ec ? parseInt(ec) : "last"],
    ];
  }
}

function expand_to_line_ranges(r: Range): Line_range[] {
  const [[sl, sc], [el, ec]] = r;

  if (sl < el) {
    const ranges: Line_range[] = [[sl, sc, "last"]];

    for (let l = sl + 1; l < el; l++) {
      ranges.push([l, "first", "last"]);
    }

    ranges.push([el, "first", ec]);

    return ranges;
  } else if (sl == el) {
    return [[sl, sc, ec]];
  } else {
    return [];
  }
}

function parse_line_ranges(s: string): Line_range[] {
  return s.split(",").flatMap((s) => expand_to_line_ranges(parse_range(s)));
}

type Highlight_group = [number, Line_range[]];

function parse_highlight_groups(s: string): Highlight_group[] {
  const groups = s.split("/");

  return groups.map((g, i) => {
    const pair = g.split("\\");

    if (pair.length == 1) {
      return [i + 1, parse_line_ranges(g)];
    } else {
      return [parseInt(pair[0]), parse_line_ranges(pair[1])];
    }
  });
}

const re_highlight_groups =
  /^(\d+\\)?\d+(:\d+)?(-\d+(:\d+)?)?(,\d+(:\d+)?(-\d+(:\d+)?)?)*(\/(\d+\\)?\d+(:\d+)?(-\d+(:\d+)?)?(,\d+(:\d+)?(-\d+(:\d+)?)?)*)*$/;

function can_parse_highlight_groups(s: string) {
  return re_highlight_groups.test(s);
}

function highlight_line(
  line: string,
  start_col: Column_Start,
  end_col: Column_End,
): [string, string, string] | undefined {
  let start_index = undefined;
  let end_index = undefined;

  if (start_col == "first") {
    x:
    for (let j = 0; j < line.length; j++) {
      switch (line[j]) {
        case " ":
        case "\t":
          continue;
        default:
          start_index = j;
          break x;
      }
    }
  } else {
    start_index = start_col - 1;
  }

  if (start_index === undefined) return undefined;

  if (end_col == "last") {
    x:
    for (let j = line.length - 1; j >= 0; j--) {
      switch (line[j]) {
        case " ":
        case "\t":
          continue;
        default:
          end_index = j;
          break x;
      }
    }
  } else {
    end_index = end_col - 1;
  }

  // note: if there is a startIndex, there will be an endIndex.
  const end_i = end_index!;

  if (
    start_index < 0 || start_index >= line.length ||
    end_i < 0 || end_i >= line.length ||
    start_index > end_i
  ) {
    return undefined;
  }

  return [
    line.slice(0, start_index),
    line.slice(start_index, end_i + 1),
    line.slice(end_i + 1),
  ];
}

export function create_render_code_block(render: HTML.Render): HTML.Render {
  return (node: Node): string => {
    const block = <Node_Map> node;
    const code = block.content["line"].map((node) => {
      const line = <Node_List> node;

      return line.content.map((node) => {
        const text = <Node_Text> node;
        return text.content;
      }).join("");
    }).join("\n");

    let lines = code.split("\n");

    const language = block.properties["language"] || "";

    let line_start = parseInt(block.properties["line-start"] || "1");
    if (line_start > lines.length) line_start = lines.length;

    // let line_end = parseInt(block.properties["line-end"] || lines.length.toString());
    // if (line_end > lines.length) line_end = lines.length;

    // if (line_end > line_start) line_end = line_start;

    const tab_size = parseInt(block.properties["tab-size"] || "2");

    const hl_spec = block.properties["highlight"] || "";
    const hl_spans = [];

    const render_line_numbers = block.properties["line-numbers"] == "true";
    const wrap = block.properties["wrap"] == "true";

    let table;

    if (wrap) {
      let colored_lines: string[] | undefined;

      // currently only Gobbo is supported for simultaneous wrapping and syntax coloring
      if (language == "gobbo") {
        const token_lines = tokens_to_lines(tokenize(code));

        colored_lines = token_lines.map((tokens) =>
          tokens.map(HTML.to_span).join("")
        );
      }

      const hl_spans_per_line: string[][] = lines.map(() => []);

      if (can_parse_highlight_groups(hl_spec)) {
        const groups = parse_highlight_groups(hl_spec);
groups[0]
        for (const [group_nr, ranges] of groups) {
          for (const [line_nr, start_col, end_col] of ranges) {
            const normalized_line_nr = line_nr - line_start

            const highlit = highlight_line(
              lines[normalized_line_nr],
              start_col,
              end_col,
            );

            if (highlit === undefined) {
              continue;
            }

            const [line_pre, lit, line_post] = highlit.map(HTML.escape);
            const changedLine =
              `${line_pre}<span class="highlight-group-${group_nr}">${lit}</span>${line_post}`;

            hl_spans_per_line[normalized_line_nr].push(
              `<span class="highlight-overlay">${changedLine}</span>`,
            );
          }
        }
      }

      table =
        `<table class="code-block wrap" style="tab-size: ${tab_size};"><tbody>${
          lines.map((line, line_nr) => {
            let pre = 0;

            x:
            for (const c of line) {
              switch (c) {
                case " ":
                  pre += 1;
                  break;
                case "\t":
                  pre = Math.floor((pre + tab_size) / tab_size) * tab_size;
                  break;
                default:
                  break x;
              }
            }

            const hl_spans = hl_spans_per_line[line_nr];

            let code = line.length == 0 ? "&#10;" : HTML.escape(line);
            let line_to_display = line.length > 0 && colored_lines
              ? colored_lines[line_nr]
              : code;

            if (hl_spans.length > 0) {
              line_to_display =
                `<div class="highlight-container"><span>${line_to_display}</span>${
                  hl_spans.join("")
                }<span class="highlight-copy-overlay">${code}</span></div>`;
            }

            const td_inner = pre > 0
              ? `<div style="text-indent: -${pre}ch; padding-left: ${pre}ch;">${line_to_display}</div>`
              : line_to_display;

            return `<tr>${
              render_line_numbers
                ? `<td class="line-numbers"${
                  line_nr == 0
                    ? ` style="width: ${(lines.length).toString().length}ch;"`
                    : ""
                }>${line_nr + line_start}</td>`
                : ""
            }<td class="code">${td_inner}</td></tr>`;
          }).join("")
        }</tbody></table>`;
    } else {
      if (can_parse_highlight_groups(hl_spec)) {
        const escaped_lines = lines.map(HTML.escape);
        const groups = parse_highlight_groups(hl_spec);

        for (const [group_nr, ranges] of groups) {
          for (const [line_nr, start_col, end_col] of ranges) {
            const normalized_line_nr = line_nr - line_start

            const highlit = highlight_line(
              lines[normalized_line_nr],
              start_col,
              end_col,
            );

            if (highlit === undefined) {
              continue;
            }

            const [line_pre, lit, line_post] = highlit.map(HTML.escape);
            const changed_line =
              `${line_pre}<span class="highlight-group-${group_nr}">${lit}</span>${line_post}`;

            const changed_code = [
              ...escaped_lines.slice(0, normalized_line_nr),
              changed_line,
              ...escaped_lines.slice(normalized_line_nr + 1),
            ].join("&#10;");

            hl_spans.push(
              `<span class="highlight-overlay">${changed_code}</span>`,
            );
          }
        }
      }

      const c = HTML.escape(code);
      let code_to_display: string;

      switch (language) {
        case "gobbo":
          code_to_display = tokenize(code).map(HTML.to_span).join("");
          break;
        default: {
          if (hljs_supported_languages.has(language)) {
            code_to_display =
              hljs.highlight(code, { language, ignoreIllegals: true }).value;
            break;
          } else {
            code_to_display = c;
          }
        }
      }

      const do_highlight = hl_spans.length > 0;

      table =
        `<table class="code-block" style="tab-size: ${tab_size};"><tbody><tr>${
          render_line_numbers
            ? `<td class="line-numbers" style="width: ${
              (lines.length).toString().length
            }ch;">${
              lines.map((_, i) => `<div>${i + line_start}</div>`).join("")
            }</td>`
            : ""
        }<td class="code"><pre${
          do_highlight ? ' class="highlight-container"' : ""
        }><span>${code_to_display}</span>${hl_spans.join("")}${
          do_highlight ? `<span class="highlight-copy-overlay">${c}</span>` : ""
        }</pre></td></tr></tbody></table>`;
    }

    return `<div class="code-block">${
      block.content["title"].map((title) => {
        return `<div class="title">${
          (<Node_List> title).content.map(render).join("")
        }</div>`;
      }).join("")
    }${table}</div>`;
  };
}

export function create_render_highlight(render: HTML.Render): HTML.Render {
  return (node: Node): string => {
    const highlight = <Node_List> node;

    const group_nr = highlight.properties["group"] || "1";

    return `<span style="position: relative;"><span>${
      highlight.content.map(render).join("")
    }</span><span class="highlight-overlay highlight-overlay-prose highlight-group-${group_nr}"></span></span>`;
  };
}

