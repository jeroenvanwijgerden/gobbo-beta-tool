import {
  Module as Module_Numbering,
  numbers_to_string,
  Type as Numbering_type,
} from "./numbering.ts";
import { Module as Module_ID } from "./id.ts";
import { Node, Node_List, Node_Map, Node_type_List, Node_type_Map } from "../reify.ts";
import { Render } from "../html.ts";

export const type_list: Node_type_Map = {
  name: "list",
  type: "map",
  in_paragraph: false,
  child_types: {
    "item": {
      type: "list",
      name: "item",
      contains_paragraphs: true,
      in_paragraph: false,
    },
  },
  mapped_child_types: { "item": true },
  mapped_child_type_order: ["item"],
  main_mapped_child_type: {
    name: "item",
    use_content: "line",
  },
};

export const type_length: Node_type_List = {
  name: "length",
  type: "list",
  in_paragraph: true,
  contains_paragraphs: false,
  main_property_name: 'target'
}

export class Module {
  total_items: Map<Node, number> = new Map();
}

export function process(
  modules: {
    id: Module_ID;
    numbering: Module_Numbering;
    list: Module;
  },
  node: Node,
) {
  const list_node = <Node_Map> node;
  const item_nodes = <Node_List[]> list_node.content["item"];

  modules.list.total_items.set(list_node, item_nodes.length);

  let start = 1;

  // Check if list extends another list

  const parent_id = list_node.properties["extend"];

  if (parent_id && parent_id != "") {
    const parent = modules.id.nodes.get(parent_id);

    if (!parent) {
      throw `No parent with id ${parent_id}.`;
    }

    if (parent.type != type_list) {
      throw `Parent ${parent_id} is not the right type.`;
    }

    const parent_total_items = modules.list.total_items.get(parent);

    if (!parent_total_items) {
      throw `out of order: parent ${parent_id} hasn't been processed before this node.`;
    }

    start = parent_total_items + 1;

    modules.list.total_items.set(
      parent,
      parent_total_items + item_nodes.length,
    );
  }

  // Assign item numbers

  let numbering_type: Numbering_type;

  switch (node.properties["style"]) {
    case "a":
      numbering_type = Numbering_type.Alpha_Lower;
      break;
    case "A":
      numbering_type = Numbering_type.Alpha_Upper;
      break;
    case "i":
      numbering_type = Numbering_type.Roman_Lower;
      break;
    case "I":
      numbering_type = Numbering_type.Roman_Upper;
      break;
    case "1":
    default:
      numbering_type = Numbering_type.Decimal;
      break;
  }

  item_nodes.forEach((item, index) => {
    modules.numbering.numberings.set(item, {
      numbers: [[start + index, numbering_type]],
    });
  });
}

export function create_render_list(
  render: Render,
  modules: {
    id: Module_ID,
    numbering: Module_Numbering;
  },
): Render {
  return (node) => {
    const list = <Node_Map> node;

    let html = `<table${modules.id.html_attribute(list)} class="list"><tbody>`;

    list.content["item"].forEach((node) => {
      const item = <Node_List> node;

      const numbers = numbers_to_string(
        modules.numbering.numberings.get(item)?.numbers!,
      );

      html += `<tr${modules.id.html_attribute(item)}><td>${numbers}</td><td>${
        item.content.map(render).join("")
      }</td></tr>`;
    });

    return html + `</tbody></table>`;
  };
}

export function create_render_length(
  modules: {id: Module_ID, list: Module}
) : Render {
  return (node) => {
    const target_id = node.properties['target'];

    if (!target_id) return "[[ no target specified ]]"

    const target = modules.id.nodes.get(target_id);

    if (!target) return `[[ no target with id ${target_id} ]]`

    const total_items = modules.list.total_items.get(target);

    if (!total_items) return `[[ no items found for ${target_id} ]]`

    return `<span${modules.id.html_attribute(node)}>${total_items}</span>`
  }
}