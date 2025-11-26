import {Level} from "./lattice";
import {LIO, ret} from "./monad";
import {fromContravariant, toContravariant} from "../misc/subtyping";

/**
 * INCOMPATIBLE WITH PHANTOM TYPES: Manually up-classify data label.
 *
 * These utility functions used tuple destructuring to manually adjust labels,
 * which is incompatible with phantom types where labels don't exist at runtime.
 *
 * With phantom types, subtyping should be sufficient for label adjustments.
 * These were primarily used for debugging and explicit type coercion.
 *
 * TODO: These functions need to be removed or rewritten to work with phantom types.
 * Current implementation will fail at runtime.
 */
export function upData<
    Lpc extends Level, L extends L_, L_ extends Level, V
>(
    l_: L_,
    m: LIO<Lpc, L, V>
):
    LIO<Lpc, L_, V> {
    const [lpc, l, v] = m  // Won't work - m is not a tuple anymore
    return [lpc, l_, v]     // Can't construct LIO as tuple
}

/**
 * INCOMPATIBLE WITH PHANTOM TYPES: Manually down-classify PC label.
 *
 * See upData comment above. Same issue applies here.
 */
export function downPC<
    Lpc_ extends Lpc, Lpc extends Level, L extends Level, V
>(
    lpc_: Lpc_,
    m: LIO<Lpc, L, V>
):
    LIO<Lpc_, L, V> {
    const [lpc, l, v] = m           // Won't work
    return [toContravariant(lpc_), l, v]  // Can't construct LIO as tuple
}

/**
 * REMOVED: levelOfPC and levelOfData are incompatible with phantom types.
 *
 * In the tuple-based representation, labels existed at runtime and could be
 * extracted with [lpc, l, v] = m. With phantom types, _lpc and _label are
 * compile-time only and set to undefined at runtime, making runtime extraction
 * impossible.
 *
 * These utilities were used for debugging and manual label inspection. With
 * phantom types, labels are only visible to the type checker, not at runtime.
 */

// /** A quality of life function that gets the PC-level of the monad. */
// export function levelOfPC<Lpc extends Level, L extends Level, V>(m: LIO<Lpc, L, V>): LIO<Lpc, L, Lpc> {
//     const [lpc, l, v] = m;
//     return ret(fromContravariant(lpc));
// }

// /** A quality of life function that gets the data-level of the monad. */
// export function levelOfData<Lpc extends Level, L extends Level, V>(m: LIO<Lpc, L, V>): LIO<Lpc, L, L> {
//     const [lpc, l, v] = m;
//     return ret(l);
// }
