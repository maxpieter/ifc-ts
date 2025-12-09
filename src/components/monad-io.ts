import {Bot, botLevel, Level, Top, topLevel} from "./lattice";
import {Contravariant, toContravariant} from "../misc/subtyping";
import {LIO, ret} from "./monad";
import {label, Labeled} from "./label";

/**
 * Here we provide types & primitives to create sources and sinks,
 * and to perform I/O on these.
 * the idea is that the programmer must create sources and sinks,
 * and then use them in the monad.
 * why: there are so many libraries for doing I/O; we cannot
 * possibly support them all. we can support e.g. files & sockets.
 * for anything beyond that, we provide these constructs so that
 * the user of our library can themselves define the sources and
 * sinks.
 */

/** Async reader that returns a Promise */
export type Reader<I> = () => Promise<I>;

/** Async writer that accepts a value and returns a Promise */
export type Writer<O> = (o: O) => Promise<void>;

/** Async source with baked-in Promise handling */
export type Src<L extends Level, I> = [L, Reader<I>];

/** Async sink with baked-in Promise handling */
export type Snk<L extends Level, O> = [Contravariant<L>, Writer<O>];

export function src<L extends Level, I>(l: L, r: Reader<I>): Src<L, I> {
    return [l, r];
}

export function snk<L extends Level, O>(l: L, w: Writer<O>): Snk<L, O> {
    return [toContravariant(l), w];
}

/**
 * Read from an async source.
 * Returns LIO computation that produces a labeled value when the source resolves.
 *
 * The value type is Promise<Labeled<L, I>>, ensuring the label stays attached
 * even after the promise resolves.
 */
export function input<L extends Level, I>([l, r]: Src<L, I>): LIO<Top, Bot, Promise<Labeled<L, I>>> {
    // r() returns Promise<I>
    // We transform it to Promise<Labeled<L, I>>
    const labeledPromise = r().then(i => label(l, i));
    return ret(labeledPromise);
}

/**
 * Write to an async sink.
 * Enforces at compile-time that Ldata can flow to Lsink.
 *
 * Returns a function that takes a Labeled value and produces an LIO computation.
 * The computation writes the value and resolves to null.
 */
export function output<Lsink extends Level, Ldata extends Lsink, O>(
    [lo, w]: Snk<Lsink, O>
): (lv: Labeled<Ldata, O>) => LIO<Lsink, Bot, Promise<null>> {
    return (lv: Labeled<Ldata, O>) => {
        // Use closure-based API
        const o = lv.unsafeGetValue();
        // w() returns Promise<void>
        // We transform it to Promise<null> for consistency
        const writePromise = w(o).then(() => null);
        return ret(writePromise);
    };
}