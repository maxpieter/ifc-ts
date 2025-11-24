import {Bot, Level, Top} from "./lattice";
import {Contravariant, toContravariant} from "../misc/subtyping";
import {LIO, ret} from "./monad";
import {label, Labeled} from "./label";

/**
 * ASYNC I/O WITH COMPILE-TIME SECURITY GUARANTEES
 *
 * This module provides labeled sources and sinks for asynchronous I/O.
 * The key innovation is that can-flow-to constraints are enforced at
 * COMPILE TIME through TypeScript's type system, not at runtime.
 */

/**
 * Async Reader: Produces a value asynchronously
 */
export type Reader<I> = () => Promise<I>;

/**
 * Async Writer: Consumes a value asynchronously
 */
export type Writer<O> = (_: O) => Promise<void>;

/**
 * Labeled Source
 *
 * A source is labeled with security level L and produces values of type I.
 * Reading from the source yields an L-labeled value.
 */
export type Src<L extends Level, I> = [L, Reader<I>];

/**
 * Labeled Sink
 *
 * A sink is labeled with security level L and consumes values of type O.
 * Writing requires data labeled at exactly L (enforced by contravariance).
 */
export type Snk<L extends Level, O> = [Contravariant<L>, Writer<O>];

/**
 * Create a labeled source
 */
export function src<L extends Level, I>(l: L, r: Reader<I>): Src<L, I> {
    return [l, r];
}

/**
 * Create a labeled sink
 */
export function snk<L extends Level, O>(l: L, w: Writer<O>): Snk<L, O> {
    return [toContravariant(l), w];
}

/**
 * Input: Read from a labeled source
 *
 * Returns a monad containing an L-labeled value.
 * - PC = Top (no implicit flows from reading)
 * - Data label = Bot (the value itself is labeled)
 * - Value = Labeled<L, I> (the labeled data)
 */
export function input<L extends Level, I>([l, r]: Src<L, I>): LIO<Top, Bot, Labeled<L, I>> {
    return {
        // @ts-ignore - phantom fields
        _lpc: undefined,
        // @ts-ignore - phantom fields
        _label: undefined,
        run: async () => {
            const value = await r();
            return label(l, value);
        }
    };
}

/**
 * Output: Write to a labeled sink
 *
 * CRITICAL TYPE CONSTRAINT: Ldata extends Lsink
 *
 * This constraint is enforced by TypeScript at COMPILE TIME.
 * If the data's label cannot flow to the sink's label, you get a TYPE ERROR.
 *
 * This is the key to compile-time security guarantees:
 * - "Alice" extends "Alice" ✅ compiles
 * - "Alice" extends "Alice" | "Bob" ✅ compiles
 * - "Alice" extends "Bob" ❌ TYPE ERROR
 * - "Alice" extends "" (public) ❌ TYPE ERROR
 *
 * The function receives Labeled<Ldata, O> to prevent label erasure.
 */
export function output<Lsink extends Level, Ldata extends Lsink, O>(
    [lsink, w]: Snk<Lsink, O>
): (data: Labeled<Ldata, O>) => LIO<Ldata, Bot, null> {
    return (data: Labeled<Ldata, O>) => {
        return {
            // @ts-ignore - phantom fields
            _lpc: undefined,
            // @ts-ignore - phantom fields
            _label: undefined,
            run: async () => {
                const [l, value] = data;
                await w(value);
                return null;
            }
        } as unknown as LIO<Ldata, Bot, null>;
    };
}
