import { Render } from "../html.ts";
import { Node_List, Node_type_List, Node_type_Map, apply_default_properties_to_node } from "../reify.ts";
import * as Numbering from "./numbering.ts";
import * as ID from "./id.ts";

export const type_image : Node_type_List = {
  name: "image",
  type: "list",
  in_paragraph: false,
  contains_paragraphs: false,
  main_property_name: "path"
}

export function create_render_image(
  src_prefix: string,
  render : Render,
  id : ID.Module,
  numbering: Numbering.Module
) : Render {
  return (node) => {
    const image = <Node_List> node;

    const path = image.properties['path'] || '';

    const scale = image.properties['scale'];

    const img = `<img src="${src_prefix}${path}"${scale ? `style="width: ${Math.round(parseFloat(scale)*100)}%; height: auto;"` : ""}>`

    const num = numbering.numberings.get(image);

    const caption_elements : string[] = [];


    if (num) {
      let numbering_html = `<class class="numbering">`

      if (num.group) {
        numbering_html += `${num.group} `
      }

      numbering_html += `${Numbering.numbers_to_string(num.numbers)}</class>`
      caption_elements.push(numbering_html)
    }

    if (image.content.length > 0) {
      caption_elements.push(image.content.map(render).join(""))
    }

    const caption = caption_elements.length > 0
      ? `<div class="caption">${caption_elements.join("")}</div>`
      : ""

    return `<div${id.html_attribute(image)} class="image">${img}${caption}</div>`
  }
}