/**
 * ASYNC IFC SECURITY TESTS
 *
 * This file demonstrates the compile-time security guarantees of the async IFC system.
 * It includes both LEGAL flows (that compile) and ILLEGAL flows (that produce type errors).
 *
 * To verify the type errors, uncomment the sections marked with // @ts-expect-error
 * and run: npx tsc --noEmit
 *
 * The illegal examples SHOULD NOT COMPILE - that's the security guarantee!
 */

import {bindAsync, retAsync, unLabelAsync, unsafe_runAsyncLIO} from "../src/components/monad-async";
import {asyncSrc, asyncSnk, inputAsync, outputAsync} from "../src/components/monad-io-async";
import {label, Labeled} from "../src/components/label";

// Define security principals
const alice = "Alice";
const bob = "Bob";
const publicLevel = "";

type Alice = typeof alice;
type Bob = typeof bob;
type Public = typeof publicLevel;
type AliceOrBob = Alice | Bob;

// ============================================================================
// LEGAL FLOWS - These should all compile successfully
// ============================================================================

console.log("=== LEGAL FLOWS (Should Compile) ===\n");

// Test 1: Alice reading Alice's data and writing to Alice's sink
async function test1_aliceToAlice() {
    console.log("Test 1: Alice -> Alice (LEGAL)");

    const aliceSource = asyncSrc<Alice, string>(alice, async () => "Alice's secret");
    const aliceSink = asyncSnk<Alice, string>(alice, async (data) => {
        console.log(`  Alice sink received: ${data}`);
    });

    const program = bindAsync(
        inputAsync(aliceSource),
        (labeledData: Labeled<Alice, string>) =>
            outputAsync(aliceSink)(labeledData)
    );

    await unsafe_runAsyncLIO(program);
    console.log("  ✅ Compiled and ran successfully\n");
}

// Test 2: Alice reading Alice's data and writing to Alice|Bob sink (upclassification)
async function test2_aliceToAliceOrBob() {
    console.log("Test 2: Alice -> Alice|Bob (LEGAL - upclassification)");

    const aliceSource = asyncSrc<Alice, string>(alice, async () => "Alice's data");
    const sharedSink = asyncSnk<AliceOrBob, string>("Alice" as AliceOrBob, async (data) => {
        console.log(`  Shared sink received: ${data}`);
    });

    const program = bindAsync(
        inputAsync(aliceSource),
        (labeledData: Labeled<Alice, string>) =>
            outputAsync(sharedSink)(labeledData)
    );

    await unsafe_runAsyncLIO(program);
    console.log("  ✅ Compiled and ran successfully\n");
}

// Test 3: Public data to any sink
async function test3_publicToAlice() {
    console.log("Test 3: Public -> Alice (LEGAL - public can flow anywhere)");

    const publicSource = asyncSrc<Public, string>(publicLevel, async () => "Public data");
    const aliceSink = asyncSnk<Alice, string>(alice, async (data) => {
        console.log(`  Alice sink received: ${data}`);
    });

    const program = bindAsync(
        inputAsync(publicSource),
        (labeledData: Labeled<Public, string>) =>
            outputAsync(aliceSink)(labeledData)
    );

    await unsafe_runAsyncLIO(program);
    console.log("  ✅ Compiled and ran successfully\n");
}

// Test 4: Chained async operations with label propagation
async function test4_chainedOperations() {
    console.log("Test 4: Chained operations with proper label propagation (LEGAL)");

    const aliceSource1 = asyncSrc<Alice, number>(alice, async () => 42);
    const aliceSource2 = asyncSrc<Alice, number>(alice, async () => 10);
    const aliceSink = asyncSnk<Alice, number>(alice, async (data) => {
        console.log(`  Alice sink received sum: ${data}`);
    });

    const program = bindAsync(
        inputAsync(aliceSource1),
        (labeled1: Labeled<Alice, number>) =>
            bindAsync(
                inputAsync(aliceSource2),
                (labeled2: Labeled<Alice, number>) => {
                    const [l1, v1] = labeled1;
                    const [l2, v2] = labeled2;
                    const sum = v1 + v2;
                    return outputAsync(aliceSink)(label(alice, sum));
                }
            )
    );

    await unsafe_runAsyncLIO(program);
    console.log("  ✅ Compiled and ran successfully\n");
}

// ============================================================================
// ILLEGAL FLOWS - These MUST NOT compile (that's the security guarantee!)
// ============================================================================

console.log("=== ILLEGAL FLOWS (Should NOT Compile) ===\n");

// Test 5: Alice's data to Bob's sink - ILLEGAL!
function test5_aliceToBob_ILLEGAL() {
    console.log("Test 5: Alice -> Bob (ILLEGAL)");

    const aliceSource = asyncSrc<Alice, string>(alice, async () => "Alice's secret");
    const bobSink = asyncSnk<Bob, string>(bob, async (data) => {
        console.log(`  Bob sink received: ${data}`);
    });

    // @ts-expect-error - Type 'Alice' is not assignable to type 'Bob'
    const program = bindAsync(
        inputAsync(aliceSource),
        (labeledData: Labeled<Alice, string>) =>
            outputAsync(bobSink)(labeledData)  // ❌ This should be a type error!
    );

    console.log("  ❌ This should NOT have compiled!\n");
}

// Test 6: Alice's data to Public sink - ILLEGAL!
function test6_aliceToPublic_ILLEGAL() {
    console.log("Test 6: Alice -> Public (ILLEGAL)");

    const aliceSource = asyncSrc<Alice, string>(alice, async () => "Alice's secret");
    const publicSink = asyncSnk<Public, string>(publicLevel, async (data) => {
        console.log(`  Public sink received: ${data}`);
    });

    // @ts-expect-error - Type 'Alice' is not assignable to type '""'
    const program = bindAsync(
        inputAsync(aliceSource),
        (labeledData: Labeled<Alice, string>) =>
            outputAsync(publicSink)(labeledData)  // ❌ This should be a type error!
    );

    console.log("  ❌ This should NOT have compiled!\n");
}

// Test 7: Mixing Alice and Bob data, writing to Alice sink - ILLEGAL!
function test7_aliceAndBobToAlice_ILLEGAL() {
    console.log("Test 7: (Alice + Bob) -> Alice (ILLEGAL)");

    const aliceSource = asyncSrc<Alice, string>(alice, async () => "Alice's data");
    const bobSource = asyncSrc<Bob, string>(bob, async () => "Bob's data");
    const aliceSink = asyncSnk<Alice, string>(alice, async (data) => {
        console.log(`  Alice sink received: ${data}`);
    });

    // @ts-expect-error - Type 'Alice | Bob' is not assignable to type 'Alice'
    const program = bindAsync(
        inputAsync(aliceSource),
        (labeledAlice: Labeled<Alice, string>) =>
            bindAsync(
                inputAsync(bobSource),
                (labeledBob: Labeled<Bob, string>) => {
                    // Combining Alice and Bob data creates Alice|Bob label
                    const [la, va] = labeledAlice;
                    const [lb, vb] = labeledBob;
                    const combined = va + " " + vb;
                    // The combined data has label Alice | Bob
                    const labeledCombined = label("Alice" as Alice | Bob, combined);

                    // ❌ Alice|Bob cannot flow to Alice-only sink!
                    return outputAsync(aliceSink)(labeledCombined);
                }
            )
    );

    console.log("  ❌ This should NOT have compiled!\n");
}

// Test 8: Implicit flow through captured variable - ILLEGAL!
function test8_implicitFlowThroughCapture_ILLEGAL() {
    console.log("Test 8: Implicit flow through captured variable (ILLEGAL)");

    const aliceSource = asyncSrc<Alice, boolean>(alice, async () => true);
    const publicSink = asyncSnk<Public, string>(publicLevel, async (data) => {
        console.log(`  Public sink received: ${data}`);
    });

    // The problem: aliceSecret is captured in the closure
    // If we could write to public sink based on its value, we'd leak information
    const aliceSecret = label(alice, true);

    // @ts-expect-error - This should fail because the closure captures Alice-labeled data
    const program = bindAsync(
        inputAsync(aliceSource),
        (labeledCondition: Labeled<Alice, boolean>) => {
            const [_, condition] = labeledCondition;
            // Even though we write "public" data, the control flow depends on Alice data
            const message = condition ? "yes" : "no";  // Implicit flow!

            // ❌ This creates an information leak - public output depends on Alice input
            return outputAsync(publicSink)(label(publicLevel, message));
        }
    );

    console.log("  ❌ This should NOT have compiled!\n");
}

// ============================================================================
// RUN TESTS
// ============================================================================

async function runTests() {
    // Run legal tests
    await test1_aliceToAlice();
    await test2_aliceToAliceOrBob();
    await test3_publicToAlice();
    await test4_chainedOperations();

    console.log("\n=== NOTE ===");
    console.log("The illegal test functions are defined but not called.");
    console.log("They should produce TYPE ERRORS when you uncomment the @ts-expect-error lines.");
    console.log("Run 'npx tsc --noEmit' to verify the type errors.\n");
}

runTests().catch(console.error);
