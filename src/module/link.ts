import { Render } from "../html.ts";
import { Node_List, Node_type_List } from "../reify.ts";
import { Module } from "./id.ts";

export const type_link: Node_type_List = {
  name: "link",
  type: "list",
  in_paragraph: true,
  main_property_name: "url",
  contains_paragraphs: false,
};

export function create_render(render: Render, id: Module): Render {
  return (node) => {
    const link = <Node_List> node;

    return `<a${id.html_attribute(link)} class="link" href="${link.properties["url"]}">${
      link.content.map(render).join("")
    }</a>`;
  };
}
