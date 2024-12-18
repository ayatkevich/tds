import { IsEqual } from "type-fest";
import { Implementation, InferredTransition, InferTransitions, Program, Trace } from "./index";

describe("TDS – Test-Driven State", () => {
  test("factorial example - indirect use", async () => {
    const Factorial = new Program([
      /** A factorial program can be represented as a union of three traces: */

      Trace.with("n = 0", { n: 0, a: 1 }) // reads as: for n = 0, the output is n = 1
        .step("calculate", () => ({ output: { n: 1, a: 1 } })),

      Trace.with("n = 1", { n: 1, a: 1 }) // reads as: for n = 1, the output is n = 1 after one step
        .step("calculate", () => ({ output: { n: 0, a: 1 } }))
        .step("calculate", () => ({ output: { n: 1, a: 1 } })),

      Trace.with("n = 5", { n: 5, a: 1 }) // reads as: for n = 5, the output is n = 120 after five steps
        .step("calculate", () => ({ output: { n: 4, a: 5 } }))
        .step("calculate", () => ({ output: { n: 3, a: 20 } }))
        .step("calculate", () => ({ output: { n: 2, a: 60 } }))
        .step("calculate", () => ({ output: { n: 1, a: 120 } }))
        .step("calculate", () => ({ output: { n: 0, a: 120 } }))
        .step("calculate", () => ({ output: { n: 120, a: 120 } })),
    ]);

    /** The factorial program reference can be used indirectly as a type. */
    const factorial = new Implementation<typeof Factorial>()
      /** Reads as: from any state to any state. */
      .transition("*", "*", ({ n, a = 1 }) =>
        n === 0 ? ["@", { n: a, a }] : ["calculate", { n: n - 1, a: n * a }],
      );

    /** Knowing an initial transition, we should be able to run the whole program. */
    expect(await factorial.run("@", "calculate", { n: 0 })).toEqual({ n: 1, a: 1 });
    expect(await factorial.run("@", "calculate", { n: 1 })).toEqual({ n: 1, a: 1 });
    expect(await factorial.run("@", "calculate", { n: 5 })).toEqual({ n: 120, a: 120 });

    /**
     * Passing a runtime reference to the factorial program, we can verify the program against
     * individual traces.
     */
    await factorial.test(Factorial);
  });

  test("fibonacci example - direct use", async () => {
    const Fibonacci = new Program([
      Trace.with("n = 0", { n: 0, a: 1, b: 0 }) //
        .step("calculate", () => ({ output: { n: 0, a: 1, b: 0 } })),

      Trace.with("n = 1", { n: 1, a: 1, b: 0 }) //
        .step("calculate", () => ({ output: { n: 1, a: 1, b: 0 } })),

      Trace.with("n = 2", { n: 2, a: 1, b: 0 }) //
        .step("calculate", () => ({ output: { n: 1, a: 1, b: 1 } }))
        .step("calculate", () => ({ output: { n: 1, a: 1, b: 1 } })),

      Trace.with("n = 5", { n: 5, a: 1, b: 0 }) //
        .step("calculate", () => ({ output: { n: 4, a: 1, b: 1 } }))
        .step("calculate", () => ({ output: { n: 3, a: 2, b: 1 } }))
        .step("calculate", () => ({ output: { n: 2, a: 3, b: 2 } }))
        .step("calculate", () => ({ output: { n: 1, a: 5, b: 3 } }))
        .step("calculate", () => ({ output: { n: 5, a: 5, b: 3 } })),

      Trace.with("n = 10", { n: 10, a: 1, b: 0 }) //
        .step("calculate", () => ({ output: { n: 9, a: 1, b: 1 } }))
        .step("calculate", () => ({ output: { n: 8, a: 2, b: 1 } }))
        .step("calculate", () => ({ output: { n: 7, a: 3, b: 2 } }))
        .step("calculate", () => ({ output: { n: 6, a: 5, b: 3 } }))
        .step("calculate", () => ({ output: { n: 5, a: 8, b: 5 } }))
        .step("calculate", () => ({ output: { n: 4, a: 13, b: 8 } }))
        .step("calculate", () => ({ output: { n: 3, a: 21, b: 13 } }))
        .step("calculate", () => ({ output: { n: 2, a: 34, b: 21 } }))
        .step("calculate", () => ({ output: { n: 1, a: 55, b: 34 } }))
        .step("calculate", () => ({ output: { n: 55, a: 55, b: 34 } })),
    ]);

    /** The fibonacci program reference can be used indirectly as a type. */
    const fibonacci = new Implementation(Fibonacci)
      /** Reads as: from any state to any state. */
      .transition("*", "*", async ({ n, a = 1, b = 0 }) =>
        n === 0 ? ["@", { n: b, a, b }]
        : n === 1 ? ["@", { n: a, a, b }]
        : ["calculate", { n: n - 1, a: a + b, b: a }],
      );

    /** Knowing an initial transition, we should be able to run the whole program. */
    expect(await fibonacci.run("@", "calculate", { n: 10 })).toEqual({ n: 55, a: 55, b: 34 });

    /**
     * Passing a runtime reference to the fibonacci program, we can verify the program against
     * individual traces.
     */
    await fibonacci.test();
  });

  test("bypassing side-effect-inducing code", async () => {
    const SideEffect = new Program([
      new Trace("trace") //
        .step("@")
        .step("no side-effect")
        .step("side-effect", () => ({ bypass: true, output: { a: 1 } }))
        .step("no side-effect"),
    ]);

    expect<
      IsEqual<
        InferTransitions<typeof SideEffect>,
        | InferredTransition<"@", "no side-effect", unknown, unknown>
        | InferredTransition<"no side-effect", "side-effect", unknown, { a: number }>
        | InferredTransition<"side-effect", "no side-effect", { a: number }, unknown>
      >
    >(true);

    const fromNothingToNoSideEffect = jest.fn();
    const fromNoSideEffectToSideEffect = jest.fn();
    const fromSideEffectToNoSideEffect = jest.fn();
    const sideEffect = new Implementation(SideEffect) //
      .transition("@", "no side-effect", async (value, transition) => {
        fromNothingToNoSideEffect(value, transition);
        return ["side-effect"];
      })
      .transition("no side-effect", "side-effect", async (value, transition) => {
        fromNoSideEffectToSideEffect(value, transition);
        return ["no side-effect"];
      })
      .transition("side-effect", "no side-effect", async (value, transition) => {
        fromSideEffectToNoSideEffect(value, transition);
        return ["@"];
      });

    await sideEffect.test();
    expect(fromNothingToNoSideEffect).toHaveBeenCalledTimes(1);
    expect(fromNoSideEffectToSideEffect).toHaveBeenCalledTimes(0);
    expect(fromSideEffectToNoSideEffect).toHaveBeenCalledTimes(1);

    expect(fromNothingToNoSideEffect).toHaveBeenCalledWith(undefined, {
      from: "@",
      to: "no side-effect",
    });
    expect(fromSideEffectToNoSideEffect).toHaveBeenCalledWith(
      { a: 1 },
      { from: "side-effect", to: "no side-effect" },
    );
  });

  test("execute arbitrary logic during the verification process", async () => {
    const fn = jest.fn();
    const X = new Program([
      new Trace("trace") //
        .step("@")
        .step("x")
        .call(fn)
        .step("x"),
    ]);

    expect<
      IsEqual<
        InferTransitions<typeof X>,
        | InferredTransition<"@", "x", unknown, unknown>
        | InferredTransition<"x", "x", unknown, unknown>
      >
    >(true);

    const x = new Implementation(X) //
      .transition("*", "*", async () => {
        return ["x"];
      });
    await x.test();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("return Promise.race in transition", async () => {
    const X = new Program([
      new Trace("trace").step("@").step("x").step("y"),
      new Trace("trace").step("@").step("x").step("z"),
    ]);
    new Implementation(X).transition("@", "x", async () => {
      return await Promise.race([
        Promise.resolve().then(() => ["y"] as const),
        Promise.resolve().then(() => ["z"] as const),
      ]);
    });
    // @ts-expect-error
    new Implementation(X).transition("@", "x", async () => {
      return await Promise.race([
        Promise.resolve().then(() => ["y"] as const),
        Promise.resolve().then(() => ["z"] as const),
        Promise.resolve().then(() => ["foobar"] as const),
      ]);
    });
  });

  test("execute just one transition", async () => {
    const nothingToX = jest.fn();
    const xToY = jest.fn();

    const X = new Program([new Trace("trace").step("@").step("x").step("y")]);
    const x = new Implementation(X)
      .transition("@", "x", async () => {
        nothingToX();
        return ["y"];
      })
      .transition("x", "y", async () => {
        xToY();
        return ["@"];
      });

    await x.execute("@", "x");

    expect(nothingToX).toHaveBeenCalledTimes(1);
    expect(xToY).toHaveBeenCalledTimes(0);
  });

  test("program transitions", async () => {
    const X = new Program([
      new Trace("trace").step("@").step("x").step("y"),
      new Trace("trace").step("@").step("x").step("z"),
    ]);
    expect(X.transitions).toEqual([
      ["@", "x"],
      ["x", "y"],
      ["@", "x"],
      ["x", "z"],
    ]);
    expect(X.states).toEqual(["x", "y", "z"]);
  });

  test("current state", async () => {
    const x = new Implementation(
      new Program([new Trace("trace").step("@").step("x").step("y")]),
    ).transition("*", "*", async () => {
      return ["@"];
    });
    expect(x.currentState).toEqual("@");
    await x.execute("@", "x");
    expect(x.currentState).toEqual("x");
  });

  test("resolve async transition with a helper function", async () => {
    let callback: any;
    const on = (fn: any) => (callback = fn);

    const X = new Program([
      new Trace("trace")
        .step("@")

        .step("x", () => ({
          resolve() {
            callback?.();
          },
        }))
        .step("y"),
    ]);

    const x = new Implementation(X)
      .transition("@", "x", async () => {
        await new Promise((resolve) => on(resolve));
        return ["y"];
      })
      .transition("x", "y", async () => {
        return ["@"];
      });

    await x.test();
  });

  describe("test reporting", () => {
    test("passing test", async () => {
      const X = new Program([new Trace("trace").step("@").step("x")]);
      const x = new Implementation(X).transition("@", "x", async () => ["@"]);
      await x.test();
    });

    test('failing test with message "No transition from @ to x"', async () => {
      const X = new Program([new Trace("trace").step("@").step("x").step("y")]);
      const x = new Implementation(X);
      await expect(x.test()).rejects.toThrow(
        [
          //
          "Trace: trace",
          "  🟥 x",
          "    No transition from @ to x",
          "  ⬜ y",
        ].join("\n"),
      );
    });

    test('failing test with message "Expected output {"x":1}, got {}"', async () => {
      const X = new Program([
        new Trace("trace") //
          .step("@")
          .call(() => {})
          .step("x", () => ({ output: { x: 1 } })),
      ]);
      // @ts-expect-error
      const x = new Implementation(X).transition("@", "x", async () => ["@", {}]);
      await expect(x.test()).rejects.toThrow(
        [
          //
          "Trace: trace",
          "  🟥 x",
          '    Expected output {"x":1}, got {}',
        ].join("\n"),
      );
    });

    test("failing test with multiple traces", async () => {
      const X = new Program([
        new Trace("trace 1") //
          .step("@")
          .step("x"),

        new Trace("trace 2").step("@").step("y"),
      ]);
      const x = new Implementation(X).transition("@", "x", async () => ["@"]);
      await expect(x.test()).rejects.toThrow(
        [
          //
          "Trace: trace 1",
          "  🟩 x",
          "Trace: trace 2",
          "  🟥 y",
          "    No transition from @ to y",
        ].join("\n"),
      );
    });
  });

  describe("chart generation", () => {
    test("every trace", async () => {
      const X = new Program([
        new Trace("trace 1") //
          .step("@")
          .step("x")
          .call(() => {})
          .step("y")
          .step("z"),
        new Trace("trace 2") //
          .step("@")
          .step("x")
          .step("x")
          .step("z"),
      ]);
      expect(X.chart()).toEqual(
        [
          //
          "stateDiagram-v2",
          "  1: x",
          "  2: y",
          "  3: z",
          "  [*] --> 1",
          "  1 --> 2",
          "  2 --> 3",
          "  [*] --> 1",
          "  1 --> 1",
          "  1 --> 3",
        ].join("\n"),
      );
    });

    test("distinct transitions only", async () => {
      const X = new Program([
        new Trace("trace 1") //
          .step("@")
          .step("x")
          .call(() => {})
          .step("y")
          .step("z"),
        new Trace("trace 2") //
          .step("@")
          .step("x")
          .step("x")
          .step("z"),
      ]);
      expect(X.chart({ distinct: true })).toEqual(
        [
          //
          "stateDiagram-v2",
          "  1: x",
          "  2: y",
          "  3: z",
          "  [*] --> 1",
          "  1 --> 2",
          "  2 --> 3",
          "  1 --> 1",
          "  1 --> 3",
        ].join("\n"),
      );
    });
  });

  describe("edge cases", () => {
    test("no transition", async () => {
      const NoTransition = new Program([
        new Trace("trace") //
          .step("@")
          .step("no transition"),
      ]);

      const noTransition = new Implementation(NoTransition);

      await expect(noTransition.run("@", "no transition", {})).rejects.toThrow();
    });

    test("no program to verify against", async () => {
      const noProgram = new Implementation();
      await expect(noProgram.test()).rejects.toThrow();
    });

    test("no transition", async () => {
      const NoTransition = new Program([
        new Trace("trace") //
          .step("@")
          .step("no transition"),
      ]);

      const noTransition = new Implementation(NoTransition);

      expect(await noTransition.verify()).toEqual([
        expect.objectContaining({
          kind: "fail",
          message: "No transition from @ to no transition",
        }),
      ]);
    });

    test('expected output "a" but got "b"', async () => {
      const ExpectedOutput = new Program([
        new Trace("trace") //
          .step("@")
          .step("expected output", () => ({ output: { a: 1 } })),
      ]);

      const expectedOutput = new Implementation(ExpectedOutput) // @ts-expect-error
        .state("expected output", async () => ["@", {}]);

      expect(await expectedOutput.verify()).toEqual([
        expect.objectContaining({
          kind: "fail",
          message: 'Expected output {"a":1}, got {}',
        }),
      ]);

      await expect(expectedOutput.test()).rejects.toThrow();
    });

    test("last to bypass", async () => {
      const LastToBypass = new Program([
        new Trace("trace") //
          .step("@")
          .step("last to bypass", () => ({ bypass: true })),
      ]);

      const lastToBypass = new Implementation(LastToBypass) //
        .transition("@", "last to bypass", async () => ["@", {}]);

      await lastToBypass.test();
    });
  });

  describe("typings", () => {
    test("output", async () => {
      new Implementation(
        new Program([
          new Trace("trace") //
            .step("@", () => ({ output: { A: { a: 1, b: undefined, c: undefined } } }))
            .step("a", () => ({ output: { A: { a: 2, b: undefined, c: undefined } } })),
          new Trace("trace") //
            .step("@", () => ({ output: { A: { a: undefined, b: 1, c: undefined } } }))
            .step("a", () => ({ output: { A: { a: undefined, b: 2, c: undefined } } })),
          new Trace("trace") //
            .step("@", () => ({ output: { A: { a: undefined, b: undefined, c: 1 } } }))
            .step("a", () => ({ output: { A: { a: undefined, b: undefined, c: 2 } } })),
        ]),
      ).transition("@", "a", ({ A }) => {
        expect<
          IsEqual<typeof A, { a: number | undefined; b: number | undefined; c: number | undefined }>
        >(true);
        return ["@"];
      });

      new Implementation(
        new Program([
          new Trace("getting rejected because it's cheap")
            .step("@", () => ({
              output: {
                record: {
                  id: "cheap",
                  state: "pending",
                  raw: { jobType: "Hourly: $7.00 - $9.00" },
                  reason: null,
                },
              },
            }))
            .step("pending", () => ({
              output: {
                record: {
                  id: "cheap",
                  state: "rejected",
                  raw: { jobType: "Hourly: $7.00 - $9.00" },
                  reason: "cheap",
                },
              },
            }))
            .step("rejected", () => ({
              output: {
                record: {
                  id: "cheap",
                  state: "rejected",
                  raw: { jobType: "Hourly: $7.00 - $9.00" },
                  reason: "cheap",
                },
              },
            }))
            .step("pending", () => ({
              output: {
                record: {
                  id: "cheap",
                  state: "rejected",
                  raw: { jobType: "Hourly: $7.00 - $9.00" },
                  reason: "cheap",
                },
              },
            })),

          new Trace("getting rejected because client's rating is low")
            .step("@", () => ({
              output: {
                record: {
                  id: "low",
                  state: "pending",
                  raw: { clientRating: " 1.3  " },
                  reason: null,
                },
              },
            }))
            .step("pending", () => ({
              output: {
                record: {
                  id: "low",
                  state: "rejected",
                  raw: { clientRating: " 1.3  " },
                  reason: "low",
                },
              },
            }))
            .step("rejected", () => ({
              output: {
                record: {
                  id: "low",
                  state: "rejected",
                  raw: { clientRating: " 1.3  " },
                  reason: "low",
                },
              },
            })),

          new Trace("getting rejected because payment is unverified")
            .step("@", () => ({
              output: {
                record: {
                  id: "payment",
                  state: "pending",
                  raw: { isPaymentVerified: " Payment unverified" },
                  reason: null,
                },
              },
            }))
            .step("pending", () => ({
              output: {
                record: {
                  id: "payment",
                  state: "rejected",
                  raw: { isPaymentVerified: " Payment unverified" },
                  reason: "payment",
                },
              },
            }))
            .step("rejected", () => ({
              output: {
                record: {
                  id: "payment",
                  state: "rejected",
                  raw: { isPaymentVerified: " Payment unverified" },
                  reason: "payment",
                },
              },
            })),
        ]),
      ).transition("*", "pending", ({ record }) => {
        expect<
          IsEqual<
            typeof record,
            {
              id: string;
              state: string;
              raw: {};
              reason: string | null;
            }
          >
        >(true);
        return ["@"];
      });
    });
  });
});
