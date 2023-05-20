import * as t from "../src/tokenize.ts";
import * as h from "./html.ts";

const gobbo_code =
`<con example [ <?val path ../lel.bel>
  [code-block {=<val path>}
    [read {=<val path>}]]
  [box [include {=<val path>}]]
]>

<def code code-block {=gobbo}>
<cla .bla foo\\bar\\baz \\qux .lel {!nom cake}>

[section [\\title Title]

  Whatever some text and a [link {=web.site} link].]

/ below some escaped text
\`escaping some text\`

/* multi line

   comment
*/`

console.log(t.tokenize(gobbo_code).map(h.to_span).join(""))