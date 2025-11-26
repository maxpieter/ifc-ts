import {Bot, Level, Top} from "./lattice";
import {Contravariant, toContravariant} from "../misc/subtyping";
import {LIO, ret, mkLIO} from "./monad";
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
export type Src<L extends Level, I> = [L, Reader<I>];

/** The sink type, see the "Src" function for details. */
export type Snk<L extends Level, O> = [Contravariant<L>, Writer<O>];

/** Async reader that produces values of type I. Changed from sync to async. */
export type Reader<I> = () => Promise<I>;

/** Async writer that consumes values of type O. Changed from sync to async. */
export type Writer<O> = (_: O) => Promise<void>;

export function src<L extends Level, I>(l: L, r: Reader<I>): Src<L, I> {
    return [l, r];
}

export function snk<L extends Level, O>(l: L, w: Writer<O>): Snk<L, O> {
    return [toContravariant(l), w];
}

/**
 * Reads data from an L-labeled source.
 *
 * Changed to use mkLIO and async reader. The value is automatically labeled
 * with L upon reading, ensuring it cannot flow to lower-security sinks without
 * explicit declassification.
 *
 * @template L - The security label of the source
 * @template I - The type of data read
 * @param src - Source tuple [label, async reader]
 * @returns LIO computation with PC=Top, data label=Bot, value=Labeled<L, I>
 */
export function input<L extends Level, I>([l, r]: Src<L, I>): LIO<Top, Bot, Labeled<L, I>> {
    return mkLIO<Top, Bot, Labeled<L, I>>(async () => {
        const value = await r();
        return label(l, value);
    });
}

/**
 * Writes labeled data to an L-sink.
 *
 * Key change: Type signature now enforces Ldata extends Lsink at compile-time.
 * This prevents writing high-security data to low-security sinks, catching
 * information flow violations before runtime.
 *
 * Changed to use mkLIO and async writer. The data label destructuring happens
 * inside the computation, but the type system has already verified the flow is legal.
 *
 * @template Lsink - The security label of the sink
 * @template Ldata - The label of the data (must flow to Lsink: Ldata extends Lsink)
 * @template O - The type of data written
 * @param snk - Sink tuple [contravariant label, async writer]
 * @returns Function taking Labeled<Ldata, O> and returning LIO with PC=Ldata
 */
export function output<Lsink extends Level, Ldata extends Lsink, O>(
    [_, w]: Snk<Lsink, O>
): (data: Labeled<Ldata, O>) => LIO<Ldata, Bot, null> {
    return (data: Labeled<Ldata, O>) =>
        mkLIO<Ldata, Bot, null>(async () => {
            const [l, value] = data;
            await w(value);
            return null;
        });
}