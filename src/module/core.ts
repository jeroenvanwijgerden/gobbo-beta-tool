import { isWindowsDeviceRoot } from "https://deno.land/std@0.185.0/path/_util.ts";
import { escape, Render } from "../html.ts";
import { Node_List, Node_Text } from "../reify.ts";
import { Module as Module_ID } from "./id.ts";

export function create_render_text(
  id : Module_ID
): Render {
  return (node) => {
    const text = <Node_Text> node;

    return `<span${id.html_attribute(node)}>${escape(text.content)}</span>`;
  };
}

export function create_render_paragraph(
  render: Render,
  id: Module_ID
): Render {
  return (node) => {
    const paragraph = <Node_List> node;

    return `<p${id.html_attribute(node)}>${paragraph.content.map(render).join("")}</p>`;
  };
}
