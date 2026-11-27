import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateNetting, NettingError } from "../dist/netting.js";

const participants = ["A", "B", "C"];
const UNIT = 10_000_000n;
const MAX_PAYMENT = 9_223_372_036_854_775_807n;
const SEED = 0xc0de2026;

function obligation(obligationId, debtorId, creditorId, amountAtomic) {
  return { obligationId, debtorId, creditorId, amountAtomic };
}

function payment(debtorId, creditorId, units) {
  return { debtorId, creditorId, amountAtomic: String(BigInt(units) * UNIT) };
}

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
}

function sum(rows) {
  return rows.reduce((total, { amountAtomic }) => total + BigInt(amountAtomic), 0n);
}

function balanceFor(rows, participantId) {
  return sum(rows.filter((row) => row.creditorId === participantId))
    - sum(rows.filter((row) => row.debtorId === participantId));
}

function verifyInvariants(input, reordered = {
  participants: [...input.participants].reverse(),
  obligations: [...input.obligations].reverse(),
}) {
  const result = calculateNetting(input);
  const expected = [...input.participants].sort().map((participantId) => ({
    participantId,
    amountAtomic: String(balanceFor(input.obligations, participantId)),
  }));
  assert.deepEqual(result.balances, expected);
  assert.equal(sum(result.balances), 0n);
  assert.equal(result.grossAtomic, String(sum(input.obligations)));
  assert.equal(result.residualAtomic, String(sum(result.payments)));
  assert.equal(BigInt(result.residualAtomic), sum(expected.filter((entry) => BigInt(entry.amountAtomic) > 0n)));
  assert.ok(BigInt(result.residualAtomic) <= BigInt(result.grossAtomic));

  const balances = new Map(expected.map(({ participantId, amountAtomic }) => [participantId, BigInt(amountAtomic)]));
  for (const entry of result.payments) {
    assert.ok(BigInt(entry.amountAtomic) > 0n);
    assert.ok(BigInt(entry.amountAtomic) <= MAX_PAYMENT);
    assert.ok(balances.get(entry.debtorId) < 0n);
    assert.ok(balances.get(entry.creditorId) > 0n);
  }
  for (const participantId of input.participants) {
    assert.equal(balanceFor(result.payments, participantId), balances.get(participantId));
  }
  assert.deepEqual(calculateNetting(reordered), result);
  return result;
}

test("A01: cuatro empresas, 320 → 60 y tres pagos esperados", () => {
  const result = verifyInvariants(fixture("cuatro-empresas"));
  assert.deepEqual(result, {
    balances: [["A", -50], ["B", -10], ["C", 20], ["D", 40]].map(([participantId, units]) => ({
      participantId,
      amountAtomic: String(BigInt(units) * UNIT),
    })),
    payments: [payment("A", "C", 20), payment("A", "D", 30), payment("B", "D", 10)],
    grossAtomic: "3200000000",
    residualAtomic: "600000000",
  });
  assert.equal((BigInt(result.grossAtomic) - BigInt(result.residualAtomic)) * 10_000n / BigInt(result.grossAtomic), 8125n);
});

test("A01: tres empresas, 230 → 50 y dos pagos esperados", () => {
  const result = verifyInvariants(fixture("tres-empresas-230"));
  assert.deepEqual(result.payments, [payment("A", "B", 20), payment("A", "C", 30)]);
  assert.equal(result.grossAtomic, "2300000000");
  assert.equal(result.residualAtomic, "500000000");
});

test("A01: ciclo compensado íntegramente, sin pagos residuales", () => {
  const input = {
    participants,
    obligations: [
      obligation("1", "A", "B", "5"),
      obligation("2", "B", "C", "5"),
      obligation("3", "C", "A", "5"),
    ],
  };
  const result = verifyInvariants(input);
  assert.deepEqual(result.payments, []);
  assert.equal(result.residualAtomic, "0");
});

function directedEdges(ids) {
  return ids.flatMap((debtorId) => ids.filter((id) => id !== debtorId)
    .map((creditorId) => [debtorId, creditorId]));
}

test("A02: 729 grafos exhaustivos de tres participantes", () => {
  const edges = directedEdges(participants);
  for (let graph = 0; graph < 729; graph++) {
    const obligations = edges.flatMap(([debtorId, creditorId], index) => {
      const amount = Math.floor(graph / (3 ** index)) % 3;
      return amount === 0 ? [] : [obligation(String(index), debtorId, creditorId, String(amount))];
    });
    try {
      verifyInvariants({ participants, obligations });
    } catch (cause) {
      throw new Error(`A02: grafo ${graph}`, { cause });
    }
  }
});

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffled(rows, random) {
  const copy = [...rows];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

test("A03: 1 000 grafos reproducibles de 3 a 8 participantes", () => {
  const random = seededRandom(SEED);
  const counts = new Map();
  for (let graph = 0; graph < 1_000; graph++) {
    const count = 3 + (graph % 6);
    counts.set(count, (counts.get(count) ?? 0) + 1);
    const ids = Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index));
    const density = random();
    const obligations = directedEdges(ids).flatMap(([debtorId, creditorId], index) => {
      if (random() >= density) return [];
      const amount = 1 + Math.floor(random() * 10_000_000_000);
      return [obligation(String(index), debtorId, creditorId, String(amount))];
    });
    try {
      verifyInvariants({ participants: ids, obligations }, {
        participants: shuffled(ids, random),
        obligations: shuffled(obligations, random),
      });
    } catch (cause) {
      throw new Error(`A03: semilla 0x${SEED.toString(16)}, grafo ${graph}`, { cause });
    }
  }
  assert.deepEqual([...counts], [[3, 167], [4, 167], [5, 167], [6, 167], [7, 166], [8, 166]]);
});

test("A03: entrada vacía de obligaciones y participante aislado", () => {
  assert.deepEqual(verifyInvariants({ participants, obligations: [] }), {
    balances: participants.map((participantId) => ({ participantId, amountAtomic: "0" })),
    payments: [],
    grossAtomic: "0",
    residualAtomic: "0",
  });
  const result = verifyInvariants({ participants, obligations: [obligation("1", "A", "B", "1")] });
  assert.equal(result.balances[2].amountAtomic, "0");
});

test("A03: compensación en una ronda con componentes desconectados", () => {
  const result = verifyInvariants({
    participants: ["A", "B", "C", "D"],
    obligations: [obligation("1", "A", "D", "5"), obligation("2", "B", "C", "5")],
  });
  assert.deepEqual(result.payments, [
    { debtorId: "A", creditorId: "C", amountAtomic: "5" },
    { debtorId: "B", creditorId: "D", amountAtomic: "5" },
  ]);
});

test("A03: obligaciones distintas entre las mismas partes conservan todos los importes", () => {
  const result = verifyInvariants({
    participants,
    obligations: [obligation("O1", "A", "B", "5"), obligation("O2", "A", "B", "7")],
  });
  assert.equal(result.payments[0].amountAtomic, "12");
});

test("A03: identifica entradas inválidas, sin cambiar la entrada", () => {
  const valid = obligation("1", "A", "B", "1");
  const badAmounts = ["0", "-1", "1.5", "1e3", "01", "+1", " 1", "1\n", "", 1, null];
  const invalidObligations = [
    ...badAmounts.map((amount) => [obligation("1", "A", "B", amount)]),
    [valid, obligation("1", "B", "C", "2")],
    [obligation("1", "A", "A", "1")],
    [obligation("1", "A", "X", "1")],
    [obligation("1", "X", "B", "1")],
    [obligation("", "A", "B", "1")],
    [null],
  ];
  const invalidInputs = [
    ...invalidObligations.map((obligations) => ({ participants, obligations })),
    ...[["A", "B"], ["A", "B", "B"], ["A", "B", "Ñ"], ["A\n", "B", "C"],
      ["A", "B", "C", "D", "E", "F", "G", "H", "I"]].map((ids) => ({
      participants: ids, obligations: [],
    })),
    { participants, obligations: null },
    null,
  ];
  for (const input of invalidInputs) {
    const before = structuredClone(input);
    assert.throws(() => calculateNetting(input), { name: "NettingError", code: "INVALID_INPUT" }, JSON.stringify(input));
    assert.deepEqual(input, before);
  }
});

test("A03: límites de importe exacto y de pago residual", () => {
  const max = String(MAX_PAYMENT);
  const exact = { participants, obligations: [obligation("1", "A", "B", max)] };
  assert.equal(verifyInvariants(exact).payments[0].amountAtomic, max);

  const overflow = { participants, obligations: [...exact.obligations, obligation("2", "A", "B", "1")] };
  assert.throws(() => calculateNetting(overflow), (error) =>
    error instanceof NettingError && error.code === "PAYMENT_AMOUNT_OUT_OF_RANGE");

  const offset = {
    participants,
    obligations: [...overflow.obligations, obligation("3", "B", "A", "1")],
  };
  assert.equal(verifyInvariants(offset).grossAtomic, String(MAX_PAYMENT + 2n));

  const largeBalanced = {
    participants: ["A", "B", "C", "D"],
    obligations: [obligation("1", "A", "B", max), obligation("2", "A", "C", max)],
  };
  assert.equal(verifyInvariants(largeBalanced).residualAtomic, String(MAX_PAYMENT * 2n));
});
