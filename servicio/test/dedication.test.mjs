// Los informes no llevan dedicatoria.
import assert from "node:assert/strict";
import { withoutDedication } from "../src/worker.js";

const r = withoutDedication({ sections: [{ id: "myth", heading: "Mito", body_markdown: "x" }, { id: "dedication", heading: "Para Ana", body_markdown: "y" }] });
assert.deepEqual(r.sections.map((s) => s.id), ["myth"]);
assert.equal(withoutDedication(null), null);
console.log("dedicatoria: ok");
