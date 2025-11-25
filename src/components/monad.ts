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


export interface LIO<Lpc extends Level, L extends Level, V> {
    /** Phantom field for PC label (compile-time only) */
    readonly _lpc: Lpc;
    /** Phantom field for data label (compile-time only) */
    readonly _label: L;
    /** The actual computation */
    readonly run: () => Promise<V>;
}

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

// Our unlabel statement.
// typically, given Labeled<L,V>, the return type is LIO<PC, L, V> for any PC.
// instead, I make the type be the strongest guarantee, and will use
// subtyping to weaken this guarantee where needed.

/** Unlabel a labeled statement. */

export function unLabel<L extends Level, V>(
    lv: Labeled<L, V>
): LIO<L, Bot, Labeled<L, V>> {
    return mkLIO<L, Bot, Labeled<L, V>>(async () => lv);
}

// Type for our ret statement.
// typically, its type is LIO<Lpc,L,V> for any Lpc and L.
// instead, I make the type be the strongest guarantee, and will use
// subtyping to weaken this guarantee where needed.

/** Return a value. */
export function ret<V>(v: V): LIO<Top, Bot, V> {
    return mkLIO<Top, Bot, V>(async () => v);
}

/** The bind statement */
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

/** Gets a value out of the monad. WARNING: this is unsafe! */
export async function unsafe_runLIO<Lpc extends Level, L extends Level, V>(
    m: LIO<Lpc, L, V>
): Promise<V> {
    return await m.run();
}