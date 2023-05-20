import * as sut from "../src/tokenize.ts";
import {
  assertEquals as eq,
  assertNotEquals as neq,
  test,
} from "../test_deps.ts";

const tt = sut.Token_type;

test("foo", () => {
  console.log(sut.tokenize("[x {!nom cake}]"))
  //console.log(sut.tokenize("foo").map(t=>sut.Token_type[t.type]))
  //console.log(sut.to_lines(sut.tokenize("`\n  \n \n\n`")))
})