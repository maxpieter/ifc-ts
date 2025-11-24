import {Level} from "./lattice";
import {LIO, ret} from "./monad";
import {fromContravariant, toContravariant} from "../misc/subtyping";

/**
 * MONAD UTILITY FUNCTIONS (Updated for Phantom Types)
 *
 * These functions are not required but useful for manual label manipulation.
 * Note: With phantom types, these operations are purely type-level transformations.
 */

/**
 * Manually up-classify data label
 *
 * This is a type-level operation - no runtime overhead.
 * The actual computation remains unchanged; only the type changes.
 */
export function upData<
    Lpc extends Level, L extends L_, L_ extends Level, V
>(
    l_: L_,
    m: LIO<Lpc, L, V>
):
    LIO<Lpc, L_, V> {
    // Type-level only: runtime representation is identical
    return m as unknown as LIO<Lpc, L_, V>;
}

/**
 * Manually down-classify PC label
 *
 * This is a type-level operation - no runtime overhead.
 * The actual computation remains unchanged; only the type changes.
 */
export function downPC<
    Lpc_ extends Lpc, Lpc extends Level, L extends Level, V
>(
    lpc_: Lpc_,
    m: LIO<Lpc, L, V>
):
    LIO<Lpc_, L, V> {
    // Type-level only: runtime representation is identical
    return m as unknown as LIO<Lpc_, L, V>;
}

/**
 * Get the PC level as a value
 *
 * Note: With phantom types, we cannot extract the actual PC value at runtime
 * since it only exists at the type level. This function signature is preserved
 * for API compatibility but will return a placeholder.
 */
export function levelOfPC<Lpc extends Level, L extends Level, V>(
    m: LIO<Lpc, L, V>
): LIO<Lpc, L, Lpc> {
    // Cannot extract phantom type at runtime
    // Return a monad that resolves to undefined cast to Lpc
    return {
        // @ts-ignore
        _lpc: undefined,
        // @ts-ignore
        _label: undefined,
        run: async () => undefined as unknown as Lpc
    };
}

/**
 * Get the data level as a value
 *
 * Note: With phantom types, we cannot extract the actual data level at runtime
 * since it only exists at the type level. This function signature is preserved
 * for API compatibility but will return a placeholder.
 */
export function levelOfData<Lpc extends Level, L extends Level, V>(
    m: LIO<Lpc, L, V>
): LIO<Lpc, L, L> {
    // Cannot extract phantom type at runtime
    // Return a monad that resolves to undefined cast to L
    return {
        // @ts-ignore
        _lpc: undefined,
        // @ts-ignore
        _label: undefined,
        run: async () => undefined as unknown as L
    };
}
