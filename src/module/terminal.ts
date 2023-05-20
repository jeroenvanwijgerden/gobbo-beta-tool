import { escape, Render } from "../html.ts";
import {
  Node,
  Node_List,
  Node_Map,
  Node_type_List,
  Node_type_Map,
} from "../reify.ts";

export const type_terminal: Node_type_Map = {
  name: "terminal",
  type: "map",
  main_property_name: "directory",
  in_paragraph: false,
  child_types: {
    "input": {
      name: "input",
      type: "list",
      in_paragraph: false,
      contains_paragraphs: false,
    },
    "output": {
      name: "output",
      type: "map",
      in_paragraph: false,
      child_types: {
        "line": {
          name: "line",
          type: "list",
          in_paragraph: false,
          contains_paragraphs: false,
        },
      },
      mapped_child_types: { "line": true },
      mapped_child_type_order: ["line"],
      main_mapped_child_type: {
        name: "line",
        use_content: "line",
      },
    },
  },
  mapped_child_types: {
    "input": true,
    "output": true,
  },
  mapped_child_type_order: ["input", "output"],
  main_mapped_child_type: {
    name: "input",
    use_content: "all",
  },
};

export const type_directory: Node_type_List = {
  name: "directory",
  type: "list",
  main_property_name: "path",
  in_paragraph: true,
  contains_paragraphs: false,
};

export function create_render_terminal(render: Render): Render {
  return (node) => {
    const terminal = <Node_Map> node;

    const user = terminal.properties["user"] || "user";
    const host = terminal.properties["host"] || "host";
    const directory = terminal.properties["directory"] || "~";

    const has_input = terminal.content["input"].length > 0;

    const input = has_input
      ? terminal.content["input"].flatMap((node) => {
        const input = <Node_List> node;

        return input.content.map(render);
      }).join("")
      : "";

    const output = terminal.content["output"].flatMap((node) => {
      const output = <Node_Map> node;

      return output.content["line"].map((node) => {
        const line = <Node_List> node;

        return `<div class="line">${line.content.map(render)}</div>`;
      });
    }).join("");

    return `<div class="terminal">${
      has_input
        ? `<span class="preamble"><span class="user"><span class="name">${
          escape(user)
        }</span>@<span class="host">${
          escape(host)
        }</span></span>:<span class="directory">${
          escape(directory)
        }</span>$</span><span class="input">${input}</span>`
        : ""
    }<div class="output">${output}</div></div>`;
  };
}

export function create_render_directory(render: Render): Render {
  return (node) => {
    const directory = <Node_List> node;

    return `<span class="directory-inline">${directory.content.map(render).join("")}</span>`;
  };
}
