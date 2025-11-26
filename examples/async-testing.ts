import {bind, ret, unLabel} from "../src/components/monad";
import {label, Labeled} from "../src/components/label";
import {input, output, snk, src} from "../src/components/monad-io";

type Alice = "Alice";
type Public = "";

const alice: Alice = "Alice";
const publicLevel: Public = "";

const aliceSource = src<Alice, string>(alice, async () => "Alice's secret");
const aliceSink = snk<Alice, string>(alice, async (x) => {
    console.log("PUBLIC:", x);
});
const publicSink = snk<Public, string>(publicLevel, async (x) => {
    console.log("PUBLIC:", x);
});
const aliceLIO = input(aliceSource)

/**
 * VIOLATION 1: Relabeling data without proper checks
 * Can destructure Labeled value and relabel it arbitrarily
 */
const violation1 = () => {

    return bind(
        aliceLIO,  // LIO<Top, Bot, Labeled<Alice, string>>
        (lv: Labeled<Alice, string>) => {
            const [_, value] = lv;  // Extract bare string
            // ❌ Relabel Alice data as public!
            return output(publicSink)(label(publicLevel, value));
        }
    );
};

violation1();

/**
 * VIOLATION 2: Values flow through unlabeled
 * ret() allows creating LIO with unlabeled values
 */
const violation2 = () => {

    return bind(
        aliceLIO,
        (lv: Labeled<Alice, string>) => {
            const [_, value] = lv;
            // Create unlabeled LIO
            return bind(
                ret(value),  // LIO<Top, Bot, string> - no label!
                (bareValue: string) => {  // Continuation gets bare string
                    // Relabel and output
                    return output(aliceSink)(label(alice, bareValue));
                }
            );
        }
    );
};

violation2();