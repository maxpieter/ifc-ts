/**
 * REAL-WORLD SECURITY SCENARIOS
 *
 * Demonstrates phantom types preventing common security vulnerabilities:
 * - Account transfers (prevent unauthorized access)
 * - Salary computations (protect sensitive financial data)
 * - Message passing (enforce confidentiality)
 * - Logging (prevent information leaks)
 */

import { bind, ret, unLabel, unsafe_runLIO } from "../src/components/monad";
import { label, Labeled } from "../src/components/label";
import { input, output, snk, src } from "../src/components/monad-io";

// Security principals
type Public = "";
type Employee = "Employee" | Public;
type Manager = "Manager" | Employee;
type Admin = "Admin" | Manager;

const publicLevel: Public = "";
const employee: Employee = "Employee";
const manager: Manager = "Manager";
const admin: Admin = "Admin";

// ============================================================================
// SCENARIO 1: Bank Account Transfers
// ============================================================================

async function scenario1_account_transfer() {
  console.log("\n=== Scenario 1: Account Transfers ===");

  // Alice's balance (private)
  const aliceBalance = src<Employee, number>(employee, async () => {
    console.log("  [DB] Reading Alice's balance...");
    return 1000;
  });

  // Transfer log (should be manager-level)
  const auditLog = snk<Manager, string>(manager, async (msg) => {
    console.log(`  ✅ [AUDIT] ${msg}`);
  });

  // Public notification
  const publicLog = snk<Public, string>(publicLevel, async (msg) => {
    console.log(`  ✅ [PUBLIC] ${msg}`);
  });

  // ✅ LEGAL: Employee data → Manager audit log (upclassification)
  const legalAudit = bind(
    input(aliceBalance),
    (balance: Labeled<Employee, number>) =>
      bind(unLabel(balance), (data: Labeled<Employee, number>) => {
        const [_, amount] = data;
        // Upclassify to manager level
        const auditMsg = label(manager, `Transfer: $${amount}`);
        return output(auditLog)(auditMsg);
      })
  );
  const illegalAudit = bind(
    input(aliceBalance),
    (balance: Labeled<Employee, number>) =>
      bind(unLabel(balance), (data: Labeled<Employee, number>) => {
        const [_, amount] = data;
        // Downclassify to public level
        const auditMsg = label(manager, `Transfer: $${amount}`);
        return output(auditLog)(auditMsg);
      })
  );

  await unsafe_runLIO(legalAudit);

  // ❌ ILLEGAL: Can't leak employee balance to public
  // Uncomment to see type error:
/*
    const illegalLeak = bind(
        input(aliceBalance),
        (balance: Labeled<Employee, number>) => bind(
            unLabel(balance),
            (data: Labeled<Employee, number>) => {
                const [_, amount] = data;
                const publicMsg = label(publicLevel, `Balance: $${amount}`);
                return output(publicLog)(publicMsg);  // ❌ TYPE ERROR
            }
        )
    );
*/

  console.log("  ❌ Leaking balance to public log: PREVENTED by type system");
}

// ============================================================================
// SCENARIO 2: Salary Computations
// ============================================================================

async function scenario2_salary_computation() {
  console.log("\n=== Scenario 2: Salary Processing ===");

  // Salary database (manager-only access)
  const salaryDB = src<Manager, number>(manager, async () => {
    console.log("  [DB] Fetching salary...");
    return 85000;
  });

  // Manager's dashboard
  const managerDash = snk<Manager, string>(manager, async (msg) => {
    console.log(`  ✅ [MANAGER DASH] ${msg}`);
  });

  // Public company stats
  const publicStats = snk<Public, string>(publicLevel, async (msg) => {
    console.log(`  ✅ [PUBLIC STATS] ${msg}`);
  });

  // ✅ LEGAL: Compute bonus and show to manager
  const computeBonus = bind(
    input(salaryDB),
    (salary: Labeled<Manager, number>) =>
      bind(unLabel(salary), (data: Labeled<Manager, number>) => {
        const [_, amount] = data;
        const bonus = amount * 0.1;
        const msg = label(manager, `Bonus: $${bonus}`);
        return output(managerDash)(msg);
      })
  );

  await unsafe_runLIO(computeBonus);

  // ❌ ILLEGAL: Can't publish individual salaries
  // This would fail type checking:
  /*
  const leakSalary = bind(
    input(salaryDB),
    (salary: Labeled<Manager, number>) => bind(
        unLabel(salary),
        (data: Labeled<Manager, number>) => {
            const [_, amount] = data;
            const publicMsg = label(publicLevel, `Salary: $${amount}`);
            return output(publicStats)(publicMsg); // Type Error
        }
    )
)
*/
  console.log(
    "  ❌ Publishing salary publicly: PREVENTED by type system"
  );
}

// ============================================================================
// SCENARIO 3: Private Messaging
// ============================================================================

async function scenario3_private_messages() {
  console.log("\n=== Scenario 3: Private Messages ===");

  // Alice's private message
  const aliceMessage = src<Employee, string>(employee, async () => {
    console.log("  [MSG] Alice sending private message...");
    return "Confidential project update";
  });

  // Bob's inbox (employee level)
  const bobInbox = snk<Employee, string>(employee, async (msg) => {
    console.log(`  ✅ [BOB INBOX] ${msg}`);
  });

  // Public bulletin board
  const bulletin = snk<Public, string>(publicLevel, async (msg) => {
    console.log(`  ✅ [BULLETIN] ${msg}`);
  });

  // ✅ LEGAL: Private message between employees
  const privateMsg = bind(
    input(aliceMessage),
    (msg: Labeled<Employee, string>) => output(bobInbox)(msg)
  );

  await unsafe_runLIO(privateMsg);

  // ❌ ILLEGAL: Can't post private message to public board
  /*
    const sharePrivateMsg = bind(
        input(aliceMessage),
        (msg: Labeled<Employee, string>) =>
            output(bulletin)(msg)
    );
    */
  console.log("  ❌ Posting to public bulletin: PREVENTED by type system");
}

// ============================================================================
// SCENARIO 4: Logging with Multiple Security Levels
// ============================================================================

async function scenario4_secure_logging() {
  console.log("\n=== Scenario 4: Multi-Level Logging ===");

  // Different log levels
  const debugLog = snk<Admin, string>(admin, async (msg) => {
    console.log(`  ✅ [DEBUG] ${msg}`);
  });

  const infoLog = snk<Manager, string>(manager, async (msg) => {
    console.log(`  ✅ [INFO] ${msg}`);
  });

  const publicLog = snk<Public, string>(publicLevel, async (msg) => {
    console.log(`  ✅ [PUBLIC] ${msg}`);
  });

  // Public event
  const publicEvent = src<Public, string>(
    publicLevel,
    async () => "User login"
  );

  // ✅ LEGAL: Public → Manager log (upclassification)
  const logToManager = bind(
    input(publicEvent),
    (event: Labeled<Public, string>) =>
      bind(unLabel(event), (data: Labeled<Public, string>) => {
        const [_, msg] = data;
        return output(infoLog)(label(manager, msg));
      })
  );

  await unsafe_runLIO(logToManager);

  // ✅ LEGAL: Public → Admin log (upclassification)
  const logToAdmin = bind(
    input(publicEvent),
    (event: Labeled<Public, string>) =>
      bind(unLabel(event), (data: Labeled<Public, string>) => {
        const [_, msg] = data;
        return output(debugLog)(label(admin, msg));
      })
  );

  await unsafe_runLIO(logToAdmin);

  console.log("  ✅ Upclassification works: Public → Manager → Admin");
}

// ============================================================================
// Run all scenarios
// ============================================================================

async function main() {
  await scenario1_account_transfer();
  await scenario2_salary_computation();
  await scenario3_private_messages();
  await scenario4_secure_logging();

  console.log("\n✅ All legal operations executed successfully!");
  console.log("❌ All illegal flows prevented at compile-time!");
}

main().catch(console.error);
