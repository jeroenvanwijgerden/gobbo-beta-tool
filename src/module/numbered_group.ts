import {
  Module as Module_Numbering,
  Numbering,
  Type as Numbering_type,
} from "./numbering.ts";
import { Content_node, Node_List, Node_Map, Node_type } from "../reify.ts";
import { Tree, trees } from "./util.ts";

export function process(
  modules: { numbering: Module_Numbering },
  content: Content_node[],
  types: Set<Node_type>,
  options?: {
    group?: string;
    type?: Numbering_type;
  },
) {
  const type = options?.type || Numbering_type.Decimal;

  const path: number[] = [];

  function f(trees: Tree[]) {
    for (let i = 0; i < trees.length; i++) {
      const [root, children] = trees[i];

      path.push(i + 1);

      const numbering: Numbering = {
        numbers: path.map((n) => [n, type]),
      };

      if (options?.group) {
        numbering.group = options.group;
      }

      modules.numbering.numberings.set(root, numbering);

      f(children);

      path.pop();
    }
  }

  f(content.flatMap((node) => trees(node, types)));
}
