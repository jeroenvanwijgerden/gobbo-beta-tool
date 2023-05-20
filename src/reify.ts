import { im } from "../deps.ts";
import { ERROR_TYPE, EXCEPTION_NAME, Position } from "./common.ts";
import { prstr } from "./fmt.ts";
import * as p from "./parse.ts";
import { Read, Read_error_info, Read_info } from "./reader.ts";

// These types are actually for 'pre-nodes'.
interface Node_type_ {
  name: string;
  type: string;
  parent?: Node_type;
  main_property_name?: string;
}

export interface Node_type_Macro_Pre extends Node_type_ {
  type: "macro/pre";
  expand: (context: Context, node: Node_Macro) => p.Pre_content;
}

export interface Node_type_Macro_Post extends Node_type_ {
  type: "macro/post";
  expand: (context: Context, node: Node_Macro) => Line[];
}

interface Content_node_type_ extends Node_type_ {
  in_paragraph: boolean;
}

export interface Node_type_Text extends Content_node_type_ {
  name: "text";
  type: "text";
  in_paragraph: true;
}

export const NODE_TYPE_TEXT: Node_type_Text = {
  name: "text",
  type: "text",
  in_paragraph: true,
};

interface Node_type_Misc extends Node_type_ {
  type: "misc";
}

export interface Node_type_Nested extends Content_node_type_ {
  // TODO: validate if each key is equal to the .name of its value.
  child_types?: { [key: string]: Node_type };
}

export interface Node_type_List extends Node_type_Nested {
  type: "list";
  contains_paragraphs: boolean;
}

// in case of explicit [paragraph] node in Gobbo text,
// want to check if its contained nodes are all of a type
// with 'in_paragraph: false'.
// Could hardcode this, but perhaps nicer to offer a generalized
// checking mechanism to be specified per type.
export const NODE_TYPE_PARAGRAPH: Node_type_List = {
  name: "paragraph",
  type: "list",
  in_paragraph: false,
  contains_paragraphs: false,
};

export interface Node_type_Map extends Node_type_Nested {
  type: "map";
  child_types: { [key: string]: Node_type };
  // TODO: validate if each key in this object is also a key in child_types.
  // instead of set; literal object is easier to type
  // N.B. the 'in_paragraph' setting of a mapped child type has no effect.
  mapped_child_types: { [key: string]: boolean };
  mapped_child_type_order: [string, ...string[]];
  // TODO: validate if this value is also a key in mapped_child_types.
  // TODO: validate if this type is list-kinded.
  main_mapped_child_type?: {
    name: string;
    use_content: "all" | "line";
  };
}

type Content_node_type = Node_type_Text | Node_type_List | Node_type_Map;

export type Node_type =
  | Node_type_Macro_Pre
  | Node_type_Macro_Post
  | Content_node_type
  | Node_type_Misc;

const NODE_TYPE_INCLUDE: Node_type_Misc = {
  name: "include",
  type: "misc",
  main_property_name: "path",
};

const NODE_TYPE_READ: Node_type_Misc = {
  name: "read",
  type: "misc",
  parent: undefined,
  main_property_name: "path",
};

function absolute_name(type: Node_type): string {
  let name = type.name;

  let parent = type.parent;

  while (parent) {
    name = `${parent.name}\\${name}`;
    parent = parent.parent;
  }

  return name;
}

type Property_value = string;

type Properties = { [key: string]: Property_value };

interface Node_ {
  type: Node_type;
  properties: Properties;
}

export interface Node_Macro extends Node_ {
  type: Node_type_Macro_Pre | Node_type_Macro_Post;
  content: p.Pre_content;
}

interface Content_node_ extends Node_ {
  type: Content_node_type;
}

export interface Node_Text extends Content_node_ {
  type: Node_type_Text;
  content: string;
}

export interface Node_List extends Content_node_ {
  type: Node_type_List;
  content: Content_node[];
}

export interface Node_Map extends Content_node_ {
  type: Node_type_Map;
  content: { [key: string]: Content_node[] };
}

export type Content_node = Node_Text | Node_List | Node_Map;

export type Node = Node_Macro | Content_node;

export type Line = Content_node[];

export interface Reify_error_info_ {
  type: string;
  context : Context;
  positions: Position[];
}

export interface Reify_error_info_Parse extends Reify_error_info_ {
  type: "parse",
  path: string,
  parse_error_info : p.Parse_error_info
}

export interface Reify_error_info_Read extends Reify_error_info_ {
  type: "read",
  read_error_info : Read_error_info
}

export interface Reify_error_info_Reify extends Reify_error_info_ {
  type: "reify",
  message: string
}

export type Reify_error_info = Reify_error_info_Parse | Reify_error_info_Read | Reify_error_info_Reify


function err(context: Context, positions: Position[], message: string): never {
  const info: Reify_error_info = {
    type: "reify",
    context,
    message,
    positions,
  };

  throw {
    name: EXCEPTION_NAME,
    type: ERROR_TYPE.Reify,
    info,
  };
}

function read(context : Context, path : string, position: Position) : Read_info {
  try {
    return context.get("read")(context.get("current_file_path"), path)
  } catch(e) {
    if (e.name == EXCEPTION_NAME) {
      const read_error_info = <Read_error_info> e.info;

      const info : Reify_error_info = {
        type: "read",
        context,
        positions: [position],
        read_error_info
      }

      throw {
        name: EXCEPTION_NAME,
        type: ERROR_TYPE.Reify,
        info
      }
    } else {
      err(context, [position], e.message)
    }
  }
}

function parse(context : Context, read_info : Read_info, position: Position) : p.Pre_content {
  try {
    return p.parse(read_info.content)
  } catch(e) {
    if (e.name == EXCEPTION_NAME) {
      const parse_error_info = <p.Parse_error_info> e.info;

      const info: Reify_error_info = {
        type: "parse",
        context,
        path: read_info.absolute_path,
        positions: [position],
        parse_error_info
      }

      throw {
        name: EXCEPTION_NAME,
        type: ERROR_TYPE.Reify,
        info
      }
    } else {
      err(context, [position], e.message)
    }
  }
}

function resolve_property_value(
  context: Context,
  value: p.Property_value,
): string {
  switch (value.type) {
    case "text/escaped":
      return value.text.content;
    case "literal":
      return value.content;
    case "bound":
      return context.get("bindings").get("value").get(value.name.content) ||
        err(
          context,
          [value.name.parse.start],
          `No property value bound to name ${value.name.content}.`,
        );
  }
}

function resolve_children(
  context: Context,
  parent: Node_type,
  children: p.Node_type_Child[],
): Node_type {
  for (const child of children) {
    if (
      (parent.type == "list" || parent.type == "map") && parent.child_types &&
      parent.child_types[child.name.content]
    ) {
      parent = parent.child_types[child.name.content];
    } else {
      err(
        context,
        [child.parse.start],
        `Unspecified node type '${
          absolute_name(parent)
        }\\${child.name.content}'.`,
      );
    }
  }

  return parent;
}

function resolve_type_path(
  context: Context,
  path: p.Node_type_path,
): Node_type {
  switch (path.type) {
    case "absolute": {
      const global_type =
        context.get("global_node_types")[path.global.name.content];

      if (global_type) {
        return resolve_children(context, global_type, path.children);
      } else {
        err(
          context,
          [path.global.name.parse.start],
          `Unspecified node type '${path.global.name.content}'.`,
        );
      }
    }
    case "relative": {
      let type = context.get("current_node_type");

      if (type) {
        return resolve_children(context, type, path.children);
      } else {
        err(
          context,
          [path.children[0].parse.start],
          `Relative type path not specified within a typed node.`,
        );
      }
    }
  }
}

function type_path_start(path: p.Node_type_path): Position {
  switch (path.type) {
    case "absolute":
      return path.global.name.parse.start;
    case "relative":
      return path.children[0].parse.start;
  }
}

function resolve_properties(context: Context, properties: p.Properties): {
  main_property_value: Property_value | undefined;
  properties: Properties;
} {
  const main_property_value = properties.main
    ? resolve_property_value(context, properties.main)
    : undefined;
  const props: Properties = {};

  const seen_property_names = new Map<string, p.Name>();

  properties.other.forEach((setting) => {
    const previous_name = seen_property_names.get(setting.name.content);

    if (previous_name) {
      err(
        context,
        [
          previous_name.parse.start,
          setting.name.parse.start,
        ],
        `Duplicate property name ${prstr(previous_name.content)}.`,
      );
    }

    switch (setting.type) {
      case "flag/true":
        props[setting.name.content] = "true";
        break;
      case "flag/false":
        props[setting.name.content] = "false";
        break;
      case "pair":
        props[setting.name.content] = resolve_property_value(
          context,
          setting.value,
        );
        break;
    }
  });

  return { main_property_value, properties: props };
}

function apply_classes_and_local_properties(
  context: Context,
  element: {
    type_paths: p.Node_type_path[];
    classes: p.Class[];
    properties?: p.Properties;
  },
  set_property_value: (
    context: Context,
    type: Node_type,
    name: string,
    value: Property_value,
  ) => Context,
): Context {
  let new_context = context;

  if (element.type_paths.length > 0) {
    // I was forced to not use el.type_paths.forEach here because
    // for some reason inside the passed function the typeguard
    // for el.properties gets lost and typescript complains
    // 'el.properties might be undefined'.
    // I replaced other occurrences of forEach for the same reason.
    for (const path of element.type_paths) {
      const type = resolve_type_path(context, path);

      // apply classes
      apply_classes(
        new_context,
        type,
        element.classes,
        (name, value) => {
          new_context = set_property_value(
            new_context,
            type,
            name,
            value,
          );
        },
      );

      if (element.properties) {
        const { main_property_value, properties } = resolve_properties(
          context,
          element.properties,
        );

        if (main_property_value) {
          // rebinding with explicit type to placate typescript
          const value: string = main_property_value;

          if (type.main_property_name) {
            // rebinding with explicit type to placate typescript
            const name: string = type.main_property_name;

            new_context = set_property_value(new_context, type, name, value);
          } else {
            err(
              context,
              // note: if we have a main_value, we must have a parsed_properties.main
              [
                type_path_start(path),
                (<p.Property_value> element.properties.main).parse.start,
              ],
              `Trying to set main property but no main property name specified for type ${
                prstr(absolute_name(type))
              }.`,
            );
          }
        }

        for (const setting of element.properties.other) {
          if (
            element.properties.main &&
            type.main_property_name == setting.name.content
          ) {
            err(
              context,
              [
                type_path_start(path),
                (<p.Property_value> element.properties.main).parse.start,
                setting.name.parse.start,
              ],
              `Duplicate main property ${
                prstr(type.main_property_name)
              } setting for type ${prstr(absolute_name(type))}.`,
            );
          } else {
            new_context = set_property_value(
              new_context,
              type,
              setting.name.content,
              properties[setting.name.content],
            );
          }
        }
      }
    }
  } else {
    type:
    for (const type of context.get("all_node_types")) {
      // first check if all requirements are met:
      // 1) type has all listed classes
      // 2) property specific requirements
      // 2-1) if specified properties has main, type must have main.
      // 2-2) if specified properties has main, main can't also be specified explicitly

      // 1) type has all listed classes

      const prop_maps: im.Map<string, Property_value>[] = [];
      const class_map = context.get("classes").get(type);

      for (const cla of element.classes) {
        const prop_map = class_map?.get(cla.name.content);

        if (prop_map) {
          prop_maps.push(prop_map);
        } else {
          continue type;
        }
      }

      // 2) property specific requirements

      if (element.properties?.main) {
        // 2-1) if specified properties have main, type must have main.
        if (!type.main_property_name) continue type;

        // 2-2) if specified properties has main, main can't also be specified explicitly
        for (const setting of element.properties.other) {
          if (setting.name.content == type.main_property_name) continue type;
        }
      }

      // All checks are done, now we can actually change the context.

      // apply classes

      for (const m of prop_maps) {
        for (const [name, value] of m.entries()) {
          new_context = set_property_value(new_context, type, name, value);
        }
      }

      // apply local properties

      if (element.properties) {
        const { main_property_value, properties } = resolve_properties(
          new_context,
          element.properties,
        );

        if (element.properties.main) {
          // casts are safe because of earlier checks
          new_context = set_property_value(
            new_context,
            type,
            <string> type.main_property_name,
            <Property_value> main_property_value,
          );
        }

        element.properties.other.forEach((setting) => {
          new_context = set_property_value(
            new_context,
            type,
            setting.name.content,
            properties[setting.name.content],
          );
        });
      }
    }
  }

  return new_context;
}

function apply_preamble(context: Context, preamble: p.Preamble): Context {
  return preamble.reduce((context, element) => {
    switch (element.type) {
      case "value": {
        const value = resolve_property_value(context, element.value);

        return context.update(
          "bindings",
          (b) =>
            b.update(
              "value",
              (v: im.Map<string, string>) => v.set(element.name.content, value),
            ),
        );
      }
      case "content": {
        return context.update(
          "bindings",
          (b) =>
            b.update(
              "content",
              (c: im.Map<string, p.Pre_content>) =>
                c.set(element.name.content, element.content),
            ),
        );
      }
      case "class":
        return apply_classes_and_local_properties(
          context,
          element,
          (context, type, name, value) =>
            context.update(
              "classes",
              (m) =>
                m.update(type, (classes) => {
                  const class_name = element.class.name.content;

                  if (!classes?.has(class_name)) {
                    classes = classes?.set(
                      class_name,
                      im.Map<string, Property_value>(),
                    );
                  }

                  // note: by construction classes will not be undefined.
                  return classes?.update(class_name, (properties) => {
                    return properties?.set(name, value);
                  });
                }),
            ),
        );
      case "default":
        return apply_classes_and_local_properties(
          context,
          element,
          (context, type, name, value) =>
            context.update(
              "default_properties",
              (m) =>
                m.update(
                  type,
                  // note: by construction properties will not be undefined.
                  (properties) => properties?.set(name, value),
                ),
            ),
        );
    }
  }, context);
}

function apply_all_properties(
  context: Context,
  type: Node_type,
  properties: Properties,
  classes: p.Class[],
  local_properties: p.Properties | undefined,
) {
  apply_default_properties(context, type, properties);

  apply_classes(
    context,
    type,
    classes,
    (name, value) => properties[name] = value,
  );

  if (local_properties) {
    if (local_properties.main) {
      if (type.main_property_name) {
        properties[type.main_property_name] = resolve_property_value(
          context,
          local_properties.main,
        );
      } else {
        err(
          context,
          [local_properties.main.parse.start],
          `Specified main property but no main property specified for node type ${
            prstr(absolute_name(type))
          }.`,
        );
      }
    }

    for (const setting of local_properties.other) {
      if (
        local_properties.main &&
        type.main_property_name == setting.name.content
      ) {
        err(
          context,
          [
            local_properties.main.parse.start,
            setting.name.parse.start,
          ],
          `Duplicate setting of main property ${
            prstr(type.main_property_name)
          } for node of type ${prstr(absolute_name(type))}.`,
        );
      } else {
        switch (setting.type) {
          case "flag/false":
            properties[setting.name.content] = "false";
            break;
          case "flag/true":
            properties[setting.name.content] = "true";
            break;
          case "pair":
            properties[setting.name.content] = resolve_property_value(
              context,
              setting.value,
            );
            break;
        }
      }
    }
  }
}

function apply_all_properties_to_node(
  context: Context,
  node: Node,
  classes: p.Class[],
  local_properties: p.Properties | undefined,
): void {
  apply_all_properties(
    context,
    node.type,
    node.properties,
    classes,
    local_properties,
  );
}

function populate_map_node_content_use_content_line(
  context: Context,
  content: { [key: string]: Content_node[] },
  type: Node_type_Map,
  element: p.Node_Typed,
) {
  // n.b. use of '!' operator: this function will only be called if
  // type.main_mapped_child_type is not undefined.
  const main_child_type = <Node_type_List> type
    .child_types[type.main_mapped_child_type!.name];

  function flush_line(line: Line) {
    const implicit_node_content: Content_node[] = [];

    line.forEach((node) => {
      if (
        // pretty ugly because currently types are stored in a string:type map.
        // Keeping them as a set might be nicer.
        type.child_types[node.type.name] == node.type &&
        type.mapped_child_types[node.type.name]
      ) {
        content[node.type.name].push(node);
      } else {
        implicit_node_content.push(node);
      }
    });

    if (implicit_node_content.length > 0) {
      const implicit_node: Node_List = {
        type: main_child_type,
        properties: {},
        content: main_child_type.contains_paragraphs
          ? make_paragraphs(context, [implicit_node_content]).flat()
          : implicit_node_content,
      };

      apply_default_properties_to_node(context, implicit_node);

      content[implicit_node.type.name].push(implicit_node);
    }
  }

  element.content.lines.forEach((pre_line) => {
    let line: Line = [];

    pre_line.forEach((element) => {
      const lines_from_element = reify_element(context, element);

      switch (lines_from_element.length) {
        case 0:
          return;
        case 1:
          line = line.concat(lines_from_element[0]);
          return;
        default:
          // extend the current line with the first line from the element
          line = line.concat(lines_from_element[0]);
          flush_line(line);

          // take over all middle lines verbatim.
          // n.b. if lines_from_element.length == 2 then
          // this loop will have 0 iterations
          for (let i = 1; i < lines_from_element.length - 1; i++) {
            flush_line(lines_from_element[i]);
          }

          // Make the last line from element the beginning of new line.
          line = lines_from_element[lines_from_element.length - 1];
          return;
      }
    });

    flush_line(line);
  });
}

function populate_map_node_content_use_content_all(
  context: Context,
  content: { [key: string]: Content_node[] },
  type: Node_type_Map,
  element: p.Node_Typed,
) {
  let lines: Line[] = [];

  function flush_line(line: Line) {
    const line_to_add: Line = [];

    line.forEach((node) => {
      if (
        // pretty ugly because currently types are stored in a string:type map.
        // Keeping them as a set might be nicer. NOT TRUE! because of make_paragraphs.
        // optimization could be to switch on make_paragraphs as well.
        type.child_types[node.type.name] == node.type &&
        type.mapped_child_types[node.type.name]
      ) {
        content[node.type.name].push(node);
      } else {
        line_to_add.push(node);
      }
    });

    if (line_to_add.length > 0) {
      lines.push(line_to_add);
    }
  }

  element.content.lines.forEach((pre_line) => {
    let line: Line = [];

    pre_line.forEach((element) => {
      const lines_from_element = reify_element(context, element);

      switch (lines_from_element.length) {
        case 0:
          return;
        case 1:
          line = line.concat(lines_from_element[0]);
          return;
        default:
          // extend the current line with the first line from the element
          line = line.concat(lines_from_element[0]);
          flush_line(line);

          // take over all middle lines verbatim.
          // n.b. if lines_from_element.length == 2 then
          // this loop will have 0 iterations
          for (let i = 1; i < lines_from_element.length - 1; i++) {
            flush_line(lines_from_element[i]);
          }

          // Make the last line from element the beginning of new line.
          line = lines_from_element[lines_from_element.length - 1];
          return;
      }
    });

    flush_line(line);
  });

  if (lines.length > 0) {
    // this function will only be called if
    // type.main_mapped_child_type is not undefined.
    const main_child_type = <Node_type_List> type
      .child_types[type.main_mapped_child_type!.name];

    if (main_child_type.contains_paragraphs) {
      lines = make_paragraphs(context, lines);
    }

    const implicit_node: Node_List = {
      type: main_child_type,
      properties: {},
      content: lines.flat(),
    };

    apply_default_properties_to_node(context, implicit_node);

    content[implicit_node.type.name].push(implicit_node);
  }
}

function reify_Node_Map(
  context: Context,
  type: Node_type_Map,
  element: p.Node_Typed,
): Node_Map {
  const content: { [key: string]: Content_node[] } = {};
  Object.keys(type.mapped_child_types).forEach((name) => content[name] = []);

  const new_context = apply_preamble(context, element.content.preamble);

  if (type.main_mapped_child_type) {
    switch (type.main_mapped_child_type.use_content) {
      case "all":
        populate_map_node_content_use_content_all(
          new_context,
          content,
          type,
          element,
        );
        break;
      case "line":
        populate_map_node_content_use_content_line(
          new_context,
          content,
          type,
          element,
        );
        break;
    }
  } else {
    element.content.lines.flatMap((line) =>
      line.flatMap((el) => {
        reify_element(new_context, el).flat().forEach((node) => {
          if (
            type.child_types[node.type.name] == node.type &&
            type.mapped_child_types[node.type.name]
          ) {
            content[node.type.name].push(node);
          } else {
            err(
              context,
              [el.parse.start],
              `No main child type specificied for map-kinded type ${
                prstr(absolute_name(type))
              } but there is non-mapped content.`,
            );
          }
        });
      })
    );
  }

  const node: Node_Map = {
    type,
    properties: {},
    content,
  };

  apply_all_properties_to_node(
    context,
    node,
    element.classes,
    element.properties,
  );

  return node;
}

function reify_element(
  context: Context,
  element: p.Pre_content_element,
): Line[] {
  switch (element.type) {
    case "text": {
      const node: Node_Text = {
        type: NODE_TYPE_TEXT,
        properties: {},
        content: element.content,
      };

      apply_default_properties_to_node(context, node);

      return [[node]];
    }
    case "text/escaped": {
      const node: Node_Text = {
        type: NODE_TYPE_TEXT,
        properties: {},
        content: element.text.content,
      };

      apply_default_properties_to_node(context, node);

      return [[node]];
    }
    case "node/text": {
      const node: Node_Text = {
        type: NODE_TYPE_TEXT,
        properties: {},
        content: element.content.map((t) => {
          switch (t.type) {
            case "text":
              return t.content;
            case "text/escaped":
              return t.text.content;
          }
        }).join(""),
      };

      apply_all_properties_to_node(
        context,
        node,
        element.classes,
        element.properties,
      );

      return [[node]];
    }
    case "node/include": {
      const props: Properties = {};

      apply_all_properties(
        context,
        NODE_TYPE_INCLUDE,
        props,
        element.classes,
        element.properties,
      );

      const path = props["path"];

      if (!path) {
        err(
          context,
          [element.parse.start],
          `No path specified.`,
        );
      }

      const read_info  = read(context, path, element.parse.start)

      const pre_content = parse(context, read_info, element.parse.start);

      const new_context = context.set("current_file_path", read_info.absolute_path);

      return reify_pre_content(new_context, pre_content);
    }
    case "node/read": {
      const props: Properties = {};

      apply_all_properties(
        context,
        NODE_TYPE_READ,
        props,
        element.classes,
        element.properties,
      );

      const path = props["path"] || "";

      const content =
        context.get("read")(context.get("current_file_path"), path).content;

      const text_node: Node_Text = {
        type: NODE_TYPE_TEXT,
        properties: {},
        content,
      };

      apply_default_properties_to_node(context, text_node);

      return [[text_node]];
    }
    case "node/preamble": {
      return reify_pre_content(context, element.content);
    }
    case "node/content":
      // TODO:
      // something with waypoints here, for stack trace.
      const con = context.get("bindings").get("content").get(
        element.name.content,
      );

      if (con) {
        return reify_pre_content(
          apply_preamble(context, element.preamble),
          con,
        );
      } else {
        err(
          context,
          [element.name.parse.start],
          `No content bound to name ${element.name.content}.`,
        );
      }
    case "node/value": {
      const val = context.get("bindings").get("value").get(
        element.name.content,
      );

      if (val) {
        const node: Node_Text = {
          type: NODE_TYPE_TEXT,
          properties: {},
          content: val,
        };

        apply_default_properties_to_node(context, node);

        return [[node]];
      } else {
        err(
          context,
          [element.name.parse.start],
          `No value bound to name ${element.name.content}.`,
        );
      }
    }
    case "node/typed": {
      const type = resolve_type_path(context, element.type_path);

      switch (type.type) {
        case "macro/pre": {
          const node: Node_Macro = {
            type,
            properties: {},
            content: element.content,
          };

          apply_all_properties_to_node(
            context,
            node,
            element.classes,
            element.properties,
          );

          return reify_pre_content(context, type.expand(context, node));
        }
        case "macro/post": {
          const node: Node_Macro = {
            type,
            properties: {},
            content: element.content,
          };

          apply_all_properties_to_node(
            context,
            node,
            element.classes,
            element.properties,
          );

          return type.expand(context, node);
        }
        case "misc":
        case "text":
          // Just to placate typescript.
          // Because of parsing, these types will never come with a node/typed.
          return [];
        case "list": {
          const new_context = context.set("current_node_type", type);

          const content = reify_pre_content(
            new_context,
            element.content,
            type.contains_paragraphs,
          ).flat();

          const node: Node_List = {
            type: type,
            properties: {},
            content,
          };

          apply_all_properties_to_node(
            new_context,
            node,
            element.classes,
            element.properties,
          );

          return [[node]];
        }
        case "map":
          const new_context = context.set("current_node_type", type);

          return [[reify_Node_Map(new_context, type, element)]];
      }
    }
  }
}

function apply_classes(
  context: Context,
  type: Node_type,
  classes: p.Class[],
  set_property_value: (
    name: string,
    value: Property_value,
  ) => void,
) {
  // by construction of get_context, there will be a map for this the node's type
  const m = context.get("classes").get(type)!;

  classes.forEach((cla) => {
    const props = m.get(cla.name.content);

    if (props) {
      for (const [name, value] of props.entries()) {
        set_property_value(name, value);
      }
    } else {
      err(
        context,
        [cla.name.parse.start],
        `No class ${prstr(cla.name.content)} for node type ${
          prstr(absolute_name(type))
        }.`,
      );
    }
  });
}

function apply_classes_to_node(
  context: Context,
  node: Node,
  classes: p.Class[],
) {
}

function apply_default_properties(
  context: Context,
  type: Node_type,
  properties: Properties,
) {
  // invariant of context: all classes and default properties are correct.

  context.get("default_properties").get(type)?.forEach(
    (value: Property_value, name: string) => {
      properties[name] = value;
    },
  );
}

export function apply_default_properties_to_node(context: Context, node: Node) {
  apply_default_properties(context, node.type, node.properties);
}

// Always when you want to make paragraphs, you want to
// .flatten the resulting lines. So opportunity for optimization:
// make make_paragraphs return Content_node[] instead and refactor accordingly.
// probably have to make two versions of reify_pre_content, one with and one without
// make paragraphs.
export function make_paragraphs(
  context: Context,
  lines: Line[],
): Line[] {
  return lines.reduce(
    (nodes, line) => {
      let paragraph_content: Content_node[] = [];

      function flush_implicit_paragraph() {
        if (paragraph_content.length > 0) {
          const paragraph_node: Node_List = {
            type: NODE_TYPE_PARAGRAPH,
            properties: {},
            content: paragraph_content,
          };

          apply_default_properties_to_node(context, paragraph_node);

          nodes.push([paragraph_node]);

          paragraph_content = [];
        }
      }

      line.forEach((node) => {
        if (node.type.in_paragraph) {
          paragraph_content.push(node);
        } else {
          flush_implicit_paragraph();

          nodes.push([node]);
        }
      });

      flush_implicit_paragraph();

      return nodes;
    },
    <Line[]> [],
  );
}

export function reify_pre_content(
  context: Context,
  pre_content: p.Pre_content,
  imply_paragraphs: boolean = false,
): Line[] {
  const new_context = apply_preamble(context, pre_content.preamble);

  let lines: Line[] = [];

  pre_content.lines.forEach((pre_line) => {
    let line: Line = [];

    pre_line.forEach((element) => {
      const lines_from_element = reify_element(new_context, element);

      switch (lines_from_element.length) {
        case 0:
          return;
        case 1:
          line = line.concat(lines_from_element[0]);
          return;
        default:
          // extend the current line with the first line from the element
          line = line.concat(lines_from_element[0]);
          lines.push(line);

          // take over all middle lines verbatim.
          // n.b. if lines_from_element.length == 2 then
          // this loop will have 0 iterations
          for (let i = 1; i < lines_from_element.length - 1; i++) {
            lines.push(lines_from_element[i]);
          }

          // Make the last line from element the beginning of new line.
          line = lines_from_element[lines_from_element.length - 1];
          return;
      }
    });

    lines.push(line);
  });

  if (imply_paragraphs) {
    lines = make_paragraphs(new_context, lines);
  }

  return lines;
}

export type Context = im.Record<{
  read: Read;
  current_file_path: string;
  bindings: im.Record<{
    value: im.Map<string, string>;
    content: im.Map<string, p.Pre_content>;
  }>;
  global_node_types: { [key: string]: Node_type };
  all_node_types: Node_type[];
  classes: im.Map<Node_type, im.Map<string, im.Map<string, Property_value>>>;
  default_properties: im.Map<Node_type, im.Map<string, Property_value>>;
  current_node_type: Node_type | undefined;
}>;

function set_parents(type: Node_type) {
  if ((type.type == "list" || type.type == "map") && type.child_types) {
    Object.values(type.child_types).forEach((param) => {
      param.parent = type;
      set_parents(param);
    });
  }
}

function all_node_types(global_node_types: Node_type[]): Node_type[] {
  const types: Node_type[] = [];

  function f(type: Node_type) {
    types.push(type);

    if ((type.type == "list" || type.type == "map") && type.child_types) {
      Object.values(type.child_types).forEach(f);
    }
  }

  global_node_types.forEach(f);

  return types;
}

export function create_context(
  read: Read,
  current_file_path: string,
  global_node_types: { [key: string]: Node_type },
): Context {
  const g_n_t: { [key: string]: Node_type } = {};

  Object.entries(global_node_types).forEach(([name, type]) => {
    type.name = name;
    g_n_t[type.name] = type;
    set_parents(type);
  });

  g_n_t[NODE_TYPE_TEXT.name] = NODE_TYPE_TEXT;
  g_n_t[NODE_TYPE_PARAGRAPH.name] = NODE_TYPE_PARAGRAPH;
  g_n_t[NODE_TYPE_INCLUDE.name] = NODE_TYPE_INCLUDE;
  g_n_t[NODE_TYPE_READ.name] = NODE_TYPE_READ;

  const all_types = all_node_types(Object.values(g_n_t));

  let classes = all_types.reduce(
    (map, type) =>
      map.set(type, im.Map<string, im.Map<string, Property_value>>()),
    im.Map<Node_type, im.Map<string, im.Map<string, Property_value>>>(),
  );

  let default_properties = all_types.reduce(
    (map, type) => map.set(type, im.Map<string, Property_value>()),
    im.Map<Node_type, im.Map<string, Property_value>>(),
  );

  const context: Context = im.Record({
    read,
    current_file_path,
    bindings: im.Record({
      value: im.Map<string, string>(),
      content: im.Map<string, p.Pre_content>(),
    })(),
    global_node_types: g_n_t,
    all_node_types: all_types,
    classes,
    default_properties,
    current_node_type: undefined,
  })();

  return context;
}
