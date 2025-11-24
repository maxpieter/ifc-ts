import {Bot, botLevel, GLB, Level, LUB, Top, topLevel} from "./lattice";
import {Contravariant, toContravariant} from "../misc/subtyping";
import {label, Labeled} from "./label";

/**
 * ASYNC LIO MONAD WITH COMPILE-TIME GUARANTEES
 *
 * This implementation maintains security labels at the type level,
 * ensuring that illegal information flows are caught by the TypeScript
 * compiler before runtime.
 *
 * Key design principles:
 * 1. Labels are phantom types (preserved at compile-time, erased at runtime)
 * 2. The monad wraps async computations while tracking PC and data labels
 * 3. Type constraints enforce can-flow-to relations at composition time
 * 4. Values remain labeled throughout - no premature label erasure
 */

/**
 * Async Labeled-I/O Monad
 *
 * The monad encodes three pieces of information in its type:
 * - Lpc: Program Counter label (tracks implicit flows from control dependencies)
 * - L: Data label (tracks explicit flows from the data itself)
 * - V: The value type
 *
 * At runtime, this is just a thunk returning a Promise<V>.
 * The labels exist only at the type level for compile-time checking.
 */
export interface AsyncLIO<Lpc extends Level, L extends Level, V> {
    /** Phantom field to preserve PC label in the type */
    readonly _lpc: Lpc;
    /** Phantom field to preserve data label in the type */
    readonly _label: L;
    /** The actual async computation */
    readonly run: () => Promise<V>;
}

/**
 * Internal constructor for AsyncLIO
 * The phantom fields are never actually set - they exist only for the type system
 */
function mkAsyncLIO<Lpc extends Level, L extends Level, V>(
    computation: () => Promise<V>
): AsyncLIO<Lpc, L, V> {
    return {
        // @ts-ignore - phantom fields for type system only
        _lpc: undefined,
        // @ts-ignore - phantom fields for type system only
        _label: undefined,
        run: computation
    };
}

/**
 * Return/Pure: Lift a value into the monad
 *
 * Returns the strongest guarantee: Top PC (no implicit flows), Bot data label (public)
 */
export function retAsync<V>(v: V): AsyncLIO<Top, Bot, V> {
    return mkAsyncLIO<Top, Bot, V>(async () => v);
}

/**
 * Unlabel: Extract value from a Labeled value within the monad
 *
 * CRITICAL: The returned value is STILL LABELED. This prevents label erasure.
 * The PC becomes the label of the unlabeled value (tracking the implicit flow).
 *
 * Unlike the problematic implementation, this returns Labeled<L, V>, not V.
 */
export function unLabelAsync<L extends Level, V>(
    lv: Labeled<L, V>
): AsyncLIO<L, Bot, Labeled<L, V>> {
    return mkAsyncLIO<L, Bot, Labeled<L, V>>(async () => lv);
}

/**
 * Bind: Monadic composition with type-level label propagation
 *
 * Key constraint: L extends Rpc
 * This ensures that the data label of the first computation can flow to
 * the PC of the second computation (preventing implicit flows).
 *
 * The result has:
 * - PC = GLB(Lpc, Rpc): Most restrictive PC from both computations
 * - Data = LUB(L, R): Combines information from both data sources
 *
 * IMPORTANT: The function f receives the LABELED value, not the raw value.
 * This ensures the label is never erased.
 */
export function bindAsync<
    Lpc extends Level,
    L extends Rpc,  // KEY CONSTRAINT: data label must flow to next PC
    V,
    Rpc extends Level,
    R extends Level,
    W
>(
    m: AsyncLIO<Lpc, L, Labeled<L, V>>,
    f: (_: Labeled<L, V>) => AsyncLIO<Rpc, R, W>
): AsyncLIO<GLB<Lpc, Rpc>, LUB<L, R>, W> {
    return mkAsyncLIO<GLB<Lpc, Rpc>, LUB<L, R>, W>(async () => {
        const labeledValue = await m.run();
        const result = f(labeledValue);
        return await result.run();
    });
}

/**
 * Map: Apply a function to the value inside the monad
 *
 * The function receives the LABELED value to preserve security information.
 * Labels are preserved through the transformation.
 */
export function mapAsync<Lpc extends Level, L extends Level, V, W>(
    m: AsyncLIO<Lpc, L, Labeled<L, V>>,
    f: (lv: Labeled<L, V>) => Labeled<L, W>
): AsyncLIO<Lpc, L, Labeled<L, W>> {
    return mkAsyncLIO<Lpc, L, Labeled<L, W>>(async () => {
        const lv = await m.run();
        return f(lv);
    });
}

/**
 * ToLabeled: Convert a value in the monad to a labeled value
 *
 * This boxes the value with its label, making it suitable for output operations.
 * The PC is preserved, and the data label becomes Bot (the boxed value carries its own label).
 */
export function toLabeledAsync<PC extends Level, L extends Level, V>(
    m: AsyncLIO<PC, L, Labeled<L, V>>
): AsyncLIO<PC, Bot, Labeled<L, Labeled<L, V>>> {
    return mkAsyncLIO<PC, Bot, Labeled<L, Labeled<L, V>>>(async () => {
        const lv = await m.run();
        const [l, v] = lv;
        return label(l, lv);
    });
}

/**
 * Unsafe runner: Extract the value from the monad
 *
 * WARNING: This bypasses all security checks. Only use at trusted boundaries.
 */
export async function unsafe_runAsyncLIO<Lpc extends Level, L extends Level, V>(
    m: AsyncLIO<Lpc, L, V>
): Promise<V> {
    return await m.run();
}

/**
 * Sequence: Run multiple async LIO computations in sequence
 *
 * All computations must have the same PC and data labels.
 * Returns an array of results.
 */
export function sequenceAsync<Lpc extends Level, L extends Level, V>(
    ms: AsyncLIO<Lpc, L, V>[]
): AsyncLIO<Lpc, L, V[]> {
    return mkAsyncLIO<Lpc, L, V[]>(async () => {
        const results: V[] = [];
        for (const m of ms) {
            results.push(await m.run());
        }
        return results;
    });
}
