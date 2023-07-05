import { fs, path } from "../../deps.ts";
import {
  Content_node,
  create_context,
  Node_List,
  Node_Map,
  Node_type,
  Node_type_Map,
  NODE_TYPE_PARAGRAPH,
  NODE_TYPE_TEXT,
  Reify_error_info,
  reify_pre_content,
} from "../reify.ts";
import { Concept, parse, Parse_error_info } from "../parse.ts";
import { create_file_read, Read_error_info } from "../reader.ts";
import * as Module_Numbering from "../module/numbering.ts";
import * as Module_ID from "../module/id.ts";
import * as Module_List from "../module/list.ts";
import * as Module_Numbered_group from "../module/numbered_group.ts";
import * as Section from "../module/section.ts";
import { Render } from "../html.ts";
import { create_render_paragraph, create_render_text } from "../module/core.ts";
import * as Ref from "../module/cross_reference.ts";
import * as Link from "../module/link.ts";
import * as Image from "../module/image.ts";
import { Module as Module_Type } from "../module/type.ts";
import * as Code from "../module/code.ts";
import * as Misc from "../module/misc.ts";
import * as Terminal from "../module/terminal.ts";
import { prpos, prstr } from "../fmt.ts";
import { ERROR_TYPE, EXCEPTION_NAME } from "../common.ts";

function parse_concept_to_string(concept: Concept): string {
  switch (concept) {
    case Concept.File:
      return "a file";
    case Concept.Name:
      return "a name";
    case Concept.Node:
      return "a node";
    case Concept.Node_type:
      return "a node type";
    case Concept.Classes:
      return "classes";
    case Concept.Class:
      return "a class";
    case Concept.Properties:
      return "properties";
    case Concept.Property_setting:
      return "a property setting";
    case Concept.Property_value:
      return "a property value";
    case Concept.Property_name:
      return "a property name";
    case Concept.Preamble:
      return "preamble";
    case Concept.Preamble_element:
      return "a preamble element";
    case Concept.Preamble_element_Class:
      return "class preamble";
    case Concept.Preamble_element_Default:
      return "default preamble";
    case Concept.Text_Escaped:
      return "escaped text";
    case Concept.Text_Escaped_line_padding:
      return "escaped text line padding"
    case Concept.Content_Bound:
      return "bound to content";
    case Concept.Property_value_Bound:
      return "a bound property value";
  }
}

function parse_error_to_string(path: string, info: Parse_error_info): string {
  let message = "";

  message += `Syntax error at ${path}:${prpos(info.position)}.\n`;

  if (info.parsing) {
    message += `Parsing ${parse_concept_to_string(info.parsing)}${
      info.start ? ` starting at ${prpos(info.start)}` : ""
    }.\n`;
  }

  message += `Expected ${
    info.expected.map((e) =>
      typeof e == "string" ? prstr(e) : parse_concept_to_string(e)
    ).join(", ")
  }; instead got ${prstr(info.got)}.`;

  return message;
}

function read_error_to_string(info: Read_error_info): string {
  return `Error reading ${info.path}: ${info.message}`;
}

function reify_error_to_string(info: Reify_error_info): string {
  let message = info.context.get("current_file_path") + "\n";
  message += info.positions.map(prpos).join(", ") + "\n";

  switch (info.type) {
    case "parse":
      message += parse_error_to_string(info.path, info.parse_error_info);
      break;
    case "read":
      message += read_error_to_string(info.read_error_info);
      break;
    case "reify":
      message += info.message;
      break;
  }

  return message;
}

const this_dir = path.dirname(path.fromFileUrl(import.meta.url));

const project_dir = path.join(
  this_dir,
  "../../doc/",
);

const read = create_file_read(project_dir);
const main_file_path = path.join(project_dir, "main.gobbo");

const context = create_context(
  read,
  main_file_path,
  {
    "section": Section.type_section,
    "appendix": Section.type_appendix,
    "list": Module_List.type_list,
    "length": Module_List.type_length,
    "ref": Ref.type_ref,
    "link": Link.type_link,
    "image": Image.type_image,
    "code": Code.type_code,
    "code-block": Code.type_code_block,
    "highlight": Code.type_highlight,
    "b": Misc.type_b,
    "i": Misc.type_i,
    "u": Misc.type_u,
    "key": Misc.type_key,
    "terminal": Terminal.type_terminal,
    "directory": Terminal.type_directory,
  },
);

const decoder = new TextDecoder("utf-8");

const template = decoder.decode(
  Deno.readFileSync(path.join(this_dir, "template.html")),
);

const encoder = new TextEncoder();

const target_dir = path.join(this_dir, "../../dist");

fs.copy(
  path.join(this_dir, "style"),
  path.join(target_dir, "style"),
  { overwrite: true },
);

function build() {
  const reified_content = reify_pre_content(
    context,
    parse(read(context.get("current_file_path"), "").content),
    true,
  ).flat();

  const module_numbering = new Module_Numbering.Module();
  const module_id = new Module_ID.Module();
  const module_list = new Module_List.Module();
  const module_type = new Module_Type();

  function child_nodes(node: Content_node): Content_node[] {
    switch (node.type.type) {
      case "text":
        return [];
      case "list":
        return (<Node_List> node).content;
      case "map":
        return node.type.mapped_child_type_order.flatMap((type_name) =>
          (<Node_Map> node).content[type_name]
        );
    }
  }

  function to_reading_order(nodes: Content_node[]): Content_node[] {
    return nodes.flatMap(
      (node) => [node, ...to_reading_order(child_nodes(node))],
    );
  }

  const nodes = to_reading_order(reified_content);

  nodes.forEach((node) => {
    module_type.process(node);

    Module_ID.process({ id: module_id }, node);
  });

  module_type.get(Module_List.type_list).forEach((node) =>
    Module_List.process(
      {
        id: module_id,
        numbering: module_numbering,
        list: module_list,
      },
      node,
    )
  );

  Module_Numbered_group.process(
    { numbering: module_numbering },
    reified_content,
    new Set([Section.type_section]),
    { group: "Section" },
  );

  Module_Numbered_group.process(
    { numbering: module_numbering },
    reified_content,
    new Set([Section.type_appendix]),
    { group: "Appendix", type: Module_Numbering.Type.Alpha_Upper },
  );

  Section.ensure_sections_and_appendices_have_id(module_id, module_type);

  Module_Numbered_group.process(
    { numbering: module_numbering },
    reified_content,
    new Set([Image.type_image]),
    { group: "Figure" },
  );

  const renderers = new Map<Node_type, Render>();

  const render: Render = (node) => {
    const renderer = renderers.get(node.type)!;

    return renderer(node);
  };

  (<[Node_type, Render][]> [
    [
      NODE_TYPE_TEXT,
      create_render_text(module_id),
    ],
    [
      NODE_TYPE_PARAGRAPH,
      create_render_paragraph(render, module_id),
    ],
    [
      Module_List.type_list,
      Module_List.create_render_list(render, {
        id: module_id,
        numbering: module_numbering,
      }),
    ],
    [
      Module_List.type_length,
      Module_List.create_render_length({ id: module_id, list: module_list }),
    ],
    [
      Section.type_section,
      Section.create_render_section(
        render,
        { id: module_id, numbering: module_numbering },
        { numbering: true },
      ),
    ],
    [
      Section.type_appendix,
      Section.create_render_appendix(render, {
        id: module_id,
        numbering: module_numbering,
      }),
    ],
    [
      Ref.type_ref,
      Ref.create_render(render, { id: module_id, numbering: module_numbering }),
    ],
    [
      Link.type_link,
      Link.create_render(render, module_id),
    ],
    [
      Image.type_image,
      Image.create_render_image("assets/", render, module_id, module_numbering),
    ],
    [
      Code.type_code,
      Code.render_code,
    ],
    [
      Code.type_code_block,
      Code.create_render_code_block(render),
    ],
    [
      Code.type_highlight,
      Code.create_render_highlight(render),
    ],
    [Misc.type_b, Misc.create_render_b(render)],
    [Misc.type_i, Misc.create_render_i(render)],
    [Misc.type_u, Misc.create_render_u(render)],
    [Misc.type_key, Misc.create_render_key(render)],
    [
      Terminal.type_terminal,
      Terminal.create_render_terminal(render),
    ],
    [
      Terminal.type_directory,
      Terminal.create_render_directory(render),
    ],
  ]).forEach(([type, renderer]) => renderers.set(type, renderer));

  const toc_html = Section.render_table_of_contents(
    render,
    module_id,
    module_type,
    module_numbering,
    {
      numbering: true,
    },
  );

  const content_html = reified_content.map(render).join("");

  const filled_template = template
    .replace("_GOBBO_TOC", toc_html)
    .replace("_GOBBO_CONTENT", content_html);

  Deno.writeFileSync(
    path.join(target_dir, "index.html"),
    encoder.encode(filled_template),
  );

  fs.ensureDir(path.join(project_dir, "assets"))

  fs.copy(
    path.join(project_dir, "assets"),
    path.join(target_dir, "assets"),
    { overwrite: true },
  );
}

try {
  build();
} catch (e) {
  let msg: string;

  if (e.name == EXCEPTION_NAME) {
    const type = <ERROR_TYPE> e.type;

    switch (type) {
      case ERROR_TYPE.Parse:
        msg = parse_error_to_string(main_file_path, <Parse_error_info> e.info);
        break;
      case ERROR_TYPE.Reify:
        msg = reify_error_to_string(<Reify_error_info> e.info);
        break;
      case ERROR_TYPE.Read:
        msg = read_error_to_string(<Read_error_info> e.info);
        break;
    }
  } else {
    msg = e.message;
  }

  Deno.writeFileSync(
    path.join(target_dir, "index.html"),
    encoder.encode(
      `<!DOCTYPE html><html><head></head><body style="background: #222; color: #fff;"><pre>${msg}</pre></body></html>`,
    ),
  );
}
