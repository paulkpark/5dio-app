import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isEarlyBird, computeProPrice, FREE_TRIAL_END_ISO } from '../services/pricing.js';

// What this guards: a landing page quoting a price the payment provider does not
// actually charge. Korea bills in KRW through Toss, everywhere else bills in USD
// through Stripe, and each landing has to match its own provider.
//
// This replaces the early-bird toggle suite. That launch mechanism rendered two
// price blocks and swapped them client-side at a cutoff date; the window closed
// 2026-05-29 and the markup has since been removed from both landings, so those
// tests were only asserting the shape of code that no longer exists.

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const krLanding = readFileSync(join(ROOT, 'public/landing/index.html'), 'utf8');
const enLanding = readFileSync(join(ROOT, 'public/landing/en/index.html'), 'utf8');

const won = (n) => '₩' + n.toLocaleString('en-US');

test('the early-bird window closes exactly at its boundary', () => {
  const end = new Date(FREE_TRIAL_END_ISO);
  assert.equal(isEarlyBird(new Date(end.getTime() - 1000)), true);
  assert.equal(isEarlyBird(end), false, 'the boundary instant itself is full price');
  assert.equal(isEarlyBird(new Date(end.getTime() + 1000)), false);
});

test('the window is closed now, so Pro bills at full price', () => {
  assert.equal(isEarlyBird(), false);
  assert.equal(computeProPrice('monthly').amount, 9900);
  assert.equal(computeProPrice('yearly').amount, 99000);
});

test('KR landing quotes the KRW amounts Toss will actually charge', () => {
  // Derived from pricing.js rather than hardcoded, so a price change cannot
  // leave the landing and the checkout disagreeing.
  assert.match(krLanding, new RegExp(won(computeProPrice('monthly').amount)));
  assert.match(krLanding, new RegExp(won(computeProPrice('yearly').amount)));
});

test('KR landing no longer advertises the closed early-bird prices', () => {
  assert.ok(!krLanding.includes('₩6,900'), 'early-bird monthly is still on the page');
  assert.ok(!krLanding.includes('₩69,000'), 'early-bird yearly is still on the page');
});

test('EN landing quotes the USD amounts Stripe will charge', () => {
  assert.match(enLanding, /\$6\.99/);
  assert.match(enLanding, /\$69\.90/);
});

test('EN landing never shows KRW — overseas visitors bill in USD via Stripe', () => {
  assert.ok(!enLanding.includes('₩'), 'EN landing must not quote Korean Won');
});
