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

export type Reader<I> = () => Promise<I>;
export type Writer<O> = (_: O) => Promise<void>;

export function src<L extends Level, I>(l: L, r: Reader<I>): Src<L, I> {
    return [l, r];
}

export function snk<L extends Level, O>(l: L, w: Writer<O>): Snk<L, O> {
    return [toContravariant(l), w];
}

/** Reads data from L-source. data is L-labeled. data can be up-classified by subtyping. */
  export function input<L extends Level, I>([l, r]: Src<L, I>): LIO<Top, Bot, Labeled<L, I>> {
      return mkLIO<Top, Bot, Labeled<L, I>>(async () => {
          const value = await r();
          return label(l, value);
      });
  }

/** Writes data to L-sink. data is L-labeled. data can be down-classified by subtyping. */
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