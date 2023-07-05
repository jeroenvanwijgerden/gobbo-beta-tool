import * as sut from "../src/parse.ts"
import { path } from "../deps.ts"
import {test, assert, assertEquals as eq } from "../test_deps.ts"
import { EXCEPTION_NAME, ERROR_TYPE, EOF } from "../src/common.ts"
import { isValueObject } from "../../../../.cache/deno/npm/registry.npmjs.org/immutable/4.3.0/dist/immutable.d.ts";

function read(p : string) : string {
  
  const full = path.resolve(path.fromFileUrl(import.meta.url), p);

  const decoder = new TextDecoder("utf-8")
  return decoder.decode(Deno.readFileSync(full))
}

test("file is empty", () => {
  const prec = sut.parse("")

  eq(prec.preamble.length, 0)
  eq(prec.lines.length, 0)
})

test("file contains only spaces", () => {
  const prec = sut.parse(" \t\r\n  ")

  eq(prec.preamble.length, 0)
  eq(prec.lines.length, 0)
})

test("file has dangling ]", () => {
  try {
    sut.parse("   ]  ")

    eq(1, 0, "Should be unreachable.")
  } catch (e) {
    eq(e.name, EXCEPTION_NAME)
    eq(e.type, ERROR_TYPE.Parse)
    eq(e.info.position[0], 1)
    eq(e.info.position[1], 4)
    eq(e.info.got, ']')
    eq(e.info.expected.length, 1)
    eq(e.info.expected[0], EOF)
    eq(e.info.parsing, sut.Concept.File)
    eq(e.info.start, undefined)
  }
})

test("val literal", () => {
  const prec = sut.parse("<val x y>")

  eq(prec.preamble.length, 1)
  eq(prec.lines.length, 0)
  eq(prec.preamble[0].type, 'value')
  
  const pre = <sut.Preamble_element_Value> prec.preamble[0];

  eq(pre.fallback, undefined)
  eq(pre.name.content, "x")
  eq(pre.value.type, "literal")

  const val = <sut.Property_value_Literal> pre.value

  eq(val.content, "y")
})

test("val literal fallback", () => {
  const prec = sut.parse("<?val x y>")

  assert(prec.preamble[0].fallback)

  const fb = prec.preamble[0].fallback

  eq(fb[0], 1)
  eq(fb[1], 2)
})

test("val bound", () => {
  const prec = sut.parse("<val x <val y>>")

  const pre = <sut.Preamble_element_Value>prec.preamble[0]

  eq(pre.value.type, "bound")

  const val = <sut.Property_value_Bound> pre.value;

  eq(val.name.content, "y")
})

test("val escaped", () => {
  const prec = sut.parse("<val x `<val y>`>")

  const pre = <sut.Preamble_element_Value>prec.preamble[0]

  eq(pre.value.type, "text/escaped")

  const val = <sut.Text_Escaped> pre.value

  eq(val.text.content, "<val y>")
})

test("preamble element parse info", () => {
  const prec = sut.parse("  \n <  \r\n  ? \t val  x    y >")

  const pre = prec.preamble[0]

  eq(pre.parse.start[0], 2)
  eq(pre.parse.start[1], 2)

  assert(pre.fallback)
  const fb = pre.fallback

  eq(fb[0], 3)
  eq(fb[1], 3)
})

test ("node val", () => {
  const prec = sut.parse("[val x]")
  const node = prec.lines[0][0]

  eq(prec.lines[0][0].type, "node/value")

  const n = <sut.Node_Value> node;

  eq(n.name.content, "x")
})

test ("node con", () => {
  const prec = sut.parse("[con x]")
  const node = prec.lines[0][0]

  eq(node.type, "node/content")

  const n = <sut.Node_Content> node;

  eq(n.name.content, "x")
})

test ("node con preamble", () => {
  const prec = sut.parse("[con x <val y z>]")
  const node = <sut.Node_Content> prec.lines[0][0]

  eq(node.preamble.length, 1)
})

test ("preamble def classes only", () => {
  const prec = sut.parse("<def x .y>")

  const el = <sut.Preamble_element_Default> prec.preamble[0];

  eq(el.type_paths.length, 1)

  const path = <sut.Node_type_path_Absolute> el.type_paths[0];

  eq(path.global.name.content, "x");

  eq(el.classes.length, 1)

  const cla = el.classes[0]

  eq(cla.name.content, "y")

  eq(el.properties, undefined)
})

test ("preamble def properties only", () => {
  const prec = sut.parse("<def x {=y}>")

  const el = <sut.Preamble_element_Default> prec.preamble[0];

  eq(el.classes.length, 0)

  const props = <sut.Properties> el.properties;
  const main = <sut.Name> props.main

  eq(main.content, "y")
})

test ("preamble def no classes no properties", () => {
  try {
    sut.parse("<def x>")
    eq(1, 0, "Should not reach.")
  } catch (e) {
    const info = <sut.Parse_error_info> e.info;

    eq(info.expected[0], sut.Concept.Classes)
    eq(info.expected[1], sut.Concept.Properties)
  }
})

test("text", () => {
  const prec = sut.parse("foo");
  
  eq(prec.lines.length, 1);
  
  eq(prec.lines[0][0].type, "text")

  const text = <sut.Text> prec.lines[0][0]

  eq(text.content, "foo")
})

test("escaped text, multiple lines, correct padding", () => {
  const prec = sut.parse(" `a\n  b`")

  eq(prec.lines.length, 1)
  eq(prec.lines[0][0].type, 'text/escaped')

  const escaped = <sut.Text_Escaped> prec.lines[0][0];

  eq(escaped.text.content, "a\nb")

  // spaces beyond padding are allowed
  eq(
    (<sut.Text_Escaped> sut.parse("`a\n  b`").lines[0][0]).text.content,
    "a\n b"
  )
})

test("escaped text, multiple lines, incorrect padding", () => {
  try {
    sut.parse("`a\nb`")
  } catch (e) {
    const info = <sut.Parse_error_info> e.info;

    eq(info.expected[0], sut.Concept.Text_Escaped_line_padding)
    eq(info.got, 'b')
  }
})