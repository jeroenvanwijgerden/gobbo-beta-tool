import {Node} from "../reify.ts"
import { node_id } from "../html.ts";

export class Module {
  nodes : Map<string, Node> = new Map()
  ids : Map<Node, string> = new Map()

  add(node : Node, id : string) {
    this.nodes.set(id, node);
    this.ids.set(node, id)
  }

  html_attribute(node : Node) : string {
    const id = this.ids.get(node)

    if (id) {
      return ` id="${node_id(id)}"`
    } else {
      return '';
    }
  }

  href(node : Node) : string {
    const id = this.ids.get(node);

    if (id) {
      return `#${node_id(id)}`
    } else {
      return "";
    }
    
  }
}

export function process(modules: {id : Module}, node : Node) {
  const id = node.properties['id']
  
  if (id && id != '') {
    modules.id.add(node, id)
  }
}