# TDS - Test-Driven State

**TDS (Test-Driven State)** is a TypeScript library that allows you to model programs as a union of
individual traces. It's based on the idea that every program can be hypothetically devised from such
traces, facilitating state transitions and verification through testing.

## Table of Contents

- [TDS - Test-Driven State](#tds---test-driven-state)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Concepts](#concepts)
    - [Traces](#traces)
    - [Steps](#steps)
    - [Programs](#programs)
    - [Implementations](#implementations)
  - [Usage](#usage)
    - [Fibonacci Example](#fibonacci-example)
      - [Define the Program](#define-the-program)
      - [Implement the Program](#implement-the-program)
      - [Run the Program](#run-the-program)
      - [Test the Program](#test-the-program)
  - [API Reference](#api-reference)
    - [Classes](#classes)
    - [Methods](#methods)
  - [Contributing](#contributing)
  - [License](#license)

## Installation

Install TDS via npm:

```bash
npm install tds.ts
```

Or via Yarn:

```bash
yarn add tds.ts
```

## Concepts

### Traces

A **Trace** represents a sequence of steps in a program execution. It models how the program
transitions from one state to another.

```typescript
const trace = Trace.with({ n: 5 })
  .step("calculate", { output: { n: 4, a: 5 } })
  .step("calculate", { output: { n: 3, a: 20 } });
```

### Steps

A **Step** represents a single state transition within a trace.

```typescript
const step = new Step("calculate", { output: { n: 4, a: 5 } });
```

### Programs

A **Program** consists of multiple traces, representing different execution paths.

```typescript
const FactorialProgram = new Program([
  Trace.with({ n: 0 }).step("calculate", { output: { n: 1 } }),
  Trace.with({ n: 1 })
    .step("calculate", { output: { n: 0, a: 1 } })
    .step("calculate", { output: { n: 1 } }),
]);
```

### Implementations

An **Implementation** provides concrete functions for the transitions defined in the traces.

```typescript
const factorialImplementation = new Implementation(FactorialProgram) //
  .transition("*", "*", ({ n, a = 1 }) =>
    n === 0 ? ["@", { n: a }] : ["calculate", { n: n - 1, a: n * a }],
  );
```

## Usage

### Fibonacci Example

The Fibonacci sequence is a series where each number is the sum of the two preceding ones.

#### Define the Program

```typescript
const FibonacciProgram = new Program([
  Trace.with({ n: 0 }).step("calculate", { output: { n: 0 } }),
  Trace.with({ n: 1 }).step("calculate", { output: { n: 1 } }),
  Trace.with({ n: 5 })
    .step("calculate", { output: { n: 4, a: 1, b: 1 } })
    .step("calculate", { output: { n: 3, a: 2, b: 1 } })
    .step("calculate", { output: { n: 2, a: 3, b: 2 } })
    .step("calculate", { output: { n: 1, a: 5, b: 3 } })
    .step("calculate", { output: { n: 5 } }),
]);
```

#### Implement the Program

```typescript
const fibonacciImplementation = new Implementation(FibonacciProgram) //
  .transition("*", "*", ({ n, a = 1, b = 0 }) =>
    n === 0 ? ["@", { n: b }]
    : n === 1 ? ["@", { n: a }]
    : ["calculate", { n: n - 1, a: a + b, b: a }],
  );
```

#### Run the Program

```typescript
(async () => {
  const result = await fibonacciImplementation.run("@", "calculate", { n: 10 });
  console.log(result); // { n: 55 }
})();
```

#### Test the Program

```typescript
(async () => {
  await fibonacciImplementation.test();
  console.log("All tests passed!");
})();
```

## API Reference

### Classes

- **Step**
  - Represents a single step in a trace.
- **Trace**
  - Represents a sequence of steps.
- **Program**
  - Represents a collection of traces.
- **Implementation**
  - Represents an implementation of a program.

### Methods

- **Trace.with(output)**
  - Initializes a new trace with an initial output.
- **Trace.step(name, options)**
  - Adds a step to the trace.
- **Implementation.transition(from, to, fn)**
  - Adds a transition between states with a processing function.
- **Implementation.run(from, to, input)**
  - Executes the program from one state to another.
- **Implementation.test()**
  - Tests the implementation against its traces.

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests on
[GitHub](https://github.com/ayatkevich/tds).

## License

This project is licensed under the MIT License.
