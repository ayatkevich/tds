import { Program, Trace } from '..';

export const Factorial = new Program([
  /**
   * A factorial program can be represented as a union of three traces:
   */

  Trace.with({ n: 0 }) // reads as: for n = 0, the output is n = 1
    .step('calc', { output: { n: 1 } }),

  Trace.with({ n: 1 }) // reads as: for n = 1, the output is n = 1 after one step
    .step('calc', { output: { n: 0, a: 1 } })
    .step('calc', { output: { n: 1 } }),

  Trace.with({ n: 5 }) // reads as: for n = 5, the output is n = 120 after five steps
    .step('calc', { output: { n: 4, a: 5 } })
    .step('calc', { output: { n: 3, a: 20 } })
    .step('calc', { output: { n: 2, a: 60 } })
    .step('calc', { output: { n: 1, a: 120 } })
    .step('calc', { output: { n: 0, a: 120 } })
    .step('calc', { output: { n: 120 } }),
]);
