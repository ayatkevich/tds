import { Implementation, Program, Trace } from "./index";

describe("TDS – Test-Driven State", () => {
  test("factorial example - indirect use", async () => {
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

  test("fibonacci example - direct use", async () => {
    const Fibonacci = new Program([
      Trace.with({ n: 0 }) //
        .step("calc", { output: { n: 0 } }),

      Trace.with({ n: 1 }) //
        .step("calc", { output: { n: 1 } }),

      Trace.with({ n: 2 }) //
        .step("calc", { output: { n: 1, a: 1, b: 1 } })
        .step("calc", { output: { n: 1 } }),

      Trace.with({ n: 5 }) //
        .step("calc", { output: { n: 4, a: 1, b: 1 } })
        .step("calc", { output: { n: 3, a: 2, b: 1 } })
        .step("calc", { output: { n: 2, a: 3, b: 2 } })
        .step("calc", { output: { n: 1, a: 5, b: 3 } })
        .step("calc", { output: { n: 5 } }),

      Trace.with({ n: 10 }) //
        .step("calc", { output: { n: 9, a: 1, b: 1 } })
        .step("calc", { output: { n: 8, a: 2, b: 1 } })
        .step("calc", { output: { n: 7, a: 3, b: 2 } })
        .step("calc", { output: { n: 6, a: 5, b: 3 } })
        .step("calc", { output: { n: 5, a: 8, b: 5 } })
        .step("calc", { output: { n: 4, a: 13, b: 8 } })
        .step("calc", { output: { n: 3, a: 21, b: 13 } })
        .step("calc", { output: { n: 2, a: 34, b: 21 } })
        .step("calc", { output: { n: 1, a: 55, b: 34 } })
        .step("calc", { output: { n: 55 } }),
    ]);

    /** The fibonacci program reference can be used indirectly as a type. */
    const fibonacci = new Implementation(Fibonacci)
      /** Reads as: from any state to any state. */
      .transition("*", "*", async ({ n, a = 1, b = 0 }) =>
        n === 0
          ? ["@", { n: b }]
          : n === 1
            ? ["@", { n: a }]
            : ["calc", { n: n - 1, a: a + b, b: a }],
      );

    /** Knowing an initial transition, we should be able to run the whole program. */
    expect(await fibonacci.run("@", "calc", { n: 10 })).toEqual({ n: 55 });

    /**
     * Passing a runtime reference to the fibonacci program, we can verify the program against
     * individual traces.
     */
    await fibonacci.test();
  });

  test("side-effect example", async () => {
    const SideEffect = new Program([
      Trace.with({}) //
        .step("calc"),
    ]);
  });
});
