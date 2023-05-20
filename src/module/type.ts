import { Node_type, Node } from "../reify.ts"

export class Module {
  nodes : Map<Node_type, Node[]> = new Map();

  get(type : Node_type) : Node[] {
    return this.nodes.get(type) || [];
  }

  process(node : Node) {
    if (!this.nodes.has(node.type)) {
      this.nodes.set(node.type, [])
    }

    this.nodes.get(node.type)!.push(node)
  }
}