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

// const res = violation2();
// console.log(res.toString());
// /**
//  * VIOLATION 3: PC tracking insufficient
//  * Inside unLabel context, can still leak
//  */
// const violation3 = () => {

//     return bind(
//         aliceLIO,
//         (lv: Labeled<Alice, string>) => bind(
//             unLabel(lv),  // PC becomes Alice
//             (stillLabeled: Labeled<Alice, string>) => {
//                 const [_, value] = stillLabeled;
//                 // Even with PC=Alice, can relabel
//                 return output(publicSink)(label(publicLevel, value));
//             }
//         )
//     );
// };

// console.log("Violations compile successfully with naive async implementation");
// console.log("\nViolation 1: Direct relabeling");
// console.log("\nViolation 2: Through unlabeled ret()");
// console.log("\nViolation 3: Inside unLabel context");
