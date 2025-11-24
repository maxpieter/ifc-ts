/**
 * SECURITY TESTS (TRANSFORMED API)
 *
 * This demonstrates compile-time security guarantees using the SAME API
 * as the synchronous version (bind, input, output - no "Async" suffix).
 *
 * Run: npx ts-node examples/security-tests-transformed.ts
 * Type-check: npx tsc --noEmit
 */

import {bind, ret, unsafe_runLIO} from "../src/components/monad";
import {input, output, src, snk} from "../src/components/monad-io";
import {label, Labeled} from "../src/components/label";

// Principals
const alice = "Alice";
const bob = "Bob";
const publicLevel = "";

type Alice = typeof alice;
type Bob = typeof bob;
type Public = typeof publicLevel;

console.log("=== COMPILE-TIME SECURITY TESTS ===\n");

// ============================================================================
// LEGAL FLOWS (Should compile and run)
// ============================================================================

async function test1_aliceToAlice() {
    console.log("Test 1: Alice -> Alice (LEGAL)");

    const aliceSource = src<Alice, string>(alice, async () => "Alice's secret");
    const aliceSink = snk<Alice, string>(alice, async (data) => {
        console.log(`  Alice sink: ${data}`);
    });

    const program = bind(
        input(aliceSource),
        (labeled: Labeled<Alice, string>) =>
            output(aliceSink)(labeled)
    );

    await unsafe_runLIO(program);
    console.log("  ✅ Compiled and executed\n");
}

async function test2_publicToAlice() {
    console.log("Test 2: Public -> Alice (LEGAL)");

    const publicSource = src<Public, string>(publicLevel, async () => "Public data");
    const aliceSink = snk<Alice, string>(alice, async (data) => {
        console.log(`  Alice sink: ${data}`);
    });

    const program = bind(
        input(publicSource),
        (labeled: Labeled<Public, string>) =>
            output(aliceSink)(labeled)
    );

    await unsafe_runLIO(program);
    console.log("  ✅ Compiled and executed\n");
}

async function test3_aliceToAliceOrBob() {
    console.log("Test 3: Alice -> Alice|Bob (LEGAL - upclassification)");

    const aliceSource = src<Alice, string>(alice, async () => "Alice's data");
    const sharedSink = snk<Alice | Bob, string>(alice as Alice | Bob, async (data) => {
        console.log(`  Shared sink: ${data}`);
    });

    const program = bind(
        input(aliceSource),
        (labeled: Labeled<Alice, string>) =>
            output(sharedSink)(labeled)
    );

    await unsafe_runLIO(program);
    console.log("  ✅ Compiled and executed\n");
}

// ============================================================================
// ILLEGAL FLOWS (Should NOT compile - type errors)
// ============================================================================

console.log("=== ILLEGAL FLOWS (Should NOT compile) ===\n");

function test4_aliceToBob_ILLEGAL() {
    console.log("Test 4: Alice -> Bob (ILLEGAL)");

    const aliceSource = src<Alice, string>(alice, async () => "Alice's secret");
    const bobSink = snk<Bob, string>(bob, async (data) => {
        console.log(`  Bob sink: ${data}`);
    });

    // @ts-expect-error - Type '"Alice"' is not assignable to type '"Bob"'
    const program = bind(
        input(aliceSource),
        (labeled: Labeled<Alice, string>) =>
            output(bobSink)(labeled)  // ❌ TYPE ERROR!
    );

    console.log("  ❌ This should NOT compile!\n");
}

function test5_aliceToPublic_ILLEGAL() {
    console.log("Test 5: Alice -> Public (ILLEGAL)");

    const aliceSource = src<Alice, string>(alice, async () => "Alice's secret");
    const publicSink = snk<Public, string>(publicLevel, async (data) => {
        console.log(`  Public sink: ${data}`);
    });

    // @ts-expect-error - Type '"Alice"' is not assignable to type '""'
    const program = bind(
        input(aliceSource),
        (labeled: Labeled<Alice, string>) =>
            output(publicSink)(labeled)  // ❌ TYPE ERROR!
    );

    console.log("  ❌ This should NOT compile!\n");
}

function test6_aliceAndBobToAlice_ILLEGAL() {
    console.log("Test 6: (Alice + Bob) -> Alice (ILLEGAL)");

    const aliceSource = src<Alice, string>(alice, async () => "Alice's data");
    const bobSource = src<Bob, string>(bob, async () => "Bob's data");
    const aliceSink = snk<Alice, string>(alice, async (data) => {
        console.log(`  Alice sink: ${data}`);
    });

    // @ts-expect-error - Type 'Alice | Bob' is not assignable to type 'Alice'
    const program = bind(
        input(aliceSource),
        (labeledAlice: Labeled<Alice, string>) =>
            bind(
                input(bobSource),
                (labeledBob: Labeled<Bob, string>) => {
                    const [_, va] = labeledAlice;
                    const [__, vb] = labeledBob;
                    const combined = va + " " + vb;

                    // Combined data has label Alice | Bob
                    const labeledCombined = label(alice as Alice | Bob, combined);

                    // ❌ TYPE ERROR: Alice|Bob cannot flow to Alice-only!
                    return output(aliceSink)(labeledCombined);
                }
            )
    );

    console.log("  ❌ This should NOT compile!\n");
}

// ============================================================================
// RUN TESTS
// ============================================================================

async function runTests() {
    await test1_aliceToAlice();
    await test2_publicToAlice();
    await test3_aliceToAliceOrBob();

    console.log("\n=== NOTE ===");
    console.log("Illegal tests are defined but produce TYPE ERRORS.");
    console.log("Run 'npx tsc --noEmit' to see the compile-time errors.\n");
}

runTests().catch(console.error);
