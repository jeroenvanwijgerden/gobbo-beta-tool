import { Render } from "../html.ts";
import { Node_List, Node_type_List } from "../reify.ts";
import * as Numbering from "./numbering.ts";
import * as ID from "./id.ts";

export const type_ref: Node_type_List = {
  name: "ref",
  type: "list",
  in_paragraph: true,
  contains_paragraphs: false,
  main_property_name: "target",
  child_types: {
    "number": {
      name: "number",
      type: "list",
      in_paragraph: true,
      contains_paragraphs: false,
    },
  },
};

export function create_render(
  render: Render,
  modules: {
    numbering: Numbering.Module;
    id: ID.Module;
  },
): Render {
  return (node) => {
    const ref = <Node_List> node;

    const target_id = ref.properties["target"];

    if (!target_id) return `[[ no target specified ]]`;

    const reffed = modules.id.nodes.get(target_id);

    if (!reffed) return `[[ no target with id ${target_id} ]]`;

    const numbering = modules.numbering.numberings.get(reffed);

    return `<a class="cross-reference" href="${modules.id.href(reffed)}">${
      ref.content.map((node) => {
        if (node.type == ref.type.child_types!["number"]) {
          return numbering
            ? Numbering.numbers_to_string(numbering.numbers)
            : "[[ target is not numbered ]]";
        } else return render(node);
      }).join("")
    }</a>`;
  };
}
