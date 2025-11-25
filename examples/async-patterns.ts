/**
 * ASYNC PATTERNS WITH PHANTOM TYPES
 *
 * Demonstrates how phantom types provide compile-time security guarantees
 * across different async patterns: callbacks, promises, and async/await.
 */

import { bind, ret, unLabel, unsafe_runLIO } from "../src/components/monad";
import { label, Labeled } from "../src/components/label";
import { input, output, snk, src } from "../src/components/monad-io";

// Security lattice using union types
type Public = "";
type Alice = "Alice" | Public;
type Bob = "Bob" | Public;
type Secret = "Secret" | "Alice" | "Bob" | Public;

const publicLevel: Public = "";
const alice: Alice = "Alice";
const bob: Bob = "Bob";
const secretLevel: Secret = "Secret";

// ============================================================================
// PATTERN 1: Promise-based async operations
// ============================================================================

async function pattern1_promises() {
    console.log("\n=== Pattern 1: Promises ===");

    // Alice's data source (simulates async API call)
    const aliceAPI = src<Alice, string>(alice, async () => {
        return new Promise(resolve => {
            setTimeout(() => resolve("Alice's private data"), 100);
        });
    });

    const aliceSink = snk<Alice, string>(alice, async (data) => {
        console.log(`✅ Alice sees: ${data}`);
    });

    // ✅ LEGAL: Alice → Alice
    const legalProgram = bind(
        input(aliceAPI),
        (labeled: Labeled<Alice, string>) =>
            output(aliceSink)(labeled)
    );

    await unsafe_runLIO(legalProgram);
}

// ============================================================================
// PATTERN 2: Async/await with error handling
// ============================================================================

async function pattern2_async_await() {
    console.log("\n=== Pattern 2: Async/Await ===");

    // Simulated database read (might fail)
    const database = src<Bob, number>(bob, async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 42;
    });

    const logger = snk<Bob, string>(bob, async (msg) => {
        console.log(`✅ Bob's log: ${msg}`);
    });

    const program = bind(
        input(database),
        (labeled: Labeled<Bob, number>) => bind(
            unLabel(labeled),
            (data: Labeled<Bob, number>) => {
                const [_, value] = data;
                return output(logger)(label(publicLevel, `Retrieved: ${value}`));
            }
        )
    );

    await unsafe_runLIO(program);
}

// ============================================================================
// PATTERN 3: Chaining multiple async operations
// ============================================================================

async function pattern3_chaining() {
    console.log("\n=== Pattern 3: Chaining Operations ===");

    const source1 = src<Alice, string>(alice, async () => "part1");
    const source2 = src<Alice, string>(alice, async () => "part2");
    const aliceSink = snk<Alice, string>(alice, async (data) => {
        console.log(`✅ Combined: ${data}`);
    });

    // Chain multiple reads
    const program = bind(
        input(source1),
        (lv1: Labeled<Alice, string>) => bind(
            input(source2),
            (lv2: Labeled<Alice, string>) => bind(
                unLabel(lv1),
                (data1: Labeled<Alice, string>) => bind(
                    unLabel(lv2),
                    (data2: Labeled<Alice, string>) => {
                        const [_, v1] = data1;
                        const [__, v2] = data2;
                        const combined = label(alice, `${v1}-${v2}`);
                        return output(aliceSink)(combined);
                    }
                )
            )
        )
    );

    await unsafe_runLIO(program);
}

// ============================================================================
// TYPE ERRORS: What phantom types prevent
// ============================================================================

function demonstrateTypeErrors() {
    console.log("\n=== Type Errors (Commented Out) ===");

    const aliceSource = src<Alice, string>(alice, async () => "secret");
    const publicSink = snk<Public, string>(publicLevel, async (x) => {
        console.log(`PUBLIC: ${x}`);
    });

    // ❌ TYPE ERROR: Alice cannot flow to Public
    // Uncomment to see: Type '"Alice"' is not assignable to type '""'
    // const illegal = bind(
    //     input(aliceSource),
    //     (labeled: Labeled<Alice, string>) =>
    //         output(publicSink)(labeled)  // TYPE ERROR HERE
    // );

    console.log("  (Illegal flows are commented out - they don't compile!)");
}

// ============================================================================
// Run all examples
// ============================================================================

async function main() {
    await pattern1_promises();
    await pattern2_async_await();
    await pattern3_chaining();
}

main().catch(console.error);
