import {Level} from "./lattice";

// LABELS__________________________________________________

/**
 * A labeled value using closure-based encapsulation.
 * The label and value are stored in closure scope and cannot be extracted
 * through destructuring or property access. This provides true runtime
 * encapsulation that prevents accidental information flow violations.
 *
 * Values can only be accessed through the explicit API methods.
 */
export interface Labeled<L extends Level, V> {
    /** Get the label (safe operation) */
    getLabel(): L;

    /**
     * WARNING: Unsafe operation that extracts the raw value.
     * This bypasses information flow control.
     * Use only when absolutely necessary and with proper security review.
     */
    unsafeGetValue(): V;
}

/**
 * Attaches a label to a value using closure-based encapsulation.
 * The label and value are captured in closure scope and cannot be accessed
 * except through the provided methods.
 */
export function label<L extends Level, V>(l: L, v: V): Labeled<L, V> {
    // These variables are captured in the closure - truly private!
    const privateLabel: L = l;
    const privateValue: V = v;

    return {
        getLabel(): L {
            return privateLabel;
        },

        unsafeGetValue(): V {
            return privateValue;
        }
    };
}

/**
 * Project labeled-value to the value.
 * WARNING: this is UNSAFE because it circumvents information flow control.
 * @deprecated Use lv.unsafeGetValue() instead
 */
export function unsafe_valueOf<L extends Level, V>(lv: Labeled<L, V>): V {
    return lv.unsafeGetValue();
}

/** Projects labeled-value to the label. */
export function labelOf<L extends Level, V>(lv: Labeled<L, V>): L {
    return lv.getLabel();
}

/** Up-classify label on labeled-value. */
export function upLabel<L extends L_, L_ extends Level, V>(l_: L_): (_: Labeled<L, V>) => Labeled<L_, V> {
    return (lv: Labeled<L, V>) => {
        return label(l_, lv.unsafeGetValue());
    }
}