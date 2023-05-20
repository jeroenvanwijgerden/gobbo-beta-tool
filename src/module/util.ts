import { Node_type, Content_node,Node_List, Node_Map } from "../reify.ts";

export type Tree = [Content_node, Tree[]];

export function child_nodes(node: Content_node): Content_node[] {
  switch (node.type.type) {
    case "text":
      return [];
    case "list":
      return (<Node_List> node).content;
    case "map":
      return node.type.mapped_child_type_order.flatMap((type_name) =>
        (<Node_Map> node).content[type_name]
      );
  }
}

export function trees(node: Content_node, types: Set<Node_type>): Tree[] {
  const child_trees = child_nodes(node).flatMap((child_node) =>
    trees(child_node, types)
  );

  return types.has(node.type) ? [[node, child_trees]] : child_trees;
}