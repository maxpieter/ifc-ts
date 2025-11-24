import {Bot, botLevel, GLB, Level, LUB, Top, topLevel} from "./lattice";
import {Contravariant, toContravariant} from "../misc/subtyping";
import {label, Labeled} from "./label";

/**
 * ASYNC-AWARE LIO MONAD WITH COMPILE-TIME GUARANTEES
 *
 * This monad supports asynchronous operations while maintaining compile-time
 * information-flow control guarantees through phantom types.
 *
 * Key design:
 * - Phantom type parameters (Lpc, L) exist only at compile-time
 * - Runtime representation is just an async thunk: () => Promise<V>
 * - Type constraints enforce can-flow-to relations at compile-time
 * - Labels are completely erased at runtime (zero overhead)
 */

/**
 * Labeled-I/O Monad (Async-Aware)
 *
 * Type parameters:
 * - Lpc: Program Counter label (tracks implicit flows from control)
 * - L: Data label (tracks explicit flows from data)
 * - V: The value type
 *
 * At runtime: Just a thunk returning Promise<V>
 * At compile-time: Carries label information for security checking
 */
export interface LIO<Lpc extends Level, L extends Level, V> {
    /** Phantom field for PC label (compile-time only) */
    readonly _lpc: Lpc;
    /** Phantom field for data label (compile-time only) */
    readonly _label: L;
    /** The actual computation */
    readonly run: () => Promise<V>;
}

/**
 * Internal constructor for LIO monad
 * Phantom fields are undefined at runtime - they exist only for types
 */
function mkLIO<Lpc extends Level, L extends Level, V>(
    computation: () => Promise<V>
): LIO<Lpc, L, V> {
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
 * Returns the strongest guarantee:
 * - PC = Top (no implicit flows)
 * - Data label = Bot (public)
 */
export function ret<V>(v: V): LIO<Top, Bot, V> {
    return mkLIO<Top, Bot, V>(async () => v);
}

/**
 * Unlabel: Extract value from a Labeled within the monad
 *
 * CRITICAL: This returns Labeled<L, V>, NOT V.
 * This prevents label erasure - the value stays labeled.
 *
 * The PC becomes L (tracking the implicit flow from unlabeling)
 */
export function unLabel<L extends Level, V>(
    lv: Labeled<L, V>
): LIO<L, Bot, Labeled<L, V>> {
    return mkLIO<L, Bot, Labeled<L, V>>(async () => lv);
}

/**
 * Bind: Monadic composition with type-level label propagation
 *
 * KEY CONSTRAINT: L extends Rpc
 * This ensures the data label of m can flow to the PC of the continuation.
 * This prevents implicit flows at the type level.
 *
 * Result labels:
 * - PC = GLB(Lpc, Rpc): Most restrictive PC
 * - Data = LUB(L, R): Combines information from both sources
 *
 * IMPORTANT: Function f receives Labeled<L, V>, not V.
 * This ensures labels are never erased.
 */
export function bind<
    Lpc extends Level,
    L extends Rpc,  // KEY: data label must flow to next PC
    V,
    Rpc extends Level,
    R extends Level,
    W
>(
    m: LIO<Lpc, L, Labeled<L, V>>,
    f: (_: Labeled<L, V>) => LIO<Rpc, R, W>
): LIO<GLB<Lpc, Rpc>, LUB<L, R>, W> {
    return mkLIO<GLB<Lpc, Rpc>, LUB<L, R>, W>(async () => {
        const labeledValue = await m.run();
        const result = f(labeledValue);
        return await result.run();
    });
}

/**
 * ToLabeled: Box a value with its label
 *
 * Converts the value in the monad to a labeled value.
 * The PC is preserved, data label becomes Bot (the box carries its own label).
 */
export function toLabeled<
    PC extends Level,
    L extends Level,
    V
>(m: LIO<PC, L, Labeled<L, V>>
): LIO<PC, Bot, Labeled<L, Labeled<L, V>>> {
    return mkLIO<PC, Bot, Labeled<L, Labeled<L, V>>>(async () => {
        const lv = await m.run();
        const [l, v] = lv;
        return label(l, lv);
    });
}

/**
 * Unsafe runner: Extract value from the monad
 *
 * WARNING: This bypasses all security checks.
 * Only use at trusted boundaries (e.g., main function).
 */
export async function unsafe_runLIO<Lpc extends Level, L extends Level, V>(
    m: LIO<Lpc, L, V>
): Promise<V> {
    return await m.run();
}
