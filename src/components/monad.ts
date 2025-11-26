import {Bot, botLevel, GLB, Level, LUB, Top, topLevel} from "./lattice";
import {Contravariant, toContravariant} from "../misc/subtyping";
import {label, Labeled} from "./label";

// LIO_MONAD_______________________________________________

// See figure captioned
// "CG’s language syntax and type system (selected rules)"
// in paper
// "Types for Information Flow Control: Labeling Granularity and Semantic Models"
// by Vineet Rajani and Deepak Garg.
// (page 8 of https://arxiv.org/pdf/1805.00120.pdf )

// API:
//  - label l e
//  - unlabel e
//  - toLabeled e
//  - ret e
//  - bind e f

// (I'll add I/O at the end of this source file)


/**
 * Labeled-I/O monad with phantom type labels.
 *
 * Unlike the tuple-based representation, this uses phantom types for labels
 * and a Promise-based computation, enabling compile-time information flow
 * control with zero runtime label overhead.
 *
 * @template Lpc - Program counter label (phantom, compile-time only)
 * @template L - Data label (phantom, compile-time only)
 * @template V - The value type returned by the computation
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
 * Constructs an LIO computation with phantom type labels.
 *
 * This is the primary constructor for LIO values. The phantom fields (_lpc, _label)
 * exist only at the type level and are set to undefined at runtime.
 *
 * @template Lpc - Program counter label
 * @template L - Data label
 * @template V - Value type
 * @param computation - Async function that produces the value
 * @returns LIO monad wrapping the computation with type-level labels
 */
export function mkLIO<Lpc extends Level, L extends Level, V>(
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
 * Raises the program counter label to match the data label.
 *
 * This operation is necessary before using labeled data in control flow
 * (conditionals, loops) to prevent implicit flows. The PC label is raised
 * to L, ensuring that any outputs within the computation are at least as
 * sensitive as the data being examined.
 *
 * Note: Unlike the old implementation, values remain Labeled throughout.
 * This prevents accidental label erasure and maintains noninterference.
 *
 * @template L - The label of the data
 * @template V - The value type
 * @param lv - Labeled value to unlabel
 * @returns LIO computation with PC raised to L, value remains Labeled<L, V>
 */
export function unLabel<L extends Level, V>(
    lv: Labeled<L, V>
): LIO<L, Bot, Labeled<L, V>> {
    return mkLIO<L, Bot, Labeled<L, V>>(async () => lv);
}

/**
 * Lifts a pure value into the LIO monad.
 *
 * Returns an LIO computation with the weakest possible constraints:
 * PC = Top (no implicit flow restrictions) and data label = Bot (public).
 * Use subtyping to strengthen these guarantees where needed.
 *
 * Warning: In the phantom type approach, ret() should be used carefully
 * to avoid accidentally creating unlabeled values. Prefer keeping values
 * Labeled<L, V> throughout computations.
 *
 * @template V - Value type
 * @param v - The value to lift
 * @returns LIO computation returning the value
 */
export function ret<V>(v: V): LIO<Top, Bot, V> {
    return mkLIO<Top, Bot, V>(async () => v);
}

/**
 * Monadic bind operation for sequencing LIO computations.
 *
 * Key changes from tuple-based implementation:
 * - Continuation f receives Labeled<L, V>, not bare V (prevents label erasure)
 * - Type constraint L extends Rpc enforces that data label flows to PC (prevents implicit flows)
 * - Result labels computed via GLB (PC) and LUB (data) at compile-time
 *
 * Security guarantee: If m has PC label Lpc and data at level L, and the continuation
 * needs PC label Rpc, then L must flow to Rpc (L extends Rpc). This prevents using
 * high-security data in low-security contexts.
 *
 * @template Lpc - PC label of first computation
 * @template L - Data label of first computation (must flow to Rpc)
 * @template V - Value type from first computation
 * @template Rpc - PC label required by continuation
 * @template R - Data label of second computation
 * @template W - Result value type
 * @param m - First LIO computation
 * @param f - Continuation receiving labeled value
 * @returns LIO computation with PC = GLB(Lpc, Rpc) and data label = LUB(L, R)
 */
export function bind<
    Lpc extends Level,
    L extends Rpc,                // L <: Rpc
    V,
    Rpc extends Level,
    R extends Level,
    W
>(
    m: LIO<Lpc, L, Labeled<L, V>>,
    f: (_: Labeled<L, V>) => LIO<Rpc, R, W>
):
    LIO<GLB<Lpc, Rpc>, LUB<L, R>, W> // Zpc <: Lpc , Zpc <: Rpc , L <: Z , R <: Z
{
    return mkLIO<GLB<Lpc, Rpc>, LUB<L, R>, W>(async () => {
        const labeledValue = await m.run();
        const result = f(labeledValue);
        return await result.run();
    });
}
// while TypeScript can check that A <: B,
// TypeScript cannot "magically" find a B
// s.t. A <: B holds (like a human can) (*).
// this caused issues when I was using
// e.g. 'ret' on the rhs of bind in my above
// 'bind' implementations; TypeScript would
// not automatically up-classify the data-level
// to make the other checks pass.
// the below implementation requires no such magic;
// it tells TypeScript how to compute the levels
// of the resulting monad (using the 'GLB', 'LUB'
// type constructors).
// now the only way to get a type error when attempting
// to construct a bind, is if L <: Rpc does not hold.

/**
 * if you have data in the monad,
 * and you wish to write it to someplace,
 * you'll need to box it.
 * to_labeled will automatically assign
 * the appropriate label
 * to the box (i.e. the data-level).
 * the pc does not go away; it might forbid
 * writing this boxed value in a "next step".
 */

// Seems like this function is no longer necessary in async-phantom approach since the values are always labeled inside the monad
// export function toLabeled<
//     PC extends Level,
//     L extends Level,
//     V
// >(m: LIO<PC, L, Labeled<L, V>>
// ): LIO<PC, Bot, Labeled<L, Labeled<L, V>>> {
//     return mkLIO<PC, Bot, Labeled<L, Labeled<L, V>>>(async () => {
//         const lv = await m.run();
//         const [l, v] = lv;
//         return label(l, lv);
//     });
// }

/**
 * Executes an LIO computation and extracts the result value.
 *
 * WARNING: This is unsafe! It bypasses all information flow control checks
 * and should only be used at the top level of your program after verifying
 * that the security guarantees are satisfied.
 *
 * Changed from sync to async to match the Promise-based computation model.
 *
 * @template Lpc - PC label (ignored at runtime)
 * @template L - Data label (ignored at runtime)
 * @template V - Value type
 * @param m - LIO computation to run
 * @returns Promise containing the result value
 */
export async function unsafe_runLIO<Lpc extends Level, L extends Level, V>(
    m: LIO<Lpc, L, V>
): Promise<V> {
    return await m.run();
}