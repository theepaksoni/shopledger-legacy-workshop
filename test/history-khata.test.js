var assert = require('node:assert/strict');
var test = require('node:test');

var dates = require('../lib/dates');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');

function orderFixture() {
  return {
    orders: [
      { id: 1, date: '28/12/2021' },
      { id: 2, date: '01/01/2022' },
      { id: 3, date: '31/01/2022' },
      { id: 4, date: '04/03/2022' },
      { id: 5, date: '15/03/2022' }
    ]
  };
}

function orderIds(results) {
  return results.map(function (order) { return order.id; });
}

function ledgerFixture() {
  return {
    nextSettlementId: 1,
    customers: [{ id: 1, openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 }]
  };
}

test('fiscal-year boundaries still work with display and date-picker formats', function () {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});

test('number settlement amounts update the ledger and create a receipt', function () {
  var db = ledgerFixture();
  var result = ledger.recordSettlement(db, 1, 500, 'cash', 'Counter');
  assert.equal(result.ok, true);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(db.settlements[0], result.settlement);
});

test('history sorts newest first across months and years without modifying the stored order list', function () {
  var db = orderFixture();
  db.orders.push({ id: 6, date: '2022-01-31' });
  assert.deepEqual(orderIds(orders.list(db)), [5, 4, 6, 3, 2, 1]);
  assert.deepEqual(orderIds(db.orders), [1, 2, 3, 4, 5, 6]);
});

test('history applies inclusive one-sided and two-sided date filters', function () {
  var db = orderFixture();
  assert.deepEqual(orderIds(orders.list(db, { from: '2022-01-01', to: '2022-01-31' })), [3, 2]);
  assert.deepEqual(orderIds(orders.list(db, { from: '31/01/2022' })), [5, 4, 3]);
  assert.deepEqual(orderIds(orders.list(db, { to: '2022-01-01' })), [2, 1]);
});

test('a form settlement is added numerically and reflected in the customer list', function () {
  var db = ledgerFixture();
  var result = ledger.recordSettlement(db, 1, '500');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('a settlement with a decimal form value supports legacy numeric strings in total settled', function () {
  var db = ledgerFixture();
  db.customers[0].totalSettled = '1200.10';
  var result = ledger.recordSettlement(db, 1, '0.205');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1200.31);
  assert.equal(result.customer.balance, 1231.70);
  assert.equal(result.settlement.amount, 0.21);
});

test('invalid settlement amounts leave customer totals and receipt IDs unchanged', function () {
  var db = ledgerFixture();
  var before = ledgerFixture();
  for (var amount of ['', 'no amount', 'Infinity', -1, 0, 0.001, true, [500], 1e308]) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, before);
  }
});
