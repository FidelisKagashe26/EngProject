import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Queryable } from "../db/transaction";
import { applyProjectSpend, moveProjectSpend, type SpendCategory } from "./projectLedger";

type FakeProject = {
  name: string;
  status: string;
  contractValue: number;
  amountReceived: number;
  totalSpent: number;
  laborBudget: number;
  materialBudget: number;
  operationalBudget: number;
  laborSpent: number;
  materialSpent: number;
  operationalSpent: number;
};

const project = (overrides: Partial<FakeProject> = {}): FakeProject => ({
  name: "Dodoma Drainage",
  status: "Active",
  contractValue: 1_000_000,
  amountReceived: 500_000,
  totalSpent: 0,
  laborBudget: 0,
  materialBudget: 0,
  operationalBudget: 0,
  laborSpent: 0,
  materialSpent: 0,
  operationalSpent: 0,
  ...overrides,
});

const SPENT_FIELD: Record<SpendCategory, keyof FakeProject> = {
  labor: "laborSpent",
  material: "materialSpent",
  operational: "operationalSpent",
};

const BUDGET_FIELD: Record<SpendCategory, keyof FakeProject> = {
  labor: "laborBudget",
  material: "materialBudget",
  operational: "operationalBudget",
};

/**
 * In-memory stand-in for the projects table. It answers the locking SELECT and
 * applies the UPDATE the same way Postgres would, so these tests exercise the
 * ledger's real decisions rather than a mock of them.
 */
const fakeDb = (projects: Record<string, FakeProject>) => {
  let lockCount = 0;

  const client: Queryable = {
    query: async <T,>(text: string, params: unknown[] = []) => {
      const projectId = String(params[1]);
      const target = projects[projectId];

      if (text.includes("FOR UPDATE")) {
        lockCount += 1;
        if (!target) {
          return { rows: [] as T[], rowCount: 0 };
        }

        const category = (["labor", "material", "operational"] as const).find((name) =>
          text.includes(`${name}_budget`),
        );
        assert.ok(category, "locking select must read one category's budget");

        return {
          rows: [
            {
              name: target.name,
              status: target.status,
              contract_value: String(target.contractValue),
              amount_received: String(target.amountReceived),
              total_spent: String(target.totalSpent),
              category_budget: String(target[BUDGET_FIELD[category]]),
              category_spent: String(target[SPENT_FIELD[category]]),
            },
          ] as T[],
          rowCount: 1,
        };
      }

      if (text.includes("UPDATE engicost.projects")) {
        assert.ok(target, "update targeted a project that does not exist");
        const delta = Number(params[2]);
        const category = (["labor", "material", "operational"] as const).find((name) =>
          text.includes(`${name}_spent`),
        );
        assert.ok(category, "update must move one category column");

        target.totalSpent = Math.max(target.totalSpent + delta, 0);
        const field = SPENT_FIELD[category];
        (target[field] as number) = Math.max((target[field] as number) + delta, 0);

        return { rows: [] as T[], rowCount: 1 };
      }

      throw new Error(`unexpected query: ${text}`);
    },
  };

  return { client, projects, lockCount: () => lockCount };
};

describe("applyProjectSpend", () => {
  it("books spend against both the total and its category", async () => {
    const db = fakeDb({ P1: project() });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "labor",
      delta: 120_000,
      context: "labor payment",
    });

    assert.equal(failure, null);
    assert.equal(db.projects.P1.totalSpent, 120_000);
    assert.equal(db.projects.P1.laborSpent, 120_000);
    assert.equal(db.projects.P1.materialSpent, 0);
  });

  it("locks the project row before reading its balances", async () => {
    const db = fakeDb({ P1: project() });

    await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "labor",
      delta: 1_000,
      context: "labor payment",
    });

    assert.equal(db.lockCount(), 1);
  });

  it("rejects spend beyond the cash received and leaves totals untouched", async () => {
    const db = fakeDb({ P1: project({ amountReceived: 100_000 }) });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "operational",
      delta: 150_000,
      context: "expense",
    });

    assert.ok(failure);
    assert.match(failure.message, /Insufficient project funds/);
    assert.equal(failure.availableCash, 100_000);
    assert.equal(db.projects.P1.totalSpent, 0);
  });

  it("rejects spend beyond the contract value even when cash is available", async () => {
    // Client overpaid, so cash is plentiful but the contract is nearly used up.
    const db = fakeDb({
      P1: project({ contractValue: 200_000, amountReceived: 500_000, totalSpent: 180_000 }),
    });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "material",
      delta: 50_000,
      context: "material purchase",
    });

    assert.ok(failure);
    assert.match(failure.message, /exceeds the project budget/);
    assert.equal(db.projects.P1.totalSpent, 180_000);
  });

  it("rejects spend beyond a set category budget", async () => {
    const db = fakeDb({ P1: project({ laborBudget: 100_000, laborSpent: 90_000 }) });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "labor",
      delta: 20_000,
      context: "labor payment",
    });

    assert.ok(failure);
    assert.match(failure.message, /exceeds the labour budget/);
    assert.equal(db.projects.P1.laborSpent, 90_000);
  });

  it("treats a zero category budget as unbudgeted rather than a hard zero", async () => {
    const db = fakeDb({ P1: project({ laborBudget: 0 }) });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "labor",
      delta: 400_000,
      context: "labor payment",
    });

    assert.equal(failure, null);
    assert.equal(db.projects.P1.laborSpent, 400_000);
  });

  it("charges a category budget only against its own category", async () => {
    const db = fakeDb({ P1: project({ laborBudget: 50_000, materialSpent: 200_000 }) });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "labor",
      delta: 50_000,
      context: "labor payment",
    });

    assert.equal(failure, null, "material spend must not consume the labour budget");
  });

  for (const status of ["Completed", "Closed"]) {
    it(`refuses new spend on a ${status} project`, async () => {
      const db = fakeDb({ P1: project({ status }) });

      const failure = await applyProjectSpend(db.client, {
        companyId: 1,
        projectId: "P1",
        category: "operational",
        delta: 10_000,
        context: "expense",
      });

      assert.ok(failure);
      assert.match(failure.message, /no longer accepts new spend/);
      assert.equal(db.projects.P1.totalSpent, 0);
    });
  }

  it("still allows reversals on a closed project so mistakes can be corrected", async () => {
    const db = fakeDb({
      P1: project({ status: "Closed", totalSpent: 80_000, operationalSpent: 80_000 }),
    });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "operational",
      delta: -30_000,
      context: "expense deletion",
    });

    assert.equal(failure, null);
    assert.equal(db.projects.P1.totalSpent, 50_000);
    assert.equal(db.projects.P1.operationalSpent, 50_000);
  });

  it("applies reversals that exceed capacity without checking it", async () => {
    // Over-budget projects must still be able to unwind a bad entry.
    const db = fakeDb({
      P1: project({ amountReceived: 0, totalSpent: 90_000, laborSpent: 90_000 }),
    });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "labor",
      delta: -90_000,
      context: "labor payment deletion",
    });

    assert.equal(failure, null);
    assert.equal(db.projects.P1.totalSpent, 0);
  });

  it("never drives a total below zero", async () => {
    const db = fakeDb({ P1: project({ totalSpent: 10_000, laborSpent: 10_000 }) });

    await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "labor",
      delta: -50_000,
      context: "labor payment deletion",
    });

    assert.equal(db.projects.P1.totalSpent, 0);
    assert.equal(db.projects.P1.laborSpent, 0);
  });

  it("does nothing at all for a zero delta", async () => {
    const db = fakeDb({ P1: project({ status: "Closed" }) });

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "P1",
      category: "labor",
      delta: 0,
      context: "labor payment",
    });

    assert.equal(failure, null);
    assert.equal(db.lockCount(), 0, "a no-op must not take a lock");
  });

  it("reports a missing project rather than throwing", async () => {
    const db = fakeDb({});

    const failure = await applyProjectSpend(db.client, {
      companyId: 1,
      projectId: "GHOST",
      category: "labor",
      delta: 1_000,
      context: "labor payment",
    });

    assert.ok(failure);
    assert.match(failure.message, /does not exist/);
  });
});

describe("moveProjectSpend", () => {
  it("applies only the difference when the project has not changed", async () => {
    const db = fakeDb({ P1: project({ totalSpent: 100_000, materialSpent: 100_000 }) });

    const failure = await moveProjectSpend(db.client, {
      companyId: 1,
      fromProjectId: "P1",
      toProjectId: "P1",
      category: "material",
      previousAmount: 100_000,
      nextAmount: 130_000,
      context: "material purchase update",
    });

    assert.equal(failure, null);
    assert.equal(db.projects.P1.totalSpent, 130_000);
    assert.equal(db.projects.P1.materialSpent, 130_000);
  });

  it("unbooks the old project and books the new one", async () => {
    const db = fakeDb({
      P1: project({ totalSpent: 60_000, operationalSpent: 60_000 }),
      P2: project({ name: "Mbeya Road" }),
    });

    const failure = await moveProjectSpend(db.client, {
      companyId: 1,
      fromProjectId: "P1",
      toProjectId: "P2",
      category: "operational",
      previousAmount: 60_000,
      nextAmount: 60_000,
      context: "expense update",
    });

    assert.equal(failure, null);
    assert.equal(db.projects.P1.totalSpent, 0);
    assert.equal(db.projects.P2.totalSpent, 60_000);
  });

  it("reports the failure when the destination cannot take the spend", async () => {
    const db = fakeDb({
      P1: project({ totalSpent: 60_000, operationalSpent: 60_000 }),
      P2: project({ name: "Mbeya Road", amountReceived: 10_000 }),
    });

    const failure = await moveProjectSpend(db.client, {
      companyId: 1,
      fromProjectId: "P1",
      toProjectId: "P2",
      category: "operational",
      previousAmount: 60_000,
      nextAmount: 60_000,
      context: "expense update",
    });

    assert.ok(failure);
    assert.equal(failure.projectName, "Mbeya Road");
    assert.equal(db.projects.P2.totalSpent, 0);
    // The reversal already ran; the caller rolls the transaction back, which is
    // why every ledger move must happen inside one.
    assert.equal(db.projects.P1.totalSpent, 0);
  });

  it("frees the old project's capacity before charging the new one", async () => {
    // Both sides are the same project's worth of money, so the move only works
    // if the reversal is applied first.
    const db = fakeDb({
      P1: project({ amountReceived: 100_000, totalSpent: 100_000, laborSpent: 100_000 }),
    });

    const failure = await moveProjectSpend(db.client, {
      companyId: 1,
      fromProjectId: "P1",
      toProjectId: "P1",
      category: "labor",
      previousAmount: 100_000,
      nextAmount: 100_000,
      context: "labor payment update",
    });

    assert.equal(failure, null);
    assert.equal(db.projects.P1.totalSpent, 100_000);
  });
});
