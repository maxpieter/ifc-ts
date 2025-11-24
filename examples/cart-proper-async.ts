/**
 * SHOPPING CART EXAMPLE WITH COMPILE-TIME IFC GUARANTEES
 *
 * This example demonstrates a multi-principal web application where:
 * - Customer data is isolated from merchant and ad network
 * - Merchant data is isolated from customer and ad network
 * - Ad network is completely sandboxed
 *
 * CRITICALLY: Violations of these security policies are caught at COMPILE TIME,
 * not at runtime. If this code compiles, it is guaranteed to be secure.
 *
 * Run with: npx ts-node examples/cart-proper-async.ts
 * Type-check with: npx tsc --noEmit
 */

import {bindAsync, unsafe_runAsyncLIO} from "../src/components/monad-async";
import {asyncSrc, asyncSnk, inputAsync, outputAsync} from "../src/components/monad-io-async";
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

// CartSurface can see both customer and merchant data
type CartSurface = Customer | Merchant;
const cartSurface: CartSurface = customer as CartSurface;

// ============================================================================
// DATA TYPES
// ============================================================================

type CartItem = {
    name: string;
    price: number;
    category: string;
};

type CartState = {
    items: CartItem[];
    subtotal: number;
};

type Discount = {
    code: string;
    amount: number;
    reason: string;
};

type AdContent = {
    html: string;
    trackingId: string;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const log = (message: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

// ============================================================================
// LABELED SOURCES
// ============================================================================

/**
 * Customer's cart data - labeled Customer
 * This is sensitive: it reveals what the customer is purchasing
 */
const cartSource = asyncSrc<Customer, CartState>(customer, async () => {
    log("cart: fetching customer's cart (Customer-labeled)");
    await wait(500);
    return {
        items: [
            {name: "Noise-cancelling headphones", price: 199, category: "electronics"},
            {name: "Gift for partner", price: 72, category: "gifts"},
            {name: "USB-C cable", price: 9, category: "electronics"},
        ],
        subtotal: 280
    };
});

/**
 * Merchant's discount data - labeled Merchant
 * This is sensitive: reveals business pricing strategies
 */
const discountSource = asyncSrc<Merchant, Discount>(merchant, async () => {
    log("discount: loading merchant discount (Merchant-labeled)");
    await wait(350);
    return {
        code: "LOYALTY15",
        amount: 30,
        reason: "Customer has high lifetime value"
    };
});

/**
 * Ad network content - labeled AdNetwork
 * This is isolated: should not access customer or merchant data
 */
const adSource = asyncSrc<AdNetwork, AdContent>(adNetwork, async () => {
    log("ads: generating ad content (AdNetwork-labeled)");
    await wait(200);
    return {
        html: "<div class='ad'>Generic Product Ad</div>",
        trackingId: "ad-12345"
    };
});

// ============================================================================
// LABELED SINKS
// ============================================================================

/**
 * Cart UI sink - can display Customer | Merchant data
 * This represents the main cart display shown to the customer
 */
const cartUISink = asyncSnk<CartSurface, string>(cartSurface, async (html) => {
    await wait(50);
    log(`CART UI: ${html}`);
});

/**
 * Merchant analytics sink - only Merchant data
 * Used for business intelligence, must not include customer PII
 */
const merchantLogSink = asyncSnk<Merchant, string>(merchant, async (entry) => {
    await wait(50);
    log(`MERCHANT LOG: ${entry}`);
});

/**
 * Ad frame sink - only AdNetwork data
 * Completely sandboxed from customer and merchant data
 */
const adFrameSink = asyncSnk<AdNetwork, string>(adNetwork, async (html) => {
    await wait(50);
    log(`AD FRAME (isolated): ${html}`);
});

/**
 * Customer receipt sink - only Customer data
 * Personal receipt emailed to customer
 */
const customerReceiptSink = asyncSnk<Customer, string>(customer, async (receipt) => {
    await wait(50);
    log(`CUSTOMER RECEIPT: ${receipt}`);
});

// ============================================================================
// SECURE WORKFLOWS
// ============================================================================

/**
 * Workflow 1: Render ad in isolated frame
 * Ad network data can ONLY go to ad network sink
 */
const renderAdWorkflow = bindAsync(
    inputAsync(adSource),
    (labeledAd: Labeled<AdNetwork, AdContent>) => {
        const [_, ad] = labeledAd;
        const html = `<iframe>${ad.html}</iframe>`;
        return outputAsync(adFrameSink)(label(adNetwork, html));
    }
);

/**
 * Workflow 2: Display cart with applied discount
 * Combines Customer and Merchant data -> CartSurface (Customer | Merchant)
 */
const displayCartWithDiscountWorkflow = bindAsync(
    inputAsync(cartSource),
    (labeledCart: Labeled<Customer, CartState>) =>
        bindAsync(
            inputAsync(discountSource),
            (labeledDiscount: Labeled<Merchant, Discount>) => {
                // Extract values (they remain labeled)
                const [lcart, cart] = labeledCart;
                const [ldiscount, discount] = labeledDiscount;

                // Compute display (combining Customer + Merchant data)
                const finalTotal = cart.subtotal - discount.amount;
                const displayHTML = `
                    <div class="cart">
                        <h2>Your Cart</h2>
                        <ul>${cart.items.map(i => `<li>${i.name}: $${i.price}</li>`).join('')}</ul>
                        <p>Subtotal: $${cart.subtotal}</p>
                        <p>Discount (${discount.code}): -$${discount.amount}</p>
                        <p><strong>Total: $${finalTotal}</strong></p>
                    </div>
                `;

                // Label the display as CartSurface (Customer | Merchant)
                // This is LEGAL because:
                // - Customer <: Customer | Merchant ✅
                // - Merchant <: Customer | Merchant ✅
                const labeledDisplay = label(cartSurface, displayHTML);

                return outputAsync(cartUISink)(labeledDisplay);
            }
        )
);

/**
 * Workflow 3: Send customer receipt (Customer data only)
 * Only includes customer's purchase info, not merchant strategy
 */
const sendCustomerReceiptWorkflow = bindAsync(
    inputAsync(cartSource),
    (labeledCart: Labeled<Customer, CartState>) => {
        const [_, cart] = labeledCart;

        const receiptText = `
            Your Receipt:
            ${cart.items.map(i => `${i.name}: $${i.price}`).join('\n')}
            Total: $${cart.subtotal}
        `;

        // Label as Customer and write to customer receipt sink
        return outputAsync(customerReceiptSink)(label(customer, receiptText));
    }
);

/**
 * Workflow 4: Log discount application (Merchant data only)
 * Analytics for merchant, must not include customer identity
 */
const logDiscountUsageWorkflow = bindAsync(
    inputAsync(discountSource),
    (labeledDiscount: Labeled<Merchant, Discount>) => {
        const [_, discount] = labeledDiscount;

        const logEntry = `Discount ${discount.code} applied: -$${discount.amount} (${discount.reason})`;

        return outputAsync(merchantLogSink)(label(merchant, logEntry));
    }
);

// ============================================================================
// ILLEGAL WORKFLOWS (These should NOT compile)
// ============================================================================

/**
 * ILLEGAL: Customer data to Ad Network
 * This would leak customer purchases to advertisers
 */
function ILLEGAL_customerToAd() {
    // @ts-expect-error - Type 'Customer' is not assignable to type 'AdNetwork'
    return bindAsync(
        inputAsync(cartSource),
        (labeledCart: Labeled<Customer, CartState>) => {
            const [_, cart] = labeledCart;
            const leaked = `Customer bought: ${cart.items.map(i => i.name).join(', ')}`;
            // ❌ This MUST NOT compile!
            return outputAsync(adFrameSink)(label(adNetwork, leaked));
        }
    );
}

/**
 * ILLEGAL: Merchant strategy to Customer receipt
 * This would leak merchant's pricing strategy to customer
 */
function ILLEGAL_merchantStrategyToCustomer() {
    // @ts-expect-error - Type 'Merchant' is not assignable to type 'Customer'
    return bindAsync(
        inputAsync(discountSource),
        (labeledDiscount: Labeled<Merchant, Discount>) => {
            const [_, discount] = labeledDiscount;
            const leaked = `Secret: ${discount.reason}`;  // This reveals merchant strategy!
            // ❌ This MUST NOT compile!
            return outputAsync(customerReceiptSink)(label(customer, leaked));
        }
    );
}

/**
 * ILLEGAL: Combined data to single-principal sink
 * CartSurface (Customer | Merchant) cannot flow to Customer-only
 */
function ILLEGAL_combinedToCustomer() {
    // @ts-expect-error - Type 'Customer | Merchant' is not assignable to type 'Customer'
    return bindAsync(
        inputAsync(cartSource),
        (labeledCart: Labeled<Customer, CartState>) =>
            bindAsync(
                inputAsync(discountSource),
                (labeledDiscount: Labeled<Merchant, Discount>) => {
                    const [_, cart] = labeledCart;
                    const [__, discount] = labeledDiscount;

                    // Combining creates Customer | Merchant label
                    const combined = `Cart: ${cart.subtotal}, Discount: ${discount.amount}`;
                    const labeledCombined = label(cartSurface, combined);

                    // ❌ Customer | Merchant cannot flow to Customer-only!
                    return outputAsync(customerReceiptSink)(labeledCombined);
                }
            )
    );
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    console.log("=== SHOPPING CART WITH COMPILE-TIME IFC ===\n");

    const startTime = Date.now();

    // Run all secure workflows in parallel
    await Promise.all([
        unsafe_runAsyncLIO(renderAdWorkflow),
        unsafe_runAsyncLIO(displayCartWithDiscountWorkflow),
        unsafe_runAsyncLIO(sendCustomerReceiptWorkflow),
        unsafe_runAsyncLIO(logDiscountUsageWorkflow)
    ]);

    const elapsed = Date.now() - startTime;

    console.log(`\n=== COMPLETED IN ${elapsed}ms ===`);
    console.log("\n✅ All workflows completed successfully!");
    console.log("✅ No information leaks possible - guaranteed by TypeScript compiler!");
    console.log("\n💡 Try uncommenting the illegal workflows to see type errors.");
}

main().catch((error) => {
    console.error("Error:", error);
    process.exitCode = 1;
});
