import { IsEqual } from "type-fest";
import { Implementation, InferredTransition, InferTransitions, Program, Trace } from "./index";

describe("TDS – Test-Driven State", () => {
  test("factorial example - indirect use", async () => {
    const Factorial = new Program([
      /** A factorial program can be represented as a union of three traces: */

      Trace.with({ n: 0 }) // reads as: for n = 0, the output is n = 1
        .step("calculate", { output: { n: 1 } }),

      Trace.with({ n: 1 }) // reads as: for n = 1, the output is n = 1 after one step
        .step("calculate", { output: { n: 0, a: 1 } })
        .step("calculate", { output: { n: 1 } }),

      Trace.with({ n: 5 }) // reads as: for n = 5, the output is n = 120 after five steps
        .step("calculate", { output: { n: 4, a: 5 } })
        .step("calculate", { output: { n: 3, a: 20 } })
        .step("calculate", { output: { n: 2, a: 60 } })
        .step("calculate", { output: { n: 1, a: 120 } })
        .step("calculate", { output: { n: 0, a: 120 } })
        .step("calculate", { output: { n: 120 } }),
    ]);

    /** The factorial program reference can be used indirectly as a type. */
    const factorial = new Implementation<typeof Factorial>()
      /** Reads as: from any state to any state. */
      .transition("*", "*", ({ n, a = 1 }) =>
        n === 0 ? ["@", { n: a }] : ["calculate", { n: n - 1, a: n * a }],
      );

    /** Knowing an initial transition, we should be able to run the whole program. */
    expect(await factorial.run("@", "calculate", { n: 0 })).toEqual({ n: 1 });
    expect(await factorial.run("@", "calculate", { n: 1 })).toEqual({ n: 1 });
    expect(await factorial.run("@", "calculate", { n: 5 })).toEqual({ n: 120 });

    /**
     * Passing a runtime reference to the factorial program, we can verify the program against
     * individual traces.
     */
    await factorial.test(Factorial);
  });

  test("fibonacci example - direct use", async () => {
    const Fibonacci = new Program([
      Trace.with({ n: 0 }) //
        .step("calculate", { output: { n: 0 } }),

      Trace.with({ n: 1 }) //
        .step("calculate", { output: { n: 1 } }),

      Trace.with({ n: 2 }) //
        .step("calculate", { output: { n: 1, a: 1, b: 1 } })
        .step("calculate", { output: { n: 1 } }),

      Trace.with({ n: 5 }) //
        .step("calculate", { output: { n: 4, a: 1, b: 1 } })
        .step("calculate", { output: { n: 3, a: 2, b: 1 } })
        .step("calculate", { output: { n: 2, a: 3, b: 2 } })
        .step("calculate", { output: { n: 1, a: 5, b: 3 } })
        .step("calculate", { output: { n: 5 } }),

      Trace.with({ n: 10 }) //
        .step("calculate", { output: { n: 9, a: 1, b: 1 } })
        .step("calculate", { output: { n: 8, a: 2, b: 1 } })
        .step("calculate", { output: { n: 7, a: 3, b: 2 } })
        .step("calculate", { output: { n: 6, a: 5, b: 3 } })
        .step("calculate", { output: { n: 5, a: 8, b: 5 } })
        .step("calculate", { output: { n: 4, a: 13, b: 8 } })
        .step("calculate", { output: { n: 3, a: 21, b: 13 } })
        .step("calculate", { output: { n: 2, a: 34, b: 21 } })
        .step("calculate", { output: { n: 1, a: 55, b: 34 } })
        .step("calculate", { output: { n: 55 } }),
    ]);

    /** The fibonacci program reference can be used indirectly as a type. */
    const fibonacci = new Implementation(Fibonacci)
      /** Reads as: from any state to any state. */
      .transition("*", "*", async ({ n, a = 1, b = 0 }) =>
        n === 0 ? ["@", { n: b }]
        : n === 1 ? ["@", { n: a }]
        : ["calculate", { n: n - 1, a: a + b, b: a }],
      );

    /** Knowing an initial transition, we should be able to run the whole program. */
    expect(await fibonacci.run("@", "calculate", { n: 10 })).toEqual({ n: 55 });

    /**
     * Passing a runtime reference to the fibonacci program, we can verify the program against
     * individual traces.
     */
    await fibonacci.test();
  });

  test("bypassing side-effect-inducing code", async () => {
    const SideEffect = new Program([
      Trace.with({}) //
        .step("no side-effect")
        .step("side-effect", { bypass: true })
        .step("no side-effect"),
    ]);

    expect<
      IsEqual<
        InferTransitions<typeof SideEffect>,
        | InferredTransition<"@", "no side-effect", {}, unknown>
        | InferredTransition<"no side-effect", "side-effect", unknown, unknown>
        | InferredTransition<"side-effect", "no side-effect", unknown, unknown>
      >
    >(true);

    const fromNothingToNoSideEffect = jest.fn();
    const fromNoSideEffectToSideEffect = jest.fn();
    const fromSideEffectToNoSideEffect = jest.fn();
    const sideEffect = new Implementation(SideEffect) //
      .transition("@", "no side-effect", async () => {
        fromNothingToNoSideEffect();
        return ["side-effect", {}];
      })
      .transition("no side-effect", "side-effect", async () => {
        fromNoSideEffectToSideEffect();
        return ["no side-effect", {}];
      })
      .transition("side-effect", "no side-effect", async () => {
        fromSideEffectToNoSideEffect();
        return ["@", {}];
      });

    await sideEffect.test();
    expect(fromNothingToNoSideEffect).toHaveBeenCalledTimes(1);
    expect(fromNoSideEffectToSideEffect).toHaveBeenCalledTimes(0);
    expect(fromSideEffectToNoSideEffect).toHaveBeenCalledTimes(1);
  });
});
