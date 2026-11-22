var assert = require('node:assert/strict');
var test = require('node:test');

var inventory = require('../lib/inventory');
var orders = require('../lib/orders');

function pendingOrderFixture() {
  return {
    products: [
      { id: 1, name: 'Ghee', stock: 1, reserved: 0 },
      { id: 2, name: 'Oil', stock: 4, reserved: 3 }
    ],
    orders: [{
      id: 1007,
      status: 'pending',
      items: [{ id: 1, qty: 2 }, { id: 2, qty: 2 }]
    }]
  };
}

test('stock check excludes wholesale holds and rejects quantities above sellable stock', function () {
  var products = [{ id: 1, name: 'Chilli', stock: 4, reserved: 3 }];
  assert.equal(inventory.getSellableStock(products[0]), 1);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, false);
});

test('cancelling an already cancelled order rejects a second attempt', function () {
  var db = pendingOrderFixture();
  assert.equal(orders.cancel(db, 1007).ok, true);
  var afterFirst = db.products.map(function (product) { return product.stock; });
  assert.equal(orders.cancel(db, 1007).ok, false);
  assert.deepEqual(db.products.map(function (product) { return product.stock; }), afterFirst);
});

test('checkout can sell the exact remaining sellable stock with or without wholesale holds', function () {
  var products = [
    { id: 1, name: 'Ghee', stock: 1, reserved: 0 },
    { id: 2, name: 'Chilli', stock: 5, reserved: 3 }
  ];
  var items = [{ id: 1, qty: 1 }, { id: 2, qty: 2 }];

  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.deepEqual(products.map(function (product) { return product.stock; }), [0, 3]);
  assert.deepEqual(products.map(inventory.getSellableStock), [0, 0]);
});

test('stock check rejects repeated lines whose combined quantity exceeds sellable stock', function () {
  var products = [{ id: 1, name: 'Chilli', stock: 5, reserved: 2 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }, { id: '1', qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }, { id: '1', qty: 1 }]).ok, true);
});

test('cancelling a pending order restores physical and sellable stock without changing holds', function () {
  var db = pendingOrderFixture();
  assert.equal(orders.cancel(db, 1007).order.status, 'cancelled');

  assert.deepEqual(db.products, [
    { id: 1, name: 'Ghee', stock: 3, reserved: 0 },
    { id: 2, name: 'Oil', stock: 6, reserved: 3 }
  ]);
  assert.deepEqual(db.products.map(inventory.getSellableStock), [3, 3]);
});
