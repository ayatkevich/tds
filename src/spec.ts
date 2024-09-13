import { Implementation, Program, Trace } from "./index";

describe("TDS – Test-Driven State", () => {
  test("factorial example", async () => {
    const Factorial = new Program([
      /** A factorial program can be represented as a union of three traces: */

      Trace.with({ n: 0 }) // reads as: for n = 0, the output is n = 1
        .step("calc", { output: { n: 1 } }),

      Trace.with({ n: 1 }) // reads as: for n = 1, the output is n = 1 after one step
        .step("calc", { output: { n: 0, a: 1 } })
        .step("calc", { output: { n: 1 } }),

      Trace.with({ n: 5 }) // reads as: for n = 5, the output is n = 120 after five steps
        .step("calc", { output: { n: 4, a: 5 } })
        .step("calc", { output: { n: 3, a: 20 } })
        .step("calc", { output: { n: 2, a: 60 } })
        .step("calc", { output: { n: 1, a: 120 } })
        .step("calc", { output: { n: 0, a: 120 } })
        .step("calc", { output: { n: 120 } }),
    ]);

    /** The factorial program reference can be used indirectly as a type. */
    const factorial = new Implementation<typeof Factorial>()
      /** Reads as: from any state to any state. */
      .transition("*", "*", ({ n, a = 1 }) =>
        n === 0 //
          ? ["@", { n: a }]
          : ["calc", { n: n - 1, a: n * a }],
      );

    /** Knowing an initial transition, we should be able to run the whole program. */
    expect(await factorial.run("@", "calc", { n: 0 })).toEqual({ n: 1 });
    expect(await factorial.run("@", "calc", { n: 1 })).toEqual({ n: 1 });
    expect(await factorial.run("@", "calc", { n: 5 })).toEqual({ n: 120 });

    /**
     * Passing a runtime reference to the factorial program, we can verify the program against
     * individual traces.
     */
    await factorial.test(Factorial);
  });
});
