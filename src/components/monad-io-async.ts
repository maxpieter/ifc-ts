import {Bot, Level, Top} from "./lattice";
import {Contravariant, toContravariant} from "../misc/subtyping";
import {AsyncLIO, retAsync} from "./monad-async";
import {label, Labeled} from "./label";

/**
 * ASYNC I/O WITH COMPILE-TIME SECURITY GUARANTEES
 *
 * This module provides labeled sources and sinks for asynchronous I/O operations.
 * Unlike the problematic implementation, this version enforces can-flow-to constraints
 * at the TYPE LEVEL, ensuring illegal flows are caught by TypeScript's compiler.
 */

/**
 * Async Reader: A function that asynchronously produces a value
 */
export type AsyncReader<I> = () => Promise<I>;

/**
 * Async Writer: A function that asynchronously consumes a value
 */
export type AsyncWriter<O> = (_: O) => Promise<void>;

/**
 * Labeled Async Source
 *
 * A source is labeled with a security level L and produces values of type I.
 * Reading from the source produces an L-labeled value.
 */
export type AsyncSrc<L extends Level, I> = [L, AsyncReader<I>];

/**
 * Labeled Async Sink
 *
 * A sink is labeled with a security level L and consumes values of type O.
 * Writing to the sink requires an L-labeled value (enforced by contravariance).
 */
export type AsyncSnk<L extends Level, O> = [Contravariant<L>, AsyncWriter<O>];

/**
 * Create a labeled async source
 */
export function asyncSrc<L extends Level, I>(l: L, r: AsyncReader<I>): AsyncSrc<L, I> {
    return [l, r];
}

/**
 * Create a labeled async sink
 */
export function asyncSnk<L extends Level, O>(l: L, w: AsyncWriter<O>): AsyncSnk<L, O> {
    return [toContravariant(l), w];
}

/**
 * Input: Read from a labeled async source
 *
 * Returns a monad containing an L-labeled value.
 * The result has:
 * - PC = Top (no implicit flows from reading)
 * - Data label = Bot (the value itself is labeled, so the container is public)
 * - Value = Labeled<L, I> (the actual labeled data)
 */
export function inputAsync<L extends Level, I>(
    [l, r]: AsyncSrc<L, I>
): AsyncLIO<Top, Bot, Labeled<L, I>> {
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
 * Output: Write to a labeled async sink
 *
 * CRITICAL TYPE CONSTRAINT: Ldata extends Lsink
 *
 * This ensures that data can only be written to a sink if its label
 * can flow to the sink's label. This is enforced at COMPILE TIME.
 *
 * The function signature uses a constraint on the type parameter to
 * make illegal flows a type error.
 *
 * Examples:
 * - Writing "Alice"-labeled data to "Alice" sink: ✅ Type checks
 * - Writing "Alice"-labeled data to "Alice | Bob" sink: ✅ Type checks
 * - Writing "Alice"-labeled data to "Bob" sink: ❌ Type error
 * - Writing "Alice"-labeled data to "" (public) sink: ❌ Type error
 */
export function outputAsync<Lsink extends Level, Ldata extends Lsink, O>(
    [lsink, w]: AsyncSnk<Lsink, O>
): (data: Labeled<Ldata, O>) => AsyncLIO<Ldata, Bot, null> {
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
        };
    };
}

/**
 * Alternative output with explicit can-flow-to check in the type signature
 *
 * This version makes the flow constraint even more explicit by requiring
 * a witness that Ldata can flow to Lsink.
 */
export function outputAsyncExplicit<Lsink extends Level, Ldata extends Level, O>(
    sink: AsyncSnk<Lsink, O>,
    // This constraint ensures Ldata can flow to Lsink
    _witness: Ldata extends Lsink ? true : never
): (data: Labeled<Ldata, O>) => AsyncLIO<Ldata, Bot, null> {
    return outputAsync<Lsink, Ldata, O>(sink);
}

/**
 * Parallel input: Read from multiple sources concurrently
 *
 * All sources must have the same label L.
 * Returns an array of labeled values, all with label L.
 */
export function parallelInputAsync<L extends Level, I>(
    sources: AsyncSrc<L, I>[]
): AsyncLIO<Top, Bot, Labeled<L, I>[]> {
    return {
        // @ts-ignore - phantom fields
        _lpc: undefined,
        // @ts-ignore - phantom fields
        _label: undefined,
        run: async () => {
            const promises = sources.map(([l, r]) =>
                r().then(value => label(l, value))
            );
            return await Promise.all(promises);
        }
    };
}

/**
 * Conditional output: Write to a sink only if a condition holds
 *
 * The condition itself must be at a label that can flow to the sink's label,
 * otherwise we have an implicit flow from the condition to the output.
 */
export function conditionalOutputAsync<
    Lsink extends Level,
    Lcond extends Lsink,  // Condition must be able to flow to sink
    Ldata extends Lsink,  // Data must be able to flow to sink
    O
>(
    sink: AsyncSnk<Lsink, O>,
    condition: Labeled<Lcond, boolean>
): (data: Labeled<Ldata, O>) => AsyncLIO<Ldata, Bot, null> {
    return (data: Labeled<Ldata, O>) => {
        return {
            // @ts-ignore - phantom fields
            _lpc: undefined,
            // @ts-ignore - phantom fields
            _label: undefined,
            run: async () => {
                const [_, shouldWrite] = condition;
                if (shouldWrite) {
                    const [lsink, w] = sink;
                    const [ldata, value] = data;
                    await w(value);
                }
                return null;
            }
        };
    };
}
