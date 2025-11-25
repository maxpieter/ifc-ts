import {Level} from "./lattice";
import {LIO, ret} from "./monad";
import {fromContravariant, toContravariant} from "../misc/subtyping";

/** A utility function to manually up-classify data.
 * These are not required to use! (since subtyping the monad works as intended).
 * However, they are useful for debugging.
 */
export function upData<
    Lpc extends Level, L extends L_, L_ extends Level, V
>(
    l_: L_,
    m: LIO<Lpc, L, V>
):
    LIO<Lpc, L_, V> {
    const [lpc, l, v] = m
    return [lpc, l_, v]
}

/** A utility function to manually down-classify pc.
 * These are not required to use! (since subtyping the monad works as intended).
 * However, they are useful for debugging.
 */
export function downPC<
    Lpc_ extends Lpc, Lpc extends Level, L extends Level, V
>(
    lpc_: Lpc_,
    m: LIO<Lpc, L, V>
):
    LIO<Lpc_, L, V> {
    const [lpc, l, v] = m
    return [toContravariant(lpc_), l, v]
}

// Can't work with phantom types as labels dont exist during runtime
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
