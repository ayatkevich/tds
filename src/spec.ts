import { Factorial } from "./examples/factorial";
import { Implementation } from "./index";

describe("TDS – Test-Driven State", () => {
  test("factorial example", async () => {
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
     * Knowing an entry state and passing a runtime reference to the factorial program, we can
     * verify the program against individual traces.
     */
    // await factorial.verify("@", Factorial);
  });
});
