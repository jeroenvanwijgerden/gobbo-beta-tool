import { Render } from "../html.ts";
import { Node_List, Node_type_List } from "../reify.ts";

function create_simple_inline(
  name: string,
  tag: string,
  options? : {
    classes?: string[]
  }
): [Node_type_List, (render: Render) => Render] {
  const type: Node_type_List = {
    name,
    type: "list",
    in_paragraph: true,
    contains_paragraphs: false,
  };

  const create_render = (render: Render): Render => {
    return (node) => {
      const n = <Node_List> node;

      const classes = options?.classes
        ? ` class="${options.classes.join(" ")}"`
        : ``

      return `<${tag}${classes}>${n.content.map(render).join("")}</${tag}>`;
    };
  };

  return [type, create_render];
}

export const [type_key, create_render_key] = create_simple_inline("key", "kbd", {classes: ["key"]});
export const [type_b, create_render_b] = create_simple_inline("b", "b");
export const [type_i, create_render_i] = create_simple_inline("i", "i");
export const [type_u, create_render_u] = create_simple_inline("u", "u");