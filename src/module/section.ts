import { Render } from "../html.ts";
import { Node_List, Node_Map, Node_type_Map } from "../reify.ts";
import * as Numbering from "./numbering.ts";
import { Module as Module_ID } from "./id.ts";
import { Module as Module_Type } from "./type.ts";

export const type_section: Node_type_Map = {
  name: "section",
  type: "map",
  in_paragraph: false,
  child_types: {
    "title": {
      type: "list",
      name: "title",
      contains_paragraphs: false,
      in_paragraph: false,
    },
    "body": {
      type: "list",
      name: "body",
      contains_paragraphs: true,
      in_paragraph: false,
    },
  },
  mapped_child_types: {
    "title": true,
    "body": true,
  },
  mapped_child_type_order: ["title", "body"],
  main_mapped_child_type: { name: "body", use_content: "all" },
};

export const type_appendix: Node_type_Map = {
  name: "appendix",
  type: "map",
  in_paragraph: false,
  child_types: {
    "title": {
      type: "list",
      name: "title",
      contains_paragraphs: false,
      in_paragraph: false,
    },
    "body": {
      type: "list",
      name: "body",
      contains_paragraphs: true,
      in_paragraph: false,
    },
  },
  mapped_child_types: {
    "title": true,
    "body": true,
  },
  mapped_child_type_order: ["title", "body"],
  main_mapped_child_type: { name: "body", use_content: "all" },
};

export function create_render_section(
  render: Render,
  modules: { id: Module_ID; numbering: Numbering.Module },
  options?: {
    numbering?: boolean;
  },
): Render {
  return (node) => {
    const section = <Node_Map> node;
    // '!' so make sure sections are numbered!
    const numbering = modules.numbering.numberings.get(node)!;

    // from 2 to 6
    const h_level = Math.min(1 + numbering.numbers.length, 6);

    const html_numbering: string = options?.numbering
      ? `<span class="numbering">${
        Numbering.numbers_to_string(numbering.numbers)
      }</span>`
      : "";

    let html = `<section${modules.id.html_attribute(section)}>`;

    // header

    section.content["title"].forEach((title) => {
      html += `<h${h_level}${
        modules.id.html_attribute(title)
      }>${html_numbering}${
        (<Node_List> title).content.map(render).join("")
      }</h${h_level}>`;
    });

    // body

    section.content["body"].forEach((body) => {
      (<Node_List> body).content.forEach((node) => {
        html += render(node);
      });
    });

    return html + "</section>";
  };
}

export function create_render_appendix(
  render: Render,
  modules: { id: Module_ID; numbering: Numbering.Module },
): Render {
  return (node) => {
    const section = <Node_Map> node;
    // '!' so make sure sections are numbered!
    const numbering = modules.numbering.numberings.get(node)!;

    const html_numbering: string = `<span class="numbering">${numbering
      .group!} ${Numbering.numbers_to_string(numbering.numbers)}</span>`;

    let html = `<section${modules.id.html_attribute(section)}>`;

    // header

    section.content["title"].forEach((title) => {
      html += `<h2${modules.id.html_attribute(title)}>${html_numbering}${
        (<Node_List> title).content.map(render).join("")
      }</h2>`;
    });

    // body

    section.content["body"].forEach((body) => {
      (<Node_List> body).content.forEach((node) => {
        html += render(node);
      });
    });

    return html + "</section>";
  };
}

export function ensure_sections_and_appendices_have_id(
  id: Module_ID,
  type: Module_Type,
) {
  type.get(type_section).concat(type.get(type_appendix)).forEach((node) => {
    if (!id.ids.has(node)) id.add(node, crypto.randomUUID());
  });
}

export function render_table_of_contents(
  render: Render,
  id: Module_ID,
  type: Module_Type,
  numbering: Numbering.Module,
  options?: {
    numbering?: boolean;
  },
): string {
  return `<div class="toc">${
    type.get(type_section).concat(type.get(type_appendix)).map((node) => {
      const section = <Node_Map> node;

      const num = numbering.numberings.get(section);

      const numbering_html = num && (!options || options.numbering)
        ? `<span class="numbering">${
          Numbering.numbers_to_string(num.numbers)
        }</span>`
        : "";

      return `<div><a href="${id.href(section)}">${numbering_html}${
        section.content["title"].map((node) => {
          const title = <Node_List> node;
          return title.content.map(render).join("");
        }).join("")
      }</a></div>`;
    }).join("")
  }</div>`;
}
