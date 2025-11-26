// LATTICE_________________________________________________

// Our lattice is the standard powerset lattice.

/** We denote a principal by a string. */
export type Principal = string

// A level is, in principle, a set of principals.
// but, since types are really just sets of values,
// union types & narrowing will make [the type that
// typescript infers] behave like a set of principals.
// (i.e. "Alice" | "Bob" ≈ { "Alice", "Bob" })
// so we can leave out the Set<...> indirection.
export type Level = Principal;

/** Type-level function for least upper bound implemented as a set union. */
export type LUB<L extends Level, R extends Level> = true extends true ? L | R : L | R;

// note: this definition is equivalent to "... = L | R".
// why that redundant-looking "extends"? to force the
// type-level thunk LUB<...> to be evaluated (i.e. to narrow
// the type, so something of type LUB<L,R> will be inferred
// to have type L|R, not LUB<L,R>. see e0 and b1 below)

/** Value-level function for least upper bound. */
export const lub = <L extends Level, R extends Level>(l: L, r: R): LUB<L, R> => l;

// the return type is actually L ; making it
// L | R is actually weakening the guarantee
// of the function. however, that's exactly
// what we want here.
// if we need the implementation to compute
// something of type L | R, then we can use
//return (Math.random() > 0.5) ? l : r
// (but that's a runtime overhead that's
// unnecessary when we only need this for
// type checking)

// Type-level function for greatest lower bound is just
// a set intersection.
/** A type level function for greatest lower bound. */
export type GLB<L extends Level, R extends Level> = true extends true ? L & R : never

// note: this definition is equivalent to "... = L | R".
// see thunk-stuff above.

/** Value-level function for greatest lower bound. */
export function glb<L extends Level, R extends Level>(l: L, r: R): GLB<L, R> {
    return botLevel
}
// do we need the value level representation of glb? Maybe because of structural typing.

// idea: if l === r then return l else return botlevel.
// if condition is true, then (typeof l) <: R and (typeof r) <: R.
// that is, l is    in L & R.
// botlevel is also in L & R.
// sadly, there's a shortcoming in TypeScript's type system:
// the type system does not consider that Level <: string,
// and thus won't produces a type error at l === r.
// to get around this, I compare l and r as strings, and then
// assert the type of the then-branch.
// (so, while this is a hack, it is a sound one)
/*
const sl : string = l
const sr : string = r
if ( sl === sr ) {
    return l as L & R // branch is true ==> l : L and l : R
} else {
    return botlevel
}
*/

// checks if L <: R. (IDE points out that L is unused; just ignore that)
/** Type-level less-than-or-equal. */
export type LEQ<L extends R, R extends Level> = true;

// above is a neat hack that capitalizes on the fact that lattice
// leq is modeled as typescript-subtyping.
// if L <: R, then true, else type error.

// old implementation was considerably more elaborate:
// checks if left-hand-side equals the intersection of both sides.
//type LEQ<L extends Level, R extends Level> =
//    true extends true ? Equal<L, GLB<L, R>> : never
//    [L, R] extends [Level, Level] ? Equal<L, GLB<L, R>> : never

/** Type-level bottom lattice is the empty set. */
export type Bot = never;

/** Type-level top lattice is the full set. */
export type Top = Level;

// bottom and top lattice element (a hack, as I'm asserting the type).

/** Bottom lattice element. The type represents empty set of principals */
export const botLevel: Bot = "👇" as Bot;

/** Top lattice element. The type represents full  set of principals*/
export const topLevel: Top = "👆" as Top;