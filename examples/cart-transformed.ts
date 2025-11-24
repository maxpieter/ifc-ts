/**
 * SHOPPING CART WITH TRANSFORMED ASYNC IFC
 *
 * This example uses the SAME API as the synchronous version (bind, input, output)
 * but with compile-time async security guarantees.
 *
 * Key differences from runtime-checked version:
 * - Same function names (no "Async" suffix)
 * - Illegal flows caught at COMPILE TIME, not runtime
 * - Zero runtime overhead (labels are phantom types)
 * - IDE shows red squiggles for security violations
 *
 * Run with: npx ts-node examples/cart-transformed.ts
 * Type-check: npx tsc --noEmit
 */

import {bind, ret, unLabel, unsafe_runLIO} from "../src/components/monad";
import {input, output, snk, Snk, src, Src} from "../src/components/monad-io";
import {label, Labeled} from "../src/components/label";

// ============================================================================
// SECURITY PRINCIPALS
// ============================================================================

const customer = "Customer";
const merchant = "Merchant";
const adNetwork = "AdNetwork";

type Customer = typeof customer;
type Merchant = typeof merchant;
type AdNetwork = typeof adNetwork;
type CartSurface = Customer | Merchant;
const cartSurface: CartSurface = customer as CartSurface;

// ============================================================================
// DATA TYPES
// ============================================================================

type CartItem = { name: string; price: number };
type CartState = { items: CartItem[]; total: number };
type Discount = { code: string; amount: number };

// ============================================================================
// HELPERS
// ============================================================================

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const log = (message: string) => {
    console.log(`[${new Date().toISOString()}] ${message}`);
};

// ============================================================================
// LABELED SOURCES (async readers)
// ============================================================================

const cartSource: Src<Customer, CartState> = src(customer, async () => {
    log("cart: fetching customer data (Customer-labeled)");
    await wait(500);
    return {
        items: [
            {name: "Noise-cancelling headphones", price: 199},
            {name: "Gift for partner", price: 72},
            {name: "USB-C cable", price: 9},
        ],
        total: 280
    };
});

const discountSource: Src<Merchant, Discount> = src(merchant, async () => {
    log("discount: loading merchant discount (Merchant-labeled)");
    await wait(350);
    return {
        code: "LOYALTY15",
        amount: 30
    };
});

const adSource: Src<AdNetwork, string> = src(adNetwork, async () => {
    log("ads: generating ad (AdNetwork-labeled)");
    await wait(200);
    return "<script src='//ads.example.net/reco.js'></script>";
});

// ============================================================================
// LABELED SINKS (async writers)
// ============================================================================

const cartSink: Snk<CartSurface, string> = snk(cartSurface, async (html) => {
    await wait(50);
    log(`CART UI: ${html}`);
});

const merchantLogSink: Snk<Merchant, string> = snk(merchant, async (entry) => {
    await wait(50);
    log(`MERCHANT LOG: ${entry}`);
});

const adFrameSink: Snk<AdNetwork, string> = snk(adNetwork, async (html) => {
    await wait(50);
    log(`AD FRAME (isolated): ${html}`);
});

const customerReceiptSink: Snk<Customer, string> = snk(customer, async (receipt) => {
    await wait(50);
    log(`CUSTOMER RECEIPT: ${receipt}`);
});

// ============================================================================
// SECURE WORKFLOWS (using same API as sync version)
// ============================================================================

/**
 * Workflow 1: Render ad in isolated frame
 * AdNetwork -> AdNetwork ✅ LEGAL
 */
const renderAdWorkflow = bind(
    input(adSource),
    (labeledAd: Labeled<AdNetwork, string>) =>
        output(adFrameSink)(labeledAd)
);

/**
 * Workflow 2: Display cart with discount
 * (Customer + Merchant) -> CartSurface ✅ LEGAL
 */
const displayCartWorkflow = bind(
    input(cartSource),
    (labeledCart: Labeled<Customer, CartState>) =>
        bind(
            input(discountSource),
            (labeledDiscount: Labeled<Merchant, Discount>) => {
                const [_, cart] = labeledCart;
                const [__, discount] = labeledDiscount;

                const finalTotal = cart.total - discount.amount;
                const html = `
                    <div>
                        <ul>${cart.items.map(i => `<li>${i.name}: $${i.price}</li>`).join('')}</ul>
                        <p>Subtotal: $${cart.total}</p>
                        <p>Discount (${discount.code}): -$${discount.amount}</p>
                        <p><strong>Total: $${finalTotal}</strong></p>
                    </div>
                `;

                // Label as CartSurface (Customer | Merchant)
                const labeledDisplay = label(cartSurface, html);
                return output(cartSink)(labeledDisplay);
            }
        )
);

/**
 * Workflow 3: Send customer receipt
 * Customer -> Customer ✅ LEGAL
 */
const customerReceiptWorkflow = bind(
    input(cartSource),
    (labeledCart: Labeled<Customer, CartState>) => {
        const [_, cart] = labeledCart;
        const receipt = `Receipt: ${cart.items.map(i => i.name).join(', ')} - Total: $${cart.total}`;
        return output(customerReceiptSink)(label(customer, receipt));
    }
);

/**
 * Workflow 4: Log discount usage
 * Merchant -> Merchant ✅ LEGAL
 */
const merchantLogWorkflow = bind(
    input(discountSource),
    (labeledDiscount: Labeled<Merchant, Discount>) => {
        const [_, discount] = labeledDiscount;
        const logEntry = `Discount ${discount.code} applied: -$${discount.amount}`;
        return output(merchantLogSink)(label(merchant, logEntry));
    }
);

// ============================================================================
// ILLEGAL WORKFLOWS (These MUST NOT compile!)
// ============================================================================

/**
 * ILLEGAL: Customer data to AdNetwork
 * This would leak customer purchases to advertisers
 */
function ILLEGAL_customerToAd() {
    // @ts-expect-error - Type 'Customer' is not assignable to type 'AdNetwork'
    return bind(
        input(cartSource),
        (labeledCart: Labeled<Customer, CartState>) => {
            const [_, cart] = labeledCart;
            const leaked = `Customer bought: ${cart.items.map(i => i.name).join(', ')}`;
            // ❌ TYPE ERROR: Customer cannot flow to AdNetwork!
            return output(adFrameSink)(label(adNetwork, leaked));
        }
    );
}

/**
 * ILLEGAL: Merchant strategy to Customer
 * This would leak pricing strategy
 */
function ILLEGAL_merchantToCustomer() {
    // @ts-expect-error - Type 'Merchant' is not assignable to type 'Customer'
    return bind(
        input(discountSource),
        (labeledDiscount: Labeled<Merchant, Discount>) => {
            const [_, discount] = labeledDiscount;
            const leaked = `Secret discount logic: ${discount.amount}`;
            // ❌ TYPE ERROR: Merchant cannot flow to Customer!
            return output(customerReceiptSink)(label(customer, leaked));
        }
    );
}

/**
 * ILLEGAL: Alice data to Public sink
 */
function ILLEGAL_customerToPublic() {
    const publicSink = snk("" as const, async (x: string) => console.log(x));

    // @ts-expect-error - Type 'Customer' is not assignable to type '""'
    return bind(
        input(cartSource),
        (labeledCart: Labeled<Customer, CartState>) => {
            const [_, cart] = labeledCart;
            // ❌ TYPE ERROR: Customer cannot flow to Public ("")!
            return output(publicSink)(label("", cart.total.toString()));
        }
    );
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log("=== SHOPPING CART (TRANSFORMED API) ===\n");

    const start = Date.now();

    // Run all secure workflows in parallel
    await Promise.all([
        unsafe_runLIO(renderAdWorkflow),
        unsafe_runLIO(displayCartWorkflow),
        unsafe_runLIO(customerReceiptWorkflow),
        unsafe_runLIO(merchantLogWorkflow)
    ]);

    console.log(`\n=== COMPLETED IN ${Date.now() - start}ms ===`);
    console.log("\n✅ All workflows completed!");
    console.log("✅ Compile-time security guarantees maintained!");
    console.log("✅ Same API as sync version (bind, input, output)!");
    console.log("\n💡 Try uncommenting illegal workflows to see TYPE ERRORS.");
}

main().catch((error) => {
    console.error("Error:", error);
    process.exitCode = 1;
});
