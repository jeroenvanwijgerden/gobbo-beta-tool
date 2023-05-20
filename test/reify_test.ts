import * as sut from "../src/reify.ts";
import {
  assert,
  assertEquals as eq,
  assertNotEquals as neq,
  test,
} from "../test_deps.ts";
import * as p from "../src/parse.ts";
import { dud_read, create_file_read } from "../src/reader.ts";
import { EOF, ERROR_TYPE, EXCEPTION_NAME } from "../src/common.ts";
import {path} from "../deps.ts"

const type_section: sut.Node_type_Map = {
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
  mapped_child_type_order: ['title', 'body'],
  main_mapped_child_type: {name: "body", use_content: "all"},
};

const type_code: sut.Node_type_List = {
  name: "code",
  type: "list",
  in_paragraph: true,
  main_property_name: "language",
  contains_paragraphs: false,
};

const type_code_block: sut.Node_type_Map = {
  name: "code-block",
  type: "map",
  main_property_name: 'language',
  in_paragraph: false,
  child_types: {
    "title": {
      type: "list",
      name: "title",
      contains_paragraphs: false,
      in_paragraph: false,
    },
    "code": {
      type: "list",
      name: "code",
      contains_paragraphs: false,
      in_paragraph: false,
    },
  },
  mapped_child_types: {
    "title": true,
    "code": true,
  },
  mapped_child_type_order: ['title', 'code'],
  main_mapped_child_type: {name : "code", use_content: "all"}
};

const type_list: sut.Node_type_Map = {
  name: "list",
  type: "map",
  in_paragraph: false,
  child_types: {
    "item": {
      type: "list",
      name: "item",
      contains_paragraphs: true,
      in_paragraph: false,
    },
  },
  mapped_child_types: { "item": true },
  mapped_child_type_order: ['item'],
  main_mapped_child_type: {name: 'item', use_content: "line"}
};

const basic_types = {
  "section": type_section,
  "code": type_code,
  "code-block": type_code_block,
  "list": type_list,
};

const root = path.join(path.dirname(path.fromFileUrl(import.meta.url)), "data/");

const basic_context = sut.create_context(
  create_file_read(path.join(path.dirname(path.fromFileUrl(import.meta.url)), "data/")),
  path.join(root, "reify_test.generated"),
  basic_types,
);

function basic_nodes(source: string): sut.Node[] {
  return sut.reify_pre_content(basic_context, p.parse(source), true).flat();
}

test("top-level content gets implicit paragraphs", () => {
  const nodes = basic_nodes("foo");

  eq(nodes[0].type.name, "paragraph");

  const paragraph = <sut.Node_List> nodes[0];

  eq(paragraph.content[0].type.name, "text");

  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.content, "foo");
});

test("top-level content does not get implicit paragraphs when so specified", () => {
  const nodes = sut.reify_pre_content(basic_context, p.parse("foo"), false).flat();

  eq(nodes[0].type.name, "text");
});

test("node con", () => {
  const nodes = basic_nodes("<con x [[val x]]> [con x <val x 456>]");

  const paragraph = <sut.Node_List> nodes[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.content, "456");
});

test("default properties implicit text", () => {
  const nodes = basic_nodes("<def text {a=b c !d}> foo");

  const paragraph = <sut.Node_List> nodes[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(paragraph.properties["a"], undefined);

  eq(text.content, "foo");
  eq(text.properties["a"], "b");
  eq(text.properties["c"], "true");
  eq(text.properties["d"], "false");
});

test("default properties explicit text", () => {
  const nodes = basic_nodes("<def text {a}> [text foo]");

  const paragraph = <sut.Node_List> nodes[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.properties["a"], "true");
});

test("default properties text from val", () => {
  const nodes = basic_nodes("<def text {a}> <val x y> [val x]");

  const paragraph = <sut.Node_List> nodes[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.content, "y");
  eq(text.properties["a"], "true");
});

test("default props implicit paragraph", () => {
  const nodes = basic_nodes("<def paragraph {a}> foo");

  const paragraph = <sut.Node_List> nodes[0];

  eq(paragraph.properties["a"], "true");
});

test("default props two paths", () => {
  const nodes = basic_nodes("<def paragraph text {a}> foo");

  const paragraph = <sut.Node_List> nodes[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(paragraph.properties["a"], "true");
  eq(text.properties["a"], "true");
});

test("default props no paths", () => {
  const nodes = basic_nodes("<def {a}> foo");

  const paragraph = <sut.Node_List> nodes[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(paragraph.properties["a"], "true");
  eq(text.properties["a"], "true");
});

test("default prop main prop for type without main prop", () => {
  try {
    basic_nodes("<def text {=foo}>");
    eq(1, 0, "Should not reach.");
  } catch (e) {
    eq(1, 1, "Error");
  }
});

test("default prop only implicit main prop", () => {
  const nodes = basic_nodes("<def code {=gobbo}> [code]");

  const paragraph = <sut.Node_List> nodes[0];
  const code = paragraph.content[0];

  eq(code.properties["language"], "gobbo");
});

test("default prop only explicit main prop", () => {
  const nodes = basic_nodes("<def code {language=gobbo}> [code]");

  const paragraph = <sut.Node_List> nodes[0];
  const code = paragraph.content[0];

  eq(code.properties["language"], "gobbo");
});

test("default prop duplicate main prop", () => {
  try {
    basic_nodes("<def code {=gobbo language=gobbo}> [code]");
  } catch (e) {
    eq(1, 1);
  }
});

test("default prop no paths main prop", () => {
  basic_nodes("<def {=foo}>");
  eq(1, 1, "Should reach.");
});

test("types specified to be in paragraph are placed in implicit paragraph", () => {
  const nodes = basic_nodes("[code a]");

  const paragraph = <sut.Node_List> nodes[0];

  eq(paragraph.content[0].type.name, "code");
});

test("types specified to not contain paragraphs do not get implicit paragraphs", () => {
  const nodes = basic_nodes("[code a]");

  const paragraph = <sut.Node_List> nodes[0];
  const code = <sut.Node_List> paragraph.content[0];

  eq(code.content[0].type.name, "text");

  const text = <sut.Node_Text> code.content[0];

  eq(text.content, "a");
});

test("types specified to contain paragraphs do get implicit paragraphs", () => {
  const section = <sut.Node_Map> basic_nodes("[section bar]")[0];
  const body = <sut.Node_List> section.content["body"][0];

  eq(body.content[0].type.name, "paragraph");
});

test("default prop no paths applied only to types that would not give error when specified explicitly.", () => {
  const nodes = basic_nodes("<def {=foo bar}> [code a]");

  const paragraph = <sut.Node_List> nodes[0];
  const code = <sut.Node_List> paragraph.content[0];
  const text = <sut.Node_Text> code.content[0];

  eq(paragraph.properties["bar"], undefined);
  eq(code.properties["language"], "foo");
  eq(code.properties["bar"], "true");
  eq(text.properties["bar"], undefined);
});

test("explicit paragraph", () => {
  const nodes = basic_nodes("<def paragraph {a}> [paragraph foo] bar");

  eq(nodes[0].type, nodes[1].type);

  const p = <sut.Node_List> nodes[0];

  eq(p.properties["a"], "true");
});

test("types specified to be in paragraph can be placed in explicit paragraph", () => {
  const nodes = basic_nodes("[paragraph [code foo]]");
  const paragraph = <sut.Node_List> nodes[0];
  eq(paragraph.content[0].type.name, "code");
});

test("types specified to not be in paragraph cannot be placed in explicit paragraph", () => {
  try {
    basic_nodes("[paragraph [section foo]]");
    eq(1, 0, "Should not reach.");
  } catch (e) {
    eq(1, 1);
  }
});

test("types specified to not be in paragraph are placed alongside implicit paragraphs", () => {
  const nodes = basic_nodes("foo [section] baz");

  eq(nodes.length, 3);

  eq(nodes[1].type.name, "section");
});

test("newline creates a new paragraph", () => {
  const nodes = basic_nodes("foo\nbar");

  eq(nodes.length, 2);
  eq(nodes[0].type.name, "paragraph");
  eq(nodes[1].type.name, "paragraph");
});

test("local props", () => {
  const nodes = basic_nodes("[paragraph {foo}]");

  const paragraph = <sut.Node_List> nodes[0];

  eq(paragraph.properties["foo"], "true");
});

test("local props override default props", () => {
  const nodes = basic_nodes("<def paragraph {foo}> [paragraph {!foo}]");

  const paragraph = <sut.Node_List> nodes[0];

  eq(paragraph.properties["foo"], "false");
});

test("property only shorthand for explicit text node", () => {
  const paragraph = <sut.Node_List> basic_nodes("[{foo}]")[0];

  eq(paragraph.content[0].type.name, "text");

  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.properties["foo"], "true");
});

test("property only shorthand for explicit text node overrides default props", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<def text {foo}> [{!foo}]",
  )[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.properties["foo"], "false");
});

test("consequtive preamble elements", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<val x x> <def paragraph {foo=<val x>}> [paragraph]",
  )[0];

  eq(paragraph.properties["foo"], "x");
});

// test case:
// <cla .foo paragraph {foo}>
// <cla .foo paragraph .foo {bar}>
// [paragraph.foo] / has both foo=true and bar=true

// cla looks like def, but whereas in def after checking you set the property in default_properties,
// in cla you add it to the class. Opportunity for re-use, evaluate cost.

test("class", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<cla .foo paragraph {bar}> [paragraph.foo]",
  )[0];

  eq(paragraph.properties["bar"], "true");
});

test("local properties override class", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<cla .foo paragraph {bar}> [paragraph.foo {!bar}]",
  )[0];

  eq(paragraph.properties["bar"], "false");
});

test("classes are only applied when explicitly specified", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<cla .foo paragraph {bar}> [paragraph]",
  )[0];

  eq(paragraph.properties["bar"], undefined);
});

test("classes are applied in order", () => {
  const [paragraph1, paragraph2] = <sut.Node_List[]> basic_nodes(
    "<cla .foo paragraph {bar}> <cla .baz paragraph {!bar}> [paragraph.foo.baz][paragraph.baz.foo]",
  );

  eq(paragraph1.properties["bar"], "false");
  eq(paragraph2.properties["bar"], "true");
});

test("classes can be specified for text shorthands", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<cla .foo text {bar}> [text.foo][.foo][.foo {baz}]",
  )[0];

  const [text1, text2, text3] = <sut.Node_List[]> paragraph.content;

  eq(text1.properties["bar"], "true");
  eq(text2.properties["bar"], "true");
  eq(text3.properties["bar"], "true");
});

test("a class is scoped to a type", () => {
  const [paragraph] = <sut.Node_List[]> basic_nodes(
    "<cla .foo paragraph {bar}> <cla .foo text {baz}> [paragraph.foo [.foo baz]]",
  );

  const text = <sut.Node_List> paragraph.content[0];

  eq(paragraph.properties["bar"], "true");
  eq(paragraph.properties["baz"], undefined);

  eq(text.properties["bar"], undefined);
  eq(text.properties["baz"], "true");
});

test("a class can be specified for multiple types", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<cla .foo paragraph text {bar}> [paragraph.foo [.foo baz]]",
  )[0];

  const text = <sut.Node_List> paragraph.content[0];

  eq(paragraph.properties["bar"], "true");
  eq(text.properties["bar"], "true");
});

test("class can be specified without types, applying it to all applicable types", () => {
  {
    const paragraph = <sut.Node_List> basic_nodes(
      "<cla .foo {bar}> [paragraph.foo [.foo]]",
    )[0];

    const text = paragraph.content[0];

    eq(paragraph.properties["bar"], "true");
    eq(text.properties["bar"], "true");
  }

  {
    const paragraph = <sut.Node_List> basic_nodes(
      "<cla .foo {=bar}> [code.foo]",
    )[0];

    const code = paragraph.content[0];

    eq(code.properties["language"], "bar");
  }

  try {
    basic_nodes("<cla .foo {=bar}> [paragraph.foo]");
    eq(1, 0);
  } catch (e) {
    eq(1, 1);
  }
});

test("def with only classes", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<cla .foo paragraph {bar}> <def paragraph .foo> [paragraph]",
  )[0];

  eq(paragraph.properties["bar"], "true");
});

test("cla with only classes", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<cla .foo paragraph {bar}> <cla .baz paragraph .foo> [paragraph.baz]",
  )[0];

  eq(paragraph.properties["bar"], "true");
});

test("extending a class", () => {
  const paragraph = <sut.Node_List> basic_nodes(
    "<cla .foo paragraph {bar baz}> <cla .foo paragraph .foo {!baz}> [paragraph.foo]",
  )[0];

  eq(paragraph.properties["bar"], "true");
  eq(paragraph.properties["baz"], "false");
});

test("list with zero items", () => {
  const list = <sut.Node_Map> basic_nodes("[list]")[0];

  eq(list.content["item"].length, 0);
});

test("list with one item", () => {
  const list = <sut.Node_Map> basic_nodes("[list [\\item foo]]")[0];

  eq(list.content["item"].length, 1);

  const item = <sut.Node_List> list.content["item"][0];
  const paragraph = <sut.Node_List> item.content[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.content, "foo");
});

test("list with multiple items", () => {
  const list = <sut.Node_Map> basic_nodes("[list [\\item foo][\\item bar]]")[0];

  eq(list.content["item"].length, 2);
});

test("list: child nodes can be newline separated", () => {
  basic_nodes("[list [\\item foo]\n[\\item bar]]");
  // doesn't throw
});

test("list: each line is new implicit item", () => {
  const list = <sut.Node_Map> basic_nodes("[list foo\nbar\nbaz]")[0];

  eq(list.content['item'].length, 3)

  const [foo, bar, baz] = (<sut.Node_List[]> list.content['item']).map(item => {
    const paragraph = <sut.Node_List> item.content[0];
    const text = <sut.Node_Text> paragraph.content[0];
    return text;
  });

  eq(foo.content, "foo")
  eq(bar.content, "bar")
  eq(baz.content, "baz")
})

test("list: can use macros for implicit items", () => {
  const list = <sut.Node_Map> basic_nodes("[list foo\n[<def text {flag}> bar\nbaz]\nqux]")[0];

  const [foo, bar, baz, qux] = (<sut.Node_List[]> list.content['item']).map(item => {
    const paragraph = <sut.Node_List> item.content[0];
    const text = <sut.Node_Text> paragraph.content[0];
    return text;
  });

  eq(foo.properties['flag'], undefined)
  eq(bar.properties['flag'], "true")
  eq(baz.properties['flag'], "true")
  eq(qux.properties['flag'], undefined)
})

test("list: preamble in macros does not apply to implicit items but does to explicit items in the macro", () => {
  const list = <sut.Node_Map> basic_nodes("[list foo\n[<def \\item {flag}> bar\n[\\item baz]]\nqux]")[0];

  const [foo, bar, baz, qux] = (<sut.Node_List[]> list.content['item'])

  eq(foo.properties['flag'], undefined)
  eq(bar.properties['flag'], undefined)
  eq(baz.properties['flag'], "true")
  eq(qux.properties['flag'], undefined)
})

test("can def for child types", () => {
  const list = <sut.Node_Map> basic_nodes(
    "<def list\\item {foo}> [list [\\item][\\item]]",
  )[0];

  const [item1, item2] = <sut.Node_List[]> list.content["item"];

  eq(list.properties["foo"], undefined);
  eq(item1.properties["foo"], "true");
  eq(item2.properties["foo"], "true");
});

test("can add explicit mapped child nodes via macros", () => {
  const list = <sut.Node_Map> basic_nodes(
    "[list [\\item][<def \\item {foo}> [\\item][\\item]][\\item]]",
  )[0];

  const [item1, item2, item3, item4] = <sut.Node_List[]> list.content["item"];

  eq(item1.properties["foo"], undefined);
  eq(item2.properties["foo"], "true");
  eq(item3.properties["foo"], "true");
  eq(item4.properties["foo"], undefined);
});

test("empty code block", () => {
  const block = <sut.Node_Map> basic_nodes("[code-block]")[0];

  eq(block.content["title"].length, 0);
  eq(block.content["code"].length, 0);
});

test("code block implicit code", () => {
  const block = <sut.Node_Map> basic_nodes("[code-block foo]")[0];

  eq(block.content["title"].length, 0);
  eq(block.content["code"].length, 1);

  const code = <sut.Node_List> block.content["code"][0];

  eq(code.type.name, "code");

  const text = <sut.Node_Text> code.content[0];

  eq(text.content, "foo");
});

test("code block implicit code from macro", () => {
  const block = <sut.Node_Map> basic_nodes(
    "<val x foo> [code-block [val x]]",
  )[0];

  const code = <sut.Node_List> block.content["code"][0];
  const text = <sut.Node_Text> code.content[0];

  eq(text.content, "foo");
});

test("code block explicit code", () => {
  const block = <sut.Node_Map> basic_nodes("[code-block [\\code foo]]")[0];

  const code = <sut.Node_List> block.content["code"][0];
  const text = <sut.Node_Text> code.content[0];

  eq(text.content, "foo");
});

test("code block with title first", () => {
  const block = <sut.Node_Map> basic_nodes("[code-block [\\title foo]bar]")[0];

  eq(block.content["title"].length, 1);
  eq(block.content["code"].length, 1);

  const title = <sut.Node_List> block.content["title"][0];

  eq(title.type.name, "title");

  const text = <sut.Node_Text> title.content[0];

  eq(text.content, "foo");
});

test("code block with title last", () => {
  const block = <sut.Node_Map> basic_nodes("[code-block bar[\\title foo]]")[0];

  eq(block.content["title"].length, 1);
  eq(block.content["code"].length, 1);

  const title = <sut.Node_List> block.content["title"][0];

  eq(title.type.name, "title");

  const text = <sut.Node_Text> title.content[0];

  eq(text.content, "foo");
});

test("code block with title in middle", () => {
  const block = <sut.Node_Map> basic_nodes(
    "[code-block foo[\\title bar]baz]",
  )[0];

  eq(block.content["title"].length, 1);
  eq(block.content["code"].length, 1);

  const code = <sut.Node_List> block.content["code"][0];

  eq(code.content.length, 2);
});

test("global type and child type can share name but are distinct types", () => {
  const [code_block, paragraph] = <[sut.Node_Map, sut.Node_List]> basic_nodes(
    "[code-block [\\code]][code]",
  );

  const child_code = <sut.Node_List> code_block.content["code"][0];
  const global_code = <sut.Node_List> paragraph.content[0];

  eq(global_code.type.name, child_code.type.name);
  neq(global_code.type, child_code.type);
});

test("pre macro", () => {
  const macro_type: sut.Node_type_Macro_Pre = {
    name: "x",
    type: "macro/pre",
    expand: (context: sut.Context, node: sut.Node_Macro): p.Pre_content => {
      return {
        preamble: [],
        lines: [[{
          type: "text",
          parse: { start: [0, 0, 0] },
          content: "foo",
        }]],
      };
    },
  };

  const context = sut.create_context(
    dud_read,
    "",
    {
      ...basic_types,
      "x": macro_type,
    },
  );

  const paragraph = <sut.Node_List> sut.reify_pre_content(
    context,
    p.parse("<def text {bar}>[x]"),
    true,
  ).flat()[0];

  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.properties["bar"], "true");
  eq(text.content, "foo");
});

test("post macro", () => {
  const macro_type: sut.Node_type_Macro_Post = {
    name: "x",
    type: "macro/post",
    expand: (
      context: sut.Context,
      node: sut.Node_Macro,
    ): sut.Line[] => {
      const text_node: sut.Node_Text = {
        type: <sut.Node_type_Text> context.get("global_node_types")["text"],
        properties: {},
        content: "foo",
      };

      sut.apply_default_properties_to_node(context, text_node);

      return [[text_node]];
    },
  };

  const context = sut.create_context(
    dud_read,
    "",
    {
      ...basic_types,
      "x": macro_type,
    },
  );

  const paragraph = <sut.Node_List> sut.reify_pre_content(
    context,
    p.parse("<def text {bar}>[x]"),
    true,
  ).flat()[0];

  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.properties["bar"], "true");
  eq(text.content, "foo");
});

test("reading an absolute path", () => {
  const paragraph = <sut.Node_List> basic_nodes("[read {=`/test.gobbo`}]")[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.content, 'test')
})

test("reading a relative path", () => {
  const paragraph = <sut.Node_List> basic_nodes("[read {=sub/test2.gobbo}]")[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.content, 'test2')
})

test("including an absolute path", () => {
  const paragraph = <sut.Node_List> basic_nodes("[include {=sub/include-absolute.gobbo}]")[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.content, 'test')
})

test("including a relative path", () => {
  const paragraph = <sut.Node_List> basic_nodes("[include {=sub/include-relative.gobbo}]")[0];
  const text = <sut.Node_Text> paragraph.content[0];

  eq(text.content, 'test2')
})